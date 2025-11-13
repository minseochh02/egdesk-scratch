export type OllamaChatRole = 'user' | 'assistant' | 'system';

export interface OllamaChatMessage {
  role: OllamaChatRole;
  content: string;
}

interface OllamaChatResponse {
  success: boolean;
  error?: string;
  chunks?: string[];
  data?: unknown;
}

const MODEL_ID = 'gemma3:4b';

type OllamaCheckResponse = {
  success: boolean;
  isInstalled: boolean;
};

const getElectronApi = () => {
  if (typeof window === 'undefined') {
    throw new Error('Renderer environment is required to use Gemma client.');
  }
  const api = window.electron;
  if (!api?.invoke) {
    throw new Error('Electron bridge is unavailable.');
  }
  return api;
};

export interface GemmaToolCall {
  name: string;
  args?: Record<string, any>;
}

export interface GemmaChatResult {
  content: string;
  toolCalls: GemmaToolCall[];
  raw?: string;
}

type GemmaChatOptions = {
  stream?: boolean;
  websiteContext?: string;
  systemPrompt?: string;
};

export async function chatWithGemma(
  prompt: string,
  context: OllamaChatMessage[] = [],
  options: GemmaChatOptions = {}
): Promise<GemmaChatResult> {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('Prompt cannot be empty.');
  }

  const electronApi = getElectronApi();
  const { stream = true, websiteContext, systemPrompt } = options;

  const ensureServerRunning = async () => {
    try {
      const status = (await electronApi.invoke(
        'ollama:check-installed'
      )) as OllamaCheckResponse;

      if (!status?.success || !status.isInstalled) {
        throw new Error('Ollama is not installed. Complete setup before chatting.');
      }

      await electronApi.invoke('ollama:start');
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Failed to verify Ollama status.'
      );
    }
  };

  await ensureServerRunning();

  const cleanedWebsiteContext =
    typeof websiteContext === 'string' && websiteContext.trim().length > 0
      ? websiteContext.trim().slice(0, 120_000)
      : undefined;

  const invokeChat = async () =>
    (await electronApi.invoke('ollama:chat', {
      model: MODEL_ID,
      messages: [...context, { role: 'user', content: prompt.trim() }],
      stream,
      websiteContext: cleanedWebsiteContext,
      systemPrompt: systemPrompt?.trim(),
    })) as OllamaChatResponse;

  let response: OllamaChatResponse;

  try {
    response = await invokeChat();
  } catch (error) {
    // Attempt to start Ollama again and retry once
    try {
      await electronApi.invoke('ollama:start');
      response = await invokeChat();
    } catch (retryError) {
      throw retryError instanceof Error ? retryError : new Error(String(retryError));
    }
  }

  if (!response?.success) {
    throw new Error(response?.error ?? 'Gemma request failed.');
  }

  if (stream === false && response.data) {
    const payload = response.data;
    const messageContent =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? (payload as any).message?.content
        : undefined;

    const rawData =
      typeof messageContent === 'string'
        ? messageContent
        : typeof payload === 'string'
          ? payload
          : JSON.stringify(payload);

    const parsedContent = rawData.trim();
    return {
      content: parsedContent,
      toolCalls: [],
      raw: rawData,
    };
  }

  const chunks = Array.isArray(response.chunks) ? response.chunks : [];
  let combinedContent = '';
  let rawBuffer = '';

  for (const chunk of chunks) {
    rawBuffer += chunk;
    const lines = chunk
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const messageContent = parsed?.message?.content;

        if (Array.isArray(messageContent)) {
          combinedContent += messageContent
            .map((entry: any) => {
              if (typeof entry === 'string') return entry;
              if (entry && typeof entry.text === 'string') return entry.text;
              return '';
            })
            .join('');
        } else if (typeof messageContent === 'string') {
          combinedContent += messageContent;
        }
      } catch {
        // Ignore malformed streaming payloads
      }
    }
  }

  const trimmedContent = combinedContent.trim();
  let parsedContent = trimmedContent;
  let parsedToolCalls: GemmaToolCall[] = [];

  // Strip markdown code fences from the actual content
  const cleanedContent = trimmedContent
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/g, '')
    .replace(/\s*```$/g, '')
    .trim();

  // Try to parse as JSON
  const jsonMatch = cleanedContent.match(/^\{[\s\S]*\}$/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed?.content === 'string') {
        parsedContent = parsed.content;
      }
      if (Array.isArray(parsed?.toolCalls)) {
        parsedToolCalls = parsed.toolCalls
          .map((tool: any) => {
            if (!tool || typeof tool !== 'object') return null;
            if (typeof tool.name !== 'string') return null;
            const args =
              tool.args && typeof tool.args === 'object' && !Array.isArray(tool.args)
                ? tool.args
                : {};
            return { name: tool.name, args };
          })
          .filter((tool: GemmaToolCall | null): tool is GemmaToolCall => Boolean(tool));
      }
    } catch {
      // If JSON parse fails, use the cleaned content as-is
      parsedContent = cleanedContent;
    }
  } else {
    // No JSON structure found, use cleaned content
    parsedContent = cleanedContent;
  }

  return {
    content: parsedContent.trim(),
    toolCalls: parsedToolCalls,
    raw: rawBuffer,
  };
}
