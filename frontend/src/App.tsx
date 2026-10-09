import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Spinner } from './components/States';
import { supabase } from './lib/supabase';
import ShopLayout from './layouts/ShopLayout';
import AdminLayout from './layouts/AdminLayout';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Donation from './pages/Donation';
import OrderSuccess from './pages/OrderSuccess';
import Dashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/AdminProducts';
import ProductForm from './pages/admin/ProductForm';
import AdminOrders from './pages/admin/AdminOrders';
import AdminLogin from './pages/admin/Login';
import Reports from './pages/admin/Reports';
import Posts from './pages/Posts';
import PostDetail from './pages/PostDetail';
import AdminPosts from './pages/admin/AdminPosts';
import PostForm from './pages/admin/PostForm';
import AdminPostDetail from './pages/admin/AdminPostDetail';
import AdminDonation from './pages/admin/AdminDonation';

function AdminRouteGuard() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthed(Boolean(data.session));
      setReady(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthed(Boolean(session));
      setReady(true);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (!ready) return <Spinner label="Đang kiểm tra quyền truy cập" />;
  return authed ? <Outlet /> : <Navigate to="/admin/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<ShopLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/posts" element={<Posts />} />
        <Route path="/posts/:id" element={<PostDetail />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/donate" element={<Donation />} />
        <Route path="/order-success/:code" element={<OrderSuccess />} />
      </Route>

      <Route path="/admin/login" element={<AdminLogin />} />

      <Route path="/admin" element={<AdminRouteGuard />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/create" element={<ProductForm />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="reports" element={<Reports />} />
          <Route path="donation" element={<AdminDonation />} />
          <Route path="posts" element={<AdminPosts />} />
          <Route path="posts/create" element={<PostForm />} />
          <Route path="posts/:id" element={<AdminPostDetail />} />
          <Route path="posts/:id/edit" element={<PostForm />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
