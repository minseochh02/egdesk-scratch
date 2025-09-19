/**
 * AI Chat Data Service (Renderer)
 * Provides a clean interface for accessing AI chat data from the renderer
 */

import type { AIConversation, AIMessage, ConversationStats } from '../../../main/sqlite/ai';
import type { ConversationMessage } from '../../../main/types/ai-types';

export interface AIChatDataServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class AIChatDataService {
  /**
   * Get all conversations with optional filtering
   */
  async getConversations(options: {
    limit?: number;
    offset?: number;
    activeOnly?: boolean;
    projectContext?: string;
  } = {}): Promise<AIConversation[]> {
    try {
      const response = await window.electron.aiChatData.getConversations(options);
      if (response.success) {
        return response.data || [];
      } else {
        console.error('Failed to get conversations:', response.error);
        return [];
      }
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  }

  /**
   * Get a specific conversation by ID
   */
  async getConversation(conversationId: string): Promise<AIConversation | null> {
    try {
      const response = await window.electron.aiChatData.getConversation(conversationId);
      if (response.success) {
        return response.data || null;
      } else {
        console.error('Failed to get conversation:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting conversation:', error);
      return null;
    }
  }

  /**
   * Get conversation with all its messages
   */
  async getConversationWithMessages(conversationId: string): Promise<{
    conversation: AIConversation | null;
    messages: AIMessage[];
  } | null> {
    try {
      const response = await window.electron.aiChatData.getConversationWithMessages(conversationId);
      if (response.success) {
        return response.data || null;
      } else {
        console.error('Failed to get conversation with messages:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting conversation with messages:', error);
      return null;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, options: {
    limit?: number;
    offset?: number;
    role?: 'user' | 'model' | 'tool';
  } = {}): Promise<AIMessage[]> {
    try {
      const response = await window.electron.aiChatData.getMessages(conversationId, options);
      if (response.success) {
        return response.data || [];
      } else {
        console.error('Failed to get messages:', response.error);
        return [];
      }
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(conversationData: Omit<AIConversation, 'created_at' | 'updated_at'>): Promise<string | null> {
    try {
      const response = await window.electron.aiChatData.createConversation(conversationData);
      if (response.success) {
        return response.data?.id || null;
      } else {
        console.error('Failed to create conversation:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  }

  /**
   * Update a conversation
   */
  async updateConversation(conversationId: string, updates: Partial<AIConversation>): Promise<boolean> {
    try {
      const response = await window.electron.aiChatData.updateConversation(conversationId, updates);
      if (response.success) {
        return true;
      } else {
        console.error('Failed to update conversation:', response.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating conversation:', error);
      return false;
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      const response = await window.electron.aiChatData.deleteConversation(conversationId);
      if (response.success) {
        return true;
      } else {
        console.error('Failed to delete conversation:', response.error);
        return false;
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string): Promise<boolean> {
    try {
      const response = await window.electron.aiChatData.archiveConversation(conversationId);
      if (response.success) {
        return true;
      } else {
        console.error('Failed to archive conversation:', response.error);
        return false;
      }
    } catch (error) {
      console.error('Error archiving conversation:', error);
      return false;
    }
  }

  /**
   * Restore a conversation
   */
  async restoreConversation(conversationId: string): Promise<boolean> {
    try {
      const response = await window.electron.aiChatData.restoreConversation(conversationId);
      if (response.success) {
        return true;
      } else {
        console.error('Failed to restore conversation:', response.error);
        return false;
      }
    } catch (error) {
      console.error('Error restoring conversation:', error);
      return false;
    }
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(messageData: Omit<AIMessage, 'timestamp'>): Promise<string | null> {
    try {
      const response = await window.electron.aiChatData.addMessage(messageData);
      if (response.success) {
        return response.data?.id || null;
      } else {
        console.error('Failed to add message:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error adding message:', error);
      return null;
    }
  }

  /**
   * Add multiple messages to a conversation
   */
  async addMessages(messagesData: Omit<AIMessage, 'timestamp'>[]): Promise<string[]> {
    try {
      const response = await window.electron.aiChatData.addMessages(messagesData);
      if (response.success) {
        return response.data?.ids || [];
      } else {
        console.error('Failed to add messages:', response.error);
        return [];
      }
    } catch (error) {
      console.error('Error adding messages:', error);
      return [];
    }
  }

  /**
   * Update a message
   */
  async updateMessage(messageId: string, updates: Partial<AIMessage>): Promise<boolean> {
    try {
      const response = await window.electron.aiChatData.updateMessage(messageId, updates);
      if (response.success) {
        return true;
      } else {
        console.error('Failed to update message:', response.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating message:', error);
      return false;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      const response = await window.electron.aiChatData.deleteMessage(messageId);
      if (response.success) {
        return true;
      } else {
        console.error('Failed to delete message:', response.error);
        return false;
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(conversationId: string): Promise<any | null> {
    try {
      const response = await window.electron.aiChatData.getConversationStats(conversationId);
      if (response.success) {
        return response.data || null;
      } else {
        console.error('Failed to get conversation stats:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      return null;
    }
  }

  /**
   * Get overall statistics
   */
  async getOverallStats(): Promise<ConversationStats | null> {
    try {
      const response = await window.electron.aiChatData.getOverallStats();
      if (response.success) {
        return response.data || null;
      } else {
        console.error('Failed to get overall stats:', response.error);
        return null;
      }
    } catch (error) {
      console.error('Error getting overall stats:', error);
      return null;
    }
  }

  /**
   * Convert AIMessage to ConversationMessage for compatibility
   */
  aiMessageToConversationMessage(message: AIMessage): ConversationMessage {
    const metadata = message.metadata ? JSON.parse(message.metadata) : {};
    
    // Preserve tool role for proper rendering - tool messages should be rendered as tools
    const role = message.role === 'tool' ? 'tool' : message.role;
    
    // For tool messages, show only success/failure status instead of full content
    let displayContent = message.content;
    if (role === 'tool' && message.tool_status) {
      const statusIcon = message.tool_status === 'completed' ? '✅' : 
                        message.tool_status === 'failed' ? '❌' : '⏳';
      const statusText = message.tool_status === 'completed' ? 'success!' : 
                        message.tool_status === 'failed' ? 'failed!' : 'executing...';
      
      // Extract tool name from content if possible (handle both Tool Call and Tool Response)
      const toolResponseMatch = message.content.match(/\[Tool Response: ([^\]]+)\]/);
      const toolCallMatch = message.content.match(/\[Tool Call: ([^\]]+)\]/);
      const toolName = toolResponseMatch ? toolResponseMatch[1] : 
                      toolCallMatch ? toolCallMatch[1] : 'Tool';
      
      displayContent = `${toolName}: ${statusIcon} ${statusText}`;
    }
    
    return {
      role: role as 'user' | 'model' | 'tool',
      parts: [{ text: displayContent }],
      timestamp: new Date(message.timestamp),
      toolCallId: message.tool_call_id,
      toolStatus: message.tool_status
    };
  }

  /**
   * Convert ConversationMessage to AIMessage for storage
   */
  conversationMessageToAIMessage(message: ConversationMessage, conversationId: string): Omit<AIMessage, 'timestamp'> {
    // Extract text content from parts, handling different part types
    const extractTextFromParts = (parts: any[]): string => {
      return parts.map(part => {
        if (part.text) {
          return part.text;
        } else if (part.functionCall) {
          return `[Tool Call: ${part.functionCall.name}]`;
        } else if (part.functionResponse) {
          return `[Tool Response: ${part.functionResponse.name}]`;
        } else {
          return JSON.stringify(part);
        }
      }).join('');
    };

    const content = extractTextFromParts(message.parts);

    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversation_id: conversationId,
      role: message.role,
      content: content || '[Empty message]', // Fallback for empty content
      tool_call_id: message.toolCallId,
      tool_status: message.toolStatus,
      metadata: JSON.stringify({
        timestamp: message.timestamp.toISOString(),
        parts: message.parts
      })
    };
  }
}

// Export singleton instance
export const aiChatDataService = new AIChatDataService();
