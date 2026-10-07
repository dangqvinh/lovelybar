ALTER TABLE public.posts
  ADD CONSTRAINT posts_images_limit
  CHECK (cardinality(images) <= 20);
