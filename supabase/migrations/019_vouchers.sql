CREATE TABLE public.vouchers (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code = upper(code) AND char_length(code) BETWEEN 3 AND 40),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '',
  discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
  discount_value BIGINT NOT NULL CHECK (discount_value > 0),
  max_discount_amount BIGINT CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
  minimum_order_amount BIGINT NOT NULL DEFAULT 0 CHECK (minimum_order_amount >= 0),
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  customer_identifier TEXT,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  campaign TEXT,
  allow_stacking BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at),
  CHECK (discount_type <> 'PERCENTAGE' OR discount_value <= 100),
  CHECK (discount_type <> 'FIXED_AMOUNT' OR max_discount_amount IS NULL)
);

CREATE TABLE public.voucher_products (
  voucher_id BIGINT NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (voucher_id, product_id)
);

CREATE TABLE public.voucher_redemptions (
  id BIGSERIAL PRIMARY KEY,
  voucher_id BIGINT NOT NULL REFERENCES public.vouchers(id),
  order_id BIGINT NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  discount_amount BIGINT NOT NULL CHECK (discount_amount >= 0),
  customer_identifier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (voucher_id, order_id)
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal_amount BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
  ADD COLUMN IF NOT EXISTS discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS voucher_id BIGINT REFERENCES public.vouchers(id),
  ADD COLUMN IF NOT EXISTS voucher_code TEXT;

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage vouchers" ON public.vouchers
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage voucher products" ON public.voucher_products
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins read voucher redemptions" ON public.voucher_redemptions
  FOR SELECT USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_order(code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', o.id, 'orderCode', o.order_code, 'subtotalAmount', o.subtotal_amount,
    'discountAmount', o.discount_amount, 'voucherCode', o.voucher_code,
    'totalAmount', o.total_amount, 'paymentMethod', o.payment_method,
    'orderStatus', o.order_status, 'createdAt', o.created_at, 'updatedAt', o.updated_at,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id, 'productId', oi.product_id, 'productName', oi.product_name,
        'unitPrice', oi.unit_price, 'quantity', oi.quantity, 'subtotal', oi.subtotal
      ) ORDER BY oi.id) FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  ) INTO result FROM public.orders o WHERE o.order_code = code;
  IF result IS NULL THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001'; END IF;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.create_order(jsonb);

CREATE OR REPLACE FUNCTION public.create_order(
  items jsonb,
  voucher_code_input text DEFAULT NULL,
  customer_identifier_input text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  line jsonb; item_record record; product_record record; voucher_record record;
  item_count integer; line_product_id numeric; line_quantity numeric;
  order_day date; counter_value integer; new_order_id bigint; new_order_code text;
  calculated_total bigint := 0; calculated_discount bigint := 0;
  eligible_total bigint := 0;
  selected_voucher_id bigint := NULL;
  normalized_code text := NULLIF(upper(trim(voucher_code_input)), '');
  normalized_customer text := NULLIF(lower(trim(customer_identifier_input)), '');
  voucher_product_count integer; eligible_product_count integer;
BEGIN
  IF jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items) < 1
    THEN RAISE EXCEPTION 'Cart is empty' USING ERRCODE = 'P0001'; END IF;
  item_count := jsonb_array_length(items);
  IF item_count > 50 THEN RAISE EXCEPTION 'Too many different products in one order' USING ERRCODE = 'P0001'; END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(items) LOOP
    IF jsonb_typeof(line) IS DISTINCT FROM 'object'
      OR COALESCE(line ->> 'productId', '') !~ '^[1-9][0-9]*$'
      OR COALESCE(line ->> 'quantity', '') !~ '^[0-9]+$'
      THEN RAISE EXCEPTION 'Invalid request body' USING ERRCODE = 'P0001'; END IF;
    line_product_id := (line ->> 'productId')::numeric;
    line_quantity := (line ->> 'quantity')::numeric;
    IF line_product_id > 9223372036854775807 OR line_quantity < 1 OR line_quantity > 9999
      THEN RAISE EXCEPTION 'Invalid product quantity' USING ERRCODE = 'P0001'; END IF;
  END LOOP;

  FOR item_record IN
    SELECT (value ->> 'productId')::bigint product_id, sum((value ->> 'quantity')::bigint) quantity
    FROM jsonb_array_elements(items) GROUP BY (value ->> 'productId')::bigint
  LOOP
    IF item_record.quantity > 9999 THEN RAISE EXCEPTION 'Quantity must be between 1 and 9999' USING ERRCODE = 'P0001'; END IF;
    SELECT p.id, p.name, public.night_sale_price(p.price, now()) price INTO product_record
    FROM public.products p WHERE p.id = item_record.product_id AND p.status = 'AVAILABLE' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A product in your cart is no longer available' USING ERRCODE = 'P0001'; END IF;
    calculated_total := calculated_total + product_record.price * item_record.quantity;
  END LOOP;

  IF normalized_code IS NOT NULL THEN
    SELECT * INTO voucher_record FROM public.vouchers v
    WHERE v.code = normalized_code AND v.is_active AND v.starts_at <= now()
      AND (v.expires_at IS NULL OR v.expires_at > now())
      AND (v.usage_limit IS NULL OR v.used_count < v.usage_limit)
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Voucher không hợp lệ hoặc đã hết hạn' USING ERRCODE = 'P0001'; END IF;
    IF voucher_record.customer_identifier IS NOT NULL
      AND lower(trim(voucher_record.customer_identifier)) IS DISTINCT FROM normalized_customer
      THEN RAISE EXCEPTION 'Voucher không dành cho khách hàng này' USING ERRCODE = 'P0001'; END IF;
    IF calculated_total < voucher_record.minimum_order_amount
      THEN RAISE EXCEPTION 'Đơn hàng chưa đạt giá trị tối thiểu của voucher' USING ERRCODE = 'P0001'; END IF;
    SELECT count(*) INTO voucher_product_count FROM public.voucher_products WHERE voucher_id = voucher_record.id;
    IF voucher_product_count > 0 THEN
      SELECT count(*), COALESCE(sum(public.night_sale_price(p.price, now()) * (e.value ->> 'quantity')::bigint), 0)
      INTO eligible_product_count, eligible_total
      FROM jsonb_array_elements(items) e
      JOIN public.voucher_products vp ON vp.product_id = (e.value ->> 'productId')::bigint
      JOIN public.products p ON p.id = vp.product_id
      WHERE vp.voucher_id = voucher_record.id AND p.status = 'AVAILABLE';
      IF eligible_product_count = 0 THEN RAISE EXCEPTION 'Voucher không áp dụng cho sản phẩm trong giỏ' USING ERRCODE = 'P0001'; END IF;
    ELSE
      eligible_total := calculated_total;
    END IF;
    IF voucher_record.discount_type = 'PERCENTAGE'
      THEN calculated_discount := eligible_total * voucher_record.discount_value / 100;
      IF voucher_record.max_discount_amount IS NOT NULL
        THEN calculated_discount := LEAST(calculated_discount, voucher_record.max_discount_amount); END IF;
    ELSE calculated_discount := LEAST(voucher_record.discount_value, eligible_total);
    END IF;
    calculated_discount := LEAST(calculated_discount, calculated_total);
    selected_voucher_id := voucher_record.id;
  END IF;

  order_day := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  INSERT INTO public.order_counters(day, n) VALUES (order_day, 1)
  ON CONFLICT (day) DO UPDATE SET n = public.order_counters.n + 1 RETURNING n INTO counter_value;
  new_order_code := 'LB' || to_char(order_day, 'YYYYMMDD') || lpad(counter_value::text, 3, '0');
  INSERT INTO public.orders(order_code, subtotal_amount, discount_amount, total_amount, voucher_id, voucher_code, payment_method)
  VALUES (new_order_code, calculated_total, calculated_discount, calculated_total - calculated_discount,
    selected_voucher_id, normalized_code, 'BANK') RETURNING id INTO new_order_id;

  FOR item_record IN
    SELECT (value ->> 'productId')::bigint product_id, sum((value ->> 'quantity')::bigint) quantity
    FROM jsonb_array_elements(items) GROUP BY (value ->> 'productId')::bigint
  LOOP
    SELECT p.id, p.name, public.night_sale_price(p.price, now()) price INTO product_record
    FROM public.products p WHERE p.id = item_record.product_id AND p.status = 'AVAILABLE';
    INSERT INTO public.order_items(order_id, product_id, product_name, unit_price, quantity, subtotal)
    VALUES (new_order_id, product_record.id, product_record.name, product_record.price,
      item_record.quantity, product_record.price * item_record.quantity);
  END LOOP;
  IF normalized_code IS NOT NULL THEN
    INSERT INTO public.voucher_redemptions(voucher_id, order_id, discount_amount, customer_identifier)
    VALUES (selected_voucher_id, new_order_id, calculated_discount, normalized_customer);
    UPDATE public.vouchers SET used_count = used_count + 1, updated_at = now() WHERE id = selected_voucher_id;
  END IF;
  RETURN public.get_order(new_order_code);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_orders(p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('PENDING', 'COMPLETED', 'CANCELLED')
    THEN RAISE EXCEPTION 'Invalid status filter' USING ERRCODE = 'P0001'; END IF;
  SELECT COALESCE(jsonb_agg(order_data ORDER BY created_at DESC, id DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT o.created_at, o.id, jsonb_build_object(
      'id', o.id, 'orderCode', o.order_code, 'subtotalAmount', o.subtotal_amount,
      'discountAmount', o.discount_amount, 'voucherCode', o.voucher_code,
      'totalAmount', o.total_amount, 'paymentMethod', o.payment_method,
      'orderStatus', o.order_status, 'createdAt', o.created_at, 'updatedAt', o.updated_at,
      'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id, 'productId', oi.product_id, 'productName', oi.product_name,
        'unitPrice', oi.unit_price, 'quantity', oi.quantity, 'subtotal', oi.subtotal
      ) ORDER BY oi.id) FROM public.order_items oi WHERE oi.order_id = o.id), '[]'::jsonb)
    ) order_data
    FROM public.orders o WHERE p_status IS NULL OR o.order_status = p_status
  ) orders_with_items;
  RETURN result;
END;
$$;
