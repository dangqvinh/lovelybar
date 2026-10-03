import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import QrPanel from "../components/QrPanel";
import { ErrorState, Spinner } from "../components/States";
import StatusBadge from "../components/StatusBadge";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import type { QRResult } from "../types";
import { formatDate, formatVND } from "../utils/format";

export default function OrderSuccess() {
  const { code = "" } = useParams();
  const {
    data: order,
    loading,
    error,
    reload,
  } = useAsync(() => api.order(code), [code]);
  const [qr, setQr] = useState<QRResult | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  // QR generation is repeatable: it always uses the amount stored on the order.
  useEffect(() => {
    if (!order || order.orderStatus === "CANCELLED") return;
    api
      .generateQR(order.orderCode, order.paymentMethod || "BANK")
      .then(setQr)
      .catch((e: Error) => setQrError(e.message));
  }, [order]);

  if (loading) return <Spinner label="Đang tải đơn hàng" />;
  if (error || !order)
    return (
      <ErrorState
        message={error ?? "Không tìm thấy đơn hàng"}
        onRetry={reload}
      />
    );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-pink-100 text-2xl text-pink-600">
          ✓
        </div>
        <h1 className="text-3xl font-extrabold">Tạo đơn hàng thành công!</h1>
        <p className="mt-2 text-ink-soft">
          Đơn hàng <span className="font-bold text-ink">{order.orderCode}</span>{" "}
          · {formatDate(order.createdAt)}
        </p>
      </div>

      <section className="card p-5 sm:p-6" aria-label="Chi tiết đơn hàng">
        <ul className="divide-y divide-line/60">
          {order.items.map((i) => (
            <li key={i.id} className="py-3">
              <p className="font-semibold">{i.productName}</p>
              <p className="text-sm text-ink-soft">
                {i.quantity} × {formatVND(i.unitPrice)} ={" "}
                {formatVND(i.subtotal)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-pink-50 px-4 py-4">
          <span className="font-bold">TỔNG CỘNG</span>
          <span className="text-2xl font-extrabold text-pink-600">
            {formatVND(order.totalAmount)}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-ink-soft">Thanh toán</dt>
          <dd className="text-right font-semibold">
            {qr?.bankName ?? "Chuyển khoản (QR)"}
          </dd>
          <dt className="text-ink-soft">Trạng thái đơn hàng</dt>
          <dd className="text-right">
            <StatusBadge status={order.orderStatus} />
          </dd>
        </dl>
      </section>

      {order.orderStatus === "CANCELLED" ? (
        <p className="rounded-2xl bg-gray-100 px-4 py-3 text-center text-sm">
          Đơn hàng này đã bị hủy. Vui lòng không chuyển khoản cho đơn hàng này.
        </p>
      ) : qr ? (
        <QrPanel qr={qr} />
      ) : qrError ? (
        <ErrorState message={qrError} />
      ) : (
        <Spinner label="Đang chuẩn bị mã QR" />
      )}

      <p className="text-center text-xs text-ink-soft">
        Mã QR chỉ hỗ trợ chuyển khoản. Cửa hàng sẽ kiểm tra thanh toán thủ công
        bằng mã đơn hàng của bạn.
      </p>
      <div className="text-center">
        <Link to="/products" className="btn-soft">
          Quay lại sản phẩm
        </Link>
      </div>
    </div>
  );
}
