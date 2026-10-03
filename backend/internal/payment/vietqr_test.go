package payment

import (
	"strconv"
	"testing"
)

func TestCRC16KnownVector(t *testing.T) {
	// Standard check value for CRC-16/CCITT-FALSE.
	if got := crc16("123456789"); got != 0x29B1 {
		t.Fatalf("crc16 = %04X, want 29B1", got)
	}
}

// parseTLV reads a flat TLV string into a map.
func parseTLV(t *testing.T, s string) map[string]string {
	t.Helper()
	out := map[string]string{}
	for len(s) > 0 {
		if len(s) < 4 {
			t.Fatalf("truncated TLV: %q", s)
		}
		n, err := strconv.Atoi(s[2:4])
		if err != nil || len(s) < 4+n {
			t.Fatalf("bad TLV length in %q", s)
		}
		out[s[:2]] = s[4 : 4+n]
		s = s[4+n:]
	}
	return out
}

func TestBuildVietQR_Amount80000(t *testing.T) {
	p, err := BuildVietQR("970436", "123456789", 80000, "LB20261003001")
	if err != nil {
		t.Fatal(err)
	}
	f := parseTLV(t, p)
	if f["54"] != "80000" {
		t.Errorf("amount = %q, want 80000", f["54"])
	}
	if f["53"] != "704" || f["58"] != "VN" || f["01"] != "12" {
		t.Errorf("unexpected fixed fields: %v", f)
	}
	if note := parseTLV(t, f["62"])["08"]; note != "LB20261003001" {
		t.Errorf("note = %q", note)
	}
	acct := parseTLV(t, parseTLV(t, f["38"])["01"])
	if acct["00"] != "970436" || acct["01"] != "123456789" {
		t.Errorf("beneficiary = %v", acct)
	}
	// CRC covers everything up to and including "6304".
	body := p[:len(p)-4]
	if want := p[len(p)-4:]; want != strconv.FormatUint(uint64(crc16(body)), 16) && !equalHex(want, crc16(body)) {
		t.Errorf("crc mismatch")
	}
}

func equalHex(s string, v uint16) bool {
	n, err := strconv.ParseUint(s, 16, 32)
	return err == nil && uint16(n) == v
}

func TestBuildVietQR_Rejects(t *testing.T) {
	if _, err := BuildVietQR("970436", "123456789", 0, "x"); err == nil {
		t.Error("expected error for zero amount")
	}
	if _, err := BuildVietQR("12", "123456789", 10, "x"); err == nil {
		t.Error("expected error for bad BIN")
	}
}

func TestNoteIsSanitized(t *testing.T) {
	if got := sanitizeNote("Đơn hàng LB1 and a very very long note"); len(got) > 25 {
		t.Errorf("note too long: %q", got)
	}
}
