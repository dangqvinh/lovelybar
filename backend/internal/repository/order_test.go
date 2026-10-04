package repository

import (
	"testing"
	"time"
)

func TestFormatOrderCode(t *testing.T) {
	day := time.Date(2026, time.October, 3, 0, 0, 0, 0, time.UTC)
	tests := []struct {
		sequence int
		want     string
	}{
		{sequence: 1, want: "LB20261003001"},
		{sequence: 1000, want: "LB202610031000"},
	}

	for _, test := range tests {
		if got := formatOrderCode(day, test.sequence); got != test.want {
			t.Errorf("formatOrderCode(%d) = %q, want %q", test.sequence, got, test.want)
		}
	}
}
