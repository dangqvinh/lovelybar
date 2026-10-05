CREATE OR REPLACE FUNCTION public.night_sale_price(
  base_price bigint,
  sale_at timestamp with time zone
)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (
      (sale_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time >= TIME '18:40'
      OR (sale_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time < TIME '07:00'
    )
    THEN base_price * 80 / 100
    ELSE base_price
  END;
$$;

REVOKE ALL ON FUNCTION public.night_sale_price(bigint, timestamp with time zone)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_order(items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  line jsonb;
  item_record record;
  product_record record;
  item_count integer;
  line_product_id numeric;
  line_quantity numeric;
  order_day date;
  counter_value integer;
  new_order_id bigint;
  new_order_code text;
  calculated_total bigint := 0;
BEGIN
  IF pg_catalog.jsonb_typeof(items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid request body' USING ERRCODE = 'P0001';
  END IF;

  item_count := pg_catalog.jsonb_array_length(items);
  IF item_count < 1 THEN
    RAISE EXCEPTION 'Cart is empty' USING ERRCODE = 'P0001';
  END IF;
  IF item_count > 50 THEN
    RAISE EXCEPTION 'Too many different products in one order' USING ERRCODE = 'P0001';
  END IF;

  FOR line IN SELECT value FROM pg_catalog.jsonb_array_elements(items)
  LOOP
    IF pg_catalog.jsonb_typeof(line) IS DISTINCT FROM 'object'
       OR COALESCE(line ->> 'productId', '') !~ '^[1-9][0-9]*$'
       OR COALESCE(line ->> 'quantity', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Invalid request body' USING ERRCODE = 'P0001';
    END IF;

    line_product_id := (line ->> 'productId')::numeric;
    line_quantity := (line ->> 'quantity')::numeric;
    IF line_product_id > 9223372036854775807 THEN
      RAISE EXCEPTION 'Invalid request body' USING ERRCODE = 'P0001';
    END IF;
    IF line_quantity < 1 OR line_quantity > 9999 THEN
      RAISE EXCEPTION 'Quantity must be between 1 and 9999' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  FOR item_record IN
    SELECT
      (entry.value ->> 'productId')::bigint AS product_id,
      pg_catalog.sum((entry.value ->> 'quantity')::bigint) AS quantity
    FROM pg_catalog.jsonb_array_elements(items) AS entry(value)
    GROUP BY (entry.value ->> 'productId')::bigint
    ORDER BY (entry.value ->> 'productId')::bigint
  LOOP
    IF item_record.quantity > 9999 THEN
      RAISE EXCEPTION 'Quantity must be between 1 and 9999' USING ERRCODE = 'P0001';
    END IF;

    SELECT p.id, p.name, public.night_sale_price(p.price, pg_catalog.now()) AS price
    INTO product_record
    FROM public.products AS p
    WHERE p.id = item_record.product_id
      AND p.status = 'AVAILABLE'
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product in your cart is no longer available' USING ERRCODE = 'P0001';
    END IF;

    calculated_total := calculated_total + product_record.price * item_record.quantity;
  END LOOP;

  order_day := (pg_catalog.now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  INSERT INTO public.order_counters(day, n)
  VALUES (order_day, 1)
  ON CONFLICT (day) DO UPDATE
    SET n = public.order_counters.n + 1
  RETURNING n INTO counter_value;

  new_order_code := 'LB'
    || pg_catalog.to_char(order_day, 'YYYYMMDD')
    || pg_catalog.lpad(counter_value::text, 3, '0');

  INSERT INTO public.orders(order_code, total_amount, payment_method)
  VALUES (new_order_code, calculated_total, 'BANK')
  RETURNING id INTO new_order_id;

  FOR item_record IN
    SELECT
      (entry.value ->> 'productId')::bigint AS product_id,
      pg_catalog.sum((entry.value ->> 'quantity')::bigint) AS quantity
    FROM pg_catalog.jsonb_array_elements(items) AS entry(value)
    GROUP BY (entry.value ->> 'productId')::bigint
    ORDER BY (entry.value ->> 'productId')::bigint
  LOOP
    SELECT p.id, p.name, public.night_sale_price(p.price, pg_catalog.now()) AS price
    INTO product_record
    FROM public.products AS p
    WHERE p.id = item_record.product_id
      AND p.status = 'AVAILABLE';

    INSERT INTO public.order_items(
      order_id, product_id, product_name, unit_price, quantity, subtotal
    )
    VALUES (
      new_order_id,
      product_record.id,
      product_record.name,
      product_record.price,
      item_record.quantity,
      product_record.price * item_record.quantity
    );
  END LOOP;

  RETURN public.get_order(new_order_code);
END;
$$;
