import { useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "../../components/ConfirmDialog";
import { EmptyState, ErrorState, Spinner } from "../../components/States";
import StatusBadge from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";
import type { Order, OrderStatus } from "../../types";
import { formatDate, formatVND } from "../../utils/format";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Chờ xử lý",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

const FILTERS: { label: string; value: "" | OrderStatus }[] = [
  { label: "Tất cả", value: "" },
  { label: "Chờ xử lý", value: "PENDING" },
  { label: "Hoàn tất", value: "COMPLETED" },
  { label: "Đã hủy", value: "CANCELLED" },
];

export default function AdminOrders() {
  const [filter, setFilter] = useState<"" | OrderStatus>("");
  const { data, loading, error, reload } = useAsync(
    () => api.admin.orders(filter),
    [filter],
  );
  const [selected, setSelected] = useState<Order | null>(null);
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [busy, setBusy] = useState(false);

  async function applyStatus() {
    if (!selected || !pending) return;
    setBusy(true);
    try {
      const updated = await api.admin.setOrderStatus(selected.id, pending);
      toast.success(
        `Đã cập nhật trạng thái đơn hàng: ${STATUS_LABELS[updated.orderStatus]}`,
      );
      setSelected(updated);
      setPending(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-3xl font-extrabold">Đơn hàng</h1>
      <p className="mb-5 text-sm text-ink-soft">
        Kiểm tra thanh toán trong ứng dụng ngân hàng bằng mã đơn hàng ở nội dung
        chuyển khoản. Hệ thống không lưu thông tin khách hàng.
      </p>

      <div
        className="mb-4 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Lọc theo trạng thái"
      >
        {FILTERS.map((f) => (
          <button
            key={f.label}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${filter === f.value ? "bg-pink-500 text-white" : "bg-white text-ink-soft border border-line hover:border-pink-300"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Đang tải đơn hàng" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Chưa có đơn hàng"
          text={
            filter
              ? "Không có đơn hàng ở trạng thái này."
              : "Đơn hàng sẽ xuất hiện tại đây sau khi có người thanh toán."
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-soft">
                <th className="p-4 font-semibold">Mã đơn hàng</th>
                <th className="p-4 font-semibold">Sản phẩm</th>
                <th className="p-4 text-right font-semibold">Tổng tiền</th>
                <th className="p-4 font-semibold">Thanh toán</th>
                <th className="p-4 font-semibold">Trạng thái</th>
                <th className="p-4 font-semibold">Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr
                  key={o.id}
                  className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-pink-50/50"
                  onClick={() => setSelected(o)}
                >
                  <td className="p-4">
                    <button
                      className="font-bold text-pink-700 hover:underline"
                      onClick={() => setSelected(o)}
                    >
                      {o.orderCode}
                    </button>
                  </td>
                  <td className="max-w-[260px] truncate p-4 text-ink-soft">
                    {o.items
                      .map((i) => `${i.quantity}× ${i.productName}`)
                      .join(", ")}
                  </td>
                  <td className="p-4 text-right font-semibold">
                    {formatVND(o.totalAmount)}
                  </td>
                  <td className="p-4">{o.paymentMethod}</td>
                  <td className="p-4">
                    <StatusBadge status={o.orderStatus} />
                  </td>
                  <td className="p-4 text-ink-soft">
                    {formatDate(o.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Đơn hàng ${selected.orderCode}`}
            className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold">{selected.orderCode}</h2>
                <p className="text-sm text-ink-soft">
                  {formatDate(selected.createdAt)}
                </p>
              </div>
              <button
                className="text-2xl leading-none text-ink-soft hover:text-ink"
                onClick={() => setSelected(null)}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>

            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-soft">
                  <th className="pb-2 font-semibold">Sản phẩm</th>
                  <th className="pb-2 text-right font-semibold">SL</th>
                  <th className="pb-2 text-right font-semibold">Đơn giá</th>
                  <th className="pb-2 text-right font-semibold">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((i) => (
                  <tr key={i.id} className="border-b border-line/60">
                    <td className="py-2 pr-2 font-semibold">{i.productName}</td>
                    <td className="py-2 text-right">{i.quantity}</td>
                    <td className="py-2 text-right">
                      {formatVND(i.unitPrice)}
                    </td>
                    <td className="py-2 text-right">{formatVND(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex items-center justify-between rounded-2xl bg-pink-50 px-4 py-3">
              <span className="font-bold">Tổng tiền</span>
              <span className="text-xl font-extrabold text-pink-600">
                {formatVND(selected.totalAmount)}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-ink-soft">Phương thức thanh toán</dt>
              <dd className="text-right font-semibold">
                {selected.paymentMethod}
              </dd>
              <dt className="text-ink-soft">Trạng thái đơn hàng</dt>
              <dd className="text-right">
                <StatusBadge status={selected.orderStatus} />
              </dd>
              <dt className="text-ink-soft">Thông tin khách hàng</dt>
              <dd className="text-right text-ink-soft">Không có</dd>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              {(["PENDING", "COMPLETED", "CANCELLED"] as OrderStatus[])
                .filter((s) => s !== selected.orderStatus)
                .map((s) => (
                  <button
                    key={s}
                    className={
                      s === "CANCELLED"
                        ? "btn-danger"
                        : s === "COMPLETED"
                          ? "btn-primary"
                          : "btn-outline"
                    }
                    onClick={() => setPending(s)}
                  >
                    Chuyển sang {STATUS_LABELS[s].toLowerCase()}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        title={`Chuyển đơn hàng sang trạng thái ${pending ? STATUS_LABELS[pending].toLowerCase() : ""}?`}
        confirmLabel="Xác nhận"
        danger={pending === "CANCELLED"}
        busy={busy}
        onConfirm={applyStatus}
        onCancel={() => setPending(null)}
      >
        {selected?.orderCode} · {selected && formatVND(selected.totalAmount)}
      </ConfirmDialog>
    </div>
  );
}
