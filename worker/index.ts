import { Agent } from '../node_modules/@earendil-works/pi-agent-core/dist/agent.js';
import type { AgentMessage } from '@earendil-works/pi-agent-core';
import {
  createModels,
  createProvider,
  type AssistantMessage,
  type Model,
  type Usage,
} from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';

import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
} from '../shared/api.interface';

interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_BODY_BYTES = 256_000;
const MAX_HISTORY_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_SYSTEM_PROMPT_LENGTH = 4_000;
const MAX_MODEL_LENGTH = 160;
const MAX_API_KEY_LENGTH = 512;

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

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

function createModel(modelId: string): Model<'openai-completions'> {
  return {
    id: modelId,
    name: modelId,
    api: 'openai-completions',
    provider: 'openrouter',
    baseUrl: OPENROUTER_BASE_URL,
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

function toAgentMessages(
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

function findLastAssistantMessage(
  messages: AgentMessage[],
): AssistantMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'assistant') return message;
  }
  return undefined;
}

function validateRequest(value: unknown): asserts value is ChatRequest {
  if (!value || typeof value !== 'object') {
    throw new HttpError(400, '请求体无效。');
  }

  const request = value as Partial<ChatRequest>;
  if (
    typeof request.apiKey !== 'string' ||
    request.apiKey.trim().length === 0 ||
    request.apiKey.length > MAX_API_KEY_LENGTH
  ) {
    throw new HttpError(400, '请填写有效的 OpenRouter API Key。');
  }
  if (
    typeof request.model !== 'string' ||
    request.model.trim().length === 0 ||
    request.model.length > MAX_MODEL_LENGTH ||
    !/^[a-zA-Z0-9_~./:-]+$/u.test(request.model.trim())
  ) {
    throw new HttpError(400, '模型 ID 无效。');
  }
  if (
    typeof request.systemPrompt !== 'string' ||
    request.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH
  ) {
    throw new HttpError(400, '系统提示词过长。');
  }
  if (
    typeof request.prompt !== 'string' ||
    request.prompt.trim().length === 0 ||
    request.prompt.length > MAX_MESSAGE_LENGTH
  ) {
    throw new HttpError(400, '消息为空或过长。');
  }
  if (!Array.isArray(request.messages)) {
    throw new HttpError(400, '对话历史无效。');
  }
  if (request.messages.length > MAX_HISTORY_MESSAGES) {
    throw new HttpError(400, '对话历史过长，请开启新对话。');
  }

  const hasInvalidMessage = request.messages.some((message: ChatMessage) => {
    return (
      !message ||
      typeof message.id !== 'string' ||
      (message.role !== 'user' && message.role !== 'assistant') ||
      typeof message.content !== 'string' ||
      message.content.trim().length === 0 ||
      message.content.length > MAX_MESSAGE_LENGTH
    );
  });
  if (hasInvalidMessage) {
    throw new HttpError(400, '对话历史中包含无效消息。');
  }
}

async function createCompletion(request: ChatRequest): Promise<ChatResponse> {
  const modelId = request.model.trim();
  const model = createModel(modelId);
  const provider = createProvider({
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: OPENROUTER_BASE_URL,
    auth: {
      apiKey: {
        name: 'OpenRouter API key',
        resolve: async () => ({ auth: {} }),
      },
    },
    models: [model],
    api: openAICompletionsApi(),
  });
  const models = createModels();
  models.setProvider(provider);

  const agent = new Agent({
    initialState: {
      systemPrompt: request.systemPrompt.trim(),
      model,
      thinkingLevel: 'off',
      tools: [],
      messages: toAgentMessages(request.messages, model),
    },
    streamFn: models.streamSimple.bind(models),
    getApiKey: () => request.apiKey.trim(),
  });

  await agent.prompt(request.prompt.trim());
  const assistantMessage = findLastAssistantMessage(agent.state.messages);
  if (!assistantMessage || assistantMessage.stopReason === 'error') {
    throw new HttpError(
      502,
      '模型调用失败，请检查 API Key、模型 ID 和账户额度。',
    );
  }

  const content = assistantMessage.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  if (!content) throw new HttpError(502, '模型未返回文本内容。');

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

async function handleApiRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') {
    return jsonResponse({ error: { message: 'Method Not Allowed' } }, 405);
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: { message: '请求体过大。' } }, 413);
  }

  try {
    const body: unknown = await request.json();
    validateRequest(body);
    return jsonResponse(await createCompletion(body));
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return jsonResponse({ error: { message: error.message } }, error.status);
    }
    if (error instanceof SyntaxError) {
      return jsonResponse({ error: { message: '请求体不是有效 JSON。' } }, 400);
    }
    return jsonResponse(
      { error: { message: '模型服务暂时不可用，请稍后重试。' } },
      502,
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/chat/completions') {
      return handleApiRequest(request);
    }
    if (url.pathname.startsWith('/api/')) {
      return jsonResponse({ error: { message: 'Not Found' } }, 404);
    }
    return env.ASSETS.fetch(request);
  },
};
