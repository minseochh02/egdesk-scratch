const path = require('path');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { parseTransactionExcel } = require('../../utils/transactionParser');
const { isWindows, waitForNativeCertificateDialogWindow } = require('../../utils/windows-uia-native');
const { ArduinoHidBankSession } = require('../../utils/arduino-hid-bank');
const {
  runNativeCertArduinoSteps,
  HANA_NATIVE_CERT_STEPS,
} = require('../../utils/corporate-cert-native-steps');
const { HANA_CONFIG } = require('./config');

class HanaBankAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    const config = {
      ...HANA_CONFIG,
      headless: options.headless ?? HANA_CONFIG.headless,
      chromeProfile: options.chromeProfile ?? HANA_CONFIG.chromeProfile,
    };
    super(config);
    this.outputDir = options.outputDir || this.getSafeOutputDir('hana');
    this.downloadDir = path.join(this.outputDir, 'hana-biz-downloads');
    this.ensureOutputDirectory(this.downloadDir);
    this.arduinoPort = options.arduinoPort || null;
    this.arduinoBaudRate = options.arduinoBaudRate || 9600;
    this._arduinoHid = null;
    this._hanaCorporateCertPhase = 'idle';
  }

  async _disconnectArduinoHid() {
    if (this._arduinoHid) {
      try {
        await this._arduinoHid.disconnect();
      } catch (e) {}
      this._arduinoHid = null;
    }
  }

  _hanaFrame() {
    return this.page.frame({ name: this.config.xpaths.mainFrameName });
  }

  /**
   * Match scripts/bank-excel-download-automation/hana.spec.js `closePopups()` (text buttons + layer close).
   */
  async _closeHanaPopups() {
    for (const target of [this.page, this._hanaFrame()].filter(Boolean)) {
      try {
        await target.evaluate(() => {
          const btns = document.querySelectorAll('button, a, span, div');
          for (const b of btns) {
            const text = b.textContent?.trim() || '';
            if (
              (text === '닫기' || text === '팝업 닫기' || text === '오늘 하루 열지않기' || text === '확인') &&
              b.offsetParent !== null
            ) {
              const rect = b.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) b.click();
            }
          }
          const layers = document.querySelectorAll('.layer_popup, .popup_wrap, .pop_wrap, [class*="popup"]');
          for (const l of layers) {
            const closeBtn = l.querySelector('.btn_close, .close, [class*="close"]');
            if (closeBtn) closeBtn.click();
          }
        });
      } catch (e) {}
    }
  }

  /**
   * Wait for hanaMainframe — close popups on main document between attempts (overlay can block frame).
   */
  async _waitForHanaMainframe({ maxWaitMs = 20000 } = {}) {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      await this._closeHanaPopups();
      const frame = this._hanaFrame();
      if (frame) return frame;
      await this.page.waitForTimeout(1000);
    }
    return this._hanaFrame();
  }

  async prepareCorporateCertificateLogin(proxyUrl) {
    if (!isWindows()) {
      return { success: false, error: '하나 기업 인증서 연결은 Windows에서만 지원됩니다.' };
    }
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
      // Match scripts/bank-excel-download-automation/hana.spec.js launch (temp profile, viewport null, downloads)
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
      this.page = context.pages()[0] || await context.newPage();
      this.page.on('dialog', async (dialog) => {
        try {
          await dialog.accept();
        } catch (e) {
          /* ignore */
        }
      });

      await this.page.goto(this.config.xpaths.entryUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000);

      // Close main-page overlays before requiring frame (spec closes after frame exists; we also clear
      // top-level popups first so they don't block or delay hanaMainframe — user reported login ran too soon).
      await this._closeHanaPopups();
      await this.page.waitForTimeout(500);

      const frame = await this._waitForHanaMainframe({ maxWaitMs: 20000 });
      if (!frame) {
        this._hanaCorporateCertPhase = 'idle';
        return { success: false, error: 'hanaMainframe not found' };
      }

      // hana.spec.js STEP 1: closePopups again in frame + page, then 1s before first 로그인
      await this._closeHanaPopups();
      await this.page.waitForTimeout(1000);

      await frame.locator('button:has-text("로그인")').first().click({ timeout: 10000 });
      await this.page.waitForTimeout(2000);

      try {
        await frame.evaluate(() => {
          if (typeof DelfinoConfig !== 'undefined') {
            DelfinoConfig.lastUsedCertFirst = true;
          }
        });
      } catch (e) {}

      await frame.locator(`[id="${this.config.xpaths.certLoginButtonId}"]`).click({ timeout: 10000 });

      const uia = await waitForNativeCertificateDialogWindow({
        timeoutMs: 60000,
        pollMs: 1000,
        onLog: (m) => this.log(m),
      });
      if (!uia.ok) {
        this._hanaCorporateCertPhase = 'idle';
        return { success: false, error: uia.error || '인증서 창을 찾지 못했습니다.' };
      }
      this._hanaCorporateCertPhase = 'awaiting_password';
      this.isLoggedIn = false;
      return {
        success: true,
        phase: 'awaiting_password',
        certWindowName: uia.windowName,
        certWindowClass: uia.matchedClass,
        message: '인증서 창이 열렸습니다.',
      };
    } catch (error) {
      this.error('prepareCorporateCertificateLogin (hana) failed:', error.message);
      this._hanaCorporateCertPhase = 'idle';
      return { success: false, error: error.message };
    }
  }

  async completeCorporateCertificateLogin(creds) {
    const { certificatePassword } = creds || {};
    if (this._hanaCorporateCertPhase !== 'awaiting_password') {
      return { success: false, error: '인증서 준비 단계가 완료되지 않았습니다.' };
    }
    if (!certificatePassword) {
      return { success: false, error: '인증서 비밀번호가 필요합니다.' };
    }
    if (!this.page || this.page.isClosed()) {
      this._hanaCorporateCertPhase = 'idle';
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
      await runNativeCertArduinoSteps(
        this._arduinoHid,
        this.page,
        certificatePassword,
        HANA_NATIVE_CERT_STEPS,
        {
          log: this.log.bind(this),
          warn: this.warn.bind(this),
          sendkeysEnterFallbackEnv: 'CORP_CERT_SENDKEYS_ENTER_FALLBACK',
        }
      );
      await this._arduinoHid.disconnect();
      this._arduinoHid = null;

      await this.page.waitForTimeout(5000);
      await this._closeHanaPopups();
      await this.page.waitForTimeout(2000);
      await this._closeHanaPopups();

      const frame = this._hanaFrame();
      if (frame) {
        try {
          await frame.locator('[id="15000"]').click({ timeout: 5000 });
        } catch (e) {
          await this.page.getByRole('link', { name: '조회' }).click({ timeout: 5000 });
        }
        await this.page.waitForTimeout(2000);
        try {
          await frame.locator('a[href*="menuItemId=wcdep700r16i"]').first().click({ timeout: 5000 });
        } catch (e) {
          await frame.evaluate(() => {
            const links = document.querySelectorAll('a.btn_item');
            for (const a of links) {
              if (a.textContent.trim() === '거래내역 조회' && a.getAttribute('href') !== '#') {
                const rect = a.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  a.click();
                  return;
                }
              }
            }
          });
        }
      }
      await this.page.waitForTimeout(3000);
      await this._closeHanaPopups();

      // Wait for 거래내역 화면 to paint account controls (dropdown may be in frame or main document)
      const frameAfter = this._hanaFrame();
      try {
        const racers = [this.page.waitForSelector('select', { timeout: 15000 })];
        if (frameAfter) racers.push(frameAfter.waitForSelector('select', { timeout: 15000 }));
        await Promise.race(racers);
      } catch (e) {
        this.warn('[HANA] No <select> within 15s after navigation — account list may still be empty.');
      }

      const accounts = await this._getHanaAccounts();
      this._hanaCorporateCertPhase = 'completed';
      this.isLoggedIn = true;
      this.userName = '하나 기업뱅킹';
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
      this.error('completeCorporateCertificateLogin (hana) failed:', error.message);
      try {
        await this._disconnectArduinoHid();
      } catch (e) {}
      return { success: false, error: error.message };
    }
  }

  /**
   * Find account `<select>` in hanaMainframe first, then full page (spec only scans frame; Electron/DOM may differ).
   * @returns {{ scope: import('playwright').Frame | import('playwright').Page, acctSelectId: string | null }}
   */
  async _findHanaAccountSelectScope() {
    const candidates = ['sAcctNo', 'sAccount', 'ID_sAcctNo', 'acct', 'drw_acno', 'sInqAcctNo'];
    const tryScope = async (scope, label) => {
      for (const id of candidates) {
        const ex = await scope.evaluate((cid) => !!document.getElementById(cid), id).catch(() => false);
        if (ex) return { scope, acctSelectId: id, label };
      }
      const found = await scope
        .evaluate(() => {
          const selects = document.querySelectorAll('select');
          for (const s of selects) {
            for (const opt of s.options) {
              if (/\d{3}-\d+/.test(opt.text) || /\d{10,}/.test(String(opt.value || ''))) {
                return s.id || null;
              }
            }
          }
          return null;
        })
        .catch(() => null);
      if (found) return { scope, acctSelectId: found, label };
      return null;
    };

    const frame = this._hanaFrame();
    const fromFrame = frame ? await tryScope(frame, 'hanaMainframe') : null;
    if (fromFrame) return fromFrame;

    this.warn('[HANA] No account <select> in hanaMainframe; trying main page (same URL may host controls outside frame).');
    const fromPage = await tryScope(this.page, 'main page');
    if (fromPage) return fromPage;

    return { scope: frame || this.page, acctSelectId: null, label: 'none' };
  }

  /** Dump all `<select>` elements for logs (matches hana.spec.js STEP 10 debug). */
  async _logHanaSelectDebug(scope) {
    if (!scope) return;
    try {
      const allSelects = await scope.evaluate(() => {
        const selects = document.querySelectorAll('select');
        return Array.from(selects).map((s) => ({
          id: s.id,
          name: s.name,
          className: s.className,
          optionCount: s.options.length,
          firstOptions: Array.from(s.options)
            .slice(0, 5)
            .map((o) => (o.text || '').trim()),
        }));
      });
      this.log(`[HANA] Account discovery — ${allSelects.length} <select> in scope:`);
      for (const s of allSelects) {
        this.log(
          `[HANA]   id="${s.id}" name="${s.name}" options=${s.optionCount} first=[${s.firstOptions.join(' | ')}]`
        );
      }
    } catch (e) {
      this.warn('[HANA] select debug dump failed:', e.message);
    }
  }

  /**
   * Parse option text into account number — hyphenated KB format, or contiguous digits.
   */
  _parseAccountNumberFromOptionText(text) {
    const t = (text || '').trim();
    const dashed = t.match(/(\d{3})-(\d{2,4})-(\d{4,7})/);
    if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
    const digits = t.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 16) {
      if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
      return digits;
    }
    return null;
  }

  /**
   * @returns {Promise<Array>} account list; never requires regex-only match (spec uses default row if empty).
   */
  async _getHanaAccounts() {
    const { scope, acctSelectId } = await this._findHanaAccountSelectScope();
    await this._logHanaSelectDebug(scope);

    if (!scope || !acctSelectId) {
      this.warn('[HANA] Could not find account dropdown id — returning placeholder account (hana.spec.js behavior).');
      return [
        {
          accountNumber: 'unknown',
          accountName: '하나 기업 계좌 (목록 미확인)',
          bankId: 'hana',
          balance: 0,
          currency: 'KRW',
          lastUpdated: new Date().toISOString(),
        },
      ];
    }

    const idEsc = String(acctSelectId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const acctSelect = scope.locator(`[id="${idEsc}"]`);
    let rows = await acctSelect
      .evaluate((sel) =>
        Array.from(sel.options)
          .filter((opt) => opt.value && opt.value !== '' && !opt.text.includes('선택'))
          .map((opt) => ({ text: (opt.textContent || '').trim(), value: opt.value }))
      )
      .catch(() => []);
    if (rows.length === 0) {
      rows = await acctSelect
        .evaluate((sel) =>
          Array.from(sel.options)
            .filter((opt, i) => i > 0 && opt.value)
            .map((opt) => ({ text: (opt.textContent || '').trim(), value: opt.value }))
        )
        .catch(() => []);
    }

    const accounts = [];
    const seen = new Set();
    for (const row of rows) {
      let accountNumber = this._parseAccountNumberFromOptionText(row.text);
      if (!accountNumber && row.value) {
        const vd = String(row.value).replace(/\D/g, '');
        if (vd.length >= 10) accountNumber = vd;
      }
      if (!accountNumber) continue;
      const key = accountNumber.replace(/-/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      accounts.push({
        accountNumber,
        accountName: row.text.replace(accountNumber, '').trim() || '하나 기업 계좌',
        bankId: 'hana',
        balance: 0,
        currency: 'KRW',
        lastUpdated: new Date().toISOString(),
      });
    }

    if (accounts.length === 0) {
      this.warn('[HANA] Dropdown found but no parseable account rows — placeholder (hana.spec.js).');
      return [
        {
          accountNumber: 'unknown',
          accountName: '하나 기업 계좌 (기본)',
          bankId: 'hana',
          balance: 0,
          currency: 'KRW',
          lastUpdated: new Date().toISOString(),
        },
      ];
    }

    return accounts;
  }

  async cancelCorporateCertificateLogin(closeBrowser = true) {
    this._hanaCorporateCertPhase = 'idle';
    try {
      await this._disconnectArduinoHid();
    } catch (e) {}
    if (closeBrowser) await this.cleanup(false);
  }

  async login() {
    return { success: false, error: '하나은행은 기업 공동인증서 연결을 사용하세요.' };
  }

  async getAccounts() {
    return this._getHanaAccounts();
  }

  _sanitizeHanaFilenamePart(s) {
    const t = String(s || 'account').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    return t.slice(0, 80);
  }

  /**
   * hana.spec.js — frame, account select, sInqStrDt, 조회, 전체엑셀다운로드 / fallbacks
   */
  async getTransactions(accountNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');
    this.ensureOutputDirectory(this.downloadDir);
    this.log(`Hana: fetching transactions for ${accountNumber} (${startDate} ~ ${endDate})...`);

    try {
      const frame = (await this._waitForHanaMainframe({ maxWaitMs: 15000 })) || this._hanaFrame();
      if (!frame) {
        this.error('Hana: hanaMainframe not found');
        return [];
      }

      const { scope, acctSelectId } = await this._findHanaAccountSelectScope();
      if (acctSelectId && scope) {
        const idEsc = String(acctSelectId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const acctSelect = scope.locator(`[id="${idEsc}"]`);
        const picked = await scope.evaluate(
          ({ selectId, acc }) => {
            const el = document.getElementById(selectId);
            if (!el) return null;
            const digits = String(acc).replace(/\D/g, '');
            for (const opt of el.options) {
              if (!opt.value) continue;
              const t = (opt.text || '').trim();
              if (t.includes(acc) || t.replace(/\D/g, '').includes(digits)) return opt.value;
            }
            return el.options[1]?.value || el.options[0]?.value || null;
          },
          { selectId: acctSelectId, acc: accountNumber }
        );
        if (picked) {
          await acctSelect.selectOption({ value: picked });
          await this.page.waitForTimeout(800);
        }
      }

      const d = (startDate || '').replace(/\D/g, '');
      let startDateStr;
      if (d.length >= 8) {
        startDateStr = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      } else {
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        startDateStr = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
      }

      await frame.evaluate((val) => {
        const el = document.getElementById('sInqStrDt');
        if (el) {
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, startDateStr);
      await this.page.waitForTimeout(400);

      try {
        await frame.evaluate(() => {
          const el = document.getElementById('ID_sRqstNcnt4');
          if (el) el.value = '100';
        });
      } catch (e) {}

      try {
        await frame.locator('button:has-text("조회")').click({ timeout: 5000 });
      } catch (e) {
        await frame.evaluate(() => {
          const btns = document.querySelectorAll('button');
          for (const b of btns) {
            if (b.textContent.trim() === '조회') {
              b.click();
              return;
            }
          }
        });
      }
      await this.page.waitForTimeout(3000);

      const dateError = await frame.evaluate(() => {
        const body = document.body.textContent || '';
        return (
          body.includes('계좌 개설일보다 과거를 선택할 수 없습니다') || body.includes('조회시작일이 계좌개설일')
        );
      });
      if (dateError) {
        try {
          await frame.locator('button:has-text("확인")').first().click({ timeout: 3000 });
        } catch (e) {}
        await this.page.waitForTimeout(600);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        await frame.evaluate((val) => {
          const el = document.getElementById('sInqStrDt');
          if (el) {
            el.value = val;
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, yStr);
        await this.page.waitForTimeout(400);
        try {
          await frame.locator('button:has-text("조회")').click({ timeout: 5000 });
        } catch (e) {}
        await this.page.waitForTimeout(3000);
      }

      const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });
      try {
        await frame.locator('button:has-text("전체엑셀다운로드")').click({ timeout: 5000 });
      } catch (e) {
        try {
          await frame.locator('button:has-text("엑셀다운로드")').click({ timeout: 5000 });
        } catch (e2) {
          await frame.locator('button:has-text("엑셀")').first().click({ timeout: 5000 });
        }
      }

      const raced = await Promise.race([
        downloadPromise.then((dl) => ({ type: 'download', data: dl })),
        this.page.waitForTimeout(5000).then(() => ({ type: 'timeout' })),
      ]);

      if (raced.type === 'timeout') {
        const noDataMsg = await frame.evaluate(() => {
          const body = document.body.textContent || '';
          return (
            body.includes('저장할 데이터가 없습니다') ||
            body.includes('조회결과가 없습니다') ||
            body.includes('거래내역이 없습니다') ||
            body.includes('조회된 데이터가 없습니다')
          );
        });
        if (noDataMsg) {
          this.log('Hana: no data to export');
          try {
            await frame.locator('button:has-text("확인")').first().click({ timeout: 3000 });
          } catch (e) {}
        } else {
          this.warn('Hana: Excel download timed out');
        }
        return [];
      }

      const download = raced.data;
      const suggested = download.suggestedFilename() || 'hana-export.xls';
      const ext = path.extname(suggested) || '.xls';
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safeAcc = this._sanitizeHanaFilenamePart(accountNumber);
      const finalName = `하나기업_${safeAcc}_${ts}${ext}`;
      const finalPath = path.join(this.downloadDir, finalName);
      await download.saveAs(finalPath);

      let extractedData;
      try {
        const parsed = parseTransactionExcel(finalPath, this);
        extractedData = {
          metadata: {
            bankName: '하나은행',
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
        this.warn('Hana Excel parse failed:', parseErr.message);
        extractedData = {
          metadata: {
            bankName: '하나은행',
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
      this.error('Hana getTransactions failed:', error.message);
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

function createHanaAutomator(options = {}) {
  return new HanaBankAutomator(options);
}

module.exports = {
  HanaBankAutomator,
  createHanaAutomator,
};
