import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, Spinner } from '../../components/States'
import StatusBadge from '../../components/StatusBadge'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import { formatDate, formatVND } from '../../utils/format'

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { data, loading, error, reload } = useAsync(api.admin.dashboard)
  if (loading) return <Spinner label="Loading dashboard" />
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Total products" value={data.totalProducts} />
        <Stat label="Total orders" value={data.totalOrders} />
        <Stat label="Pending orders" value={data.pendingOrders} />
        <div className="col-span-2 lg:col-span-2">
          <Stat label="Expected revenue" value={formatVND(data.expectedRevenue)} hint="Orders not cancelled. Not confirmed payments." />
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Recent orders</h2>
          <Link to="/admin/orders" className="text-sm font-semibold text-pink-600 hover:underline">
            All orders
          </Link>
        </div>
        {data.recentOrders.length === 0 ? (
          <EmptyState title="No orders yet" text="Orders will appear here once someone checks out." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-soft">
                  <th className="p-4 font-semibold">Order code</th>
                  <th className="p-4 text-right font-semibold">Total</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-line/60 last:border-0">
                    <td className="p-4 font-bold">{o.orderCode}</td>
                    <td className="p-4 text-right font-semibold">{formatVND(o.totalAmount)}</td>
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
      </section>
    </div>
  )
}
