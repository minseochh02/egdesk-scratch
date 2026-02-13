/**
 * User Data List Tables Tool
 * Lists all user-imported database tables
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

export class UserDataListTablesTool implements ToolExecutor {
  name = 'user_data_list_tables';
  description = 'List all user-imported database tables with metadata (from Excel, CSV imports). Shows table names, row counts, column counts, and descriptions.';
  dangerous = false;

  async execute(): Promise<string> {
    try {
      const sqliteManager = getSQLiteManager();
      const userDataManager = sqliteManager.getUserDataManager();

      const tables = userDataManager.getAllTables();

      console.log(`🗄️ Found ${tables.length} user data tables`);

      if (tables.length === 0) {
        return JSON.stringify({
          message: 'No user data tables found. Users can import data via the User Data page in the application.',
          totalTables: 0,
          tables: []
        }, null, 2);
      }

      // Format the response
      const response = {
        totalTables: tables.length,
        tables: tables.map(table => ({
          tableName: table.tableName,
          displayName: table.displayName,
          description: table.description,
          rowCount: table.rowCount,
          columnCount: table.columnCount,
          createdAt: table.createdAt,
          updatedAt: table.updatedAt,
          createdFromFile: table.createdFromFile,
          columns: table.schema.map(col => ({
            name: col.name,
            type: col.type,
            notNull: col.notNull
          }))
        }))
      };

      return JSON.stringify(response, null, 2);
    } catch (error) {
      const errorMsg = `Failed to list user data tables: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
