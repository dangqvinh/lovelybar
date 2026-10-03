package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"lovelybar/internal/config"
	"lovelybar/internal/handler"
	"lovelybar/internal/payment"
	"lovelybar/internal/repository"
	"lovelybar/internal/routes"
	"lovelybar/internal/service"
	"lovelybar/internal/storage"
	"lovelybar/migrations"

	_ "time/tzdata"
)

func main() {
	_ = godotenv.Load() // optional .env for local development
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	ctx := context.Background()

	pool, err := connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()
	if err := repository.Migrate(ctx, pool, migrations.FS); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	repo := repository.New(pool)
	if cfg.SeedSample {
		if err := repo.SeedSample(ctx); err != nil {
			log.Fatalf("seed: %v", err)
		}
	}
	files, err := storage.NewLocal(cfg.UploadDir)
	if err != nil {
		log.Fatalf("storage: %v", err)
	}

	h := &handler.Handler{
		Products: service.NewProductService(repo, files),
		Orders:   service.NewOrderService(repo),
		Payment:  service.NewPaymentService(repo, payment.NewBankProvider(cfg.Bank)),
	}
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           routes.New(h, cfg.UploadDir, cfg.AllowedOrigin),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("LovelyBar API listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdownCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}

// connect retries briefly so the API can start while Postgres is still booting (docker compose).
func connect(ctx context.Context, url string) (*pgxpool.Pool, error) {
	var lastErr error
	for i := 0; i < 15; i++ {
		pool, err := pgxpool.New(ctx, url)
		if err == nil {
			if err = pool.Ping(ctx); err == nil {
				return pool, nil
			}
			pool.Close()
		}
		lastErr = err
		time.Sleep(2 * time.Second)
	}
	return nil, lastErr
}
