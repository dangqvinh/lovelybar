UPDATE public.vouchers
SET is_active = false,
    discount_type = 'PERCENTAGE',
    discount_value = LEAST(discount_value, 100),
    max_discount_amount = NULL,
    campaign = NULL,
    allow_stacking = false,
    updated_at = now()
WHERE discount_type <> 'PERCENTAGE'
   OR max_discount_amount IS NOT NULL
   OR campaign IS NOT NULL
   OR allow_stacking;

DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.vouchers'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%discount_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.vouchers DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END
$$;

ALTER TABLE public.vouchers
  ADD CONSTRAINT vouchers_percentage_only_check
    CHECK (discount_type = 'PERCENTAGE'),
  ADD CONSTRAINT vouchers_no_max_discount_check
    CHECK (max_discount_amount IS NULL);

ALTER TABLE public.vouchers
  DROP COLUMN IF EXISTS campaign,
  DROP COLUMN IF EXISTS allow_stacking;
