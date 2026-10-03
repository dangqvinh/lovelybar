package model

import "time"

const (
	ProductAvailable = "AVAILABLE"
	ProductHidden    = "HIDDEN"

	OrderPending   = "PENDING"
	OrderCompleted = "COMPLETED"
	OrderCancelled = "CANCELLED"

	PaymentBank = "BANK"
)

type Product struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       int64     `json:"price"`
	Image       *string   `json:"image"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type OrderItem struct {
	ID          int64  `json:"id"`
	ProductID   *int64 `json:"productId"`
	ProductName string `json:"productName"`
	UnitPrice   int64  `json:"unitPrice"`
	Quantity    int    `json:"quantity"`
	Subtotal    int64  `json:"subtotal"`
}

type Order struct {
	ID            int64       `json:"id"`
	OrderCode     string      `json:"orderCode"`
	TotalAmount   int64       `json:"totalAmount"`
	PaymentMethod string      `json:"paymentMethod"`
	OrderStatus   string      `json:"orderStatus"`
	CreatedAt     time.Time   `json:"createdAt"`
	UpdatedAt     time.Time   `json:"updatedAt"`
	Items         []OrderItem `json:"items"`
}

type Stats struct {
	TotalProducts   int64   `json:"totalProducts"`
	TotalOrders     int64   `json:"totalOrders"`
	PendingOrders   int64   `json:"pendingOrders"`
	ExpectedRevenue int64   `json:"expectedRevenue"` // sum of non-cancelled orders; NOT confirmed money
	RecentOrders    []Order `json:"recentOrders"`
}
