// ============================================================================
// NH BUSINESS BANK AUTOMATOR (법인)
// ============================================================================
// Based on workflow from output/nh-business-account.spec.js.
// Playwright reference scripts/bank-excel-download-automation/nhbank.spec.js uses in-page INI + Arduino;
// this module uses INItech virtual keyboard + AI key detection — keep one automator; use the script for selector/timing updates.

const path = require('path');
const fs = require('fs');
const os = require('os');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { NH_BUSINESS_CONFIG } = require('./config');
// Import AI keyboard analysis utilities
const { analyzeKeyboardAndType } = require('../../utils/ai-keyboard-analyzer');
const { buildBilingualKeyboardJSON, exportKeyboardJSON } = require('../../utils/bilingual-keyboard-parser');
const { getGeminiApiKey } = require('../../utils/api-keys');
const { parseTransactionExcel } = require('../../utils/transactionParser');

/**
 * NH Business Bank Automator
 * Handles certificate-based login automation for Nonghyup Business Banking
 */
class NHBusinessBankAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    // Merge options with default config
    const config = {
      ...NH_BUSINESS_CONFIG,
      headless: options.headless ?? NH_BUSINESS_CONFIG.headless,
      chromeProfile: options.chromeProfile ?? NH_BUSINESS_CONFIG.chromeProfile,
    };
    super(config);

    this.outputDir = options.outputDir || this.getSafeOutputDir('nh-business');
    this.sessionKeepAliveInterval = null;
    /** scripts/bank-excel-download-automation/nhbank.spec.js — saveAs targets */
    this.downloadDir = path.join(this.outputDir, 'nh-biz-excel');
    this.ensureOutputDirectory(this.downloadDir);
  }

  _sanitizeNhFilenamePart(s) {
    const t = String(s || 'account').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    return t.slice(0, 80);
  }

  // ============================================================================
  // VIRTUAL KEYBOARD ANALYSIS (INItech)
  // ============================================================================

  /**
   * Analyzes the INItech virtual keyboard using Gemini Vision
   * Handles both base and shifted layouts (like NH personal account)
   * @param {Object} page - Playwright page object
   * @returns {Promise<Object>} Keyboard analysis result
   */
  async analyzeINItechKeyboard(page) {
    const timestamp = this.generateTimestamp();
    this.ensureOutputDirectory(this.outputDir);

    try {
      this.log('Analyzing INItech virtual keyboard...');

      // Find the virtual keyboard element
      const keyboardSelector = '[id="ini_cert_pwd_imgTwin"]';
      const keyboardElement = page.locator(keyboardSelector);

      // Wait for keyboard to be visible
      await keyboardElement.waitFor({ state: 'visible', timeout: 5000 });

      // ====================================================================
      // STEP 1: Analyze BASE keyboard (normal layout)
      // ====================================================================

      // Get keyboard bounds
      const baseKeyboardBox = await this.getElementBox(page, keyboardSelector);
      this.log('INItech BASE keyboard bounds:', baseKeyboardBox);

      // Take BASE keyboard screenshot
      const baseScreenshotFilename = `nh-business-keyboard-base-${timestamp}.png`;
      const baseScreenshotPath = path.join(this.outputDir, baseScreenshotFilename);
      await keyboardElement.screenshot({ path: baseScreenshotPath });
      this.log('INItech BASE keyboard screenshot saved to:', baseScreenshotPath);

      // Get Gemini API key
      const geminiApiKey = getGeminiApiKey();
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY not set');
      }

      // Analyze BASE keyboard with Gemini
      this.log('Analyzing BASE keyboard with Gemini Vision...');
      const baseAnalysisResult = await analyzeKeyboardAndType(
        baseScreenshotPath,
        geminiApiKey,
        baseKeyboardBox,
        null, // Don't type yet
        null, // Don't pass page yet
        {}
      );

      if (!baseAnalysisResult.success) {
        throw new Error(`BASE keyboard analysis failed: ${baseAnalysisResult.error}`);
      }

      this.log(`BASE keyboard analysis completed, found ${baseAnalysisResult.processed} keys`);

      // ====================================================================
      // STEP 2: Find SHIFT key and capture SHIFTED keyboard
      // ====================================================================

      const shiftKey = Object.entries(baseAnalysisResult.keyboardKeys).find(([label]) => {
        const lowerLabel = label.toLowerCase();
        return lowerLabel.includes('shift') ||
               lowerLabel.includes('특수') ||
               lowerLabel.includes('⇧') ||
               lowerLabel === '↑';
      });

      let shiftedAnalysisResult = null;
      let shiftedScreenshotPath = null;

      if (!shiftKey) {
        this.warn('SHIFT key not found in BASE keyboard, continuing without shifted layout');
      } else {
        const [shiftLabel, shiftData] = shiftKey;
        this.log(`Found SHIFT key: "${shiftLabel}" at position (${shiftData.position.x}, ${shiftData.position.y})`);

        // Click SHIFT to get shifted keyboard
        this.log('Clicking SHIFT to switch to shifted keyboard...');
        await page.mouse.move(shiftData.position.x, shiftData.position.y);
        await page.waitForTimeout(this.config.delays.mouseMove || 300);
        await page.mouse.click(shiftData.position.x, shiftData.position.y);
        await page.waitForTimeout(this.config.delays.keyboardUpdate || 1000);

        // Wait for keyboard to update
        await page.waitForTimeout(500);

        // Check if keyboard element is still visible
        if (await keyboardElement.isVisible({ timeout: 3000 })) {
          // Get SHIFTED keyboard bounds
          const shiftedKeyboardBox = await this.getElementBox(page, keyboardSelector);
          this.log('INItech SHIFTED keyboard bounds:', shiftedKeyboardBox);

          // Take SHIFTED keyboard screenshot
          const shiftedScreenshotFilename = `nh-business-keyboard-shifted-${timestamp}.png`;
          shiftedScreenshotPath = path.join(this.outputDir, shiftedScreenshotFilename);
          await keyboardElement.screenshot({ path: shiftedScreenshotPath });
          this.log('INItech SHIFTED keyboard screenshot saved to:', shiftedScreenshotPath);

          // Analyze SHIFTED keyboard with Gemini
          this.log('Analyzing SHIFTED keyboard with Gemini Vision...');
          shiftedAnalysisResult = await analyzeKeyboardAndType(
            shiftedScreenshotPath,
            geminiApiKey,
            shiftedKeyboardBox,
            null,
            null,
            {}
          );

          if (shiftedAnalysisResult.success) {
            this.log(`SHIFTED keyboard analysis completed, found ${shiftedAnalysisResult.processed} keys`);
          } else {
            this.warn('SHIFTED keyboard analysis failed:', shiftedAnalysisResult.error);
          }

          // Click SHIFT again to return to BASE keyboard
          this.log('Clicking SHIFT to return to BASE keyboard...');
          await page.mouse.click(shiftData.position.x, shiftData.position.y);
          await page.waitForTimeout(this.config.delays.keyboardUpdate || 500);
        } else {
          this.warn('SHIFTED keyboard not visible after clicking shift');
        }
      }

      // ====================================================================
      // STEP 3: Build combined keyboard JSON (like NH personal account)
      // ====================================================================

      const keyboardJSON = buildBilingualKeyboardJSON(
        baseAnalysisResult.keyboardKeys,
        shiftedAnalysisResult?.keyboardKeys || null
      );

      // Export for debugging
      const jsonFilename = `nh-business-keyboard-layout-${timestamp}.json`;
      const jsonPath = path.join(this.outputDir, jsonFilename);
      exportKeyboardJSON(
        baseAnalysisResult.keyboardKeys,
        jsonPath,
        shiftedAnalysisResult?.keyboardKeys || null
      );
      this.log('Keyboard JSON exported to:', jsonPath);

      return {
        success: true,
        keyboardJSON,
        baseAnalysis: baseAnalysisResult,
        shiftedAnalysis: shiftedAnalysisResult,
        baseScreenshotPath,
        shiftedScreenshotPath
      };
    } catch (error) {
      this.error('Failed to analyze keyboard:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Types password using bilingual keyboard JSON with shift support
   * (Copied from NH personal account implementation)
   * @param {Object} page - Playwright page object
   * @param {Object} keyboardJSON - Bilingual keyboard JSON with characterMap and shiftKey
   * @param {string} password - Password to type
   * @returns {Promise<Object>}
   */
  async typePasswordWithKeyboard(page, keyboardJSON, password) {
    try {
      this.log(`Typing password with bilingual keyboard... (${password.length} characters)`);

      const results = {
        success: true,
        totalChars: password.length,
        typedChars: 0,
        failedChars: [],
        shiftClicks: 0,
        details: []
      };

      let shiftActive = false;

      for (let i = 0; i < password.length; i++) {
        const char = password[i];
        let keyInfo = keyboardJSON.characterMap[char];

        // Smart fallback: If uppercase not found, try lowercase with shift
        if (!keyInfo && char >= 'A' && char <= 'Z') {
          const lowerChar = char.toLowerCase();
          const lowerKeyInfo = keyboardJSON.characterMap[lowerChar];
          if (lowerKeyInfo) {
            this.log(`Character '${char}' not found, using lowercase '${lowerChar}' position with shift`);
            keyInfo = {
              ...lowerKeyInfo,
              requiresShift: true  // Force shift for uppercase
            };
          }
        }

        if (!keyInfo) {
          this.warn(`Character '${char}' not found in keyboard mapping`);
          results.failedChars.push({ index: i, char, reason: 'not_found' });
          results.success = false;
          continue;
        }

        const needsShift = keyInfo.requiresShift || false;

        // Handle shift state
        if (needsShift && !shiftActive) {
          if (keyboardJSON.shiftKey) {
            this.log(`Activating shift for '${char}'`);
            await page.mouse.move(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
            await page.waitForTimeout(this.config.delays.mouseMove || 100);
            await page.mouse.click(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
            await page.waitForTimeout(this.config.delays.keyboardUpdate || 200);
            shiftActive = true;
            results.shiftClicks++;
          } else {
            this.warn(`Character '${char}' requires shift but shift key not found`);
            results.failedChars.push({ index: i, char, reason: 'shift_not_found' });
            results.success = false;
            continue;
          }
        } else if (!needsShift && shiftActive) {
          if (keyboardJSON.shiftKey) {
            this.log(`Deactivating shift for '${char}'`);
            await page.mouse.move(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
            await page.waitForTimeout(this.config.delays.mouseMove || 100);
            await page.mouse.click(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
            await page.waitForTimeout(this.config.delays.keyboardUpdate || 200);
            shiftActive = false;
            results.shiftClicks++;
          }
        }

        // Click character key
        this.log(`Clicking '${char}' at (${keyInfo.position.x}, ${keyInfo.position.y})...`);
        await page.mouse.move(keyInfo.position.x, keyInfo.position.y);
        await page.waitForTimeout(this.config.delays.mouseMove || 100);
        await page.mouse.click(keyInfo.position.x, keyInfo.position.y);
        await page.waitForTimeout(this.config.delays.keyPress || 200);

        results.typedChars++;
        results.details.push({ char, position: keyInfo.position, requiresShift: needsShift, success: true });
      }

      // Deactivate shift at end if needed
      if (shiftActive && keyboardJSON.shiftKey) {
        this.log('Deactivating shift at end of password');
        await page.mouse.click(keyboardJSON.shiftKey.position.x, keyboardJSON.shiftKey.position.y);
        results.shiftClicks++;
      }

      this.log(`Password typing completed: ${results.typedChars}/${results.totalChars} characters, ${results.shiftClicks} shift clicks`);
      return results;
    } catch (error) {
      this.error(`Error typing password: ${error.message}`);
      return {
        success: false,
        totalChars: password.length,
        typedChars: 0,
        failedChars: [],
        shiftClicks: 0,
        details: [],
        error: error.message
      };
    }
  }

  // ============================================================================
  // WINDOWS KEYBOARD INPUT
  // ============================================================================

  /**
   * Checks if current platform is Windows
   * @returns {boolean}
   */
  isWindows() {
    return os.platform() === 'win32';
  }

  /**
   * Attempts to enter password using Windows keyboard input methods
   * Tries 3 methods with fallbacks: keyboard.type, clipboard paste, fill
   * @param {Object} page - Playwright page object
   * @param {string} password - Password to enter
   * @param {string} selector - Selector for password field
   * @returns {Promise<Object>} Result with success status
   */
  async handleWindowsPasswordInput(page, password, selector) {
    this.log('Attempting Windows keyboard input methods...');
    const pwLocator = page.locator(selector);

    // Method 1: Try keyboard.type (character by character)
    try {
      this.log('Method 1: Attempting keyboard.type...');
      await pwLocator.focus({ timeout: 10000 });
      await page.waitForTimeout(500);

      for (const char of password) {
        await page.keyboard.type(char, { delay: 200 });
        await page.waitForTimeout(100);
      }

      await page.waitForTimeout(500);
      const value = await pwLocator.inputValue({ timeout: 10000 });

      if (value.length === password.length) {
        this.log('✅ keyboard.type method succeeded');
        return { success: true, method: 'keyboard.type' };
      } else {
        this.warn(`keyboard.type incomplete: ${value.length}/${password.length} chars`);
      }
    } catch (e) {
      this.warn('keyboard.type failed:', e.message);
    }

    // Method 2: Try clipboard paste
    try {
      this.log('Method 2: Attempting clipboard paste...');
      await pwLocator.focus({ timeout: 10000 });
      await page.waitForTimeout(500);

      // Set clipboard
      await page.evaluate(async (pwd) => {
        await navigator.clipboard.writeText(pwd);
      }, password);

      // Paste with Ctrl+V
      await page.keyboard.press('Control+V');
      await page.waitForTimeout(500);

      const value = await pwLocator.inputValue({ timeout: 10000 });

      // Clear clipboard for security
      try {
        await page.evaluate(() => navigator.clipboard.writeText(''));
      } catch (e) {
        this.warn('Could not clear clipboard:', e.message);
      }

      if (value.length === password.length) {
        this.log('✅ Clipboard method succeeded');
        return { success: true, method: 'clipboard' };
      } else {
        this.warn(`Clipboard incomplete: ${value.length}/${password.length} chars`);
      }
    } catch (e) {
      this.warn('Clipboard method failed:', e.message);
    }

    // Method 3: Try fill method
    try {
      this.log('Method 3: Attempting fill method...');
      await pwLocator.fill(password, { timeout: 10000 });
      await page.waitForTimeout(500);

      const value = await pwLocator.inputValue({ timeout: 10000 });

      if (value.length === password.length) {
        this.log('✅ Fill method succeeded');
        return { success: true, method: 'fill' };
      } else {
        this.warn(`Fill incomplete: ${value.length}/${password.length} chars`);
      }
    } catch (e) {
      this.warn('Fill method failed:', e.message);
    }

    // All methods failed
    this.error('All Windows keyboard input methods failed');
    return {
      success: false,
      error: 'All Windows keyboard input methods failed (keyboard.type, clipboard, fill)'
    };
  }

  // ============================================================================
  // CERTIFICATE AUTHENTICATION
  // ============================================================================

  /**
   * Substrings to match user/env expiry against row text (nhbank.spec uses tr:has-text).
   * @param {string} expiry
   * @returns {string[]}
   */
  expandNhCertExpiryVariants(expiry) {
    if (!expiry || typeof expiry !== 'string') return [];
    const s = expiry.trim();
    const out = new Set([s]);
    const iso = s.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})/);
    if (iso) {
      const [, y, mo, d] = iso;
      out.add(`${y}-${mo}-${d}`);
      out.add(`${y}.${mo}.${d}`);
      out.add(`${y}/${mo}/${d}`);
      out.add(`${mo}-${d}`);
      out.add(`${mo}.${d}`);
    }
    const md = s.match(/^(\d{2})[-/.](\d{2})$/);
    if (md) {
      out.add(`${md[1]}-${md[2]}`);
      out.add(`${md[1]}.${md[2]}`);
    }
    return [...out];
  }

  /**
   * Selector for NH INIpay cert list: tr.data inside #certificate_signature_area (selected = .active).
   */
  getNhCertificateDataRowSelector() {
    return this.config.xpaths.certificateDataRow || '#certificate_signature_area tr.data';
  }

  /**
   * Poll until tr.data appears (NH shows cert rows in #certificate_signature_area).
   * @param {import('playwright-core').Page} page
   * @param {number} [maxSeconds=15]
   * @returns {Promise<boolean>}
   */
  async waitForNhCertificateTable(page, maxSeconds = 15) {
    for (let i = 0; i < maxSeconds; i++) {
      const found = await page.evaluate(() => {
        return (
          document.querySelectorAll('#certificate_signature_area tr.data').length > 0 ||
          document.querySelectorAll('tr.data').length > 0
        );
      });
      if (found) {
        this.log(`Cert table appeared after ${i + 1}s.`);
        return true;
      }
      await page.waitForTimeout(1000);
    }
    this.warn('Cert table (tr.data) did not appear within ' + maxSeconds + 's.');
    return false;
  }

  /**
   * Read certificate rows from DOM (same as nhbank flow: tr.data, expiry from YYYY-MM-DD in cells).
   * @returns {Promise<Array<{ index: number, active: boolean, expiry: string, text: string, cells: string[] }>>}
   */
  async readNhCertificateListRaw(page) {
    return page.evaluate(() => {
      let rows = document.querySelectorAll('#certificate_signature_area tr.data');
      if (rows.length === 0) rows = document.querySelectorAll('tr.data');
      return Array.from(rows).map((row, i) => {
        const cells = Array.from(row.querySelectorAll('td'));
        const cellTexts = cells.map((c) => (c.textContent || '').trim());
        const joined = cellTexts.join(' ');
        let expiry = '';
        const iso = joined.match(/(\d{4}-\d{2}-\d{2})/);
        const dotted = joined.match(/(\d{4})[./](\d{2})[./](\d{2})/);
        if (iso) expiry = iso[1];
        else if (dotted) expiry = `${dotted[1]}-${dotted[2]}-${dotted[3]}`;
        return {
          index: i,
          active: row.classList.contains('active'),
          expiry,
          text: cellTexts.join(' | '),
          cells: cellTexts,
        };
      });
    });
  }

  /**
   * Maps raw list to fields used by resolveCertificateRowIndex / UI.
   * @param {Array} raw
   */
  normalizeNhCertificateRows(raw) {
    return raw.map((c) => {
      const cells = c.cells || [];
      const entry = {
        index: c.index,
        expiry: c.expiry,
        active: c.active,
        text: c.text,
        cells,
        display: c.text,
        fullText: c.text,
        matchedDate: c.expiry,
        만료일: c.expiry || '',
        isActive: c.active,
      };
      if (cells.length >= 4) {
        entry.소유자명 = cells[0];
        entry.용도 = cells[1];
        entry.발급기관 = cells[2];
        entry.만료일 = cells[3] || c.expiry || '';
      }
      return entry;
    });
  }

  /**
   * Click tr.data by index (prefer #certificate_signature_area), matching in-page behavior.
   * @param {import('playwright-core').Page} page
   * @param {number} idx — 0-based index in tr.data list
   */
  async clickNhCertificateRowByIndex(page, idx) {
    await page.evaluate((index) => {
      let rows = document.querySelectorAll('#certificate_signature_area tr.data');
      if (rows.length === 0) rows = document.querySelectorAll('tr.data');
      if (rows[index]) rows[index].click();
    }, idx);
  }

  /**
   * @param {import('playwright-core').Page} page
   * @returns {Promise<Array>} normalized rows for logging / selection
   */
  async scrapeIniCertificateRows(page) {
    const raw = await this.readNhCertificateListRaw(page);
    return this.normalizeNhCertificateRows(raw);
  }

  /**
   * When multiple certs and no explicit index/expiry match, pick the latest expiry (YYYY-MM-DD string compare).
   * @param {Array<{ expiry?: string, matchedDate?: string }>} certificates
   * @returns {number} 0-based index
   */
  pickLatestExpiryIndex(certificates) {
    if (!certificates.length) return 0;
    let targetIndex = 0;
    let latestExpiry = '';
    for (let i = 0; i < certificates.length; i++) {
      const cert = certificates[i];
      const e = cert.expiry || cert.matchedDate || cert.만료일 || '';
      if (e && e > latestExpiry) {
        latestExpiry = e;
        targetIndex = i;
      }
    }
    if (!latestExpiry) return 0;
    this.log(`Defaulting to latest expiry: ${latestExpiry} (option [${targetIndex + 1}]).`);
    return targetIndex;
  }

  /**
   * Picks a cert row index (0-based) from credentials / env, logs options like Hometax.
   * Priority: certificateIndex (1-based) or NH_BUSINESS_CERT_INDEX → certificateExpiry / NH_BUSINESS_CERT_EXPIRY / CERT_EXPIRY substring → 0.
   * @param {Array} certificates - from scrapeIniCertificateRows
   * @param {Object} credentials
   * @returns {number} 0-based index
   */
  resolveCertificateRowIndex(certificates, credentials = {}) {
    const n = certificates.length;
    if (n === 0) return 0;

    const envIndex = process.env.NH_BUSINESS_CERT_INDEX;
    const raw =
      credentials.certificateIndex != null
        ? Number(credentials.certificateIndex)
        : envIndex != null && String(envIndex).trim() !== ''
          ? parseInt(String(envIndex).trim(), 10)
          : NaN;

    if (!Number.isNaN(raw) && raw >= 1 && raw <= n) {
      this.log(`Using certificate at option [${raw}] (certificateIndex / NH_BUSINESS_CERT_INDEX).`);
      return raw - 1;
    }
    if (!Number.isNaN(raw)) {
      this.warn(`certificateIndex ${raw} out of range (1–${n}); using first certificate.`);
      return 0;
    }

    const expiry =
      credentials.certificateExpiry ||
      process.env.NH_BUSINESS_CERT_EXPIRY ||
      process.env.CERT_EXPIRY ||
      '';
    if (expiry) {
      const variants = this.expandNhCertExpiryVariants(expiry);
      const found = certificates.findIndex((c) =>
        variants.some(
          (v) =>
            (v && c.expiry && c.expiry.includes(v)) ||
            (v && c.fullText && c.fullText.includes(v)) ||
            (v && c.text && c.text.includes(v)) ||
            (v && c.display && c.display.includes(v)) ||
            (v && c.matchedDate && c.matchedDate.includes(v)) ||
            (v && c.만료일 && c.만료일.includes(v)) ||
            (c.cells || []).some((cell) => v && cell && cell.includes(v))
        )
      );
      if (found >= 0) {
        this.log(`Using certificate row matching expiry "${expiry}" (option [${found + 1}]).`);
        return found;
      }
      this.warn(`No row contains "${expiry}" (tried ${variants.length} variants); falling back to latest expiry.`);
    }

    return this.pickLatestExpiryIndex(certificates);
  }

  /**
   * Handles certificate selection and password entry
   * @param {Object} page - Playwright page object
   * @param {Object} credentials - { certificatePassword, certificateIndex?, certificateExpiry? }
   * @returns {Promise<Object>}
   */
  async handleCertificateLogin(page, credentials) {
    const certificatePassword = credentials.certificatePassword;
    try {
      this.log('Starting certificate authentication...');

      // Step 1: Handle initial confirmation popup
      try {
        this.log('Waiting for confirmation popup...');
        await page.waitForTimeout(this.config.delays.humanLike);

        const confirmButton = page.locator(this.config.xpaths.confirmPopupButton);
        if (await confirmButton.isVisible({ timeout: 3000 })) {
          this.log('Clicking confirmation button...');
          await confirmButton.click();
          await page.waitForTimeout(this.config.delays.humanLike);
        }
      } catch (e) {
        this.log('No confirmation popup found, continuing...');
      }

      // Step 2: Open certificate list (click 공동인증서 로그인 button)
      this.log('Opening certificate list (clicking 공동인증서 로그인)...');
      const certButton = this.config.xpaths.certificateListButton.startsWith('/')
        ? page.locator(`xpath=${this.config.xpaths.certificateListButton}`)
        : page.locator(this.config.xpaths.certificateListButton);
      await certButton.click();
      await page.waitForTimeout(3000); // nhbank.spec.js: wait for INIpay cert layer

      // Step 3: Wait for tr.data (poll up to 15s), read list, select (latest expiry if unset)
      await this.waitForNhCertificateTable(page, 15);
      await page.waitForTimeout(500);

      let certificates = await this.scrapeIniCertificateRows(page);
      if (certificates.length === 0) {
        this.warn('No tr.data rows — trying legacy click fallbacks.');
        const dataRowSel = this.getNhCertificateDataRowSelector();
        try {
          await page.locator(dataRowSel).first().click({ timeout: 3000 });
        } catch (e) {
          try {
            await page.locator('div.cert-list table tbody tr').first().click({ timeout: 5000 });
          } catch (e2) {
            await page.locator('table tbody tr').first().click({ timeout: 10000 });
          }
        }
      } else {
        this.log(`Found ${certificates.length} certificate(s):`);
        certificates.forEach((c, i) => {
          const mark = c.isActive ? '✓ ACTIVE' : '  ';
          const exp = c.expiry || c.matchedDate || '';
          this.log(`  [${c.index}] ${mark} expiry=${exp} | ${c.display || c.text}`);
        });
        const selectedIdx = this.resolveCertificateRowIndex(certificates, credentials);
        this.log(`Selecting certificate at index ${selectedIdx}...`);
        await this.clickNhCertificateRowByIndex(page, selectedIdx);
      }
      await page.waitForTimeout(500);

      // Step 4: Click certificate password input field
      this.log('Clicking certificate password field...');
      await page.locator(this.config.xpaths.certPasswordInput).click();
      await page.waitForTimeout(1818);

      let passwordEntered = false;
      let inputMethod = null;

      // Step 5: Try Windows keyboard input methods if on Windows
      if (this.isWindows() && this.config.useWindowsKeyboard) {
        this.log('🖥️  Windows detected - attempting direct keyboard input...');
        const windowsResult = await this.handleWindowsPasswordInput(
          page,
          certificatePassword,
          this.config.xpaths.certPasswordInput
        );

        if (windowsResult.success) {
          this.log(`✅ Windows input succeeded using: ${windowsResult.method}`);
          passwordEntered = true;
          inputMethod = windowsResult.method;
          await page.waitForTimeout(1000);
        } else {
          this.warn('⚠️  Windows input methods failed, falling back to virtual keyboard...');
        }
      }

      // Step 6: Fallback to virtual keyboard if Windows methods failed or not on Windows
      if (!passwordEntered) {
        // Open virtual keyboard
        this.log('Opening virtual keyboard...');
        await page.locator(this.config.xpaths.certPasswordKeyboardButton).click();
        await page.waitForTimeout(1169);

        // Analyze virtual keyboard with Gemini
        this.log('Analyzing INItech virtual keyboard...');
        const keyboardAnalysis = await this.analyzeINItechKeyboard(page);

        if (!keyboardAnalysis.success) {
          throw new Error(`Keyboard analysis failed: ${keyboardAnalysis.error}`);
        }

        // Type password using analyzed keyboard coordinates (with shift support)
        this.log(`Typing certificate password (${certificatePassword.length} characters)...`);
        const typingResult = await this.typePasswordWithKeyboard(
          page,
          keyboardAnalysis.keyboardJSON, // Use bilingual keyboard JSON with characterMap
          certificatePassword
        );

        if (!typingResult.success) {
          this.warn(`Password typing had errors: ${JSON.stringify(typingResult.failedChars)}`);
          throw new Error(`Failed to type password. Failed characters: ${typingResult.failedChars.length}`);
        }

        this.log(`Successfully typed all ${typingResult.typedChars} characters`);
        await page.waitForTimeout(1895);

        // Close virtual keyboard by clicking the h2 header
        this.log('Closing virtual keyboard (clicking h2 header)...');
        const closeKeyboardSelector = this.config.xpaths.certPasswordCloseKeyboard.startsWith('/')
          ? page.locator(`xpath=${this.config.xpaths.certPasswordCloseKeyboard}`)
          : page.locator(this.config.xpaths.certPasswordCloseKeyboard);
        await closeKeyboardSelector.click();
        await page.waitForTimeout(1357);

        inputMethod = 'virtual_keyboard';
      }

      // Step 7: Submit certificate
      this.log('Submitting certificate...');
      await page.locator(this.config.xpaths.certSubmitButton).click();
      await page.waitForTimeout(this.config.delays.humanLike);

      return {
        success: true,
        inputMethod: inputMethod,
        platform: os.platform()
      };
    } catch (error) {
      this.error('Certificate login failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // POST-LOGIN NAVIGATION
  // ============================================================================

  /**
   * Navigates to transaction history page after login
   * @param {Object} page - Playwright page object
   * @returns {Promise<boolean>}
   */
  async navigateToTransactionHistory(page) {
    try {
      // Close post-login area by clicking first 조회 button
      this.log('Closing post-login area (clicking first 조회 button)...');
      await page.locator(this.config.xpaths.closeModalButton).first().click();
      await page.waitForTimeout(2268);

      // Navigate to transaction history
      this.log('Navigating to transaction history...');
      await page.locator(this.config.xpaths.transactionMenuLink).click();
      await page.waitForTimeout(this.config.delays.humanLike);

      this.log('Successfully navigated to transaction history page');

      return true;
    } catch (error) {
      this.error('Failed to navigate to transaction history:', error.message);
      return false;
    }
  }

  // ============================================================================
  // DATE RANGE SELECTION
  // ============================================================================

  /**
   * Sets date range for transaction query
   * @param {Object} page - Playwright page object
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<boolean>}
   */
  async setDateRange(page, startDate, endDate) {
    try {
      this.log(`Setting date range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

      // Set start date
      const startYear = startDate.getFullYear().toString();
      const startMonth = (startDate.getMonth() + 1).toString();
      const startDay = startDate.getDate().toString();

      await page.selectOption(this.config.xpaths.startYearSelect, startYear);
      await page.waitForTimeout(1200);
      await page.selectOption(this.config.xpaths.startMonthSelect, startMonth);
      await page.waitForTimeout(800);
      await page.selectOption(this.config.xpaths.startDateSelect, startDay);
      await page.waitForTimeout(this.config.delays.humanLike);

      // Set end date
      const endYear = endDate.getFullYear().toString();
      const endMonth = (endDate.getMonth() + 1).toString();
      const endDay = endDate.getDate().toString();

      await page.selectOption(this.config.xpaths.endYearSelect, endYear);
      await page.waitForTimeout(1200);
      await page.selectOption(this.config.xpaths.endMonthSelect, endMonth);
      await page.waitForTimeout(800);
      await page.selectOption(this.config.xpaths.endDateSelect, endDay);
      await page.waitForTimeout(2235);

      return true;
    } catch (error) {
      this.error('Failed to set date range:', error.message);
      return false;
    }
  }

  /**
   * Calculates date range (e.g., 30 days ago to today)
   * @param {number} daysAgo - Number of days ago from today
   * @returns {Object} { startDate, endDate }
   */
  getDateRange(daysAgo = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    return { startDate, endDate };
  }

  // ============================================================================
  // TRANSACTION QUERY
  // ============================================================================

  /**
   * Executes transaction query and handles pagination
   * @param {Object} page - Playwright page object
   * @param {number} maxPages - Maximum number of pages to load (default 5)
   * @returns {Promise<boolean>}
   */
  async queryTransactions(page, maxPages = 5) {
    try {
      // Execute search
      this.log('Executing transaction search...');
      await page.locator(this.config.xpaths.searchButton).click();
      await page.waitForTimeout(this.config.delays.humanLike);

      // Some UI interactions from spec (exploring the interface)
      await page.locator(this.config.xpaths.startMonthSelect).click();
      await page.waitForTimeout(2687);
      await page.locator(this.config.xpaths.startMonthSelect).click();
      await page.waitForTimeout(2098);

      // Re-query
      await page.locator(this.config.xpaths.searchButton).click();
      await page.waitForTimeout(this.config.delays.humanLike);

      // Handle pagination - load additional transaction pages
      this.log(`Loading up to ${maxPages} pages of transactions...`);
      for (let i = 0; i < maxPages; i++) {
        try {
          const nextButton = page.locator(this.config.xpaths.nextRecordsButton);
          if (await nextButton.isVisible({ timeout: 2000 })) {
            this.log(`Loading page ${i + 2}...`);
            await nextButton.click();
            await page.waitForTimeout(i < 3 ? this.config.delays.humanLike : 1144);
          } else {
            this.log('No more pages to load');
            break;
          }
        } catch (e) {
          this.log(`Pagination ended at page ${i + 1}`);
          break;
        }
      }

      this.log('Transaction query completed');
      return true;
    } catch (error) {
      this.error('Failed to query transactions:', error.message);
      return false;
    }
  }

  // ============================================================================
  // FETCH CERTIFICATES (UI — same table as login, Hometax-style list)
  // ============================================================================

  /**
   * Opens NH 법인 로그인, shows INIpay cert table, returns rows without entering password.
   * Caller should close browser via cleanup(false) when used for one-shot IPC.
   * @param {string} [proxyUrl]
   * @returns {Promise<{ success: boolean, certificates?: Array, error?: string }>}
   */
  async fetchCertificates(proxyUrl) {
    const proxy = this.buildProxyOption(proxyUrl);
    try {
      this.log('NH Business: fetching certificate list for UI...');
      const nhDownloadsPath = path.join(this.outputDir, 'nh-business-downloads');
      this.ensureOutputDirectory(nhDownloadsPath);
      const { browser, context } = await this.createBrowser(proxy, {
        useKbScriptPlaywrightProfile: true,
        extraChromeArgs: [
          '--start-maximized',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
        ],
        viewport: null,
        acceptDownloads: true,
        downloadsPath: nhDownloadsPath,
      });
      this.browser = browser;
      this.context = context;
      const page = context.pages()[0] || (await context.newPage());
      this.page = page;
      page.on('dialog', async (dialog) => {
        try {
          await dialog.accept();
        } catch (e) {
          /* ignore */
        }
      });

      await page.goto(this.config.targetUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(this.config.delays.humanLike);

      try {
        const confirmButton = page.locator(this.config.xpaths.confirmPopupButton);
        if (await confirmButton.isVisible({ timeout: 3000 })) {
          await confirmButton.click();
          await page.waitForTimeout(this.config.delays.humanLike);
        }
      } catch (e) {
        this.log('No confirmation popup, continuing...');
      }

      const certButton = this.config.xpaths.certificateListButton.startsWith('/')
        ? page.locator(`xpath=${this.config.xpaths.certificateListButton}`)
        : page.locator(this.config.xpaths.certificateListButton);
      await certButton.click();
      await page.waitForTimeout(3000);

      await this.waitForNhCertificateTable(page, 15);
      await page.waitForTimeout(500);

      const rows = await this.scrapeIniCertificateRows(page);
      const certificates = rows.map((c, i) => ({
        ...c,
        certificateIndex: i + 1,
      }));

      if (certificates.length === 0) {
        return {
          success: false,
          error: '인증서 목록을 찾을 수 없습니다. 페이지 구조가 바뀌었을 수 있습니다.',
        };
      }

      return { success: true, certificates };
    } catch (error) {
      this.error('fetchCertificates failed:', error.message);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ============================================================================
  // MAIN LOGIN METHOD
  // ============================================================================

  /**
   * Main login automation method for NH Business Bank
   * @param {Object} credentials - { certificatePassword, certificateIndex?, certificateExpiry? }
   * @param {string} [proxyUrl] - Optional proxy URL
   * @returns {Promise<Object>} Automation result
   */
  async login(credentials, proxyUrl) {
    const proxy = this.buildProxyOption(proxyUrl);

    try {
      // Step 1: Browser — match scripts/bank-excel-download-automation/nhbank.spec.js (temp profile, args, no route interception)
      this.log('Starting NH Business Bank automation...');
      const nhDownloadsPath = path.join(this.outputDir, 'nh-business-downloads');
      this.ensureOutputDirectory(nhDownloadsPath);
      const { browser, context } = await this.createBrowser(proxy, {
        useKbScriptPlaywrightProfile: true,
        extraChromeArgs: [
          '--start-maximized',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
        ],
        viewport: null,
        acceptDownloads: true,
        downloadsPath: nhDownloadsPath,
      });
      this.browser = browser;
      this.context = context;
      this.page = context.pages()[0] || (await context.newPage());
      this.page.on('dialog', async (dialog) => {
        try {
          await dialog.accept();
        } catch (e) {
          /* ignore */
        }
      });

      // Step 2: Navigate to login page
      this.log('Navigating to NH Business Bank login page...');
      await this.page.goto(this.config.targetUrl, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(this.config.delays.humanLike);

      // Step 3: Handle certificate login
      const certResult = await this.handleCertificateLogin(this.page, credentials);

      if (!certResult.success) {
        return {
          success: false,
          error: 'Certificate authentication failed',
          details: certResult.error,
        };
      }

      // Step 4: Navigate to transaction history page
      this.log('Navigating to transaction history page...');
      const navResult = await this.navigateToTransactionHistory(this.page);

      if (!navResult) {
        return {
          success: false,
          error: 'Failed to navigate to transaction history',
        };
      }

      // Step 5: Parse accounts from dropdown
      this.log('Parsing accounts from dropdown...');
      const accounts = await this.getAccounts();

      this.log('NH Business Bank login completed successfully!');

      return {
        success: true,
        isLoggedIn: true,
        userName: 'NH 법인사용자',
        accounts: accounts,
      };

    } catch (error) {
      this.error('Login automation failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // ACCOUNT & TRANSACTION INQUIRY (Placeholders)
  // ============================================================================

  /**
   * Gets all accounts from the account dropdown on transaction history page
   * @returns {Promise<Array>} Array of account information
   */
  async getAccounts() {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log('Parsing accounts from dropdown...');

      // Extract accounts from the select dropdown
      const accounts = await this.page.evaluate((xpathSelector) => {
        const result = document.evaluate(
          xpathSelector,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );

        const selectElement = result.singleNodeValue;

        if (!selectElement) {
          console.log('Account dropdown not found');
          return [];
        }

        const options = selectElement.querySelectorAll('option');
        const accountList = [];

        options.forEach((option, index) => {
          const value = option.value;
          const text = option.textContent.trim();

          // Skip the first placeholder option ("선택해 주세요.")
          if (!value || value === '' || text === '선택해 주세요.') {
            return;
          }

          accountList.push({
            accountNumber: text,                    // Formatted: "301-0281-7549-41"
            accountNumberRaw: value,                // Raw: "3010281754941"
            accountName: 'NH 법인계좌',
            bankId: 'nh-business',
            balance: 0,                             // Balance not available in dropdown
            currency: 'KRW',
            lastUpdated: new Date().toISOString()
          });
        });

        return accountList;
      }, this.config.xpaths.accountDropdown);

      this.log(`Found ${accounts.length} accounts in dropdown`);

      return accounts;

    } catch (error) {
      this.error('Failed to get accounts:', error.message);
      throw error;
    }
  }

  /**
   * Gets transactions for a specific account
   * @param {string} accountNumber - Account number
   * @param {string} startDate - Start date (YYYYMMDD)
   * @param {string} endDate - End date (YYYYMMDD)
   * @returns {Promise<Object>} Transaction data with metadata
   */
  async getTransactions(accountNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');
    this.ensureOutputDirectory(this.downloadDir);
    this.log(`Fetching transactions for account ${accountNumber} (${startDate} ~ ${endDate})...`);

    try {
      await this.selectAccount(accountNumber);

      try {
        await this.page.locator('a:has-text("3개월")').first().click({ timeout: 5000 });
      } catch (e) {
        this.warn('NH biz: 3개월 shortcut not found');
      }
      await this.page.waitForTimeout(800);

      await this.page.locator('a.ibz-btn.size-lg.fill:text-is("조회")').first().click({ timeout: 5000 });
      await this.page.waitForTimeout(3000);

      const dateError = await this.page.evaluate(() => {
        const body = document.body.textContent || '';
        return (
          body.includes('계좌 개설일보다 과거를 선택할 수 없습니다') || body.includes('조회시작일이 계좌개설일')
        );
      });
      if (dateError) {
        this.log('NH biz: date error — retrying with 1개월');
        try {
          await this.page.locator('button:has-text("확인")').first().click({ timeout: 3000 });
        } catch (e) {}
        await this.page.waitForTimeout(800);
        try {
          await this.page.locator('a:has-text("1개월")').first().click({ timeout: 5000 });
        } catch (e) {}
        await this.page.waitForTimeout(400);
        await this.page.locator('a.ibz-btn.size-lg.fill:text-is("조회")').first().click({ timeout: 5000 });
        await this.page.waitForTimeout(3000);
      }

      await this.focusPlaywrightPage();
      const exportStartedAt = Date.now();
      const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });
      try {
        await this.page.locator('a:has-text("엑셀저장")').first().click({ timeout: 5000 });
      } catch (e) {
        try {
          await this.page.locator('.ibz-btn:has-text("엑셀저장")').first().click({ timeout: 5000 });
        } catch (e2) {
          await this.page.locator('button:has-text("엑셀저장")').first().click({ timeout: 5000 });
        }
      }

      const raced = await Promise.race([
        downloadPromise.then((dl) => ({ type: 'download', data: dl })),
        this.page.waitForTimeout(5000).then(() => ({ type: 'timeout' })),
      ]);

      let download = null;
      let fallbackFile = null;
      let suggested = 'nh-export.xls';

      if (raced.type === 'timeout') {
        const noDataMsg = await this.page.evaluate(() => {
          const body = document.body.textContent || '';
          return (
            body.includes('저장할 데이터가 없습니다') ||
            body.includes('조회결과가 없습니다') ||
            body.includes('거래내역이 없습니다')
          );
        });
        if (noDataMsg) {
          this.log('NH biz: no data to export');
          try {
            await this.page.locator('button:has-text("확인"), a:has-text("확인")').first().click({ timeout: 3000 });
          } catch (e) {}
          return [];
        } else {
          this.warn('NH biz: Excel download timed out via event, checking filesystem...');
          fallbackFile = this.findRecentDownloadFile(
            [this.downloadDir, path.join(this.outputDir, 'corporate-cert-downloads')],
            exportStartedAt
          );
          if (!fallbackFile) {
            this.warn('NH biz: Fallback scan also found nothing.');
            return [];
          }
          suggested = path.basename(fallbackFile.path);
        }
      } else {
        download = raced.data;
        suggested = download.suggestedFilename() || suggested;
      }

      const ext = path.extname(suggested) || '.xls';
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safeAcc = this._sanitizeNhFilenamePart(accountNumber);
      const finalName = `NH법인_${safeAcc}_${ts}${ext}`;
      const finalPath = path.join(this.downloadDir, finalName);

      const saved = await this.saveDownloadSafely(download, fallbackFile?.path, finalPath);
      if (!saved) {
        throw new Error('Failed to save NH export file via all methods');
      }

      let extractedData;
      try {
        const parsed = parseTransactionExcel(finalPath, this);
        extractedData = {
          metadata: {
            bankName: 'NH농협은행 법인',
            accountNumber,
            sourceFile: finalName,
            channel: 'biz',
          },
          summary: {
            totalCount: parsed.transactions?.length ?? 0,
            ...(parsed.summary || {}),
          },
          transactions: parsed.transactions || [],
          headers: [],
        };
      } catch (parseErr) {
        this.warn('NH biz Excel parse failed:', parseErr.message);
        extractedData = {
          metadata: {
            bankName: 'NH농협은행 법인',
            accountNumber,
            sourceFile: finalName,
            channel: 'biz',
            parseError: parseErr.message,
          },
          summary: { totalCount: 0 },
          transactions: [],
          headers: [],
        };
      }

      return [
        {
          status: 'downloaded',
          filename: finalName,
          path: finalPath,
          extractedData,
        },
      ];
    } catch (error) {
      this.error('Error fetching transactions:', error.message);
      return [];
    }
  }

  /**
   * @returns {Promise<Object>}
   */
  async getTransactionsWithParsing(accountNumber, startDate, endDate) {
    const downloadResult = await this.getTransactions(accountNumber, startDate, endDate);
    if (!downloadResult || downloadResult.length === 0) {
      return {
        success: false,
        error: 'Failed to fetch transaction data - no result returned',
        downloadResult,
      };
    }
    const resultItem = downloadResult[0];
    if (resultItem.status !== 'downloaded') {
      return {
        success: false,
        error: 'Data extraction failed',
        downloadResult,
      };
    }
    const extractedData = resultItem.extractedData;
    return {
      success: true,
      file: resultItem.path,
      filename: resultItem.filename,
      metadata: extractedData.metadata,
      summary: extractedData.summary,
      transactions: extractedData.transactions,
      headers: extractedData.headers,
    };
  }

  /**
   * Selects account from dropdown
   * @param {string} accountNumber - Account number (formatted or raw)
   */
  async selectAccount(accountNumber) {
    try {
      this.log(`Selecting account: ${accountNumber}`);

      const dropdown = this.page.locator(`xpath=${this.config.xpaths.accountDropdown}`);

      // Try to select by visible text (formatted account number)
      try {
        await dropdown.selectOption({ label: accountNumber });
        this.log('Selected account by formatted number');
      } catch (e) {
        // Try selecting by value (raw account number without dashes)
        const rawAccountNumber = accountNumber.replace(/-/g, '');
        await dropdown.selectOption({ value: rawAccountNumber });
        this.log('Selected account by raw number');
      }

      await this.page.waitForTimeout(1000);
    } catch (error) {
      this.error('Failed to select account:', error.message);
      throw error;
    }
  }

  /**
   * Loads all transaction pages by clicking "다음내역" button
   */
  async loadAllTransactionPages() {
    let pageCount = 1;
    const maxPages = 10; // Safety limit

    while (pageCount < maxPages) {
      try {
        const nextButton = this.page.locator(this.config.xpaths.nextRecordsButton);

        // Check if button exists and is enabled
        if (await nextButton.isVisible({ timeout: 2000 })) {
          this.log(`Loading page ${pageCount + 1}...`);
          await nextButton.click();
          await this.page.waitForTimeout(this.config.delays.humanLike);
          pageCount++;
        } else {
          this.log('No more pages to load');
          break;
        }
      } catch (e) {
        this.log(`Pagination ended at page ${pageCount}`);
        break;
      }
    }

    if (pageCount > 1) {
      this.log(`Loaded ${pageCount} pages of transactions`);
    }
  }

  /**
   * Extracts transaction data from the page
   * @returns {Promise<Object>} Extracted transaction data with metadata
   */
  async extractTransactionData() {
    this.log('Extracting transaction data...');

    const extractedData = await this.page.evaluate(() => {
      const data = {
        metadata: {
          accountName: '',
          accountNumber: '',
          accountOwner: '',
          accountType: '',
          balance: 0,
          bankName: 'NH농협은행 법인',
        },
        summary: {
          totalCount: 0,
          queryDate: '',
        },
        transactions: [],
      };

      // Extract summary info from tb1
      const summaryTable = document.querySelector('#tb1');
      if (summaryTable) {
        const rows = summaryTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const th = row.querySelector('th')?.textContent.trim();
          const td = row.querySelector('td')?.textContent.trim();

          if (th && td) {
            if (th === '예금주명') data.metadata.accountOwner = td;
            if (th === '예금종류') data.metadata.accountType = td;
            if (th === '현재통장잔액') {
              const balanceSpan = row.querySelector('#totAmt');
              if (balanceSpan) {
                data.metadata.balance = parseInt(balanceSpan.textContent.replace(/[^0-9]/g, '')) || 0;
              }
            }
          }
        });
      }

      // Extract total count
      const totalCountEl = document.querySelector('#totalCnt');
      if (totalCountEl) {
        data.summary.totalCount = parseInt(totalCountEl.textContent.trim()) || 0;
      }

      // Extract current time
      const timeEl = document.querySelector('.text-time');
      if (timeEl) {
        data.summary.queryDate = timeEl.textContent.replace('현재시간 : ', '').trim();
      }

      // Extract transactions from tb3
      const transactionTable = document.querySelector('#tb3');
      if (transactionTable) {
        const rows = transactionTable.querySelectorAll('tbody tr');

        rows.forEach(row => {
          const cells = row.querySelectorAll('td');

          if (cells.length >= 8) {
            // Skip checkbox cell (index 0)

            // Get date and time
            const dateTimeText = cells[1]?.textContent.trim() || '';
            const dateTimeParts = dateTimeText.split(/\s+/);
            const date = dateTimeParts[0] || ''; // "2026/01/16"
            const time = dateTimeParts[1] || ''; // "19:36:11"

            // Get withdrawal amount
            const withdrawalDiv = cells[2]?.querySelector('.text-price');
            const withdrawalText = withdrawalDiv?.textContent.trim() || '0';
            const withdrawal = parseInt(withdrawalText.replace(/[^0-9]/g, '')) || 0;

            // Get deposit amount
            const depositDiv = cells[3]?.querySelector('.text-price');
            const depositText = depositDiv?.textContent.trim() || '0';
            const deposit = parseInt(depositText.replace(/[^0-9]/g, '')) || 0;

            // Get balance
            const balanceDiv = cells[4]?.querySelector('.text-price');
            const balanceText = balanceDiv?.textContent.trim() || '0';
            const balance = parseInt(balanceText.replace(/[^0-9]/g, '')) || 0;

            // Get transaction type (거래내용)
            const type = cells[5]?.textContent.trim() || '';

            // Get description (거래기록사항)
            const description = cells[6]?.textContent.trim() || '';

            // Get branch (거래점)
            const branch = cells[7]?.textContent.trim().replace(/\s+/g, ' ') || '';

            // Get memo (이체메모) - last column
            const memo = cells[8]?.textContent.trim() || '';

            // Combine date and time into transaction_datetime format: YYYY/MM/DD HH:MM:SS
            const transactionDatetime = (date && time) ? date + ' ' + time : date;

            const transaction = {
              date: date.replace(/\//g, '-'), // Convert to YYYY-MM-DD
              time: time,
              transaction_datetime: transactionDatetime,
              type: type,
              withdrawal: withdrawal,
              deposit: deposit,
              balance: balance,
              description: description,
              branch: branch,
              memo: memo
            };

            // Only add if there's actual transaction data
            if (date && (withdrawal > 0 || deposit > 0)) {
              data.transactions.push(transaction);
            }
          }
        });
      }

      return data;
    });

    this.log(`Extracted ${extractedData.transactions.length} transactions`);
    this.log(`Account: ${extractedData.metadata.accountOwner} - ${extractedData.metadata.accountType}`);
    this.log(`Balance: ${extractedData.metadata.balance}`);

    return {
      success: true,
      metadata: extractedData.metadata,
      summary: extractedData.summary,
      transactions: extractedData.transactions,
    };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * @param {boolean} [keepOpen=true] - Pass false to close the browser (e.g. after fetchCertificates IPC).
   * Must forward `keepOpen` to super — calling super.cleanup() with no args defaulted to keepOpen=true.
   */
  async cleanup(keepOpen = true) {
    await super.cleanup(keepOpen);
  }
}

// Factory function
function createNHBusinessAutomator(options = {}) {
  return new NHBusinessBankAutomator(options);
}

module.exports = {
  NHBusinessBankAutomator,
  createNHBusinessAutomator,
};
