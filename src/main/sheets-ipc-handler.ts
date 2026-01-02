import { ipcMain } from 'electron';
import { SheetsService } from './mcp/sheets/sheets-service';

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
  ipcMain.handle('sheets:get-or-create-transactions-spreadsheet', async (_, { transactions, banks, accounts, persistentSpreadsheetId }) => {
    try {
      const result = await sheetsService.getOrCreateTransactionsSpreadsheet(transactions, banks, accounts, persistentSpreadsheetId);
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

  console.log('✅ Sheets IPC handlers registered');
}