import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SendWhisperDto } from './dto/send-whisper.dto';
import { ReplyWhisperDto } from './dto/reply-whisper.dto';
import type { User } from '@supabase/supabase-js';
import * as crypto from 'crypto';

@Injectable()
export class WhispersService {
  constructor(private supabase: SupabaseService) {}

  private hashIdentifier(val: string): string {
    return crypto.createHash('sha256').update(val).digest('hex');
  }

  async getRecipientProfile(rawUsername: string) {
    const cleanUsername = rawUsername.replace(/^@/, '');
    const { data: recipient } = await this.supabase.admin
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio')
      .ilike('username', cleanUsername)
      .single();

    if (!recipient) {
      throw new NotFoundException(`User @${cleanUsername} not found`);
    }

    const { data: priv } = await this.supabase.admin
      .from('privacy_settings')
      .select('whisper_visibility')
      .eq('user_id', recipient.id)
      .single();

    return {
      id: recipient.id,
      username: recipient.username,
      displayName: recipient.display_name,
      avatarUrl: recipient.avatar_url,
      bio: recipient.bio,
      whisperVisibility: priv?.whisper_visibility ?? 'anyone',
    };
  }

  async sendWhisper(dto: SendWhisperDto, clientIp = '127.0.0.1') {
    const cleanUsername = dto.recipientUsername.replace(/^@/, '');
    // 1. Resolve recipient profile by username
    const { data: recipient } = await this.supabase.admin
      .from('profiles')
      .select('id, username')
      .ilike('username', cleanUsername)
      .single();

    if (!recipient) {
      throw new NotFoundException(`User @${cleanUsername} not found`);
    }

    // 2. Fetch recipient privacy settings
    const { data: priv } = await this.supabase.admin
      .from('privacy_settings')
      .select('whisper_visibility')
      .eq('user_id', recipient.id)
      .single();

    const whisperVis = priv?.whisper_visibility ?? 'anyone';
    if (whisperVis === 'nobody') {
      throw new ForbiddenException(`@${recipient.username} is not accepting whispers.`);
    }

    // 3. Create whisper with hashed sender metadata for abuse prevention
    const senderIpHash = this.hashIdentifier(clientIp);
    const sessionHash = dto.senderSessionHash
      ? this.hashIdentifier(dto.senderSessionHash)
      : senderIpHash;

    const { data: whisper, error } = await this.supabase.admin
      .from('whispers')
      .insert({
        recipient_id: recipient.id,
        content: dto.content,
        sender_session_hash: sessionHash,
        sender_ip_hash: senderIpHash,
      })
      .select('id, recipient_id, content, created_at')
      .single();

    if (error || !whisper) {
      throw new InternalServerErrorException('Failed to send whisper');
    }

    return {
      message: 'Whisper delivered successfully',
      whisperId: whisper.id,
    };
  }

  async getMyWhispers(user: User) {
    const { data: whispers, error } = await this.supabase.admin
      .from('whispers')
      .select('id, recipient_id, content, reply_content, replied_at, is_read, created_at')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch whispers');

    return whispers ?? [];
  }

  async markAsRead(user: User, whisperId: string) {
    const { error } = await this.supabase.admin
      .from('whispers')
      .update({ is_read: true })
      .eq('id', whisperId)
      .eq('recipient_id', user.id);

    if (error) throw new InternalServerErrorException('Failed to mark whisper as read');
    return { success: true };
  }

  async reportWhisper(user: User, whisperId: string, reason?: string) {
    const { data: whisper } = await this.supabase.admin
      .from('whispers')
      .select('id, recipient_id')
      .eq('id', whisperId)
      .single();

    if (!whisper) throw new NotFoundException('Whisper not found');
    if (whisper.recipient_id !== user.id) {
      throw new ForbiddenException('You can only report whispers sent to you');
    }

    await this.supabase.admin.from('reports').insert({
      reporter_id: user.id,
      target_id: whisperId,
      target_type: 'whisper',
      reason: reason || 'Abusive anonymous whisper',
    });

    return { message: 'Whisper reported successfully' };
  }

  async replyToWhisper(user: User, whisperId: string, dto: ReplyWhisperDto) {
    const { data: whisper } = await this.supabase.admin
      .from('whispers')
      .select('recipient_id')
      .eq('id', whisperId)
      .single();

    if (!whisper) throw new NotFoundException('Whisper not found');
    if (whisper.recipient_id !== user.id) {
      throw new ForbiddenException('You can only reply to your own whispers');
    }

    const { data: updated, error } = await this.supabase.admin
      .from('whispers')
      .update({
        reply_content: dto.replyContent,
        replied_at: new Date().toISOString(),
      })
      .eq('id', whisperId)
      .select('id, recipient_id, content, reply_content, replied_at, created_at')
      .single();

    if (error) throw new InternalServerErrorException('Failed to reply to whisper');

    return updated;
  }

  async deleteWhisper(user: User, whisperId: string) {
    const { data: whisper } = await this.supabase.admin
      .from('whispers')
      .select('recipient_id')
      .eq('id', whisperId)
      .single();

    if (!whisper) throw new NotFoundException('Whisper not found');
    if (whisper.recipient_id !== user.id) {
      throw new ForbiddenException('You can only delete your own whispers');
    }

    await this.supabase.admin.from('whispers').delete().eq('id', whisperId);
    return { message: 'Whisper deleted' };
  }

  async shareWhisperAsPost(user: User, whisperId: string) {
    const { data: whisper } = await this.supabase.admin
      .from('whispers')
      .select('*')
      .eq('id', whisperId)
      .single();

    if (!whisper) throw new NotFoundException('Whisper not found');
    if (whisper.recipient_id !== user.id) {
      throw new ForbiddenException('You can only share your own whispers');
    }

    const postContent = `Anonymous Whisper:\n"${whisper.content}"\n\nReply: ${whisper.reply_content || ''}`;

    const { data: post, error } = await this.supabase.admin
      .from('posts')
      .insert({
        author_id: user.id,
        content: postContent,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException('Failed to share whisper as post');

    return post;
  }
}
