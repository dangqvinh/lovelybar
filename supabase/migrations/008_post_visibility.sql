ALTER TABLE public.posts
  ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT TRUE;

DROP POLICY "Anyone can read posts" ON public.posts;

CREATE POLICY "Anyone can read published posts" ON public.posts
  FOR SELECT USING (is_published OR public.is_admin());
