import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WhispersService } from './whispers.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SendWhisperDto } from './dto/send-whisper.dto';
import { ReplyWhisperDto } from './dto/reply-whisper.dto';
import type { User } from '@supabase/supabase-js';

@Controller('whispers')
export class WhispersController {
  constructor(private readonly whispersService: WhispersService) {}

  /**
   * GET /api/whispers/profile/:username
   * Fetch public recipient profile and whisper settings for anonymous submission page
   */
  @Get('profile/:username')
  getRecipientProfile(@Param('username') username: string) {
    return this.whispersService.getRecipientProfile(username);
  }

  /**
   * POST /api/whispers/send
   * Send an anonymous whisper to a user
   */
  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  sendWhisper(@Body() dto: SendWhisperDto, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    return this.whispersService.sendWhisper(dto, String(ip));
  }

  /**
   * POST /api/whispers/:username
   * Send an anonymous whisper directly to username (e.g., from /w/@username public route)
   */
  @Post(':username')
  @HttpCode(HttpStatus.CREATED)
  sendWhisperToUser(
    @Param('username') username: string,
    @Body() body: { content: string; senderSessionHash?: string },
    @Req() req: any,
  ) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    return this.whispersService.sendWhisper(
      {
        recipientUsername: username,
        content: body.content,
        senderSessionHash: body.senderSessionHash,
      },
      String(ip),
    );
  }

  /**
   * GET /api/whispers (and /api/whispers/inbox)
   * Fetch all anonymous whispers received by current user
   */
  @Get()
  @UseGuards(SupabaseAuthGuard)
  getMyWhispersRoot(@CurrentUser() user: User) {
    return this.whispersService.getMyWhispers(user);
  }

  @Get('inbox')
  @UseGuards(SupabaseAuthGuard)
  getMyWhispers(@CurrentUser() user: User) {
    return this.whispersService.getMyWhispers(user);
  }

  /**
   * PATCH /api/whispers/:id/read
   * Mark a whisper as read
   */
  @Patch(':id/read')
  @UseGuards(SupabaseAuthGuard)
  markAsRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.whispersService.markAsRead(user, id);
  }

  /**
   * POST /api/whispers/:id/report
   * Report an abusive whisper
   */
  @Post(':id/report')
  @UseGuards(SupabaseAuthGuard)
  reportWhisper(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.whispersService.reportWhisper(user, id, body.reason);
  }

  /**
   * POST /api/whispers/:id/reply
   * Reply to a whisper
   */
  @Post(':id/reply')
  @UseGuards(SupabaseAuthGuard)
  replyToWhisper(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ReplyWhisperDto,
  ) {
    return this.whispersService.replyToWhisper(user, id, dto);
  }

  /**
   * DELETE /api/whispers/:id
   * Delete a received whisper
   */
  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  deleteWhisper(@CurrentUser() user: User, @Param('id') id: string) {
    return this.whispersService.deleteWhisper(user, id);
  }

  /**
   * POST /api/whispers/:id/share
   * Share whisper + reply as a public feed post
   */
  @Post(':id/share')
  @UseGuards(SupabaseAuthGuard)
  shareWhisperAsPost(@CurrentUser() user: User, @Param('id') id: string) {
    return this.whispersService.shareWhisperAsPost(user, id);
  }
}
