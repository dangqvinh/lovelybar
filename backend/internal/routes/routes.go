package routes

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"lovelybar/internal/handler"
	"lovelybar/internal/middleware"
	"lovelybar/internal/response"
)

func New(h *handler.Handler, uploadDir, allowedOrigin string) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger(), middleware.CORS(allowedOrigin))

	r.GET("/healthz", func(c *gin.Context) { c.String(http.StatusOK, "ok") })
	r.Static("/uploads", uploadDir)

	api := r.Group("/api")
	limit := middleware.RateLimit(30, time.Minute)

	api.GET("/products", h.ListProducts)
	api.GET("/products/:id", h.GetProduct)
	api.GET("/payment/methods", h.PaymentMethods)
	api.POST("/orders", limit, h.CreateOrder)
	api.GET("/orders/:code", h.GetOrder)
	api.POST("/payment/qr", limit, h.PaymentQR)

	// Admin: no authentication by design (internal MVP).
	admin := api.Group("/admin")
	admin.GET("/dashboard", h.AdminDashboard)
	admin.GET("/products", h.AdminListProducts)
	admin.POST("/products", h.AdminCreateProduct)
	admin.GET("/products/:id", h.AdminGetProduct)
	admin.PUT("/products/:id", h.AdminUpdateProduct)
	admin.DELETE("/products/:id", h.AdminDeleteProduct)
	admin.POST("/products/:id/image", h.AdminUploadImage)
	admin.DELETE("/products/:id/image", h.AdminDeleteImage)
	admin.GET("/orders", h.AdminListOrders)
	admin.GET("/orders/:id", h.AdminGetOrder)
	admin.PUT("/orders/:id/status", h.AdminUpdateOrderStatus)

	r.NoRoute(func(c *gin.Context) { response.Message(c, http.StatusNotFound, "Not found") })
	return r
}
