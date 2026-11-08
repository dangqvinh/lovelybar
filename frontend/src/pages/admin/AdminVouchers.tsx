import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { ErrorState, Spinner } from "../../components/States";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";
import type { VoucherInput } from "../../types";

const empty: VoucherInput = {
  code: "", name: "", description: "", discountValue: 10, minimumOrderAmount: 0,
  usageLimit: null, customerIdentifier: null, startsAt: new Date().toISOString().slice(0, 16),
  expiresAt: null, isActive: true,
  productIds: [],
};

function generateVoucherCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);
  return `LB${Array.from(values, (value) => alphabet[value % alphabet.length]).join("")}`;
}

export default function AdminVouchers() {
  const vouchers = useAsync(api.admin.vouchers);
  const [form, setForm] = useState<VoucherInput>(empty);
  const [busy, setBusy] = useState(false);
  const [productIdsText, setProductIdsText] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || form.discountValue <= 0 || form.discountValue > 100) {
      toast.error("Vui lòng nhập tên và phần trăm giảm từ 1 đến 100.");
      return;
    }
    setBusy(true);
    try {
      await api.admin.createVoucher({
        ...form,
        code: generateVoucherCode(),
        startsAt: new Date(form.startsAt).toISOString(),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
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
        <p className="mt-1 text-ink-soft">Hệ thống tự sinh mã riêng để bạn gửi trực tiếp cho khách hàng.</p>
      </div>
      <form onSubmit={submit} className="card grid gap-3 p-5 md:grid-cols-2">
        <input className="rounded-xl border border-line px-3 py-2" placeholder="Tên chương trình" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <label className="text-sm font-semibold">
          Phần trăm giảm (%)
          <input type="number" min="1" max="100" className="mt-1 w-full rounded-xl border border-line px-3 py-2" value={form.discountValue || ""} onChange={(e) => setForm({ ...form, discountValue: e.target.value === "" ? 0 : Number(e.target.value) })} />
          <span className="mt-1 block text-xs font-normal text-ink-soft">Ví dụ: nhập 10 để giảm 10%.</span>
        </label>
        <label className="text-sm font-semibold">
          Giá trị đơn hàng tối thiểu (đ)
          <input type="number" min="0" className="mt-1 w-full rounded-xl border border-line px-3 py-2" value={form.minimumOrderAmount} onChange={(e) => setForm({ ...form, minimumOrderAmount: Number(e.target.value) })} />
          <span className="mt-1 block text-xs font-normal text-ink-soft">Nhập 0 nếu voucher áp dụng cho mọi đơn hàng.</span>
        </label>
        <input type="number" min="1" className="rounded-xl border border-line px-3 py-2" placeholder="Giới hạn lượt dùng (bỏ trống = không giới hạn)" value={form.usageLimit ?? ""} onChange={(e) => setForm({ ...form, usageLimit: e.target.value ? Number(e.target.value) : null })} />
        <input className="rounded-xl border border-line px-3 py-2" placeholder="Số điện thoại/email khách (tuỳ chọn)" value={form.customerIdentifier ?? ""} onChange={(e) => setForm({ ...form, customerIdentifier: e.target.value || null })} />
        <input className="rounded-xl border border-line px-3 py-2" placeholder="ID sản phẩm áp dụng (cách nhau bằng dấu phẩy, bỏ trống = tất cả)" value={productIdsText} onChange={(e) => setProductIdsText(e.target.value)} />
        <input type="datetime-local" className="rounded-xl border border-line px-3 py-2" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
        <input type="datetime-local" className="rounded-xl border border-line px-3 py-2" value={form.expiresAt ?? ""} onChange={(e) => setForm({ ...form, expiresAt: e.target.value || null })} />
        <textarea className="rounded-xl border border-line px-3 py-2 md:col-span-2" placeholder="Mô tả" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <p className="text-sm text-ink-soft md:col-span-2">Mỗi đơn hàng chỉ được sử dụng một voucher.</p>
        <button disabled={busy} className="btn-primary md:col-start-2">{busy ? "Đang tạo..." : "Tạo voucher"}</button>
      </form>
      <div className="card overflow-x-auto p-5">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-line text-left"><th className="pb-3">Mã</th><th>Giảm</th><th>Đã dùng</th><th>Khách hàng</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>{(vouchers.data ?? []).map((voucher) => (
            <tr key={voucher.id} className="border-b border-line/60">
              <td className="py-3 font-bold">{voucher.code}<span className="block text-xs font-normal text-ink-soft">{voucher.name}</span></td>
              <td>{voucher.discountValue}%</td>
              <td>{voucher.usedCount}/{voucher.usageLimit ?? "∞"}</td>
              <td>{voucher.customerIdentifier ?? "Tất cả"}</td>
              <td>{voucher.isActive ? "Đang bật" : "Đã tắt"}</td>
              <td><button className="text-pink-600 hover:underline" onClick={async () => { await api.admin.setVoucherActive(voucher.id, !voucher.isActive); vouchers.reload(); }}> {voucher.isActive ? "Tắt" : "Bật"}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
