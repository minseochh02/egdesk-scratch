/**
 * Gmail MCP Service
 * Implements the IMCPService interface for Gmail operations
 */

import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { GmailMCPFetcher } from './gmail-service';
import { GmailConnection } from '../../types/gmail-types';

/**
 * Gmail MCP Service
 * Adapts GmailMCPFetcher to the IMCPService interface
 */
export class GmailMCPService implements IMCPService {
  private connection: GmailConnection;
  private fetcher: GmailMCPFetcher;
  private initialized: boolean = false;

  constructor(connection: GmailConnection) {
    this.connection = connection;
    this.fetcher = new GmailMCPFetcher(connection);
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.fetcher.waitForInitialization();
      this.initialized = true;
    }
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: 'gmail-mcp-server',
      version: '1.0.0'
    };
  }

  getCapabilities(): MCPCapabilities {
    return {
      tools: {},
      resources: {}
    };
  }

  listTools(): MCPTool[] {
    return [
      {
        name: 'gmail_list_users',
        description: 'List all domain users from Google Workspace',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'gmail_get_user_messages',
        description: 'Get Gmail messages for a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'The email address of the user'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of messages to return (default: 50)',
              default: 50
            }
          },
          required: ['email']
        }
      },
      {
        name: 'gmail_get_user_stats',
        description: 'Get Gmail statistics for a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'The email address of the user'
            }
          },
          required: ['email']
        }
      },
      {
        name: 'gmail_search_messages',
        description: 'Search Gmail messages by query',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (e.g., "from:example@gmail.com")'
            },
            email: {
              type: 'string',
              description: 'Optional: filter by specific user email'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of messages to return (default: 50)',
              default: 50
            }
          },
          required: ['query']
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    // Ensure fetcher is initialized
    await this.initialize();

    try {
      let result: any;

      switch (name) {
        case 'gmail_list_users': {
          const users = await this.fetcher.fetchAllDomainUsers();
          result = {
            totalUsers: users.length,
            users
          };
          break;
        }

        case 'gmail_get_user_messages': {
          const { email, maxResults = 50 } = args;
          if (!email) {
            throw new Error('Missing required parameter: email');
          }
          const messages = await this.fetcher.fetchUserMessages(email, { maxResults });
          result = {
            userEmail: email,
            totalMessages: messages.length,
            messages
          };
          break;
        }

        case 'gmail_get_user_stats': {
          const { email } = args;
          if (!email) {
            throw new Error('Missing required parameter: email');
          }
          const stats = await this.fetcher.fetchUserStats(email);
          result = {
            userEmail: email,
            stats
          };
          break;
        }

        case 'gmail_search_messages': {
          const { query, email, maxResults = 50 } = args;
          if (!query) {
            throw new Error('Missing required parameter: query');
          }
          const messages = await this.fetcher.fetchUserMessages(email || '', {
            query,
            maxResults
          });
          result = {
            query,
            userEmail: email,
            totalMessages: messages.length,
            messages
          };
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to execute ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the underlying Gmail fetcher
   */
  getGmailFetcher(): GmailMCPFetcher {
    return this.fetcher;
  }

  /**
   * Get the Gmail connection
   */
  getConnection(): GmailConnection {
    return this.connection;
  }
}

