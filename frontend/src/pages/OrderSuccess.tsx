import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QrPanel from '../components/QrPanel'
import { ErrorState, Spinner } from '../components/States'
import StatusBadge from '../components/StatusBadge'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import type { QRResult } from '../types'
import { formatDate, formatVND } from '../utils/format'

export default function OrderSuccess() {
  const { code = '' } = useParams()
  const { data: order, loading, error, reload } = useAsync(() => api.order(code), [code])
  const [qr, setQr] = useState<QRResult | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)

  // QR generation is repeatable: it always uses the amount stored on the order.
  useEffect(() => {
    if (!order || order.orderStatus === 'CANCELLED') return
    api
      .generateQR(order.orderCode, order.paymentMethod || 'BANK')
      .then(setQr)
      .catch((e: Error) => setQrError(e.message))
  }, [order])

  if (loading) return <Spinner label="Loading your order" />
  if (error || !order) return <ErrorState message={error ?? 'Order not found'} onRetry={reload} />

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-pink-100 text-2xl text-pink-600">✓</div>
        <h1 className="text-3xl font-extrabold">Order created successfully!</h1>
        <p className="mt-2 text-ink-soft">
          Order <span className="font-bold text-ink">{order.orderCode}</span> · {formatDate(order.createdAt)}
        </p>
      </div>

      <section className="card p-5 sm:p-6" aria-label="Order details">
        <ul className="divide-y divide-line/60">
          {order.items.map((i) => (
            <li key={i.id} className="py-3">
              <p className="font-semibold">{i.productName}</p>
              <p className="text-sm text-ink-soft">
                {i.quantity} × {formatVND(i.unitPrice)} = {formatVND(i.subtotal)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-pink-50 px-4 py-4">
          <span className="font-bold">TOTAL</span>
          <span className="text-2xl font-extrabold text-pink-600">{formatVND(order.totalAmount)}</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-ink-soft">Payment</dt>
          <dd className="text-right font-semibold">{qr?.bankName ?? 'Bank transfer (QR)'}</dd>
          <dt className="text-ink-soft">Order status</dt>
          <dd className="text-right">
            <StatusBadge status={order.orderStatus} />
          </dd>
        </dl>
      </section>

      {order.orderStatus === 'CANCELLED' ? (
        <p className="rounded-2xl bg-gray-100 px-4 py-3 text-center text-sm">This order was cancelled. Please do not transfer money for it.</p>
      ) : qr ? (
        <QrPanel qr={qr} />
      ) : qrError ? (
        <ErrorState message={qrError} />
      ) : (
        <Spinner label="Preparing your QR code" />
      )}

      <p className="text-center text-xs text-ink-soft">The QR code only helps you transfer. The shop checks the payment by hand using your order code.</p>
      <div className="text-center">
        <Link to="/products" className="btn-soft">
          Back to products
        </Link>
      </div>
    </div>
  )
}
