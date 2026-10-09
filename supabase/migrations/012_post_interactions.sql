CREATE TABLE public.post_comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL,
  author TEXT NOT NULL DEFAULT 'Khách' CHECK (author = 'Khách'),
  content TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_comments_post_created
  ON public.post_comments (post_id, created_at DESC, id DESC);
CREATE INDEX idx_post_comments_guest_created
  ON public.post_comments (guest_id, created_at DESC);

CREATE TABLE public.post_reactions (
  post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, guest_id)
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.post_comments, public.post_reactions FROM anon, authenticated;

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
          'createdAt', comments.created_at
        ) ORDER BY comments.created_at DESC, comments.id DESC
      )
      FROM (
        SELECT id, author, content, created_at
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

CREATE OR REPLACE FUNCTION public.add_post_comment(
  p_post_id BIGINT,
  p_guest_id UUID,
  p_content TEXT
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

  INSERT INTO public.post_comments (post_id, guest_id, content)
  VALUES (p_post_id, p_guest_id, clean_content)
  RETURNING * INTO new_comment;

  RETURN pg_catalog.jsonb_build_object(
    'id', new_comment.id,
    'author', new_comment.author,
    'content', new_comment.content,
    'createdAt', new_comment.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_post_reaction(
  p_post_id BIGINT,
  p_guest_id UUID,
  p_reaction TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_guest_id IS NULL THEN
    RAISE EXCEPTION 'Guest identity is required' USING ERRCODE = 'P0001';
  END IF;
  IF p_reaction IS NOT NULL
     AND p_reaction NOT IN ('LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY') THEN
    RAISE EXCEPTION 'Invalid reaction' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.posts WHERE id = p_post_id AND is_published
  ) THEN
    RAISE EXCEPTION 'Post not found' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_guest_id::TEXT || ':' || p_post_id::TEXT, 0)
  );

  IF p_reaction IS NULL THEN
    DELETE FROM public.post_reactions
    WHERE post_id = p_post_id AND guest_id = p_guest_id;
  ELSE
    INSERT INTO public.post_reactions (post_id, guest_id, reaction)
    VALUES (p_post_id, p_guest_id, p_reaction)
    ON CONFLICT (post_id, guest_id)
    DO UPDATE SET reaction = EXCLUDED.reaction, created_at = pg_catalog.now();
  END IF;

  RETURN public.get_post_interactions(p_post_id, p_guest_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_post_comment(p_comment_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.post_comments WHERE id = p_comment_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.get_post_interactions(BIGINT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_post_comment(BIGINT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_post_reaction(BIGINT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_post_comment(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_post_interactions(BIGINT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_post_comment(BIGINT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_post_reaction(BIGINT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_post_comment(BIGINT) TO authenticated;
