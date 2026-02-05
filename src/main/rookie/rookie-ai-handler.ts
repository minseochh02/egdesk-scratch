/**
 * Dedicated AI Handler for Rookie
 * Isolated from other Gemini integrations to avoid conflicts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getStore } from '../storage';

export interface RookieAIOptions {
  prompt: string;
  systemPrompt?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseSchema?: any;
}

export interface RookieAIResult {
  text: string;
  json?: any;
  raw: string;
}

/**
 * Get Google API key from store or environment
 */
function getGoogleApiKey(): string | null {
  try {
    const store = getStore?.();
    if (!store) {
      console.warn('[Rookie AI] Store not available');
      return null;
    }

    const aiKeys = store.get('ai-keys', []);
    if (!Array.isArray(aiKeys)) {
      console.warn('[Rookie AI] AI keys not found or not an array');
      return null;
    }

    // Find Google API key (prefer 'egdesk' named key, then active, then any)
    const googleKey =
      aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ??
      aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) ??
      aiKeys.find((k: any) => k?.providerId === 'google' && k?.fields?.apiKey);

    if (googleKey?.fields?.apiKey && typeof googleKey.fields.apiKey === 'string') {
      return googleKey.fields.apiKey.trim();
    }

    // Fallback to environment variable
    if (process.env.GEMINI_API_KEY && typeof process.env.GEMINI_API_KEY === 'string') {
      return process.env.GEMINI_API_KEY.trim();
    }

    return null;
  } catch (error) {
    console.error('[Rookie AI] Error reading API key from store:', error);
    return null;
  }
}

/**
 * Extract JSON from text, handling markdown code blocks
 */
function extractJsonFromText(text: string): string {
  let cleaned = text.trim();

  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');

  // Try to find JSON object/array in the text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return cleaned;
}

/**
 * Parse JSON with fallback strategies
 */
function parseJsonRobust(text: string): any {
  // Strategy 1: Try direct parsing
  try {
    return JSON.parse(text);
  } catch (e1) {
    // Strategy 2: Extract and parse
    try {
      const extracted = extractJsonFromText(text);
      return JSON.parse(extracted);
    } catch (e2) {
      // Strategy 3: Try to fix common JSON issues
      try {
        let fixed = extractJsonFromText(text);
        // Remove trailing commas before closing braces/brackets
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
        return JSON.parse(fixed);
      } catch (e3) {
        // Re-throw the original error with context
        throw new Error(`Failed to parse JSON: ${e1 instanceof Error ? e1.message : 'Unknown error'}`);
      }
    }
  }
}

/**
 * Generate content using Gemini AI (dedicated for Rookie)
 */
export async function generateWithRookieAI(options: RookieAIOptions): Promise<RookieAIResult> {
  const {
    prompt,
    systemPrompt,
    apiKey: providedApiKey,
    model = 'gemini-2.5-flash',
    temperature = 0,
    maxOutputTokens = 32768, // Keep high for safety
    responseSchema,
  } = options;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('[Rookie AI] Text prompt is required');
  }

  // Get API key
  const apiKey = providedApiKey || getGoogleApiKey();

  if (!apiKey) {
    throw new Error(
      '[Rookie AI] Google API key is required. Please configure one in AI Keys Manager or set GEMINI_API_KEY environment variable.'
    );
  }

  const keyPreview = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
  console.log('[Rookie AI] Generating with model:', model);
  console.log('[Rookie AI] Using API key:', keyPreview);
  console.log('[Rookie AI] Structured output:', !!responseSchema);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    const generationConfig: any = {
      temperature,
      maxOutputTokens,
    };

    // Add JSON schema for structured output if provided
    if (responseSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = responseSchema;
    }

    const aiModel = genAI.getGenerativeModel({
      model,
      generationConfig,
      systemInstruction: systemPrompt,
    });

    console.log('[Rookie AI] Sending request to Gemini...');
    const result = await aiModel.generateContent(prompt.trim());
    const response = result.response;
    const text = response.text();

    console.log(`[Rookie AI] Generated text (${text.length} characters)`);

    // Parse JSON if schema was provided
    let parsedJson: any = undefined;
    if (responseSchema) {
      try {
        parsedJson = parseJsonRobust(text);
        console.log('[Rookie AI] Successfully parsed JSON response');
      } catch (parseError) {
        console.error('[Rookie AI] Failed to parse JSON response:', parseError);
        console.error('[Rookie AI] Response length:', text.length, 'characters');
        console.error('[Rookie AI] Raw response (first 1000 chars):', text.substring(0, 1000));
        console.error('[Rookie AI] Raw response (last 500 chars):', text.substring(Math.max(0, text.length - 500)));

        // Save full response for debugging
        const fs = await import('fs');
        const path = await import('path');
        const debugDir = process.cwd() + '/output/debug';
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        const debugFile = path.join(debugDir, `rookie-ai-truncated-${Date.now()}.json`);
        fs.writeFileSync(debugFile, text, 'utf-8');
        console.error('[Rookie AI] Full truncated response saved to:', debugFile);

        throw new Error(`Failed to parse JSON response (likely truncated at ${text.length} chars): ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
    }

    return {
      text: text.trim(),
      json: parsedJson,
      raw: text,
    };
  } catch (error: any) {
    console.error('[Rookie AI] Error:', error);
    throw error;
  }
}
