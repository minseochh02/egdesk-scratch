import Database from 'better-sqlite3';
import { createHometaxSchema } from './migrations/002-hometax-schema';
import { createCashReceiptsSchema } from './migrations/005-cash-receipts-schema';
import { createTaxExemptInvoicesSchema } from './migrations/024-tax-exempt-invoices-schema';
import { runOnceMigration } from './migration-state';

interface MigrationRunnerParams {
  conversationsDb: Database.Database;
  financeHubDb: Database.Database;
  userDataDb: Database.Database;
}

export async function runSqliteMigrations({
  conversationsDb,
  financeHubDb,
  userDataDb,
}: MigrationRunnerParams): Promise<void> {
  // Legacy pre-separation database support has been removed.
  // Always initialize and migrate against dedicated financehub.db.
  console.log('✅ Initializing dedicated financehub database schema...');
  const { initializeFinanceHubSchema } = await import('./financehub');
  const { migrate006CombineDateTime } = await import('./migrations/006-combine-datetime');
  initializeFinanceHubSchema(financeHubDb);
  createHometaxSchema(financeHubDb);
  createCashReceiptsSchema(financeHubDb);
  createTaxExemptInvoicesSchema(financeHubDb);

  // Run datetime migration
  try {
    migrate006CombineDateTime(financeHubDb);
  } catch (migrationError: any) {
    console.error('⚠️ Migration 006 error:', migrationError.message);
  }

  // =============================================
  // Migration 015-019: Separate bank and card transaction tables
  // =============================================
  try {
    const { migrate015CreateBankTransactions } = await import('./migrations/015-create-bank-transactions');
    const { migrate016CreateCardTransactions } = await import('./migrations/016-create-card-transactions');
    const { migrate017MigrateBankData } = await import('./migrations/017-migrate-bank-data');
    const { migrate018MigrateCardData } = await import('./migrations/018-migrate-card-data');
    const { migrate019VerifyMigration } = await import('./migrations/019-verify-migration');

    migrate015CreateBankTransactions(financeHubDb);
    migrate016CreateCardTransactions(financeHubDb);
    migrate017MigrateBankData(financeHubDb);
    migrate018MigrateCardData(financeHubDb);
    await runOnceMigration(financeHubDb, '019-verify-migration', async () => {
      migrate019VerifyMigration(financeHubDb);
    });
  } catch (migrationError: any) {
    console.error('⚠️ Migrations 015-019 error:', migrationError.message);
  }

  try {
    await runOnceMigration(financeHubDb, '021-normalize-account-display-names', async () => {
      const { migrate021NormalizeAccountDisplayNames } = await import('./migrations/021-normalize-account-display-names');
      migrate021NormalizeAccountDisplayNames(financeHubDb);
    });
  } catch (migration021Error: any) {
    console.error('⚠️ Migration 021 error:', migration021Error.message);
  }

  try {
    await runOnceMigration(financeHubDb, '022-reapply-account-display-name-rules', async () => {
      const { migrate022ReapplyAccountDisplayNameRules } = await import('./migrations/022-reapply-account-display-name-rules');
      migrate022ReapplyAccountDisplayNameRules(financeHubDb);
    });
  } catch (migration022Error: any) {
    console.error('⚠️ Migration 022 error:', migration022Error.message);
  }

  try {
    const { migrate023CreatePromissoryNotes } = await import('./migrations/023-create-promissory-notes');
    migrate023CreatePromissoryNotes(financeHubDb);
  } catch (migration023Error: any) {
    console.error('⚠️ Migration 023 error:', migration023Error.message);
  }

  // =============================================
  // Migration 009: Add vector embeddings support
  // =============================================
  try {
    const { loadVectorExtension } = await import('./vector-extension');
    const vectorLoaded = loadVectorExtension(conversationsDb);

    if (vectorLoaded) {
      const { migrate009AddVectorEmbeddings } = await import('./migrations/009-add-vector-embeddings');
      migrate009AddVectorEmbeddings(conversationsDb);
    } else {
      console.warn('⚠️ Vector extension not available - skipping vector embeddings migration');
    }
  } catch (vectorError: any) {
    console.error('⚠️ Vector setup error:', vectorError.message);
    // Don't fail initialization if vector support unavailable
  }

  // =============================================
  // Migration 010: Add user data vector embeddings support
  // =============================================
  try {
    const { loadVectorExtension } = await import('./vector-extension');
    const vectorLoaded = loadVectorExtension(userDataDb);

    if (vectorLoaded) {
      const { migrate010AddUserDataVectorEmbeddings } = await import(
        './migrations/010-add-userdata-vector-embeddings'
      );
      migrate010AddUserDataVectorEmbeddings(userDataDb);
      console.log('✅ User Data vector embeddings enabled');
    } else {
      console.warn('⚠️ Vector extension not available - skipping user data vector embeddings migration');
    }
  } catch (vectorError: any) {
    console.error('⚠️ User Data vector setup error:', vectorError.message);
    // Don't fail initialization if vector support unavailable
  }

  // Migration 012 is intentionally not executed at startup anymore.
  // Keep the migration file available for manual/dev recovery if needed.
}
