package service

import (
	"testing"
	"time"

	"lovelybar/internal/model"
)

func products() map[int64]model.Product {
	return map[int64]model.Product{
		1: {ID: 1, Name: "Product A", Price: 25000, Status: model.ProductAvailable},
		2: {ID: 2, Name: "Product B", Price: 30000, Status: model.ProductAvailable},
		3: {ID: 3, Name: "Hidden", Price: 10000, Status: model.ProductHidden},
	}
}

func TestCalcLines_Example80000(t *testing.T) {
	items, total, err := calcLines(products(), []OrderLineInput{{1, 2}, {2, 1}}, time.Date(2026, 10, 5, 12, 0, 0, 0, vietnamTimeZone))
	if err != nil {
		t.Fatal(err)
	}
	if total != 80000 {
		t.Fatalf("total = %d, want 80000", total)
	}
	if items[0].Subtotal != 50000 || items[1].Subtotal != 30000 {
		t.Fatalf("subtotals = %d, %d", items[0].Subtotal, items[1].Subtotal)
	}
	if items[0].ProductName != "Product A" || items[0].UnitPrice != 25000 {
		t.Fatalf("snapshot wrong: %+v", items[0])
	}
}

func TestCalcLines_MergesDuplicates(t *testing.T) {
	items, total, err := calcLines(products(), []OrderLineInput{{1, 1}, {1, 2}}, time.Date(2026, 10, 5, 12, 0, 0, 0, vietnamTimeZone))
	if err != nil || len(items) != 1 || items[0].Quantity != 3 || total != 75000 {
		t.Fatalf("items=%+v total=%d err=%v", items, total, err)
	}
}

func TestCalcLines_Rejects(t *testing.T) {
	cases := map[string][]OrderLineInput{
		"zero qty":     {{1, 0}},
		"negative qty": {{1, -1}},
		"huge qty":     {{1, maxQuantity + 1}},
		"unknown id":   {{99, 1}},
		"hidden":       {{3, 1}},
		"merged huge":  {{1, maxQuantity}, {1, 1}},
	}
	for name, lines := range cases {
		if _, _, err := calcLines(products(), lines, time.Date(2026, 10, 5, 12, 0, 0, 0, vietnamTimeZone)); err == nil {
			t.Errorf("%s: expected error", name)
		}
	}
}

func TestCalcLines_LargeQuantity(t *testing.T) {
	// 100 x 20,000 = 2,000,000 with no stock limit.
	_, total, err := calcLines(map[int64]model.Product{
		1: {ID: 1, Name: "A", Price: 20000, Status: model.ProductAvailable},
	}, []OrderLineInput{{1, 100}}, time.Date(2026, 10, 5, 12, 0, 0, 0, vietnamTimeZone))
	if err != nil || total != 2_000_000 {
		t.Fatalf("total=%d err=%v", total, err)
	}
}

func TestPriceAt_NightSaleWindow(t *testing.T) {
	cases := []struct {
		name string
		hour int
		min  int
		want int64
	}{
		{name: "before evening start", hour: 18, min: 39, want: 101},
		{name: "at evening start", hour: 18, min: 40, want: 80},
		{name: "before morning end", hour: 6, min: 59, want: 80},
		{name: "at morning end", hour: 7, min: 0, want: 101},
		{name: "daytime", hour: 12, min: 0, want: 101},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Date(2026, 10, 5, tc.hour, tc.min, 0, 0, vietnamTimeZone)
			if got := priceAt(101, now); got != tc.want {
				t.Fatalf("priceAt(101, %s) = %d, want %d", now.Format("15:04"), got, tc.want)
			}
		})
	}
}

func TestCalcLines_AppliesNightSalePrice(t *testing.T) {
	items, total, err := calcLines(products(), []OrderLineInput{{1, 2}, {2, 1}}, time.Date(2026, 10, 5, 19, 0, 0, 0, vietnamTimeZone))
	if err != nil {
		t.Fatal(err)
	}
	if total != 64000 || items[0].UnitPrice != 20000 || items[0].Subtotal != 40000 {
		t.Fatalf("items=%+v total=%d, want discounted total 64000", items, total)
	}
}
