import type { ChatRequest, ChatResponse } from '@shared/api.interface';

async function createChatCompletion(request: ChatRequest): Promise<ChatResponse> {
  // eslint-disable-next-line no-restricted-syntax -- Cloudflare uses the same-origin Fetch API.
  const response = await fetch('/api/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let message = '模型调用失败，请检查配置后重试。';
    try {
      const body = (await response.json()) as {
        error?: { message?: string };
      };
      if (body.error?.message) message = body.error.message;
    } catch {
      // Keep the generic message for non-JSON infrastructure errors.
    }

    throw new Error(message);
  }

  return (await response.json()) as ChatResponse;
}

export { createChatCompletion };
