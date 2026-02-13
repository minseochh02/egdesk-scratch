/**
 * User Data Search Tool
 * Full-text search across all columns in a user-imported table
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

export class UserDataSearchTool implements ToolExecutor {
  name = 'user_data_search';
  description = 'Search across all columns in a user-imported table using full-text search. Useful for finding records that contain specific keywords or values.';
  dangerous = false;

  async execute(params: {
    tableName: string;
    searchQuery: string;
    limit?: number;
  }): Promise<string> {
    if (!params.tableName) {
      throw new Error('tableName parameter is required');
    }
    if (!params.searchQuery) {
      throw new Error('searchQuery parameter is required');
    }

    try {
      const sqliteManager = getSQLiteManager();
      const userDataManager = sqliteManager.getUserDataManager();

      // Get table info first
      const table = userDataManager.getTableByName(params.tableName);
      if (!table) {
        throw new Error(`Table '${params.tableName}' not found. Use user_data_list_tables to see available tables.`);
      }

      // Search the data
      const result = userDataManager.searchData(
        table.id,
        params.searchQuery,
        params.limit || 100
      );

      console.log(`🔍 Searched table '${params.tableName}' for '${params.searchQuery}': ${result.rows.length} matches (total: ${result.total})`);

      // Format the response
      const response = {
        tableName: params.tableName,
        searchQuery: params.searchQuery,
        matchCount: result.rows.length,
        totalRows: result.total,
        matches: result.rows
      };

      return JSON.stringify(response, null, 2);
    } catch (error) {
      const errorMsg = `Failed to search table '${params.tableName}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
