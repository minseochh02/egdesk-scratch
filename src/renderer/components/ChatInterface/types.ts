export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  provider?: string;
  model?: string;
  tokens?: number;
  cost?: number;
}

export interface ChatSession {
  id: string;
  name: string;
  provider: string;
  model: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface ChatConfig {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  config: ChatConfig;
}

export interface ChatResponse {
  success: boolean;
  message: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  supportsChat: boolean;
  supportsImages: boolean;
  pricing?: {
    input: number; // per 1K tokens
    output: number; // per 1K tokens
  };
}

export interface ChatProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  models: ModelInfo[];
  supportsStreaming: boolean;
  supportsImages: boolean;
}

// Predefined chat providers based on AI keys
export const CHAT_PROVIDERS: ChatProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    color: '#10a37f',
    supportsStreaming: true,
    supportsImages: true,
    models: [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        maxTokens: 8192,
        supportsChat: true,
        supportsImages: false,
        pricing: { input: 0.03, output: 0.06 }
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        provider: 'openai',
        maxTokens: 128000,
        supportsChat: true,
        supportsImages: true,
        pricing: { input: 0.01, output: 0.03 }
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        provider: 'openai',
        maxTokens: 16385,
        supportsChat: true,
        supportsImages: false,
        pricing: { input: 0.0015, output: 0.002 }
      }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🧠',
    color: '#d97706',
    supportsStreaming: true,
    supportsImages: false,
    models: [
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        provider: 'anthropic',
        maxTokens: 200000,
        supportsChat: true,
        supportsImages: true,
        pricing: { input: 0.015, output: 0.075 }
      },
      {
        id: 'claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        provider: 'anthropic',
        maxTokens: 200000,
        supportsChat: true,
        supportsImages: true,
        pricing: { input: 0.003, output: 0.015 }
      },
      {
        id: 'claude-3-haiku',
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        maxTokens: 200000,
        supportsChat: true,
        supportsImages: true,
        pricing: { input: 0.00025, output: 0.00125 }
      }
    ]
  },
  {
    id: 'google',
    name: 'Google AI',
    icon: '🔍',
    color: '#4285f4',
    supportsStreaming: true,
    supportsImages: false,
    models: [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'google',
        maxTokens: 1000000,
        supportsChat: true,
        supportsImages: false,
        pricing: { input: 0.0005, output: 0.0015 }
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        provider: 'google',
        maxTokens: 1000000,
        supportsChat: true,
        supportsImages: false,
        pricing: { input: 0.0005, output: 0.0015 }
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'google',
        maxTokens: 1000000,
        supportsChat: true,
        supportsImages: false,
        pricing: { input: 0.0005, output: 0.0015 }
      },
      {
        id: 'gemini-1.5-flash-latest',
        name: 'Gemini 1.5 Flash',
        provider: 'google',
        maxTokens: 1000000,
        supportsChat: true,
        supportsImages: false,
        pricing: { input: 0.0005, output: 0.0015 }
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        maxTokens: 1000000,
        supportsChat: true,
        supportsImages: false,
        pricing: { input: 0.0005, output: 0.0015 }
      }
    ]
  }
];

export interface ChatFormData {
  message: string;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}
