import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  KeyRound,
  MessageSquarePlus,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';

import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Streamdown } from '@client/src/components/ui/streamdown';
import { Textarea } from '@client/src/components/ui/textarea';
import { createChatCompletion } from '@client/src/api';
import type { ChatMessage, ChatRequest } from '@shared/api.interface';

interface ModelSettings {
  apiKey: string;
  model: string;
  systemPrompt: string;
}

const SETTINGS_STORAGE_KEY = 'pi-chat:model-settings';
const MESSAGES_STORAGE_KEY = 'pi-chat:messages';
const DEFAULT_SETTINGS: ModelSettings = {
  apiKey: '',
  model: 'openai/gpt-5.4-mini',
  systemPrompt: '你是一位友好、准确、简洁的 AI 助手。',
};

function readSettings(): ModelSettings {
  const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!stored) return DEFAULT_SETTINGS;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;
    const candidate = parsed as Partial<ModelSettings>;

    return {
      apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : '',
      model:
        typeof candidate.model === 'string' && candidate.model
          ? candidate.model
          : DEFAULT_SETTINGS.model,
      systemPrompt:
        typeof candidate.systemPrompt === 'string'
          ? candidate.systemPrompt
          : DEFAULT_SETTINGS.systemPrompt,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function readMessages(): ChatMessage[] {
  const stored = window.localStorage.getItem(MESSAGES_STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((message: unknown): message is ChatMessage => {
      if (!message || typeof message !== 'object') return false;
      const candidate = message as Partial<ChatMessage>;
      return (
        typeof candidate.id === 'string' &&
        (candidate.role === 'user' || candidate.role === 'assistant') &&
        typeof candidate.content === 'string'
      );
    });
  } catch {
    return [];
  }
}

const ChatPage = () => {
  const [settings, setSettings] = useState<ModelSettings>(readSettings);
  const [draftSettings, setDraftSettings] =
    useState<ModelSettings>(settings);
  const [messages, setMessages] = useState<ChatMessage[]>(readMessages);
  const [input, setInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(
    settings.apiKey.length === 0,
  );
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(settings),
    );
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(
      MESSAGES_STORAGE_KEY,
      JSON.stringify(messages),
    );
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openSettings = () => {
    setDraftSettings(settings);
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    if (!draftSettings.apiKey.trim() || !draftSettings.model.trim()) {
      setError('请填写 API Key 和模型 ID。');
      return;
    }

    setSettings({
      apiKey: draftSettings.apiKey.trim(),
      model: draftSettings.model.trim(),
      systemPrompt: draftSettings.systemPrompt.trim(),
    });
    setError('');
    setSettingsOpen(false);
  };

  const clearMessages = () => {
    setMessages([]);
    setError('');
  };

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || isSending) return;
    if (!settings.apiKey) {
      openSettings();
      setError('先配置 OpenRouter API Key 才能开始对话。');
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
    };
    const request: ChatRequest = {
      ...settings,
      messages,
      prompt,
    };

    setMessages((current: ChatMessage[]) => [...current, userMessage]);
    setInput('');
    setError('');
    setIsSending(true);

    try {
      const response = await createChatCompletion(request);
      setMessages((current: ChatMessage[]) => [
        ...current,
        response.message,
      ]);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : '模型调用失败，请稍后重试。',
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleComposerKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <main className="flex min-h-screen bg-[#f6f7fb] text-foreground">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-950 p-5 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-950/30">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="font-semibold tracking-tight">Pi Chat</p>
            <p className="text-xs text-slate-400">Agent-powered dialogue</p>
          </div>
        </div>

        <Button
          className="mt-8 w-full justify-start gap-2 bg-white text-slate-950"
          onClick={clearMessages}
        >
          <MessageSquarePlus className="size-4" />
          新对话
        </Button>

        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4 text-indigo-300" />
            模型配置
          </div>
          <p className="truncate text-sm text-slate-300">{settings.model}</p>
          <p className="mt-1 text-xs text-slate-500">
            {settings.apiKey ? '已保存在当前浏览器' : '等待配置'}
          </p>
          <Button
            className="mt-4 w-full border-white/15 text-white hover:bg-white/10"
            variant="outline"
            onClick={openSettings}
          >
            <Settings2 className="size-4" />
            打开设置
          </Button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8">
          <div className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-white lg:hidden">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-semibold">Pi 对话智能体</h1>
              <Badge className="hidden sm:inline-flex" variant="secondary">
                Pi Agent Core
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {settings.model}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              className="lg:hidden"
              size="icon"
              variant="ghost"
              onClick={clearMessages}
            >
              <Trash2 className="size-4" />
              <span className="sr-only">清空对话</span>
            </Button>
            <Button size="sm" variant="outline" onClick={openSettings}>
              <Settings2 className="size-4" />
              <span className="hidden sm:inline">模型设置</span>
            </Button>
          </div>
        </header>

        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-10">
            {messages.length === 0 ? (
              <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
                <div className="relative mb-6 flex size-20 items-center justify-center rounded-3xl bg-slate-950 text-white shadow-xl shadow-slate-300">
                  <Bot className="size-9" />
                  <span className="absolute -right-1 -top-1 size-4 rounded-full border-2 border-white bg-emerald-400" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  今天想聊点什么？
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  这是一个基于 Pi Agent Core 的最小对话智能体。
                  先在模型设置中保存 OpenRouter Key 和模型 ID，即可开始。
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {['介绍一下你自己', '帮我拆解一个目标', '给我一个今日灵感'].map(
                    (suggestion: string) => (
                      <Button
                        key={suggestion}
                        size="sm"
                        variant="outline"
                        onClick={() => setInput(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message: ChatMessage) => (
                  <article
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
                        <Bot className="size-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm md:max-w-[76%] ${
                        message.role === 'user'
                          ? 'rounded-br-md bg-indigo-600 text-white'
                          : 'rounded-bl-md border border-slate-200 bg-white'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <Streamdown className="text-sm leading-6">
                          {message.content}
                        </Streamdown>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      )}
                    </div>
                    {message.role === 'user' && (
                      <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                        <UserRound className="size-4" />
                      </div>
                    )}
                  </article>
                ))}

                {isSending && (
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-slate-950 text-white">
                      <Bot className="size-4" />
                    </div>
                    <div className="flex gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-4">
                      {[0, 1, 2].map((dot: number) => (
                        <span
                          key={dot}
                          className="size-1.5 animate-pulse rounded-full bg-slate-400"
                          style={{ animationDelay: `${dot * 150}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-[#f6f7fb] px-4 pb-5 pt-4 md:px-8">
            {error && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/70 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100">
              <Textarea
                className="max-h-40 min-h-16 resize-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0"
                disabled={isSending}
                maxLength={8_000}
                placeholder="输入消息……Enter 发送，Shift + Enter 换行"
                value={input}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setInput(event.target.value)
                }
                onKeyDown={handleComposerKeyDown}
              />
              <div className="flex items-center gap-3 px-2 pb-1">
                <p className="text-xs text-muted-foreground">
                  {settings.apiKey ? '配置已就绪' : '请先完成模型设置'}
                </p>
                <Button
                  className="ml-auto rounded-xl"
                  data-ai-section-type="button"
                  disabled={!input.trim() || isSending}
                  size="icon"
                  onClick={() => void sendMessage()}
                >
                  <Send className="size-4" />
                  <span className="sr-only">发送</span>
                </Button>
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              API Key 仅保存于当前浏览器，服务端不会持久化。
            </p>
          </div>
        </div>
      </section>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>模型设置</DialogTitle>
            <DialogDescription>
              通过 OpenRouter 使用任意可用的对话模型。配置将保存在当前浏览器。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="api-key">
                OpenRouter API Key
              </label>
              <Input
                id="api-key"
                autoComplete="off"
                maxLength={512}
                placeholder="sk-or-v1-..."
                type="password"
                value={draftSettings.apiKey}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setDraftSettings((current: ModelSettings) => ({
                    ...current,
                    apiKey: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                仅保存在 localStorage，发起对话时临时传给 Pi 运行时。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="model-id">
                模型 ID
              </label>
              <Input
                id="model-id"
                maxLength={160}
                placeholder="openai/gpt-5.4-mini"
                value={draftSettings.model}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setDraftSettings((current: ModelSettings) => ({
                    ...current,
                    model: event.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                使用 OpenRouter 模型 slug，可随时更换并保存。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="system-prompt">
                系统提示词
              </label>
              <Textarea
                id="system-prompt"
                className="min-h-24 resize-none"
                maxLength={4_000}
                value={draftSettings.systemPrompt}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setDraftSettings((current: ModelSettings) => ({
                    ...current,
                    systemPrompt: event.target.value,
                  }))
                }
              />
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <Check className="mt-0.5 size-4 shrink-0" />
              <p>
                对话历史也保存在当前浏览器；点击“新对话”即可清空。
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={saveSettings}>
              <Check className="size-4" />
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default ChatPage;
