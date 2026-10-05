import { useNightSale } from "../hooks/useNightSale";
import { formatVND } from "../utils/format";
import { getSalePrice } from "../utils/pricing";

interface Props {
  price: number;
  className?: string;
}

export default function PriceDisplay({
  price,
  className = "text-lg font-extrabold text-pink-600",
}: Props) {
  const saleActive = useNightSale();
  const currentPrice = getSalePrice(price, saleActive);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={className}>{formatVND(currentPrice)}</span>
      {saleActive && (
        <>
          <span className="text-sm text-ink-soft line-through">
            {formatVND(price)}
          </span>
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-extrabold text-red-700">
            SALE -20%
          </span>
        </>
      )}
    </div>
  );
}
