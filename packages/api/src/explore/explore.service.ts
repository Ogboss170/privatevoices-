import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { User } from '@supabase/supabase-js';

@Injectable()
export class ExploreService {
  constructor(private supabase: SupabaseService) {}

  async globalSearch(query: string) {
    if (!query || !query.trim()) {
      return { profiles: [], communities: [], hashtags: [], posts: [] };
    }

    const term = query.trim();

    const [{ data: profiles }, { data: communities }, { data: hashtags }, { data: posts }] =
      await Promise.all([
        this.supabase.admin
          .from('profiles')
          .select('id, username, display_name, bio, avatar_url')
          .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
          .limit(10),
        this.supabase.admin
          .from('communities')
          .select('*')
          .or(`name.ilike.%${term}%,description.ilike.%${term}%`)
          .limit(10),
        this.supabase.admin
          .from('hashtags')
          .select('*')
          .ilike('name', `%${term}%`)
          .limit(10),
        this.supabase.admin
          .from('posts')
          .select('*, author:profiles(id, username, display_name, avatar_url)')
          .ilike('content', `%${term}%`)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

    return {
      profiles: profiles ?? [],
      communities: communities ?? [],
      hashtags: hashtags ?? [],
      posts: posts ?? [],
    };
  }

  async getTrendingHashtags() {
    const { data: hashtags, error } = await this.supabase.admin
      .from('hashtags')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw new InternalServerErrorException('Failed to fetch trending hashtags');
    return hashtags ?? [];
  }

  async getRecommendedPeople(user: User | null) {
    let query = this.supabase.admin
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url, is_private')
      .limit(10);

    if (user) {
      query = query.neq('id', user.id);
    }

    const { data: profiles, error } = await query;
    if (error) throw new InternalServerErrorException('Failed to fetch recommendations');
    return profiles ?? [];
  }

  async getRecommendedCommunities() {
    const { data: communities, error } = await this.supabase.admin
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) throw new InternalServerErrorException('Failed to fetch recommended communities');
    return communities ?? [];
  }
}
