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
      },
      {
        name: 'user_data_create_table',
        description: 'Create a new user data table with specified schema',
        inputSchema: {
          type: 'object',
          properties: {
            displayName: {
              type: 'string',
              description: 'Display name for the table'
            },
            schema: {
              type: 'array',
              description: 'Array of column definitions (excluding auto-generated id column)',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Column name' },
                  type: { type: 'string', enum: ['TEXT', 'INTEGER', 'REAL', 'DATE'], description: 'Column data type' },
                  notNull: { type: 'boolean', description: 'Whether column is NOT NULL' },
                  defaultValue: { description: 'Default value for the column' }
                },
                required: ['name', 'type']
              }
            },
            description: {
              type: 'string',
              description: 'Optional description of the table'
            },
            tableName: {
              type: 'string',
              description: 'Optional SQL table name (auto-generated if not provided)'
            },
            uniqueKeyColumns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional columns to use for duplicate detection'
            },
            duplicateAction: {
              type: 'string',
              enum: ['skip', 'update', 'allow', 'replace-date-range'],
              description: 'Action to take when duplicates are found'
            }
          },
          required: ['displayName', 'schema']
        }
      },
      {
        name: 'user_data_insert_rows',
        description: 'Insert rows into a table',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'The name of the table to insert into'
            },
            rows: {
              type: 'array',
              description: 'Array of row objects to insert (keys must match column names)',
              items: { type: 'object' }
            }
          },
          required: ['tableName', 'rows']
        }
      },
      {
        name: 'user_data_delete_table',
        description: 'Delete a table and all its data',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'The name of the table to delete'
            }
          },
          required: ['tableName']
        }
      },
      {
        name: 'user_data_rename_table',
        description: 'Rename a table',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'Current table name'
            },
            newTableName: {
              type: 'string',
              description: 'New table name'
            },
            newDisplayName: {
              type: 'string',
              description: 'Optional new display name'
            }
          },
          required: ['tableName', 'newTableName']
        }
      },
      {
        name: 'user_data_delete_rows',
        description: 'Delete rows from a table by ID or by filter conditions',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'The name of the table'
            },
            ids: {
              type: 'array',
              items: { type: 'number' },
              description: 'Array of row IDs to delete'
            },
            filters: {
              type: 'object',
              description: 'Filter conditions for rows to delete (e.g., {"age": ">30", "status": "inactive"})',
              additionalProperties: { type: 'string' }
            }
          },
          required: ['tableName']
        }
      },
      {
        name: 'user_data_update_rows',
        description: 'Update existing rows in a table by ID or by filter conditions',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'The name of the table'
            },
            updates: {
              type: 'object',
              description: 'Fields to update with their new values (e.g., {"name": "New Name", "isActive": true})',
              additionalProperties: true
            },
            ids: {
              type: 'array',
              items: { type: 'number' },
              description: 'Array of row IDs to update'
            },
            filters: {
              type: 'object',
              description: 'Filter conditions for rows to update (e.g., {"status": "pending"})',
              additionalProperties: { type: 'string' }
            }
          },
          required: ['tableName', 'updates']
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

        case 'user_data_create_table': {
          const { displayName, schema, description, tableName, uniqueKeyColumns, duplicateAction } = args;
          if (!displayName || !schema) {
            throw new Error('Missing required parameters: displayName and schema');
          }

          const createdTable = this.manager.createTableFromSchema(displayName, schema, {
            tableName,
            description,
            uniqueKeyColumns,
            duplicateAction
          });

          result = {
            success: true,
            table: {
              id: createdTable.id,
              tableName: createdTable.tableName,
              displayName: createdTable.displayName,
              description: createdTable.description,
              rowCount: createdTable.rowCount,
              columnCount: createdTable.columnCount,
              schema: createdTable.schema,
              createdAt: createdTable.createdAt
            }
          };
          break;
        }

        case 'user_data_insert_rows': {
          const { tableName, rows } = args;
          if (!tableName || !rows) {
            throw new Error('Missing required parameters: tableName and rows');
          }

          const table = this.manager.getTableByName(tableName);
          if (!table) {
            throw new Error(`Table not found: ${tableName}`);
          }

          const insertResult = this.manager.insertRows(table.id, rows);

          result = {
            success: true,
            tableName,
            inserted: insertResult.inserted,
            skipped: insertResult.skipped,
            duplicates: insertResult.duplicates,
            errors: insertResult.errors,
            duplicateDetails: insertResult.duplicateDetails,
            errorDetails: insertResult.errorDetails
          };
          break;
        }

        case 'user_data_delete_table': {
          const { tableName } = args;
          if (!tableName) {
            throw new Error('Missing required parameter: tableName');
          }

          const table = this.manager.getTableByName(tableName);
          if (!table) {
            throw new Error(`Table not found: ${tableName}`);
          }

          const deleteSuccess = this.manager.deleteTable(table.id);

          result = {
            success: deleteSuccess,
            tableName,
            message: deleteSuccess ? 'Table deleted successfully' : 'Failed to delete table'
          };
          break;
        }

        case 'user_data_rename_table': {
          const { tableName, newTableName, newDisplayName } = args;
          if (!tableName || !newTableName) {
            throw new Error('Missing required parameters: tableName and newTableName');
          }

          const table = this.manager.getTableByName(tableName);
          if (!table) {
            throw new Error(`Table not found: ${tableName}`);
          }

          const renameResult = this.manager.renameTable(table.id, newTableName, newDisplayName);

          result = {
            success: renameResult.success,
            oldTableName: tableName,
            newTableName: renameResult.table?.tableName,
            newDisplayName: renameResult.table?.displayName,
            error: renameResult.error,
            table: renameResult.table
          };
          break;
        }

        case 'user_data_delete_rows': {
          const { tableName, ids, filters } = args;
          if (!tableName) {
            throw new Error('Missing required parameter: tableName');
          }

          if (!ids && !filters) {
            throw new Error('Must provide either ids or filters for deletion');
          }

          const table = this.manager.getTableByName(tableName);
          if (!table) {
            throw new Error(`Table not found: ${tableName}`);
          }

          const deleteResult = this.manager.deleteRows(table.id, { ids, filters });

          result = {
            success: true,
            tableName,
            deleted: deleteResult.deleted
          };
          break;
        }

        case 'user_data_update_rows': {
          const { tableName, updates, ids, filters } = args;
          if (!tableName) {
            throw new Error('Missing required parameter: tableName');
          }

          if (!updates) {
            throw new Error('Missing required parameter: updates');
          }

          if (!ids && !filters) {
            throw new Error('Must provide either ids or filters for update');
          }

          const table = this.manager.getTableByName(tableName);
          if (!table) {
            throw new Error(`Table not found: ${tableName}`);
          }

          const updateResult = this.manager.updateRows(table.id, updates, { ids, filters });

          result = {
            success: true,
            tableName,
            updated: updateResult.updated
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
