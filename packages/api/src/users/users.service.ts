import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { User } from '@supabase/supabase-js';

@Injectable()
export class UsersService {
  constructor(private supabase: SupabaseService) {}

  async getProfileByUsername(username: string) {
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url, is_private, created_at')
      .ilike('username', username)
      .single();

    if (error || !data) throw new NotFoundException(`User @${username} not found`);

    const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
      this.supabase.admin
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', data.id),
      this.supabase.admin
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', data.id),
    ]);

    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      bio: data.bio,
      avatarUrl: data.avatar_url,
      isPrivate: data.is_private,
      followerCount: followerCount ?? 0,
      followingCount: followingCount ?? 0,
      postCount: 0,
    };
  }

  async getMe(user: User) {
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select('*, privacy_settings(*)')
      .eq('id', user.id)
      .single();

    if (error || !data) throw new NotFoundException('Profile not found');
    return data;
  }

  async updateProfile(user: User, dto: UpdateProfileDto) {
    const updates: Record<string, unknown> = {};
    if (dto.displayName !== undefined) updates['display_name'] = dto.displayName;
    if (dto.bio !== undefined) updates['bio'] = dto.bio;
    if (dto.isPrivate !== undefined) updates['is_private'] = dto.isPrivate;

    const { data, error } = await this.supabase.admin
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw new ConflictException(error.message);
    return data;
  }

  async getUsernameCooldown(user: User) {
    const { data, error } = await this.supabase.admin.rpc('get_username_cooldown_status', {
      p_user_id: user.id,
    });

    if (error) throw new ConflictException(error.message);
    return data;
  }

  async changeUsername(user: User, newUsername: string) {
    const { data, error } = await this.supabase.admin.rpc('change_username', {
      p_user_id: user.id,
      p_new_username: newUsername,
    });

    if (error) throw new ConflictException(error.message);
    if (!data?.success) {
      throw new ConflictException(data?.message || 'Failed to change username');
    }

    return data;
  }

  async followUser(follower: User, targetUsername: string) {
    const target = await this.getProfileByUsername(targetUsername);

    if (target.id === follower.id) {
      throw new ForbiddenException('You cannot follow yourself');
    }

    const { error } = await this.supabase.admin
      .from('follows')
      .insert({ follower_id: follower.id, following_id: target.id });

    if (error?.code === '23505') {
      throw new ConflictException('You are already following this user');
    }
    if (error) throw new ConflictException(error.message);

    return { message: `Now following @${target.username}` };
  }

  async unfollowUser(follower: User, targetUsername: string) {
    const target = await this.getProfileByUsername(targetUsername);

    await this.supabase.admin
      .from('follows')
      .delete()
      .match({ follower_id: follower.id, following_id: target.id });

    return { message: `Unfollowed @${target.username}` };
  }

  async getPrivacySettings(user: User) {
    const { data, error } = await this.supabase.admin
      .from('privacy_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error || !data) throw new NotFoundException('Privacy settings not found');
    return data;
  }

  async updatePrivacySettings(user: User, settings: Record<string, unknown>) {
    const { data, error } = await this.supabase.admin
      .from('privacy_settings')
      .update(settings)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw new ConflictException(error.message);
    return data;
  }
}
