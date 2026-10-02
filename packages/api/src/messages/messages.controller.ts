import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { StartConversationDto } from './dto/start-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import type { User } from '@supabase/supabase-js';

@Controller('messages')
@UseGuards(SupabaseAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * POST /api/messages/conversations
   * Start or get existing conversation with a user by username
   */
  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  startConversation(
    @CurrentUser() user: User,
    @Body() dto: StartConversationDto,
  ) {
    return this.messagesService.startConversation(user, dto);
  }

  /**
   * GET /api/messages/conversations
   * List all conversations for current user
   */
  @Get('conversations')
  getMyConversations(@CurrentUser() user: User) {
    return this.messagesService.getMyConversations(user);
  }

  /**
   * POST /api/messages/send
   * Send a direct message
   */
  @Post('send')
  @HttpCode(HttpStatus.CREATED)
  sendMessage(@CurrentUser() user: User, @Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(user, dto);
  }

  /**
   * GET /api/messages/conversations/:id
   * Get all messages in a conversation
   */
  @Get('conversations/:id')
  getMessages(@CurrentUser() user: User, @Param('id') id: string) {
    return this.messagesService.getMessages(user, id);
  }
}
