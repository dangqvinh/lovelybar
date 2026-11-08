import { useNightSale } from "../hooks/useNightSale";
import { formatVND } from "../utils/format";
import { getProductPrice } from "../utils/pricing";

interface Props {
  price: number;
  discountPercent?: number;
  className?: string;
  singleLine?: boolean;
}

export default function PriceDisplay({
  price,
  discountPercent = 0,
  className = "text-lg font-extrabold text-pink-600",
  singleLine = false,
}: Props) {
  const saleActive = useNightSale();
  const currentPrice = getProductPrice(price, discountPercent, saleActive);
  const hasProductDiscount = !saleActive && discountPercent > 0;

  return (
    <div
      className={`flex min-w-0 items-center ${singleLine ? "flex-wrap gap-x-1.5 gap-y-1" : "flex-wrap gap-x-2 gap-y-1"}`}
    >
      <span className={`${className} ${singleLine ? "whitespace-nowrap" : ""}`}>
        {formatVND(currentPrice)}
      </span>
      {(saleActive || hasProductDiscount) && (
        <>
          <span
            className={`${singleLine ? "text-xs" : "text-sm"} text-ink-soft line-through ${singleLine ? "whitespace-nowrap" : ""}`}
          >
            {formatVND(price)}
          </span>
          <span
            title={saleActive ? "Giờ vàng giảm 20%" : `Giảm ${discountPercent}%`}
            aria-label={saleActive ? "Giờ vàng giảm 20%" : `Giảm ${discountPercent}%`}
            className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-extrabold text-red-700"
          >
            -{saleActive ? 20 : discountPercent}%
          </span>
        </>
      )}
    </div>
  );
}
