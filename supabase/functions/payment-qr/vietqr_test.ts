import {
  buildVietQrPayload,
  crc16CcittFalse,
  resolveBankBin,
  sanitizeNote,
  validateQrRequest,
} from "./vietqr.ts";

function parseTlv(payload: string): Map<string, string> {
  const fields = new Map<string, string>();
  let remaining = payload;
  while (remaining.length > 0) {
    if (remaining.length < 4) throw new Error(`Truncated TLV: ${remaining}`);
    const length = Number(remaining.slice(2, 4));
    const end = 4 + length;
    if (!Number.isInteger(length) || remaining.length < end) {
      throw new Error(`Invalid TLV length: ${remaining}`);
    }
    fields.set(remaining.slice(0, 2), remaining.slice(4, end));
    remaining = remaining.slice(end);
  }
  return fields;
}

Deno.test("CRC16/CCITT-FALSE standard check value", () => {
  if (crc16CcittFalse("123456789") !== 0x29b1) {
    throw new Error("CRC16 check value must equal 0x29B1");
  }
});

Deno.test("80,000 VietQR payload contains the expected amount, note, BIN, and account", () => {
  const payload = buildVietQrPayload(
    resolveBankBin("VCB"),
    "123456789",
    80_000,
    "LB20261003001",
  );
  const fields = parseTlv(payload);
  const merchant = parseTlv(fields.get("38") ?? "");
  const beneficiary = parseTlv(merchant.get("01") ?? "");
  const additional = parseTlv(fields.get("62") ?? "");

  if (fields.get("00") !== "01" || fields.get("01") !== "12") {
    throw new Error("Expected dynamic EMVCo QR fields");
  }
  if (merchant.get("00") !== "A000000727" || merchant.get("02") !== "QRIBFTTA") {
    throw new Error("Unexpected merchant account template");
  }
  if (beneficiary.get("00") !== "970436" || beneficiary.get("01") !== "123456789") {
    throw new Error("Unexpected bank BIN or account number");
  }
  if (fields.get("53") !== "704" || fields.get("54") !== "80000" || fields.get("58") !== "VN") {
    throw new Error("Unexpected currency, amount, or country");
  }
  if (additional.get("08") !== "LB20261003001") {
    throw new Error("Unexpected transfer note");
  }

  const crcField = payload.slice(-8);
  if (crcField.slice(0, 4) !== "6304") {
    throw new Error("CRC field tag and length are missing");
  }
  const expectedCrc = crc16CcittFalse(payload.slice(0, -4))
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");
  if (crcField.slice(4) !== expectedCrc) {
    throw new Error("CRC does not match payload");
  }
});

Deno.test("VietQR rejects non-positive amounts", () => {
  for (const amount of [0, -1]) {
    let rejected = false;
    try {
      buildVietQrPayload("970436", "123456789", amount, "LB20261003001");
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`Expected amount ${amount} to be rejected`);
  }
});

Deno.test("QR request rejects a caller-supplied amount", () => {
  let rejected = false;
  try {
    validateQrRequest({
      orderCode: "LB20261003001",
      paymentMethod: "BANK",
      amount: 1,
    });
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Expected the supplied amount to be rejected");
});

Deno.test("transfer note is ASCII and at most 25 characters", () => {
  const note = sanitizeNote("Đơn hàng LB20261003001 and more");
  if (note.length > 25 || /[^\x20-\x7E]/.test(note)) {
    throw new Error(`Invalid sanitized note: ${note}`);
  }
});
