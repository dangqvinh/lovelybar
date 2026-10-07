ALTER TABLE public.posts
  ADD COLUMN images TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.posts
SET images = ARRAY[image]
WHERE image IS NOT NULL;
