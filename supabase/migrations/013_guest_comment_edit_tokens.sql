ALTER TABLE public.post_comments
  ADD COLUMN edit_token_hash BYTEA,
  ADD COLUMN edited_at TIMESTAMPTZ;

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
          'author', comments.author,
          'content', comments.content,
          'createdAt', comments.created_at,
          'editedAt', comments.edited_at
        ) ORDER BY comments.created_at DESC, comments.id DESC
      )
      FROM (
        SELECT id, author, content, created_at, edited_at
        FROM public.post_comments
        WHERE post_id = p_post_id
        ORDER BY created_at DESC, id DESC
        LIMIT 100
      ) AS comments
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

REVOKE ALL ON FUNCTION public.add_post_comment(BIGINT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_post_comment(
  p_post_id BIGINT,
  p_guest_id UUID,
  p_content TEXT,
  p_edit_token_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clean_content TEXT := pg_catalog.btrim(COALESCE(p_content, ''));
  recent_count BIGINT;
  daily_count BIGINT;
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
  IF NOT EXISTS (
    SELECT 1 FROM public.posts WHERE id = p_post_id AND is_published
  ) THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_guest_id::TEXT, 0)
  );

  SELECT pg_catalog.count(*) INTO recent_count
  FROM public.post_comments
  WHERE guest_id = p_guest_id
    AND created_at > pg_catalog.now() - INTERVAL '1 minute';
  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Please wait before commenting again' USING ERRCODE = 'P0001';
  END IF;

  SELECT pg_catalog.count(*) INTO daily_count
  FROM public.post_comments
  WHERE guest_id = p_guest_id
    AND created_at > pg_catalog.now() - INTERVAL '24 hours';
  IF daily_count >= 20 THEN
    RAISE EXCEPTION 'Guest comment limit reached' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.post_comments (
    post_id, guest_id, content, edit_token_hash
  )
  VALUES (
    p_post_id, p_guest_id, clean_content, pg_catalog.decode(p_edit_token_hash, 'hex')
  )
  RETURNING * INTO new_comment;

  RETURN pg_catalog.jsonb_build_object(
    'id', new_comment.id,
    'author', new_comment.author,
    'content', new_comment.content,
    'createdAt', new_comment.created_at,
    'editedAt', new_comment.edited_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_guest_post_comment(
  p_comment_id BIGINT,
  p_edit_token_hash TEXT,
  p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clean_content TEXT := pg_catalog.btrim(COALESCE(p_content, ''));
  updated_comment public.post_comments%ROWTYPE;
BEGIN
  IF p_edit_token_hash IS NULL
     OR p_edit_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid comment edit token' USING ERRCODE = 'P0001';
  END IF;
  IF pg_catalog.char_length(clean_content) < 1
     OR pg_catalog.char_length(clean_content) > 1000 THEN
    RAISE EXCEPTION 'Comment must be between 1 and 1000 characters' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.post_comments AS comments
  SET content = clean_content, edited_at = pg_catalog.now()
  WHERE comments.id = p_comment_id
    AND comments.edit_token_hash = pg_catalog.decode(p_edit_token_hash, 'hex')
    AND EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = comments.post_id AND posts.is_published
    )
  RETURNING comments.* INTO updated_comment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment edit is not authorized' USING ERRCODE = 'P0001';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'id', updated_comment.id,
    'author', updated_comment.author,
    'content', updated_comment.content,
    'createdAt', updated_comment.created_at,
    'editedAt', updated_comment.edited_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_guest_post_comment(
  p_comment_id BIGINT,
  p_edit_token_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_edit_token_hash IS NULL
     OR p_edit_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid comment edit token' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.post_comments AS comments
  WHERE comments.id = p_comment_id
    AND comments.edit_token_hash = pg_catalog.decode(p_edit_token_hash, 'hex')
    AND EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = comments.post_id AND posts.is_published
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment delete is not authorized' USING ERRCODE = 'P0001';
  END IF;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.add_post_comment(BIGINT, UUID, TEXT, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edit_guest_post_comment(BIGINT, TEXT, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_guest_post_comment(BIGINT, TEXT)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.add_post_comment(BIGINT, UUID, TEXT, TEXT)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_post_interactions(BIGINT, UUID)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edit_guest_post_comment(BIGINT, TEXT, TEXT)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_guest_post_comment(BIGINT, TEXT)
  TO anon, authenticated;
