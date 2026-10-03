import type { Order, OrderStatus, PaymentMethod, Product, ProductInput, QRResult, Stats } from '../types'

const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, init)
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.')
  }
  let body: { success?: boolean; message?: string; data?: T } | null = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON response */
  }
  if (!res.ok || !body?.success) throw new ApiError(body?.message ?? 'Something went wrong. Please try again.')
  return body.data as T
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: data === undefined ? undefined : JSON.stringify(data),
})

export const api = {
  // public
  products: () => request<Product[]>('/api/products'),
  product: (id: number | string) => request<Product>(`/api/products/${id}`),
  paymentMethods: () => request<{ methods: PaymentMethod[] }>('/api/payment/methods').then((r) => r.methods),
  // Only ids and quantities are sent. The backend prices the order.
  createOrder: (items: { productId: number; quantity: number }[]) => request<Order>('/api/orders', json('POST', { items })),
  order: (code: string) => request<Order>(`/api/orders/${encodeURIComponent(code)}`),
  generateQR: (orderCode: string, paymentMethod: string, bankCode?: string) =>
    request<QRResult>('/api/payment/qr', json('POST', { orderCode, paymentMethod, bankCode })),

  // admin
  admin: {
    dashboard: () => request<Stats>('/api/admin/dashboard'),
    products: () => request<Product[]>('/api/admin/products'),
    product: (id: number | string) => request<Product>(`/api/admin/products/${id}`),
    createProduct: (p: ProductInput) => request<Product>('/api/admin/products', json('POST', p)),
    updateProduct: (id: number, p: ProductInput) => request<Product>(`/api/admin/products/${id}`, json('PUT', p)),
    deleteProduct: (id: number) => request<{ deleted: boolean }>(`/api/admin/products/${id}`, json('DELETE')),
    uploadImage: (id: number, file: File) => {
      const form = new FormData()
      form.append('image', file)
      return request<Product>(`/api/admin/products/${id}/image`, { method: 'POST', body: form })
    },
    deleteImage: (id: number) => request<Product>(`/api/admin/products/${id}/image`, json('DELETE')),
    orders: (status = '') => request<Order[]>(`/api/admin/orders${status ? `?status=${status}` : ''}`),
    order: (id: number) => request<Order>(`/api/admin/orders/${id}`),
    setOrderStatus: (id: number, status: OrderStatus) => request<Order>(`/api/admin/orders/${id}/status`, json('PUT', { status })),
  },
}
