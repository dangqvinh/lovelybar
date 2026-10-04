import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) navigate('/admin', { replace: true });
      setChecked(true);
    });

    return () => {
      active = false;
    };
  }, [navigate]);

  if (!checked) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !password) {
      toast.error('Vui lòng nhập email và mật khẩu.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('Đăng nhập thành công');
      navigate('/admin', { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Đăng nhập thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-pink-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-soft">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-pink-600">
          LovelyBar Admin
        </p>
        <h1 className="text-3xl font-extrabold">Đăng nhập</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Chỉ quản trị viên được phép thao tác sản phẩm và đơn hàng.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-ink">
            Email
            <input
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:border-pink-500"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="block text-sm font-semibold text-ink">
            Mật khẩu
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:border-pink-500"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-70">
            {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}
