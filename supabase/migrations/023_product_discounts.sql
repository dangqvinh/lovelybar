ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0
    CHECK (discount_percent BETWEEN 0 AND 100);

CREATE OR REPLACE FUNCTION public.create_order(
  items jsonb,
  voucher_code_input text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  line jsonb; item_record record; product_record record; voucher_record record;
  item_count integer; line_product_id numeric; line_quantity numeric;
  order_day date; counter_value integer; new_order_id bigint; new_order_code text;
  calculated_total bigint := 0; calculated_discount bigint := 0; eligible_total bigint := 0;
  selected_voucher_id bigint := NULL;
  normalized_code text := NULLIF(upper(trim(voucher_code_input)), '');
  voucher_product_count integer; eligible_product_count integer;
  is_night_sale boolean;
BEGIN
  IF jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items) < 1
    THEN RAISE EXCEPTION 'Cart is empty' USING ERRCODE = 'P0001'; END IF;
  item_count := jsonb_array_length(items);
  IF item_count > 50 THEN RAISE EXCEPTION 'Too many different products in one order' USING ERRCODE = 'P0001'; END IF;
  is_night_sale := (
    (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time >= TIME '18:40'
    OR (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::time < TIME '07:00'
  );
  IF normalized_code IS NOT NULL AND is_night_sale
    THEN RAISE EXCEPTION 'Voucher không áp dụng trong giờ vàng' USING ERRCODE = 'P0001'; END IF;

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
    SELECT p.id, p.name,
      CASE
        WHEN is_night_sale THEN public.night_sale_price(p.price, now())
        WHEN normalized_code IS NOT NULL THEN p.price
        ELSE p.price * (100 - p.discount_percent) / 100
      END price
    INTO product_record
    FROM public.products p
    WHERE p.id = item_record.product_id AND p.status = 'AVAILABLE' FOR SHARE;
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
    SELECT count(*) INTO voucher_product_count FROM public.voucher_products WHERE voucher_id = voucher_record.id;
    IF voucher_product_count > 0 THEN
      SELECT count(*), COALESCE(sum(p.price * (e.value ->> 'quantity')::bigint), 0)
      INTO eligible_product_count, eligible_total
      FROM jsonb_array_elements(items) e
      JOIN public.voucher_products vp ON vp.product_id = (e.value ->> 'productId')::bigint
      JOIN public.products p ON p.id = vp.product_id
      WHERE vp.voucher_id = voucher_record.id AND p.status = 'AVAILABLE';
      IF eligible_product_count = 0 THEN RAISE EXCEPTION 'Voucher không áp dụng cho sản phẩm trong giỏ' USING ERRCODE = 'P0001'; END IF;
    ELSE eligible_total := calculated_total;
    END IF;
    calculated_discount := eligible_total * voucher_record.discount_value / 100;
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
    SELECT p.id, p.name,
      CASE
        WHEN is_night_sale THEN public.night_sale_price(p.price, now())
        WHEN normalized_code IS NOT NULL THEN p.price
        ELSE p.price * (100 - p.discount_percent) / 100
      END price
    INTO product_record
    FROM public.products p WHERE p.id = item_record.product_id AND p.status = 'AVAILABLE';
    INSERT INTO public.order_items(order_id, product_id, product_name, unit_price, quantity, subtotal)
    VALUES (new_order_id, product_record.id, product_record.name, product_record.price,
      item_record.quantity, product_record.price * item_record.quantity);
  END LOOP;
  IF normalized_code IS NOT NULL THEN
    INSERT INTO public.voucher_redemptions(voucher_id, order_id, discount_amount)
    VALUES (selected_voucher_id, new_order_id, calculated_discount);
    UPDATE public.vouchers SET used_count = used_count + 1, updated_at = now() WHERE id = selected_voucher_id;
  END IF;
  RETURN public.get_order(new_order_code);
END;
$$;
