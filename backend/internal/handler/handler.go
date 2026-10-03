// Package handler translates HTTP to service calls. No business logic lives here.
package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"lovelybar/internal/apperr"
	"lovelybar/internal/response"
	"lovelybar/internal/service"
)

type Handler struct {
	Products *service.ProductService
	Orders   *service.OrderService
	Payment  *service.PaymentService
}

func idParam(c *gin.Context) (int64, bool) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		response.Fail(c, apperr.BadRequest("Invalid id"))
		return 0, false
	}
	return id, true
}

// bind reads a small JSON body.
func bind(c *gin.Context, dst any) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 64<<10)
	if err := c.ShouldBindJSON(dst); err != nil {
		response.Fail(c, apperr.BadRequest("Invalid request body"))
		return false
	}
	return true
}

// ---- public: products ----

func (h *Handler) ListProducts(c *gin.Context) {
	list, err := h.Products.ListPublic(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) GetProduct(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	p, err := h.Products.GetPublic(c.Request.Context(), id)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, p)
}

// ---- public: orders & payment ----

func (h *Handler) CreateOrder(c *gin.Context) {
	var in service.CreateOrderInput
	if !bind(c, &in) {
		return
	}
	o, err := h.Orders.Create(c.Request.Context(), in)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.Created(c, o)
}

// GetOrder looks an order up by its order code (not by sequential id).
func (h *Handler) GetOrder(c *gin.Context) {
	o, err := h.Orders.GetByCode(c.Request.Context(), c.Param("code"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, o)
}

func (h *Handler) PaymentMethods(c *gin.Context) {
	response.OK(c, gin.H{"methods": h.Payment.Methods()})
}

func (h *Handler) PaymentQR(c *gin.Context) {
	var in service.QRRequest
	if !bind(c, &in) {
		return
	}
	res, err := h.Payment.GenerateQR(c.Request.Context(), in)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, res)
}
