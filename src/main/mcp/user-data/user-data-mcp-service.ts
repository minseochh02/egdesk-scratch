/**
 * User Data MCP Service
 * Implements the IMCPService interface for user database operations
 *
 * NOTE: All user-created tables automatically include an 'id' column
 * (INTEGER PRIMARY KEY AUTOINCREMENT) as the first column
 */

import Database from 'better-sqlite3';
import { IMCPService, MCPTool, MCPServerInfo, MCPCapabilities, MCPToolResult } from '../types/mcp-service';
import { UserDataDbManager } from '../../sqlite/user-data';

/**
 * User Data MCP Service
 * Provides MCP tools for querying and analyzing user-created database tables
 *
 * All tables include an auto-generated 'id' column for unique row identification
 */
export class UserDataMCPService implements IMCPService {
  private manager: UserDataDbManager;

  constructor(database: Database.Database) {
    this.manager = new UserDataDbManager(database);
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: 'user-data-mcp-server',
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
        name: 'user_data_list_tables',
        description: 'List all user-created database tables with metadata',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'user_data_get_schema',
        description: 'Get column definitions and schema for a specific table',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'The name of the table to get schema for'
            }
          },
          required: ['tableName']
        }
      },
      {
        name: 'user_data_query',
        description: 'Query data from a table with filters, sorting, and pagination',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'The name of the table to query'
            },
            filters: {
              type: 'object',
              description: 'Filter conditions (e.g., {"age": ">30", "status": "active"})',
              additionalProperties: { type: 'string' }
            },
            limit: {
              type: 'number',
              description: 'Maximum number of rows to return (max 1000)',
              default: 100
            },
            offset: {
              type: 'number',
              description: 'Number of rows to skip for pagination',
              default: 0
            },
            orderBy: {
              type: 'string',
              description: 'Column name to sort by'
            },
            orderDirection: {
              type: 'string',
              enum: ['ASC', 'DESC'],
              description: 'Sort direction (ASC or DESC)',
              default: 'ASC'
            }
          },
          required: ['tableName']
        }
      },
      {
        name: 'user_data_search',
        description: 'Full-text search across all columns in a table',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'The name of the table to search in'
            },
            searchQuery: {
              type: 'string',
              description: 'The text to search for across all columns'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of rows to return (max 1000)',
              default: 100
            }
          },
          required: ['tableName', 'searchQuery']
        }
      },
      {
        name: 'user_data_aggregate',
        description: 'Compute aggregations (SUM, AVG, MIN, MAX, COUNT) on a column',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'The name of the table'
            },
            column: {
              type: 'string',
              description: 'The column to aggregate'
            },
            function: {
              type: 'string',
              enum: ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'],
              description: 'The aggregation function to use'
            },
            filters: {
              type: 'object',
              description: 'Optional filter conditions',
              additionalProperties: { type: 'string' }
            },
            groupBy: {
              type: 'string',
              description: 'Optional column to group results by'
            }
          },
          required: ['tableName', 'column', 'function']
        }
      },
      {
        name: 'user_data_sql_query',
        description: 'Execute a raw SQL SELECT query (read-only, safe mode)',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The SQL SELECT query to execute (only SELECT statements allowed)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'user_data_export_preview',
        description: 'Get a sample of data from a table for export preview',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'The name of the table'
            },
            limit: {
              type: 'number',
              description: 'Number of sample rows to return (max 100)',
              default: 10
            }
          },
          required: ['tableName']
        }
      }
    ];
  }

  async executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      let result: any;

      switch (name) {
        case 'user_data_list_tables': {
          const tables = this.manager.getAllTables();
          result = {
            totalTables: tables.length,
            tables: tables.map((table) => ({
              id: table.id,
              tableName: table.tableName,
              displayName: table.displayName,
              description: table.description,
              rowCount: table.rowCount,
              columnCount: table.columnCount,
              createdAt: table.createdAt,
              updatedAt: table.updatedAt,
              createdFromFile: table.createdFromFile
            }))
          };
          break;
        }

        case 'user_data_get_schema': {
          const { tableName } = args;
          if (!tableName) {
            throw new Error('Missing required parameter: tableName');
          }

          const table = this.manager.getTableByName(tableName);
          if (!table) {
            throw new Error(`Table not found: ${tableName}`);
          }

          result = {
            tableName: table.tableName,
            displayName: table.displayName,
            schema: table.schema,
            rowCount: table.rowCount,
            columnCount: table.columnCount
          };
          break;
        }

        case 'user_data_query': {
          const { tableName, filters, limit = 100, offset = 0, orderBy, orderDirection = 'ASC' } = args;
          if (!tableName) {
            throw new Error('Missing required parameter: tableName');
          }

          const table = this.manager.getTableByName(tableName);
          if (!table) {
            throw new Error(`Table not found: ${tableName}`);
          }

          const queryResult = this.manager.queryData(table.id, {
            filters,
            limit: Math.min(limit, 1000),
            offset,
            orderBy,
            orderDirection
          });

          result = {
            tableName,
            rows: queryResult.rows,
            total: queryResult.total,
            limit: queryResult.limit,
            offset: queryResult.offset,
            hasMore: queryResult.offset + queryResult.rows.length < queryResult.total
          };
          break;
        }

        case 'user_data_search': {
          const { tableName, searchQuery, limit = 100 } = args;
          if (!tableName || !searchQuery) {
            throw new Error('Missing required parameters: tableName and searchQuery');
          }

          const table = this.manager.getTableByName(tableName);
          if (!table) {
            throw new Error(`Table not found: ${tableName}`);
          }

          const searchResult = this.manager.searchData(table.id, searchQuery, Math.min(limit, 1000));

          result = {
            tableName,
            searchQuery,
            rows: searchResult.rows,
            total: searchResult.total,
            matchCount: searchResult.rows.length
          };
          break;
        }

        case 'user_data_aggregate': {
          const { tableName, column, function: aggFunction, filters, groupBy } = args;
          if (!tableName || !column || !aggFunction) {
            throw new Error('Missing required parameters: tableName, column, and function');
          }

          const table = this.manager.getTableByName(tableName);
          if (!table) {
            throw new Error(`Table not found: ${tableName}`);
          }

          const aggResult = this.manager.aggregate(table.id, {
            column,
            function: aggFunction,
            filters,
            groupBy
          });

          result = {
            tableName,
            column,
            function: aggFunction,
            value: aggResult.value,
            ...(aggResult.groupedResults && { groupedResults: aggResult.groupedResults })
          };
          break;
        }

        case 'user_data_sql_query': {
          const { query } = args;
          if (!query) {
            throw new Error('Missing required parameter: query');
          }

          const sqlResult = this.manager.executeRawQuery(query);

          result = {
            query,
            rows: sqlResult.rows,
            columns: sqlResult.columns,
            rowCount: sqlResult.rows.length
          };
          break;
        }

        case 'user_data_export_preview': {
          const { tableName, limit = 10 } = args;
          if (!tableName) {
            throw new Error('Missing required parameter: tableName');
          }

          const table = this.manager.getTableByName(tableName);
          if (!table) {
            throw new Error(`Table not found: ${tableName}`);
          }

          const previewData = this.manager.getExportPreview(table.id, Math.min(limit, 100));

          result = {
            tableName,
            previewRows: previewData,
            totalRows: table.rowCount,
            columns: table.schema.map((col) => col.name)
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
}
