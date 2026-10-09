CREATE OR REPLACE FUNCTION public.broadcast_post_comment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected_post_id BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_post_id := OLD.post_id;
  ELSE
    affected_post_id := NEW.post_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.posts
    WHERE id = affected_post_id AND is_published
  ) THEN
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

REVOKE ALL ON FUNCTION public.broadcast_post_comment_change() FROM PUBLIC;

CREATE TRIGGER post_comments_broadcast_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_post_comment_change();
