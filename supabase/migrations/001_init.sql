-- Initial schema scaffold for the Supabase-only LovelyBar app.
-- The project keeps the same public tables as the Go version while enforcing RLS.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  price BIGINT NOT NULL CHECK (price >= 0 AND price <= 1000000000),
  image TEXT,
  status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'HIDDEN')) DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id BIGSERIAL PRIMARY KEY,
  order_code TEXT NOT NULL UNIQUE,
  total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'BANK' CHECK (payment_method IN ('BANK')),
  order_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (order_status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price BIGINT NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  subtotal BIGINT NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS public.order_counters (
  day DATE PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 1 CHECK (n > 0)
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', FALSE);
$$;

CREATE POLICY "Public read available products" ON public.products
  FOR SELECT USING (status = 'AVAILABLE' OR public.is_admin());

CREATE POLICY "Admin manages products" ON public.products
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin reads orders" ON public.orders
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admin reads order items" ON public.order_items
  FOR SELECT USING (public.is_admin());

CREATE POLICY "No order inserts" ON public.orders
  FOR INSERT WITH CHECK (FALSE);
CREATE POLICY "No order updates" ON public.orders
  FOR UPDATE USING (FALSE);
CREATE POLICY "No order deletes" ON public.orders
  FOR DELETE USING (FALSE);

CREATE POLICY "No order item inserts" ON public.order_items
  FOR INSERT WITH CHECK (FALSE);
CREATE POLICY "No order item updates" ON public.order_items
  FOR UPDATE USING (FALSE);
CREATE POLICY "No order item deletes" ON public.order_items
  FOR DELETE USING (FALSE);

CREATE POLICY "No public access to counters" ON public.order_counters
  FOR ALL USING (FALSE);

CREATE OR REPLACE FUNCTION public.create_order(items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Supabase SQL function scaffold is not deployed yet. Use the app with a configured Supabase instance.';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_order(code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Supabase SQL function scaffold is not deployed yet. Use the app with a configured Supabase instance.';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Supabase SQL function scaffold is not deployed yet. Use the app with a configured Supabase instance.';
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_order(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_order(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated, anon;
