/**
 * User Data Aggregate Tool
 * Compute aggregations (SUM, AVG, COUNT, MIN, MAX) on user data columns
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

export class UserDataAggregateTool implements ToolExecutor {
  name = 'user_data_aggregate';
  description = 'Compute aggregations (SUM, AVG, COUNT, MIN, MAX) on columns in user-imported tables. Supports optional filtering and grouping. Use this for statistical analysis, reporting, and data summaries.';
  dangerous = false;

  async execute(params: {
    tableName: string;
    column: string;
    function: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
    filters?: Record<string, string>;
    groupBy?: string;
  }): Promise<string> {
    if (!params.tableName) {
      throw new Error('tableName parameter is required');
    }
    if (!params.column) {
      throw new Error('column parameter is required');
    }
    if (!params.function) {
      throw new Error('function parameter is required (SUM, AVG, COUNT, MIN, MAX)');
    }

    const validFunctions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'];
    if (!validFunctions.includes(params.function)) {
      throw new Error(`Invalid function '${params.function}'. Must be one of: ${validFunctions.join(', ')}`);
    }

    try {
      const sqliteManager = getSQLiteManager();
      const userDataManager = sqliteManager.getUserDataManager();

      // Get table info first
      const table = userDataManager.getTableByName(params.tableName);
      if (!table) {
        throw new Error(`Table '${params.tableName}' not found. Use user_data_list_tables to see available tables.`);
      }

      // Perform aggregation
      const result = userDataManager.aggregate(table.id, {
        column: params.column,
        function: params.function,
        filters: params.filters,
        groupBy: params.groupBy
      });

      console.log(`📊 Aggregated ${params.function}(${params.column}) on '${params.tableName}': ${result.value}`);

      // Format the response
      const response = {
        tableName: params.tableName,
        column: params.column,
        function: params.function,
        value: result.value,
        groupedResults: result.groupedResults,
        filters: params.filters,
        groupBy: params.groupBy
      };

      return JSON.stringify(response, null, 2);
    } catch (error) {
      const errorMsg = `Failed to aggregate table '${params.tableName}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
