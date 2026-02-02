/**
 * Automatic Migration Script: Organize Existing Spreadsheets
 *
 * This script automatically moves existing unorganized spreadsheets to appropriate folders
 * on app startup (runs once).
 *
 * Sources of spreadsheet IDs:
 * 1. Electron Store (financeHub.persistentSpreadsheets) - Transaction spreadsheets
 * 2. SQLite (hometax_connections) - Tax invoice spreadsheets
 */

import { google } from 'googleapis';
import { getDriveService } from '../drive-service';
import { getStore } from '../storage';
import { getSQLiteManager } from '../sqlite/manager';
import { getAuthService } from '../auth/auth-service';

interface SpreadsheetToOrganize {
  id: string;
  url: string;
  type: 'transaction' | 'tax-sales' | 'tax-purchase';
  source: string;
  name?: string;
}

/**
 * Extract spreadsheet ID from URL
 */
function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Check if a file is already in the correct folder
 */
async function isAlreadyOrganized(
  drive: any,
  fileId: string,
  targetFolderId: string
): Promise<boolean> {
  try {
    const file = await drive.files.get({
      fileId: fileId,
      fields: 'parents,name',
    });

    return file.data.parents?.includes(targetFolderId) || false;
  } catch (error) {
    console.error(`Failed to check file ${fileId}:`, error);
    return false;
  }
}

/**
 * Organize all existing spreadsheets into appropriate folders
 */
export async function organizeExistingSpreadsheets(): Promise<{
  organized: number;
  skipped: number;
  failed: number;
}> {
  console.log('🔄 Starting automatic spreadsheet organization...');

  try {
    // CHECK 1: Ensure user has Google OAuth token
    const authService = getAuthService();
    const token = await authService.getGoogleWorkspaceToken();

    if (!token?.access_token) {
      console.log('⏭️ Skipping spreadsheet organization: No Google OAuth token');
      console.log('   Migration will run after signing in with Google');
      return { organized: 0, skipped: 0, failed: 0 };
    }

    const driveService = getDriveService();
    const store = getStore();
    const sqliteManager = getSQLiteManager();

    // Collect all spreadsheet IDs to organize
    const spreadsheetsToOrganize: SpreadsheetToOrganize[] = [];

    // Step 1: Collect from Electron Store (persistent spreadsheets)
    try {
      const financeHub = store.get('financeHub') as any;
      const persistentSpreadsheets = financeHub?.persistentSpreadsheets || {};

      for (const [key, info] of Object.entries(persistentSpreadsheets)) {
        const spreadsheet = info as any;
        if (spreadsheet?.spreadsheetId && spreadsheet?.spreadsheetUrl) {
          spreadsheetsToOrganize.push({
            id: spreadsheet.spreadsheetId,
            url: spreadsheet.spreadsheetUrl,
            type: 'transaction',
            source: `electron-store:${key}`,
            name: spreadsheet.title || 'Transaction Spreadsheet',
          });
          console.log(`📋 Found transaction spreadsheet: ${key}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not read from Electron Store:', error);
    }

    // Step 2: Collect from SQLite (hometax connections)
    try {
      const db = sqliteManager.getFinanceHubDatabase();
      const connections = db.prepare('SELECT * FROM hometax_connections').all() as any[];

      for (const conn of connections) {
        // Sales spreadsheets
        if (conn.sales_spreadsheet_url) {
          const salesId = extractSpreadsheetId(conn.sales_spreadsheet_url);
          if (salesId) {
            spreadsheetsToOrganize.push({
              id: salesId,
              url: conn.sales_spreadsheet_url,
              type: 'tax-sales',
              source: `sqlite:${conn.business_number}:sales`,
              name: `Sales Invoices - ${conn.business_number}`,
            });
            console.log(`📋 Found sales invoice spreadsheet: ${conn.business_number}`);
          }
        }

        // Purchase spreadsheets
        if (conn.purchase_spreadsheet_url) {
          const purchaseId = extractSpreadsheetId(conn.purchase_spreadsheet_url);
          if (purchaseId) {
            spreadsheetsToOrganize.push({
              id: purchaseId,
              url: conn.purchase_spreadsheet_url,
              type: 'tax-purchase',
              source: `sqlite:${conn.business_number}:purchase`,
              name: `Purchase Invoices - ${conn.business_number}`,
            });
            console.log(`📋 Found purchase invoice spreadsheet: ${conn.business_number}`);
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not read from SQLite:', error);
    }

    console.log(`📊 Total spreadsheets to organize: ${spreadsheetsToOrganize.length}`);

    if (spreadsheetsToOrganize.length === 0) {
      console.log('✅ No spreadsheets to organize');
      return { organized: 0, skipped: 0, failed: 0 };
    }

    // Step 3: Organize each spreadsheet
    let organized = 0;
    let skipped = 0;
    let failed = 0;

    // Get OAuth2 client for Drive API
    const auth = await (driveService as any).getOAuth2Client();
    const drive = google.drive({ version: 'v3', auth });

    for (const sheet of spreadsheetsToOrganize) {
      try {
        // Determine target folder
        const targetFolder = sheet.type === 'transaction'
          ? 'Transactions'
          : 'Tax Invoices';

        // Get folder config
        const folderConfig = await driveService.findOrCreateSubfolder(targetFolder as any);

        // Check if already in correct folder
        const alreadyOrganized = await isAlreadyOrganized(
          drive,
          sheet.id,
          folderConfig.folderId
        );

        if (alreadyOrganized) {
          console.log(`✓ Already organized: ${sheet.name || sheet.id}`);
          skipped++;
          continue;
        }

        // Move to correct folder
        await driveService.moveFileToFolder(sheet.id, targetFolder as any);
        console.log(`✅ Organized: ${sheet.name || sheet.id} → ${targetFolder}`);
        organized++;

      } catch (error) {
        console.error(`❌ Failed to organize ${sheet.source}:`, error);
        failed++;
      }
    }

    console.log('');
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Organized: ${organized}`);
    console.log(`   ✓ Already organized: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('');

    // Mark migration as complete
    store.set('migrations.spreadsheetsOrganized', true);
    store.set('migrations.spreadsheetsOrganizedAt', new Date().toISOString());

    return { organized, skipped, failed };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Check if migration has already been run
 */
export function hasMigrationRun(): boolean {
  try {
    const store = getStore();
    return store.get('migrations.spreadsheetsOrganized', false) as boolean;
  } catch (error) {
    console.warn('Could not check migration status:', error);
    return false;
  }
}

/**
 * Reset migration status (for testing)
 */
export function resetMigrationStatus(): void {
  try {
    const store = getStore();
    store.delete('migrations.spreadsheetsOrganized');
    store.delete('migrations.spreadsheetsOrganizedAt');
    console.log('🔄 Reset migration status');
  } catch (error) {
    console.error('Failed to reset migration status:', error);
  }
}
