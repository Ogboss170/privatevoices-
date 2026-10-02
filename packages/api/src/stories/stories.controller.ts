import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StoriesService } from './stories.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateStoryDto } from './dto/create-story.dto';
import type { User } from '@supabase/supabase-js';

@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  /**
   * POST /api/stories
   * Post a 24-hour temporary text/image story
   */
  @Post()
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  createStory(@CurrentUser() user: User, @Body() dto: CreateStoryDto) {
    return this.storiesService.createStory(user, dto);
  }

  /**
   * GET /api/stories/feed
   * Get active unexpired stories grouped by author
   */
  @Get('feed')
  getActiveStoriesFeed() {
    return this.storiesService.getActiveStoriesFeed(null);
  }

  /**
   * POST /api/stories/:id/view
   * Record a story view
   */
  @Post(':id/view')
  @UseGuards(SupabaseAuthGuard)
  recordStoryView(@CurrentUser() user: User, @Param('id') id: string) {
    return this.storiesService.recordStoryView(user, id);
  }

  /**
   * GET /api/stories/:id/viewers
   * Get list of users who viewed author's story
   */
  @Get(':id/viewers')
  @UseGuards(SupabaseAuthGuard)
  getStoryViewers(@CurrentUser() user: User, @Param('id') id: string) {
    return this.storiesService.getStoryViewers(user, id);
  }

  /**
   * DELETE /api/stories/:id
   * Delete own story
   */
  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  deleteStory(@CurrentUser() user: User, @Param('id') id: string) {
    return this.storiesService.deleteStory(user, id);
  }
}
