// Package apperr defines errors that carry an HTTP status and a safe message.
package apperr

import "net/http"

type Error struct {
	Status int
	Msg    string
}

func (e *Error) Error() string { return e.Msg }

func BadRequest(msg string) *Error { return &Error{Status: http.StatusBadRequest, Msg: msg} }
func NotFound(msg string) *Error   { return &Error{Status: http.StatusNotFound, Msg: msg} }
