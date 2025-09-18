/**
 * AI Service for Renderer Process
 * Simple wrapper for Gemini AI client via IPC
 */

import type { 
  AIClientConfig, 
  ConversationMessage, 
  AIResponse 
} from '../../main/types/ai-types';

export class AIService {
  /**
   * Configure the AI client with API key and settings
   */
  static async configure(config: AIClientConfig): Promise<boolean> {
    try {
      return await window.electron.aiService.configure(config);
    } catch (error) {
      console.error('Error configuring AI client:', error);
      return false;
    }
  }

  /**
   * Check if AI client is configured
   */
  static async isConfigured(): Promise<boolean> {
    try {
      return await window.electron.aiService.isConfigured();
    } catch (error) {
      console.error('Error checking AI configuration:', error);
      return false;
    }
  }

  /**
   * Send a message to the AI
   */
  static async sendMessage(message: string): Promise<AIResponse> {
    try {
      return await window.electron.aiService.sendMessage(message);
    } catch (error) {
      console.error('Error sending message to AI:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Send a message with tools available for function calling
   */
  static async sendMessageWithTools(message: string, tools: any[]): Promise<AIResponse> {
    try {
      return await window.electron.aiService.sendMessage(message); // TODO: Add tools support
    } catch (error) {
      console.error('Error sending message with tools to AI:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get conversation history
   */
  static async getHistory(): Promise<ConversationMessage[]> {
    try {
      return await window.electron.aiService.getHistory();
    } catch (error) {
      console.error('Error getting AI history:', error);
      return [];
    }
  }

  /**
   * Clear conversation history
   */
  static async clearHistory(): Promise<void> {
    try {
      await window.electron.aiService.clearHistory();
    } catch (error) {
      console.error('Error clearing AI history:', error);
    }
  }

  /**
   * Get available AI models
   */
  static async getAvailableModels(): Promise<string[]> {
    try {
      return []; // TODO: Add models support
    } catch (error) {
      console.error('Error getting available models:', error);
      return [];
    }
  }
}
