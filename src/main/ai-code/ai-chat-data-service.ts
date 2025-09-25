/**
 * AI Chat Data Service
 * Exposes database operations for conversations and messages
 * Provides API endpoints for the renderer to fetch chat data
 */

import { app, ipcMain } from 'electron';
import { getSQLiteManager } from '../sqlite/manager';
import { AIChatDatabase, type AIConversation, type AIMessage, type ConversationStats } from '../sqlite/ai';
import type { ConversationMessage } from '../types/ai-types';

export class AIChatDataService {
  private sqliteManager = getSQLiteManager();
  private aiChatDb?: AIChatDatabase;
  private initializationPromise: Promise<void>;

  constructor() {
    this.initializationPromise = this.initializeDatabase();
    this.registerIPCHandlers();
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    try {
      // Ensure Electron app is ready before accessing app paths via SQLite manager
      if (!app.isReady()) {
        await app.whenReady();
      }
      const result = await this.sqliteManager.initialize();
      if (result.success) {
        this.aiChatDb = new AIChatDatabase(this.sqliteManager.getDatabase());
        console.log('✅ AI Chat Data Service initialized');
      } else {
        console.error('❌ Failed to initialize AI Chat Data Service:', result.error);
      }
    } catch (error) {
      console.error('❌ Error initializing AI Chat Data Service:', error);
    }
  }

  /**
   * Ensure aiChatDb is attached if the manager was initialized later
   */
  private tryAttachDatabaseIfAvailable(): void {
    if (!this.aiChatDb && this.sqliteManager.isAvailable()) {
      this.aiChatDb = new AIChatDatabase(this.sqliteManager.getDatabase());
    }
  }

  /**
   * Register IPC handlers for data operations
   */
  private registerIPCHandlers(): void {
    console.log('🔗 Registering AI Chat Data Service IPC handlers...');

    // Get all conversations
    ipcMain.handle('ai-chat-get-conversations', async (event, options = {}) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const conversations = this.aiChatDb.getConversations(options);
        return { success: true, data: conversations };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Get a specific conversation
    ipcMain.handle('ai-chat-get-conversation', async (event, conversationId: string) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const conversation = this.aiChatDb.getConversation(conversationId);
        if (!conversation) {
          return { success: false, error: 'Conversation not found' };
        }

        return { success: true, data: conversation };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Get messages for a conversation
    ipcMain.handle('ai-chat-get-messages', async (event, conversationId: string, options = {}) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const messages = this.aiChatDb.getMessages(conversationId, options);
        return { success: true, data: messages };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Get conversation with all its messages
    ipcMain.handle('ai-chat-get-conversation-with-messages', async (event, conversationId: string) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const result = this.aiChatDb.getConversationWithMessages(conversationId);
        return { success: true, data: result };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Get conversation statistics
    ipcMain.handle('ai-chat-get-conversation-stats', async (event, conversationId: string) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const stats = this.aiChatDb.getConversationStats(conversationId);
        return { success: true, data: stats };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Get overall statistics
    ipcMain.handle('ai-chat-get-overall-stats', async (event) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const stats = this.aiChatDb.getOverallStats();
        return { success: true, data: stats };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Create a new conversation
    ipcMain.handle('ai-chat-create-conversation', async (event, conversationData: Omit<AIConversation, 'created_at' | 'updated_at'>) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const conversationId = this.aiChatDb.createConversation(conversationData);
        return { success: true, data: { id: conversationId } };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Update a conversation
    ipcMain.handle('ai-chat-update-conversation', async (event, conversationId: string, updates: Partial<AIConversation>) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        this.aiChatDb.updateConversation(conversationId, updates);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Delete a conversation
    ipcMain.handle('ai-chat-delete-conversation', async (event, conversationId: string) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const deletedCount = this.aiChatDb.deleteConversation(conversationId);
        return { success: true, data: { deletedCount } };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Archive a conversation
    ipcMain.handle('ai-chat-archive-conversation', async (event, conversationId: string) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        this.aiChatDb.archiveConversation(conversationId);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Restore a conversation
    ipcMain.handle('ai-chat-restore-conversation', async (event, conversationId: string) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        this.aiChatDb.restoreConversation(conversationId);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Add a message to a conversation
    ipcMain.handle('ai-chat-add-message', async (event, messageData: Omit<AIMessage, 'timestamp'>) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const messageId = this.aiChatDb.addMessage(messageData);
        return { success: true, data: { id: messageId } };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Add multiple messages to a conversation
    ipcMain.handle('ai-chat-add-messages', async (event, messagesData: Omit<AIMessage, 'timestamp'>[]) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const messageIds = this.aiChatDb.addMessages(messagesData);
        return { success: true, data: { ids: messageIds } };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Update a message
    ipcMain.handle('ai-chat-update-message', async (event, messageId: string, updates: Partial<AIMessage>) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        this.aiChatDb.updateMessage(messageId, updates);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Delete a message
    ipcMain.handle('ai-chat-delete-message', async (event, messageId: string) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const deletedCount = this.aiChatDb.deleteMessage(messageId);
        return { success: true, data: { deletedCount } };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Delete all messages in a conversation
    ipcMain.handle('ai-chat-delete-messages-in-conversation', async (event, conversationId: string) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const deletedCount = this.aiChatDb.deleteMessagesInConversation(conversationId);
        return { success: true, data: { deletedCount } };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Clean up old data
    ipcMain.handle('ai-chat-cleanup-old-data', async (event, daysToKeep: number = 90) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        const result = this.aiChatDb.cleanupOldData(daysToKeep);
        return { success: true, data: result };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    // Clear all data
    ipcMain.handle('ai-chat-clear-all-data', async (event) => {
      try {
        await this.initializationPromise;
        this.tryAttachDatabaseIfAvailable();
        if (!this.aiChatDb) {
          return { success: false, error: 'Database not available' };
        }

        this.aiChatDb.clearAllData();
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });

    console.log('✅ AI Chat Data Service IPC handlers registered');
  }

  /**
   * Get database instance (for internal use)
   */
  getDatabase(): AIChatDatabase | undefined {
    return this.aiChatDb;
  }

  /**
   * Check if database is available
   */
  isAvailable(): boolean {
    return this.aiChatDb !== undefined;
  }
}

// Export singleton instance
export const aiChatDataService = new AIChatDataService();
