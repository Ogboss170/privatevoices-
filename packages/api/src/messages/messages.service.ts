import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import type { User } from '@supabase/supabase-js';

@Injectable()
export class MessagesService {
  constructor(private supabase: SupabaseService) {}

  async startConversation(user: User, dto: StartConversationDto) {
    // 1. Get recipient profile
    const { data: recipient } = await this.supabase.admin
      .from('profiles')
      .select('id, username')
      .ilike('username', dto.recipientUsername)
      .single();

    if (!recipient) throw new NotFoundException('Recipient user not found');
    if (recipient.id === user.id) {
      throw new ForbiddenException('You cannot message yourself');
    }

    // 2. Check privacy settings
    const { data: priv } = await this.supabase.admin
      .from('privacy_settings')
      .select('who_can_message')
      .eq('user_id', recipient.id)
      .single();

    const msgVis = priv?.who_can_message ?? 'anyone';
    if (msgVis === 'nobody') {
      throw new ForbiddenException(`@${recipient.username} does not accept direct messages.`);
    }

    // 3. Find existing or create conversation
    const [userA, userB] = user.id < recipient.id ? [user.id, recipient.id] : [recipient.id, user.id];

    const { data: existing } = await this.supabase.admin
      .from('conversations')
      .select('*')
      .match({ user_a_id: userA, user_b_id: userB })
      .maybeSingle();

    if (existing) return existing;

    const { data: created, error } = await this.supabase.admin
      .from('conversations')
      .insert({
        user_a_id: userA,
        user_b_id: userB,
      })
      .select()
      .single();

    if (error || !created) throw new InternalServerErrorException('Failed to create conversation');
    return created;
  }

  async getMyConversations(user: User) {
    const { data: conversations, error } = await this.supabase.admin
      .from('conversations')
      .select(`
        *,
        user_a:profiles!conversations_user_a_id_fkey(id, username, display_name, avatar_url),
        user_b:profiles!conversations_user_b_id_fkey(id, username, display_name, avatar_url)
      `)
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch conversations');
    return conversations ?? [];
  }

  async sendMessage(user: User, dto: SendMessageDto) {
    // Check conversation participation
    const { data: conv } = await this.supabase.admin
      .from('conversations')
      .select('user_a_id, user_b_id')
      .eq('id', dto.conversationId)
      .single();

    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.user_a_id !== user.id && conv.user_b_id !== user.id) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    // Insert message
    const { data: message, error } = await this.supabase.admin
      .from('messages')
      .insert({
        conversation_id: dto.conversationId,
        sender_id: user.id,
        content: dto.content,
        image_url: dto.imageUrl ?? null,
      })
      .select('*, sender:profiles(id, username, display_name, avatar_url)')
      .single();

    if (error || !message) throw new InternalServerErrorException('Failed to send message');

    // Update conversation last_message
    await this.supabase.admin
      .from('conversations')
      .update({
        last_message: dto.content,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', dto.conversationId);

    return message;
  }

  async getMessages(user: User, conversationId: string) {
    // Check conversation participation
    const { data: conv } = await this.supabase.admin
      .from('conversations')
      .select('user_a_id, user_b_id')
      .eq('id', conversationId)
      .single();

    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.user_a_id !== user.id && conv.user_b_id !== user.id) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    const { data: messages, error } = await this.supabase.admin
      .from('messages')
      .select('*, sender:profiles(id, username, display_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to fetch messages');

    // Mark messages as read
    await this.supabase.admin
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id);

    return messages ?? [];
  }
}
