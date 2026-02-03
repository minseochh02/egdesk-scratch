import fs from 'fs';
import path from 'path';
import { getSQLiteManager } from '../sqlite/manager';

/**
 * Cleanup Playwright scheduled tests that reference deleted files
 *
 * This migration should run on app startup to remove orphaned test schedules
 */
export async function cleanupDeletedPlaywrightTests(): Promise<{ removed: number; checked: number }> {
  console.log('🧹 [Migration] Cleaning up deleted Playwright test schedules...');

  try {
    const manager = getSQLiteManager();

    // Playwright tests are stored in wordpress DB, not scheduler DB
    const wordpressDb = manager.getWordPressDatabase();
    const schedulerDb = manager.getSchedulerDatabase();

    // Get all scheduled Playwright tests from wordpress DB
    const scheduledTests = wordpressDb.prepare(`
      SELECT id, test_path, test_name FROM playwright_scheduled_tests
    `).all() as Array<{ id: string; test_path: string; test_name: string }>;

    console.log(`[Migration] Found ${scheduledTests.length} scheduled Playwright tests`);

    let removedCount = 0;
    const testsToRemove: string[] = [];

    // Check each test file
    for (const test of scheduledTests) {
      const testPath = test.test_path;

      // Check if file exists
      if (!fs.existsSync(testPath)) {
        console.log(`[Migration] Test file not found, will remove: ${testPath}`);
        testsToRemove.push(test.id);
        removedCount++;
      }
    }

    // Remove orphaned tests from database
    if (testsToRemove.length > 0) {
      const placeholders = testsToRemove.map(() => '?').join(',');

      // Get test paths before deleting
      const testPaths = scheduledTests
        .filter(t => testsToRemove.includes(t.id))
        .map(t => t.test_path);

      // Remove from playwright_scheduled_tests (wordpress DB)
      wordpressDb.prepare(`
        DELETE FROM playwright_scheduled_tests
        WHERE id IN (${placeholders})
      `).run(...testsToRemove);

      // Also mark any pending scheduler execution intents as cancelled (scheduler DB)
      if (testPaths.length > 0) {
        const pathPlaceholders = testPaths.map(() => '?').join(',');
        schedulerDb.prepare(`
          UPDATE scheduler_execution_intents
          SET status = 'cancelled',
              skip_reason = 'Test file deleted',
              updated_at = datetime('now')
          WHERE scheduler_type = 'playwright'
            AND status IN ('pending', 'running', 'failed')
            AND task_id IN (${pathPlaceholders})
        `).run(...testPaths);
      }

      console.log(`✅ [Migration] Removed ${removedCount} deleted Playwright test schedule(s)`);
    } else {
      console.log('✅ [Migration] No orphaned schedules in playwright_scheduled_tests');
    }

    // ALSO cleanup orphaned execution intents (tests that no longer have schedules)
    // This handles the case where scheduled tests were already deleted but intents remain
    const allPlaywrightIntents = schedulerDb.prepare(`
      SELECT DISTINCT task_id FROM scheduler_execution_intents
      WHERE scheduler_type = 'playwright'
        AND status IN ('pending', 'running', 'failed')
    `).all() as Array<{ task_id: string }>;

    console.log(`[Migration] Found ${allPlaywrightIntents.length} unique Playwright task IDs in execution intents`);

    let orphanedIntentsRemoved = 0;

    for (const intent of allPlaywrightIntents) {
      const testPath = intent.task_id;

      // Check if file exists
      if (!fs.existsSync(testPath)) {
        console.log(`[Migration] Orphaned intent found for deleted file: ${testPath}`);

        // Cancel this orphaned intent
        schedulerDb.prepare(`
          UPDATE scheduler_execution_intents
          SET status = 'cancelled',
              skip_reason = 'Test file deleted (cleanup migration)',
              updated_at = datetime('now')
          WHERE scheduler_type = 'playwright'
            AND task_id = ?
            AND status IN ('pending', 'running', 'failed')
        `).run(testPath);

        orphanedIntentsRemoved++;
      }
    }

    if (orphanedIntentsRemoved > 0) {
      console.log(`✅ [Migration] Cancelled ${orphanedIntentsRemoved} orphaned Playwright execution intent(s)`);
    }

    const totalRemoved = removedCount + orphanedIntentsRemoved;
    console.log(`✅ [Migration] Total cleanup: ${removedCount} schedules + ${orphanedIntentsRemoved} orphaned intents = ${totalRemoved} total`);

    return {
      removed: totalRemoved,
      checked: scheduledTests.length + allPlaywrightIntents.length
    };

  } catch (error) {
    console.error('[Migration] Error cleaning up deleted Playwright tests:', error);
    return {
      removed: 0,
      checked: 0
    };
  }
}
