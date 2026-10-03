import { create } from 'zustand'
import type { CartItem, Product } from '../types'
import { clampQty } from '../utils/format'

// In-memory only, on purpose: no persist middleware, no localStorage/sessionStorage.
interface CartState {
  items: CartItem[]
  add: (p: Product, quantity?: number) => void
  setQuantity: (productId: number, quantity: number) => void
  increase: (productId: number) => void
  decrease: (productId: number) => void
  remove: (productId: number) => void
  clear: () => void
}

export const useCart = create<CartState>((set) => ({
  items: [],
  add: (p, quantity = 1) =>
    set((s) => {
      const existing = s.items.find((i) => i.productId === p.id)
      if (existing) {
        return { items: s.items.map((i) => (i.productId === p.id ? { ...i, quantity: clampQty(i.quantity + quantity) } : i)) }
      }
      return { items: [...s.items, { productId: p.id, name: p.name, price: p.price, image: p.image, quantity: clampQty(quantity) }] }
    }),
  setQuantity: (id, q) => set((s) => ({ items: s.items.map((i) => (i.productId === id ? { ...i, quantity: clampQty(q) } : i)) })),
  increase: (id) => set((s) => ({ items: s.items.map((i) => (i.productId === id ? { ...i, quantity: clampQty(i.quantity + 1) } : i)) })),
  decrease: (id) => set((s) => ({ items: s.items.map((i) => (i.productId === id ? { ...i, quantity: clampQty(i.quantity - 1) } : i)) })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.productId !== id) })),
  clear: () => set({ items: [] }),
}))

export const subtotal = (i: CartItem) => i.price * i.quantity
export const cartTotal = (items: CartItem[]) => items.reduce((sum, i) => sum + subtotal(i), 0)
export const cartCount = (items: CartItem[]) => items.reduce((sum, i) => sum + i.quantity, 0)
