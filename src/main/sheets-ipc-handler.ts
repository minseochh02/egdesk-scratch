import { ipcMain } from 'electron';
import { SheetsService } from './mcp/sheets/sheets-service';
import { createSheetToSQLImporter } from './mcp/sheets/sheet-to-sql';
import { getSQLiteManager } from './sqlite/manager';
import { organizeExistingSpreadsheets, hasMigrationRun } from './migrations/organize-existing-spreadsheets';

/**
 * Run migration once before first spreadsheet sync
 */
async function ensureMigrationRun(): Promise<void> {
  if (!hasMigrationRun()) {
    console.log('🔄 First spreadsheet sync - running organization migration...');
    try {
      await organizeExistingSpreadsheets();
      console.log('✅ Migration complete');
    } catch (error) {
      console.warn('⚠️ Migration failed (non-blocking):', error);
      // Don't block spreadsheet sync if migration fails
    }
  }
}

export function registerSheetsHandlers(): void {
  const sheetsService = new SheetsService();

  // Create transactions spreadsheet
  ipcMain.handle('sheets:create-transactions-spreadsheet', async (_, { title, transactions, banks, accounts }) => {
    try {
      const result = await sheetsService.createTransactionsSpreadsheet(title, transactions, banks, accounts);
      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      console.error('Error creating transactions spreadsheet:', error);
      return {
        success: false,
        error: error.message || 'Failed to create spreadsheet',
      };
    }
  });

  // Get or create persistent transactions spreadsheet
  ipcMain.handle('sheets:get-or-create-transactions-spreadsheet', async (_, { transactions, banks, accounts, persistentSpreadsheetId, customTitle }) => {
    try {
      // Trigger migration on first sync
      await ensureMigrationRun();

      const result = await sheetsService.getOrCreateTransactionsSpreadsheet(transactions, banks, accounts, persistentSpreadsheetId, customTitle);
      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      console.error('Error getting/creating persistent transactions spreadsheet:', error);
      return {
        success: false,
        error: error.message || 'Failed to get or create spreadsheet',
      };
    }
  });

  // Generic create spreadsheet
  ipcMain.handle('sheets:create-spreadsheet', async (_, { title, data }) => {
    try {
      const result = await sheetsService.createSpreadsheet(title, data);
      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      console.error('Error creating spreadsheet:', error);
      return {
        success: false,
        error: error.message || 'Failed to create spreadsheet',
      };
    }
  });

  // Get spreadsheet
  ipcMain.handle('sheets:get-spreadsheet', async (_, spreadsheetId: string) => {
    try {
      const metadata = await sheetsService.getSpreadsheet(spreadsheetId);
      return {
        success: true,
        metadata,
      };
    } catch (error: any) {
      console.error('Error getting spreadsheet:', error);
      return {
        success: false,
        error: error.message || 'Failed to get spreadsheet',
      };
    }
  });

  // Get range
  ipcMain.handle('sheets:get-range', async (_, { spreadsheetId, range }) => {
    try {
      const data = await sheetsService.getRange(spreadsheetId, range);
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error('Error getting range:', error);
      return {
        success: false,
        error: error.message || 'Failed to get range',
      };
    }
  });

  // Update range
  ipcMain.handle('sheets:update-range', async (_, { spreadsheetId, range, values }) => {
    try {
      await sheetsService.updateRange(spreadsheetId, range, values);
      return {
        success: true,
      };
    } catch (error: any) {
      console.error('Error updating range:', error);
      return {
        success: false,
        error: error.message || 'Failed to update range',
      };
    }
  });

  // Import sheet to SQL
  ipcMain.handle('sheets:import-to-sql', async (_, { spreadsheetId, sheetName }) => {
    try {
      const sqliteManager = getSQLiteManager();
      const db = sqliteManager.getConversationsDatabase();
      
      const importer = createSheetToSQLImporter(db);
      const createdTables = await importer.importSheet(spreadsheetId, sheetName);
      
      return {
        success: true,
        tables: createdTables,
      };
    } catch (error: any) {
      console.error('Error importing sheet to SQL:', error);
      return {
        success: false,
        error: error.message || 'Failed to import sheet',
      };
    }
  });

  // Get imported tables info
  ipcMain.handle('sheets:get-imported-tables', async (_, spreadsheetId: string) => {
    try {
      const sqliteManager = getSQLiteManager();
      const db = sqliteManager.getConversationsDatabase();

      const importer = createSheetToSQLImporter(db);
      const tables = await importer.getImportedTables(spreadsheetId);

      console.log('[sheets:get-imported-tables] Raw tables from importer:', tables.length);
      console.log('[sheets:get-imported-tables] Tables:', JSON.stringify(tables, null, 2));

      // Add original sheet names by parsing table names
      const tablesWithNames = tables.map(table => {
        // Extract the sheet name part from table name (after spreadsheetId prefix)
        const parts = table.tableName.split('_');
        if (parts.length > 2) {
          // Join everything after "sheet_[id]_"
          const sheetNamePart = parts.slice(2).join('_');
          return {
            ...table,
            originalSheetName: sheetNamePart.replace(/_/g, ' ')
          };
        }
        return table;
      });

      console.log('[sheets:get-imported-tables] Tables with names:', tablesWithNames.length);
      console.log('[sheets:get-imported-tables] Final result:', JSON.stringify(tablesWithNames, null, 2));

      return {
        success: true,
        tables: tablesWithNames,
      };
    } catch (error: any) {
      console.error('Error getting imported tables:', error);
      return {
        success: false,
        error: error.message || 'Failed to get imported tables',
      };
    }
  });

  // Export tax invoices to spreadsheet
  ipcMain.handle('sheets:export-tax-invoices', async (_, { invoices, invoiceType, existingSpreadsheetUrl }) => {
    try {
      // Trigger migration on first sync
      await ensureMigrationRun();

      const result = await sheetsService.exportTaxInvoicesToSpreadsheet(invoices, invoiceType, existingSpreadsheetUrl);

      // If successful and we have a spreadsheet URL, save it to the database
      if (result.success && result.spreadsheetUrl && invoices.length > 0) {
        const businessNumber = invoices[0].business_number;
        if (businessNumber) {
          try {
            const { saveSpreadsheetUrl } = await import('./sqlite/hometax');
            const sqliteManager = getSQLiteManager();
            const db = sqliteManager.getFinanceHubDatabase();
            saveSpreadsheetUrl(db, businessNumber, invoiceType, result.spreadsheetUrl);
          } catch (saveError) {
            console.error('Error saving spreadsheet URL:', saveError);
            // Don't fail the export if URL saving fails
          }
        }
      }

      return result;
    } catch (error: any) {
      console.error('Error exporting tax invoices:', error);
      return {
        success: false,
        error: error.message || 'Failed to export tax invoices',
      };
    }
  });

  // Query imported table data
  ipcMain.handle('sheets:query-imported-table', async (_, { tableName, limit = 100, offset = 0 }) => {
    try {
      const sqliteManager = getSQLiteManager();
      const db = sqliteManager.getConversationsDatabase();
      
      // Get column info
      const columns = db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{name: string}>;
      
      // Get headers mapping
      let headersMapping: Record<string, string> = {};
      try {
        const headers = db.prepare(`
          SELECT sql_name, original_name 
          FROM "${tableName}_headers"
          ORDER BY column_index
        `).all() as Array<{sql_name: string, original_name: string}>;
        
        headers.forEach(h => {
          headersMapping[h.sql_name] = h.original_name;
        });
      } catch (err) {
        // Headers table might not exist for older imports
        console.log('No headers table found for', tableName);
      }
      
      // Get data
      const query = `SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`;
      const rows = db.prepare(query).all(limit, offset);
      
      // Get total count
      const countResult = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get() as {count: number};
      
      return {
        success: true,
        columns: columns.map(c => c.name),
        headersMapping,
        rows,
        totalCount: countResult.count,
      };
    } catch (error: any) {
      console.error('Error querying imported table:', error);
      return {
        success: false,
        error: error.message || 'Failed to query table',
      };
    }
  });

  console.log('✅ Sheets IPC handlers registered');
}