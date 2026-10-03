import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import ProductImage from '../components/ProductImage'
import QuantityStepper from '../components/QuantityStepper'
import { EmptyState } from '../components/States'
import { cartTotal, subtotal, useCart } from '../store/cart'
import { formatVND } from '../utils/format'

export default function Cart() {
  const { items, setQuantity, remove, clear } = useCart()
  const navigate = useNavigate()
  const total = cartTotal(items)

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        text="Add something you like and it will show up here."
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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">Your cart</h1>
        <button
          className="text-sm font-semibold text-ink-soft hover:text-red-600"
          onClick={() => {
            clear()
            toast.success('Cart cleared')
          }}
        >
          Clear cart
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.productId} className="card flex gap-4 p-3 sm:p-4">
              <ProductImage src={i.image} name={i.name} className="h-20 w-20 shrink-0 rounded-2xl sm:h-24 sm:w-24" />
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{i.name}</p>
                    <p className="text-sm text-ink-soft">{formatVND(i.price)} each</p>
                  </div>
                  <button className="text-sm font-semibold text-ink-soft hover:text-red-600" onClick={() => remove(i.productId)} aria-label={`Remove ${i.name}`}>
                    Remove
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <QuantityStepper size="sm" value={i.quantity} onChange={(q) => setQuantity(i.productId, q)} />
                  <p className="font-extrabold text-pink-600">{formatVND(subtotal(i))}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="card h-fit p-5 lg:sticky lg:top-24">
          <p className="text-sm text-ink-soft">Total</p>
          <p className="text-3xl font-extrabold text-pink-600">{formatVND(total)}</p>
          <button className="btn-primary mt-5 w-full !py-3" onClick={() => navigate('/checkout')}>
            Proceed to Checkout
          </button>
          <Link to="/products" className="mt-3 block text-center text-sm font-semibold text-pink-600 hover:underline">
            Keep shopping
          </Link>
        </aside>
      </div>
    </div>
  )
}
