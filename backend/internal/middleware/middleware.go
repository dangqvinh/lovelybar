package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"lovelybar/internal/response"
)

// CORS allows a single configured frontend origin. With no origin set, only same-origin works.
func CORS(origin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if origin != "" && c.GetHeader("Origin") == origin {
			h := c.Writer.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Vary", "Origin")
			h.Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Content-Type")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// RateLimit is a small fixed-window limiter per client IP, enough to blunt spam on public POST endpoints.
func RateLimit(max int, window time.Duration) gin.HandlerFunc {
	type bucket struct {
		count int
		reset time.Time
	}
	var mu sync.Mutex
	buckets := map[string]*bucket{}

	go func() {
		for range time.Tick(window) {
			mu.Lock()
			now := time.Now()
			for ip, b := range buckets {
				if now.After(b.reset) {
					delete(buckets, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		ip := c.ClientIP()
		mu.Lock()
		b, ok := buckets[ip]
		if !ok || time.Now().After(b.reset) {
			b = &bucket{reset: time.Now().Add(window)}
			buckets[ip] = b
		}
		b.count++
		over := b.count > max
		mu.Unlock()
		if over {
			response.Message(c, http.StatusTooManyRequests, "Too many requests. Please wait a moment and try again.")
			c.Abort()
			return
		}
		c.Next()
	}
}
