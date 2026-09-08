export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
  prompt: string;
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ChatResponse {
  message: ChatMessage;
  model: string;
  usage: ChatUsage;
}
