import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import QrPanel from '../components/QrPanel'
import { EmptyState, ErrorState, Spinner } from '../components/States'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { cartTotal, useCart } from '../store/cart'
import type { Order, QRResult } from '../types'
import { formatVND } from '../utils/format'

interface Line {
  key: number
  name: string
  qty: number
  unit: number
  sub: number
}

export default function Checkout() {
  const { items, clear } = useCart()
  const [params, setParams] = useSearchParams()
  const orderParam = params.get('order')

  const [order, setOrder] = useState<Order | null>(null)
  const [qr, setQr] = useState<QRResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [method, setMethod] = useState('')
  const methods = useAsync(api.paymentMethods)

  // Refreshing the page keeps the order because its code is in the URL (the cart itself is memory-only).
  useEffect(() => {
    if (!orderParam || order) return
    api
      .order(orderParam)
      .then(setOrder)
      .catch((e: Error) => setLoadError(e.message))
  }, [orderParam, order])

  useEffect(() => {
    if (!method && methods.data?.length) setMethod(`${methods.data[0].type}:${methods.data[0].code}`)
  }, [methods.data, method])

  const lines: Line[] = order
    ? order.items.map((i) => ({ key: i.id, name: i.productName, qty: i.quantity, unit: i.unitPrice, sub: i.subtotal }))
    : items.map((i) => ({ key: i.productId, name: i.name, qty: i.quantity, unit: i.price, sub: i.price * i.quantity }))
  // After the order exists, the total shown is the one calculated by the backend.
  const total = order ? order.totalAmount : cartTotal(items)

  async function generate() {
    const [type, code] = method.split(':')
    if (!type) return toast.error('Choose a payment method first')
    setBusy(true)
    try {
      let current = order
      if (!current) {
        if (items.length === 0) return toast.error('Your cart is empty')
        current = await api.createOrder(items.map((i) => ({ productId: i.productId, quantity: i.quantity })))
        setOrder(current)
        clear()
        setParams({ order: current.orderCode }, { replace: true })
        toast.success('Order created successfully')
      }
      setQr(await api.generateQR(current.orderCode, type, code))
      toast.success('QR generated successfully')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (loadError) return <ErrorState message={loadError} />
  if (orderParam && !order) return <Spinner label="Loading your order" />
  if (!order && items.length === 0) {
    return (
      <EmptyState
        title="Nothing to check out"
        text="Your cart is empty."
        action={
          <Link to="/products" className="btn-primary">
            Browse products
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-extrabold">Checkout</h1>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Left: order summary */}
        <section className="card p-4 sm:p-6" aria-label="Order summary">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Order summary</h2>
            {order && <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-bold text-pink-700">{order.orderCode}</span>}
          </div>

          <table className="hidden w-full text-sm sm:table">
            <thead>
              <tr className="border-b border-line text-left text-ink-soft">
                <th className="pb-2 font-semibold">Product</th>
                <th className="pb-2 text-right font-semibold">Qty</th>
                <th className="pb-2 text-right font-semibold">Unit Price</th>
                <th className="pb-2 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-b border-line/60">
                  <td className="py-3 pr-2 font-semibold">{l.name}</td>
                  <td className="py-3 text-right">{l.qty}</td>
                  <td className="py-3 text-right">{formatVND(l.unit)}</td>
                  <td className="py-3 text-right font-semibold">{formatVND(l.sub)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="divide-y divide-line/60 sm:hidden">
            {lines.map((l) => (
              <li key={l.key} className="py-3">
                <p className="font-semibold">{l.name}</p>
                <p className="text-sm text-ink-soft">
                  {l.qty} × {formatVND(l.unit)} = <span className="font-semibold text-ink">{formatVND(l.sub)}</span>
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between rounded-2xl bg-pink-50 px-4 py-4">
            <span className="font-bold">TOTAL</span>
            <span className="text-3xl font-extrabold text-pink-600">{formatVND(total)}</span>
          </div>
          {!order && (
            <Link to="/cart" className="mt-3 inline-block text-sm font-semibold text-pink-600 hover:underline">
              ← Edit cart
            </Link>
          )}
        </section>

        {/* Right: payment */}
        <section className="space-y-5" aria-label="Payment">
          <div className="card p-4 sm:p-6">
            <h2 className="text-lg font-bold">Payment method</h2>
            {methods.loading ? (
              <Spinner label="Loading payment methods" />
            ) : methods.error ? (
              <ErrorState message={methods.error} onRetry={methods.reload} />
            ) : (
              <div className="mt-3 space-y-2" role="radiogroup" aria-label="Payment method">
                {(methods.data ?? []).map((m) => {
                  const value = `${m.type}:${m.code}`
                  const active = method === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMethod(value)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${active ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-line hover:border-pink-300'}`}
                    >
                      <span>
                        {m.name}
                        <span className="block text-xs font-normal text-ink-soft">Bank transfer by QR</span>
                      </span>
                      <span className={`h-4 w-4 rounded-full border-2 ${active ? 'border-pink-500 bg-pink-500' : 'border-line'}`} />
                    </button>
                  )
                })}
              </div>
            )}

            <button className="btn-primary mt-5 w-full !py-3" onClick={generate} disabled={busy || methods.loading || !method}>
              {busy ? 'Working…' : qr ? 'Regenerate QR' : 'Generate QR'}
            </button>
            {!order && <p className="mt-2 text-center text-xs text-ink-soft">This creates your order. The total is confirmed by the shop system.</p>}
          </div>

          {qr && <QrPanel qr={qr} showOrderLink />}
        </section>
      </div>
    </div>
  )
}
