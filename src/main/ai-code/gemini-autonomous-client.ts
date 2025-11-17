/**
 * Autonomous Gemini AI Client Service
 * Implements streaming conversation loops with tool execution
 * Based on Gemini CLI patterns adapted for EGDesk
 */

import { GoogleGenerativeAI, GenerationConfig, Content, Part, FunctionCall, Tool } from '@google/generative-ai';
import { ipcMain } from 'electron';
const { v4: uuidv4 } = require('uuid');
import { fetch as undiciFetch, Agent } from 'undici';
import { toolRegistry } from './tool-executor';
import { loopDetectionService } from './loop-detection';
import { projectContextBridge } from './project-context-bridge';
import { getEGDeskSystemPrompt } from './prompts/system-prompt';
import { getSQLiteManager } from '../sqlite/manager';
import { AIChatDatabase, conversationMessageToAIMessage } from '../sqlite/ai';
import { ollamaManager } from '../ollama/installer';
import type { 
  AIClientConfig, 
  ConversationMessage, 
  AIResponse, 
  AIClientService,
  AIStreamEvent,
  ToolCallRequestInfo,
  ToolCallResponseInfo,
  ConversationState,
  ConversationTurn,
  ToolDefinition
} from '../types/ai-types';
import { AIEventType } from '../types/ai-types';

export class AutonomousGeminiClient implements AIClientService {
  private genAI?: GoogleGenerativeAI;
  private model?: any;
  private config?: AIClientConfig;
  private conversationHistory: ConversationMessage[] = [];
  private conversationState: ConversationState | null = null;
  private abortController?: AbortController;
  private mode: 'gemini' | 'ollama' = 'gemini';
  private currentModelId: string = 'gemini-2.5-flash';
  private ollamaChatHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  private availableOllamaModels: Set<string> = new Set();
  
  // Event buffering for conversations
  private conversationEventBuffers = new Map<string, AIStreamEvent[]>();
  private conversationSenders = new Map<string, Electron.WebContents>();
  
  // SQLite integration
  private sqliteManager = getSQLiteManager();
  private aiChatDb?: AIChatDatabase;
  private currentConversationId?: string;

  constructor() {
    this.initializeSQLite();
    this.registerIPCHandlers();
  }

  private isOllamaModel(model?: string): boolean {
    if (!model) return false;
    return model.startsWith('ollama:') || model.startsWith('gemma');
  }

  private normalizeOllamaModel(model: string): string {
    const trimmed = model.trim();
    return trimmed.startsWith('ollama:') ? trimmed.substring('ollama:'.length) : trimmed;
  }

  public updateOllamaModelAvailability(model: string, available: boolean): void {
    const normalized = this.normalizeOllamaModel(model);
    if (available) {
      this.availableOllamaModels.add(normalized);
    } else {
      this.availableOllamaModels.delete(normalized);
    }
  }

  /**
   * Initialize SQLite database for AI chat storage
   */
  private async initializeSQLite(): Promise<void> {
    try {
      const result = await this.sqliteManager.initialize();
      if (result.success) {
        this.aiChatDb = new AIChatDatabase(this.sqliteManager.getDatabase());
        console.log('✅ SQLite database initialized for AI chat storage');
      } else {
        console.error('❌ Failed to initialize SQLite for AI chat:', result.error);
      }
    } catch (error) {
      console.error('❌ Error initializing SQLite for AI chat:', error);
    }
  }

  /**
   * Configure the Gemini client
   */
  async configure(config: AIClientConfig): Promise<boolean> {
    try {
      const targetModel = (config.model || 'gemini-2.5-flash').trim();
      this.currentModelId = targetModel;
      this.config = { ...config, model: targetModel };

      if (this.isOllamaModel(targetModel)) {
        const normalizedModel = this.normalizeOllamaModel(targetModel);
        const isAvailable = this.availableOllamaModels.has(normalizedModel)
          ? true
          : await ollamaManager.hasModel(normalizedModel);

        if (!isAvailable) {
          throw new Error(`Ollama model "${normalizedModel}" is not installed or ready. Please install it first.`);
        }

        this.availableOllamaModels.add(normalizedModel);
        this.mode = 'ollama';
        this.genAI = undefined;
        this.model = undefined;
        this.conversationHistory = [];
        this.ollamaChatHistory = [];

        const projectContext = await this.getProjectContext();
        const systemPrompt = getEGDeskSystemPrompt(projectContext || undefined);
        if (systemPrompt && systemPrompt.trim().length > 0) {
          this.ollamaChatHistory.push({
            role: 'system',
            content: systemPrompt
          });
        }

        console.log(`✅ Ollama client configured with local model "${normalizedModel}"`);
        return true;
      }

      // Default to Gemini cloud workflow
      this.genAI = new GoogleGenerativeAI(config.apiKey);

      const projectContext = await this.getProjectContext();
      const systemPrompt = getEGDeskSystemPrompt(projectContext || undefined);

      this.model = this.genAI.getGenerativeModel({
        model: targetModel,
        generationConfig: {
          temperature: config.temperature || 0.7,
          topP: config.topP || 0.8,
          maxOutputTokens: config.maxOutputTokens || 4096,
        },
        systemInstruction: systemPrompt
      });

      this.mode = 'gemini';
      this.ollamaChatHistory = [];

      console.log('✅ Autonomous Gemini client configured with EGDesk system prompt');
      return true;
    } catch (error) {
      console.error('❌ Failed to configure Gemini client:', error);
      return false;
    }
  }

  /**
   * Check if client is configured
   */
  isConfigured(): boolean {
    if (this.mode === 'ollama') {
      return !!this.currentModelId;
    }
    return !!(this.genAI && this.model && this.config);
  }


  /**
   * NEW: Autonomous streaming conversation with tool execution
   */
  async *sendMessageStream(
    message: string, 
    options: {
      tools?: ToolDefinition[];
      maxTurns?: number;
      timeoutMs?: number;
      autoExecuteTools?: boolean;
      context?: Record<string, any>;
    } = {}
  ): AsyncGenerator<AIStreamEvent> {
    if (!this.isConfigured()) {
      yield {
        type: AIEventType.Error,
        error: { message: 'AI client not configured', recoverable: false },
        timestamp: new Date()
      };
      return;
    }

    if (this.mode === 'ollama') {
      yield* this.sendMessageStreamOllama(message, options);
      return;
    }

    // Initialize conversation state
    const sessionId = uuidv4();
    this.conversationState = {
      sessionId,
      turns: [],
      currentTurn: 0,
      isActive: true,
      maxTurns: options.maxTurns || 20,
      timeoutMs: options.timeoutMs || 300000, // 5 minutes
      startTime: new Date(),
      context: options.context
    };

    // Create conversation in SQLite
    this.currentConversationId = sessionId;
    await this.createConversationInSQLite(sessionId, message, options.context);

    // Setup abort controller for cancellation
    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      this.abortController?.abort();
    }, this.conversationState.timeoutMs);

    // Reset loop detection
    loopDetectionService.reset();

    try {
      console.log('🛠️ Getting available tools...');
      // Get available tools
      const availableTools = options.tools || toolRegistry.getToolDefinitions();
      console.log('📋 Available tools:', availableTools.map(t => t.name));
      
      const geminiTools: Tool[] = this.convertToolsForGemini(availableTools);
      const totalFunctions = geminiTools.reduce((sum, tool) => sum + ((tool as any).functionDeclarations?.length || 0), 0);
      console.log('🔧 Converted tools for Gemini:', `${geminiTools.length} tool objects containing ${totalFunctions} functions`);

      // Start conversation loop
      console.log('🚀 Starting conversation loop...');
      yield* this.conversationLoop(message, geminiTools, options.autoExecuteTools || true);

    } catch (error) {
      yield {
        type: AIEventType.Error,
        error: { 
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: false 
        },
        timestamp: new Date()
      };
    } finally {
      clearTimeout(timeoutId);
      this.conversationState = null;
      this.abortController = undefined;
    }
  }

  private async *sendMessageStreamOllama(
    message: string,
    options: {
      tools?: ToolDefinition[];
      maxTurns?: number;
      timeoutMs?: number;
      autoExecuteTools?: boolean;
      context?: Record<string, any>;
    } = {}
  ): AsyncGenerator<AIStreamEvent> {
    const sessionId = uuidv4();
    const timeoutMs = options.timeoutMs || 300000;

    this.conversationState = {
      sessionId,
      turns: [],
      currentTurn: 0,
      isActive: true,
      maxTurns: options.maxTurns || 1,
      timeoutMs,
      startTime: new Date(),
      context: options.context
    };

    this.abortController = new AbortController();

    const routeHint = this.buildRouteHint();
    let contextualMessage = routeHint ? `${routeHint}\n\n${message}` : message;

    if (options.context?.attachedFiles?.length) {
      const attachments = options.context.attachedFiles
        .map((file: any) => file.filePath || file.path)
        .filter(Boolean);
      if (attachments.length > 0) {
        contextualMessage = `${contextualMessage}\n\nAttached files: ${attachments.join(', ')}`;
      }
    }

    this.addToHistory({
      role: 'user',
      parts: [{ text: contextualMessage }],
      timestamp: new Date()
    });

    this.ollamaChatHistory.push({
      role: 'user',
      content: contextualMessage
    });

    const controller = this.abortController;
    const normalizedModel = this.normalizeOllamaModel(this.currentModelId);

    try {
      // Emit TurnStarted so frontend creates a message bubble
      yield {
        type: AIEventType.TurnStarted,
        turnNumber: 1,
        timestamp: new Date()
      };

      // Use undici fetch with increased headers timeout (5 minutes) for Ollama
      // Ollama can take time to respond, especially with large models or heavy workloads
      const agent = new Agent({
        headersTimeout: timeoutMs, // Use the timeout from options (default 5 minutes)
        bodyTimeout: timeoutMs,
      });

      const response = await undiciFetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller?.signal,
        body: JSON.stringify({
          model: normalizedModel,
          messages: this.ollamaChatHistory,
          stream: true,
        }),
        dispatcher: agent,
      });

      if (!response.ok) {
        throw new Error(`Ollama chat request failed (${response.status} ${response.statusText})`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Ollama streaming response does not contain a readable body.');
      }

      let assistantText = '';
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim().length > 0);

        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            const chunkText = json?.message?.content?.map?.((entry: any) => entry?.text || '').join('')
              || json?.message?.content?.text
              || json?.message?.content
              || json?.response
              || '';

            if (chunkText) {
              assistantText += chunkText;
              yield {
                type: AIEventType.Content,
                content: chunkText,
                timestamp: new Date()
              };
            }

            if (json?.done) {
              if (json?.message?.content) {
                const finalText = Array.isArray(json.message.content)
                  ? json.message.content.map((entry: any) => entry?.text || '').join('')
                  : (json.message.content?.text || json.message.content || '');
                if (finalText && !assistantText.includes(finalText)) {
                  assistantText += finalText;
                }
              }
              break;
            }
          } catch (err) {
            console.warn('Failed to parse Ollama stream chunk:', line, err);
          }
        }
      }

      if (!assistantText) {
        assistantText = 'No response generated by the local model.';
      }

      this.ollamaChatHistory.push({
        role: 'assistant',
        content: assistantText
      });

      this.addToHistory({
        role: 'model',
        parts: [{ text: assistantText }],
        timestamp: new Date()
      });

      // Emit TurnCompleted so frontend knows the message is complete
      yield {
        type: AIEventType.TurnCompleted,
        turnNumber: 1,
        timestamp: new Date()
      };

      yield {
        type: AIEventType.Finished,
        reason: 'tool_calls_complete',
        timestamp: new Date()
      };
    } catch (error: any) {
      const messageText =
        error?.name === 'AbortError'
          ? 'Conversation cancelled.'
          : (error instanceof Error ? error.message : 'Unknown error communicating with Ollama.');

      yield {
        type: error?.name === 'AbortError' ? AIEventType.UserCancelled : AIEventType.Error,
        ...(error?.name === 'AbortError'
          ? {}
          : {
              error: {
                message: messageText,
                recoverable: false,
              },
            }),
        timestamp: new Date()
      } as any;
    } finally {
      if (this.conversationState) {
        this.conversationState.isActive = false;
      }
      this.abortController = undefined;
      this.conversationState = null;
    }
  }

  /**
   * Main conversation loop - the heart of autonomous operation
   */
  private async *conversationLoop(
    initialMessage: string, 
    tools: Tool[], 
    autoExecuteTools: boolean
  ): AsyncGenerator<AIStreamEvent> {
    console.log('🔄 Starting conversation loop with message:', initialMessage);
    console.log('🛠️ Available tools:', tools.length);
    console.log('tools:', tools);
    
    let currentMessage = initialMessage;
    let turnNumber = 0;

    // Add initial user message to history
    this.addToHistory({
      role: 'user',
      parts: [{ text: currentMessage }],
      timestamp: new Date()
    });

    while (this.conversationState?.isActive && turnNumber < this.conversationState.maxTurns) {
      if (this.abortController?.signal.aborted) {
        yield {
          type: AIEventType.UserCancelled,
          timestamp: new Date()
        } as any;
        break;
      }

      turnNumber++;
      yield {
        type: AIEventType.TurnStarted,
        turnNumber,
        timestamp: new Date()
      };

      // Create new turn
      const turn: ConversationTurn = {
        turnNumber,
        toolCalls: [],
        toolResponses: [],
        startTime: new Date(),
        status: 'active'
      };

      this.conversationState.turns.push(turn);
      this.conversationState.currentTurn = turnNumber;

      try {
        // Prefix the user message with a concise route hint if available
        console.log('🔍 Using route hint when available to provide current path/url context');
        const routeHint = this.buildRouteHint();
        let contextualMessage = routeHint ? `${routeHint}\n\n${currentMessage}` : currentMessage;

        // if image files are in the context, add them to the message
        if (this.conversationState.context?.attachedFiles) {
          contextualMessage = `${contextualMessage}\n\nAttached files: ${this.conversationState.context.attachedFiles.map((f: any) => f.filePath).join(', ')}`;
        }

        // Send message to Gemini with tools
        const result = await this.model!.generateContent({
          contents: [
            ...this.getConversationHistoryForGemini(),
            { role: 'user', parts: [{ text: contextualMessage }] }
          ],
          tools: tools.length > 0 ? tools : undefined
        });

        const response = await result.response;
        const candidates = response.candidates || [];
        
        if (candidates.length === 0) {
          throw new Error('No response candidates from Gemini');
        }

        const candidate = candidates[0];
        const content = candidate.content;

        // Process response content
        if (content?.parts) {
          for (const part of content.parts) {
            // Handle text content
            if (part.text) {
              // Stream the text in chunks for better UX
              yield* this.streamTextContent(part.text);

              // Check for response loops
              if (loopDetectionService.checkResponseLoop(part.text)) {
                yield {
                  type: AIEventType.LoopDetected,
                  pattern: 'Repetitive AI responses detected',
                  timestamp: new Date()
                };
                this.conversationState.isActive = false;
                break;
              }
            }

            // Handle function calls
            if (part.functionCall) {
              const toolCallRequest: ToolCallRequestInfo = {
                id: uuidv4(),
                name: part.functionCall.name || 'unknown',
                parameters: part.functionCall.args || {},
                timestamp: new Date(),
                turnNumber,
                conversationId: this.currentConversationId
              };

              // Check for tool call loops
              if (loopDetectionService.checkToolCallLoop(toolCallRequest)) {
                yield {
                  type: AIEventType.LoopDetected,
                  pattern: 'Repetitive tool calls detected',
                  timestamp: new Date()
                };
                this.conversationState.isActive = false;
                break;
              }

              turn.toolCalls.push(toolCallRequest);

              // Add tool call to conversation history as a model turn with functionCall
              this.addToHistory({
                role: 'model',
                parts: [part],
                timestamp: new Date(),
                toolCallId: toolCallRequest.id,
                toolStatus: 'executing'
              });

              yield {
                type: AIEventType.ToolCallRequest,
                toolCall: toolCallRequest,
                timestamp: new Date()
              };

              // Execute tool if auto-execution is enabled
              if (autoExecuteTools) {
                console.log('🔧 Executing tool call:', toolCallRequest.name, 'with params:', toolCallRequest.parameters);
                
                const toolResponse = await toolRegistry.executeToolCall(
                  toolCallRequest, 
                  this.abortController?.signal
                );

                console.log('🔧 Tool response:', {
                  success: toolResponse.success,
                  error: toolResponse.error,
                  resultType: typeof toolResponse.result,
                  result: toolResponse.result
                });

                turn.toolResponses.push(toolResponse);

                yield {
                  type: AIEventType.ToolCallResponse,
                  response: toolResponse,
                  timestamp: new Date()
                };

                // Add tool response to conversation history
                this.addToHistory({
                  role: 'model',
                  parts: [part],
                  timestamp: new Date()
                });

                this.addToHistory({
                  role: 'model',
                  parts: [{
                    functionResponse: {
                      name: toolCallRequest.name,
                      response: toolResponse.success 
                        ? (typeof toolResponse.result === 'object' && !Array.isArray(toolResponse.result)
                            ? toolResponse.result  // Already an object, use directly
                            : { result: toolResponse.result })  // Wrap primitives and arrays
                        : { error: toolResponse.error }
                    }
                  }],
                  timestamp: new Date(),
                  toolCallId: toolCallRequest.id,
                  toolStatus: toolResponse.success ? 'completed' : 'failed'
                });

                // Continue conversation with tool result and context
                if (toolResponse.success) {
                  // Provide context-aware continuation message based on the tool and result
                  currentMessage = this.generateContinuationMessage(toolCallRequest.name, toolResponse.result, initialMessage);
                  console.log('🔄 Generated continuation message:', currentMessage.substring(0, 200) + '...');
                } else {
                  currentMessage = `Tool execution failed: ${toolResponse.error}. Please try a different approach or fix the issue.`;
                  console.log('❌ Tool execution failed, generated error message');
                }
              }
            }
          }
        }

        // Mark turn as completed
        turn.endTime = new Date();
        turn.status = 'completed';

        // Save turn data to SQLite
        this.saveTurnToSQLite(turn);

        yield {
          type: AIEventType.TurnCompleted,
          turnNumber,
          timestamp: new Date()
        };

        // Check if conversation should continue
        const shouldContinue = this.shouldContinueConversation(turn, response);
        console.log('🔄 Conversation continuation check:', {
          shouldContinue,
          toolCallsInTurn: turn.toolCalls.length,
          finishReason: response.candidates?.[0]?.finishReason,
          turnNumber,
          maxTurns: this.conversationState?.maxTurns
        });
        
        if (!shouldContinue) {
          console.log('🏁 Conversation ending: AI indicated completion');
          yield {
            type: AIEventType.Finished,
            reason: 'tool_calls_complete',
            timestamp: new Date()
          };
          break;
        }

      } catch (error) {
        turn.status = 'error';
        turn.endTime = new Date();

        const isRecoverable = !this.abortController?.signal.aborted;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        console.error('❌ Error in conversation turn:', errorMessage);
        console.error('❌ Error details:', error);
        
        yield {
          type: AIEventType.Error,
          error: {
            message: errorMessage,
            recoverable: isRecoverable
          },
          timestamp: new Date()
        };

        if (!isRecoverable) break;
      }
    }

    // Conversation ended
    if (this.conversationState) {
      this.conversationState.isActive = false;
    }

    yield {
      type: AIEventType.Finished,
      reason: turnNumber >= (this.conversationState?.maxTurns || 20) ? 'max_turns' : 'tool_calls_complete',
      timestamp: new Date()
    };
  }

  /**
   * Build a one-line route hint for the model from conversation context
   */
  private buildRouteHint(): string | null {
    try {
      const ctx: any = (this.conversationState as any)?.context || {};
      const currentPath = ctx.currentPath as string | undefined;
      const currentUrl = ctx.currentUrl as string | undefined;
      const projectPath = ctx.projectPath as string | undefined;
      if (!currentPath && !currentUrl) return null;
      const parts: string[] = [];
      if (currentPath) parts.push(`route: ${currentPath}`);
      if (currentUrl) parts.push(`url: ${currentUrl}`);
      const suggestedDir = this.deriveSuggestedDir(projectPath, currentPath);
      // Also nudge the model to list directory and read likely files first, with a concrete dirPath
      const dirNudge = suggestedDir ? `Use list_directory with dirPath: ${suggestedDir}. Then read_file likely candidates (e.g., index.php, inc/header.php).` : `First list that route's directory, then open likely files (e.g., index.php or matching templates).`;
      return `Currently viewing (${parts.join(', ')}). ${dirNudge}`;
    } catch {
      return null;
    }
  }

  /**
   * Heuristically derive a filesystem directory for the current route
   */
  private deriveSuggestedDir(projectPath?: string, currentPath?: string): string | null {
    try {
      if (!projectPath) return null;
      const root = projectPath.replace(/\\+/g, '/');
      const pathPart = (currentPath || '/').replace(/\?.*$/, '').replace(/\/+/g, '/');
      // Common PHP site structure: use www as web root when present
      const wwwRoot = `${root}/www`;
      const hasWww = require('fs').existsSync(wwwRoot);
      const base = hasWww ? wwwRoot : root;
      // Handle locale prefix like /en_v1
      const segs = pathPart.split('/').filter(Boolean);
      let rel = '';
      if (segs.length === 0) {
        rel = '';
      } else if (segs[0].match(/^en(_v\d+)?$/) || segs[0].startsWith('en_') || segs[0] === 'en_v1') {
        rel = segs.slice(0, 2).join('/'); // e.g., en_v1 or en_v1/index.php
      } else {
        rel = segs.join('/');
      }
      const candidate = `${base}/${rel}`.replace(/\/+$|\/$/g, '');
      return candidate || base;
    } catch {
      return null;
    }
  }

  /**
   * Generate a context-aware continuation message after tool execution
   */
  private generateContinuationMessage(toolName: string, toolResult: any, originalRequest: string): string {
    switch (toolName) {
      case 'analyze_project':
        return `Project analysis completed. Based on the analysis, the project is a ${toolResult.analysis?.projectType || 'Unknown'} project with ${toolResult.analysis?.totalFiles || 0} files. Now please continue with the original request: "${originalRequest}". Use the project analysis data to inform your next actions.`;
      
      case 'list_directory':
        const fileCount = Array.isArray(toolResult) ? toolResult.length : 0;
        return `Directory listing completed, found ${fileCount} items. Please continue with the original request: "${originalRequest}". Use this directory information to guide your next steps.`;
      
      case 'read_file':
        const contentLength = typeof toolResult === 'string' ? toolResult.length : 0;
        return `File read completed (${contentLength} characters). Please continue with the original request: "${originalRequest}". Use the file content to inform your next actions.`;
      
      case 'write_file':
        return `File write completed successfully. Please continue with the original request: "${originalRequest}". Consider what additional files or documentation might be needed.`;
      
      default:
        return `Tool "${toolName}" execution completed. Result: ${JSON.stringify(toolResult)}. Please continue with the original request: "${originalRequest}".`;
    }
  }

  /**
   * Determine if conversation should continue
   */
  private shouldContinueConversation(turn: ConversationTurn, response: any): boolean {
    // Check finish reason first - if AI explicitly says STOP, respect that
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === 'STOP') {
      // Only stop if there were no tool calls in this turn (AI is truly done)
      return turn.toolCalls.length > 0;
    }

    // Continue if there were tool calls (AI needs to process results)
    if (turn.toolCalls.length > 0) {
      return true;
    }

    // Check if the AI response contains completion indicators
    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const completionIndicators = [
      'task completed',
      'documentation created',
      'analysis complete',
      'all files created',
      'project documentation is now complete'
    ];
    
    if (completionIndicators.some(indicator => responseText.toLowerCase().includes(indicator))) {
      return false;
    }

    // Continue for other reasons (SAFETY, LENGTH, etc.) but with limits
    return true;
  }

  /**
   * Stream text content in chunks for better UX
   */
  private async *streamTextContent(text: string): AsyncGenerator<AIStreamEvent> {
    // Split text into words for more natural streaming
    const words = text.split(/(\s+)/);
    let currentChunk = '';
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      currentChunk += word;
      
      // Yield chunk every few words or at punctuation
      const shouldYield = 
        i === words.length - 1 || // Last word
        currentChunk.length > 50 || // Chunk size limit
        /[.!?]\s*$/.test(currentChunk) || // End of sentence
        (i > 0 && i % 3 === 0); // Every 3 words
      
      if (shouldYield) {
        yield {
          type: AIEventType.Content,
          content: currentChunk,
          timestamp: new Date()
        };
        currentChunk = '';
        
        // Small delay between chunks for streaming effect
        if (i < words.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
  }

  /**
   * Convert tool definitions to Gemini format
   */
  private convertToolsForGemini(tools: ToolDefinition[]): Tool[] {
    return [{
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as any // Cast to bypass type issues
      }))
    } as any]; // Cast the whole tool object
  }

  /**
   * Get conversation history in Gemini format
   */
  private getConversationHistoryForGemini(): Content[] {
    return this.conversationHistory.map(msg => ({
      role: msg.role,
      parts: msg.parts
    }));
  }

  /**
   * Get project context for AI
   */
  private async getProjectContext(): Promise<string | null> {
    try {
      // Use the full project context string that includes tool instructions and exploration strategy
      return projectContextBridge.getProjectContextString();
    } catch {
      return null;
    }
  }


  async executeToolCall(request: ToolCallRequestInfo): Promise<ToolCallResponseInfo> {
    return toolRegistry.executeToolCall(request);
  }

  addToHistory(message: ConversationMessage): void {
    this.conversationHistory.push(message);
    
    // Keep history manageable (last 50 messages)
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50);
    }
  }

  getHistory(): ConversationMessage[] {
    // Return in-memory history for current session
    return [...this.conversationHistory];
  }

  clearHistory(): void {
    this.conversationHistory = [];
    if (this.ollamaChatHistory.length > 0) {
      this.ollamaChatHistory = this.ollamaChatHistory.filter(entry => entry.role === 'system');
    }
  }

  /**
   * Get conversation history from SQLite
   */
  async getConversationHistory(conversationId: string): Promise<ConversationMessage[]> {
    if (!this.aiChatDb) {
      console.warn('⚠️ AI Chat database not available, returning empty history');
      return [];
    }

    try {
      const messages = this.aiChatDb.getMessages(conversationId);
      return messages.map(msg => ({
        role: msg.role === 'tool' ? 'model' : msg.role as 'user' | 'model',
        parts: [{ text: msg.content }],
        timestamp: new Date(msg.timestamp),
        toolCallId: msg.tool_call_id,
        toolStatus: msg.tool_status
      }));
    } catch (error) {
      console.error('❌ Failed to get conversation history from SQLite:', error);
      return [];
    }
  }

  getConversationState(): ConversationState | null {
    return this.conversationState ? { ...this.conversationState } : null;
  }

  cancelConversation(): void {
    if (this.conversationState?.isActive) {
      this.conversationState.isActive = false;
      this.abortController?.abort();
    }
  }

  isConversationActive(): boolean {
    return this.conversationState?.isActive || false;
  }

  getAvailableModels(): string[] {
    const cloudModels = [
      'gemini-2.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-1.0-pro'
    ];

    const localModels = Array.from(this.availableOllamaModels).map(model => `ollama:${model}`);

    return [...cloudModels, ...localModels];
  }

  /**
   * Register IPC handlers for renderer communication
   */
  private registerIPCHandlers(): void {
    // Legacy handlers
    ipcMain.handle('ai-configure', async (event, config: AIClientConfig) => {
      return await this.configure(config);
    });

    ipcMain.handle('ai-is-configured', async () => {
      return this.isConfigured();
    });


    // New streaming handlers
    ipcMain.handle('ai-start-autonomous-conversation', async (event, message: string, options: any) => {
      console.log('🎯 IPC: ai-start-autonomous-conversation called with:', message);
      
      // Return a conversation ID for tracking
      const conversationId = uuidv4();
      console.log('🆔 Generated conversation ID:', conversationId);
      
      // Initialize event buffer and store sender for this conversation
      this.conversationEventBuffers.set(conversationId, []);
      this.conversationSenders.set(conversationId, event.sender);
      
      // Start streaming in background with a small delay to allow renderer to register event handlers
      setTimeout(async () => {
        try {
          console.log('🔄 Starting autonomous conversation stream...');
          for await (const streamEvent of this.sendMessageStream(message, options)) {
            console.log('📡 Buffering stream event:', streamEvent.type);
            this.bufferEvent(conversationId, streamEvent);
          }
          console.log('✅ Autonomous conversation stream completed');
          
          // Clean up conversation resources after completion
          setTimeout(() => {
            this.cleanupConversation(conversationId);
          }, 5000); // Clean up after 5 seconds to allow final events to be processed
        } catch (error) {
          console.error('❌ Error in autonomous conversation stream:', error);
          this.bufferEvent(conversationId, {
            type: AIEventType.Error,
            error: { message: error instanceof Error ? error.message : 'Unknown error', recoverable: false },
            timestamp: new Date()
          });
        }
      }, 100); // 100ms delay to allow renderer to register event handlers

      return { conversationId };
    });

    // Add handler for renderer to signal it's ready to receive events
    ipcMain.handle('ai-conversation-ready', async (event, conversationId: string) => {
      console.log('🎯 Renderer ready for conversation:', conversationId);
      console.log('🎯 Event sender:', event.sender);
      
      // Store the sender for immediate event transmission
      this.conversationSenders.set(conversationId, event.sender);
      console.log('🎯 Stored sender for conversation:', conversationId);
      console.log('🎯 Total senders:', this.conversationSenders.size);
      
      // Flush any buffered events
      this.flushEventBuffer(conversationId);
      return true;
    });

    ipcMain.handle('ai-cancel-conversation', async () => {
      this.cancelConversation();
      return true;
    });

    ipcMain.handle('ai-get-conversation-state', async () => {
      return this.getConversationState();
    });

    // History and utility handlers
    ipcMain.handle('ai-get-history', async () => {
      return this.getHistory();
    });

    ipcMain.handle('ai-clear-history', async () => {
      this.clearHistory();
      return true;
    });

    ipcMain.handle('ai-get-models', async () => {
      return this.getAvailableModels();
    });

    // Tool confirmation handlers
    ipcMain.handle('ai-tool-confirm', async (event, requestId: string, approved: boolean) => {
      const result = await toolRegistry.confirmToolExecution(requestId, approved);
      return result;
    });

    ipcMain.handle('ai-get-tool-definitions', async () => {
      return toolRegistry.getToolDefinitions();
    });

    // Simple image send handler: send an image file to Gemini with optional prompt
    ipcMain.handle('ai-send-image', async (event, filePath: string, prompt?: string) => {
      try {
        if (!this.isConfigured()) {
          return { success: false, error: 'AI client not configured' };
        }
        const fs = require('fs');
        const path = require('path');

        if (!filePath || !fs.existsSync(filePath)) {
          return { success: false, error: 'Invalid file path' };
        }

        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');
        const ext = (path.extname(filePath) || '').toLowerCase();
        const mimeMap: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.bmp': 'image/bmp',
          '.svg': 'image/svg+xml'
        };
        const mimeType = mimeMap[ext] || 'application/octet-stream';

        const parts: any[] = [];
        if (prompt && prompt.trim()) {
          parts.push({ text: prompt.trim() });
        }
        parts.push({ inlineData: { data: base64, mimeType } });

        const result = await this.model!.generateContent({
          contents: [ { role: 'user', parts } ]
        });
        const text = result?.response?.text ? await result.response.text() : '';
        return { success: true, text };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    console.log('✅ Autonomous Gemini AI IPC handlers registered');
  }

  /**
   * Buffer an event for a conversation or send immediately if sender is available
   */
  private bufferEvent(conversationId: string, event: AIStreamEvent): void {
    const buffer = this.conversationEventBuffers.get(conversationId);
    const sender = this.conversationSenders.get(conversationId);
    
    console.log('📤 BufferEvent called:', {
      conversationId,
      eventType: event.type,
      hasSender: !!sender,
      hasBuffer: !!buffer,
      bufferSize: buffer?.length || 0
    });
    
    if (sender) {
      sender.send('ai-stream-event', conversationId, event);
    } else if (buffer) {
      buffer.push(event);
    } else {
      console.warn('⚠️ No buffer or sender available for conversation:', conversationId);
    }
  }

  /**
   * Flush all buffered events for a conversation
   */
  private flushEventBuffer(conversationId: string): void {
    const buffer = this.conversationEventBuffers.get(conversationId);
    const sender = this.conversationSenders.get(conversationId);
    
    if (buffer && sender && buffer.length > 0) {
      console.log(`📤 Flushing ${buffer.length} buffered events for conversation:`, conversationId);
      for (const event of buffer) {
        sender.send('ai-stream-event', conversationId, event);
      }
      
      // Clear buffer after flushing (but keep sender for future events)
      this.conversationEventBuffers.set(conversationId, []);
    } else {
      console.log(`📤 No buffered events to flush for conversation: ${conversationId} (buffer: ${buffer?.length || 0}, sender: ${!!sender})`);
    }
  }

  /**
   * Clean up resources for a specific conversation
   */
  private cleanupConversation(conversationId: string): void {
    console.log('🧹 Cleaning up conversation:', conversationId);
    this.conversationEventBuffers.delete(conversationId);
    this.conversationSenders.delete(conversationId);
  }

  /**
   * Clean up all conversation resources
   */
  private cleanupAllConversations(): void {
    console.log('🧹 Cleaning up all conversations');
    this.conversationEventBuffers.clear();
    this.conversationSenders.clear();
  }

  /**
   * Create conversation in SQLite database
   */
  private async createConversationInSQLite(sessionId: string, initialMessage: string, context?: Record<string, any>): Promise<void> {
    if (!this.aiChatDb) {
      console.warn('⚠️ AI Chat database not available, skipping conversation creation');
      return;
    }

    try {
      const conversationTitle = this.generateConversationTitle(initialMessage);
      const projectContext = context ? JSON.stringify(context) : '{}';
      
      console.log('🔧 Creating conversation in SQLite:', {
        id: sessionId,
        title: conversationTitle,
        projectContext: projectContext.substring(0, 100) + '...'
      });
      
      this.aiChatDb.createConversation({
        id: sessionId,
        title: conversationTitle,
        project_context: projectContext,
        is_active: true
      });

      console.log('✅ Successfully created conversation in SQLite:', sessionId);
    } catch (error) {
      console.error('❌ Failed to create conversation in SQLite:', error);
      console.error('❌ Conversation ID:', sessionId);
      console.error('❌ Error details:', error);
    }
  }

  /**
   * Save turn data to SQLite database
   */
  private saveTurnToSQLite(turn: ConversationTurn): void {
    if (!this.aiChatDb || !this.currentConversationId) {
      console.warn('⚠️ AI Chat database or conversation ID not available, skipping turn save');
      return;
    }

    try {
      // For now, let's save all messages from the conversation history
      // TODO: Optimize to only save new messages per turn
      const turnMessages = this.conversationHistory;

      console.log('🔧 Saving turn to SQLite:', {
        conversationId: this.currentConversationId,
        turnNumber: turn.turnNumber,
        messageCount: turnMessages.length,
        totalHistoryLength: this.conversationHistory.length
      });

      // Convert and save messages
      const aiMessages = turnMessages.map(msg => conversationMessageToAIMessage(msg, this.currentConversationId!));
      
      // Remove duplicates based on content and timestamp (simple deduplication)
      const uniqueMessages = aiMessages.filter((msg, index, arr) => 
        arr.findIndex(m => m.content === msg.content && m.role === msg.role) === index
      );
      
      console.log('🔧 Converted messages for SQLite:', aiMessages.map(m => ({
        id: m.id,
        role: m.role,
        contentLength: m.content.length,
        content: m.content.substring(0, 100) + (m.content.length > 100 ? '...' : ''),
        conversationId: m.conversation_id
      })));

      // Debug: Log the original conversation messages
      console.log('🔧 Original conversation messages:', turnMessages.map(msg => ({
        role: msg.role,
        partsCount: msg.parts.length,
        parts: msg.parts.map(part => ({
          hasText: !!part.text,
          hasFunctionCall: !!part.functionCall,
          hasFunctionResponse: !!part.functionResponse,
          text: part.text?.substring(0, 50) || 'N/A'
        }))
      })));

      this.aiChatDb.addMessages(uniqueMessages);

      // Update conversation metadata
      this.aiChatDb.updateConversation(this.currentConversationId, {
        updated_at: new Date().toISOString()
      });

      console.log(`✅ Successfully saved ${uniqueMessages.length} messages from turn ${turn.turnNumber} to SQLite`);
    } catch (error) {
      console.error('❌ Failed to save turn to SQLite:', error);
      console.error('❌ Conversation ID:', this.currentConversationId);
      console.error('❌ Turn number:', turn.turnNumber);
      console.error('❌ Error details:', error);
    }
  }

  /**
   * Generate a conversation title from the initial message
   */
  private generateConversationTitle(message: string): string {
    // Truncate and clean the message for use as title
    const maxLength = 50;
    const cleaned = message.replace(/\n/g, ' ').trim();
    return cleaned.length > maxLength 
      ? cleaned.substring(0, maxLength) + '...'
      : cleaned || 'AI Conversation';
  }

  /**
   * Cleanup method
   */
  unregisterHandlers(): void {
    ipcMain.removeHandler('ai-configure');
    ipcMain.removeHandler('ai-is-configured');
    ipcMain.removeHandler('ai-start-autonomous-conversation');
    ipcMain.removeHandler('ai-conversation-ready');
    ipcMain.removeHandler('ai-cancel-conversation');
    ipcMain.removeHandler('ai-get-conversation-state');
    ipcMain.removeHandler('ai-get-history');
    ipcMain.removeHandler('ai-clear-history');
    ipcMain.removeHandler('ai-get-models');
  }
}

// Export singleton instance
export const autonomousGeminiClient = new AutonomousGeminiClient();
