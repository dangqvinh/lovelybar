package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"lovelybar/internal/apperr"
	"lovelybar/internal/model"
)

const productCols = `id, name, description, price, image, status, created_at, updated_at`

func scanProduct(row pgx.Row) (model.Product, error) {
	var p model.Product
	err := row.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.Image, &p.Status, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, apperr.NotFound("Product not found")
	}
	return p, err
}

func (s *Store) ListProducts(ctx context.Context, onlyAvailable bool) ([]model.Product, error) {
	q := `SELECT ` + productCols + ` FROM products`
	if onlyAvailable {
		q += ` WHERE status = 'AVAILABLE'`
	}
	q += ` ORDER BY created_at DESC, id DESC`
	rows, err := s.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Product{}
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) GetProduct(ctx context.Context, id int64) (model.Product, error) {
	return scanProduct(s.pool.QueryRow(ctx, `SELECT `+productCols+` FROM products WHERE id=$1`, id))
}

// GetProductsByIDs returns the products that exist, keyed by id.
func (s *Store) GetProductsByIDs(ctx context.Context, ids []int64) (map[int64]model.Product, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+productCols+` FROM products WHERE id = ANY($1)`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]model.Product{}
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		out[p.ID] = p
	}
	return out, rows.Err()
}

func (s *Store) CreateProduct(ctx context.Context, p model.Product) (model.Product, error) {
	return scanProduct(s.pool.QueryRow(ctx,
		`INSERT INTO products (name, description, price, status) VALUES ($1,$2,$3,$4) RETURNING `+productCols,
		p.Name, p.Description, p.Price, p.Status))
}

func (s *Store) UpdateProduct(ctx context.Context, id int64, p model.Product) (model.Product, error) {
	return scanProduct(s.pool.QueryRow(ctx,
		`UPDATE products SET name=$2, description=$3, price=$4, status=$5, updated_at=now() WHERE id=$1 RETURNING `+productCols,
		id, p.Name, p.Description, p.Price, p.Status))
}

func (s *Store) SetProductImage(ctx context.Context, id int64, image *string) (model.Product, error) {
	return scanProduct(s.pool.QueryRow(ctx,
		`UPDATE products SET image=$2, updated_at=now() WHERE id=$1 RETURNING `+productCols, id, image))
}

func (s *Store) DeleteProduct(ctx context.Context, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM products WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("Product not found")
	}
	return nil
}

func (s *Store) CountProducts(ctx context.Context) (n int64, err error) {
	err = s.pool.QueryRow(ctx, `SELECT count(*) FROM products`).Scan(&n)
	return
}
