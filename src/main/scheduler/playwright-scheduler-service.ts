/**
 * Playwright Scheduler Service
 *
 * Handles scheduling and execution of Playwright test runs using node-schedule
 */

import { randomUUID } from 'crypto';
import * as schedule from 'node-schedule';
import { getSQLiteManager } from '../sqlite/manager';
import { PlaywrightScheduledTest } from '../sqlite/playwright-scheduler';
import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import { getSchedulerRecoveryService } from './recovery-service';

export class PlaywrightSchedulerService {
  private static instance: PlaywrightSchedulerService | null = null;

  private sqliteManager = getSQLiteManager();
  private isRunning = false;
  private scheduledJobs: Map<string, schedule.Job> = new Map();
  private executionInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): PlaywrightSchedulerService {
    if (!PlaywrightSchedulerService.instance) {
      PlaywrightSchedulerService.instance = new PlaywrightSchedulerService();
    }
    return PlaywrightSchedulerService.instance;
  }

  /**
   * Start the Playwright scheduler service
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🎭 Playwright scheduler service is already running');
      return;
    }

    this.isRunning = true;
    console.log('🎭 Starting Playwright scheduler service...');

    // Validate and clean up orphaned tests on startup
    await this.validateAndCleanupTests();

    // Schedule all enabled tests
    await this.scheduleAllTests();

    // Set up periodic check for new/updated tests (every minute)
    this.executionInterval = setInterval(async () => {
      try {
        await this.checkAndUpdateSchedules();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error in Playwright scheduler periodic check: ${errorMessage}`);
      }
    }, 60000);

    console.log('✅ Playwright scheduler service started');
  }

  /**
   * Stop the Playwright scheduler service
   */
  public stop(): void {
    console.log(`🛑 Stopping Playwright scheduler (${this.scheduledJobs.size} jobs)...`);

    // Cancel all scheduled jobs
    for (const [testId, job] of this.scheduledJobs) {
      job.cancel();
      console.log(`   Cancelled job for test: ${testId}`);
    }
    this.scheduledJobs.clear();

    // Clear the interval
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    this.isRunning = false;
    console.log('✅ Playwright scheduler service stopped');
  }

  /**
   * Restart the scheduler
   */
  public async restart(): Promise<void> {
    this.stop();
    await this.start();
  }

  /**
   * Check if the scheduler is running
   */
  public isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the number of scheduled jobs
   */
  public getScheduledJobCount(): number {
    return this.scheduledJobs.size;
  }

  // ============================================
  // Scheduling Methods
  // ============================================

  /**
   * Validate all tests and cleanup orphaned entries
   */
  private async validateAndCleanupTests(): Promise<void> {
    try {
      const fs = require('fs');
      const playwrightSchedulerManager = this.sqliteManager.getPlaywrightSchedulerManager();
      const allTests = playwrightSchedulerManager.getAllTests();

      let removedCount = 0;

      for (const test of allTests) {
        if (!fs.existsSync(test.testPath)) {
          console.warn(`⚠️ Orphaned test found: "${test.testName}" (file: ${test.testPath})`);
          console.log(`🧹 Auto-cleanup: Removing orphaned test from database`);

          // Delete from database (no need to unschedule since we haven't scheduled yet)
          playwrightSchedulerManager.deleteTest(test.id);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        console.log(`✅ Cleaned up ${removedCount} orphaned test(s)`);
      }
    } catch (error) {
      console.error('❌ Error during test validation:', error);
    }
  }

  /**
   * Schedule all enabled tests
   */
  private async scheduleAllTests(): Promise<void> {
    try {
      const playwrightSchedulerManager = this.sqliteManager.getPlaywrightSchedulerManager();
      const enabledTests = playwrightSchedulerManager.getEnabledTests();

      console.log(`📅 Scheduling ${enabledTests.length} enabled Playwright tests...`);

      for (const test of enabledTests) {
        await this.scheduleTest(test);
      }

      console.log(`✅ Scheduled ${this.scheduledJobs.size} Playwright tests`);
    } catch (error) {
      console.error('❌ Error scheduling Playwright tests:', error);
    }
  }

  /**
   * Schedule a single test
   */
  private async scheduleTest(test: PlaywrightScheduledTest): Promise<void> {
    try {
      // Cancel existing job if exists
      if (this.scheduledJobs.has(test.id)) {
        this.scheduledJobs.get(test.id)?.cancel();
        this.scheduledJobs.delete(test.id);
      }

      // Create schedule rule
      const scheduleRule = this.createScheduleRule(test);
      if (!scheduleRule) {
        console.warn(`⚠️ Invalid schedule for test: ${test.testName}`);
        return;
      }

      // Schedule the job
      const job = schedule.scheduleJob(scheduleRule, async () => {
        console.log(`🎭 Executing Playwright test: ${test.testName}`);
        await this.executeTest(test.id);
      });

      if (job) {
        this.scheduledJobs.set(test.id, job);

        // Update next run time in database
        const nextInvocation = job.nextInvocation();
        if (nextInvocation) {
          const playwrightSchedulerManager = this.sqliteManager.getPlaywrightSchedulerManager();
          playwrightSchedulerManager.updateNextRun(test.id, nextInvocation.toDate());

          // Create execution intent for recovery tracking
          try {
            const recoveryService = getSchedulerRecoveryService();
            const nextRunDate = nextInvocation.toDate();
            const windowEnd = new Date(nextRunDate.getTime() + 2 * 60 * 60 * 1000); // 2-hour window

            await recoveryService.createIntent({
              schedulerType: 'playwright',
              taskId: test.id,
              taskName: test.testName,
              intendedDate: nextRunDate.toISOString().split('T')[0],
              intendedTime: test.scheduledTime,
              executionWindowStart: nextRunDate.toISOString(),
              executionWindowEnd: windowEnd.toISOString(),
              status: 'pending',
            });
          } catch (error) {
            console.error(`[PlaywrightScheduler] Failed to create execution intent for test "${test.testName}":`, error);
          }
        }

        console.log(`✅ Scheduled test "${test.testName}" - Next run: ${nextInvocation?.toDate().toISOString() || 'unknown'}`);
      } else {
        console.warn(`❌ Failed to schedule test "${test.testName}"`);
      }
    } catch (error) {
      console.error(`❌ Error scheduling test "${test.testName}":`, error);
    }
  }

  /**
   * Create schedule rule based on test configuration
   */
  private createScheduleRule(test: PlaywrightScheduledTest): schedule.RecurrenceRule | string | null {
    const [hours, minutes] = test.scheduledTime.split(':').map(Number);

    switch (test.frequencyType) {
      case 'daily': {
        const rule = new schedule.RecurrenceRule();
        rule.hour = hours;
        rule.minute = minutes;
        rule.second = 0;
        return rule;
      }

      case 'weekly': {
        if (test.dayOfWeek !== undefined) {
          const rule = new schedule.RecurrenceRule();
          rule.dayOfWeek = test.dayOfWeek;
          rule.hour = hours;
          rule.minute = minutes;
          rule.second = 0;
          return rule;
        }
        return null;
      }

      case 'monthly': {
        if (test.dayOfMonth !== undefined) {
          const rule = new schedule.RecurrenceRule();
          rule.date = test.dayOfMonth;
          rule.hour = hours;
          rule.minute = minutes;
          rule.second = 0;
          return rule;
        }
        return null;
      }

      case 'custom': {
        // For custom interval, we use daily check and track internally
        const rule = new schedule.RecurrenceRule();
        rule.hour = hours;
        rule.minute = minutes;
        rule.second = 0;
        return rule;
      }

      default:
        console.warn(`⚠️ Unknown frequency type: ${test.frequencyType}`);
        return null;
    }
  }

  /**
   * Check if a custom interval test should execute
   */
  private shouldExecuteCustomTest(test: PlaywrightScheduledTest): boolean {
    if (test.frequencyType !== 'custom' || !test.customIntervalDays) {
      return true; // Not a custom test, always execute
    }

    if (!test.lastRun) {
      return true; // Never run before, should execute
    }

    const lastRun = new Date(test.lastRun);
    const now = new Date();
    const daysSinceLastRun = Math.floor(
      (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceLastRun >= test.customIntervalDays;
  }

  /**
   * Check for schedule updates and validate test files
   */
  private async checkAndUpdateSchedules(): Promise<void> {
    if (process.env.DEBUG_PLAYWRIGHT_SCHEDULER === 'true') {
      console.log('🔍 Checking Playwright scheduler for updates...');
    }

    // Validate all enabled tests - auto-cleanup orphaned tests
    const fs = require('fs');
    const playwrightSchedulerManager = this.sqliteManager.getPlaywrightSchedulerManager();
    const enabledTests = playwrightSchedulerManager.getEnabledTests();

    for (const test of enabledTests) {
      if (!fs.existsSync(test.testPath)) {
        console.warn(`⚠️ Test file not found during validation: ${test.testPath}`);
        console.log(`🧹 Auto-cleanup: Removing orphaned test "${test.testName}" from scheduler`);

        // Unschedule the job
        this.unscheduleTest(test.id);

        // Delete from database
        playwrightSchedulerManager.deleteTest(test.id);
      }
    }
  }

  // ============================================
  // Execution Methods
  // ============================================

  /**
   * Execute a test by ID
   */
  public async executeTest(testId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const startTime = new Date();
    const today = startTime.toISOString().split('T')[0];
    const executionId = randomUUID();
    const playwrightSchedulerManager = this.sqliteManager.getPlaywrightSchedulerManager();
    const recoveryService = getSchedulerRecoveryService();

    // Get fresh test data
    const test = playwrightSchedulerManager.getTest(testId);
    if (!test) {
      return { success: false, error: 'Test not found' };
    }

    // Auto-cleanup: Check if test file exists, if not delete from scheduler
    const fs = require('fs');
    if (!fs.existsSync(test.testPath)) {
      console.warn(`⚠️ Test file not found: ${test.testPath}`);
      console.log(`🧹 Auto-cleanup: Removing orphaned test "${test.testName}" from scheduler`);

      // Unschedule the job
      this.unscheduleTest(testId);

      // Delete from database
      playwrightSchedulerManager.deleteTest(testId);

      return { success: false, error: `Test file not found and removed from scheduler: ${test.testPath}` };
    }

    // Deduplication: Check if already ran today
    try {
      const hasRun = await recoveryService.hasRunToday('playwright', test.id);
      if (hasRun) {
        console.log(`[PlaywrightScheduler] Test "${test.testName}" already ran today - skipping duplicate execution`);
        return { success: true };
      }
    } catch (error) {
      console.error('[PlaywrightScheduler] Failed to check hasRunToday:', error);
    }

    // Check custom interval
    if (!this.shouldExecuteCustomTest(test)) {
      console.log(`⏳ Skipping custom test "${test.testName}" - interval not yet reached`);
      return { success: true }; // Not an error, just not time yet
    }

    console.log(`\n🎭 ===== EXECUTING PLAYWRIGHT TEST =====`);
    console.log(`📝 Test: ${test.testName}`);
    console.log(`📁 Path: ${test.testPath}`);
    console.log(`🕐 Started at: ${startTime.toISOString()}`);

    // Mark intent as running
    try {
      await recoveryService.markIntentRunning('playwright', test.id, today, executionId);
    } catch (error) {
      console.error('[PlaywrightScheduler] Failed to mark intent as running:', error);
    }

    // Create execution record
    const execution = playwrightSchedulerManager.createExecution({
      testId: test.id,
      status: 'running',
      startedAt: startTime
    });

    let errorMessage: string | undefined;
    let success = false;

    try {
      // Execute the test using the existing run-playwright-test logic
      console.log('🚀 Calling runPlaywrightTest...');
      await this.runPlaywrightTest(test.testPath);

      console.log(`✅ Test completed successfully`);
      success = true;

    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Test failed with error: ${errorMessage}`);
      console.error('❌ Full error object:', error);
      if (error instanceof Error && error.stack) {
        console.error('❌ Stack trace:', error.stack);
      }
      success = false;
    }

    // Update execution record
    const completedAt = new Date();
    const duration = completedAt.getTime() - startTime.getTime();

    playwrightSchedulerManager.updateExecution(execution.id, {
      testId: test.id,
      status: success ? 'success' : 'failure',
      startedAt: startTime,
      completedAt,
      duration,
      errorMessage
    });

    // Update test statistics
    playwrightSchedulerManager.updateTestStats(test.id, success);

    // Calculate and update next run time
    if (this.scheduledJobs.has(test.id)) {
      const job = this.scheduledJobs.get(test.id)!;
      const nextInvocation = job.nextInvocation();
      if (nextInvocation) {
        playwrightSchedulerManager.updateNextRun(test.id, nextInvocation.toDate());
        console.log(`⏰ Next run: ${nextInvocation.toDate().toISOString()}`);
      }
    }

    console.log(`🕐 Completed at: ${completedAt.toISOString()}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log(`===== END PLAYWRIGHT TEST =====\n`);

    // Mark intent as completed or failed
    try {
      if (success) {
        await recoveryService.markIntentCompleted('playwright', test.id, today, executionId);
      } else {
        await recoveryService.markIntentFailed('playwright', test.id, today, new Error(errorMessage || 'Test execution failed'));
      }
    } catch (error) {
      console.error('[PlaywrightScheduler] Failed to mark intent status:', error);
    }

    return { success, error: errorMessage };
  }

  /**
   * Run a Playwright test by executing it directly in the main process
   * This matches the approach used by the replay handler and works reliably in production
   */
  private async runPlaywrightTest(testPath: string): Promise<void> {
    const fs = require('fs');
    const os = require('os');

    console.log('🎬 Running Playwright test:', testPath);

    // Validate test file exists
    if (!fs.existsSync(testPath)) {
      throw new Error(`Test file not found: ${testPath}`);
    }

    // Read the test file
    let generatedCode = fs.readFileSync(testPath, 'utf8');
    console.log('📄 Test file read, size:', generatedCode.length);

    // Extract the test body from the standalone script
    let testBody = '';

    if (generatedCode.includes('launchPersistentContext')) {
      // Standalone format with launchPersistentContext
      // Extract code between "try {" and "} finally {" using indentation-aware matching
      console.log('🔍 Detected standalone launchPersistentContext format');
      
      const lines = generatedCode.split('\n');
      
      // Find the 'finally {' line and its indentation
      let finallyIndex = -1;
      let finallyIndent = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === 'finally {' || lines[i].includes('} finally {')) {
          finallyIndex = i;
          finallyIndent = lines[i].search(/\S/); // First non-whitespace character position
          break;
        }
      }

      if (finallyIndex !== -1 && finallyIndent !== -1) {
        // Search backwards from finally to find a 'try {' with the SAME indentation
        let tryIndex = -1;
        for (let i = finallyIndex - 1; i >= 0; i--) {
          const lineIndent = lines[i].search(/\S/);
          if (lineIndent === finallyIndent && lines[i].trim() === 'try {') {
            tryIndex = i;
            console.log('✅ Found matching try block at line', i, 'with indentation', lineIndent);
            break;
          }
        }

        if (tryIndex !== -1) {
          testBody = lines.slice(tryIndex + 1, finallyIndex).join('\n').trim();
          console.log('✅ Extracted test body from try block (lines', tryIndex + 1, 'to', finallyIndex, ')');
        } else {
          console.error('❌ Could not find matching try block with same indentation as finally');
        }
      }

      if (!testBody) {
        console.error('❌ Failed to extract test body, attempting fallback');
        // Fallback: look for the pattern after page setup
        const setupEndMarker = 'page.on(\'dialog\'';
        const setupEndIndex = generatedCode.indexOf(setupEndMarker);
        if (setupEndIndex !== -1) {
          // Find the next 'try {' after setup
          const afterSetup = generatedCode.substring(setupEndIndex);
          const tryMatch = afterSetup.match(/try\s*\{([\s\S]+?)\}\s*finally\s*\{/);
          if (tryMatch && tryMatch[1]) {
            testBody = tryMatch[1].trim();
            console.log('⚠️ Extracted test body using post-setup regex fallback');
          }
        }
      }
    }

    if (!testBody) {
      console.error('❌ Failed to extract test body. File content preview:', generatedCode.substring(0, 500));
      throw new Error('Could not extract test body from file. The file format may be invalid.');
    }

    console.log('📋 Test body extracted, length:', testBody.length);
    console.log('📋 First 500 chars of testBody:', testBody.substring(0, 500));
    console.log('📋 Last 500 chars of testBody:', testBody.substring(testBody.length - 500));

    // Import playwright-core (available in the main process)
    const { chromium } = require('playwright-core');

    // Create downloads directory in system Downloads folder
    const downloadsPath = path.join(app.getPath('downloads'), 'EGDesk-Playwright');
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
    console.log('📥 Downloads will be saved to:', downloadsPath);

    // Create temporary profile directory
    let profilesDir: string;
    try {
      const userData = app.getPath('userData');
      if (!userData || userData === '/' || userData.length < 3) {
        throw new Error('Invalid userData path');
      }
      profilesDir = path.join(userData, 'chrome-profiles');
    } catch (err) {
      console.warn('⚠️ userData not available, using os.tmpdir():', err);
      profilesDir = path.join(os.tmpdir(), 'playwright-profiles');
    }

    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }
    const profileDir = fs.mkdtempSync(path.join(profilesDir, 'playwright-scheduled-'));
    console.log('📁 Using profile directory:', profileDir);

    // Launch browser with persistent context
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      channel: 'chrome',
      viewport: null,
      permissions: ['clipboard-read', 'clipboard-write'],
      acceptDownloads: true,
      downloadsPath: downloadsPath,
      args: [
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--allow-running-insecure-content',
        '--disable-features=PrivateNetworkAccessSendPreflights',
        '--disable-features=PrivateNetworkAccessRespectPreflightResults'
      ]
    });

    // Get or create page
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    try {
      console.log('🎬 Starting test execution...');

      // Create a function from the test body and execute it
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

      let testFunction;
      try {
        testFunction = new AsyncFunction('page', 'expect', 'path', 'downloadsPath', testBody);
      } catch (syntaxError: any) {
        // If there's a syntax error creating the function, provide detailed feedback
        const errorMsg = `Failed to create test function: ${syntaxError.message}`;
        console.error('❌', errorMsg);
        console.error('Test body preview (first 1000 chars):', testBody.substring(0, 1000));
        console.error('Test body preview (last 500 chars):', testBody.substring(Math.max(0, testBody.length - 500)));

        // Write the problematic test body to a temp file for inspection
        const tempDebugFile = path.join(os.tmpdir(), 'egdesk-test-debug.js');
        fs.writeFileSync(tempDebugFile, testBody);

        throw new Error(`${errorMsg}\n\nExtracted test body length: ${testBody.length} chars\nDebug file saved to: ${tempDebugFile}\n\nFirst 200 chars:\n${testBody.substring(0, 200)}\n\nLast 200 chars:\n${testBody.substring(Math.max(0, testBody.length - 200))}`);
      }

      // Simple expect implementation for basic assertions
      const expect = (value: any) => ({
        toBe: (expected: any) => {
          if (value !== expected) {
            throw new Error(`Expected ${value} to be ${expected}`);
          }
        },
        toContain: (expected: any) => {
          if (!value.includes(expected)) {
            throw new Error(`Expected ${value} to contain ${expected}`);
          }
        }
      });

      // Execute the test
      await testFunction(page, expect, path, downloadsPath);

      console.log('✅ Test execution completed successfully');

    } catch (error) {
      console.error('❌ Test execution failed:', error);
      throw error;
    } finally {
      // Clean up
      await context.close();
      console.log('🧹 Browser context closed');

      // Clean up profile directory
      try {
        fs.rmSync(profileDir, { recursive: true, force: true });
        console.log('🧹 Profile directory cleaned up');
      } catch (e) {
        console.warn('⚠️ Failed to clean up profile directory:', e);
      }
    }
  }

  // ============================================
  // Task Management
  // ============================================

  /**
   * Schedule a test by ID
   */
  public async scheduleTestById(testId: string): Promise<void> {
    const playwrightSchedulerManager = this.sqliteManager.getPlaywrightSchedulerManager();
    const test = playwrightSchedulerManager.getTest(testId);

    if (test && test.enabled) {
      await this.scheduleTest(test);
    } else if (this.scheduledJobs.has(testId)) {
      // Test disabled or deleted, remove from scheduler
      this.scheduledJobs.get(testId)?.cancel();
      this.scheduledJobs.delete(testId);
      console.log(`🗑 Removed test from scheduler: ${testId}`);
    }
  }

  /**
   * Unschedule a test
   */
  public unscheduleTest(testId: string): void {
    if (this.scheduledJobs.has(testId)) {
      this.scheduledJobs.get(testId)?.cancel();
      this.scheduledJobs.delete(testId);
      console.log(`🗑 Unscheduled test: ${testId}`);
    }
  }
}

// Export singleton instance getter
export const getPlaywrightSchedulerService = (): PlaywrightSchedulerService =>
  PlaywrightSchedulerService.getInstance();
