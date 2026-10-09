CREATE TABLE public.donation_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  message TEXT NOT NULL DEFAULT
    'Nếu bạn muốn đóng góp để Bar được vận hành lâu dài và có nhiều sản phẩm đa dạng hơn phục vụ cho các bạn thì có thể quyên góp qua đây.'
    CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
  disclaimer TEXT NOT NULL DEFAULT
    'Bằng tất cả sự cam kết, chúng tôi sẽ dùng toàn bộ số tiền cho mục đích phát triển Bar, mọi số tiền đều sử dụng rõ ràng và minh bạch.'
    CHECK (char_length(btrim(disclaimer)) BETWEEN 1 AND 2000),
  preset_amounts BIGINT[] NOT NULL DEFAULT ARRAY[5000, 10000, 15000, 20000]::BIGINT[]
    CHECK (
      cardinality(preset_amounts) BETWEEN 1 AND 8
      AND array_position(preset_amounts, NULL) IS NULL
      AND 0 < ALL (preset_amounts)
    ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.donation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read enabled donation settings"
  ON public.donation_settings
  FOR SELECT
  USING (is_enabled OR public.is_admin());

CREATE POLICY "Admins manage donation settings"
  ON public.donation_settings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.donation_settings TO anon, authenticated;
GRANT UPDATE ON public.donation_settings TO authenticated;

INSERT INTO public.donation_settings (id)
VALUES (TRUE);
