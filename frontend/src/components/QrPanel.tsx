import { Link } from 'react-router-dom'
import type { QRResult } from '../types'
import { formatVND } from '../utils/format'

interface Props {
  qr: QRResult
  /** Show a link to the order page (used on the checkout page). */
  showOrderLink?: boolean
}

/** Large, phone-scannable QR with the exact amount from the backend. Never claims the payment is done. */
export default function QrPanel({ qr, showOrderLink }: Props) {
  return (
    <section className="rounded-3xl border border-pink-200 bg-pink-50/60 p-5 text-center sm:p-6" aria-label="Payment QR code">
      <h3 className="text-lg font-bold">Payment QR code</h3>
      <div className="mx-auto mt-4 w-full max-w-[320px] rounded-3xl bg-white p-3 shadow-soft">
        <img src={qr.qrCode} alt={`QR code to transfer ${formatVND(qr.amount)} for order ${qr.orderCode}`} className="aspect-square w-full" />
      </div>
      <p className="mt-4 text-sm text-ink-soft">Amount</p>
      <p className="text-3xl font-extrabold text-pink-600">{formatVND(qr.amount)}</p>
      <p className="mt-2 text-sm">
        Order: <span className="font-bold">{qr.orderCode}</span>
      </p>
      <p className="mt-3 text-sm text-ink-soft">Scan this QR code in your banking app to transfer. Keep the transfer note as it is.</p>
      {(qr.bankName || qr.accountName) && (
        <p className="mt-1 text-sm font-semibold">
          {qr.bankName}
          {qr.accountName ? ` · ${qr.accountName}` : ''}
        </p>
      )}
      <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
        <a href={qr.qrCode} download={`${qr.orderCode}.png`} className="btn-outline">
          Save QR image
        </a>
        {showOrderLink && (
          <Link to={`/order-success/${qr.orderCode}`} className="btn-primary">
            View my order
          </Link>
        )}
      </div>
    </section>
  )
}
