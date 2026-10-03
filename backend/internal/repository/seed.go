package repository

import "context"

// SeedSample inserts a few demo products when the table is empty (SEED_SAMPLE=true).
func (s *Store) SeedSample(ctx context.Context) error {
	n, err := s.CountProducts(ctx)
	if err != nil || n > 0 {
		return err
	}
	samples := []struct {
		name, desc string
		price      int64
	}{
		{"Peach Tea", "Trà đào mát lạnh, vị ngọt nhẹ.", 25000},
		{"Milk Coffee", "Cà phê sữa đậm đà, uống nóng hoặc đá.", 30000},
		{"Butter Bread", "Bánh mì bơ mềm, nướng mới mỗi sáng.", 20000},
		{"Strawberry Cake", "Bánh kem dâu từng miếng nhỏ.", 45000},
	}
	for _, p := range samples {
		if _, err := s.pool.Exec(ctx, `INSERT INTO products (name, description, price) VALUES ($1,$2,$3)`, p.name, p.desc, p.price); err != nil {
			return err
		}
	}
	return nil
}
