CREATE TABLE IF NOT EXISTS public.posts (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 20000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON public.posts (created_at DESC, id DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read posts" ON public.posts
  FOR SELECT USING (TRUE);

CREATE POLICY "Admins manage posts" ON public.posts
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());
