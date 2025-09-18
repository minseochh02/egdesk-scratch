/**
 * Type definitions for AI integration
 * Based on Google Gemini API and Gemini CLI patterns
 */

import { 
  GenerateContentResponse, 
  Content, 
  Part, 
  FunctionCall,
  FunctionDeclaration,
  Tool
} from '@google/generative-ai';

export interface AIClientConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
}

export interface ConversationMessage {
  role: 'user' | 'model';
  parts: Part[];
  timestamp: Date;
}

export interface AIResponse {
  success: boolean;
  content?: string;
  functionCalls?: FunctionCall[];
  error?: string;
  fullResponse?: GenerateContentResponse;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  parameters: Record<string, any>;
}

export interface ToolCallResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

export interface AIClientService {
  // Configuration
  configure(config: AIClientConfig): Promise<boolean>;
  isConfigured(): boolean;
  
  // Basic chat
  sendMessage(message: string): Promise<AIResponse>;
  
  // Tool integration
  sendMessageWithTools(message: string, tools: Tool[]): Promise<AIResponse>;
  
  // Conversation management
  addToHistory(message: ConversationMessage): void;
  getHistory(): ConversationMessage[];
  clearHistory(): void;
  
  // Utility
  getAvailableModels(): string[];
}
