/**
 * Generic AI Search Utility
 * Provides a reusable function for AI text generation with custom system prompts
 * Uses GoogleGenerativeAI with structured JSON output
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getStore } from '../storage';

export interface AISearchOptions {
  /** System prompt to guide the AI's behavior */
  systemPrompt: string;
  /** User message/prompt */
  userMessage: string;
  /** Optional JSON schema for structured output */
  responseSchema?: any;
  /** Model to use (defaults to gemini-2.0-flash-exp) */
  model?: string;
  /** Temperature for generation (defaults to 0.7) */
  temperature?: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
}

export interface AISearchResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Get Google AI API key from store
 */
function getGoogleApiKey(): string | null {
  try {
    const store = getStore?.();
    if (!store) {
      return null;
    }

    const aiKeys = store.get('ai-keys', []);
    if (!Array.isArray(aiKeys)) {
      return null;
    }

    // Find preferred key: egdesk > active > any google key
    const preferred =
      aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ??
      aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) ??
      aiKeys.find((k: any) => k?.providerId === 'google');

    const apiKey = preferred?.fields?.apiKey;
    if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
      return apiKey.trim();
    }

    // Fallback to environment variable
    if (process.env.GEMINI_API_KEY && typeof process.env.GEMINI_API_KEY === 'string') {
      return process.env.GEMINI_API_KEY.trim();
    }

    return null;
  } catch (error) {
    console.error('[AISearch] Failed to get API key from store:', error);
    return null;
  }
}

/**
 * Generic AI search function that accepts a system prompt
 */
export async function aiSearch(options: AISearchOptions): Promise<AISearchResult> {
  console.log('[aiSearch] Starting AI search...', {
    hasSystemPrompt: !!options.systemPrompt,
    userMessageLength: options.userMessage?.length,
    hasResponseSchema: !!options.responseSchema,
    model: options.model,
  });
  
  try {
    const apiKey = getGoogleApiKey();
    if (!apiKey) {
      console.error('[aiSearch] No API key found');
      return {
        success: false,
        error: 'AI is not configured. Please configure a Google AI key first.',
      };
    }
    
    console.log('[aiSearch] API key found, proceeding with generation...');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = options.model || 'gemini-2.0-flash-exp';
    const temperature = options.temperature ?? 0.7;
    const maxOutputTokens = options.maxOutputTokens ?? 4096;

    // Build the generation config
    const generationConfig: any = {
      temperature,
      maxOutputTokens,
    };

    // If response schema is provided, use structured output
    if (options.responseSchema) {
      generationConfig.responseMimeType = 'application/json';
      // Type assertion needed for schema compatibility
      generationConfig.responseSchema = options.responseSchema as any;
    }

    const aiModel = genAI.getGenerativeModel({
      model,
      generationConfig,
      systemInstruction: options.systemPrompt,
    });

    console.log('[aiSearch] Calling Gemini API...');
    const result = await aiModel.generateContent(options.userMessage);
    const response = result.response;
    const text = response.text();
    console.log('[aiSearch] Received response, text length:', text.length);

    // If structured output, parse and validate JSON
    if (options.responseSchema) {
      try {
        const parsed = JSON.parse(text);
        return {
          success: true,
          content: JSON.stringify(parsed, null, 2),
        };
      } catch (parseError) {
        console.error('[AISearch] Failed to parse JSON response:', parseError);
        return {
          success: false,
          error: 'AI response was not valid JSON',
        };
      }
    }

    return {
      success: true,
      content: text.trim(),
    };
  } catch (error) {
    console.error('[AISearch] Error calling AI:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

