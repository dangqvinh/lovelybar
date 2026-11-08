import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { ErrorState, Spinner } from "../../components/States";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";
import type { VoucherInput } from "../../types";
import { formatVND } from "../../utils/format";

const empty: VoucherInput = {
  code: "", name: "", description: "", discountType: "PERCENTAGE",
  discountValue: 10, maxDiscountAmount: null, minimumOrderAmount: 0,
  usageLimit: null, customerIdentifier: null, startsAt: new Date().toISOString().slice(0, 16),
  expiresAt: null, isActive: true, campaign: null, allowStacking: false,
  productIds: [],
};

export default function AdminVouchers() {
  const vouchers = useAsync(api.admin.vouchers);
  const [form, setForm] = useState<VoucherInput>(empty);
  const [busy, setBusy] = useState(false);
  const [productIdsText, setProductIdsText] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim() || form.discountValue <= 0) {
      toast.error("Vui lòng nhập mã, tên và giá trị giảm hợp lệ.");
      return;
    }
    setBusy(true);
    try {
      await api.admin.createVoucher({
        ...form,
        startsAt: new Date(form.startsAt).toISOString(),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        maxDiscountAmount: form.discountType === "PERCENTAGE" ? form.maxDiscountAmount : null,
        productIds: productIdsText.split(",").map((value) => Number(value.trim())).filter((value) => Number.isSafeInteger(value) && value > 0),
      });
      setForm(empty);
      setProductIdsText("");
      toast.success("Đã tạo voucher");
      vouchers.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tạo voucher");
    } finally {
      setBusy(false);
    }
  }

  if (vouchers.loading) return <Spinner label="Đang tải voucher" />;
  if (vouchers.error) return <ErrorState message={vouchers.error} onRetry={vouchers.reload} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">Voucher</h1>
        <p className="mt-1 text-ink-soft">Tạo mã riêng để gửi trực tiếp cho khách hàng và quản lý chiến dịch giảm giá.</p>
      </div>
      <form onSubmit={submit} className="card grid gap-3 p-5 md:grid-cols-2">
        <input className="rounded-xl border border-line px-3 py-2 uppercase" placeholder="Mã voucher" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        <input className="rounded-xl border border-line px-3 py-2" placeholder="Tên chương trình" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="rounded-xl border border-line px-3 py-2" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as VoucherInput["discountType"] })}>
          <option value="PERCENTAGE">Giảm theo phần trăm</option>
          <option value="FIXED_AMOUNT">Giảm số tiền cố định</option>
        </select>
        <input type="number" min="1" className="rounded-xl border border-line px-3 py-2" placeholder="Giá trị giảm" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} />
        <input type="number" min="0" className="rounded-xl border border-line px-3 py-2" placeholder="Đơn tối thiểu (đ)" value={form.minimumOrderAmount} onChange={(e) => setForm({ ...form, minimumOrderAmount: Number(e.target.value) })} />
        <input type="number" min="1" className="rounded-xl border border-line px-3 py-2" placeholder="Giới hạn lượt dùng (bỏ trống = không giới hạn)" value={form.usageLimit ?? ""} onChange={(e) => setForm({ ...form, usageLimit: e.target.value ? Number(e.target.value) : null })} />
        <input type="number" min="1" className="rounded-xl border border-line px-3 py-2" placeholder="Giảm tối đa (nếu %)" value={form.maxDiscountAmount ?? ""} onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value ? Number(e.target.value) : null })} />
        <input className="rounded-xl border border-line px-3 py-2" placeholder="Số điện thoại/email khách (tuỳ chọn)" value={form.customerIdentifier ?? ""} onChange={(e) => setForm({ ...form, customerIdentifier: e.target.value || null })} />
        <input className="rounded-xl border border-line px-3 py-2" placeholder="Tên chiến dịch (tuỳ chọn)" value={form.campaign ?? ""} onChange={(e) => setForm({ ...form, campaign: e.target.value || null })} />
        <input className="rounded-xl border border-line px-3 py-2" placeholder="ID sản phẩm áp dụng (cách nhau bằng dấu phẩy, bỏ trống = tất cả)" value={productIdsText} onChange={(e) => setProductIdsText(e.target.value)} />
        <input type="datetime-local" className="rounded-xl border border-line px-3 py-2" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
        <input type="datetime-local" className="rounded-xl border border-line px-3 py-2" value={form.expiresAt ?? ""} onChange={(e) => setForm({ ...form, expiresAt: e.target.value || null })} />
        <textarea className="rounded-xl border border-line px-3 py-2 md:col-span-2" placeholder="Mô tả" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allowStacking} onChange={(e) => setForm({ ...form, allowStacking: e.target.checked })} /> Cho phép cộng dồn (hiện mỗi đơn chỉ nhận một voucher)</label>
        <button disabled={busy} className="btn-primary md:col-start-2">{busy ? "Đang tạo..." : "Tạo voucher"}</button>
      </form>
      <div className="card overflow-x-auto p-5">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-line text-left"><th className="pb-3">Mã</th><th>Giảm</th><th>Đã dùng</th><th>Khách hàng</th><th>Chiến dịch</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>{(vouchers.data ?? []).map((voucher) => (
            <tr key={voucher.id} className="border-b border-line/60">
              <td className="py-3 font-bold">{voucher.code}<span className="block text-xs font-normal text-ink-soft">{voucher.name}</span></td>
              <td>{voucher.discountType === "PERCENTAGE" ? `${voucher.discountValue}%` : formatVND(voucher.discountValue)}</td>
              <td>{voucher.usedCount}/{voucher.usageLimit ?? "∞"}</td>
              <td>{voucher.customerIdentifier ?? "Tất cả"}</td>
              <td>{voucher.campaign ?? "—"}</td>
              <td>{voucher.isActive ? "Đang bật" : "Đã tắt"}</td>
              <td><button className="text-pink-600 hover:underline" onClick={async () => { await api.admin.setVoucherActive(voucher.id, !voucher.isActive); vouchers.reload(); }}> {voucher.isActive ? "Tắt" : "Bật"}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
