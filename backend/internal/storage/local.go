// Package storage saves uploaded product images. Local is the MVP implementation;
// swap in an S3/R2 implementation of Storage later without touching other code.
package storage

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const urlPrefix = "/uploads/"

type Storage interface {
	// Save stores the content and returns the public path (e.g. /uploads/ab12.jpg).
	Save(r io.Reader, ext string) (string, error)
	Delete(path string) error
}

type Local struct{ dir string }

func NewLocal(dir string) (*Local, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Local{dir: dir}, nil
}

func (l *Local) Save(r io.Reader, ext string) (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	name := hex.EncodeToString(buf) + ext
	f, err := os.OpenFile(filepath.Join(l.dir, name), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(f, r); err != nil {
		f.Close()
		os.Remove(f.Name())
		return "", err
	}
	if err := f.Close(); err != nil {
		return "", err
	}
	return urlPrefix + name, nil
}

func (l *Local) Delete(path string) error {
	if !strings.HasPrefix(path, urlPrefix) {
		return nil // not one of ours (e.g. an external URL)
	}
	err := os.Remove(filepath.Join(l.dir, filepath.Base(path)))
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
