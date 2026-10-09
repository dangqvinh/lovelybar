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
