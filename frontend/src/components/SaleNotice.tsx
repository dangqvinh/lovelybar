import { NIGHT_SALE_LABEL } from "../utils/pricing";

export default function SaleNotice() {
  return (
    <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
      {NIGHT_SALE_LABEL}: giảm 20%, giá còn 80% giá gốc (giờ Việt Nam).
    </p>
  );
}
