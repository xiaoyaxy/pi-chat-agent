import { Body, Controller, Post } from '@nestjs/common';

import type { ChatRequest, ChatResponse } from '@shared/api.interface';

import { ChatService } from './chat.service';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('completions')
  async createCompletion(@Body() request: ChatRequest): Promise<ChatResponse> {
    return this.chatService.createCompletion(request);
  }
}
