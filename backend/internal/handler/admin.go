package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"lovelybar/internal/apperr"
	"lovelybar/internal/response"
	"lovelybar/internal/service"
)

// NOTE: these handlers are intentionally NOT protected (internal MVP). See README.

func (h *Handler) AdminListProducts(c *gin.Context) {
	list, err := h.Products.ListAll(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) AdminGetProduct(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	p, err := h.Products.GetAny(c.Request.Context(), id)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, p)
}

func (h *Handler) AdminCreateProduct(c *gin.Context) {
	var in service.ProductInput
	if !bind(c, &in) {
		return
	}
	p, err := h.Products.Create(c.Request.Context(), in)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.Created(c, p)
}

func (h *Handler) AdminUpdateProduct(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in service.ProductInput
	if !bind(c, &in) {
		return
	}
	p, err := h.Products.Update(c.Request.Context(), id, in)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, p)
}

func (h *Handler) AdminDeleteProduct(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	if err := h.Products.Delete(c.Request.Context(), id); err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, gin.H{"deleted": true})
}

func (h *Handler) AdminUploadImage(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, service.MaxImageSize+(1<<20))
	fh, err := c.FormFile("image")
	if err != nil {
		response.Fail(c, apperr.BadRequest("Choose an image file to upload (max 2 MB)"))
		return
	}
	f, err := fh.Open()
	if err != nil {
		response.Fail(c, err)
		return
	}
	defer f.Close()
	p, err := h.Products.SetImage(c.Request.Context(), id, f, fh.Size)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, p)
}

func (h *Handler) AdminDeleteImage(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	p, err := h.Products.RemoveImage(c.Request.Context(), id)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, p)
}

func (h *Handler) AdminListOrders(c *gin.Context) {
	list, err := h.Orders.AdminList(c.Request.Context(), c.Query("status"))
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, list)
}

func (h *Handler) AdminGetOrder(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	o, err := h.Orders.AdminGet(c.Request.Context(), id)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, o)
}

func (h *Handler) AdminUpdateOrderStatus(c *gin.Context) {
	id, ok := idParam(c)
	if !ok {
		return
	}
	var in struct {
		Status string `json:"status"`
	}
	if !bind(c, &in) {
		return
	}
	o, err := h.Orders.UpdateStatus(c.Request.Context(), id, in.Status)
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, o)
}

func (h *Handler) AdminDashboard(c *gin.Context) {
	st, err := h.Orders.Stats(c.Request.Context())
	if err != nil {
		response.Fail(c, err)
		return
	}
	response.OK(c, st)
}
