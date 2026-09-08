import { Body, Controller, Post } from '@nestjs/common';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';

import type { ChatRequest, ChatResponse } from '@shared/api.interface';

import { ChatService } from './chat.service';

@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @NeedLogin()
  @Post('completions')
  async createCompletion(@Body() request: ChatRequest): Promise<ChatResponse> {
    return this.chatService.createCompletion(request);
  }
}
