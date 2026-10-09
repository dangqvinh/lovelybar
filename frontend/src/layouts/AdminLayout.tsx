import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Logo from "../components/Logo";
import { supabase } from "../lib/supabase";

function AdminNavIcon({
  name,
}: {
  name: "dashboard" | "products" | "posts" | "orders" | "reports" | "donation";
}) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></>,
    products: <><path d="m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3Z" /><path d="m3.5 7.7 8.5 4.5 8.5-4.5M12 12.2V21" /></>,
    posts: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    orders: <><path d="M5 4h14v17H5z" /><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5" /></>,
    reports: <><path d="M4 20V10m8 10V4m8 16v-7" /><path d="M2 20h20" /></>,
    donation: <><path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.8 2.4Z" /><path d="M12 8v6m-3-3h6" /></>,
  };

  return (
    <svg
      className="admin-nav-icon"
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

export default function AdminLayout() {
  const navigate = useNavigate();
  const cls = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? "bg-pink-500 text-white" : "text-ink-soft hover:bg-pink-100 hover:text-pink-700"}`;

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Đã đăng xuất");
      navigate('/admin/login', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đăng xuất');
    }
  }

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col">
      <header className="admin-header border-b border-line bg-white">
        <div className="admin-header-inner mx-auto flex w-full min-w-0 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo to="/admin" />
            <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">
              Quản trị
            </span>
          </div>
          <nav
            className="admin-nav flex items-center gap-1 overflow-x-auto"
            aria-label="Quản trị"
          >
            <NavLink to="/admin" end className={cls}>
              <AdminNavIcon name="dashboard" />
              Tổng quan
            </NavLink>
            <NavLink to="/admin/products" className={cls}>
              <AdminNavIcon name="products" />
              Sản phẩm
            </NavLink>
            <NavLink to="/admin/posts" className={cls}>
              <AdminNavIcon name="posts" />
              Bài đăng
            </NavLink>
            <NavLink to="/admin/orders" className={cls}>
              <AdminNavIcon name="orders" />
              Đơn hàng
            </NavLink>
            <NavLink to="/admin/reports" className={cls}>
              <AdminNavIcon name="reports" />
              Báo cáo
            </NavLink>
            <NavLink to="/admin/donation" className={cls}>
              <AdminNavIcon name="donation" />
              Ủng hộ
            </NavLink>
          </nav>
          <button
            type="button"
            onClick={handleLogout}
            className="admin-logout whitespace-nowrap rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-pink-300 hover:text-pink-700"
          >
            Đăng xuất
          </button>
        </div>
      </header>
      <main className="admin-main mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-ink-soft">
        Chỉ quản trị viên mới có quyền truy cập khu vực này.
      </footer>
    </div>
  );
}
