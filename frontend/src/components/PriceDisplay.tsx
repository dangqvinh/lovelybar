import { useNightSale } from "../hooks/useNightSale";
import { formatVND } from "../utils/format";
import { getSalePrice } from "../utils/pricing";

interface Props {
  price: number;
  className?: string;
  singleLine?: boolean;
}

export default function PriceDisplay({
  price,
  className = "text-lg font-extrabold text-pink-600",
  singleLine = false,
}: Props) {
  const saleActive = useNightSale();
  const currentPrice = getSalePrice(price, saleActive);

  return (
    <div
      className={`flex items-center ${singleLine ? "flex-nowrap gap-x-1.5 whitespace-nowrap" : "flex-wrap gap-x-2 gap-y-1"}`}
    >
      <span className={`${className} ${singleLine ? "whitespace-nowrap" : ""}`}>
        {formatVND(currentPrice)}
      </span>
      {saleActive && (
        <>
          <span
            className={`${singleLine ? "text-xs" : "text-sm"} text-ink-soft line-through ${singleLine ? "whitespace-nowrap" : ""}`}
          >
            {formatVND(price)}
          </span>
          <span
            title="Sale giảm 20%"
            aria-label="Sale giảm 20%"
            className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-extrabold text-red-700"
          >
            -20%
          </span>
        </>
      )}
    </div>
  );
}
