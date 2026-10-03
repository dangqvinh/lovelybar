package response

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"lovelybar/internal/apperr"
)

func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func Created(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": data})
}

func Message(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"success": false, "message": msg})
}

// Fail maps an error to a safe JSON response. Unknown errors are logged, never leaked.
func Fail(c *gin.Context, err error) {
	var ae *apperr.Error
	if errors.As(err, &ae) {
		Message(c, ae.Status, ae.Msg)
		return
	}
	log.Printf("internal error: %s %s: %v", c.Request.Method, c.Request.URL.Path, err)
	Message(c, http.StatusInternalServerError, "Something went wrong. Please try again.")
}
