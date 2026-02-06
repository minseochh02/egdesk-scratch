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
  tools?: any[]; // Function declarations for tool calling
  toolExecutor?: (toolName: string, args: any) => Promise<any>; // Function to execute tools
  maxToolCalls?: number; // Max tool call iterations (default: 10)
}

export interface RookieAIResult {
  text: string;
  json?: any;
  raw: string;
  toolCalls?: Array<{ name: string; args: any; result: any }>; // Record of tool calls made
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
    tools,
    toolExecutor,
    maxToolCalls = 10,
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
  console.log('[Rookie AI] Tools enabled:', !!tools);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    const generationConfig: any = {
      temperature,
      maxOutputTokens,
    };

    // Add JSON schema for structured output if provided (only when NOT using tools)
    if (responseSchema && !tools) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = responseSchema;
    }

    const modelConfig: any = {
      model,
      generationConfig,
      systemInstruction: systemPrompt,
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      modelConfig.tools = tools;
    }

    const aiModel = genAI.getGenerativeModel(modelConfig);

    // Handle tool calling loop if tools are provided
    if (tools && toolExecutor) {
      console.log('[Rookie AI] Starting tool calling loop with periodic summarization...');
      const chat = aiModel.startChat({
        history: [],
      });

      let iteration = 0;
      const toolCallLog: Array<{ name: string; args: any; result: any }> = [];
      let cumulativeSummary = ''; // Running summary of what AI has learned
      const SUMMARIZE_EVERY = 10; // Summarize every 10 tool calls

      // Send initial prompt
      let result = await chat.sendMessage(prompt.trim());
      iteration++;

      // Tool calling loop
      while (iteration < maxToolCalls) {
        const response = result.response;
        const functionCalls = response.functionCalls();

        if (!functionCalls || functionCalls.length === 0) {
          // No more tool calls - we have final answer
          const text = response.text();
          console.log(`[Rookie AI] Final response after ${iteration} iterations (${text.length} characters)`);
          console.log(`[Rookie AI] Total tool calls made: ${toolCallLog.length}`);

          // Parse JSON if needed
          let parsedJson: any = undefined;
          if (responseSchema) {
            try {
              parsedJson = parseJsonRobust(text);
              console.log('[Rookie AI] Successfully parsed JSON response');
            } catch (parseError) {
              console.error('[Rookie AI] Failed to parse JSON from tool calling result');
              // Continue without JSON
            }
          }

          return {
            text: text.trim(),
            json: parsedJson,
            raw: text,
            toolCalls: toolCallLog,
          };
        }

        // Execute all function calls
        console.log(`[Rookie AI] Iteration ${iteration}: ${functionCalls.length} tool call(s)`);
        const functionResponses = await Promise.all(
          functionCalls.map(async (call) => {
            console.log(`[Rookie AI] Executing tool: ${call.name}`, call.args);
            try {
              const toolResult = await toolExecutor(call.name, call.args);
              console.log(`[Rookie AI] Tool result:`, toolResult);

              toolCallLog.push({
                name: call.name,
                args: call.args,
                result: toolResult,
              });

              return {
                functionResponse: {
                  name: call.name,
                  response: toolResult,
                },
              };
            } catch (toolError: any) {
              console.error(`[Rookie AI] Tool execution error:`, toolError);
              return {
                functionResponse: {
                  name: call.name,
                  response: {
                    success: false,
                    error: toolError.message,
                  },
                },
              };
            }
          })
        );

        // Send function responses back to AI
        result = await chat.sendMessage(functionResponses);
        iteration++;

        // Periodic summarization to manage context
        if (iteration % SUMMARIZE_EVERY === 0 && iteration < maxToolCalls - 5) {
          console.log(`[Rookie AI] 📝 Checkpoint at iteration ${iteration} - requesting summary...`);

          // Ask AI to summarize what it's learned so far
          const summaryRequest = await chat.sendMessage([{
            functionResponse: {
              name: 'system_message',
              response: {
                message: `You've made ${iteration} tool calls so far. Briefly summarize what you've learned about this site (2-3 sentences). Then continue exploring.`,
              },
            },
          }]);

          const summary = summaryRequest.response.text();
          console.log(`[Rookie AI] Summary: ${summary.substring(0, 200)}...`);

          // Store cumulative summary
          cumulativeSummary += `\n[After ${iteration} calls]: ${summary}`;

          // Restart chat with summary to clear detailed history
          console.log('[Rookie AI] Restarting chat with summary to clear context...');
          const newChat = aiModel.startChat({
            history: [],
          });

          // Send condensed context
          result = await newChat.sendMessage(
            `${prompt}\n\n**What you've discovered so far:**${cumulativeSummary}\n\nContinue exploring where you left off.`
          );

          // Replace chat reference
          Object.assign(chat, newChat);
          iteration++;
        }
      }

      // Max iterations reached
      console.warn(`[Rookie AI] Max tool call iterations (${maxToolCalls}) reached`);
      const text = result.response.text();
      return {
        text: text.trim(),
        raw: text,
        toolCalls: toolCallLog,
      };
    }

    // No tools - simple generation
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
