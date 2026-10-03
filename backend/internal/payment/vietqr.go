package payment

import (
	"fmt"
	"strconv"
	"strings"
)

// BuildVietQR builds an EMVCo "dynamic" VietQR payload (NAPAS 247 transfer to an account).
// The amount and note are encoded in the payload, so the payer's banking app pre-fills them.
func BuildVietQR(bin, accountNo string, amount int64, note string) (string, error) {
	if len(bin) != 6 {
		return "", fmt.Errorf("invalid bank BIN %q", bin)
	}
	if accountNo == "" || len(accountNo) > 19 {
		return "", fmt.Errorf("invalid account number")
	}
	if amount <= 0 {
		return "", fmt.Errorf("amount must be positive")
	}
	note = sanitizeNote(note)

	beneficiary := tlv("00", bin) + tlv("01", accountNo)
	merchantInfo := tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA")

	body := tlv("00", "01") + // payload format version
		tlv("01", "12") + // 12 = dynamic QR (carries an amount)
		tlv("38", merchantInfo) +
		tlv("53", "704") + // VND
		tlv("54", strconv.FormatInt(amount, 10)) +
		tlv("58", "VN")
	if note != "" {
		body += tlv("62", tlv("08", note))
	}
	body += "6304"
	return body + fmt.Sprintf("%04X", crc16(body)), nil
}

func tlv(id, value string) string { return id + fmt.Sprintf("%02d", len(value)) + value }

// The transfer note must be plain ASCII and at most 25 characters.
func sanitizeNote(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= 0x20 && r < 0x7f {
			b.WriteRune(r)
		}
	}
	out := b.String()
	if len(out) > 25 {
		out = out[:25]
	}
	return out
}

// crc16 is CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as required by EMVCo.
func crc16(s string) uint16 {
	crc := uint16(0xFFFF)
	for i := 0; i < len(s); i++ {
		crc ^= uint16(s[i]) << 8
		for j := 0; j < 8; j++ {
			if crc&0x8000 != 0 {
				crc = crc<<1 ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}
	return crc
}
