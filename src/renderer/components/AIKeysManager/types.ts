export interface AIProvider {
  id: string;
  name: string;
  description: string;
  icon: string; // FontAwesome icon name
  color: string;
  fields: AIProviderField[];
  models: AIProviderModel[];
}

export interface AIProviderModel {
  id: string;
  name: string;
  description?: string;
}

export interface AIProviderField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  placeholder: string;
  required: boolean;
  options?: string[];
  helpText?: string;
}

export interface AIKey {
  id: string;
  providerId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  fields: Record<string, string>;
}

export interface AIKeysState {
  keys: AIKey[];
  providers: AIProvider[];
  isLoading: boolean;
  error: string | null;
  selectedKeyId: string | null;
}

export interface AIKeyFormData {
  providerId: string;
  name: string;
  fields: Record<string, string>;
}

export interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

// Predefined AI providers
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5, DALL-E, and other OpenAI services',
    icon: 'faRobot',
    color: '#10a37f',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-...',
        required: true,
        helpText: 'Get your API key from https://platform.openai.com/api-keys',
      },
      {
        key: 'organization',
        label: 'Organization ID (Optional)',
        type: 'text',
        placeholder: 'org-...',
        required: false,
        helpText: 'Your OpenAI organization ID if you have one',
      },
    ],
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable GPT-4 model' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster, cheaper GPT-4 model' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient model' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude AI models and services',
    icon: '🧠',
    color: '#d97706',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-ant-...',
        required: true,
        helpText: 'Get your API key from https://console.anthropic.com/',
      },
    ],
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Most capable Claude model' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and efficient Claude model' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Previous generation Claude model' },
    ],
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini, PaLM, and other Google AI services',
    icon: 'faSearch',
    color: '#4285f4',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'AIza...',
        required: true,
        helpText:
          'Get your API key from https://makersuite.google.com/app/apikey',
      },
    ],
    models: [
      { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash', description: 'Fast and efficient model' },
      { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro', description: 'Most capable Gemini model' },
      { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', description: 'Previous generation Gemini model' },
    ],
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    description: 'OpenAI services through Azure',
    icon: '☁️',
    color: '#0078d4',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: '...',
        required: true,
        helpText: 'Your Azure OpenAI API key',
      },
      {
        key: 'endpoint',
        label: 'Endpoint URL',
        type: 'url',
        placeholder: 'https://your-resource.openai.azure.com/',
        required: true,
        helpText: 'Your Azure OpenAI endpoint URL',
      },
      {
        key: 'deploymentName',
        label: 'Deployment Name',
        type: 'text',
        placeholder: 'gpt-4',
        required: true,
        helpText: 'Your model deployment name',
      },
    ],
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable GPT-4 model' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Faster, cheaper GPT-4 model' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient model' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Provider',
    description: 'Add your own AI service provider',
    icon: '⚙️',
    color: '#6b7280',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'Your API key',
        required: true,
      },
      {
        key: 'endpoint',
        label: 'API Endpoint',
        type: 'url',
        placeholder: 'https://api.example.com/v1',
        required: true,
      },
      {
        key: 'model',
        label: 'Model Name',
        type: 'text',
        placeholder: 'gpt-4',
        required: false,
      },
    ],
    models: [
      { id: 'custom-model', name: 'Custom Model', description: 'Your custom AI model' },
    ],
  },
];
