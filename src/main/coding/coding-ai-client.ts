/**
 * Coding AI Client
 *
 * Simplified AI client specifically for coding tasks.
 * Unlike the Homepage Editor AI (gemini-autonomous-client), this client:
 * - Works directly on project folders without preview windows
 * - Knows the project context upfront
 * - Focuses on file editing and database queries
 * - Less exploration, more execution
 */

import { GoogleGenerativeAI, GenerationConfig, Content, Part } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { toolRegistry } from '../ai-code/tool-executor';
import { projectContextBridge } from '../ai-code/project-context-bridge';
import type {
  AIStreamEvent,
  ToolCallRequestInfo,
  ToolCallResponseInfo,
  ConversationMessage
} from '../types/ai-types';
import { AIEventType } from '../types/ai-types';

export interface CodingAIConfig {
  apiKey: string;
  projectPath: string;
  model?: string;
  provider?: 'gemini' | 'anthropic';
  maxTurns?: number;
  timeoutMs?: number;
}

export interface CodingAIStreamOptions {
  onEvent?: (event: AIStreamEvent) => void;
  conversationId?: string;
}

/**
 * Simplified system prompt for coding tasks - Vite specific
 */
function getViteCodingSystemPrompt(projectPath: string): string {
  return `You are an autonomous coding assistant helping the user work on their Vite project.

PROJECT CONTEXT:
- Project location: ${projectPath}
- Framework: Vite + React
- You have access to file operation tools (read_file, write_file, partial_edit, list_directory)
- You have access to user database tools (user_data_* tools)

CRITICAL BEHAVIOR GUIDELINES:
1. BE PROACTIVE AND AUTONOMOUS - Don't ask for clarification unless absolutely necessary. Make reasonable assumptions and implement working solutions.

2. When asked to connect to a database, follow these EXACT steps:
   Step 1: Call user_data_list_tables to discover available tables
   Step 2: Check if egdesk.config.ts and egdesk-helpers.ts exist (they should be auto-generated)
   Step 3: Call read_file on "src/App.jsx" or "src/App.tsx" (this is where the dashboard code is)
   Step 4: Implement the solution by IMPORTING egdesk-helpers.ts:
      - Import { queryTable } from '../egdesk-helpers' (from src/ folder, NO .ts extension!)
      - Use queryTable(tableName, { limit, orderBy, orderDirection }) to fetch data
      - NEVER make HTTP fetch() calls to localhost or /__user_data_proxy
      - The helpers handle authentication automatically using egdesk.config.ts

3. IMPORTANT FILE READING RULES:
   - For Vite/React projects, the main app file is almost always at src/App.jsx or src/App.tsx
   - Try reading src/App.jsx FIRST before exploring other directories
   - If that fails, use list_directory to see what files exist
   - Vite projects have a flat structure - don't waste time exploring nested directories

4. Use relative file paths (e.g., "src/App.jsx") - they resolve to the project directory

5. Make focused, precise changes - don't refactor unnecessarily

6. For Korean language requests, respond in Korean

TYPICAL VITE PROJECT STRUCTURE:
- src/App.jsx or src/App.tsx - Main app component
- vite.config.js or vite.config.ts - Vite configuration
- package.json - Dependencies
- src/main.jsx or src/main.tsx - Entry point
- egdesk.config.ts - Database table definitions (project root)
- egdesk-helpers.ts - Database helper functions (project root)

CRITICAL LESSONS FROM PAST MISTAKES:
1. **Use egdesk-helpers ALWAYS**: When connecting to user_data, IMPORT and use queryTable(), NOT HTTP fetch()
   - ✅ Correct: import { queryTable } from '../egdesk-helpers' (from src/ folder, NO .ts extension!)
   - ❌ Wrong: import { queryTable } from './egdesk-helpers.ts' (wrong path and has extension)
   - ❌ Wrong: fetch('http://localhost:8080/user-data/tools/call', ...) - causes CORS in tunneled environments
   - ❌ Wrong: fetch('/__user_data_proxy', ...) - use the helpers instead
2. **Import Path & Extension**: egdesk files are in project root, so from src/ use '../egdesk-helpers' (NO .ts!)
3. **Parameter Format**: EGDesk APIs use camelCase (tableName, orderBy, orderDirection), NOT snake_case
4. **Response Structure**: queryTable() returns { rows: [...], total: number }
   - ✅ Correct: const result = await queryTable('table1'); const data = result.rows;
   - ❌ Wrong: const data = result.data; (property doesn't exist - use .rows!)
5. **Check Auto-Generated Files**: Before implementing database access, check if egdesk.config.ts and egdesk-helpers.ts exist
6. **Client-Side Only**: egdesk-helpers is for client-side (React components), NOT vite.config.js or server middleware
7. **Proxy Architecture**: egdesk-helpers.ts uses fetch('/__user_data_proxy') which the vite-api-plugin proxies to localhost:8080 server-side. This works in both local and tunneled environments without CORS.
8. **File Path Assumptions**: Don't assume src/renderer/ structure. Always check list_directory output first
9. **Port Numbers**: NEVER assume port 5173. Check vite.config.js or package.json scripts

Be direct and efficient. When the user asks you to implement something, DO IT rather than asking for more details.`;
}

/**
 * Simplified system prompt for coding tasks - Next.js specific
 */
function getNextJSCodingSystemPrompt(projectPath: string): string {
  return `You are an autonomous coding assistant helping the user work on their Next.js project.

PROJECT CONTEXT:
- Project location: ${projectPath}
- Framework: Next.js (App Router with TypeScript)
- You have access to file operation tools (read_file, write_file, partial_edit, list_directory)
- You have access to user database tools (user_data_* tools)

CRITICAL BEHAVIOR GUIDELINES:
1. BE PROACTIVE AND AUTONOMOUS - Don't ask for clarification unless absolutely necessary. Make reasonable assumptions and implement working solutions.

2. When asked to connect to a database, follow these EXACT steps:
   Step 1: Call user_data_list_tables to discover available tables
   Step 2: Check if egdesk.config.ts and egdesk-helpers.ts exist (they should be auto-generated in project root)
   Step 3: Use list_directory to understand the project structure (src/app/ vs app/)
   Step 4: Implement the solution by IMPORTING egdesk-helpers.ts:
      - CALCULATE the correct relative path based on file depth
      - Import { queryTable } from '../../egdesk-helpers' (2 levels: from src/app/page.tsx)
      - Import { queryTable } from '../../../egdesk-helpers' (3 levels: from src/app/dashboard/page.tsx)
      - Import { queryTable } from '../../../../egdesk-helpers' (4 levels: from src/app/operations/03-inventory/page.tsx)
      - NO .ts extension in imports!
      - Use queryTable(tableName, { limit, orderBy, orderDirection }) to fetch data
      - NEVER make HTTP fetch() calls to localhost or /__user_data_proxy
      - The helpers handle authentication automatically using egdesk.config.ts

3. IMPORTANT FILE READING RULES:
   - Next.js App Router: pages are at src/app/*/page.tsx or app/*/page.tsx
   - ALWAYS use list_directory first to understand if project uses src/ or not
   - Next.js has deeply nested directories - be prepared to navigate multiple levels
   - Check tsconfig.json for path aliases (@ usually maps to ./src/*)

4. Use relative file paths (e.g., "src/app/page.tsx") - they resolve to the project directory

5. Make focused, precise changes - don't refactor unnecessarily

6. For Korean language requests, respond in Korean

7. **CRITICAL**: Add 'use client' directive at the top of files that use egdesk-helpers (they use useState, useEffect, etc.)

TYPICAL NEXT.JS PROJECT STRUCTURE:
- src/app/page.tsx - Home page (or app/page.tsx without src/)
- src/app/layout.tsx - Root layout
- src/app/[route]/page.tsx - Nested pages
- src/components/ - Shared components
- next.config.js or next.config.mjs - Next.js configuration
- tsconfig.json - TypeScript config (check "paths" for @ alias)
- egdesk.config.ts - Database table definitions (project root)
- egdesk-helpers.ts - Database helper functions (project root)
- proxy.ts or middleware.ts - Database proxy (in src/ or project root)

CRITICAL LESSONS FROM PAST MISTAKES:
1. **Use egdesk-helpers ALWAYS**: When connecting to user_data, IMPORT and use queryTable(), NOT HTTP fetch()
   - ✅ Correct: import { queryTable } from '../../../../egdesk-helpers' (count directory depth!)
   - ❌ Wrong: import { queryTable } from './egdesk-helpers.ts' (has .ts extension)
   - ❌ Wrong: import { queryTable } from '@/../../egdesk-helpers' (@ alias doesn't go outside src/)
   - ❌ Wrong: import { queryTable } from '../egdesk-helpers' (wrong depth - count carefully!)
   - ❌ Wrong: fetch('http://localhost:8080/user-data/tools/call', ...) - causes CORS in tunneled environments
   - ❌ Wrong: fetch('/__user_data_proxy', ...) - use the helpers instead

2. **Import Path Calculation**:
   - egdesk files are ALWAYS in project root (egdesk-helpers.ts, egdesk.config.ts)
   - Count how many directories deep your file is from project root
   - Use that many '../' to go back to root
   - Examples:
     * src/app/page.tsx → '../../egdesk-helpers' (2 levels)
     * src/app/dashboard/page.tsx → '../../../egdesk-helpers' (3 levels)
     * src/app/operations/03-inventory/page.tsx → '../../../../egdesk-helpers' (4 levels)
     * app/page.tsx (no src/) → '../egdesk-helpers' (1 level)
   - NEVER add .ts or .tsx extension to imports!

3. **Parameter Format**: EGDesk APIs use camelCase (tableName, orderBy, orderDirection), NOT snake_case

4. **Response Structure**: queryTable() returns { rows: [...], total: number }
   - ✅ Correct: const result = await queryTable('table1'); const data = result.rows;
   - ❌ Wrong: const data = result.data; (property doesn't exist - use .rows!)

5. **Check Auto-Generated Files**: Before implementing database access, check if egdesk.config.ts and egdesk-helpers.ts exist

6. **Client Components**: egdesk-helpers must be used in Client Components ('use client' directive). They use fetch() which is browser-only.

7. **Proxy Architecture**: egdesk-helpers.ts uses fetch('/__user_data_proxy') which proxy.ts (or middleware.ts) intercepts and proxies to localhost:8080 server-side. This works in both local and tunneled environments without CORS.

8. **File Path Assumptions**: Don't assume specific structure. Always use list_directory to check if src/ exists and how deep pages are nested.

9. **Port Numbers**: NEVER assume port 3000. Check package.json scripts or next.config.js

Be direct and efficient. When the user asks you to implement something, DO IT rather than asking for more details.`;
}

/**
 * Get appropriate system prompt based on framework
 */
function getCodingSystemPrompt(projectPath: string, framework?: 'vite' | 'nextjs'): string {
  if (framework === 'nextjs') {
    return getNextJSCodingSystemPrompt(projectPath);
  }
  // Default to Vite prompt for unknown or vite
  return getViteCodingSystemPrompt(projectPath);
}

/**
 * Convert conversation history to Gemini format
 */
function toGeminiHistory(messages: ConversationMessage[]): Content[] {
  const contents: Content[] = [];

  for (const msg of messages) {
    if (msg.role === 'user' || msg.role === 'model') {
      // If the message already has parts, use them directly
      if (msg.parts && msg.parts.length > 0) {
        contents.push({
          role: msg.role,
          parts: msg.parts
        });
      }
    }
  }

  return contents;
}

/**
 * Coding AI Client
 */
export class CodingAIClient {
  private genAI?: GoogleGenerativeAI;
  private anthropic?: Anthropic;
  private model: any;
  private projectPath: string;
  private conversationHistory: ConversationMessage[] = [];
  private maxTurns: number;
  private timeoutMs: number;
  private abortController?: AbortController;
  private provider: 'gemini' | 'anthropic';
  private modelName: string;
  private apiKey: string;

  constructor(config: CodingAIConfig) {
    this.projectPath = config.projectPath;
    this.maxTurns = config.maxTurns || 20;
    this.timeoutMs = config.timeoutMs || 300000;
    this.apiKey = config.apiKey;
    this.provider = config.provider || 'anthropic'; // Default to Anthropic
    this.modelName = config.model || (this.provider === 'anthropic' ? 'claude-sonnet-4-5-20250929' : 'gemini-2.5-flash');

    // Set project context for tools (this also detects framework)
    projectContextBridge.setTemporaryProjectPath(this.projectPath);

    // Detect framework for system prompt
    const framework = projectContextBridge.getProjectFramework();
    console.log(`🔍 Detected framework: ${framework}`);

    if (this.provider === 'anthropic') {
      this.anthropic = new Anthropic({ apiKey: config.apiKey });
      console.log(`🤖 Coding AI initialized with Claude ${this.modelName} for ${framework} project: ${this.projectPath}`);
    } else {
      this.genAI = new GoogleGenerativeAI(config.apiKey);
      const generationConfig: GenerationConfig = {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      };

      this.model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig,
        systemInstruction: getCodingSystemPrompt(this.projectPath, framework === 'vite' ? 'vite' : framework === 'nextjs' ? 'nextjs' : undefined)
      });
      console.log(`🤖 Coding AI initialized with Gemini for ${framework} project: ${this.projectPath}`);
    }
  }

  /**
   * Process a user message with streaming
   */
  async *processMessage(
    userMessage: string,
    options: CodingAIStreamOptions = {}
  ): AsyncGenerator<AIStreamEvent> {
    if (this.provider === 'anthropic') {
      yield* this.processMessageAnthropic(userMessage, options);
    } else {
      yield* this.processMessageGemini(userMessage, options);
    }
  }

  /**
   * Process message with Anthropic Claude
   */
  private async *processMessageAnthropic(
    userMessage: string,
    options: CodingAIStreamOptions = {}
  ): AsyncGenerator<AIStreamEvent> {
    const conversationId = options.conversationId || uuidv4();
    let turnCount = 0;
    this.abortController = new AbortController();

    // Get available tools in Anthropic format
    const availableTools = toolRegistry.getToolDefinitions()
      .filter(tool => {
        return tool.name.startsWith('user_data_') ||
               tool.name.startsWith('financehub_') ||
               ['read_file', 'write_file', 'partial_edit', 'list_directory'].includes(tool.name);
      });

    const anthropicTools = availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));

    console.log(`📦 Available tools: ${availableTools.map(t => t.name).join(', ')}`);

    // Get framework-specific system prompt
    const framework = projectContextBridge.getProjectFramework();
    const systemPrompt = getCodingSystemPrompt(this.projectPath, framework === 'vite' ? 'vite' : framework === 'nextjs' ? 'nextjs' : undefined);

    const messages: any[] = [{ role: 'user', content: userMessage }];

    try {
      while (turnCount < this.maxTurns) {
        turnCount++;
        console.log(`🔄 Turn ${turnCount}/${this.maxTurns}`);

        const response = await this.anthropic!.messages.create({
          model: this.modelName,
          max_tokens: 8192,
          system: systemPrompt,
          messages,
          tools: anthropicTools,
        });

        console.log('📥 Received response from Claude');

        // Handle tool calls
        if (response.stop_reason === 'tool_use') {
          const toolUseBlocks = response.content.filter((block: any) => block.type === 'tool_use');

          console.log('🔧 Executing', toolUseBlocks.length, 'tool call(s)');

          // Add assistant message to history
          messages.push({ role: 'assistant', content: response.content });

          const toolResults: any[] = [];

          for (const toolBlock of toolUseBlocks) {
            const toolCallId = toolBlock.id;
            const toolName = toolBlock.name;
            const toolInput = toolBlock.input;

            console.log('🔧 Calling tool:', toolName, 'with args:', JSON.stringify(toolInput));

            const toolCallRequest: ToolCallRequestInfo = {
              id: toolCallId,
              name: toolName,
              parameters: toolInput,
              timestamp: new Date(),
              turnNumber: turnCount,
              conversationId
            };

            yield {
              type: AIEventType.ToolCallRequest,
              conversationId,
              data: toolCallRequest,
              timestamp: new Date()
            };

            const toolResponse = await toolRegistry.executeToolCall(toolCallRequest, this.abortController?.signal);
            console.log('✅ Tool executed:', toolResponse.success ? 'success' : 'failed');

            yield {
              type: AIEventType.ToolCallResponse,
              conversationId,
              data: toolResponse,
              timestamp: new Date()
            };

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCallId,
              content: toolResponse.success ? JSON.stringify(toolResponse.result) : `Error: ${toolResponse.error}`
            });
          }

          // Add tool results to messages
          messages.push({ role: 'user', content: toolResults });

          console.log('🔄 Continuing to next turn after tool execution(s)');
          continue;
        }

        // Handle text response
        const textBlocks = response.content.filter((block: any) => block.type === 'text');
        if (textBlocks.length > 0) {
          const text = textBlocks.map((block: any) => block.text).join('\n');
          console.log('📝 Emitting text response:', text.substring(0, 100) + '...');

          yield {
            type: AIEventType.Content,
            conversationId,
            data: { delta: text, accumulated: text },
            timestamp: new Date()
          };

          yield {
            type: AIEventType.Finished,
            conversationId,
            data: { response: text, turnCount, finishReason: 'complete' },
            timestamp: new Date()
          };

          console.log('✅ Conversation complete after', turnCount, 'turns');
          return;
        }

        // Stop reason handling
        if (response.stop_reason === 'end_turn') {
          console.log('✅ Conversation complete (end_turn)');
          return;
        }
      }

      // Max turns reached
      yield {
        type: AIEventType.Error,
        conversationId,
        data: { error: `Maximum turns (${this.maxTurns}) reached` },
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Coding AI error:', error);
      yield {
        type: AIEventType.Error,
        conversationId,
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date()
      };
    }
  }

  /**
   * Process message with Gemini
   */
  private async *processMessageGemini(
    userMessage: string,
    options: CodingAIStreamOptions = {}
  ): AsyncGenerator<AIStreamEvent> {
    const conversationId = options.conversationId || uuidv4();
    let turnCount = 0;
    this.abortController = new AbortController();

    // Add user message to history
    this.addToHistory({
      role: 'user',
      parts: [{ text: userMessage }],
      timestamp: new Date()
    });

    // Get available tools in Gemini format
    const availableTools = toolRegistry.getToolDefinitions()
      .filter(tool => {
        // Include file tools, user_data tools, and financehub tools
        return tool.name.startsWith('user_data_') ||
               tool.name.startsWith('financehub_') ||
               ['read_file', 'write_file', 'partial_edit', 'list_directory'].includes(tool.name);
      });

    const geminiTools = [{
      functionDeclarations: availableTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }))
    }];

    console.log(`📦 Available tools: ${availableTools.map(t => t.name).join(', ')}`);

    try {
      // Autonomous loop: keep going until AI responds with text or max turns reached
      while (turnCount < this.maxTurns) {
        turnCount++;

        console.log(`🔄 Turn ${turnCount}/${this.maxTurns}`);

        console.log('📤 Sending to Gemini with history length:', this.conversationHistory.length);

        // Send to Gemini using generateContent (not startChat)
        const result = await this.model.generateContent({
          contents: toGeminiHistory(this.conversationHistory),
          tools: geminiTools
        });

        const response = result.response;

        console.log('📥 Received response from Gemini');

        // Check for function calls
        const candidates = response.candidates || [];
        if (candidates.length === 0) {
          throw new Error('No response candidates from Gemini');
        }

        const candidate = candidates[0];
        const content = candidate.content;

        if (!content || !content.parts) {
          throw new Error('No content parts in response');
        }

        console.log('📦 Response parts:', content.parts.length);
        console.log('📦 Parts types:', content.parts.map((p: any) => Object.keys(p).join(',')));

        // Check if there are function calls
        const functionCalls = content.parts.filter((part: any) => part.functionCall);
        console.log('🔧 Function calls:', functionCalls.length);

        if (functionCalls.length > 0) {
          console.log('🔧 Executing', functionCalls.length, 'function call(s)');

          // Execute all function calls
          for (const part of functionCalls) {
            const fc = part.functionCall;
            const toolCallId = uuidv4();

            console.log('🔧 Calling tool:', fc.name, 'with args:', JSON.stringify(fc.args));

            // Emit tool call request
            const toolCallRequest: ToolCallRequestInfo = {
              id: toolCallId,
              name: fc.name,
              parameters: fc.args,
              timestamp: new Date(),
              turnNumber: turnCount,
              conversationId
            };

            yield {
              type: AIEventType.ToolCallRequest,
              conversationId,
              data: toolCallRequest,
              timestamp: new Date()
            };

            // Execute the tool
            console.log('⚙️ Executing tool...');
            const toolResponse = await toolRegistry.executeToolCall(toolCallRequest, this.abortController?.signal);
            console.log('✅ Tool executed:', toolResponse.success ? 'success' : 'failed');

            // Emit tool call response
            yield {
              type: AIEventType.ToolCallResponse,
              conversationId,
              data: toolResponse,
              timestamp: new Date()
            };

            // Add function call to history (model role)
            this.addToHistory({
              role: 'model',
              parts: [part],
              timestamp: new Date()
            });

            // Add function response to history (user role, per Gemini spec)
            this.addToHistory({
              role: 'user',
              parts: [{
                functionResponse: {
                  name: fc.name,
                  response: toolResponse.success
                    ? { result: toolResponse.result }
                    : { error: toolResponse.error }
                }
              }],
              timestamp: new Date(),
              toolCallId,
              toolStatus: toolResponse.success ? 'completed' : 'failed'
            });
          }

          // Continue to next turn to get AI's interpretation of results
          console.log('🔄 Continuing to next turn after tool execution(s)');
          continue;
        }

        // No function calls - check for text response
        const textParts = content.parts.filter((part: any) => part.text);
        console.log('📝 Text parts:', textParts.length);

        if (textParts.length > 0) {
          const text = textParts.map((part: any) => part.text).join('');
          console.log('📝 Emitting text response:', text.substring(0, 100) + '...');

          // Add to history
          this.addToHistory({
            role: 'model',
            parts: textParts,
            timestamp: new Date()
          });

          // Emit content event
          yield {
            type: AIEventType.Content,
            conversationId,
            data: {
              delta: text,
              accumulated: text
            },
            timestamp: new Date()
          };

          // Emit finished event
          yield {
            type: AIEventType.Finished,
            conversationId,
            data: {
              response: text,
              turnCount,
              finishReason: 'complete'
            },
            timestamp: new Date()
          };

          console.log('✅ Conversation complete after', turnCount, 'turns');
          return; // Done
        }

        // Neither function calls nor text - something went wrong
        console.error('❌ Response contained neither function calls nor text');
        console.error('Parts:', JSON.stringify(content.parts, null, 2));
        throw new Error('Response contained neither function calls nor text');
      }

      // Max turns reached
      yield {
        type: AIEventType.Error,
        conversationId,
        data: { error: `Maximum turns (${this.maxTurns}) reached` },
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Coding AI error:', error);

      yield {
        type: AIEventType.Error,
        conversationId,
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date()
      };
    } finally {
      this.abortController = undefined;
    }
  }

  /**
   * Add message to conversation history
   */
  private addToHistory(message: ConversationMessage): void {
    this.conversationHistory.push(message);
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Abort current processing
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.abort();
    projectContextBridge.clearTemporaryProject();
  }
}
