package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"lovelybar/internal/apperr"
	"lovelybar/internal/model"
)

const orderCols = `id, order_code, total_amount, payment_method, order_status, created_at, updated_at`

var vietnamTZ = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		return time.FixedZone("ICT", 7*3600)
	}
	return loc
}()

func scanOrder(row pgx.Row) (model.Order, error) {
	var o model.Order
	err := row.Scan(&o.ID, &o.OrderCode, &o.TotalAmount, &o.PaymentMethod, &o.OrderStatus, &o.CreatedAt, &o.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return o, apperr.NotFound("Order not found")
	}
	o.Items = []model.OrderItem{}
	return o, err
}

// CreateOrder stores the order and its snapshotted items in one transaction.
// Items must already carry prices computed by the backend.
func (s *Store) CreateOrder(ctx context.Context, items []model.OrderItem, total int64) (model.Order, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return model.Order{}, err
	}
	defer tx.Rollback(ctx)

	day := time.Now().In(vietnamTZ)
	var n int
	err = tx.QueryRow(ctx,
		`INSERT INTO order_counters (day, n) VALUES ($1::date, 1)
		 ON CONFLICT (day) DO UPDATE SET n = order_counters.n + 1 RETURNING n`,
		day.Format("2006-01-02")).Scan(&n)
	if err != nil {
		return model.Order{}, err
	}
	code := fmt.Sprintf("LB%s%03d", day.Format("20060102"), n)

	order, err := scanOrder(tx.QueryRow(ctx,
		`INSERT INTO orders (order_code, total_amount, payment_method) VALUES ($1,$2,$3) RETURNING `+orderCols,
		code, total, model.PaymentBank))
	if err != nil {
		return model.Order{}, err
	}
	for _, it := range items {
		var saved model.OrderItem
		err = tx.QueryRow(ctx,
			`INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
			 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, product_id, product_name, unit_price, quantity, subtotal`,
			order.ID, it.ProductID, it.ProductName, it.UnitPrice, it.Quantity, it.Subtotal,
		).Scan(&saved.ID, &saved.ProductID, &saved.ProductName, &saved.UnitPrice, &saved.Quantity, &saved.Subtotal)
		if err != nil {
			return model.Order{}, err
		}
		order.Items = append(order.Items, saved)
	}
	return order, tx.Commit(ctx)
}

func (s *Store) GetOrderByCode(ctx context.Context, code string) (model.Order, error) {
	return s.getOrder(ctx, `order_code = $1`, code)
}

func (s *Store) GetOrderByID(ctx context.Context, id int64) (model.Order, error) {
	return s.getOrder(ctx, `id = $1`, id)
}

func (s *Store) getOrder(ctx context.Context, where string, arg any) (model.Order, error) {
	o, err := scanOrder(s.pool.QueryRow(ctx, `SELECT `+orderCols+` FROM orders WHERE `+where, arg))
	if err != nil {
		return o, err
	}
	items, err := s.loadItems(ctx, []int64{o.ID})
	if err != nil {
		return o, err
	}
	o.Items = items[o.ID]
	if o.Items == nil {
		o.Items = []model.OrderItem{}
	}
	return o, nil
}

// ListOrders returns newest first. status may be empty for all orders; limit <= 0 means no limit.
func (s *Store) ListOrders(ctx context.Context, status string, limit int) ([]model.Order, error) {
	q := `SELECT ` + orderCols + ` FROM orders WHERE ($1 = '' OR order_status = $1) ORDER BY created_at DESC, id DESC`
	args := []any{status}
	if limit > 0 {
		q += ` LIMIT $2`
		args = append(args, limit)
	}
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	orders := []model.Order{}
	ids := []int64{}
	for rows.Next() {
		o, err := scanOrder(rows)
		if err != nil {
			return nil, err
		}
		orders = append(orders, o)
		ids = append(ids, o.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	items, err := s.loadItems(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range orders {
		if its := items[orders[i].ID]; its != nil {
			orders[i].Items = its
		}
	}
	return orders, nil
}

func (s *Store) loadItems(ctx context.Context, orderIDs []int64) (map[int64][]model.OrderItem, error) {
	out := map[int64][]model.OrderItem{}
	if len(orderIDs) == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx,
		`SELECT order_id, id, product_id, product_name, unit_price, quantity, subtotal
		 FROM order_items WHERE order_id = ANY($1) ORDER BY id`, orderIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var orderID int64
		var it model.OrderItem
		if err := rows.Scan(&orderID, &it.ID, &it.ProductID, &it.ProductName, &it.UnitPrice, &it.Quantity, &it.Subtotal); err != nil {
			return nil, err
		}
		out[orderID] = append(out[orderID], it)
	}
	return out, rows.Err()
}

func (s *Store) UpdateOrderStatus(ctx context.Context, id int64, status string) (model.Order, error) {
	if _, err := scanOrder(s.pool.QueryRow(ctx,
		`UPDATE orders SET order_status=$2, updated_at=now() WHERE id=$1 RETURNING `+orderCols, id, status)); err != nil {
		return model.Order{}, err
	}
	return s.GetOrderByID(ctx, id)
}

func (s *Store) SetPaymentMethod(ctx context.Context, id int64, method string) error {
	_, err := s.pool.Exec(ctx, `UPDATE orders SET payment_method=$2, updated_at=now() WHERE id=$1`, id, method)
	return err
}

func (s *Store) Stats(ctx context.Context) (model.Stats, error) {
	var st model.Stats
	err := s.pool.QueryRow(ctx, `
		SELECT
		  (SELECT count(*) FROM products),
		  count(*),
		  count(*) FILTER (WHERE order_status = 'PENDING'),
		  COALESCE(sum(total_amount) FILTER (WHERE order_status <> 'CANCELLED'), 0)
		FROM orders`).Scan(&st.TotalProducts, &st.TotalOrders, &st.PendingOrders, &st.ExpectedRevenue)
	if err != nil {
		return st, err
	}
	st.RecentOrders, err = s.ListOrders(ctx, "", 5)
	return st, err
}
