const bankBins: Record<string, string> = {
  VCB: "970436",
  MB: "970422",
  BIDV: "970418",
  TCB: "970407",
  ACB: "970416",
  CTG: "970415",
  VPB: "970432",
  TPB: "970423",
  STB: "970403",
  VIB: "970441",
  HDB: "970437",
  SHB: "970443",
  MSB: "970426",
  OCB: "970448",
  LPB: "970449",
  VBA: "970405",
};

export function validateQrRequest(input: Record<string, unknown>): {
  orderCode: string;
} {
  if ("amount" in input || "donationAmount" in input) {
    throw new Error("Amount must not be provided");
  }
  const orderCode = typeof input.orderCode === "string" ? input.orderCode.trim() : "";
  if (!orderCode || orderCode.length > 64 || (input.paymentMethod ?? "BANK") !== "BANK") {
    throw new Error("orderCode is required and paymentMethod must be BANK");
  }
  return { orderCode };
}

export function validateDonationRequest(input: Record<string, unknown>): {
  amount: number;
} {
  if ("orderCode" in input || "paymentMethod" in input) {
    throw new Error("Donation amount must be provided without an order");
  }
  const amount = input.donationAmount;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Donation amount must be a positive integer");
  }
  return { amount };
}

function tlv(tag: string, value: string): string {
  if (!/^\d{2}$/.test(tag) || value.length > 99) {
    throw new Error("Invalid VietQR field");
  }
  return `${tag}${value.length.toString().padStart(2, "0")}${value}`;
}

export function sanitizeNote(input: string): string {
  return input.replace(/[^\x20-\x7E]/g, "").slice(0, 25);
}

export function crc16CcittFalse(input: string): number {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0
        ? ((crc << 1) ^ 0x1021) & 0xffff
        : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export function resolveBankBin(bankCode: string, override?: string): string {
  const bin = override || bankBins[bankCode];
  if (!bin || !/^\d{6}$/.test(bin)) {
    throw new Error("Unsupported or invalid bank BIN");
  }
  return bin;
}

export function buildVietQrPayload(
  bankBin: string,
  accountNumber: string,
  amount: number,
  orderCode: string,
): string {
  if (!/^\d{6}$/.test(bankBin)) {
    throw new Error("Invalid bank BIN");
  }
  if (!accountNumber || accountNumber.length > 19 || !/^[\x21-\x7E]+$/.test(accountNumber)) {
    throw new Error("Invalid account number");
  }
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Amount must be a positive integer");
  }

  const beneficiary = tlv("00", bankBin) + tlv("01", accountNumber);
  const merchantInfo =
    tlv("00", "A000000727") +
    tlv("01", beneficiary) +
    tlv("02", "QRIBFTTA");
  const note = sanitizeNote(orderCode);

  let body =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("38", merchantInfo) +
    tlv("53", "704") +
    tlv("54", String(amount)) +
    tlv("58", "VN");
  if (note) body += tlv("62", tlv("08", note));
  body += "6304";

  const crc = crc16CcittFalse(body).toString(16).toUpperCase().padStart(4, "0");
  return body + crc;
}
