import { ipcMain } from 'electron';
import { initializeEgChattingDatabase } from './egchatting-init';
import { EgChattingDatabase, EgChattingMessage } from './egchatting';

let dbInstance: EgChattingDatabase | null = null;
let initializationAttempted = false;
let initializationError: string | null = null;

/**
 * Explicitly initialize the EGChatting database
 * Should be called at app startup before registering IPC handlers
 */
export function initializeEgChattingService(): { success: boolean; error?: string } {
  if (dbInstance) {
    return { success: true }; // Already initialized
  }

  if (initializationAttempted) {
    return { 
      success: false, 
      error: initializationError || 'Database initialization previously failed' 
    };
  }

  initializationAttempted = true;
  console.log('[EGChatting] Initializing database...');
  
  try {
    const result = initializeEgChattingDatabase();
    if (result.success && result.database) {
      dbInstance = new EgChattingDatabase(result.database);
      console.log('[EGChatting] ✅ Database initialized successfully at:', result.dbPath);
      return { success: true };
    } else {
      const errorMsg = result.error || 'Unknown initialization error';
      initializationError = errorMsg;
      console.error('[EGChatting] ❌ Failed to initialize database:', errorMsg);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    initializationError = errorMsg;
    console.error('[EGChatting] ❌ Exception during database initialization:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

function getDb() {
  if (!dbInstance && !initializationAttempted) {
    // Fallback: try to initialize if not already attempted
    console.warn('[EGChatting] Database not initialized, attempting lazy initialization...');
    initializeEgChattingService();
  }
  return dbInstance;
}

export function registerEgChattingHandlers() {
  // Conversations
  ipcMain.handle('egchatting-get-conversations', async () => {
    try {
      const db = getDb();
      if (!db) {
        console.warn('[EGChatting] Database not available, returning empty conversations list');
        return [];
      }
      return db.getAllConversations();
    } catch (error) {
      console.error('[EGChatting] Error getting conversations:', error);
      return [];
    }
  });

  ipcMain.handle('egchatting-create-conversation', async (_, title: string, summary?: string) => {
    const db = getDb();
    if (!db) {
      const error = 'Database not initialized. Please restart the application.';
      console.error('[EGChatting]', error);
      throw new Error(error);
    }
    try {
      return db.createConversation(title, summary);
    } catch (error) {
      console.error('[EGChatting] Error creating conversation:', error);
      throw error;
    }
  });

  ipcMain.handle('egchatting-delete-conversation', async (_, id: string) => {
    const db = getDb();
    if (!db) {
      const error = 'Database not initialized. Please restart the application.';
      console.error('[EGChatting]', error);
      throw new Error(error);
    }
    try {
      db.deleteConversation(id);
      return true;
    } catch (error) {
      console.error('[EGChatting] Error deleting conversation:', error);
      throw error;
    }
  });

  ipcMain.handle('egchatting-update-conversation', async (_, id: string, updates: any) => {
    const db = getDb();
    if (!db) {
      const error = 'Database not initialized. Please restart the application.';
      console.error('[EGChatting]', error);
      throw new Error(error);
    }
    try {
      db.updateConversation(id, updates);
      return true;
    } catch (error) {
      console.error('[EGChatting] Error updating conversation:', error);
      throw error;
    }
  });

  // Messages
  ipcMain.handle('egchatting-get-messages', async (_, conversationId: string) => {
    try {
      const db = getDb();
      if (!db) {
        console.warn('[EGChatting] Database not available, returning empty messages list');
        return [];
      }
      return db.getMessages(conversationId);
    } catch (error) {
      console.error('[EGChatting] Error getting messages:', error);
      return [];
    }
  });

  ipcMain.handle('egchatting-add-message', async (_, message: Omit<EgChattingMessage, 'id' | 'timestamp'>) => {
    const db = getDb();
    if (!db) {
      const error = 'Database not initialized. Please restart the application.';
      console.error('[EGChatting]', error);
      throw new Error(error);
    }
    try {
      return db.addMessage(message);
    } catch (error) {
      console.error('[EGChatting] Error adding message:', error);
      throw error;
    }
  });

  ipcMain.handle('egchatting-delete-message', async (_, id: string) => {
    const db = getDb();
    if (!db) {
      const error = 'Database not initialized. Please restart the application.';
      console.error('[EGChatting]', error);
      throw new Error(error);
    }
    try {
      db.deleteMessage(id);
      return true;
    } catch (error) {
      console.error('[EGChatting] Error deleting message:', error);
      throw error;
    }
  });
}

