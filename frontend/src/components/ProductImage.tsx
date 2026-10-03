import { assetUrl } from '../utils/format'

interface Props {
  src: string | null
  name: string
  className?: string
}

/** Shows the product photo, or a soft pink tile with the initial when there is none. */
export default function ProductImage({ src, name, className = '' }: Props) {
  const url = assetUrl(src)
  if (url) return <img src={url} alt={name} loading="lazy" className={`object-cover ${className}`} />
  return (
    <div className={`grid place-items-center bg-pink-100 text-5xl font-extrabold text-pink-300 ${className}`} role="img" aria-label={name}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}
