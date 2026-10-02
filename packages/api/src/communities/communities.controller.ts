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
import { CommunitiesService } from './communities.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateCommunityDto } from './dto/create-community.dto';
import type { User } from '@supabase/supabase-js';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  /**
   * POST /api/communities
   * Create a new topic community
   */
  @Post()
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  createCommunity(@CurrentUser() user: User, @Body() dto: CreateCommunityDto) {
    return this.communitiesService.createCommunity(user, dto);
  }

  /**
   * GET /api/communities
   * List all communities
   */
  @Get()
  getCommunities() {
    return this.communitiesService.getCommunities();
  }

  /**
   * GET /api/communities/:slug
   * Get community details by slug
   */
  @Get(':slug')
  getCommunityBySlug(@Param('slug') slug: string) {
    return this.communitiesService.getCommunityBySlug(slug);
  }

  /**
   * POST /api/communities/:id/join
   * Join a community
   */
  @Post(':id/join')
  @UseGuards(SupabaseAuthGuard)
  joinCommunity(@CurrentUser() user: User, @Param('id') id: string) {
    return this.communitiesService.joinCommunity(user, id);
  }

  /**
   * DELETE /api/communities/:id/join
   * Leave a community
   */
  @Delete(':id/join')
  @UseGuards(SupabaseAuthGuard)
  leaveCommunity(@CurrentUser() user: User, @Param('id') id: string) {
    return this.communitiesService.leaveCommunity(user, id);
  }

  /**
   * GET /api/communities/:id/posts
   * Get community feed posts
   */
  @Get(':id/posts')
  getCommunityFeed(@Param('id') id: string) {
    return this.communitiesService.getCommunityFeed(id);
  }
}
