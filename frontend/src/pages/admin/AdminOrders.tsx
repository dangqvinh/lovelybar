import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '../../components/ConfirmDialog'
import { EmptyState, ErrorState, Spinner } from '../../components/States'
import StatusBadge from '../../components/StatusBadge'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import type { Order, OrderStatus } from '../../types'
import { formatDate, formatVND } from '../../utils/format'

const FILTERS: { label: string; value: '' | OrderStatus }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

export default function AdminOrders() {
  const [filter, setFilter] = useState<'' | OrderStatus>('')
  const { data, loading, error, reload } = useAsync(() => api.admin.orders(filter), [filter])
  const [selected, setSelected] = useState<Order | null>(null)
  const [pending, setPending] = useState<OrderStatus | null>(null)
  const [busy, setBusy] = useState(false)

  async function applyStatus() {
    if (!selected || !pending) return
    setBusy(true)
    try {
      const updated = await api.admin.setOrderStatus(selected.id, pending)
      toast.success(`Order marked ${updated.orderStatus.toLowerCase()}`)
      setSelected(updated)
      setPending(null)
      reload()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-3xl font-extrabold">Orders</h1>
      <p className="mb-5 text-sm text-ink-soft">Check payments in your banking app using the order code in the transfer note. Orders have no customer information by design.</p>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${filter === f.value ? 'bg-pink-500 text-white' : 'bg-white text-ink-soft border border-line hover:border-pink-300'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading orders" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No orders" text={filter ? 'No orders with this status.' : 'Orders will appear here once someone checks out.'} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-soft">
                <th className="p-4 font-semibold">Order code</th>
                <th className="p-4 font-semibold">Products</th>
                <th className="p-4 text-right font-semibold">Total</th>
                <th className="p-4 font-semibold">Payment</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id} className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-pink-50/50" onClick={() => setSelected(o)}>
                  <td className="p-4">
                    <button className="font-bold text-pink-700 hover:underline" onClick={() => setSelected(o)}>
                      {o.orderCode}
                    </button>
                  </td>
                  <td className="max-w-[260px] truncate p-4 text-ink-soft">{o.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}</td>
                  <td className="p-4 text-right font-semibold">{formatVND(o.totalAmount)}</td>
                  <td className="p-4">{o.paymentMethod}</td>
                  <td className="p-4">
                    <StatusBadge status={o.orderStatus} />
                  </td>
                  <td className="p-4 text-ink-soft">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4" onClick={() => setSelected(null)}>
          <div role="dialog" aria-modal="true" aria-label={`Order ${selected.orderCode}`} className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold">{selected.orderCode}</h2>
                <p className="text-sm text-ink-soft">{formatDate(selected.createdAt)}</p>
              </div>
              <button className="text-2xl leading-none text-ink-soft hover:text-ink" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>

            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-soft">
                  <th className="pb-2 font-semibold">Product</th>
                  <th className="pb-2 text-right font-semibold">Qty</th>
                  <th className="pb-2 text-right font-semibold">Unit</th>
                  <th className="pb-2 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {selected.items.map((i) => (
                  <tr key={i.id} className="border-b border-line/60">
                    <td className="py-2 pr-2 font-semibold">{i.productName}</td>
                    <td className="py-2 text-right">{i.quantity}</td>
                    <td className="py-2 text-right">{formatVND(i.unitPrice)}</td>
                    <td className="py-2 text-right">{formatVND(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex items-center justify-between rounded-2xl bg-pink-50 px-4 py-3">
              <span className="font-bold">Total amount</span>
              <span className="text-xl font-extrabold text-pink-600">{formatVND(selected.totalAmount)}</span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-ink-soft">Payment method</dt>
              <dd className="text-right font-semibold">{selected.paymentMethod}</dd>
              <dt className="text-ink-soft">Order status</dt>
              <dd className="text-right"><StatusBadge status={selected.orderStatus} /></dd>
              <dt className="text-ink-soft">Customer information</dt>
              <dd className="text-right text-ink-soft">None</dd>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              {(['PENDING', 'COMPLETED', 'CANCELLED'] as OrderStatus[])
                .filter((s) => s !== selected.orderStatus)
                .map((s) => (
                  <button key={s} className={s === 'CANCELLED' ? 'btn-danger' : s === 'COMPLETED' ? 'btn-primary' : 'btn-outline'} onClick={() => setPending(s)}>
                    Mark {s.toLowerCase()}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        title={`Mark order as ${pending?.toLowerCase()}?`}
        confirmLabel="Confirm"
        danger={pending === 'CANCELLED'}
        busy={busy}
        onConfirm={applyStatus}
        onCancel={() => setPending(null)}
      >
        {selected?.orderCode} · {selected && formatVND(selected.totalAmount)}
      </ConfirmDialog>
    </div>
  )
}
