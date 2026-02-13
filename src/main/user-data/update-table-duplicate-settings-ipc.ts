import { ipcMain } from 'electron';
import { getSQLiteManager } from '../sqlite/manager';

/**
 * IPC handler to update duplicate detection settings for existing tables
 */
export function registerUpdateTableDuplicateSettingsHandler(): void {
  ipcMain.handle(
    'user-data:update-duplicate-settings',
    async (
      event,
      tableId: string,
      settings: {
        uniqueKeyColumns: string[];
        duplicateAction: 'skip' | 'update' | 'allow';
      }
    ) => {
      try {
        const manager = getSQLiteManager();
        const db = manager.getUserDataDatabase();

        const uniqueKeyColumnsJson =
          settings.uniqueKeyColumns && settings.uniqueKeyColumns.length > 0
            ? JSON.stringify(settings.uniqueKeyColumns)
            : null;

        const stmt = db.prepare(`
          UPDATE user_tables 
          SET unique_key_columns = ?,
              duplicate_action = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `);

        stmt.run(uniqueKeyColumnsJson, settings.duplicateAction, tableId);

        console.log(`✅ Updated duplicate settings for table ${tableId}:`, {
          uniqueKeyColumns: settings.uniqueKeyColumns,
          duplicateAction: settings.duplicateAction,
        });

        return {
          success: true,
        };
      } catch (error) {
        console.error('Error updating duplicate settings:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
