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
  // This handles various formats:
  // 1. ```json { ... } ```
  // 2. ``` { ... } ```
  // 3. Just plain JSON text inside content
  
  // Extract JSON block if present (greedy match for largest JSON object)
  // We look for the last occurrences of potential JSON structure if multiple exist
  // or just try to parse the whole thing if it looks like JSON
  
  // Regular expression to find JSON blocks within markdown or plain text
  // Looks for { "content": ... "toolCalls": ... } pattern specifically or general JSON object
  const jsonBlockRegex = /\{[\s\S]*"toolCalls"[\s\S]*\}|\{^[\s\S]*\}$/g;
  const matches = trimmedContent.match(jsonBlockRegex);
  // Use the last match if available, or the whole content
  let potentialJson = matches ? matches[matches.length - 1] : trimmedContent;
  
  // If the content contains markdown code blocks with json, try to extract specifically from there
  const markdownJsonMatch = trimmedContent.match(/```json\s*([\s\S]*?)\s*```/i);
  if (markdownJsonMatch && markdownJsonMatch[1]) {
    potentialJson = markdownJsonMatch[1];
  } else {
      // Fallback: try to find the outermost curly braces if it looks like a JSON object mixed with text
      const openBraceIndex = trimmedContent.indexOf('{');
      const closeBraceIndex = trimmedContent.lastIndexOf('}');
      if (openBraceIndex !== -1 && closeBraceIndex !== -1 && closeBraceIndex > openBraceIndex) {
          const braceContent = trimmedContent.substring(openBraceIndex, closeBraceIndex + 1);
          // Only use it if it looks like it contains toolCalls
          if (braceContent.includes('"toolCalls"')) {
              potentialJson = braceContent;
          }
      }
  }
  
  // Clean up potential markdown artifacts if we haven't already
  potentialJson = potentialJson
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/g, '')
    .replace(/\s*```$/g, '')
    .trim();

  console.log('🔍 Debug: Extracted potential JSON for parsing:', potentialJson.substring(0, 200) + '...');

  try {
    // Only attempt parse if it starts with { and ends with }
    if (potentialJson.startsWith('{') && potentialJson.endsWith('}')) {
      const parsed = JSON.parse(potentialJson);
      
      console.log('🔍 Debug: Successfully parsed JSON:', parsed);

      // Check if it matches our tool call schema
      if (typeof parsed === 'object' && parsed !== null) {
        // It's a valid JSON object
        
        // Extract content if present
        if (typeof parsed.content === 'string') {
        parsedContent = parsed.content;
      }
        
        // Extract toolCalls if present
        if (Array.isArray(parsed.toolCalls)) {
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
            
          // If we successfully parsed tool calls, we should use the parsed content
          // instead of the raw content which might include the JSON block
        }
      }
    }
  } catch (e) {
    // JSON parse failed - treat as regular text content
    // This is normal for non-tool responses
    // console.debug('Gemma response was not valid JSON tool call', e);
  }

  return {
    content: parsedContent.trim(),
    toolCalls: parsedToolCalls,
    raw: rawBuffer,
  };
}
