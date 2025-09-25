/**
 * Type definitions for AI integration
 * Based on Google Gemini API and Gemini CLI patterns
 * Enhanced for autonomous conversation loops
 */

import { 
  GenerateContentResponse, 
  Content, 
  Part, 
  FunctionCall,
  FunctionDeclaration,
  Tool,
  FinishReason
} from '@google/generative-ai';

export interface AIClientConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
}

export interface ConversationMessage {
  role: 'user' | 'model' | 'tool';
  parts: Part[];
  timestamp: Date;
  // Optional fields for tool execution tracking
  toolCallId?: string;
  toolStatus?: 'executing' | 'completed' | 'failed';
}

export interface AIResponse {
  success: boolean;
  content?: string;
  functionCalls?: FunctionCall[];
  error?: string;
  fullResponse?: GenerateContentResponse;
}

// Streaming Event Types (based on Gemini CLI patterns)
export enum AIEventType {
  Content = 'content',
  ToolCallRequest = 'tool_call_request',
  ToolCallResponse = 'tool_call_response',
  ToolCallConfirmation = 'tool_call_confirmation',
  Thought = 'thought',
  Error = 'error',
  Finished = 'finished',
  UserCancelled = 'user_cancelled',
  LoopDetected = 'loop_detected',
  TurnStarted = 'turn_started',
  TurnCompleted = 'turn_completed'
}

export interface AIContentEvent {
  type: AIEventType.Content;
  content: string;
  timestamp: Date;
}

export interface AIToolCallRequestEvent {
  type: AIEventType.ToolCallRequest;
  toolCall: ToolCallRequestInfo;
  timestamp: Date;
}

export interface AIToolCallResponseEvent {
  type: AIEventType.ToolCallResponse;
  response: ToolCallResponseInfo;
  timestamp: Date;
}

export interface AIThoughtEvent {
  type: AIEventType.Thought;
  thought: {
    subject: string;
    description: string;
  };
  timestamp: Date;
}

export interface AIErrorEvent {
  type: AIEventType.Error;
  error: {
    message: string;
    code?: string;
    recoverable: boolean;
  };
  timestamp: Date;
}

export interface AIFinishedEvent {
  type: AIEventType.Finished;
  reason: FinishReason | 'tool_calls_complete' | 'user_cancelled' | 'max_turns' | 'timeout';
  timestamp: Date;
}

export interface AILoopDetectedEvent {
  type: AIEventType.LoopDetected;
  pattern: string;
  timestamp: Date;
}

export interface AITurnEvent {
  type: AIEventType.TurnStarted | AIEventType.TurnCompleted;
  turnNumber: number;
  timestamp: Date;
}

export type AIStreamEvent = 
  | AIContentEvent 
  | AIToolCallRequestEvent 
  | AIToolCallResponseEvent
  | AIThoughtEvent
  | AIErrorEvent 
  | AIFinishedEvent
  | AILoopDetectedEvent
  | AITurnEvent;

// Tool System Types
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: FunctionDeclaration;
  dangerous?: boolean;
  requiresConfirmation?: boolean;
}

export interface ToolCallRequestInfo {
  id: string;
  name: string;
  parameters: Record<string, any>;
  timestamp: Date;
  turnNumber: number;
  conversationId?: string;
}

export interface ToolCallResponseInfo {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  timestamp: Date;
}

export interface ToolCallConfirmationDetails {
  toolName: string;
  parameters: Record<string, any>;
  description: string;
  risks: string[];
  autoApprove?: boolean;
}

// Conversation Management
export interface ConversationTurn {
  turnNumber: number;
  userMessage?: ConversationMessage;
  aiResponse?: ConversationMessage;
  toolCalls: ToolCallRequestInfo[];
  toolResponses: ToolCallResponseInfo[];
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'error' | 'cancelled';
}

export interface ConversationState {
  sessionId: string;
  turns: ConversationTurn[];
  currentTurn: number;
  isActive: boolean;
  maxTurns: number;
  timeoutMs: number;
  startTime: Date;
  context?: Record<string, any>;
}

// Loop Detection
export interface LoopDetectionState {
  recentToolCalls: string[];
  recentResponses: string[];
  patternThreshold: number;
  enabled: boolean;
}

// Enhanced AI Client Service
export interface AIClientService {
  // Configuration
  configure(config: AIClientConfig): Promise<boolean>;
  isConfigured(): boolean;
  
  
  // Streaming conversation (new autonomous mode)
  sendMessageStream(
    message: string, 
    options?: {
      tools?: ToolDefinition[];
      maxTurns?: number;
      timeoutMs?: number;
      autoExecuteTools?: boolean;
      context?: Record<string, any>;
    }
  ): AsyncGenerator<AIStreamEvent>;
  
  // Tool integration
  executeToolCall(request: ToolCallRequestInfo): Promise<ToolCallResponseInfo>;
  
  // Conversation management
  addToHistory(message: ConversationMessage): void;
  getHistory(): ConversationMessage[];
  clearHistory(): void;
  getConversationState(): ConversationState | null;
  
  // Safety & Control
  cancelConversation(): void;
  isConversationActive(): boolean;
  
  // Utility
  getAvailableModels(): string[];
}

// Tool Execution Types
export interface ToolExecutor {
  name: string;
  description: string;
  dangerous?: boolean;
  requiresConfirmation?: boolean;
  execute(parameters: Record<string, any>, signal?: AbortSignal, conversationId?: string): Promise<any>;
  shouldConfirm?(parameters: Record<string, any>): Promise<ToolCallConfirmationDetails | false>;
}
