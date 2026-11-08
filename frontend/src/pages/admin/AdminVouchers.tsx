import { FormEvent, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import ConfirmDialog from "../../components/ConfirmDialog";
import ProductImage from "../../components/ProductImage";
import { ErrorState, Spinner } from "../../components/States";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";
import type { Product, Voucher, VoucherInput } from "../../types";
import { formatVND } from "../../utils/format";

const empty: VoucherInput = {
  code: "",
  name: "",
  description: "",
  discountValue: 0,
  usageLimit: null,
  customerIdentifier: null,
  startsAt: new Date().toISOString().slice(0, 16),
  expiresAt: null,
  isActive: true,
  productIds: [],
};

function generateVoucherCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);
  return `LB${Array.from(values, (value) => alphabet[value % alphabet.length]).join("")}`;
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-sm font-semibold ${className}`}>
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-ink-soft">{hint}</span>}
    </label>
  );
}

export default function AdminVouchers() {
  const vouchers = useAsync(api.admin.vouchers);
  const products = useAsync(api.admin.products);
  const [form, setForm] = useState<VoucherInput>(empty);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [toDelete, setToDelete] = useState<Voucher | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const availableProducts = useMemo(
    () => (products.data ?? []).filter((product) => product.status === "AVAILABLE"),
    [products.data],
  );
  const visibleProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase();
    return query
      ? availableProducts.filter((product) => product.name.toLocaleLowerCase().includes(query))
      : availableProducts;
  }, [availableProducts, productSearch]);
  const selectedProducts = availableProducts.filter((product) => form.productIds.includes(product.id));
  const allProductsSelected =
    availableProducts.length > 0 && selectedProducts.length === availableProducts.length;

  function setField<K extends keyof VoucherInput>(key: K, value: VoucherInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleProduct(productId: number) {
    setForm((current) => ({
      ...current,
      productIds: current.productIds.includes(productId)
        ? current.productIds.filter((id) => id !== productId)
        : [...current.productIds, productId],
    }));
  }

  function toggleAllProducts() {
    setField(
      "productIds",
      allProductsSelected ? [] : availableProducts.map((product) => product.id),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || form.discountValue <= 0 || form.discountValue > 100) {
      toast.error("Vui lòng nhập tên và phần trăm giảm từ 1 đến 100.");
      return;
    }
    if (form.expiresAt && new Date(form.expiresAt) <= new Date(form.startsAt)) {
      toast.error("Thời điểm hết hạn phải sau thời điểm bắt đầu.");
      return;
    }
    setBusy(true);
    try {
      const input = {
        ...form,
        code: editing?.code ?? generateVoucherCode(),
        startsAt: new Date(form.startsAt).toISOString(),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };
      if (editing) {
        await api.admin.updateVoucher(editing.id, input);
      } else {
        await api.admin.createVoucher(input);
      }
      setForm({ ...empty, startsAt: new Date().toISOString().slice(0, 16) });
      setProductSearch("");
      setEditing(null);
      toast.success(editing ? "Đã cập nhật voucher" : "Đã tạo voucher");
      vouchers.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tạo voucher");
    } finally {
      setBusy(false);
    }
  }

  function startEditing(voucher: Voucher) {
      setEditing(voucher);
      setForm({
        code: voucher.code,
        name: voucher.name,
        description: voucher.description,
        discountValue: voucher.discountValue,
        usageLimit: voucher.usageLimit,
        customerIdentifier: voucher.customerIdentifier,
        startsAt: toDateTimeLocal(voucher.startsAt),
        expiresAt: voucher.expiresAt ? toDateTimeLocal(voucher.expiresAt) : null,
        isActive: voucher.isActive,
        productIds: voucher.productIds.filter((id) => availableProducts.some((product) => product.id === id)),
      });
      setProductSearch("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

  async function deleteVoucher() {
      if (!toDelete) return;
      setDeleteBusy(true);
      try {
        await api.admin.deleteVoucher(toDelete.id);
        toast.success("Đã xóa voucher");
        setToDelete(null);
        vouchers.reload();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `${error.message}. Nếu voucher đã được sử dụng, hãy tắt voucher thay vì xóa.`
            : "Không thể xóa voucher",
        );
      } finally {
        setDeleteBusy(false);
      }
    }

  if (vouchers.loading || products.loading) return <Spinner label="Đang tải dữ liệu voucher" />;
  if (vouchers.error) return <ErrorState message={vouchers.error} onRetry={vouchers.reload} />;
  if (products.error) return <ErrorState message={products.error} onRetry={products.reload} />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold">Voucher</h1>
        <p className="mt-1 text-ink-soft">
          Tạo mã giảm giá riêng để gửi trực tiếp cho khách hàng.
        </p>
      </header>

      <form onSubmit={submit} className="card space-y-6 p-5 sm:p-6">
        <section>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{editing ? "Chỉnh sửa voucher" : "Thông tin voucher"}</h2>
              {editing ? (
                <p className="mt-1 text-sm text-ink-soft">
                  Mã <strong className="text-ink">{editing.code}</strong> được giữ nguyên để không ảnh hưởng đến khách hàng đã nhận mã.
                </p>
              ) : (
                <p className="mt-1 text-sm text-ink-soft">Mã voucher sẽ được hệ thống tự sinh sau khi bạn tạo.</p>
              )}
            </div>
            {editing && (
              <button type="button" className="btn-soft whitespace-nowrap" onClick={() => {
                setEditing(null);
                setForm({ ...empty, startsAt: new Date().toISOString().slice(0, 16) });
              }}>
                Hủy sửa
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Tên chương trình" hint="Ví dụ: Ưu đãi khách quen">
              <input
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                placeholder="Nhập tên chương trình"
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
              />
            </Field>
            <Field label="Phần trăm giảm (%)" hint="Nhập từ 1 đến 100. Ví dụ: 10 = giảm 10%.">
              <input
                type="number"
                min="1"
                max="100"
                placeholder="Nhập phần trăm, ví dụ 10"
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                value={form.discountValue || ""}
                onChange={(event) =>
                  setField("discountValue", event.target.value === "" ? 0 : Number(event.target.value))
                }
              />
            </Field>
            <Field label="Giới hạn lượt dùng" hint="Bỏ trống nếu không giới hạn số lần sử dụng.">
              <input
                type="number"
                min="1"
                placeholder="Ví dụ: 50"
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                value={form.usageLimit ?? ""}
                onChange={(event) =>
                  setField("usageLimit", event.target.value ? Number(event.target.value) : null)
                }
              />
            </Field>
            <Field label="Khách hàng nhận voucher" hint="Bỏ trống nếu khách nào cũng có thể dùng mã.">
              <input
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                placeholder="Số điện thoại hoặc email"
                value={form.customerIdentifier ?? ""}
                onChange={(event) => setField("customerIdentifier", event.target.value || null)}
              />
            </Field>
          </div>
        </section>

        <section className="border-t border-line pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Sản phẩm áp dụng</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Bỏ chọn tất cả để voucher áp dụng cho toàn bộ sản phẩm đang bán.
              </p>
            </div>
            <span className="rounded-full bg-pink-100 px-3 py-1 text-sm font-semibold text-pink-700">
              {selectedProducts.length}/{availableProducts.length} đã chọn
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="w-full rounded-xl border border-line px-3 py-2"
              placeholder="Tìm sản phẩm đang bán..."
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
            />
            <button type="button" className="btn-soft whitespace-nowrap" onClick={toggleAllProducts}>
              {allProductsSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
          </div>
          {availableProducts.length === 0 ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
              Chưa có sản phẩm nào đang bán. Voucher sẽ áp dụng cho toàn bộ sản phẩm khi có sản phẩm mới.
            </p>
          ) : visibleProducts.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">Không tìm thấy sản phẩm phù hợp.</p>
          ) : (
            <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
              {visibleProducts.map((product) => (
                <ProductChoice
                  key={product.id}
                  product={product}
                  selected={form.productIds.includes(product.id)}
                  onToggle={() => toggleProduct(product.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-line pt-5">
          <h2 className="text-lg font-bold">Thời gian và mô tả</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Bắt đầu từ">
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                value={form.startsAt}
                onChange={(event) => setField("startsAt", event.target.value)}
              />
            </Field>
            <Field label="Hết hạn lúc" hint="Bỏ trống nếu voucher không có ngày hết hạn.">
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-xl border border-line px-3 py-2"
                value={form.expiresAt ?? ""}
                onChange={(event) => setField("expiresAt", event.target.value || null)}
              />
            </Field>
            <Field
              label="Mô tả"
              hint="Nội dung để admin dễ nhớ mục đích của voucher."
              className="md:col-span-2"
            >
              <textarea
                className="mt-1 min-h-24 w-full rounded-xl border border-line px-3 py-2 md:col-span-2"
                placeholder="Ví dụ: Cảm ơn bạn đã ủng hộ LovelyBar"
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
              />
            </Field>
          </div>
        </section>

        <div className="flex flex-col-reverse justify-end gap-3 border-t border-line pt-5 sm:flex-row">
          <p className="flex-1 self-center text-sm text-ink-soft">
            Mỗi đơn hàng chỉ được sử dụng một voucher.
          </p>
          <button disabled={busy} className="btn-primary min-w-44">
          {busy ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo voucher"}
          </button>
        </div>
      </form>

      <section className="card overflow-x-auto p-5">
        <h2 className="mb-4 text-lg font-bold">Voucher đã tạo</h2>
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="pb-3">Mã</th>
              <th>Giảm</th>
              <th>Đã dùng</th>
              <th>Khách hàng</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(vouchers.data ?? []).map((voucher) => (
              <tr key={voucher.id} className="border-b border-line/60">
                <td className="py-3 font-bold">
                  {voucher.code}
                  <span className="block text-xs font-normal text-ink-soft">{voucher.name}</span>
                </td>
                <td>{voucher.discountValue}%</td>
                <td>{voucher.usedCount}/{voucher.usageLimit ?? "∞"}</td>
                <td>{voucher.customerIdentifier ?? "Tất cả"}</td>
                <td>{voucher.isActive ? "Đang bật" : "Đã tắt"}</td>
                <td>
                  <div className="flex gap-2">
                  <button
                    className="text-pink-600 hover:underline"
                    onClick={async () => {
                      await api.admin.setVoucherActive(voucher.id, !voucher.isActive);
                      vouchers.reload();
                    }}
                  >
                    {voucher.isActive ? "Tắt" : "Bật"}
                  </button>
                  <button className="text-pink-600 hover:underline" onClick={() => startEditing(voucher)}>
                    Sửa
                  </button>
                  <button className="text-red-600 hover:underline" onClick={() => setToDelete(voucher)}>
                    Xóa
                  </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <ConfirmDialog
        open={!!toDelete}
        title="Xóa voucher này?"
        confirmLabel="Xóa voucher"
        danger
        busy={deleteBusy}
        onConfirm={deleteVoucher}
        onCancel={() => setToDelete(null)}
      >
        Voucher <strong>{toDelete?.code}</strong> sẽ bị xóa vĩnh viễn. Voucher đã
        được sử dụng không thể xóa để bảo toàn lịch sử đơn hàng.
      </ConfirmDialog>
    </div>
  );
}

function ProductChoice({
  product,
  selected,
  onToggle,
}: {
  product: Product;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
      selected ? "border-pink-400 bg-pink-50" : "border-line hover:border-pink-300"
    }`}>
      <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 accent-pink-500" />
      <ProductImage src={product.image} name={product.name} className="h-11 w-11 shrink-0 rounded-lg !text-lg" />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{product.name}</span>
        <span className="block text-xs text-ink-soft">{formatVND(product.price)}</span>
      </span>
    </label>
  );
}
