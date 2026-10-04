CREATE OR REPLACE FUNCTION public.admin_top_products_report(
  p_from_date date,
  p_to_date date
)
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
  IF p_from_date IS NULL OR p_to_date IS NULL OR p_from_date > p_to_date THEN
    RAISE EXCEPTION 'Invalid report date range' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'productName', product_name,
        'quantitySold', quantity_sold,
        'orderCount', order_count,
        'confirmedRevenue', confirmed_revenue
      )
      ORDER BY quantity_sold DESC, confirmed_revenue DESC, product_name
    ),
    '[]'::jsonb
  )
  INTO result
  FROM (
    SELECT
      oi.product_name,
      pg_catalog.sum(oi.quantity)::bigint AS quantity_sold,
      pg_catalog.count(DISTINCT o.id)::bigint AS order_count,
      pg_catalog.sum(oi.subtotal)::bigint AS confirmed_revenue
    FROM public.orders AS o
    JOIN public.order_items AS oi ON oi.order_id = o.id
    WHERE o.order_status = 'COMPLETED'
      AND (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
        BETWEEN p_from_date AND p_to_date
    GROUP BY oi.product_name
    ORDER BY quantity_sold DESC, confirmed_revenue DESC, oi.product_name
    LIMIT 10
  ) AS best_sellers;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_top_products_report(date, date)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_top_products_report(date, date)
TO authenticated;
