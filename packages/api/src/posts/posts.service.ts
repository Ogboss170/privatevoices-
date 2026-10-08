import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReportContentDto } from './dto/report-content.dto';
import type { User } from '@supabase/supabase-js';

@Injectable()
export class PostsService {
  constructor(private supabase: SupabaseService) {}

  private extractHashtags(text: string): string[] {
    const matches = text.match(/#[a-zA-Z0-9_]+/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map((h) => h.slice(1).toLowerCase())));
  }

  async createPost(user: User, dto: CreatePostDto) {
    const hashtags = this.extractHashtags(dto.content);

    const { data: post, error } = await this.supabase.admin
      .from('posts')
      .insert({
        author_id: user.id,
        content: dto.content,
        image_urls: dto.imageUrls ?? [],
      })
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
      .single();

    if (error || !post) {
      throw new InternalServerErrorException('Failed to create post');
    }

    // Process hashtags
    if (hashtags.length > 0) {
      for (const tag of hashtags) {
        const { data: tagRow } = await this.supabase.admin
          .from('hashtags')
          .upsert({ name: tag }, { onConflict: 'name' })
          .select('id')
          .single();

        if (tagRow) {
          await this.supabase.admin.from('post_hashtags').insert({
            post_id: post.id,
            hashtag_id: tagRow.id,
          });
        }
      }
    }

    return this.formatPost(post, user.id);
  }

  async getFeed(user: User | null, feedType: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    let query = this.supabase.admin
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)', { count: 'exact' });

    if (feedType === 'following' && user) {
      const { data: following } = await this.supabase.admin
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = (following ?? []).map((f) => f.following_id);
      followingIds.push(user.id); // Include user's own posts

      query = query.in('author_id', followingIds).order('created_at', { ascending: false });
    } else if (feedType === 'latest') {
      query = query.order('created_at', { ascending: false });
    } else {
      // for-you / trending default order
      query = query.order('created_at', { ascending: false });
    }

    const { data: posts, count, error } = await query.range(offset, offset + limit - 1);

    if (error) throw new InternalServerErrorException('Failed to fetch feed');

    const formattedPosts = await Promise.all(
      (posts ?? []).map((post) => this.formatPost(post, user?.id)),
    );

    return {
      data: formattedPosts,
      total: count ?? 0,
      page,
      pageSize: limit,
      hasMore: offset + (posts?.length ?? 0) < (count ?? 0),
    };
  }

  async getPostById(postId: string, currentUserId?: string) {
    const { data: post, error } = await this.supabase.admin
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
      .eq('id', postId)
      .single();

    if (error || !post) throw new NotFoundException('Post not found');
    return this.formatPost(post, currentUserId);
  }

  /**
   * GET /posts/:postId/analytics
   * Authenticate user -> Check post.author_id === currentUser.id
   * YES -> return analytics
   * NO  -> 403 Forbidden
   */
  async getPostAnalytics(user: User, postId: string) {
    const { data: post, error } = await this.supabase.admin
      .from('posts')
      .select('id, author_id, created_at')
      .eq('id', postId)
      .single();

    if (error || !post) {
      throw new NotFoundException('Post not found');
    }

    if (post.author_id !== user.id) {
      throw new ForbiddenException('Access denied. Post Analytics & Insights are private to the post author.');
    }

    // 1. Fetch counts
    const [
      { count: likeCount },
      { count: commentCount },
      { count: repostCount },
      { count: saveCount },
      { count: uniqueViewersCount },
      { data: vCountData },
    ] = await Promise.all([
      this.supabase.admin.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      this.supabase.admin.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      this.supabase.admin.from('reposts').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      this.supabase.admin.from('saved_posts').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      this.supabase.admin.from('post_views').select('viewer_id', { count: 'exact', head: true }).eq('post_id', postId),
      this.supabase.admin.rpc('get_post_view_count', { p_post_id: postId }),
    ]);

    const views = typeof vCountData === 'number' ? vCountData : (uniqueViewersCount ?? 0);
    const uniqueViewers = uniqueViewersCount ?? 0;
    const likes = likeCount ?? 0;
    const comments = commentCount ?? 0;
    const reposts = repostCount ?? 0;
    const bookmarks = saveCount ?? 0;
    const shares = 0; // estimated or tracked shares
    const totalEngagement = likes + comments + reposts + bookmarks;
    const engagementRate = views > 0 ? Number(((totalEngagement / views) * 100).toFixed(1)) : 0;

    // 2. Fetch author-only recent viewers
    const { data: viewers } = await this.supabase.admin
      .from('post_views')
      .select('viewed_at, viewer:profiles!post_views_viewer_id_fkey(id, username, display_name, avatar_url)')
      .eq('post_id', postId)
      .order('viewed_at', { ascending: false })
      .limit(50);

    return {
      postId,
      views,
      uniqueViewers,
      likes,
      comments,
      reposts,
      bookmarks,
      shares,
      engagementRate,
      viewers: viewers ?? [],
    };
  }

  async deletePost(user: User, postId: string) {
    const { data: post } = await this.supabase.admin
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single();

    if (!post) throw new NotFoundException('Post not found');
    if (post.author_id !== user.id) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.supabase.admin.from('posts').delete().eq('id', postId);
    return { message: 'Post deleted successfully' };
  }

  async likePost(user: User, postId: string) {
    const { error } = await this.supabase.admin
      .from('likes')
      .insert({ user_id: user.id, post_id: postId });

    if (error && error.code !== '23505') {
      throw new InternalServerErrorException('Failed to like post');
    }
    return { message: 'Post liked' };
  }

  async unlikePost(user: User, postId: string) {
    await this.supabase.admin
      .from('likes')
      .delete()
      .match({ user_id: user.id, post_id: postId });

    return { message: 'Post unliked' };
  }

  async savePost(user: User, postId: string) {
    const { error } = await this.supabase.admin
      .from('saved_posts')
      .insert({ user_id: user.id, post_id: postId });

    if (error && error.code !== '23505') {
      throw new InternalServerErrorException('Failed to save post');
    }
    return { message: 'Post saved' };
  }

  async unsavePost(user: User, postId: string) {
    await this.supabase.admin
      .from('saved_posts')
      .delete()
      .match({ user_id: user.id, post_id: postId });

    return { message: 'Post unsaved' };
  }

  async addComment(user: User, postId: string, dto: CreateCommentDto) {
    const { data: comment, error } = await this.supabase.admin
      .from('comments')
      .insert({
        post_id: postId,
        author_id: user.id,
        content: dto.content,
      })
      .select('*, author:profiles(id, username, display_name, avatar_url)')
      .single();

    if (error || !comment) throw new InternalServerErrorException('Failed to add comment');

    return {
      id: comment.id,
      postId: comment.post_id,
      authorId: comment.author_id,
      author: {
        id: comment.author.id,
        username: comment.author.username,
        displayName: comment.author.display_name,
        avatarUrl: comment.author.avatar_url,
      },
      content: comment.content,
      createdAt: comment.created_at,
    };
  }

  async getComments(postId: string) {
    const { data: comments, error } = await this.supabase.admin
      .from('comments')
      .select('*, author:profiles(id, username, display_name, avatar_url)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to fetch comments');

    return (comments ?? []).map((comment) => ({
      id: comment.id,
      postId: comment.post_id,
      authorId: comment.author_id,
      author: {
        id: comment.author.id,
        username: comment.author.username,
        displayName: comment.author.display_name,
        avatarUrl: comment.author.avatar_url,
      },
      content: comment.content,
      createdAt: comment.created_at,
    }));
  }

  async reportContent(user: User, dto: ReportContentDto) {
    const { error } = await this.supabase.admin
      .from('content_reports')
      .insert({
        reporter_id: user.id,
        target_type: dto.targetType,
        target_id: dto.targetId,
        reason: dto.reason,
        details: dto.details ?? null,
      });

    if (error) throw new InternalServerErrorException('Failed to submit report');
    return { message: 'Report submitted successfully. Thank you for keeping Private Voices safe.' };
  }

  private async formatPost(post: any, currentUserId?: string) {
    const [{ count: likeCount }, { count: commentCount }, { count: repostCount }] = await Promise.all([
      this.supabase.admin.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
      this.supabase.admin.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
      this.supabase.admin.from('reposts').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
    ]);

    let isLikedByMe = false;
    let isSavedByMe = false;
    let isRepostedByMe = false;

    if (currentUserId) {
      const [{ data: like }, { data: save }, { data: repost }] = await Promise.all([
        this.supabase.admin.from('likes').select('user_id').match({ user_id: currentUserId, post_id: post.id }).maybeSingle(),
        this.supabase.admin.from('saved_posts').select('user_id').match({ user_id: currentUserId, post_id: post.id }).maybeSingle(),
        this.supabase.admin.from('reposts').select('user_id').match({ user_id: currentUserId, post_id: post.id }).maybeSingle(),
      ]);
      isLikedByMe = !!like;
      isSavedByMe = !!save;
      isRepostedByMe = !!repost;
    }

    const hashtags = this.extractHashtags(post.content);

    return {
      id: post.id,
      authorId: post.author_id,
      author: {
        id: post.author.id,
        username: post.author.username,
        displayName: post.author.display_name,
        avatarUrl: post.author.avatar_url,
      },
      content: post.content,
      imageUrls: post.image_urls ?? [],
      hashtags,
      likeCount: likeCount ?? 0,
      commentCount: commentCount ?? 0,
      repostCount: repostCount ?? 0,
      isLikedByMe,
      isSavedByMe,
      isRepostedByMe,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
    };
  }
}
