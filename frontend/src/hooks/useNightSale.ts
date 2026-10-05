import { useEffect, useState } from "react";
import { isNightSaleActive } from "../utils/pricing";

export function useNightSale(): boolean {
  const [saleActive, setSaleActive] = useState(isNightSaleActive);

  useEffect(() => {
    const updateSaleState = () => setSaleActive(isNightSaleActive());
    const interval = window.setInterval(updateSaleState, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  return saleActive;
}
