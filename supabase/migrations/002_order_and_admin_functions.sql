CREATE OR REPLACE FUNCTION public.get_order(code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT pg_catalog.jsonb_build_object(
    'id', o.id,
    'orderCode', o.order_code,
    'totalAmount', o.total_amount,
    'paymentMethod', o.payment_method,
    'orderStatus', o.order_status,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'items', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', oi.id,
          'productId', oi.product_id,
          'productName', oi.product_name,
          'unitPrice', oi.unit_price,
          'quantity', oi.quantity,
          'subtotal', oi.subtotal
        ) ORDER BY oi.id
      )
      FROM public.order_items AS oi
      WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.orders AS o
  WHERE o.order_code = code;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  RETURN result;
END;
$$;

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

    SELECT p.id, p.name, p.price
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
    SELECT p.id, p.name, p.price
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

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'totalProducts', (SELECT pg_catalog.count(*) FROM public.products),
    'totalOrders', (SELECT pg_catalog.count(*) FROM public.orders),
    'pendingOrders', (
      SELECT pg_catalog.count(*) FROM public.orders WHERE order_status = 'PENDING'
    ),
    'expectedRevenue', (
      SELECT COALESCE(pg_catalog.sum(total_amount), 0)
      FROM public.orders
      WHERE order_status <> 'CANCELLED'
    ),
    'recentOrders', COALESCE((
      SELECT pg_catalog.jsonb_agg(order_data ORDER BY created_at DESC, id DESC)
      FROM (
        SELECT
          o.created_at,
          o.id,
          pg_catalog.jsonb_build_object(
            'id', o.id,
            'orderCode', o.order_code,
            'totalAmount', o.total_amount,
            'paymentMethod', o.payment_method,
            'orderStatus', o.order_status,
            'createdAt', o.created_at,
            'updatedAt', o.updated_at,
            'items', COALESCE((
              SELECT pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                  'id', oi.id,
                  'productId', oi.product_id,
                  'productName', oi.product_name,
                  'unitPrice', oi.unit_price,
                  'quantity', oi.quantity,
                  'subtotal', oi.subtotal
                ) ORDER BY oi.id
              )
              FROM public.order_items AS oi
              WHERE oi.order_id = o.id
            ), '[]'::jsonb)
          ) AS order_data
        FROM public.orders AS o
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT 5
      ) AS recent
    ), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_orders(p_status text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NOT NULL
     AND p_status NOT IN ('PENDING', 'COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Invalid status filter' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(order_data ORDER BY created_at DESC, id DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      o.created_at,
      o.id,
      pg_catalog.jsonb_build_object(
        'id', o.id,
        'orderCode', o.order_code,
        'totalAmount', o.total_amount,
        'paymentMethod', o.payment_method,
        'orderStatus', o.order_status,
        'createdAt', o.created_at,
        'updatedAt', o.updated_at,
        'items', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'id', oi.id,
              'productId', oi.product_id,
              'productName', oi.product_name,
              'unitPrice', oi.unit_price,
              'quantity', oi.quantity,
              'subtotal', oi.subtotal
            ) ORDER BY oi.id
          )
          FROM public.order_items AS oi
          WHERE oi.order_id = o.id
        ), '[]'::jsonb)
      ) AS order_data
    FROM public.orders AS o
    WHERE p_status IS NULL OR o.order_status = p_status
  ) AS orders_with_items;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_order_status(p_order_id bigint, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  order_code_value text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('PENDING', 'COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Status must be PENDING, COMPLETED or CANCELLED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
  SET order_status = p_status, updated_at = pg_catalog.now()
  WHERE id = p_order_id
  RETURNING order_code INTO order_code_value;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  RETURN public.get_order(order_code_value);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_order(p_order_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  order_code_value text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  SELECT order_code INTO order_code_value
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  RETURN public.get_order(order_code_value);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_order(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_orders(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_order_status(bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_get_order(bigint) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_orders(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_order_status(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_order(bigint) TO authenticated;
