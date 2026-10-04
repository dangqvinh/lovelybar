import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import QrPanel from "../components/QrPanel";
import { EmptyState, ErrorState, Spinner } from "../components/States";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import type { Order, QRResult } from "../types";
import { formatVND } from "../utils/format";

interface Line {
  key: number;
  name: string;
  qty: number;
  unit: number;
  sub: number;
}

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderParam = params.get("order");

  const [order, setOrder] = useState<Order | null>(null);
  const [qr, setQr] = useState<QRResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [method, setMethod] = useState("");
  const qrRequest = useRef<string | null>(null);
  const methods = useAsync(api.paymentMethods);

  // Refreshing the page keeps the order because its code is in the URL (the cart itself is memory-only).
  useEffect(() => {
    if (!orderParam || order) return;
    api
      .order(orderParam)
      .then(setOrder)
      .catch((e: Error) => setLoadError(e.message));
  }, [orderParam, order]);

  useEffect(() => {
    if (!method && methods.data?.length)
      setMethod(`${methods.data[0].type}:${methods.data[0].code}`);
  }, [methods.data, method]);

  useEffect(() => {
    if (!order || !method || qr || qrError) return;
    const [type] = method.split(":");
    if (!type) return;

    const requestKey = `${order.orderCode}:${method}`;
    if (qrRequest.current === requestKey) return;
    qrRequest.current = requestKey;
    setBusy(true);
    api
      .generateQR(order.orderCode, type)
      .then(setQr)
      .catch((error: Error) => {
        qrRequest.current = null;
        setQrError(error.message);
      })
      .finally(() => setBusy(false));
  }, [order, method, qr, qrError]);

  const lines: Line[] =
    order?.items.map((i) => ({
      key: i.id,
      name: i.productName,
      qty: i.quantity,
      unit: i.unitPrice,
      sub: i.subtotal,
    })) ?? [];
  const total = order?.totalAmount ?? 0;

  if (loadError) return <ErrorState message={loadError} />;
  if (orderParam && !order) return <Spinner label="Đang tải đơn hàng" />;
  if (!orderParam) {
    return (
      <EmptyState
        title="Chưa có đơn hàng thanh toán"
        text="Vui lòng quay lại giỏ hàng và chọn tiến hành thanh toán."
        action={
          <Link to="/cart" className="btn-primary">
            Quay lại giỏ hàng
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-extrabold">Thanh toán</h1>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: order summary */}
        <section className="card p-4 sm:p-6" aria-label="Thông tin đơn hàng">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Thông tin đơn hàng</h2>
            {order && (
              <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-bold text-pink-700">
                {order.orderCode}
              </span>
            )}
          </div>

          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-line text-left text-ink-soft">
                <th className="pb-2 font-semibold">Sản phẩm</th>
                <th className="pb-2 text-right font-semibold">SL</th>
                <th className="pb-2 text-right font-semibold">Đơn giá</th>
                <th className="pb-2 text-right font-semibold">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-b border-line/60">
                  <td className="py-3 pr-2 font-semibold">{l.name}</td>
                  <td className="py-3 text-right">{l.qty}</td>
                  <td className="py-3 text-right">{formatVND(l.unit)}</td>
                  <td className="py-3 text-right font-semibold">
                    {formatVND(l.sub)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="divide-y divide-line/60 sm:hidden">
            {lines.map((l) => (
              <li key={l.key} className="py-3">
                <p className="font-semibold">{l.name}</p>
                <p className="text-sm text-ink-soft">
                  {l.qty} × {formatVND(l.unit)} ={" "}
                  <span className="font-semibold text-ink">
                    {formatVND(l.sub)}
                  </span>
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-pink-50 px-4 py-4">
            <span className="font-bold">TỔNG CỘNG</span>
            <span className="text-3xl font-extrabold text-pink-600">
              {formatVND(total)}
            </span>
          </div>
          {!order && (
            <Link
              to="/cart"
              className="mt-3 inline-block text-sm font-semibold text-pink-600 hover:underline"
            >
              ← Sửa giỏ hàng
            </Link>
          )}
        </section>

        {/* Right: payment */}
        <section className="space-y-5" aria-label="Thanh toán">
          <div className="card p-4 sm:p-6">
            <h2 className="text-lg font-bold">Phương thức thanh toán</h2>
            {methods.loading ? (
              <Spinner label="Đang tải phương thức thanh toán" />
            ) : methods.error ? (
              <ErrorState message={methods.error} onRetry={methods.reload} />
            ) : (
              <div
                className="mt-3 space-y-2"
                role="radiogroup"
                aria-label="Phương thức thanh toán"
              >
                {(methods.data ?? []).map((m) => {
                  const value = `${m.type}:${m.code}`;
                  const active = method === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setMethod(value);
                        setQr(null);
                        setQrError(null);
                        qrRequest.current = null;
                      }}
                      disabled={busy || !!qr}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${active ? "border-pink-500 bg-pink-50 text-pink-700" : "border-line hover:border-pink-300"}`}
                    >
                      <span>
                        {m.name}
                        <span className="block text-xs font-normal text-ink-soft">
                          Chuyển khoản bằng mã QR
                        </span>
                      </span>
                      <span
                        className={`h-4 w-4 rounded-full border-2 ${active ? "border-pink-500 bg-pink-500" : "border-line"}`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {busy && <Spinner label="Đang tạo mã QR" />}
          {qrError && (
            <div className="text-center" role="alert">
              <p className="text-sm text-red-600">{qrError}</p>
              <button
                className="btn-outline mt-3"
                onClick={() => setQrError(null)}
              >
                Thử tạo lại mã QR
              </button>
            </div>
          )}
          {qr && (
            <>
              <QrPanel qr={qr} />
              <div className="text-center">
                <p className="mb-3 text-sm text-ink-soft">
                  Tạo đơn và mã QR không xác nhận đã nhận tiền. Cửa hàng sẽ
                  kiểm tra giao dịch thủ công.
                </p>
                <button
                  className="btn-primary w-full !py-3 sm:w-auto"
                  onClick={() => navigate(`/order-success/${order?.orderCode}`)}
                >
                  Xem trạng thái đơn hàng
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
