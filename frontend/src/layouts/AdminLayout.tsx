import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Logo from "../components/Logo";
import { supabase } from "../lib/supabase";

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
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo to="/admin" />
            <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">
              Quản trị
            </span>
          </div>
          <nav
            className="flex items-center gap-1 overflow-x-auto"
            aria-label="Quản trị"
          >
            <NavLink to="/admin" end className={cls}>
              Tổng quan
            </NavLink>
            <NavLink to="/admin/products" className={cls}>
              Sản phẩm
            </NavLink>
            <NavLink to="/admin/posts" className={cls}>
              Bài đăng
            </NavLink>
            <NavLink to="/admin/orders" className={cls}>
              Đơn hàng
            </NavLink>
            <NavLink to="/admin/reports" className={cls}>
              Báo cáo
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              className="whitespace-nowrap rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-pink-300 hover:text-pink-700"
            >
              Đăng xuất
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-ink-soft">
        Chỉ quản trị viên mới có quyền truy cập khu vực này.
      </footer>
    </div>
  );
}
