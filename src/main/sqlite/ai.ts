import Database from 'better-sqlite3';
import { ConversationMessage } from '../types/ai-types';

/**
 * AI Chat Database Schema and Operations
 * 
 * This module provides all database operations for AI chat storage,
 * including conversations, messages, and related metadata.
 */

// ===========================================
// TYPE DEFINITIONS
// ===========================================

export interface AIConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  project_context: string; // JSON string
  is_active: boolean;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'model' | 'tool';
  content: string;
  timestamp: string;
  tool_call_id?: string;
  tool_status?: 'executing' | 'completed' | 'failed';
  metadata?: string; // JSON string
}

export interface ConversationStats {
  totalConversations: number;
  totalMessages: number;
  activeConversations: number;
  lastActivity: string | null;
  databaseSize: number;
}

// ===========================================
// AI CHAT DATABASE OPERATIONS
// ===========================================

export class AIChatDatabase {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  // ===========================================
  // CONVERSATION OPERATIONS
  // ===========================================

  /**
   * Create a new conversation
   */
  createConversation(conversation: Omit<AIConversation, 'created_at' | 'updated_at'>): string {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, title, project_context, is_active)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      conversation.id,
      conversation.title,
      conversation.project_context,
      conversation.is_active ? 1 : 0  // Convert boolean to integer
    );

    return conversation.id;
  }

  /**
   * Get a conversation by ID
   */
  getConversation(conversationId: string): AIConversation | null {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `);

    const result = stmt.get(conversationId) as any;
    if (!result) return null;

    // Convert integer back to boolean
    return {
      ...result,
      is_active: Boolean(result.is_active)
    } as AIConversation;
  }

  /**
   * Get all conversations (with optional filtering)
   */
  getConversations(options: {
    limit?: number;
    offset?: number;
    activeOnly?: boolean;
    projectContext?: string;
  } = {}): AIConversation[] {
    const { limit = 50, offset = 0, activeOnly = false, projectContext } = options;
    
    let query = 'SELECT * FROM conversations';
    const conditions: string[] = [];
    const params: any[] = [];

    if (activeOnly) {
      conditions.push('is_active = ?');
      params.push(1);
    }

    if (projectContext) {
      conditions.push('project_context LIKE ?');
      params.push(`%${projectContext}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params) as any[];
    
    // Convert integers back to booleans
    return results.map(result => ({
      ...result,
      is_active: Boolean(result.is_active)
    })) as AIConversation[];
  }

  /**
   * Update conversation
   */
  updateConversation(conversationId: string, updates: Partial<AIConversation>): void {
    const fields = Object.keys(updates).filter(key => 
      key !== 'id' && key !== 'created_at' && key !== 'updated_at'
    );
    
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => {
      const value = (updates as any)[field];
      // Convert boolean to integer for SQLite
      return field === 'is_active' ? (value ? 1 : 0) : value;
    });

    const stmt = this.db.prepare(`
      UPDATE conversations 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    stmt.run(...values, conversationId);
  }

  /**
   * Delete conversation and all its messages
   */
  deleteConversation(conversationId: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM conversations WHERE id = ?
    `);

    const result = stmt.run(conversationId);
    return result.changes;
  }

  /**
   * Archive conversation (set is_active to false)
   */
  archiveConversation(conversationId: string): void {
    this.updateConversation(conversationId, { is_active: false });
  }

  /**
   * Restore conversation (set is_active to true)
   */
  restoreConversation(conversationId: string): void {
    this.updateConversation(conversationId, { is_active: true });
  }

  // ===========================================
  // MESSAGE OPERATIONS
  // ===========================================

  /**
   * Add a message to a conversation
   */
  addMessage(message: Omit<AIMessage, 'timestamp'>): string {
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, tool_call_id, tool_status, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      message.conversation_id,
      message.role,
      message.content,
      message.tool_call_id || null,
      message.tool_status || null,
      message.metadata || null
    );

    // Update conversation's updated_at timestamp
    this.updateConversation(message.conversation_id, {});

    return message.id;
  }

  /**
   * Get messages for a conversation
   */
  getMessages(conversationId: string, options: {
    limit?: number;
    offset?: number;
    role?: 'user' | 'model' | 'tool';
  } = {}): AIMessage[] {
    const { limit = 100, offset = 0, role } = options;
    
    let query = 'SELECT * FROM messages WHERE conversation_id = ?';
    const params: any[] = [conversationId];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    query += ' ORDER BY timestamp ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as AIMessage[];
  }

  /**
   * Get a specific message by ID
   */
  getMessage(messageId: string): AIMessage | null {
    const stmt = this.db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `);

    return stmt.get(messageId) as AIMessage || null;
  }

  /**
   * Update message
   */
  updateMessage(messageId: string, updates: Partial<AIMessage>): void {
    const fields = Object.keys(updates).filter(key => 
      key !== 'id' && key !== 'timestamp'
    );
    
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => (updates as any)[field]);

    const stmt = this.db.prepare(`
      UPDATE messages 
      SET ${setClause}, timestamp = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    stmt.run(...values, messageId);
  }

  /**
   * Delete message
   */
  deleteMessage(messageId: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM messages WHERE id = ?
    `);

    const result = stmt.run(messageId);
    return result.changes;
  }

  /**
   * Delete all messages in a conversation
   */
  deleteMessagesInConversation(conversationId: string): number {
    const stmt = this.db.prepare(`
      DELETE FROM messages WHERE conversation_id = ?
    `);

    const result = stmt.run(conversationId);
    return result.changes;
  }

  // ===========================================
  // BULK OPERATIONS
  // ===========================================

  /**
   * Save multiple messages at once
   */
  addMessages(messages: Omit<AIMessage, 'timestamp'>[]): string[] {
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, tool_call_id, tool_status, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((messages: Omit<AIMessage, 'timestamp'>[]) => {
      const messageIds: string[] = [];
      for (const message of messages) {
        stmt.run(
          message.id,
          message.conversation_id,
          message.role,
          message.content,
          message.tool_call_id || null,
          message.tool_status || null,
          message.metadata || null
        );
        messageIds.push(message.id);
      }
      return messageIds;
    });

    return insertMany(messages);
  }

  /**
   * Get conversation with all its messages
   */
  getConversationWithMessages(conversationId: string): {
    conversation: AIConversation | null;
    messages: AIMessage[];
  } {
    const conversation = this.getConversation(conversationId);
    const messages = conversation ? this.getMessages(conversationId) : [];
    
    return { conversation, messages };
  }

  // ===========================================
  // STATISTICS AND ANALYTICS
  // ===========================================

  /**
   * Get conversation statistics
   */
  getConversationStats(conversationId: string): {
    totalMessages: number;
    userMessages: number;
    modelMessages: number;
    toolMessages: number;
    toolCalls: number;
    firstMessage: string | null;
    lastMessage: string | null;
  } {
    const totalStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?
    `);
    const totalResult = totalStmt.get(conversationId) as { count: number };

    const roleStmt = this.db.prepare(`
      SELECT role, COUNT(*) as count 
      FROM messages 
      WHERE conversation_id = ? 
      GROUP BY role
    `);
    const roleResults = roleStmt.all(conversationId) as { role: string; count: number }[];

    const toolStmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE conversation_id = ? AND tool_call_id IS NOT NULL
    `);
    const toolResult = toolStmt.get(conversationId) as { count: number };

    const timeStmt = this.db.prepare(`
      SELECT MIN(timestamp) as first, MAX(timestamp) as last 
      FROM messages 
      WHERE conversation_id = ?
    `);
    const timeResult = timeStmt.get(conversationId) as { first: string | null; last: string | null };

    const userCount = roleResults.find(r => r.role === 'user')?.count || 0;
    const modelCount = roleResults.find(r => r.role === 'model')?.count || 0;
    const toolCount = roleResults.find(r => r.role === 'tool')?.count || 0;

    return {
      totalMessages: totalResult.count,
      userMessages: userCount,
      modelMessages: modelCount,
      toolMessages: toolCount,
      toolCalls: toolResult.count,
      firstMessage: timeResult.first,
      lastMessage: timeResult.last
    };
  }

  /**
   * Get overall statistics
   */
  getOverallStats(): ConversationStats {
    const convStmt = this.db.prepare(`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
             MAX(updated_at) as last_activity
      FROM conversations
    `);
    const convResult = convStmt.get() as { total: number; active: number; last_activity: string | null };

    const msgStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM messages
    `);
    const msgResult = msgStmt.get() as { count: number };

    const sizeStmt = this.db.prepare(`
      SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()
    `);
    const sizeResult = sizeStmt.get() as { size: number };

    return {
      totalConversations: convResult.total,
      totalMessages: msgResult.count,
      activeConversations: convResult.active,
      lastActivity: convResult.last_activity,
      databaseSize: Math.round((sizeResult.size / 1024 / 1024) * 100) / 100
    };
  }

  // ===========================================
  // CLEANUP OPERATIONS
  // ===========================================

  /**
   * Clean up old conversations and messages
   */
  cleanupOldData(daysToKeep: number = 90): {
    deletedConversations: number;
    deletedMessages: number;
  } {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffISO = cutoffDate.toISOString();

    // Delete old conversations and their messages
    const convStmt = this.db.prepare(`
      DELETE FROM conversations WHERE updated_at < ? AND is_active = 0
    `);
    const convResult = convStmt.run(cutoffISO);

    // Delete orphaned messages
    const msgStmt = this.db.prepare(`
      DELETE FROM messages 
      WHERE timestamp < ? 
      AND conversation_id NOT IN (SELECT id FROM conversations)
    `);
    const msgResult = msgStmt.run(cutoffISO);

    return {
      deletedConversations: convResult.changes,
      deletedMessages: msgResult.changes
    };
  }

  /**
   * Clear all data (use with caution)
   */
  clearAllData(): void {
    this.db.exec('DELETE FROM messages');
    this.db.exec('DELETE FROM conversations');
  }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Convert ConversationMessage to AIMessage
 */
export function conversationMessageToAIMessage(
  message: ConversationMessage, 
  conversationId: string
): Omit<AIMessage, 'timestamp'> {
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

/**
 * Convert AIMessage to ConversationMessage
 */
export function aiMessageToConversationMessage(message: AIMessage): ConversationMessage {
  const metadata = message.metadata ? JSON.parse(message.metadata) : {};
  
  // Convert 'tool' role to 'model' for ConversationMessage compatibility
  const role = message.role === 'tool' ? 'model' : message.role;
  
  return {
    role: role as 'user' | 'model',
    parts: [{ text: message.content }],
    timestamp: new Date(message.timestamp),
    toolCallId: message.tool_call_id,
    toolStatus: message.tool_status
  };
}
