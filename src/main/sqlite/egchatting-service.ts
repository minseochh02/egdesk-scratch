import { ipcMain } from 'electron';
import { initializeEgChattingDatabase } from './egchatting-init';
import { EgChattingDatabase, EgChattingMessage } from './egchatting';

let dbInstance: EgChattingDatabase | null = null;

function getDb() {
  if (!dbInstance) {
    const result = initializeEgChattingDatabase();
    if (result.success && result.database) {
      dbInstance = new EgChattingDatabase(result.database);
    } else {
      console.error('Failed to initialize EgChatting database:', result.error);
    }
  }
  return dbInstance;
}

export function registerEgChattingHandlers() {
  // Conversations
  ipcMain.handle('egchatting-get-conversations', async () => {
    const db = getDb();
    return db ? db.getAllConversations() : [];
  });

  ipcMain.handle('egchatting-create-conversation', async (_, title: string, summary?: string) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    return db.createConversation(title, summary);
  });

  ipcMain.handle('egchatting-delete-conversation', async (_, id: string) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    db.deleteConversation(id);
    return true;
  });

  ipcMain.handle('egchatting-update-conversation', async (_, id: string, updates: any) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    db.updateConversation(id, updates);
    return true;
  });

  // Messages
  ipcMain.handle('egchatting-get-messages', async (_, conversationId: string) => {
    const db = getDb();
    return db ? db.getMessages(conversationId) : [];
  });

  ipcMain.handle('egchatting-add-message', async (_, message: Omit<EgChattingMessage, 'id' | 'timestamp'>) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    return db.addMessage(message);
  });

  ipcMain.handle('egchatting-delete-message', async (_, id: string) => {
    const db = getDb();
    if (!db) throw new Error('Database not initialized');
    db.deleteMessage(id);
    return true;
  });
}

