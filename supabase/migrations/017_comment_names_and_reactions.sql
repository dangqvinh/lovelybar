ALTER TABLE public.post_comments
  DROP CONSTRAINT post_comments_author_check,
  ADD CONSTRAINT post_comments_author_check
    CHECK (
      (guest_id IS NOT NULL
        AND author <> ''
        AND pg_catalog.char_length(author) <= 40
        AND pg_catalog.lower(author) <> 'admin')
      OR (guest_id IS NULL AND author = 'Admin')
    );

CREATE TABLE public.post_comment_reactions (
  comment_id BIGINT NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL,
  reaction TEXT NOT NULL CHECK (
    reaction IN ('LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (comment_id, guest_id)
);

ALTER TABLE public.post_comment_reactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.post_comment_reactions FROM anon, authenticated;

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
          'images', comments.images,
          'reactionCounts', COALESCE((
            SELECT pg_catalog.jsonb_object_agg(reaction, reaction_count)
            FROM (
              SELECT reaction, pg_catalog.count(*) AS reaction_count
              FROM public.post_comment_reactions
              WHERE comment_id = comments.id
              GROUP BY reaction
            ) AS comment_counts
          ), '{}'::JSONB),
          'myReaction', (
            SELECT reaction
            FROM public.post_comment_reactions
            WHERE comment_id = comments.id AND guest_id = p_guest_id
          )
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

REVOKE ALL ON FUNCTION public.add_post_comment(
  BIGINT, UUID, TEXT, TEXT, BIGINT, TEXT[]
) FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.add_post_comment(BIGINT, UUID, TEXT, TEXT, BIGINT, TEXT[]);

CREATE FUNCTION public.add_post_comment(
  p_post_id BIGINT,
  p_guest_id UUID,
  p_content TEXT,
  p_edit_token_hash TEXT,
  p_parent_id BIGINT,
  p_images TEXT[],
  p_author TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  clean_content TEXT := pg_catalog.btrim(COALESCE(p_content, ''));
  clean_author TEXT := pg_catalog.btrim(COALESCE(p_author, ''));
  new_comment public.post_comments%ROWTYPE;
BEGIN
  IF p_guest_id IS NULL THEN
    RAISE EXCEPTION 'Guest identity is required' USING ERRCODE = 'P0001';
  END IF;
  IF p_edit_token_hash IS NULL
     OR p_edit_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid comment edit token' USING ERRCODE = 'P0001';
  END IF;
  IF pg_catalog.char_length(clean_author) < 1
     OR pg_catalog.char_length(clean_author) > 40
     OR pg_catalog.lower(clean_author) = 'admin' THEN
    RAISE EXCEPTION 'Comment name must be 1 to 40 characters and cannot be Admin'
      USING ERRCODE = 'P0001';
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
    post_id, guest_id, author, content, edit_token_hash, parent_id, images
  )
  VALUES (
    p_post_id,
    p_guest_id,
    clean_author,
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
    'images', new_comment.images,
    'reactionCounts', '{}'::JSONB,
    'myReaction', NULL
  );
END;
$$;

CREATE FUNCTION public.set_post_comment_reaction(
  p_comment_id BIGINT,
  p_guest_id UUID,
  p_reaction TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected_post_id BIGINT;
BEGIN
  IF p_guest_id IS NULL THEN
    RAISE EXCEPTION 'Guest identity is required' USING ERRCODE = 'P0001';
  END IF;
  IF p_reaction IS NOT NULL
     AND p_reaction NOT IN ('LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY') THEN
    RAISE EXCEPTION 'Invalid reaction' USING ERRCODE = 'P0001';
  END IF;

  SELECT comments.post_id INTO affected_post_id
  FROM public.post_comments AS comments
  JOIN public.posts AS posts ON posts.id = comments.post_id
  WHERE comments.id = p_comment_id
    AND (posts.is_published OR public.is_admin());
  IF affected_post_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_guest_id::TEXT || ':' || p_comment_id::TEXT,
      0
    )
  );

  IF p_reaction IS NULL THEN
    DELETE FROM public.post_comment_reactions
    WHERE comment_id = p_comment_id AND guest_id = p_guest_id;
  ELSE
    INSERT INTO public.post_comment_reactions (comment_id, guest_id, reaction)
    VALUES (p_comment_id, p_guest_id, p_reaction)
    ON CONFLICT (comment_id, guest_id)
    DO UPDATE SET reaction = EXCLUDED.reaction, created_at = pg_catalog.now();
  END IF;

  RETURN public.get_post_interactions(affected_post_id, p_guest_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_post_comment_reaction_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected_post_id BIGINT;
  affected_comment_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_comment_id := OLD.comment_id;
  ELSE
    affected_comment_id := NEW.comment_id;
  END IF;
  SELECT post_id INTO affected_post_id
  FROM public.post_comments
  WHERE id = affected_comment_id;

  IF affected_post_id IS NOT NULL THEN
    PERFORM realtime.send(
      pg_catalog.jsonb_build_object('changed', TRUE),
      'comment_changed',
      'post-comments:' || affected_post_id::TEXT,
      FALSE
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_post_comment_reaction_change()
  FROM PUBLIC;

CREATE TRIGGER post_comment_reactions_broadcast_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.post_comment_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_post_comment_reaction_change();

REVOKE ALL ON FUNCTION public.add_post_comment(
  BIGINT, UUID, TEXT, TEXT, BIGINT, TEXT[], TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_post_comment_reaction(BIGINT, UUID, TEXT)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_post_interactions(BIGINT, UUID)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_post_comment(
  BIGINT, UUID, TEXT, TEXT, BIGINT, TEXT[], TEXT
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_post_comment_reaction(BIGINT, UUID, TEXT)
  TO anon, authenticated;
