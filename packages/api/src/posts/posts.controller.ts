import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReportContentDto } from './dto/report-content.dto';
import type { User } from '@supabase/supabase-js';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * POST /api/posts
   * Create a new text/image post.
   */
  @Post()
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  createPost(@CurrentUser() user: User, @Body() dto: CreatePostDto) {
    return this.postsService.createPost(user, dto);
  }

  /**
   * GET /api/posts/feed?type=for-you|following|trending|latest&page=1&limit=20
   * Fetch social feed.
   */
  @Get('feed')
  getFeed(
    @Query('type') type = 'for-you',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.postsService.getFeed(null, type, parseInt(page, 10), parseInt(limit, 10));
  }

  /**
   * GET /api/posts/:id
   * Get single post by ID.
   */
  @Get(':id')
  getPost(@Param('id') id: string) {
    return this.postsService.getPostById(id);
  }

  /**
   * GET /api/posts/:id/analytics
   * Get private post analytics & insights. Strictly accessible only by post author.
   * Returns 403 Forbidden if currentUser is not author.
   */
  @Get(':id/analytics')
  @UseGuards(SupabaseAuthGuard)
  getAnalytics(@CurrentUser() user: User, @Param('id') id: string) {
    return this.postsService.getPostAnalytics(user, id);
  }

  /**
   * DELETE /api/posts/:id
   * Delete own post.
   */
  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  deletePost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.postsService.deletePost(user, id);
  }

  /**
   * POST /api/posts/:id/like
   * Like a post.
   */
  @Post(':id/like')
  @UseGuards(SupabaseAuthGuard)
  likePost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.postsService.likePost(user, id);
  }

  /**
   * DELETE /api/posts/:id/like
   * Unlike a post.
   */
  @Delete(':id/like')
  @UseGuards(SupabaseAuthGuard)
  unlikePost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.postsService.unlikePost(user, id);
  }

  /**
   * POST /api/posts/:id/save
   * Bookmark a post.
   */
  @Post(':id/save')
  @UseGuards(SupabaseAuthGuard)
  savePost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.postsService.savePost(user, id);
  }

  /**
   * DELETE /api/posts/:id/save
   * Unbookmark a post.
   */
  @Delete(':id/save')
  @UseGuards(SupabaseAuthGuard)
  unsavePost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.postsService.unsavePost(user, id);
  }

  /**
   * POST /api/posts/:id/comments
   * Add a comment to a post.
   */
  @Post(':id/comments')
  @UseGuards(SupabaseAuthGuard)
  addComment(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.postsService.addComment(user, id, dto);
  }

  /**
   * GET /api/posts/:id/comments
   * Get comments for a post.
   */
  @Get(':id/comments')
  getComments(@Param('id') id: string) {
    return this.postsService.getComments(id);
  }

  /**
   * POST /api/posts/report
   * Report content (post/comment/profile).
   */
  @Post('report')
  @UseGuards(SupabaseAuthGuard)
  reportContent(@CurrentUser() user: User, @Body() dto: ReportContentDto) {
    return this.postsService.reportContent(user, dto);
  }
}
