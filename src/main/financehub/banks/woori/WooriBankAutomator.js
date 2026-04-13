const fs = require('fs');
const path = require('path');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { parseTransactionExcel } = require('../../utils/transactionParser');
const { ArduinoHidBankSession } = require('../../utils/arduino-hid-bank');
const { WOORI_CONFIG } = require('./config');

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

      await this._wooriClickCertTableCell();
      await this.page.waitForTimeout(2000);

      this._wooriCorporateCertPhase = 'awaiting_password';
      this.isLoggedIn = false;
      return {
        success: true,
        phase: 'awaiting_password',
        message: '인증서를 선택했습니다. 비밀번호 입력 후 연결을 완료하세요.',
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
        focused = await this.page.evaluate(
          () => document.activeElement?.id || document.activeElement?.tagName || ''
        );
        if (focused === 'xwup_certselect_tek_input1') break;
      }
      if (focused !== 'xwup_certselect_tek_input1') {
        throw new Error(`비밀번호 입력칸에 도달하지 못했습니다 (focus: ${focused})`);
      }

      await this._arduinoHid.typeViaNaturalTiming(certificatePassword);
      await this._arduinoHid.disconnect();
      this._arduinoHid = null;

      try {
        await this.page.getByRole('button', { name: '확인' }).click({ timeout: 5000 });
      } catch (e) {
        await this.page.locator('[id="xwup_OkButton"]').click({ timeout: 5000 });
      }
      await this.page.waitForTimeout(3000);

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
    const re = /(\d{3}-\d{2,4}-\d{4,7})/;
    for (const row of raw) {
      const m = row.text.match(re);
      if (!m) continue;
      const accountNumber = m[1];
      const key = accountNumber.replace(/-/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      accounts.push({
        accountNumber,
        accountName: row.text.replace(accountNumber, '').trim() || '우리 기업 계좌',
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
    return this._getWooriAccountsFromPage();
  }

  _sanitizeWooriFilenamePart(s) {
    const t = String(s || 'account').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    return t.slice(0, 80);
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
    this.ensureOutputDirectory(this.downloadDir);
    this.log(`Woori: fetching transactions for ${accountNumber} (${startDate} ~ ${endDate})...`);

    try {
      await this._ensureWooriTransactionInquiryPage();
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

      let download = null;
      let fallbackFile = null;
      try {
        download = await downloadPromise;
        this.log(`Woori: download event received (${download.suggestedFilename()})`);
      } catch (e) {
        this.warn('Woori: download event timeout/failure, searching filesystem fallback...');
        const noDataMsg = await this.page.evaluate(() => {
          const body = document.body?.textContent || '';
          return (
            body.includes('저장할 데이터가 없습니다') ||
            body.includes('조회결과가 없습니다') ||
            body.includes('거래내역이 없습니다') ||
            body.includes('조회된 데이터가 없습니다')
          );
        });
        if (noDataMsg) {
          this.log('Woori: no data to export determined by UI message');
          return [];
        }
        
        // Scan both corporate downloads and Woori specific downloads
        const scanDirs = [this.downloadDir, path.join(this.outputDir, 'corporate-cert-downloads')];
        fallbackFile = this.findRecentDownloadFile(exportStartedAt, scanDirs);
        if (!fallbackFile) throw new Error('Failed to capture download or detect fallback file');
      }

      const finalName = `우리기업_${this._sanitizeWooriFilenamePart(accountNumber)}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.xls`;
      const finalPath = path.join(this.downloadDir, finalName);
      
      const saved = await this.saveDownloadSafely(download, fallbackFile?.path, finalPath);
      if (!saved) throw new Error('Failed to save Woori export via all methods');
      this.log(`Woori: download saved to ${finalPath}`);

      // Close download popup safely - Using the proven IBK pattern
      try {
        await this.page.evaluate(() => {
          const closeSelectors = [
            'img[src*="gnb_sub_close"]',
            'img[src*="close"]',
            '[title*="닫기"]',
            'button.btn-close',
            '.btn-pop-close',
            'a.btn-close',
            '.pop_close'
          ].join(', ');

          const closeBtn = document.querySelector(closeSelectors);
          if (closeBtn) {
            (closeBtn.closest('a, button') || closeBtn).click();
          } else {
            // Last resort: Force hide
            document.querySelectorAll('div[role="dialog"].open, .pop-modal1.open').forEach(m => {
              m.style.display = 'none';
              m.style.visibility = 'hidden';
            });
          }
        });
        await this.page.waitForTimeout(800);
      } catch (e) {}

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
    if (!downloadResult || downloadResult.length === 0) {
      return {
        success: false,
        error: 'Failed to fetch transaction data - no result returned',
        downloadResult,
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
