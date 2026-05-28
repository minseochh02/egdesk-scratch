const fs = require('fs');
const path = require('path');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { parseTransactionExcel } = require('../../utils/transactionParser');
const { ArduinoHidBankSession } = require('../../utils/arduino-hid-bank');
const { WOORI_CONFIG } = require('./config');
const { accountDisplayNameFromOptionText } = require('../../utils/accountOptionLabel');

/**
 * Woori 기업: INI cert UI is in-page (xwup_*). Arduino for TAB/password; Playwright for 확인 / navigation.
 */
class WooriBankAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    const config = {
      ...WOORI_CONFIG,
      headless: options.headless ?? WOORI_CONFIG.headless,
      chromeProfile: options.chromeProfile ?? WOORI_CONFIG.chromeProfile,
    };
    super(config);
    this.outputDir = options.outputDir || this.getSafeOutputDir('woori');
    this.downloadDir = path.join(this.outputDir, 'woori-biz-downloads');
    this.ensureOutputDirectory(this.downloadDir);
    this.arduinoPort = options.arduinoPort || null;
    this.arduinoBaudRate = options.arduinoBaudRate || 9600;
    this._arduinoHid = null;
    this._wooriCorporateCertPhase = 'idle';
    this._wooriCertAttempt = 0;
  }

  async _disconnectArduinoHid() {
    if (this._arduinoHid) {
      try {
        await this._arduinoHid.disconnect();
      } catch (e) {}
      this._arduinoHid = null;
    }
  }

  /**
   * Match scripts/bank-excel-download-automation/woori.spec.js: hover(force) then click, same fallbacks.
   */
  async _wooriClickLogin() {
    try {
      const locator = this.page.getByRole('button', { name: '로그인' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
    } catch (error) {
      try {
        const fallbackLocator = this.page.locator('.btn-action1');
        await fallbackLocator.hover({ force: true });
        await fallbackLocator.click({ timeout: 5000 });
      } catch (error2) {
        const xpathLocator = this.page.locator(
          'xpath=/html/body/div/main/div[2]/div[1]/div[2]/div/div/dl/dd[1]/button'
        );
        await xpathLocator.hover({ force: true });
        await xpathLocator.click();
      }
    }
  }

  async _wooriClickLegacyCertButton() {
    try {
      const locator = this.page.getByRole('span', { name: '(구)공인인증서' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
    } catch (error) {
      try {
        const fallbackLocator = this.page.locator('span');
        await fallbackLocator.hover({ force: true });
        await fallbackLocator.click({ timeout: 5000 });
      } catch (error2) {
        const xpathLocator = this.page.locator(
          'xpath=/html/body/div/div[2]/section/div/div/fieldset[1]/div[1]/button[2]/span'
        );
        await xpathLocator.hover({ force: true });
        await xpathLocator.click();
      }
    }
  }

  /**
   * Debug: logs id / class / text / approximate xpath for cert UI nodes before clicking.
   * When CERT_EXPIRY / WOORI_CERT_EXPIRY is set, also lists elements whose text contains that string.
   */
  async _logWooriCertSelectionDebug() {
    const filterDate = process.env.CERT_EXPIRY || process.env.WOORI_CERT_EXPIRY || '';
    const dump = await this.page.evaluate((filterDate) => {
      const snippet = (el) => ({
        tag: el.tagName,
        id: el.id || null,
        className: typeof el.className === 'string' ? el.className : null,
        text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
      });
      const xpathFor = (el) => {
        if (!el || el.nodeType !== 1) return '';
        const parts = [];
        let node = el;
        for (let depth = 0; node && node.nodeType === 1 && depth < 12; depth++) {
          let seg = node.tagName.toLowerCase();
          if (node.id) {
            seg += `[@id="${node.id}"]`;
            parts.unshift(seg);
            break;
          }
          const parent = node.parentElement;
          if (!parent) break;
          const sameTag = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
          const idx = sameTag.indexOf(node) + 1;
          seg += `[${idx}]`;
          parts.unshift(seg);
          node = parent;
        }
        return parts.length ? '/' + parts.join('/') : '';
      };

      const cells = Array.from(document.querySelectorAll('.xwup-tableview-cell'));
      const cellInfo = cells.map((el) => ({ ...snippet(el), xpathApprox: xpathFor(el) }));

      const textHits = [];
      if (filterDate) {
        document.querySelectorAll('div, td, span, a, button').forEach((el) => {
          const t = (el.textContent || '').trim();
          if (!t.includes(filterDate)) return;
          if (textHits.length >= 25) return;
          textHits.push({ ...snippet(el), xpathApprox: xpathFor(el) });
        });
      }

      return { cellCount: cells.length, cells: cellInfo, textHitsContainingDate: textHits };
    }, filterDate);
    this.log('[WOORI DEBUG] .xwup-tableview-cell count=', dump.cellCount);
    for (let i = 0; i < dump.cells.length; i++) {
      this.log(`[WOORI DEBUG] cell[${i}]`, JSON.stringify(dump.cells[i]));
    }
    if (filterDate) {
      for (let i = 0; i < dump.textHitsContainingDate.length; i++) {
        this.log(
          `[WOORI DEBUG] textHit[${i}] (contains ${filterDate})`,
          JSON.stringify(dump.textHitsContainingDate[i])
        );
      }
    }
  }

  /**
   * Same cascade as woori.spec.js STEP 4: optional getByRole/getByText for CERT_EXPIRY (or WOORI_CERT_EXPIRY),
   * then #xwup_cert_table cell → .xwup-tableview-cell → XPath. getByRole can be count=0 when the date cell has no accessible name.
   */
  async _wooriClickCertTableCell() {
    const targetExpiry = process.env.CERT_EXPIRY || process.env.WOORI_CERT_EXPIRY || '';
    if (process.env.WOORI_DEBUG_CERT === '1') {
      await this._logWooriCertSelectionDebug();
    }

    if (targetExpiry) {
      try {
        const locator = this.page.getByRole('div', { name: targetExpiry });
        await locator.hover({ force: true });
        await locator.click({ timeout: 5000 });
        this.log(`[WOORI] cert row: getByRole('div', { name: '${targetExpiry}' })`);
        return;
      } catch (error) {
        this.warn('[WOORI] getByRole failed (common in Electron — a11y name may differ):', error.message);
      }
      try {
        const table = this.page.locator('#xwup_cert_table');
        const byText = table.getByText(targetExpiry, { exact: true });
        await byText.first().hover({ force: true });
        await byText.first().click({ timeout: 5000 });
        this.log(`[WOORI] cert row: #xwup_cert_table getByText('${targetExpiry}', exact)`);
        return;
      } catch (errorText) {
        this.warn('[WOORI] #xwup_cert_table getByText failed, trying table cell fallbacks:', errorText.message);
      }
    } else {
      this.log('[WOORI] CERT_EXPIRY / WOORI_CERT_EXPIRY not set; using cert table cell fallbacks');
    }

    try {
      const scoped = this.page.locator('#xwup_cert_table .xwup-tableview-cell');
      if ((await scoped.count()) > 0) {
        await scoped.first().hover({ force: true });
        await scoped.first().click({ timeout: 5000 });
        this.log('[WOORI] cert row: #xwup_cert_table .xwup-tableview-cell.first()');
        return;
      }
    } catch (e) {
      this.warn('[WOORI] #xwup_cert_table scoped cell failed:', e.message);
    }
    try {
      const fallbackLocator = this.page.locator('.xwup-tableview-cell').first();
      await fallbackLocator.hover({ force: true });
      await fallbackLocator.click({ timeout: 5000 });
      this.warn('[WOORI] cert row: first .xwup-tableview-cell (woori.spec.js fallback — may be wrong cell)');
    } catch (error2) {
      this.warn('[WOORI] CSS fallback failed, woori.spec.js XPath:', error2.message);
      const xpathLocator = this.page.locator(
        'xpath=/html/body/div[1]/div/div[2]/div[3]/table/tbody/tr[1]/td[3]/div'
      );
      await xpathLocator.hover({ force: true });
      await xpathLocator.click();
      this.log('[WOORI] cert row: xpath …/tr[1]/td[3]/div (woori.spec.js last resort)');
    }
  }

  async prepareCorporateCertificateLogin(proxyUrl) {
    const proxy = this.buildProxyOption(proxyUrl);
    try {
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (e) {}
        this.browser = null;
        this.context = null;
        this.page = null;
      }

      // scripts/bank-excel-download-automation/woori.spec.js — temp profile, args order, viewport null, downloads; no route interception
      const corpDownloadsPath = path.join(this.outputDir, 'corporate-cert-downloads');
      this.ensureOutputDirectory(corpDownloadsPath);
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
        downloadsPath: corpDownloadsPath,
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

      await this.page.goto(this.config.xpaths.entryUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(2839);

      await this._wooriClickLogin();
      await this.page.waitForTimeout(2044);

      await this._wooriClickLegacyCertButton();
      await this.page.waitForTimeout(3000);

      this.log('[WOORI] Cert dialog is open. Relying on default/active selection.');

      this._wooriCorporateCertPhase = 'awaiting_password';
      this._wooriCertAttempt = 0;
      this.isLoggedIn = false;
      return {
        success: true,
        phase: 'awaiting_password',
        message: '인증서 창이 열렸습니다. 필요하면 인증서 목록에서 다른 인증서를 선택할 수 있습니다.',
      };
    } catch (error) {
      this.error('prepareCorporateCertificateLogin (woori) failed:', error.message);
      this._wooriCorporateCertPhase = 'idle';
      return { success: false, error: error.message };
    }
  }

  async completeCorporateCertificateLogin(creds) {
    const { certificatePassword } = creds || {};
    if (this._wooriCorporateCertPhase !== 'awaiting_password') {
      return { success: false, error: '인증서 준비 단계가 완료되지 않았습니다.' };
    }
    if (!certificatePassword) {
      return { success: false, error: '인증서 비밀번호가 필요합니다.' };
    }
    if (!this.page || this.page.isClosed()) {
      this._wooriCorporateCertPhase = 'idle';
      return { success: false, error: '브라우저 세션이 없습니다.' };
    }
    if (!this.arduinoPort) {
      return { success: false, error: 'Arduino 시리얼 포트가 설정되지 않았습니다.' };
    }

    this._wooriCertAttempt += 1;
    const useSlowTyping = this._wooriCertAttempt >= 2;
    if (useSlowTyping) {
      this.warn(`[WOORI] 재시도 ${this._wooriCertAttempt}회차 — 느린 타이핑 모드 사용`);
    }

    try {
      this._arduinoHid = new ArduinoHidBankSession({
        portPath: this.arduinoPort,
        baudRate: this.arduinoBaudRate,
        log: (m) => this.log(m),
      });
      await this._arduinoHid.connect();

      let focused = '';
      for (let i = 1; i <= 20; i++) {
        await this._arduinoHid.sendKey('TAB');
        await this.page.waitForTimeout(300);
        const focusInfo = await this.page.evaluate(() => {
          const ae = document.activeElement;
          if (!ae) return { id: '', tag: '', text: '', className: '', name: '', role: '', type: '', ariaLabel: '', title: '' };
          return {
            id: ae.id || '',
            tag: ae.tagName || '',
            text: (ae.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120),
            className: typeof ae.className === 'string' ? ae.className : '',
            name: ae.getAttribute?.('name') || '',
            role: ae.getAttribute?.('role') || '',
            type: ae.getAttribute?.('type') || '',
            ariaLabel: ae.getAttribute?.('aria-label') || '',
            title: ae.getAttribute?.('title') || '',
          };
        });
        this.log(`[WOORI TAB ${i}] id="${focusInfo.id}" tag=${focusInfo.tag} type="${focusInfo.type}" name="${focusInfo.name}" role="${focusInfo.role}" aria="${focusInfo.ariaLabel}" title="${focusInfo.title}" class="${focusInfo.className}" text="${focusInfo.text}"`);
        focused = focusInfo.id || focusInfo.tag;
        if (focusInfo.tag === 'BUTTON' && focusInfo.text.includes('삭제')) {
          this.warn(`[WOORI] TAB landed on 삭제 button — sending another TAB to skip (i=${i})`);
          continue;
        }
        if (focused === 'xwup_certselect_tek_input1') break;
      }
      if (focused !== 'xwup_certselect_tek_input1') {
        throw new Error(`비밀번호 입력칸에 도달하지 못했습니다 (focus: ${focused})`);
      }

      if (useSlowTyping) {
        await this._arduinoHid.typeCharByChar(certificatePassword);
      } else {
        await this._arduinoHid.typeViaNaturalTiming(certificatePassword);
      }
      await this._arduinoHid.disconnect();
      this._arduinoHid = null;

      try {
        await this.page.getByRole('button', { name: '확인' }).click({ timeout: 5000 });
      } catch (e) {
        await this.page.locator('[id="xwup_OkButton"]').click({ timeout: 5000 });
      }
      await this.page.waitForTimeout(3000);

      // Check if the cert dialog is still open — the xwup password input is only present
      // while the dialog is visible. If it's still there after 3s, the password was wrong.
      const certCheck = await this.page.evaluate(() => {
        const pwdField = document.querySelector('#xwup_certselect_tek_input1');
        if (!pwdField) return { open: false, errorText: null };
        const rect = pwdField.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return { open: false, errorText: null };
        const style = window.getComputedStyle(pwdField);
        if (style.display === 'none' || style.visibility === 'hidden') return { open: false, errorText: null };
        // Try to grab an error message from within the xwup cert container
        const errorSelectors = ['#xwup_errMsg', '.xwup-msg-text', '.xwup-error', '[id*="xwup"][id*="err"]'];
        let errorText = null;
        for (const sel of errorSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const t = el.textContent.trim();
            if (t) { errorText = t; break; }
          }
        }
        return { open: true, errorText };
      }).catch(() => ({ open: false, errorText: null }));

      if (certCheck.open) {
        this.warn('[WOORI] 인증서 창이 닫히지 않음 — 비밀번호 오류.');
        this._wooriCorporateCertPhase = 'awaiting_password';
        return {
          success: false,
          wrongPassword: true,
          error: certCheck.errorText || '인증서 비밀번호가 올바르지 않습니다. 다시 시도해주세요.',
        };
      }

      await this._navigateWooriToTransactionInquiryMenu();

      const accounts = await this._getWooriAccountsFromPage();
      this._wooriCorporateCertPhase = 'completed';
      this.isLoggedIn = true;
      this.userName = '우리 기업뱅킹';
      try {
        this.startSessionKeepAlive();
      } catch (e) {}

      return {
        success: true,
        isLoggedIn: this.isLoggedIn,
        userName: this.userName,
        accounts,
      };
    } catch (error) {
      this.error('completeCorporateCertificateLogin (woori) failed:', error.message);
      try {
        await this._disconnectArduinoHid();
      } catch (e) {}
      return { success: false, error: error.message };
    }
  }

  /**
   * Same menu path as completeCorporateCertificateLogin — 조회 → 거래내역조회.
   */
  async _navigateWooriToTransactionInquiryMenu() {
    if (!this.page || this.page.isClosed()) return;
    try {
      await this.page.getByRole('link', { name: '조회' }).click({ timeout: 5000 });
    } catch (e) {
      await this.page.locator('header a').filter({ hasText: '조회' }).first().click({ timeout: 5000 }).catch(() => {});
    }
    await this.page.waitForTimeout(2000);
    try {
      await this.page.getByRole('link', { name: '거래내역조회' }).click({ timeout: 5000 });
    } catch (e) {
      await this.page.locator('a').filter({ hasText: '거래내역조회' }).first().click({ timeout: 5000 }).catch(() => {});
    }
    await this.page.waitForTimeout(3000);
  }

  // ============================================================================
  // Woori 전자결제 → B2B대출(협력) → 대출_신청 → 실행내역
  // (woori_b2b_loan_executions table)
  // ============================================================================

  /**
   * Navigate to 전자결제 → B2B대출(협력) → 대출_신청 → 실행내역.
   * Idempotent — closes leftover popups first.
   */
  async _navigateWooriToB2bLoanExecutions() {
    if (!this.page || this.page.isClosed()) throw new Error('No page');
    await this._closeWooriOpenPopups();

    // Top-nav: 전자결제 tab
    try {
      await this.page.getByRole('link', { name: '전자결제' }).first().click({ timeout: 5000 });
    } catch (e) {
      await this.page.locator('header a').filter({ hasText: '전자결제' }).first().click({ timeout: 5000 });
    }
    await this.page.waitForTimeout(1500);

    // Mega-menu: hover 판매기업 to expose its sub-items, then click B2B대출(협력)
    try {
      await this.page.locator('a').filter({ hasText: '판매기업' }).first().hover({ force: true });
      await this.page.waitForTimeout(400);
    } catch (e) {
      this.warn('[WOORI b2b] 판매기업 hover failed (may not be needed):', e.message);
    }
    try {
      await this.page.getByRole('link', { name: 'B2B대출(협력)' }).first().click({ timeout: 5000 });
    } catch (e) {
      await this.page.locator('a').filter({ hasText: 'B2B대출(협력)' }).first().click({ timeout: 5000 });
    }
    await this.page.waitForTimeout(2500);

    // Side-nav: hover parent 대출_신청 to expand its submenu, then click 실행내역.
    // We scope to `main nav` so we don't match top-level mega-menu links like
    // "무역금융실행내역조회" which contain "실행내역" as a substring.
    const sideNav = this.page.locator('main nav').first();

    const sideNavLink = (text) =>
      sideNav.locator('a').filter({ hasText: new RegExp(`^${text}$`) }).first();

    const parentLoan = sideNavLink('대출_신청');
    await parentLoan.waitFor({ state: 'visible', timeout: 5000 });
    await parentLoan.hover({ force: true });
    await this.page.waitForTimeout(400);
    // Click as well — the recording shows both hover (implicit) and click are
    // used to keep the submenu open while we move the mouse.
    try {
      await parentLoan.click({ timeout: 4000 });
    } catch (e) {
      this.warn('[WOORI b2b] 대출_신청 click failed (hover may be enough):', e.message);
    }
    await this.page.waitForTimeout(800);

    const execHistory = sideNavLink('실행내역');
    // Re-hover the parent right before clicking the child in case the submenu
    // collapsed during the move.
    await parentLoan.hover({ force: true });
    await this.page.waitForTimeout(200);
    await execHistory.waitFor({ state: 'visible', timeout: 5000 });
    await execHistory.hover({ force: true });
    await execHistory.click({ timeout: 5000 });
    await this.page.waitForTimeout(2500);
  }

  /**
   * Click the company picker. The 실행내역 page shows a single-row table at the top
   * where clicking the cell reveals a list of company buttons; click the first one.
   */
  async _wooriPickFirstCompany() {
    try {
      // The cell that opens the picker
      await this.page.locator('main table tr td > div > div').first().click({ timeout: 5000 }).catch(() => {});
      await this.page.waitForTimeout(800);
      // Pick the first company button that appears
      const btn = this.page.locator('main table tr td > div button').first();
      const visible = await btn.isVisible({ timeout: 1500 }).catch(() => false);
      if (visible) {
        await btn.click({ timeout: 5000 });
        await this.page.waitForTimeout(800);
      } else {
        this.warn('[WOORI b2b] company picker button not visible — proceeding without explicit selection');
      }
    } catch (e) {
      this.warn('[WOORI b2b] company picker failed:', e.message);
    }
  }

  /**
   * Convert YYYYMMDD or YYYY-MM-DD or Date to { yyyy, mm, dd } strings.
   */
  _wooriParseDateParts(input) {
    if (input instanceof Date && !Number.isNaN(input.getTime())) {
      return {
        yyyy: String(input.getFullYear()),
        mm: String(input.getMonth() + 1).padStart(2, '0'),
        dd: String(input.getDate()).padStart(2, '0'),
      };
    }
    const digits = String(input || '').replace(/\D/g, '');
    if (digits.length < 8) throw new Error(`Invalid date: ${input}`);
    return { yyyy: digits.slice(0, 4), mm: digits.slice(4, 6), dd: digits.slice(6, 8) };
  }

  /**
   * Open the dual-side calendar overlay via #staDtBtn, set start + end year/month/day,
   * then confirm with .btn-com1. Typing into #inqSdt10 / #inqEdt10 directly does NOT work
   * on this page — the calendar UI is the only reliable path.
   */
  async _wooriPickDateRange(startDate, endDate) {
    const start = this._wooriParseDateParts(startDate);
    const end = this._wooriParseDateParts(endDate);
    this.log(
      `[WOORI b2b] picking date range ${start.yyyy}-${start.mm}-${start.dd} ~ ${end.yyyy}-${end.mm}-${end.dd}`,
    );

    // Open the overlay
    try {
      await this.page.getByRole('button', { name: '조회시작일' }).first().click({ timeout: 5000 });
    } catch (e) {
      await this.page.locator('[id="staDtBtn"]').click({ timeout: 5000 });
    }
    await this.page.waitForTimeout(800);

    // Scope every subsequent locator to #uiMultiDate so we never accidentally match
    // selects/tables that appear elsewhere on the page (e.g. results tables).
    const overlayRoot = this.page.locator('#uiMultiDate');
    await overlayRoot.waitFor({ state: 'visible', timeout: 5000 });

    const yearSelects = overlayRoot.locator('select.rt-qc-ui-datepicker-year');
    const monthSelects = overlayRoot.locator('select.rt-qc-ui-datepicker-month');
    const calendarTables = overlayRoot.locator('table:has(a.rt-qc-ui-state-default)');

    /**
     * Day-cell click that re-resolves the locator against the *current* DOM, ignores
     * greyed-out previous/next-month cells, and waits for the cell to be stable.
     * The end calendar's day cells are re-rendered when its month changes, so we MUST
     * locate them after `selectOption()` completes — not before.
     */
    const clickDayInTable = async (table, dd, label) => {
      const want = String(parseInt(dd, 10));
      // Re-query each call so we get the freshly-rendered cells.
      const cells = table.locator('a.rt-qc-ui-state-default');
      const count = await cells.count();
      // Filter to cells whose exact text is the target day. Skip cells visually
      // greyed-out for previous/next month (rt-qc-ui-priority-secondary) — these
      // also have the day text and would steal a `.first()` match.
      for (let i = 0; i < count; i++) {
        const c = cells.nth(i);
        const text = ((await c.textContent()) || '').trim();
        if (text !== want) continue;
        const cls = (await c.getAttribute('class')) || '';
        if (/rt-qc-ui-priority-secondary|disabled/i.test(cls)) continue;
        await c.scrollIntoViewIfNeeded().catch(() => {});
        await c.click({ timeout: 3000 });
        return;
      }
      throw new Error(`Could not find ${label} day cell ${dd}`);
    };

    // ---- Start side: year → month → day, with a settle wait between month & day ----
    await yearSelects.nth(0).selectOption(start.yyyy);
    await monthSelects.nth(0).selectOption(start.mm);
    await this.page.waitForTimeout(500);
    await clickDayInTable(calendarTables.nth(0), start.dd, 'start');
    await this.page.waitForTimeout(300);

    // ---- End side: same pattern. Locators re-resolve fresh against the new DOM. ----
    await yearSelects.nth(1).selectOption(end.yyyy);
    await monthSelects.nth(1).selectOption(end.mm);
    await this.page.waitForTimeout(500);
    await clickDayInTable(calendarTables.nth(1), end.dd, 'end');
    await this.page.waitForTimeout(300);

    // Confirm. Tricky bit: the 확인 button may live in a <section> that's a sibling
    // of #uiMultiDate rather than inside it (recorded xpath was body/div[4]/section/div[2]/button,
    // dialog id is on a different div). Try several strategies, log which one lands,
    // and let click errors surface instead of swallowing them.
    const overlay = this.page.locator('#uiMultiDate');
    const strategies = [
      { name: 'overlay > button.btn-com1', loc: () => overlay.locator('button.btn-com1').first() },
      { name: 'overlay > button:has-text("확인")', loc: () => overlay.locator('button:has-text("확인")').first() },
      // Visible-only global match — cheapest way to skip hidden duplicates on the page.
      { name: 'global button.btn-com1:visible', loc: () => this.page.locator('button.btn-com1:visible').first() },
      // Dialog-shape match (any open modal-dialog with a btn-com1 inside).
      {
        name: 'open dialog > button.btn-com1',
        loc: () => this.page.locator('div[role="dialog"][aria-modal="true"].open button.btn-com1').first(),
      },
      // Section that contains the calendar tables (the date overlay's content section).
      {
        name: 'section :has(.rt-qc-ui-datepicker-year) button.btn-com1',
        loc: () =>
          this.page
            .locator('section:has(.rt-qc-ui-datepicker-year)')
            .first()
            .locator('button.btn-com1')
            .first(),
      },
    ];

    let confirmedBy = null;
    for (const s of strategies) {
      try {
        const btn = s.loc();
        const visible = await btn.isVisible({ timeout: 500 }).catch(() => false);
        if (!visible) {
          this.log(`[WOORI b2b] 확인 strategy "${s.name}" not visible — skipping`);
          continue;
        }
        await btn.click({ timeout: 3000 });
        confirmedBy = s.name;
        this.log(`[WOORI b2b] 확인 clicked via "${s.name}"`);
        break;
      } catch (e) {
        this.warn(`[WOORI b2b] 확인 strategy "${s.name}" failed: ${e.message}`);
      }
    }

    if (!confirmedBy) {
      // Diagnostic dump so the next attempt has actionable info.
      const dump = await this.page.evaluate(() => {
        const list = (sel) =>
          Array.from(document.querySelectorAll(sel))
            .slice(0, 8)
            .map((el) => ({
              text: (el.textContent || '').trim().slice(0, 60),
              className: typeof el.className === 'string' ? el.className : '',
              id: el.id || '',
              visible: !!(el.offsetParent || el.getClientRects().length),
            }));
        return {
          btnCom1: list('button.btn-com1'),
          confirmTexts: list('button'),
          uiMultiDate: !!document.getElementById('uiMultiDate'),
        };
      });
      this.warn(`[WOORI b2b] 확인 not clicked. Diagnostic: ${JSON.stringify(dump)}`);
      throw new Error('Could not click 확인 to close the date-picker overlay');
    }

    // Wait for the overlay to actually disappear before returning. If it stays
    // open, the next click (조회 / 파일저장) will be intercepted.
    const closed = await overlay
      .waitFor({ state: 'hidden', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!closed) {
      this.warn(`[WOORI b2b] #uiMultiDate did not close after 확인 (clicked via ${confirmedBy})`);
      // Don't press Escape — that would CANCEL the date selection. Instead, try
      // clicking once more then surface the error so we don't run 조회 with a
      // blocked viewport.
      await this.page
        .locator('button.btn-com1:visible')
        .first()
        .click({ timeout: 2000 })
        .catch(() => {});
      const closed2 = await overlay
        .waitFor({ state: 'hidden', timeout: 2000 })
        .then(() => true)
        .catch(() => false);
      if (!closed2) {
        throw new Error('#uiMultiDate stayed open after 확인 — date range may be invalid (range too wide / future date / etc.)');
      }
    }
    await this.page.waitForTimeout(400);
  }

  /**
   * Default = current month: 1st of this month → today.
   */
  _wooriDefaultB2bDateRange() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}01`,
      endDate: `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`,
    };
  }

  /**
   * Sync 전자결제 → B2B대출(협력) → 대출_신청 → 실행내역.
   *
   * @param {{ startDate?: string, endDate?: string }} [opts] YYYYMMDD or YYYY-MM-DD; defaults to current month.
   * @returns {Promise<{ success: boolean, imported?: number, filePath?: string|null, error?: string, message?: string }>}
   */
  async syncB2bLoanExecutions(opts = {}) {
    if (!this.page) return { success: false, error: '브라우저 페이지가 없습니다.' };
    this.ensureOutputDirectory(this.downloadDir);
    let { startDate, endDate } =
      opts.startDate && opts.endDate ? opts : this._wooriDefaultB2bDateRange();

    // Reject / clamp future dates — the bank UI rejects them anyway, fail fast here.
    const today = this._wooriDefaultB2bDateRange().endDate;
    const sDigits = String(startDate || '').replace(/\D/g, '');
    const eDigits = String(endDate || '').replace(/\D/g, '');
    if (sDigits && sDigits > today) {
      return { success: false, error: `시작일이 미래입니다 (${startDate} > 오늘 ${today}).` };
    }
    if (eDigits && eDigits > today) {
      this.warn(`[WOORI b2b] endDate ${endDate} > today ${today} — clamping to today`);
      endDate = today;
    }
    if (sDigits && eDigits && sDigits > eDigits) {
      return { success: false, error: `시작일이 종료일보다 늦습니다 (${startDate} > ${endDate}).` };
    }

    this.log(`[WOORI b2b] syncB2bLoanExecutions ${startDate} ~ ${endDate} 시작...`);

    try {
      await this._navigateWooriToB2bLoanExecutions();
      await this._wooriPickFirstCompany();
      await this._wooriPickDateRange(startDate, endDate);

      // Trigger 조회. Must use #btnDoInquiry (or exact-name match) — `name: '조회'` is a
      // SUBSTRING match in Playwright, so it also matches #staDtBtn ("조회시작일") which
      // would re-open the date picker and block every subsequent click.
      try {
        await this.page.locator('[id="btnDoInquiry"]').click({ timeout: 5000 });
      } catch (e) {
        await this.page.getByRole('button', { name: '조회', exact: true }).first().click({ timeout: 5000 });
      }
      await this.page.waitForTimeout(3000);

      // Check for "해당 자료가 존재하지 않습니다" alert (BELAM00004)
      const alertText = await this.page
        .locator('.js-alert')
        .first()
        .textContent({ timeout: 1500 })
        .catch(() => null);
      if (alertText && alertText.includes('해당 자료가 존재하지 않습니다')) {
        this.log('[WOORI b2b] no data alert detected — dismissing');
        try {
          await this.page.locator('.js-alert button').filter({ hasText: '확인' }).first().click({ timeout: 3000 });
        } catch (e) {}
        return { success: true, imported: 0, filePath: null, message: '해당 자료가 존재하지 않습니다.' };
      }

      // Trigger download
      await this.focusPlaywrightPage();
      const exportStartedAt = Date.now();
      const downloadPromise = this.waitForNextDownload({ timeout: 120000 });

      try {
        await this.page.locator('[id="qcell_qcExportFile"]').click({ timeout: 5000 });
      } catch (e) {
        await this.page.getByRole('button', { name: '파일저장' }).click({ timeout: 5000 });
      }
      await this.page.waitForTimeout(2000);
      try {
        await this.page.locator('[id="excelExportBtn"]').click({ timeout: 5000 });
      } catch (e) {
        await this.page.getByRole('button', { name: '엑셀저장' }).click({ timeout: 5000 });
      }

      // Race download event vs filesystem polling (matches getTransactions pattern)
      const scanDirs = [this.downloadDir, path.join(this.outputDir, 'corporate-cert-downloads')];
      const pollForFile = async () => {
        for (let i = 0; i < 60; i++) {
          const found = this.findRecentDownloadFile(scanDirs, exportStartedAt);
          if (found) return { type: 'polling', data: found };
          await new Promise((r) => setTimeout(r, 1000));
        }
        return { type: 'polling-timeout' };
      };
      const raced = await Promise.race([
        downloadPromise.then((dl) => ({ type: 'download', data: dl })).catch(() => ({ type: 'download-error' })),
        pollForFile(),
      ]);

      let download = null;
      let fallbackFile = null;
      let suggested = '실행내역조회.xlsx';

      if (raced.type === 'download') {
        download = raced.data;
        suggested = download.suggestedFilename() || suggested;
      } else if (raced.type === 'polling') {
        fallbackFile = raced.data;
        suggested = path.basename(fallbackFile.path);
      } else {
        const lastChance = this.findRecentDownloadFile(scanDirs, exportStartedAt);
        if (!lastChance) throw new Error('Failed to capture download or detect fallback file');
        fallbackFile = lastChance;
        suggested = path.basename(fallbackFile.path);
      }

      const ext = path.extname(suggested) || '.xlsx';
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const finalName = `우리_B2B대출실행내역_${startDate}_${endDate}_${ts}${ext}`;
      const finalPath = path.join(this.downloadDir, finalName);
      const saved = await this.saveDownloadSafely(download, fallbackFile?.path, finalPath);
      if (!saved) throw new Error('Failed to save Woori B2B loan-executions export');
      this.log(`[WOORI b2b] download saved to ${finalPath}`);

      await this._closeWooriOpenPopups();

      return {
        success: true,
        imported: 0,
        filePath: finalPath,
        message: 'Download complete; Woori Excel will be imported in the main process after this call.',
      };
    } catch (error) {
      this.error('[WOORI b2b] syncB2bLoanExecutions failed:', error.message);
      try {
        await this._closeWooriOpenPopups();
      } catch (e) {}
      return { success: false, error: error.message };
    }
  }

  /** Resync often leaves the session on another page; inquiry needs #startDate / #noAccount. */
  async _ensureWooriTransactionInquiryPage() {
    await this.focusPlaywrightPage();
    const ready = await this.page
      .locator('#startDate, #noAccount')
      .first()
      .isVisible({ timeout: 2500 })
      .catch(() => false);
    if (ready) return;
    this.log('[WOORI] Session not on 거래내역 — opening 조회 → 거래내역조회');
    await this._navigateWooriToTransactionInquiryMenu();
  }

  async _getWooriAccountsFromPage() {
    await this.page.locator('[id="noAccount"]').click({ timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(800);
    const raw = await this.page.evaluate(() => {
      const container = document.querySelector('[id="noAccount"]')?.parentElement?.querySelector('div:nth-child(2) > div');
      if (!container) return [];
      const btns = container.querySelectorAll('button');
      return Array.from(btns).map((btn) => ({ text: btn.textContent.trim() }));
    });
    await this.page.locator('[id="noAccount"]').click({ timeout: 3000 }).catch(() => {});

    const accounts = [];
    const seen = new Set();
    const re = /(\d{3,4}-\d{2,6}-\d{3,7})/;
    for (const row of raw) {
      const m = row.text.match(re);
      if (!m) continue;
      const accountNumber = m[1];
      const key = accountNumber.replace(/-/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      accounts.push({
        accountNumber,
        accountName: accountDisplayNameFromOptionText(row.text, '우리 기업 계좌'),
        bankId: 'woori',
        balance: 0,
        currency: 'KRW',
        lastUpdated: new Date().toISOString(),
      });
    }
    return accounts;
  }

  async cancelCorporateCertificateLogin(closeBrowser = true) {
    this._wooriCorporateCertPhase = 'idle';
    try {
      await this._disconnectArduinoHid();
    } catch (e) {}
    if (closeBrowser) await this.cleanup(false);
  }

  async login() {
    return { success: false, error: '우리은행은 기업 공동인증서 연결을 사용하세요.' };
  }

  async getAccounts() {
    const sessionStatus = await this.checkSessionActive();
    if (!sessionStatus.active) {
      return { success: false, sessionExpired: true, error: '세션이 만료되었습니다. 다시 로그인해주세요.' };
    }
    return this._getWooriAccountsFromPage();
  }

  _sanitizeWooriFilenamePart(s) {
    const t = String(s || 'account').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    return t.slice(0, 80);
  }

  /**
   * Close any open Woori popup (e.g. excel-download confirmation `c049855Pop`).
   * Search is scoped to each open `.pop-modal1.open` / `div[role="dialog"].open` so we
   * don't accidentally click an unrelated close button elsewhere on the page.
   * Falls back to Escape + force-hide if the close button isn't found or doesn't dismiss.
   */
  async _closeWooriOpenPopups() {
    if (!this.page || this.page.isClosed()) return;
    try {
      const result = await this.page.evaluate(() => {
        const dialogs = Array.from(
          document.querySelectorAll('div[role="dialog"].open, .pop-modal1.open, .pop-modal1.animate.open')
        ).filter((d) => d.offsetParent || d.getClientRects().length);
        const selectors = [
          'button.btn-close', 'a.btn-close',
          'button.btn_close', 'a.btn_close',
          'button.btnClose', 'a.btnClose',
          'button.btn-pop-close', 'a.btn-pop-close', '.btn-pop-close',
          '.pop_close', '.popClose', '.popup-close', '.popupClose', '.layer-close', '.layerClose',
          'button[title*="닫기"]', 'a[title*="닫기"]', '[title="닫기"]',
          '[aria-label*="닫기"]', 'button[aria-label="Close"]', '[aria-label="close"]',
          'img[alt*="닫기"]', 'img[src*="close"]', 'img[src*="gnb_sub_close"]', 'img[src*="btn_close"]',
          'i.ico-close', '.ico-close', '.ico_close', '.icon-close', '.icon_close',
          'button.close', 'a.close', 'span.close',
        ].join(', ');

        const dialogInfo = [];
        let clicked = 0;
        for (const dlg of dialogs) {
          const r = dlg.getBoundingClientRect();
          // 1) Try our known close-shape selectors scoped to the dialog
          const candidates = Array.from(dlg.querySelectorAll(selectors));
          for (const el of candidates) {
            const target = el.closest('a, button') || el;
            try { target.click(); clicked++; } catch (e) {}
          }
          // 2) Heuristic fallback — any clickable element in the top-right quadrant of the
          //    dialog that has a small size and X-ish text/onclick. Common pattern when the
          //    close is just <a onclick="popup.close()"><img src="..."></a> with no class.
          if (candidates.length === 0) {
            const allClickable = Array.from(dlg.querySelectorAll('a, button, [onclick], [role="button"]'));
            const topRight = allClickable.filter((el) => {
              const er = el.getBoundingClientRect();
              if (er.width === 0 || er.height === 0) return false;
              const inTopBand = er.top - r.top < 80;
              const inRightHalf = er.right > r.left + r.width / 2;
              const isSmall = er.width < 80 && er.height < 80;
              const text = (el.textContent || '').trim();
              const txMatch = text === '×' || text === 'X' || text === '✕' || text === '닫기' || /close/i.test(text);
              const childImg = el.querySelector('img');
              const imgMatch = childImg && /close|btn_x|btn-x|닫기/i.test((childImg.src || '') + (childImg.alt || ''));
              return inTopBand && inRightHalf && (isSmall || txMatch || imgMatch);
            });
            for (const el of topRight) {
              try { el.click(); clicked++; } catch (e) {}
            }
            // 3) If still nothing matched, dump diagnostic info so we can see the actual structure
            if (topRight.length === 0) {
              const sample = allClickable.slice(0, 20).map((el) => ({
                tag: el.tagName,
                id: el.id || '',
                className: typeof el.className === 'string' ? el.className : '',
                text: (el.textContent || '').trim().slice(0, 40),
                onclick: el.getAttribute('onclick')?.slice(0, 80) || '',
                imgSrc: el.querySelector('img')?.getAttribute('src') || '',
                imgAlt: el.querySelector('img')?.getAttribute('alt') || '',
              }));
              dialogInfo.push({ id: dlg.id, className: dlg.className, clickableSample: sample });
            }
          }
        }
        return { dialogCount: dialogs.length, clicked, dialogInfo };
      });
      this.log(`[WOORI] close popup: dialogs=${result.dialogCount}, clicks=${result.clicked}`);
      if (result.dialogInfo && result.dialogInfo.length > 0) {
        for (const d of result.dialogInfo) {
          this.warn(`[WOORI POPUP DEBUG] id="${d.id}" class="${d.className}" — no close button matched. Clickable sample:`);
          for (const s of d.clickableSample) {
            this.warn(`  ${JSON.stringify(s)}`);
          }
        }
      }
      if (result.dialogCount === 0) return;
      await this.page.waitForTimeout(500);

      const stillOpen = await this.page
        .locator('div[role="dialog"].open, .pop-modal1.open')
        .count()
        .catch(() => 0);
      if (stillOpen > 0) {
        // Don't force-hide via CSS — that leaves the popup's internal "open" state set, so
        // subsequent calls to the trigger button (e.g. #qcell_qcExportFile) become no-ops.
        // Press Escape only; if that fails we leave it for the next call's diagnostic dump.
        this.warn(`[WOORI] ${stillOpen} popup(s) still open — pressing Escape (skipping force-hide so popup state stays consistent)`);
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(300);
      }
    } catch (e) {
      this.warn('[WOORI] _closeWooriOpenPopups failed:', e.message);
    }
  }

  async _selectWooriAccountByIndex(index) {
    await this.page.locator('[id="noAccount"]').click({ timeout: 5000 });
    await this.page.waitForTimeout(800);
    const clicked = await this.page.evaluate((idx) => {
      const container = document.querySelector('[id="noAccount"]')?.parentElement?.querySelector('div:nth-child(2) > div');
      if (!container) return false;
      const btns = container.querySelectorAll('button');
      if (btns[idx]) {
        btns[idx].click();
        return true;
      }
      return false;
    }, index);
    if (!clicked) {
      throw new Error('Woori: could not click account in dropdown');
    }
    await this.page.waitForTimeout(1000);
  }

  _indexForWooriAccount(accountNumber, accounts) {
    const digits = String(accountNumber).replace(/\D/g, '');
    let ai = accounts.findIndex((a) => a.accountNumber.replace(/\D/g, '') === digits);
    if (ai < 0) {
      ai = accounts.findIndex((a) =>
        String(a.accountNumber).replace(/-/g, '').includes(digits)
      );
    }
    return ai >= 0 ? ai : 0;
  }

  /**
   * woori.spec.js — noAccount, startDate, searchBtn, qcell_qcExportFile → excelExportBtn + download
   */
  async getTransactions(accountNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');
    const sessionStatus = await this.checkSessionActive();
    if (!sessionStatus.active) {
      return { success: false, sessionExpired: true, error: '세션이 만료되었습니다. 다시 로그인해주세요.' };
    }
    this.ensureOutputDirectory(this.downloadDir);
    this.log(`Woori: fetching transactions for ${accountNumber} (${startDate} ~ ${endDate})...`);

    try {
      await this._ensureWooriTransactionInquiryPage();
      // Guard against a leftover excel-download popup from a previous account blocking #noAccount
      await this._closeWooriOpenPopups();
      const accounts = await this._getWooriAccountsFromPage();
      const ai = this._indexForWooriAccount(accountNumber, accounts);
      this.log(`Woori: account candidates=${accounts.length}, selectedIndex=${ai}`);
      await this._selectWooriAccountByIndex(ai);

      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      let usedDate = `${threeMonthsAgo.getFullYear()}${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}01`;
      const d = (startDate || '').replace(/\D/g, '');
      if (d.length >= 8) usedDate = d.slice(0, 8);

      const yesterday = new Date(now.getTime() - 86400000);
      const yesterdayStr = `${yesterday.getFullYear()}${String(yesterday.getMonth() + 1).padStart(2, '0')}${String(yesterday.getDate()).padStart(2, '0')}`;

      await this.page.evaluate((val) => {
        const el = document.getElementById('startDate');
        if (el) {
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, usedDate);
      this.log(`Woori: startDate input set to ${usedDate}`);
      await this.page.waitForTimeout(800);

      try {
        await this.page.locator('[id="searchBtn"]').click({ timeout: 5000 });
        this.log('Woori: search click via #searchBtn');
      } catch (e) {
        await this.page.getByRole('button', { name: '조회' }).click({ timeout: 5000 });
        this.log('Woori: search click via role(button=조회)');
      }
      await this.page.waitForTimeout(3000);
      this.log('Woori: search wait complete');

      const dateError = await this.page.evaluate(() => {
        const modal = document.querySelector('div[role="dialog"].open');
        return !!(modal && modal.textContent.includes('계좌 개설일보다 과거를 선택할 수 없습니다'));
      });
      if (dateError) {
        this.warn('Woori: date error detected, retrying with yesterday');
        try {
          await this.page.locator('div[role="dialog"].open button:has-text("확인")').first().click({ timeout: 3000 });
        } catch (e) {}
        await this.page.waitForTimeout(800);
        usedDate = yesterdayStr;
        await this.page.evaluate((val) => {
          const el = document.getElementById('startDate');
          if (el) {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, usedDate);
        await this.page.waitForTimeout(800);
        try {
          await this.page.locator('[id="searchBtn"]').click({ timeout: 5000 });
          this.log('Woori: retry search click via #searchBtn');
        } catch (e) {
          await this.page.getByRole('button', { name: '조회' }).click({ timeout: 5000 });
          this.log('Woori: retry search click via role(button=조회)');
        }
        await this.page.waitForTimeout(3000);
        this.log(`Woori: retry search complete with startDate=${usedDate}`);
      }

      await this.focusPlaywrightPage();
      this.log('Woori: focused page, waiting for next download event');
      const exportStartedAt = Date.now();
      const downloadPromise = this.waitForNextDownload({ timeout: 120000 });
      try {
        await this.page.locator('[id="qcell_qcExportFile"]').click({ timeout: 5000 });
        this.log('Woori: file-save menu click via #qcell_qcExportFile');
      } catch (e) {
        await this.page.getByRole('button', { name: '파일저장' }).click({ timeout: 5000 });
        this.log('Woori: file-save menu click via role(button=파일저장)');
      }
      await this.page.waitForTimeout(2000);

      try {
        await this.page.locator('[id="excelExportBtn"]').click({ timeout: 5000 });
        this.log('Woori: excel export click via #excelExportBtn');
      } catch (e) {
        await this.page.getByRole('button', { name: '엑셀저장' }).click({ timeout: 5000 });
        this.log('Woori: excel export click via role(button=엑셀저장)');
      }

      // Race download event vs filesystem polling. No-data text check is deferred until both
      // fail, because the phrase ("거래내역이 없습니다" etc.) often lives in a hidden empty-state
      // template in the DOM and would otherwise win instantly even when data is present.
      // Matches the proven pattern in scripts/bank-excel-download-automation/hana.spec.js.
      const scanDirs = [this.downloadDir, path.join(this.outputDir, 'corporate-cert-downloads')];
      const pollForFile = async () => {
        for (let i = 0; i < 60; i++) {
          const found = this.findRecentDownloadFile(scanDirs, exportStartedAt);
          if (found) return { type: 'polling', data: found };
          await new Promise((r) => setTimeout(r, 1000));
        }
        return { type: 'polling-timeout' };
      };

      const raced = await Promise.race([
        downloadPromise.then((dl) => ({ type: 'download', data: dl })).catch(() => ({ type: 'download-error' })),
        pollForFile(),
      ]);

      let download = null;
      let fallbackFile = null;
      let suggested = 'woori-export.xls';

      if (raced.type === 'download') {
        download = raced.data;
        suggested = download.suggestedFilename() || suggested;
        this.log(`Woori: download event received (${suggested})`);
      } else if (raced.type === 'polling') {
        fallbackFile = raced.data;
        suggested = path.basename(fallbackFile.path);
        this.log(`Woori: filesystem polling detected download (${suggested})`);
      } else {
        // Both signals failed — only NOW check for no-data text (after the download has had
        // time to fail). Then last-chance filesystem scan before giving up.
        const noDataPhrases = [
          '저장할 데이터가 없습니다',
          '조회결과가 없습니다',
          '거래내역이 없습니다',
          '조회된 데이터가 없습니다',
        ];
        const hitPhrase = await this.page
          .evaluate((phrases) => {
            const body = document.body?.innerText || '';
            return phrases.find((p) => body.includes(p)) || null;
          }, noDataPhrases)
          .catch(() => null);
        if (hitPhrase) {
          this.log(`Woori: no-data message detected after download failure ("${hitPhrase}") — returning empty`);
          return [];
        }
        const lastChance = this.findRecentDownloadFile(scanDirs, exportStartedAt);
        if (lastChance) {
          fallbackFile = lastChance;
          suggested = path.basename(fallbackFile.path);
          this.log(`Woori: last-chance scan detected download (${suggested})`);
        } else {
          throw new Error('Failed to capture download or detect fallback file');
        }
      }

      const ext = path.extname(suggested) || '.xls';
      const finalName = `우리기업_${this._sanitizeWooriFilenamePart(accountNumber)}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}${ext}`;
      const finalPath = path.join(this.downloadDir, finalName);

      const saved = await this.saveDownloadSafely(download, fallbackFile?.path, finalPath);
      if (!saved) throw new Error('Failed to save Woori export via all methods');
      this.log(`Woori: download saved to ${finalPath}`);

      await this._closeWooriOpenPopups();

      let extractedData;
      try {
        const parsed = parseTransactionExcel(finalPath, this);
        extractedData = {
          metadata: {
            bankName: '우리은행',
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
        this.warn('Woori Excel parse failed:', parseErr.message);
        extractedData = {
          metadata: {
            bankName: '우리은행',
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
      this.error('Woori getTransactions failed:', error.message);
      return [];
    }
  }

  async getTransactionsWithParsing(accountNumber, startDate, endDate) {
    const downloadResult = await this.getTransactions(accountNumber, startDate, endDate);
    
    // [수정] 내역 없음(Graceful Exit) 시 실패가 아닌 성공으로 반환
    if (!downloadResult || downloadResult.length === 0) {
      this.log('Woori: getTransactions returned empty (no data), returning success with empty transactions.');
      return {
        success: true,
        transactions: [],
        metadata: { bankName: '우리은행', accountNumber, totalCount: 0 },
        summary: { totalCount: 0 }
      };
    }
    const resultItem = downloadResult[0];
    if (resultItem.status !== 'downloaded') {
      return { success: false, error: 'Data extraction failed', downloadResult };
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
}

function createWooriAutomator(options = {}) {
  return new WooriBankAutomator(options);
}

module.exports = {
  WooriBankAutomator,
  createWooriAutomator,
};
