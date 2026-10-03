import { Link } from 'react-router-dom'

export default function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-full" aria-label="LovelyBar home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-pink-500 text-lg font-extrabold text-white shadow-soft">L</span>
      <span className="text-xl font-extrabold tracking-tight text-ink">
        Lovely<span className="text-pink-500">Bar</span>
      </span>
    </Link>
  )
}
