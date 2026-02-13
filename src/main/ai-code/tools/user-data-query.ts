/**
 * User Data Query Tool
 * Allows internal AI to query user-imported database tables
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

export class UserDataQueryTool implements ToolExecutor {
  name = 'user_data_query';
  description = 'Query data from user-imported database tables (Excel, CSV imports). Supports filters, pagination, and sorting. Use this to analyze customer data, sales records, or any imported spreadsheet data.';
  dangerous = false;

  async execute(params: {
    tableName: string;
    filters?: Record<string, string>;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  }): Promise<string> {
    if (!params.tableName) {
      throw new Error('tableName parameter is required');
    }

    try {
      const sqliteManager = getSQLiteManager();
      const userDataManager = sqliteManager.getUserDataManager();

      // Get table info first
      const table = userDataManager.getTableByName(params.tableName);
      if (!table) {
        throw new Error(`Table '${params.tableName}' not found. Use user_data_list_tables to see available tables.`);
      }

      // Query the data
      const result = userDataManager.queryData(table.id, {
        filters: params.filters,
        limit: params.limit || 100,
        offset: params.offset || 0,
        orderBy: params.orderBy,
        orderDirection: params.orderDirection || 'ASC'
      });

      console.log(`🗄️ Queried table '${params.tableName}': ${result.rows.length} rows (total: ${result.total})`);

      // Format the response
      const response = {
        tableName: params.tableName,
        displayName: table.displayName,
        description: table.description,
        rowCount: result.total,
        returnedRows: result.rows.length,
        columns: table.schema.map(col => ({
          name: col.name,
          type: col.type
        })),
        data: result.rows,
        hasMore: result.offset + result.rows.length < result.total,
        pagination: {
          limit: result.limit,
          offset: result.offset,
          total: result.total
        }
      };

      return JSON.stringify(response, null, 2);
    } catch (error) {
      const errorMsg = `Failed to query table '${params.tableName}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
