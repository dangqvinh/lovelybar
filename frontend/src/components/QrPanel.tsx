import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { QRResult } from "../types";
import { formatVND } from "../utils/format";

interface Props {
  qr: QRResult;
  /** Show a link to the order page (used on the checkout page). */
  showOrderLink?: boolean;
  donation?: boolean;
}

/** Large, phone-scannable QR with the exact amount from the backend. Never claims the payment is done. */
export default function QrPanel({ qr, showOrderLink, donation = false }: Props) {
  async function saveToPhotos() {
    if (
      typeof navigator.share !== "function" ||
      typeof navigator.canShare !== "function"
    ) {
      toast.info(
        "Trình duyệt chưa hỗ trợ chia sẻ ảnh. Hãy tải ảnh rồi lưu vào thư viện từ ứng dụng Ảnh.",
      );
      return;
    }

    try {
      const base64 = qr.qrCode.split(",")[1];
      if (!base64) throw new Error("Không thể đọc dữ liệu ảnh mã QR.");

      const bytes = Uint8Array.from(atob(base64), (char) =>
        char.charCodeAt(0),
      );
      const file = new File([bytes], `${qr.orderCode}.png`, {
        type: "image/png",
      });

      if (!navigator.canShare({ files: [file] })) {
        toast.info(
          "Trình duyệt chưa hỗ trợ chia sẻ ảnh. Hãy tải ảnh rồi lưu vào thư viện từ ứng dụng Ảnh.",
        );
        return;
      }

      await navigator.share({ files: [file], title: "Mã QR thanh toán" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(
        error instanceof Error ? error.message : "Không thể chia sẻ ảnh mã QR.",
      );
    }
  }

  return (
    <section
      className="rounded-3xl border border-pink-200 bg-pink-50/60 p-5 text-center sm:p-6"
      aria-label={donation ? "Mã QR ủng hộ" : "Mã QR thanh toán"}
    >
      <h3 className="text-lg font-bold">
        {donation ? "Mã QR ủng hộ" : "Mã QR thanh toán"}
      </h3>
      <div className="mx-auto mt-4 w-full max-w-[320px] rounded-3xl bg-white p-3 shadow-soft">
        <img
          src={qr.qrCode}
          alt={
            donation
              ? `Mã QR ủng hộ ${formatVND(qr.amount)}`
              : `Mã QR chuyển ${formatVND(qr.amount)} cho đơn hàng ${qr.orderCode}`
          }
          className="aspect-square w-full"
        />
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        Nhấn giữ ảnh QR để tải ảnh về thiết bị.
      </p>
      {(qr.bankName || qr.accountNumber || qr.accountName) && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-ink-soft">
            Thông tin chủ ngân hàng
          </p>
          {qr.bankName && (
            <p className="mt-1 text-sm font-bold">
              {qr.bankName}
              {qr.accountNumber ? ` · ${qr.accountNumber}` : ""}
            </p>
          )}
          {qr.accountName && (
            <div>
              <p className="mt-1 font-bold uppercase">
                {qr.accountName.toLocaleUpperCase("vi-VN")}
              </p>
            </div>
          )}
        </div>
      )}
      <div className="mt-4">
        <p className="text-sm text-ink-soft">Số tiền</p>
        <p className="text-3xl font-extrabold text-pink-600">
          {formatVND(qr.amount)}
        </p>
      </div>
      <div className="mt-3">
        <p className="text-sm text-ink-soft">Nội dung chuyển khoản</p>
        <p className="font-bold">{qr.orderCode}</p>
      </div>
      <p className="mt-3 text-sm text-ink-soft">
        Quét mã QR bằng ứng dụng ngân hàng để chuyển khoản. Vui lòng giữ nguyên{" "}
        {donation ? "nội dung ủng hộ" : "nội dung chuyển khoản"}.
      </p>
      <p className="mt-2 text-sm font-semibold text-amber-800">
        Mã QR chỉ hỗ trợ chuyển khoản, không xác nhận
        {donation ? " đã nhận tiền ủng hộ." : " thanh toán thành công."}
      </p>
      <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
        <button type="button" onClick={saveToPhotos} className="btn-primary">
          Chia sẻ ảnh QR
        </button>
        {showOrderLink && (
          <Link to={`/order-success/${qr.orderCode}`} className="btn-primary">
            Xem đơn hàng
          </Link>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        Mở bảng chia sẻ; trên iPhone, chọn “Lưu hình ảnh” để lưu vào Ảnh.
      </p>
    </section>
  );
}
