package service

import (
	"context"

	"lovelybar/internal/apperr"
	"lovelybar/internal/model"
	"lovelybar/internal/payment"
	"lovelybar/internal/repository"
)

type QRRequest struct {
	OrderCode     string `json:"orderCode"`
	PaymentMethod string `json:"paymentMethod"`
	BankCode      string `json:"bankCode"`
}

type QRResult struct {
	OrderID       int64  `json:"orderId"`
	OrderCode     string `json:"orderCode"`
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"paymentMethod"`
	QRCode        string `json:"qrCode"`
	BankName      string `json:"bankName,omitempty"`
	AccountName   string `json:"accountName,omitempty"`
}

type PaymentService struct {
	repo      *repository.Store
	providers map[string]payment.Provider
	order     []payment.Provider
}

func NewPaymentService(repo *repository.Store, providers ...payment.Provider) *PaymentService {
	s := &PaymentService{repo: repo, providers: map[string]payment.Provider{}, order: providers}
	for _, p := range providers {
		s.providers[p.Type()] = p
	}
	return s
}

func (s *PaymentService) Methods() []payment.Method {
	out := []payment.Method{}
	for _, p := range s.order {
		out = append(out, p.Methods()...)
	}
	return out
}

// GenerateQR never accepts an amount: it loads the order and uses its stored total.
func (s *PaymentService) GenerateQR(ctx context.Context, req QRRequest) (*QRResult, error) {
	method := req.PaymentMethod
	if method == "" {
		method = model.PaymentBank
	}
	provider, ok := s.providers[method]
	if !ok {
		return nil, apperr.BadRequest("Unsupported payment method")
	}
	if req.OrderCode == "" {
		return nil, apperr.BadRequest("orderCode is required")
	}
	order, err := s.repo.GetOrderByCode(ctx, req.OrderCode)
	if err != nil {
		return nil, err
	}
	if order.OrderStatus == model.OrderCancelled {
		return nil, apperr.BadRequest("This order was cancelled")
	}
	qr, err := provider.GenerateQR(req.BankCode, order.OrderCode, order.TotalAmount)
	if err != nil {
		return nil, apperr.BadRequest("Could not generate a QR code for this payment method")
	}
	if err := s.repo.SetPaymentMethod(ctx, order.ID, method); err != nil {
		return nil, err
	}
	return &QRResult{
		OrderID: order.ID, OrderCode: order.OrderCode, Amount: order.TotalAmount,
		PaymentMethod: qr.PaymentMethod, QRCode: qr.Image, BankName: qr.BankName, AccountName: qr.AccountName,
	}, nil
}
