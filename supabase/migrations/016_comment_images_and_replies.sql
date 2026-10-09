INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-comment-images',
  'post-comment-images',
  TRUE,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Public can read post comment images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'post-comment-images');

CREATE POLICY "Anyone can upload post comment images"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'post-comment-images'
  AND (storage.foldername(name))[1] = 'posts'
  AND (storage.foldername(name))[2] ~ '^[0-9]+$'
  AND EXISTS (
    SELECT 1 FROM public.posts
    WHERE id::TEXT = (storage.foldername(name))[2]
      AND (is_published OR public.is_admin())
  )
);

ALTER TABLE public.post_comments
  ALTER COLUMN guest_id DROP NOT NULL,
  ADD COLUMN parent_id BIGINT REFERENCES public.post_comments(id) ON DELETE SET NULL,
  ADD COLUMN images TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.post_comments
  DROP CONSTRAINT post_comments_author_check,
  ADD CONSTRAINT post_comments_author_check
    CHECK (
      (author = 'Khách' AND guest_id IS NOT NULL)
      OR (author = 'Admin' AND guest_id IS NULL)
    );

CREATE INDEX idx_post_comments_parent_created
  ON public.post_comments (parent_id, created_at, id)
  WHERE parent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_post_interactions(
  p_post_id BIGINT,
  p_guest_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.posts
    WHERE id = p_post_id AND (is_published OR public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = 'P0001';
  END IF;

  SELECT pg_catalog.jsonb_build_object(
    'reactionCounts',
    COALESCE((
      SELECT pg_catalog.jsonb_object_agg(reaction, reaction_count)
      FROM (
        SELECT reaction, pg_catalog.count(*) AS reaction_count
        FROM public.post_reactions
        WHERE post_id = p_post_id
        GROUP BY reaction
      ) AS counts
    ), '{}'::JSONB),
    'myReaction',
    (
      SELECT reaction FROM public.post_reactions
      WHERE post_id = p_post_id AND guest_id = p_guest_id
    ),
    'comments',
    COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', comments.id,
          'parentId', comments.parent_id,
          'author', comments.author,
          'content', comments.content,
          'createdAt', comments.created_at,
          'editedAt', comments.edited_at,
          'images', comments.images
        ) ORDER BY comments.created_at DESC, comments.id DESC
      )
      FROM public.post_comments AS comments
      WHERE comments.post_id = p_post_id
    ), '[]'::JSONB),
    'commentCount',
    (
      SELECT pg_catalog.count(*)
      FROM public.post_comments
      WHERE post_id = p_post_id
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.add_post_comment(BIGINT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.add_post_comment(BIGINT, UUID, TEXT, TEXT);

CREATE FUNCTION public.add_post_comment(
  p_post_id BIGINT,
  p_guest_id UUID,
  p_content TEXT,
  p_edit_token_hash TEXT,
  p_parent_id BIGINT,
  p_images TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clean_content TEXT := pg_catalog.btrim(COALESCE(p_content, ''));
  new_comment public.post_comments%ROWTYPE;
BEGIN
  IF p_guest_id IS NULL THEN
    RAISE EXCEPTION 'Guest identity is required' USING ERRCODE = 'P0001';
  END IF;
  IF p_edit_token_hash IS NULL
     OR p_edit_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid comment edit token' USING ERRCODE = 'P0001';
  END IF;
  IF pg_catalog.char_length(clean_content) < 1
     OR pg_catalog.char_length(clean_content) > 1000 THEN
    RAISE EXCEPTION 'Comment must be between 1 and 1000 characters' USING ERRCODE = 'P0001';
  END IF;
  IF pg_catalog.cardinality(COALESCE(p_images, ARRAY[]::TEXT[])) > 5
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.unnest(COALESCE(p_images, ARRAY[]::TEXT[])) AS image(path)
       WHERE image.path IS NULL OR image.path !~ (
         '^posts/' || p_post_id::TEXT ||
         '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
       )
     ) THEN
    RAISE EXCEPTION 'Invalid comment images' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.posts WHERE id = p_post_id AND is_published
  ) THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = 'P0001';
  END IF;
  IF p_parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.post_comments
    WHERE id = p_parent_id AND post_id = p_post_id
  ) THEN
    RAISE EXCEPTION 'Comment to reply to was not found' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.post_comments (
    post_id, guest_id, content, edit_token_hash, parent_id, images
  )
  VALUES (
    p_post_id,
    p_guest_id,
    clean_content,
    pg_catalog.decode(p_edit_token_hash, 'hex'),
    p_parent_id,
    COALESCE(p_images, ARRAY[]::TEXT[])
  )
  RETURNING * INTO new_comment;

  RETURN pg_catalog.jsonb_build_object(
    'id', new_comment.id,
    'parentId', new_comment.parent_id,
    'author', new_comment.author,
    'content', new_comment.content,
    'createdAt', new_comment.created_at,
    'editedAt', new_comment.edited_at,
    'images', new_comment.images
  );
END;
$$;

CREATE FUNCTION public.admin_add_post_comment(
  p_post_id BIGINT,
  p_content TEXT,
  p_parent_id BIGINT,
  p_images TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clean_content TEXT := pg_catalog.btrim(COALESCE(p_content, ''));
  new_comment public.post_comments%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = 'P0001';
  END IF;
  IF pg_catalog.char_length(clean_content) < 1
     OR pg_catalog.char_length(clean_content) > 1000 THEN
    RAISE EXCEPTION 'Comment must be between 1 and 1000 characters' USING ERRCODE = 'P0001';
  END IF;
  IF pg_catalog.cardinality(COALESCE(p_images, ARRAY[]::TEXT[])) > 5
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.unnest(COALESCE(p_images, ARRAY[]::TEXT[])) AS image(path)
       WHERE image.path IS NULL OR image.path !~ (
         '^posts/' || p_post_id::TEXT ||
         '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
       )
     ) THEN
    RAISE EXCEPTION 'Invalid comment images' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.posts
    WHERE id = p_post_id AND (is_published OR public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = 'P0001';
  END IF;
  IF p_parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.post_comments
    WHERE id = p_parent_id AND post_id = p_post_id
  ) THEN
    RAISE EXCEPTION 'Comment to reply to was not found' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.post_comments (
    post_id, guest_id, author, content, parent_id, images
  )
  VALUES (
    p_post_id,
    NULL,
    'Admin',
    clean_content,
    p_parent_id,
    COALESCE(p_images, ARRAY[]::TEXT[])
  )
  RETURNING * INTO new_comment;

  RETURN pg_catalog.jsonb_build_object(
    'id', new_comment.id,
    'parentId', new_comment.parent_id,
    'author', new_comment.author,
    'content', new_comment.content,
    'createdAt', new_comment.created_at,
    'editedAt', new_comment.edited_at,
    'images', new_comment.images
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_post_comment(BIGINT, UUID, TEXT, TEXT, BIGINT, TEXT[])
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_add_post_comment(BIGINT, TEXT, BIGINT, TEXT[])
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.add_post_comment(BIGINT, UUID, TEXT, TEXT, BIGINT, TEXT[])
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_post_comment(BIGINT, TEXT, BIGINT, TEXT[])
  TO authenticated;
