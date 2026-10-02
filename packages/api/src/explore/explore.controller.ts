import { Controller, Get, Query } from '@nestjs/common';
import { ExploreService } from './explore.service';

@Controller('explore')
export class ExploreController {
  constructor(private readonly exploreService: ExploreService) {}

  /**
   * GET /api/explore/search?q=query
   * Global discovery search across people, posts, hashtags, and communities
   */
  @Get('search')
  globalSearch(@Query('q') query: string) {
    return this.exploreService.globalSearch(query);
  }

  /**
   * GET /api/explore/hashtags/trending
   * Get top trending hashtags
   */
  @Get('hashtags/trending')
  getTrendingHashtags() {
    return this.exploreService.getTrendingHashtags();
  }

  /**
   * GET /api/explore/people/recommended
   * Get recommended people
   */
  @Get('people/recommended')
  getRecommendedPeople() {
    return this.exploreService.getRecommendedPeople(null);
  }

  /**
   * GET /api/explore/communities/recommended
   * Get recommended communities
   */
  @Get('communities/recommended')
  getRecommendedCommunities() {
    return this.exploreService.getRecommendedCommunities();
  }
}
