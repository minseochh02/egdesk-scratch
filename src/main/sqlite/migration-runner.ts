import Database from 'better-sqlite3';
import { migrate027CleanupCardDuplicates } from './migrations/027-cleanup-card-duplicates';
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
  
  await runOnceMigration(financeHubDb, 'initialize-financehub-schema', async () => {
    const { initializeFinanceHubSchema } = await import('./financehub');
    initializeFinanceHubSchema(financeHubDb);
  });

  await runOnceMigration(financeHubDb, '024-tax-exempt-invoices-schema', async () => {
    const { createTaxExemptInvoicesSchema } = await import('./migrations/024-tax-exempt-invoices-schema');
    createTaxExemptInvoicesSchema(financeHubDb);
  });

  await runOnceMigration(financeHubDb, '025-tax-bills-schema', async () => {
    const { createTaxBillsSchema } = await import('./migrations/025-tax-bills-schema');
    createTaxBillsSchema(financeHubDb);
  });

  // Run datetime migration
  try {
    await runOnceMigration(financeHubDb, '006-combine-datetime', async () => {
      const { migrate006CombineDateTime } = await import('./migrations/006-combine-datetime');
      migrate006CombineDateTime(financeHubDb);
    });
  } catch (migrationError: any) {
    console.error('⚠️ Migration 006 error:', migrationError.message);
  }

  // =============================================
  // Migration 015-019: Separate bank and card transaction tables
  // =============================================
  try {
    await runOnceMigration(financeHubDb, '015-create-bank-transactions', async () => {
      const { migrate015CreateBankTransactions } = await import('./migrations/015-create-bank-transactions');
      migrate015CreateBankTransactions(financeHubDb);
    });

    await runOnceMigration(financeHubDb, '016-create-card-transactions', async () => {
      const { migrate016CreateCardTransactions } = await import('./migrations/016-create-card-transactions');
      migrate016CreateCardTransactions(financeHubDb);
    });
  } catch (migrationError: any) {
    console.error('⚠️ Migrations 015-016 error:', migrationError.message);
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
    await runOnceMigration(financeHubDb, '023-create-promissory-notes', async () => {
      const { migrate023CreatePromissoryNotes } = await import('./migrations/023-create-promissory-notes');
      migrate023CreatePromissoryNotes(financeHubDb);
    });
  } catch (migration023Error: any) {
    console.error('⚠️ Migration 023 error:', migration023Error.message);
  }

  try {
    await runOnceMigration(financeHubDb, '028-create-ibk-b2b-receivables', async () => {
      const { migrate028CreateIbkB2bReceivables } = await import('./migrations/028-create-ibk-b2b-receivables');
      migrate028CreateIbkB2bReceivables(financeHubDb);
    });
  } catch (migration028Error: any) {
    console.error('⚠️ Migration 028 error:', migration028Error.message);
  }

  try {
    await runOnceMigration(financeHubDb, '029-create-woori-b2b-loan-executions', async () => {
      const { migrate029CreateWooriB2bLoanExecutions } = await import(
        './migrations/029-create-woori-b2b-loan-executions'
      );
      migrate029CreateWooriB2bLoanExecutions(financeHubDb);
    });
  } catch (migration029Error: any) {
    console.error('⚠️ Migration 029 error:', migration029Error.message);
  }

  try {
    await runOnceMigration(financeHubDb, '030-loosen-woori-b2b-loan-executions-unique', async () => {
      const { migrate030LoosenWooriB2bLoanExecutionsUnique } = await import(
        './migrations/030-loosen-woori-b2b-loan-executions-unique'
      );
      migrate030LoosenWooriB2bLoanExecutionsUnique(financeHubDb);
    });
  } catch (migration030Error: any) {
    console.error('⚠️ Migration 030 error:', migration030Error.message);
  }

  try {
    await runOnceMigration(financeHubDb, '031-create-ibk-loan-transactions', async () => {
      const { migrate031CreateIbkLoanTransactions } = await import(
        './migrations/031-create-ibk-loan-transactions'
      );
      migrate031CreateIbkLoanTransactions(financeHubDb);
    });
  } catch (migration031Error: any) {
    console.error('⚠️ Migration 031 error:', migration031Error.message);
  }

  try {
    await runOnceMigration(financeHubDb, '027-cleanup-card-duplicates', async () => {
      const { migrate027CleanupCardDuplicates } = await import('./migrations/027-cleanup-card-duplicates');
      migrate027CleanupCardDuplicates(financeHubDb);
    });
  } catch (migration027Error: any) {
    console.error('⚠️ Migration 027 error:', migration027Error.message);
  }

  try {
    await runOnceMigration(financeHubDb, '032-improve-card-dedup-index', async () => {
      const { migrate032ImproveCardDedupIndex } = await import(
        './migrations/032-improve-card-dedup-index'
      );
      migrate032ImproveCardDedupIndex(financeHubDb);
    });
  } catch (migration032Error: any) {
    console.error('⚠️ Migration 032 error:', migration032Error.message);
  }

  try {
    await runOnceMigration(financeHubDb, '033-drop-incorrect-card-dedup-index', async () => {
      const { migrate033DropIncorrectCardDedupIndex } = await import(
        './migrations/033-drop-incorrect-card-dedup-index'
      );
      migrate033DropIncorrectCardDedupIndex(financeHubDb);
    });
  } catch (migration033Error: any) {
    console.error('⚠️ Migration 033 error:', migration033Error.message);
  }

  try {
    await runOnceMigration(financeHubDb, '034-ensure-dropped-card-dedup-index', async () => {
      const { migrate034EnsureDroppedCardDedupIndex } = await import(
        './migrations/034-ensure-dropped-card-dedup-index'
      );
      migrate034EnsureDroppedCardDedupIndex(financeHubDb);
    });
  } catch (migration034Error: any) {
    console.error('⚠️ Migration 034 error:', migration034Error.message);
  }

  try {
    await runOnceMigration(financeHubDb, '035-create-banking-product-tables-v3', async () => {
      const { migrate035CreateBankingProductTables } = await import(
        './migrations/035-create-banking-product-tables'
      );
      migrate035CreateBankingProductTables(financeHubDb);
    });
  } catch (migration035Error: any) {
    console.error('⚠️ Migration 035 error:', migration035Error.message);
  }

  try {
    await runOnceMigration(financeHubDb, '036-drop-ibk-loan-transactions', async () => {
      const { migrate036DropIbkLoanTransactions } = await import(
        './migrations/036-drop-ibk-loan-transactions'
      );
      migrate036DropIbkLoanTransactions(financeHubDb);
    });
  } catch (migration036Error: any) {
    console.error('⚠️ Migration 036 error:', migration036Error.message);
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
