import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import type { Product } from '../types'
import { useCart } from '../store/cart'
import { formatVND } from '../utils/format'
import ProductImage from './ProductImage'

export default function ProductCard({ product }: { product: Product }) {
  const add = useCart((s) => s.add)
  return (
    <article className="card group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-lift">
      <Link to={`/products/${product.id}`} className="block overflow-hidden" aria-label={`View ${product.name}`}>
        <ProductImage src={product.image} name={product.name} className="aspect-square w-full transition duration-300 group-hover:scale-105" />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold leading-snug">{product.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-ink-soft">{product.description}</p>
        <p className="mt-3 text-lg font-extrabold text-pink-600">{formatVND(product.price)}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            className="btn-primary flex-1 !px-3"
            onClick={() => {
              add(product)
              toast.success(`${product.name} added to cart`)
            }}
          >
            Add to Cart
          </button>
          <Link to={`/products/${product.id}`} className="btn-outline !px-3">
            View Detail
          </Link>
        </div>
      </div>
    </article>
  )
}
