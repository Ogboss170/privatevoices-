import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import type { User } from '@supabase/supabase-js';

@Injectable()
export class CommunitiesService {
  constructor(private supabase: SupabaseService) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
  }

  async createCommunity(user: User, dto: CreateCommunityDto) {
    const slug = this.slugify(dto.name);

    const { data: created, error } = await this.supabase.admin
      .from('communities')
      .insert({
        name: dto.name,
        slug,
        description: dto.description ?? null,
        avatar_url: dto.avatarUrl ?? null,
        banner_url: dto.bannerUrl ?? null,
        creator_id: user.id,
      })
      .select('*, creator:profiles(id, username, display_name, avatar_url)')
      .single();

    if (error || !created) {
      if (error?.code === '23505') {
        throw new ForbiddenException('A community with this name already exists');
      }
      throw new InternalServerErrorException('Failed to create community');
    }

    // Auto-add creator as owner
    await this.supabase.admin.from('community_members').insert({
      community_id: created.id,
      user_id: user.id,
      role: 'owner',
    });

    return created;
  }

  async getCommunities(currentUserId?: string) {
    const { data: communities, error } = await this.supabase.admin
      .from('communities')
      .select('*, creator:profiles(id, username, display_name, avatar_url)')
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch communities');

    let joinedIds: string[] = [];
    if (currentUserId) {
      const { data: memberships } = await this.supabase.admin
        .from('community_members')
        .select('community_id')
        .eq('user_id', currentUserId);

      joinedIds = (memberships ?? []).map((m) => m.community_id);
    }

    return (communities ?? []).map((comm) => ({
      ...comm,
      isJoined: joinedIds.includes(comm.id),
    }));
  }

  async getCommunityBySlug(slug: string, currentUserId?: string) {
    const { data: community, error } = await this.supabase.admin
      .from('communities')
      .select('*, creator:profiles(id, username, display_name, avatar_url)')
      .ilike('slug', slug)
      .single();

    if (error || !community) throw new NotFoundException('Community not found');

    const [{ count: memberCount }, { count: postCount }] = await Promise.all([
      this.supabase.admin.from('community_members').select('*', { count: 'exact', head: true }).eq('community_id', community.id),
      this.supabase.admin.from('posts').select('*', { count: 'exact', head: true }).eq('community_id', community.id),
    ]);

    let isJoined = false;
    let role = null;

    if (currentUserId) {
      const { data: membership } = await this.supabase.admin
        .from('community_members')
        .select('role')
        .match({ community_id: community.id, user_id: currentUserId })
        .maybeSingle();

      if (membership) {
        isJoined = true;
        role = membership.role;
      }
    }

    return {
      ...community,
      memberCount: memberCount ?? 0,
      postCount: postCount ?? 0,
      isJoined,
      role,
    };
  }

  async joinCommunity(user: User, communityId: string) {
    const { error } = await this.supabase.admin
      .from('community_members')
      .insert({
        community_id: communityId,
        user_id: user.id,
        role: 'member',
      });

    if (error && error.code !== '23505') {
      throw new InternalServerErrorException('Failed to join community');
    }
    return { message: 'Joined community successfully' };
  }

  async leaveCommunity(user: User, communityId: string) {
    await this.supabase.admin
      .from('community_members')
      .delete()
      .match({ community_id: communityId, user_id: user.id });

    return { message: 'Left community successfully' };
  }

  async getCommunityFeed(communityId: string) {
    const { data: posts, error } = await this.supabase.admin
      .from('posts')
      .select('*, author:profiles(id, username, display_name, avatar_url)')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch community posts');
    return posts ?? [];
  }
}
