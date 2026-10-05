export const NIGHT_SALE_LABEL = "Ưu đãi giờ vàng 18:40–07:00";

export function isNightSaleActive(date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const minutes = hour * 60 + minute;

  return minutes >= 18 * 60 + 40 || minutes < 7 * 60;
}

export function getSalePrice(price: number, saleActive: boolean): number {
  return saleActive ? Math.floor((price * 80) / 100) : price;
}
