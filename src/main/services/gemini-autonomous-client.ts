/**
 * Autonomous Gemini AI Client Service
 * Implements streaming conversation loops with tool execution
 * Based on Gemini CLI patterns adapted for EGDesk
 */

import { GoogleGenerativeAI, GenerationConfig, Content, Part, FunctionCall, Tool } from '@google/generative-ai';
import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { toolRegistry } from './tool-executor';
import { loopDetectionService } from './loop-detection';
import { projectContextBridge } from './project-context-bridge';
import { getEGDeskSystemPrompt } from '../prompts/system-prompt';
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
  
  // Event buffering for conversations
  private conversationEventBuffers = new Map<string, AIStreamEvent[]>();
  private conversationSenders = new Map<string, Electron.WebContents>();

  constructor() {
    this.registerIPCHandlers();
  }

  /**
   * Configure the Gemini client
   */
  async configure(config: AIClientConfig): Promise<boolean> {
    try {
      this.genAI = new GoogleGenerativeAI(config.apiKey);
      
      // Get project context for system prompt
      const projectContext = await this.getProjectContext();
      const systemPrompt = getEGDeskSystemPrompt(projectContext || undefined);
      
      this.model = this.genAI.getGenerativeModel({
        model: config.model || 'gemini-1.5-flash-latest',
        generationConfig: {
          temperature: config.temperature || 0.7,
          topP: config.topP || 0.8,
          maxOutputTokens: config.maxOutputTokens || 4096,
        },
        systemInstruction: systemPrompt
      });

      this.config = config;
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

    // Initialize conversation state
    this.conversationState = {
      sessionId: uuidv4(),
      turns: [],
      currentTurn: 0,
      isActive: true,
      maxTurns: options.maxTurns || 20,
      timeoutMs: options.timeoutMs || 300000, // 5 minutes
      startTime: new Date(),
      context: options.context
    };

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
        // Project context is now handled via system instructions, so we can use the message directly
        console.log('🔍 Using system instruction for project context');
        const contextualMessage = currentMessage;

        // Send message to Gemini with tools
        const result = await this.model!.generateContent({
          contents: [
            ...this.getConversationHistory(),
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
                turnNumber
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
                  role: 'user',
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
                  timestamp: new Date()
                });

                // Continue conversation with tool result
                currentMessage = toolResponse.success 
                  ? `Tool execution completed. Result: ${JSON.stringify(toolResponse.result)}`
                  : `Tool execution failed: ${toolResponse.error}`;
              }
            }
          }
        }

        // Mark turn as completed
        turn.endTime = new Date();
        turn.status = 'completed';

        yield {
          type: AIEventType.TurnCompleted,
          turnNumber,
          timestamp: new Date()
        };

        // Check if conversation should continue
        const shouldContinue = this.shouldContinueConversation(turn, response);
        if (!shouldContinue) {
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
   * Determine if conversation should continue
   */
  private shouldContinueConversation(turn: ConversationTurn, response: any): boolean {
    // Continue if there were tool calls (AI might need results)
    if (turn.toolCalls.length > 0) {
      return true;
    }

    // Check finish reason
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === 'STOP') {
      return false; // AI indicated completion
    }

    // Continue for other reasons (SAFETY, LENGTH, etc.)
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
  private getConversationHistory(): Content[] {
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
    return [...this.conversationHistory];
  }

  clearHistory(): void {
    this.conversationHistory = [];
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
    return [
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-1.0-pro'
    ];
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
