import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import Logo from "../components/Logo";
import { cartCount, useCart } from "../store/cart";

function CartIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 6h15l-1.5 9h-12z" />
      <path d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1.2" />
      <circle cx="18" cy="20" r="1.2" />
    </svg>
  );
}

export default function ShopLayout() {
  const count = useCart((s) => cartCount(s.items));
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? "bg-pink-100 text-pink-700" : "text-ink-soft hover:text-pink-700"}`;
  const showFloating =
    count > 0 && pathname !== "/cart" && pathname !== "/checkout";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-blush/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-1" aria-label="Main">
            <NavLink to="/" end className={navCls}>
              Home
            </NavLink>
            <NavLink to="/products" className={navCls}>
              Products
            </NavLink>
            <Link
              to="/cart"
              className="btn-soft relative ml-1 !px-4"
              aria-label={`Cart, ${count} items`}
            >
              <CartIcon />
              <span className="hidden sm:inline">Cart</span>
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-pink-500 px-1 text-xs font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line py-6 text-center text-sm text-ink-soft">
        LovelyBar · the company shop
      </footer>

      {showFloating && (
        <Link
          to="/cart"
          className="btn-primary fixed bottom-5 right-5 z-30 !px-5 !py-3 shadow-lift sm:hidden"
          aria-label={`Open cart, ${count} items`}
        >
          <CartIcon />
          {count} in cart
        </Link>
      )}
    </div>
  );
}
