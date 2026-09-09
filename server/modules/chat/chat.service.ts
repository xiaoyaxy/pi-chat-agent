import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { AssistantMessage, Model, Usage } from '@earendil-works/pi-ai';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
} from '@shared/api.interface';

import { loadPiRuntime } from './pi-runtime';

const MAX_HISTORY_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_SYSTEM_PROMPT_LENGTH = 4_000;
const MAX_MODEL_LENGTH = 160;
const MAX_API_KEY_LENGTH = 512;
const MAX_BASE_URL_LENGTH = 512;

const EMPTY_USAGE: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  async createCompletion(request: ChatRequest): Promise<ChatResponse> {
    this.validateRequest(request);

    const baseUrl = this.normalizeBaseUrl(request.baseUrl);
    const model: Model<'openai-completions'> = this.createModel(
      request.model,
      baseUrl,
    );
    const history: AgentMessage[] = this.toAgentMessages(
      request.messages.slice(-MAX_HISTORY_MESSAGES),
      model,
    );
    const piRuntime = loadPiRuntime();

    const provider = piRuntime.createProvider({
      id: 'openai-compatible',
      name: 'OpenAI-compatible',
      baseUrl,
      auth: {
        apiKey: {
          name: 'API key',
          resolve: async () => ({ auth: {} }),
        },
      },
      models: [model],
      api: piRuntime.openAICompletionsApi(),
    });
    const models = piRuntime.createModels();
    models.setProvider(provider);

    const agent = new piRuntime.Agent({
      initialState: {
        systemPrompt: request.systemPrompt.trim(),
        model,
        thinkingLevel: 'off',
        tools: [],
        messages: history,
      },
      streamFn: models.streamSimple.bind(models),
      getApiKey: () => request.apiKey.trim(),
    });

    this.logger.log(
      `Starting Pi turn with model=${request.model}, history=${history.length}`,
    );
    await agent.prompt(request.prompt.trim());

    const assistantMessage = this.findLastAssistantMessage(
      agent.state.messages,
    );
    if (!assistantMessage || assistantMessage.stopReason === 'error') {
      const providerError =
        assistantMessage?.errorMessage ?? agent.state.errorMessage;
      this.logger.warn(
        `Pi turn failed for model=${request.model}: ${providerError ?? 'unknown error'}`,
      );
      throw new BadGatewayException(
        '模型调用失败，请检查 API Key 、模型 ID 和账户额度。',
      );
    }

    const content = assistantMessage.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    if (!content) {
      throw new BadGatewayException('模型未返回文本内容。');
    }

    return {
      message: {
        id: crypto.randomUUID(),
        role: 'assistant',
        content,
      },
      model: assistantMessage.responseModel ?? assistantMessage.model,
      usage: {
        inputTokens: assistantMessage.usage.input,
        outputTokens: assistantMessage.usage.output,
        totalTokens: assistantMessage.usage.totalTokens,
      },
    };
  }

  private createModel(
    modelId: string,
    baseUrl: string,
  ): Model<'openai-completions'> {
    const trimmedModelId = modelId.trim();

    return {
      id: trimmedModelId,
      name: trimmedModelId,
      api: 'openai-completions',
      provider: 'openai-compatible',
      baseUrl,
      reasoning: false,
      input: ['text'],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
      contextWindow: 128_000,
      maxTokens: 4_096,
    };
  }

  private toAgentMessages(
    messages: ChatMessage[],
    model: Model<'openai-completions'>,
  ): AgentMessage[] {
    return messages.map((message: ChatMessage): AgentMessage => {
      if (message.role === 'user') {
        return {
          role: 'user',
          content: message.content,
          timestamp: Date.now(),
        };
      }

      return {
        role: 'assistant',
        content: [{ type: 'text', text: message.content }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: EMPTY_USAGE,
        stopReason: 'stop',
        timestamp: Date.now(),
      };
    });
  }

  private findLastAssistantMessage(
    messages: AgentMessage[],
  ): AssistantMessage | undefined {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role === 'assistant') {
        return message;
      }
    }

    return undefined;
  }

  private validateRequest(request: ChatRequest): void {
    if (!request || typeof request !== 'object') {
      throw new BadRequestException('请求体无效。');
    }
    if (
      typeof request.baseUrl !== 'string' ||
      request.baseUrl.trim().length === 0 ||
      request.baseUrl.length > MAX_BASE_URL_LENGTH
    ) {
      throw new BadRequestException('请填写有效的 Base URL。');
    }
    if (
      typeof request.apiKey !== 'string' ||
      request.apiKey.trim().length === 0 ||
      request.apiKey.length > MAX_API_KEY_LENGTH
    ) {
      throw new BadRequestException('请填写有效的 API Key。');
    }
    if (
      typeof request.model !== 'string' ||
      request.model.trim().length === 0 ||
      request.model.length > MAX_MODEL_LENGTH ||
      !/^[a-zA-Z0-9_~./:-]+$/u.test(request.model.trim())
    ) {
      throw new BadRequestException('模型 ID 无效。');
    }
    if (
      typeof request.systemPrompt !== 'string' ||
      request.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH
    ) {
      throw new BadRequestException('系统提示词过长。');
    }
    if (
      typeof request.prompt !== 'string' ||
      request.prompt.trim().length === 0 ||
      request.prompt.length > MAX_MESSAGE_LENGTH
    ) {
      throw new BadRequestException('消息为空或过长。');
    }
    if (!Array.isArray(request.messages)) {
      throw new BadRequestException('对话历史无效。');
    }
    if (request.messages.length > MAX_HISTORY_MESSAGES) {
      throw new BadRequestException('对话历史过长，请开启新对话。');
    }

    const hasInvalidMessage = request.messages.some((message: ChatMessage) => {
      return (
        !message ||
        (message.role !== 'user' && message.role !== 'assistant') ||
        typeof message.content !== 'string' ||
        message.content.trim().length === 0 ||
        message.content.length > MAX_MESSAGE_LENGTH
      );
    });
    if (hasInvalidMessage) {
      throw new BadRequestException('对话历史中包含无效消息。');
    }
  }

  private normalizeBaseUrl(value: string): string {
    const trimmed = value.trim().replace(/\/+$/u, '');
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new BadRequestException('Base URL 无效。');
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new BadRequestException('Base URL 必须是无参数的 HTTPS 地址。');
    }
    return url.toString().replace(/\/+$/u, '');
  }
}
