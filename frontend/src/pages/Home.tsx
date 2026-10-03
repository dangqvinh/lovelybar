import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import ProductImage from '../components/ProductImage'
import { EmptyState, ErrorState, ProductGridSkeleton } from '../components/States'
import { useAsync } from '../hooks/useAsync'
import { api } from '../services/api'
import { cartCount, useCart } from '../store/cart'
import { formatVND } from '../utils/format'

export default function Home() {
  const { data, loading, error, reload } = useAsync(api.products)
  const count = useCart((s) => cartCount(s.items))
  const featured = (data ?? []).slice(0, 4)

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-4xl bg-pink-500 px-6 py-12 text-white sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-pink-400/60" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-pink-600/40" aria-hidden />
        <div className="relative grid items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Little treats, picked for the team.</h1>
            <p className="mt-4 max-w-md text-pink-50">LovelyBar is our company shop. Choose what you like, scan one QR code and you are done.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/products" className="btn bg-white text-pink-700 shadow-soft hover:bg-pink-50">
                View products
              </Link>
              <Link to="/cart" className="btn border border-white/60 text-white hover:bg-white/10">
                {count > 0 ? `Open cart (${count})` : 'Open cart'}
              </Link>
            </div>
          </div>
          <div className="hidden justify-end gap-4 md:flex" aria-hidden>
            {featured.slice(0, 3).map((p, i) => (
              <div key={p.id} className={`w-36 overflow-hidden rounded-3xl bg-white p-2 text-ink shadow-lift ${i === 1 ? 'mt-10' : i === 2 ? '-mt-2' : ''}`}>
                <ProductImage src={p.image} name={p.name} className="aspect-square w-full rounded-2xl" />
                <p className="mt-2 truncate px-1 text-sm font-bold">{p.name}</p>
                <p className="px-1 pb-1 text-sm font-semibold text-pink-600">{formatVND(p.price)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold">Featured products</h2>
          <Link to="/products" className="text-sm font-semibold text-pink-600 hover:underline">
            See all
          </Link>
        </div>
        {loading ? (
          <ProductGridSkeleton count={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : featured.length === 0 ? (
          <EmptyState title="No products yet" text="Check back soon. New items are on the way." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
