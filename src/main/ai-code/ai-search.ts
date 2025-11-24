/**
 * Generic AI Search Utility
 * Provides a reusable function for AI text generation with custom system prompts
 * Uses centralized Gemini text generation
 */

import { generateTextWithAI } from '../gemini';

export interface AISearchOptions {
  /** System prompt to guide the AI's behavior */
  systemPrompt: string;
  /** User message/prompt */
  userMessage: string;
  /** Optional JSON schema for structured output */
  responseSchema?: any;
  /** Model to use (defaults to gemini-2.5-flash) */
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
 * Generic AI search function that accepts a system prompt
 */
export async function aiSearch(options: AISearchOptions): Promise<AISearchResult> {
  console.log('[aiSearch] Starting AI search...', {
    hasSystemPrompt: !!options.systemPrompt,
    userMessageLength: options.userMessage?.length,
    hasResponseSchema: !!options.responseSchema,
    model: options.model || 'gemini-2.5-flash',
  });
  
  try {
    const result = await generateTextWithAI({
      prompt: options.userMessage,
      systemPrompt: options.systemPrompt,
      model: options.model || 'gemini-2.5-flash',
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 4096,
      responseSchema: options.responseSchema,
      parseJson: !!options.responseSchema,
      streaming: false,
      useRetry: false,
      package: 'generative-ai',
    });

    // If structured output was requested, return formatted JSON
    if (options.responseSchema && result.json) {
      return {
        success: true,
        content: JSON.stringify(result.json, null, 2),
        };
    }

    return {
      success: true,
      content: result.text,
    };
  } catch (error) {
    console.error('[AISearch] Error calling AI:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

