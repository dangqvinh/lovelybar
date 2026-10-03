import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import ConfirmDialog from "../../components/ConfirmDialog";
import ProductImage from "../../components/ProductImage";
import { EmptyState, ErrorState, Spinner } from "../../components/States";
import StatusBadge from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";
import type { Product } from "../../types";
import { formatVND } from "../../utils/format";

export default function AdminProducts() {
  const { data, loading, error, reload } = useAsync(api.admin.products);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

  async function toggle(p: Product) {
    setToggling(p.id);
    try {
      const next = p.status === "AVAILABLE" ? "HIDDEN" : "AVAILABLE";
      await api.admin.updateProduct(p.id, {
        name: p.name,
        description: p.description,
        price: p.price,
        status: next,
      });
      toast.success(
        next === "HIDDEN" ? "Đã ẩn sản phẩm" : "Sản phẩm hiện đã được hiển thị",
      );
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setToggling(null);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.admin.deleteProduct(toDelete.id);
      toast.success("Xóa sản phẩm thành công");
      setToDelete(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Sản phẩm</h1>
        <Link to="/admin/products/create" className="btn-primary">
          Thêm sản phẩm
        </Link>
      </div>

      {loading ? (
        <Spinner label="Đang tải sản phẩm" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Chưa có sản phẩm"
          text="Tạo sản phẩm đầu tiên để đăng bán tại cửa hàng."
          action={
            <Link to="/admin/products/create" className="btn-primary">
              Thêm sản phẩm
            </Link>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-soft">
                <th className="p-4 font-semibold">Sản phẩm</th>
                <th className="p-4 text-right font-semibold">Giá</th>
                <th className="p-4 font-semibold">Trạng thái</th>
                <th className="p-4 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-line/60 last:border-0"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <ProductImage
                        src={p.image}
                        name={p.name}
                        className="h-12 w-12 shrink-0 rounded-xl !text-xl"
                      />
                      <span className="font-semibold">{p.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right font-semibold">
                    {formatVND(p.price)}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        className="btn-outline !px-3 !py-1.5"
                        onClick={() => toggle(p)}
                        disabled={toggling === p.id}
                      >
                        {p.status === "AVAILABLE" ? "Ẩn" : "Hiển thị"}
                      </button>
                      <Link
                        to={`/admin/products/${p.id}/edit`}
                        className="btn-soft !px-3 !py-1.5"
                      >
                        Sửa
                      </Link>
                      <button
                        className="btn-danger !px-3 !py-1.5"
                        onClick={() => setToDelete(p)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Xóa sản phẩm này?"
        confirmLabel="Xóa"
        danger
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      >
        “{toDelete?.name}” sẽ bị gỡ khỏi cửa hàng. Các đơn hàng cũ vẫn giữ tên
        và giá đã lưu.
      </ConfirmDialog>
    </div>
  );
}
