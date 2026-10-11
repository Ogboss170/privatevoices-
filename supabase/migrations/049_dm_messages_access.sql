-- Migration 049: Enable DM messaging for 1-on-1 and group participants
-- Fixes: group members could not read/send/update messages; inserts were not
-- tied to conversation membership.

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = p_conversation_id AND cm.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_participant(UUID) TO authenticated;

DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
CREATE POLICY "Participants can insert messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "Participants can update messages" ON public.messages;
CREATE POLICY "Participants can update messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(conversation_id))
  WITH CHECK (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "Senders can delete own messages" ON public.messages;
CREATE POLICY "Senders can delete own messages"
  ON public.messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

NOTIFY pgrst, 'reload schema';
