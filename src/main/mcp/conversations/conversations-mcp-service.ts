/**
 * Conversations MCP Service
 * 
 * Implements the IMCPService interface for conversation storage operations.
 * This service allows egdesk-website to save and fetch conversation data
 * from the desktop app's SQLite database.
 */

import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { initializeEgChattingDatabase } from '../../sqlite/egchatting-init';
import { EgChattingDatabase, EgChattingConversation, EgChattingMessage } from '../../sqlite/egchatting';
import Database from 'better-sqlite3';

export class ConversationsMCPService implements IMCPService {
  private db: EgChattingDatabase | null = null;
  private initError: string | null = null;

  constructor() {
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    try {
      const result = initializeEgChattingDatabase();
      if (result.success && result.database) {
        this.db = new EgChattingDatabase(result.database);
        console.log('[ConversationsMCPService] ✅ Database initialized');
      } else {
        this.initError = result.error || 'Unknown initialization error';
        console.error('[ConversationsMCPService] ❌ Database init failed:', this.initError);
      }
    } catch (error) {
      this.initError = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ConversationsMCPService] ❌ Exception during init:', this.initError);
    }
  }

  private getDb(): EgChattingDatabase {
    if (!this.db) {
      throw new Error(this.initError || 'Database not initialized');
    }
    return this.db;
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: 'conversations-mcp-server',
      version: '1.0.0'
    };
  }

  getCapabilities(): MCPCapabilities {
    return {
      tools: {}
    };
  }

  listTools(): MCPTool[] {
    return [
      {
        name: 'conv_list_conversations',
        description: 'List all conversations for the authenticated user',
        inputSchema: {
          type: 'object',
          properties: {
            user_email: {
              type: 'string',
              description: 'User email to filter conversations (extracted from auth token)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of conversations to return (default: 50)',
              default: 50
            },
            offset: {
              type: 'number',
              description: 'Number of conversations to skip (for pagination)',
              default: 0
            }
          },
          required: ['user_email']
        }
      },
      {
        name: 'conv_get_conversation',
        description: 'Get a single conversation with its messages',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Conversation ID'
            },
            user_email: {
              type: 'string',
              description: 'User email for authorization check'
            }
          },
          required: ['id', 'user_email']
        }
      },
      {
        name: 'conv_create_conversation',
        description: 'Create a new conversation',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Conversation title'
            },
            user_email: {
              type: 'string',
              description: 'User email (owner of the conversation)'
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata (source, tab_id, etc.)'
            }
          },
          required: ['title', 'user_email']
        }
      },
      {
        name: 'conv_add_message',
        description: 'Add a message to a conversation',
        inputSchema: {
          type: 'object',
          properties: {
            conversation_id: {
              type: 'string',
              description: 'ID of the conversation to add message to'
            },
            role: {
              type: 'string',
              enum: ['user', 'assistant', 'system'],
              description: 'Message role'
            },
            content: {
              type: 'string',
              description: 'Message content'
            },
            user_email: {
              type: 'string',
              description: 'User email for authorization check'
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata (toolCalls, files, etc.)'
            }
          },
          required: ['conversation_id', 'role', 'content', 'user_email']
        }
      },
      {
        name: 'conv_get_messages',
        description: 'Get messages for a conversation',
        inputSchema: {
          type: 'object',
          properties: {
            conversation_id: {
              type: 'string',
              description: 'Conversation ID'
            },
            user_email: {
              type: 'string',
              description: 'User email for authorization check'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of messages to return',
              default: 100
            },
            offset: {
              type: 'number',
              description: 'Number of messages to skip (for pagination)',
              default: 0
            }
          },
          required: ['conversation_id', 'user_email']
        }
      },
      {
        name: 'conv_update_conversation',
        description: 'Update conversation metadata',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Conversation ID'
            },
            user_email: {
              type: 'string',
              description: 'User email for authorization check'
            },
            title: {
              type: 'string',
              description: 'New title'
            },
            summary: {
              type: 'string',
              description: 'New summary'
            },
            metadata: {
              type: 'object',
              description: 'Updated metadata'
            }
          },
          required: ['id', 'user_email']
        }
      },
      {
        name: 'conv_delete_conversation',
        description: 'Delete a conversation and all its messages',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Conversation ID to delete'
            },
            user_email: {
              type: 'string',
              description: 'User email for authorization check'
            }
          },
          required: ['id', 'user_email']
        }
      },
      {
        name: 'conv_sync_conversation',
        description: 'Bulk sync - create or update a conversation with all its messages',
        inputSchema: {
          type: 'object',
          properties: {
            conversation: {
              type: 'object',
              description: 'Conversation data',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                summary: { type: 'string' },
                metadata: { type: 'object' }
              },
              required: ['title']
            },
            messages: {
              type: 'array',
              description: 'Array of messages to add',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  content: { type: 'string' },
                  metadata: { type: 'object' }
                }
              }
            },
            user_email: {
              type: 'string',
              description: 'User email for authorization'
            }
          },
          required: ['conversation', 'user_email']
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      const db = this.getDb();
      let result: any;

      switch (name) {
        case 'conv_list_conversations':
          result = await this.listConversations(db, args);
          break;

        case 'conv_get_conversation':
          result = await this.getConversation(db, args);
          break;

        case 'conv_create_conversation':
          result = await this.createConversation(db, args);
          break;

        case 'conv_add_message':
          result = await this.addMessage(db, args);
          break;

        case 'conv_get_messages':
          result = await this.getMessages(db, args);
          break;

        case 'conv_update_conversation':
          result = await this.updateConversation(db, args);
          break;

        case 'conv_delete_conversation':
          result = await this.deleteConversation(db, args);
          break;

        case 'conv_sync_conversation':
          result = await this.syncConversation(db, args);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`Failed to execute ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ========================================
  // Tool Implementations
  // ========================================

  private async listConversations(db: EgChattingDatabase, args: Record<string, any>): Promise<any> {
    const { user_email, limit = 50, offset = 0 } = args;

    if (!user_email) {
      throw new Error('user_email is required');
    }

    // Get all conversations and filter by user email
    const allConversations = db.getAllConversations();
    const userConversations = allConversations.filter(conv => {
      const metadata = conv.metadata || {};
      return metadata.user_email === user_email;
    });

    // Apply pagination
    const paginatedConversations = userConversations.slice(offset, offset + limit);

    return {
      success: true,
      total: userConversations.length,
      limit,
      offset,
      conversations: paginatedConversations
    };
  }

  private async getConversation(db: EgChattingDatabase, args: Record<string, any>): Promise<any> {
    const { id, user_email } = args;

    if (!id || !user_email) {
      throw new Error('id and user_email are required');
    }

    const conversation = db.getConversation(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }

    // Check authorization
    const metadata = conversation.metadata || {};
    if (metadata.user_email !== user_email) {
      throw new Error('Unauthorized: conversation belongs to another user');
    }

    // Get messages
    const messages = db.getMessages(id);

    return {
      success: true,
      conversation,
      messages
    };
  }

  private async createConversation(db: EgChattingDatabase, args: Record<string, any>): Promise<any> {
    const { title, user_email, metadata = {} } = args;

    if (!title || !user_email) {
      throw new Error('title and user_email are required');
    }

    // Add user_email to metadata
    const enrichedMetadata = {
      ...metadata,
      user_email,
      source: metadata.source || 'website',
      created_from: 'mcp'
    };

    const conversation = db.createConversation(title, undefined, enrichedMetadata);

    return {
      success: true,
      conversation
    };
  }

  private async addMessage(db: EgChattingDatabase, args: Record<string, any>): Promise<any> {
    const { conversation_id, role, content, user_email, metadata = {} } = args;

    if (!conversation_id || !role || !user_email) {
      throw new Error('conversation_id, role, and user_email are required');
    }

    // Verify conversation exists and belongs to user
    const conversation = db.getConversation(conversation_id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversation_id}`);
    }

    const convMetadata = conversation.metadata || {};
    if (convMetadata.user_email !== user_email) {
      throw new Error('Unauthorized: conversation belongs to another user');
    }

    // Add message with enriched metadata
    const enrichedMetadata = {
      ...metadata,
      source: metadata.source || 'website'
    };

    const message = db.addMessage({
      conversation_id,
      role: role as 'user' | 'assistant' | 'tool' | 'system',
      content: content || '',
      metadata: enrichedMetadata
    });

    return {
      success: true,
      message
    };
  }

  private async getMessages(db: EgChattingDatabase, args: Record<string, any>): Promise<any> {
    const { conversation_id, user_email, limit = 100, offset = 0 } = args;

    if (!conversation_id || !user_email) {
      throw new Error('conversation_id and user_email are required');
    }

    // Verify conversation belongs to user
    const conversation = db.getConversation(conversation_id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversation_id}`);
    }

    const convMetadata = conversation.metadata || {};
    if (convMetadata.user_email !== user_email) {
      throw new Error('Unauthorized: conversation belongs to another user');
    }

    // Get all messages and apply pagination
    const allMessages = db.getMessages(conversation_id);
    const paginatedMessages = allMessages.slice(offset, offset + limit);

    return {
      success: true,
      total: allMessages.length,
      limit,
      offset,
      messages: paginatedMessages
    };
  }

  private async updateConversation(db: EgChattingDatabase, args: Record<string, any>): Promise<any> {
    const { id, user_email, title, summary, metadata } = args;

    if (!id || !user_email) {
      throw new Error('id and user_email are required');
    }

    // Verify conversation belongs to user
    const conversation = db.getConversation(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }

    const convMetadata = conversation.metadata || {};
    if (convMetadata.user_email !== user_email) {
      throw new Error('Unauthorized: conversation belongs to another user');
    }

    // Build updates object
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (summary !== undefined) updates.summary = summary;
    if (metadata !== undefined) {
      // Preserve user_email in metadata
      updates.metadata = {
        ...convMetadata,
        ...metadata,
        user_email // Ensure user_email is never overwritten
      };
    }

    db.updateConversation(id, updates);

    // Return updated conversation
    const updatedConversation = db.getConversation(id);

    return {
      success: true,
      conversation: updatedConversation
    };
  }

  private async deleteConversation(db: EgChattingDatabase, args: Record<string, any>): Promise<any> {
    const { id, user_email } = args;

    if (!id || !user_email) {
      throw new Error('id and user_email are required');
    }

    // Verify conversation belongs to user
    const conversation = db.getConversation(id);
    if (!conversation) {
      throw new Error(`Conversation not found: ${id}`);
    }

    const convMetadata = conversation.metadata || {};
    if (convMetadata.user_email !== user_email) {
      throw new Error('Unauthorized: conversation belongs to another user');
    }

    // Delete conversation (messages are deleted via CASCADE)
    db.deleteConversation(id);

    return {
      success: true,
      deleted_id: id
    };
  }

  private async syncConversation(db: EgChattingDatabase, args: Record<string, any>): Promise<any> {
    const { conversation, messages = [], user_email } = args;

    if (!conversation || !user_email) {
      throw new Error('conversation and user_email are required');
    }

    let conv: EgChattingConversation;

    // Check if conversation exists
    if (conversation.id) {
      const existing = db.getConversation(conversation.id);
      if (existing) {
        // Verify ownership
        const existingMetadata = existing.metadata || {};
        if (existingMetadata.user_email !== user_email) {
          throw new Error('Unauthorized: conversation belongs to another user');
        }

        // Update existing conversation
        const updates: any = {};
        if (conversation.title) updates.title = conversation.title;
        if (conversation.summary) updates.summary = conversation.summary;
        if (conversation.metadata) {
          updates.metadata = {
            ...existingMetadata,
            ...conversation.metadata,
            user_email
          };
        }

        db.updateConversation(conversation.id, updates);
        conv = db.getConversation(conversation.id)!;
      } else {
        // Create new with specified ID (not supported, create new)
        const metadata = {
          ...conversation.metadata,
          user_email,
          source: 'website',
          created_from: 'mcp_sync'
        };
        conv = db.createConversation(conversation.title, conversation.summary, metadata);
      }
    } else {
      // Create new conversation
      const metadata = {
        ...conversation.metadata,
        user_email,
        source: 'website',
        created_from: 'mcp_sync'
      };
      conv = db.createConversation(conversation.title, conversation.summary, metadata);
    }

    // Add messages
    const addedMessages: EgChattingMessage[] = [];
    for (const msg of messages) {
      const added = db.addMessage({
        conversation_id: conv.id,
        role: msg.role as 'user' | 'assistant' | 'tool' | 'system',
        content: msg.content || '',
        metadata: {
          ...msg.metadata,
          source: 'website'
        }
      });
      addedMessages.push(added);
    }

    return {
      success: true,
      conversation: conv,
      messages_added: addedMessages.length
    };
  }
}

