import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface EgChattingConversation {
  id: string;
  title: string;
  summary?: string;
  created_at: string;
  updated_at: string;
  metadata?: any;
}

export interface EgChattingMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content?: string;
  tool_call_id?: string;
  tool_name?: string;
  tool_server_name?: string;
  tool_args?: any;
  tool_result?: any;
  tool_status?: 'pending' | 'success' | 'error';
  timestamp: string;
  metadata?: any;
}

export class EgChattingDatabase {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // Conversation Operations
  createConversation(title: string, summary?: string, metadata?: any): EgChattingConversation {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO egchatting_conversations (id, title, summary, metadata)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(id, title, summary || null, metadata ? JSON.stringify(metadata) : null);
    return this.getConversation(id)!;
  }

  getConversation(id: string): EgChattingConversation | undefined {
    const stmt = this.db.prepare('SELECT * FROM egchatting_conversations WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return undefined;
    
    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  getAllConversations(): EgChattingConversation[] {
    const stmt = this.db.prepare('SELECT * FROM egchatting_conversations ORDER BY updated_at DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  updateConversation(id: string, updates: Partial<Pick<EgChattingConversation, 'title' | 'summary' | 'metadata'>>): void {
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.summary !== undefined) {
      fields.push('summary = ?');
      values.push(updates.summary);
    }
    if (updates.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }
    
    if (fields.length === 0) return;
    
    values.push(id);
    const stmt = this.db.prepare(`UPDATE egchatting_conversations SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  deleteConversation(id: string): void {
    const stmt = this.db.prepare('DELETE FROM egchatting_conversations WHERE id = ?');
    stmt.run(id);
  }

  // Message Operations
  addMessage(message: Omit<EgChattingMessage, 'id' | 'timestamp'>): EgChattingMessage {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO egchatting_messages (
        id, conversation_id, role, content, 
        tool_call_id, tool_name, tool_server_name, tool_args, tool_result, tool_status,
        metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      message.conversation_id,
      message.role,
      message.content || null,
      message.tool_call_id || null,
      message.tool_name || null,
      message.tool_server_name || null,
      message.tool_args ? JSON.stringify(message.tool_args) : null,
      message.tool_result ? (typeof message.tool_result === 'string' ? message.tool_result : JSON.stringify(message.tool_result)) : null,
      message.tool_status || null,
      message.metadata ? JSON.stringify(message.metadata) : null
    );

    // Touch conversation updated_at
    this.db.prepare('UPDATE egchatting_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(message.conversation_id);

    return this.getMessage(id)!;
  }

  getMessage(id: string): EgChattingMessage | undefined {
    const stmt = this.db.prepare('SELECT * FROM egchatting_messages WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return undefined;
    
    return this.parseMessageRow(row);
  }

  getMessages(conversationId: string): EgChattingMessage[] {
    const stmt = this.db.prepare('SELECT * FROM egchatting_messages WHERE conversation_id = ? ORDER BY timestamp ASC');
    const rows = stmt.all(conversationId) as any[];
    
    return rows.map(row => this.parseMessageRow(row));
  }

  deleteMessage(id: string): void {
    const stmt = this.db.prepare('DELETE FROM egchatting_messages WHERE id = ?');
    stmt.run(id);
  }

  private parseMessageRow(row: any): EgChattingMessage {
    return {
      ...row,
      tool_args: row.tool_args ? JSON.parse(row.tool_args) : undefined,
      tool_result: row.tool_result ? this.tryParseJSON(row.tool_result) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  private tryParseJSON(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }
}

