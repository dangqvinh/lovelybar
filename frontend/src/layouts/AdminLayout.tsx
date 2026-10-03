import { Link, NavLink, Outlet } from 'react-router-dom'
import Logo from '../components/Logo'

export default function AdminLayout() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-pink-500 text-white' : 'text-ink-soft hover:bg-pink-100 hover:text-pink-700'}`
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo to="/admin" />
            <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">Admin</span>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Admin">
            <NavLink to="/admin" end className={cls}>
              Dashboard
            </NavLink>
            <NavLink to="/admin/products" className={cls}>
              Products
            </NavLink>
            <NavLink to="/admin/orders" className={cls}>
              Orders
            </NavLink>
            <Link to="/" className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-ink-soft hover:text-pink-700">
              View shop
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-ink-soft">This admin area has no login. Do not expose it to the public internet.</footer>
    </div>
  )
}
