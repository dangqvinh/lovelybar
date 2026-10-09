import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Logo from "../components/Logo";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
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

function NavIcon({ name }: { name: "home" | "products" | "posts" | "donate" }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v12h14V9M9 21v-7h6v7" /></>,
    products: <><path d="m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3Z" /><path d="m3.5 7.7 8.5 4.5 8.5-4.5M12 12.2V21" /></>,
    posts: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    donate: <><path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.8 2.4Z" /><path d="M12 8v6m-3-3h6" /></>,
  };

  return (
    <svg
      className="shop-nav-icon"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}

export default function ShopLayout() {
  const count = useCart((s) => cartCount(s.items));
  const donation = useAsync(api.donationSettings);
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const navCls = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? "bg-pink-100 text-pink-700" : "text-ink-soft hover:text-pink-700"}`;
  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col">
      <header className="shop-header sticky top-0 z-30 border-b border-line bg-blush/90 backdrop-blur">
        <div className="shop-header-inner mx-auto flex w-full min-w-0 max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav
            className="shop-nav flex min-w-0 items-center gap-1"
            aria-label="Điều hướng chính"
          >
            <NavLink to="/" end className={navCls}>
              <NavIcon name="home" />
              Trang chủ
            </NavLink>
            <NavLink to="/products" className={navCls}>
              <NavIcon name="products" />
              Sản phẩm
            </NavLink>
            <NavLink to="/posts" className={navCls}>
              <NavIcon name="posts" />
              Bài đăng
            </NavLink>
            {donation.data?.isEnabled && (
              <NavLink to="/donate" className={navCls}>
                <NavIcon name="donate" />
                Ủng hộ
              </NavLink>
            )}
            <NavLink
              to="/cart"
              className={({ isActive }) =>
                `${navCls({ isActive })} shop-nav-cart relative ml-1 !px-4`
              }
              aria-label={`Giỏ hàng, ${count} sản phẩm`}
            >
              <CartIcon />
              <span className="shop-nav-cart-label">Giỏ hàng</span>
              {count > 0 && (
                <span className="shop-nav-count absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-pink-500 px-1 text-xs font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </NavLink>
          </nav>
        </div>
      </header>

      {donation.error && (
        <p role="alert" className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
          Không thể tải trạng thái mục ủng hộ: {donation.error}
        </p>
      )}

      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-8 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line py-6 text-center text-sm text-ink-soft">
        LovelyBar · cửa hàng nội bộ
      </footer>

    </div>
  );
}
