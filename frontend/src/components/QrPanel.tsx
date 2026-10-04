import { Link } from "react-router-dom";
import type { QRResult } from "../types";
import { formatVND } from "../utils/format";

interface Props {
  qr: QRResult;
  /** Show a link to the order page (used on the checkout page). */
  showOrderLink?: boolean;
}

/** Large, phone-scannable QR with the exact amount from the backend. Never claims the payment is done. */
export default function QrPanel({ qr, showOrderLink }: Props) {
  return (
    <section
      className="rounded-3xl border border-pink-200 bg-pink-50/60 p-5 text-center sm:p-6"
      aria-label="Mã QR thanh toán"
    >
      <h3 className="text-lg font-bold">Mã QR thanh toán</h3>
      <div className="mx-auto mt-4 w-full max-w-[320px] rounded-3xl bg-white p-3 shadow-soft">
        <img
          src={qr.qrCode}
          alt={`Mã QR chuyển ${formatVND(qr.amount)} cho đơn hàng ${qr.orderCode}`}
          className="aspect-square w-full"
        />
      </div>
      <p className="mt-4 text-sm text-ink-soft">Số tiền</p>
      <p className="text-3xl font-extrabold text-pink-600">
        {formatVND(qr.amount)}
      </p>
      <p className="mt-2 text-sm">
        Đơn hàng: <span className="font-bold">{qr.orderCode}</span>
      </p>
      <p className="mt-3 text-sm text-ink-soft">
        Quét mã QR bằng ứng dụng ngân hàng để chuyển khoản. Vui lòng giữ nguyên
        nội dung chuyển khoản.
      </p>
      <p className="mt-2 text-sm font-semibold text-amber-800">
        Mã QR chỉ hỗ trợ chuyển khoản, không xác nhận thanh toán thành công.
      </p>
      {(qr.bankName || qr.accountName) && (
        <p className="mt-1 text-sm font-semibold">
          {qr.bankName}
          {qr.accountName ? ` · ${qr.accountName}` : ""}
        </p>
      )}
      <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
        <a
          href={qr.qrCode}
          download={`${qr.orderCode}.png`}
          className="btn-outline"
        >
          Tải ảnh mã QR
        </a>
        {showOrderLink && (
          <Link to={`/order-success/${qr.orderCode}`} className="btn-primary">
            Xem đơn hàng
          </Link>
        )}
      </div>
    </section>
  );
}
