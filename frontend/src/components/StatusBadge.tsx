import type { OrderStatus, ProductStatus } from "../types";

const styles: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-gray-100 text-gray-600",
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  HIDDEN: "bg-gray-100 text-gray-600",
};

export default function StatusBadge({
  status,
}: {
  status: OrderStatus | ProductStatus;
}) {
  const labels: Record<OrderStatus | ProductStatus, string> = {
    PENDING: "Chờ xử lý",
    COMPLETED: "Hoàn tất",
    CANCELLED: "Đã hủy",
    AVAILABLE: "Đang bán",
    HIDDEN: "Đang ẩn",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
