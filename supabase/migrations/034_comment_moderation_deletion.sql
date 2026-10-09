-- ==============================================================================
-- Migration 034: Post Authors Can Moderate Comments on Their Posts
-- ==============================================================================

-- Expand DELETE policy on public.comments so:
-- 1. Authors of the comment can delete their own comment
-- 2. Authors of the post can delete any comment posted on their post
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
DROP POLICY IF EXISTS "Users and post authors can delete comments" ON public.comments;

CREATE POLICY "Users and post authors can delete comments"
  ON public.comments
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = comments.post_id AND p.author_id = auth.uid()
    )
  );
