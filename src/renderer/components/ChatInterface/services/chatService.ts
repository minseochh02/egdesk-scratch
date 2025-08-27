import { AIKey } from '../../AIKeysManager/types';
import { ChatMessage, ChatResponse, ModelInfo } from '../types';

export class ChatService {
  /**
   * Send a chat message using the specified AI key and model
   */
  static async sendMessage(
    key: AIKey,
    model: string,
    messages: ChatMessage[],
    config: {
      temperature: number;
      maxTokens: number;
      systemPrompt?: string;
    }
  ): Promise<ChatResponse> {
    try {
      const provider = key.providerId;
      
      switch (provider) {
        case 'openai':
          return await this.sendOpenAIMessage(key, model, messages, config);
        case 'anthropic':
          return await this.sendAnthropicMessage(key, model, messages, config);
        case 'google':
          return await this.sendGoogleMessage(key, model, messages, config);
        case 'azure':
          return await this.sendAzureMessage(key, model, messages, config);
        case 'custom':
          return await this.sendCustomMessage(key, model, messages, config);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      return {
        success: false,
        message: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Send message to OpenAI API
   */
  private static async sendOpenAIMessage(
    key: AIKey,
    model: string,
    messages: ChatMessage[],
    config: { temperature: number; maxTokens: number; systemPrompt?: string }
  ): Promise<ChatResponse> {
    const apiKey = key.fields.apiKey;
    const organization = key.fields.organization;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    if (organization) {
      headers['OpenAI-Organization'] = organization;
    }

    // Convert chat messages to OpenAI format
    const openAIMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Add system prompt if provided
    if (config.systemPrompt) {
      openAIMessages.unshift({
        role: 'system',
        content: config.systemPrompt
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: openAIMessages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const usage = data.usage;
    const cost = this.calculateOpenAICost(usage, model);

    return {
      success: true,
      message: data.choices[0]?.message?.content || '',
      usage,
      cost
    };
  }

  /**
   * Send message to Anthropic API
   */
  private static async sendAnthropicMessage(
    key: AIKey,
    model: string,
    messages: ChatMessage[],
    config: { temperature: number; maxTokens: number; systemPrompt?: string }
  ): Promise<ChatResponse> {
    const apiKey = key.fields.apiKey;

    // Convert messages to Anthropic format
    const anthropicMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));

    const body: any = {
      model,
      messages: anthropicMessages,
      temperature: config.temperature,
      max_tokens: config.maxTokens
    };

    if (config.systemPrompt) {
      body.system = config.systemPrompt;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const usage = data.usage;
    const cost = this.calculateAnthropicCost(usage, model);

    return {
      success: true,
      message: data.content[0]?.text || '',
      usage,
      cost
    };
  }

  /**
   * Send message to Google AI API
   */
  private static async sendGoogleMessage(
    key: AIKey,
    model: string,
    messages: ChatMessage[],
    config: { temperature: number; maxTokens: number; systemPrompt?: string }
  ): Promise<ChatResponse> {
    const apiKey = key.fields.apiKey;

    // Convert messages to Google AI format
    const googleMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    const body: any = {
      contents: googleMessages,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens
      }
    };

    if (config.systemPrompt) {
      body.systemInstruction = { parts: [{ text: config.systemPrompt }] };
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const usage = data.usageMetadata;
    const cost = this.calculateGoogleCost(usage, model);

    return {
      success: true,
      message: data.candidates[0]?.content?.parts[0]?.text || '',
      usage,
      cost
    };
  }

  /**
   * Send message to Azure OpenAI API
   */
  private static async sendAzureMessage(
    key: AIKey,
    model: string,
    messages: ChatMessage[],
    config: { temperature: number; maxTokens: number; systemPrompt?: string }
  ): Promise<ChatResponse> {
    const apiKey = key.fields.apiKey;
    const endpoint = key.fields.endpoint;
    const deploymentName = key.fields.deploymentName;

    if (!endpoint || !deploymentName) {
      throw new Error('Azure OpenAI configuration incomplete');
    }

    const cleanEndpoint = endpoint.replace(/\/$/, '');
    const url = `${cleanEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`;

    // Convert messages to OpenAI format (Azure uses OpenAI format)
    const openAIMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    if (config.systemPrompt) {
      openAIMessages.unshift({
        role: 'system',
        content: config.systemPrompt
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: openAIMessages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const usage = data.usage;
    const cost = this.calculateOpenAICost(usage, model);

    return {
      success: true,
      message: data.choices[0]?.message?.content || '',
      usage,
      cost
    };
  }

  /**
   * Send message to custom provider API
   */
  private static async sendCustomMessage(
    key: AIKey,
    model: string,
    messages: ChatMessage[],
    config: { temperature: number; maxTokens: number; systemPrompt?: string }
  ): Promise<ChatResponse> {
    const apiKey = key.fields.apiKey;
    const endpoint = key.fields.endpoint;

    if (!endpoint) {
      throw new Error('Custom provider configuration incomplete');
    }

    // Try to send in OpenAI-compatible format first
    const openAIMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    if (config.systemPrompt) {
      openAIMessages.unshift({
        role: 'system',
        content: config.systemPrompt
      });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: openAIMessages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      message: data.choices?.[0]?.message?.content || data.content || data.message || '',
      usage: data.usage,
      cost: data.cost
    };
  }

  /**
   * Calculate cost for OpenAI/Azure usage
   */
  private static calculateOpenAICost(usage: any, model: string): number {
    if (!usage) return 0;
    
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
    };

    const modelPricing = pricing[model] || pricing['gpt-3.5-turbo'];
    const inputCost = (usage.prompt_tokens / 1000) * modelPricing.input;
    const outputCost = (usage.completion_tokens / 1000) * modelPricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * Calculate cost for Anthropic usage
   */
  private static calculateAnthropicCost(usage: any, model: string): number {
    if (!usage) return 0;
    
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 }
    };

    const modelPricing = pricing[model] || pricing['claude-3-haiku'];
    const inputCost = (usage.input_tokens / 1000) * modelPricing.input;
    const outputCost = (usage.output_tokens / 1000) * modelPricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * Calculate cost for Google AI usage
   */
  private static calculateGoogleCost(usage: any, model: string): number {
    if (!usage) return 0;
    
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-pro': { input: 0.0005, output: 0.0015 },
      'gemini-pro-vision': { input: 0.0005, output: 0.0015 }
    };

    const modelPricing = pricing[model] || pricing['gemini-pro'];
    const inputCost = (usage.promptTokenCount / 1000) * modelPricing.input;
    const outputCost = (usage.candidatesTokenCount / 1000) * modelPricing.output;
    
    return inputCost + outputCost;
  }
}
