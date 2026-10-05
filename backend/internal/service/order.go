package service

import (
	"context"
	"fmt"
	"time"

	"lovelybar/internal/apperr"
	"lovelybar/internal/model"
	"lovelybar/internal/repository"
)

const (
	maxLines    = 50
	maxQuantity = 9999
	salePercent = 80
)

var vietnamTimeZone = time.FixedZone("ICT", 7*60*60)

// OrderLineInput is all the client may send. Prices and totals are never accepted.
type OrderLineInput struct {
	ProductID int64 `json:"productId"`
	Quantity  int   `json:"quantity"`
}

type CreateOrderInput struct {
	Items []OrderLineInput `json:"items"`
}

type OrderService struct{ repo *repository.Store }

func NewOrderService(repo *repository.Store) *OrderService { return &OrderService{repo: repo} }

func (s *OrderService) Create(ctx context.Context, in CreateOrderInput) (model.Order, error) {
	if len(in.Items) == 0 {
		return model.Order{}, apperr.BadRequest("Cart is empty")
	}
	if len(in.Items) > maxLines {
		return model.Order{}, apperr.BadRequest("Too many different products in one order")
	}
	ids := make([]int64, 0, len(in.Items))
	for _, l := range in.Items {
		ids = append(ids, l.ProductID)
	}
	products, err := s.repo.GetProductsByIDs(ctx, ids)
	if err != nil {
		return model.Order{}, err
	}
	items, total, err := calcLines(products, in.Items, time.Now())
	if err != nil {
		return model.Order{}, err
	}
	return s.repo.CreateOrder(ctx, items, total)
}

// calcLines is the single place where money is computed: prices come from the
// database, quantities are validated, duplicate products are merged.
func calcLines(products map[int64]model.Product, lines []OrderLineInput, now time.Time) ([]model.OrderItem, int64, error) {
	qty := map[int64]int{}
	order := []int64{}
	for _, l := range lines {
		if l.Quantity <= 0 || l.Quantity > maxQuantity {
			return nil, 0, apperr.BadRequest(fmt.Sprintf("Quantity must be between 1 and %d", maxQuantity))
		}
		p, ok := products[l.ProductID]
		if !ok || p.Status != model.ProductAvailable {
			return nil, 0, apperr.BadRequest("A product in your cart is no longer available")
		}
		if _, seen := qty[l.ProductID]; !seen {
			order = append(order, l.ProductID)
		}
		qty[l.ProductID] += l.Quantity
		if qty[l.ProductID] > maxQuantity {
			return nil, 0, apperr.BadRequest(fmt.Sprintf("Quantity must be between 1 and %d", maxQuantity))
		}
	}
	items := make([]model.OrderItem, 0, len(order))
	var total int64
	for _, id := range order {
		p := products[id]
		pid := p.ID
		unitPrice := priceAt(p.Price, now)
		sub := unitPrice * int64(qty[id])
		items = append(items, model.OrderItem{
			ProductID: &pid, ProductName: p.Name, UnitPrice: unitPrice, Quantity: qty[id], Subtotal: sub,
		})
		total += sub
	}
	return items, total, nil
}

func priceAt(price int64, now time.Time) int64 {
	localTime := now.In(vietnamTimeZone)
	minutes := localTime.Hour()*60 + localTime.Minute()
	if minutes >= 18*60+40 || minutes < 7*60 {
		return price * salePercent / 100
	}
	return price
}

func (s *OrderService) GetByCode(ctx context.Context, code string) (model.Order, error) {
	return s.repo.GetOrderByCode(ctx, code)
}

func (s *OrderService) AdminList(ctx context.Context, status string) ([]model.Order, error) {
	if status != "" && !validOrderStatus(status) {
		return nil, apperr.BadRequest("Invalid status filter")
	}
	return s.repo.ListOrders(ctx, status, 0)
}

func (s *OrderService) AdminGet(ctx context.Context, id int64) (model.Order, error) {
	return s.repo.GetOrderByID(ctx, id)
}

func (s *OrderService) UpdateStatus(ctx context.Context, id int64, status string) (model.Order, error) {
	if !validOrderStatus(status) {
		return model.Order{}, apperr.BadRequest("Status must be PENDING, COMPLETED or CANCELLED")
	}
	return s.repo.UpdateOrderStatus(ctx, id, status)
}

func (s *OrderService) Stats(ctx context.Context) (model.Stats, error) { return s.repo.Stats(ctx) }

func validOrderStatus(s string) bool {
	return s == model.OrderPending || s == model.OrderCompleted || s == model.OrderCancelled
}
