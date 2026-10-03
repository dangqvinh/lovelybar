// Package service holds business rules and validation. Handlers stay thin.
package service

import (
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"unicode/utf8"

	"lovelybar/internal/apperr"
	"lovelybar/internal/model"
	"lovelybar/internal/repository"
	"lovelybar/internal/storage"
)

const (
	maxPrice     = 1_000_000_000
	MaxImageSize = 2 << 20 // 2 MB
)

var imageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type ProductInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Price       int64  `json:"price"`
	Status      string `json:"status"`
}

type ProductService struct {
	repo  *repository.Store
	files storage.Storage
}

func NewProductService(repo *repository.Store, files storage.Storage) *ProductService {
	return &ProductService{repo: repo, files: files}
}

func (in *ProductInput) validate() (*model.Product, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, apperr.BadRequest("Product name is required")
	}
	if utf8.RuneCountInString(name) > 200 {
		return nil, apperr.BadRequest("Product name must be at most 200 characters")
	}
	desc := strings.TrimSpace(in.Description)
	if utf8.RuneCountInString(desc) > 2000 {
		return nil, apperr.BadRequest("Description must be at most 2000 characters")
	}
	if in.Price < 0 || in.Price > maxPrice {
		return nil, apperr.BadRequest("Price must be between 0 and 1,000,000,000")
	}
	status := in.Status
	if status == "" {
		status = model.ProductAvailable
	}
	if status != model.ProductAvailable && status != model.ProductHidden {
		return nil, apperr.BadRequest("Status must be AVAILABLE or HIDDEN")
	}
	return &model.Product{Name: name, Description: desc, Price: in.Price, Status: status}, nil
}

// Public catalog: hidden products are never returned.
func (s *ProductService) ListPublic(ctx context.Context) ([]model.Product, error) {
	return s.repo.ListProducts(ctx, true)
}

func (s *ProductService) GetPublic(ctx context.Context, id int64) (model.Product, error) {
	p, err := s.repo.GetProduct(ctx, id)
	if err != nil {
		return p, err
	}
	if p.Status != model.ProductAvailable {
		return model.Product{}, apperr.NotFound("Product not found")
	}
	return p, nil
}

func (s *ProductService) ListAll(ctx context.Context) ([]model.Product, error) {
	return s.repo.ListProducts(ctx, false)
}

func (s *ProductService) GetAny(ctx context.Context, id int64) (model.Product, error) {
	return s.repo.GetProduct(ctx, id)
}

func (s *ProductService) Create(ctx context.Context, in ProductInput) (model.Product, error) {
	p, err := in.validate()
	if err != nil {
		return model.Product{}, err
	}
	return s.repo.CreateProduct(ctx, *p)
}

func (s *ProductService) Update(ctx context.Context, id int64, in ProductInput) (model.Product, error) {
	p, err := in.validate()
	if err != nil {
		return model.Product{}, err
	}
	return s.repo.UpdateProduct(ctx, id, *p)
}

func (s *ProductService) Delete(ctx context.Context, id int64) error {
	p, err := s.repo.GetProduct(ctx, id)
	if err != nil {
		return err
	}
	if err := s.repo.DeleteProduct(ctx, id); err != nil {
		return err
	}
	if p.Image != nil {
		_ = s.files.Delete(*p.Image) // best effort; orphaned file is harmless
	}
	return nil
}

// SetImage validates the upload by its real content (not the filename), then replaces any old image.
func (s *ProductService) SetImage(ctx context.Context, id int64, file multipart.File, size int64) (model.Product, error) {
	if size > MaxImageSize {
		return model.Product{}, apperr.BadRequest("Image must be 2 MB or smaller")
	}
	old, err := s.repo.GetProduct(ctx, id)
	if err != nil {
		return model.Product{}, err
	}
	head := make([]byte, 512)
	n, _ := io.ReadFull(file, head)
	ext, ok := imageTypes[http.DetectContentType(head[:n])]
	if !ok {
		return model.Product{}, apperr.BadRequest("Image must be JPG, PNG or WEBP")
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return model.Product{}, err
	}
	path, err := s.files.Save(io.LimitReader(file, MaxImageSize+1), ext)
	if err != nil {
		return model.Product{}, err
	}
	p, err := s.repo.SetProductImage(ctx, id, &path)
	if err != nil {
		_ = s.files.Delete(path)
		return model.Product{}, err
	}
	if old.Image != nil {
		_ = s.files.Delete(*old.Image)
	}
	return p, nil
}

func (s *ProductService) RemoveImage(ctx context.Context, id int64) (model.Product, error) {
	old, err := s.repo.GetProduct(ctx, id)
	if err != nil {
		return model.Product{}, err
	}
	p, err := s.repo.SetProductImage(ctx, id, nil)
	if err != nil {
		return model.Product{}, err
	}
	if old.Image != nil {
		_ = s.files.Delete(*old.Image)
	}
	return p, nil
}
