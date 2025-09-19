/**
 * AI Service for Renderer Process
 * Enhanced with autonomous streaming conversation support
 */

import type { 
  AIClientConfig, 
  ConversationMessage, 
  AIResponse,
  AIStreamEvent,
  ConversationState,
  ToolDefinition
} from '../../main/types/ai-types';

export class AIService {
  private static streamEventListeners = new Map<string, (event: AIStreamEvent) => void>();

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
   * NEW: Start an autonomous conversation with streaming responses
   */
  static async startAutonomousConversation(
    message: string,
    options: {
      tools?: ToolDefinition[];
      maxTurns?: number;
      timeoutMs?: number;
      autoExecuteTools?: boolean;
      context?: Record<string, any>;
    } = {},
    onStreamEvent?: (event: AIStreamEvent) => void
  ): Promise<{ conversationId: string }> {
    try {
      // Start the conversation and get the conversation ID
      const result = await window.electron.aiService.startAutonomousConversation(message, options);
      
      // Register stream event listener immediately after getting the conversation ID
      if (onStreamEvent && result.conversationId) {
        console.log('📝 Registering event handler for conversation:', result.conversationId);
        this.streamEventListeners.set(result.conversationId, onStreamEvent);
        
        // Signal to main process that renderer is ready to receive events
        await window.electron.aiService.conversationReady(result.conversationId);
      }

      return result;
    } catch (error) {
      console.error('Error starting autonomous conversation:', error);
      throw error;
    }
  }

  /**
   * Cancel active conversation
   */
  static async cancelConversation(): Promise<boolean> {
    try {
      return await window.electron.aiService.cancelConversation();
    } catch (error) {
      console.error('Error cancelling conversation:', error);
      return false;
    }
  }

  /**
   * Get current conversation state
   */
  static async getConversationState(): Promise<ConversationState | null> {
    try {
      return await window.electron.aiService.getConversationState();
    } catch (error) {
      console.error('Error getting conversation state:', error);
      return null;
    }
  }

  /**
   * Check if conversation is active
   */
  static async isConversationActive(): Promise<boolean> {
    try {
      const state = await this.getConversationState();
      return state?.isActive || false;
    } catch (error) {
      console.error('Error checking conversation status:', error);
      return false;
    }
  }

  /**
   * Register global stream event handler
   */
  static registerStreamEventHandler(): void {
    if (window.electron?.ipcRenderer) {
      console.log('📡 Registering stream event handler');
      window.electron.ipcRenderer.on('ai-stream-event', (conversationId: string, event: AIStreamEvent) => {
        console.log('📥 Received IPC stream event:', event.type, 'for conversation:', conversationId);
        const handler = this.streamEventListeners.get(conversationId);
        if (handler) {
          console.log('✅ Calling event handler for conversation:', conversationId);
          handler(event);
        } else {
          console.warn('⚠️ No handler found for conversation:', conversationId);
        }
      });
    } else {
      console.error('❌ window.electron.ipcRenderer not available for stream event handler');
    }
  }

  /**
   * Unregister stream event listener
   */
  static unregisterStreamEventListener(conversationId: string): void {
    console.log('🧹 Unregistering event handler for conversation:', conversationId);
    this.streamEventListeners.delete(conversationId);
  }

  /**
   * Clean up all conversation event listeners
   */
  static cleanupAllConversations(): void {
    console.log('🧹 Cleaning up all conversation event listeners');
    this.streamEventListeners.clear();
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
      return await window.electron.aiService.getAvailableModels();
    } catch (error) {
      console.error('Error getting available models:', error);
      return [];
    }
  }

  /**
   * Utility: Create a simple async iterator for streaming responses
   */
  static async *streamConversation(
    message: string,
    options: {
      tools?: ToolDefinition[];
      maxTurns?: number;
      timeoutMs?: number;
      autoExecuteTools?: boolean;
      context?: Record<string, any>;
    } = {}
  ): AsyncGenerator<AIStreamEvent> {
    console.log('🚀 Starting streamConversation with message:', message);
    
    const events: AIStreamEvent[] = [];
    let conversationComplete = false;
    let error: Error | null = null;

    // Start conversation
    console.log('📞 Calling startAutonomousConversation...');
    const { conversationId } = await this.startAutonomousConversation(
      message,
      options,
      (event) => {
        console.log('📥 Received stream event:', event.type);
        events.push(event);
        if (event.type === 'finished' || event.type === 'error') {
          conversationComplete = true;
          if (event.type === 'error') {
            error = new Error((event as any).error.message);
          }
        }
      }
    );
    
    console.log('✅ Conversation started with ID:', conversationId);

    // Yield events as they arrive
    let eventIndex = 0;
    while (!conversationComplete || eventIndex < events.length) {
      if (eventIndex < events.length) {
        const event = events[eventIndex];
        console.log('📤 Yielding event:', event.type);
        yield event;
        eventIndex++;
      } else {
        // Wait a bit for more events
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Cleanup
    this.unregisterStreamEventListener(conversationId);

    if (error) {
      throw error;
    }
    
    console.log('🏁 Stream conversation completed');
  }
}

// Initialize stream event handler when service is imported
if (typeof window !== 'undefined') {
  AIService.registerStreamEventHandler();
}
