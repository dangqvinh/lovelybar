package payment

// BankInfo holds the NAPAS BIN (acquirer id) used inside a VietQR payload.
// BINs are issued by the State Bank of Vietnam; verify against https://api.vietqr.io/v2/banks
// before going live, or override with PAYMENT_BANK_BIN.
type BankInfo struct {
	BIN  string
	Name string
}

var banks = map[string]BankInfo{
	"VCB":  {"970436", "Vietcombank"},
	"MB":   {"970422", "MB Bank"},
	"BIDV": {"970418", "BIDV"},
	"TCB":  {"970407", "Techcombank"},
	"ACB":  {"970416", "ACB"},
	"CTG":  {"970415", "VietinBank"},
	"VPB":  {"970432", "VPBank"},
	"TPB":  {"970423", "TPBank"},
	"STB":  {"970403", "Sacombank"},
	"VIB":  {"970441", "VIB"},
	"HDB":  {"970437", "HDBank"},
	"SHB":  {"970443", "SHB"},
	"MSB":  {"970426", "MSB"},
	"OCB":  {"970448", "OCB"},
	"LPB":  {"970449", "LPBank"},
	"VBA":  {"970405", "Agribank"},
}

func LookupBank(code string) (BankInfo, bool) {
	b, ok := banks[code]
	return b, ok
}
