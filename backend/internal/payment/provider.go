// Package payment holds payment providers. Adding a provider means implementing
// Provider and registering it in service.NewPaymentService; no handler or frontend change.
package payment

import (
	"encoding/base64"
	"fmt"

	qrcode "github.com/skip2/go-qrcode"
)

// Method is the public, non-sensitive description sent to the frontend.
type Method struct {
	Type string `json:"type"`
	Code string `json:"code"`
	Name string `json:"name"`
}

// QR is what a provider returns for one order.
type QR struct {
	PaymentMethod string `json:"paymentMethod"`
	Image         string `json:"qrCode"` // data URL (PNG)
	BankName      string `json:"bankName,omitempty"`
	AccountName   string `json:"accountName,omitempty"`
}

type Provider interface {
	Type() string
	Methods() []Method
	// GenerateQR must use the amount passed in, which the caller reads from the database.
	GenerateQR(code, orderCode string, amount int64) (*QR, error)
}

type BankAccount struct {
	Code        string
	BIN         string
	DisplayName string
	AccountNo   string
	AccountName string
}

// BankProvider generates VietQR codes for one receiving bank account.
// It only generates the QR; it cannot know whether the money arrived.
type BankProvider struct{ acc BankAccount }

func NewBankProvider(acc BankAccount) *BankProvider { return &BankProvider{acc: acc} }

func (p *BankProvider) Type() string { return "BANK" }

func (p *BankProvider) Methods() []Method {
	return []Method{{Type: "BANK", Code: p.acc.Code, Name: p.acc.DisplayName}}
}

func (p *BankProvider) GenerateQR(code, orderCode string, amount int64) (*QR, error) {
	if code != "" && code != p.acc.Code {
		return nil, fmt.Errorf("unsupported bank code")
	}
	payload, err := BuildVietQR(p.acc.BIN, p.acc.AccountNo, amount, orderCode)
	if err != nil {
		return nil, err
	}
	png, err := qrcode.Encode(payload, qrcode.Medium, 640)
	if err != nil {
		return nil, err
	}
	return &QR{
		PaymentMethod: "BANK",
		Image:         "data:image/png;base64," + base64.StdEncoding.EncodeToString(png),
		BankName:      p.acc.DisplayName,
		AccountName:   p.acc.AccountName,
	}, nil
}
