package config

import (
	"fmt"
	"os"
	"strings"

	"lovelybar/internal/payment"
)

type Config struct {
	Port          string
	DatabaseURL   string
	UploadDir     string
	AllowedOrigin string // CORS origin of the frontend (empty = same-origin only)
	SeedSample    bool

	Bank payment.BankAccount
}

func Load() (*Config, error) {
	c := &Config{
		Port:          get("PORT", "8080"),
		DatabaseURL:   get("DATABASE_URL", "postgres://lovelybar:lovelybar@localhost:5432/lovelybar?sslmode=disable"),
		UploadDir:     get("UPLOAD_DIR", "./uploads"),
		AllowedOrigin: os.Getenv("FRONTEND_ORIGIN"),
		SeedSample:    strings.EqualFold(os.Getenv("SEED_SAMPLE"), "true"),
	}

	code := strings.ToUpper(get("PAYMENT_BANK_CODE", ""))
	info, ok := payment.LookupBank(code)
	if bin := os.Getenv("PAYMENT_BANK_BIN"); bin != "" { // override for banks not in the built-in table
		info.BIN = bin
		if info.Name == "" {
			info.Name = code
		}
		ok = true
	}
	if code == "" || !ok {
		return nil, fmt.Errorf("PAYMENT_BANK_CODE %q is unknown; use a supported code or also set PAYMENT_BANK_BIN", code)
	}
	c.Bank = payment.BankAccount{
		Code:        code,
		BIN:         info.BIN,
		DisplayName: info.Name,
		AccountNo:   os.Getenv("PAYMENT_BANK_ACCOUNT"),
		AccountName: get("PAYMENT_BANK_NAME", ""),
	}
	if c.Bank.AccountNo == "" {
		return nil, fmt.Errorf("PAYMENT_BANK_ACCOUNT is required")
	}
	return c, nil
}

func get(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
