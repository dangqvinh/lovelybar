const API = import.meta.env.VITE_API_URL ?? ''

export const MAX_QTY = 9999

export function formatVND(n: number): string {
  return new Intl.NumberFormat('en-US').format(n) + 'đ'
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Uploaded images are stored as relative paths like /uploads/abc.jpg. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return /^https?:\/\//.test(path) ? path : API + path
}

export function clampQty(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(MAX_QTY, Math.max(1, Math.floor(n)))
}
