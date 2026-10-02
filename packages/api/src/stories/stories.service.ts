import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateStoryDto } from './dto/create-story.dto';
import type { User } from '@supabase/supabase-js';

@Injectable()
export class StoriesService {
  constructor(private supabase: SupabaseService) {}

  async createStory(user: User, dto: CreateStoryDto) {
    const { data: story, error } = await this.supabase.admin
      .from('stories')
      .insert({
        author_id: user.id,
        content: dto.content ?? null,
        image_url: dto.imageUrl ?? null,
        media_type: dto.mediaType ?? (dto.imageUrl ? 'image' : 'text'),
        visibility: dto.visibility ?? 'everyone',
      })
      .select('*, author:profiles(id, username, display_name, avatar_url)')
      .single();

    if (error || !story) throw new InternalServerErrorException('Failed to create story');

    return story;
  }

  async getActiveStoriesFeed(user: User | null) {
    const now = new Date().toISOString();

    const { data: stories, error } = await this.supabase.admin
      .from('stories')
      .select('*, author:profiles(id, username, display_name, avatar_url)')
      .gt('expires_at', now)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch stories');

    // Group stories by author
    const authorMap = new Map<string, { author: any; stories: any[] }>();

    for (const story of stories ?? []) {
      const authorId = story.author_id;
      if (!authorMap.has(authorId)) {
        authorMap.set(authorId, {
          author: story.author,
          stories: [],
        });
      }
      authorMap.get(authorId)!.stories.push(story);
    }

    return Array.from(authorMap.values());
  }

  async recordStoryView(user: User, storyId: string) {
    const { data: story } = await this.supabase.admin
      .from('stories')
      .select('id, expires_at')
      .eq('id', storyId)
      .single();

    if (!story) throw new NotFoundException('Story not found');

    const { error } = await this.supabase.admin
      .from('story_views')
      .insert({ story_id: storyId, viewer_id: user.id });

    if (error && error.code !== '23505') {
      throw new InternalServerErrorException('Failed to record story view');
    }

    return { message: 'View recorded' };
  }

  async getStoryViewers(user: User, storyId: string) {
    const { data: story } = await this.supabase.admin
      .from('stories')
      .select('author_id')
      .eq('id', storyId)
      .single();

    if (!story) throw new NotFoundException('Story not found');
    if (story.author_id !== user.id) {
      throw new ForbiddenException('Only the story author can view viewers');
    }

    const { data: views, error } = await this.supabase.admin
      .from('story_views')
      .select('*, viewer:profiles(id, username, display_name, avatar_url)')
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to fetch story viewers');

    return (views ?? []).map((v) => ({
      viewer: v.viewer,
      viewedAt: v.viewed_at,
    }));
  }

  async deleteStory(user: User, storyId: string) {
    const { data: story } = await this.supabase.admin
      .from('stories')
      .select('author_id')
      .eq('id', storyId)
      .single();

    if (!story) throw new NotFoundException('Story not found');
    if (story.author_id !== user.id) {
      throw new ForbiddenException('You can only delete your own story');
    }

    await this.supabase.admin.from('stories').delete().eq('id', storyId);
    return { message: 'Story deleted' };
  }
}
