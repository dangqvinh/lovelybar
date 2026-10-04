CREATE OR REPLACE FUNCTION public.admin_sales_report(
  p_granularity text,
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
  IF p_granularity IS NULL OR p_granularity NOT IN ('day', 'month') THEN
    RAISE EXCEPTION 'Granularity must be day or month' USING ERRCODE = 'P0001';
  END IF;
  IF p_from_date IS NULL OR p_to_date IS NULL OR p_from_date > p_to_date THEN
    RAISE EXCEPTION 'Invalid report date range' USING ERRCODE = 'P0001';
  END IF;

  WITH filtered_orders AS (
    SELECT
      o.total_amount,
      o.order_status,
      (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS business_date
    FROM public.orders AS o
  ),
  grouped AS (
    SELECT
      pg_catalog.date_trunc(
        p_granularity,
        filtered_orders.business_date::timestamp
      )::date AS period_start,
      pg_catalog.count(*) AS total_orders,
      pg_catalog.count(*) FILTER (WHERE order_status = 'PENDING') AS pending_orders,
      pg_catalog.count(*) FILTER (WHERE order_status = 'COMPLETED') AS completed_orders,
      COALESCE(
        pg_catalog.sum(total_amount) FILTER (WHERE order_status <> 'CANCELLED'),
        0
      ) AS expected_revenue,
      COALESCE(
        pg_catalog.sum(total_amount) FILTER (WHERE order_status = 'COMPLETED'),
        0
      ) AS confirmed_revenue
    FROM filtered_orders
    WHERE business_date BETWEEN p_from_date AND p_to_date
    GROUP BY 1
  )
  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'periodStart', pg_catalog.to_char(period_start, 'YYYY-MM-DD'),
        'totalOrders', total_orders,
        'pendingOrders', pending_orders,
        'completedOrders', completed_orders,
        'expectedRevenue', expected_revenue,
        'confirmedRevenue', confirmed_revenue
      )
      ORDER BY period_start
    ),
    '[]'::jsonb
  )
  INTO result
  FROM grouped;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_sales_report(text, date, date)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sales_report(text, date, date)
TO authenticated;
