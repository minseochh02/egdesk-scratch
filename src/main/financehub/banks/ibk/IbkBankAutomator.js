const path = require('path');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { parseTransactionExcel } = require('../../utils/transactionParser');
const { isWindows, waitForNativeCertificateDialogWindow } = require('../../utils/windows-uia-native');
const { ArduinoHidBankSession } = require('../../utils/arduino-hid-bank');
const {
  runNativeCertArduinoSteps,
  IBK_NATIVE_CERT_STEPS,
} = require('../../utils/corporate-cert-native-steps');
const { IBK_CONFIG } = require('./config');

class IbkBankAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    const config = {
      ...IBK_CONFIG,
      headless: options.headless ?? IBK_CONFIG.headless,
      chromeProfile: options.chromeProfile ?? IBK_CONFIG.chromeProfile,
    };
    super(config);
    this.outputDir = options.outputDir || this.getSafeOutputDir('ibk');
    this.downloadDir = path.join(this.outputDir, 'ibk-biz-downloads');
    this.ensureOutputDirectory(this.downloadDir);
    this.arduinoPort = options.arduinoPort || null;
    this.arduinoBaudRate = options.arduinoBaudRate || 9600;
    this._arduinoHid = null;
    this._ibkCorporateCertPhase = 'idle';
  }

  async _disconnectArduinoHid() {
    if (this._arduinoHid) {
      try {
        await this._arduinoHid.disconnect();
      } catch (e) {
        /* ignore */
      }
      this._arduinoHid = null;
    }
  }

  _mainFrame() {
    return this.page.frame({ name: this.config.xpaths.mainFrameName });
  }

  async _closeIbKPopups(frame) {
    const popupSelectors = [
      'button:has-text("닫기")',
      'button:has-text("확인")',
      'a:has-text("닫기")',
      '.popup_close',
      '.btn_close',
    ];
    for (const sel of popupSelectors) {
      try {
        const btn = frame.locator(sel).first();
        if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
          await btn.click();
          await this.page.waitForTimeout(800);
        }
      } catch (e) {
        /* ignore */
      }
    }
  }

  async prepareCorporateCertificateLogin(proxyUrl) {
    if (!isWindows()) {
      return { success: false, error: 'IBK 기업 인증서 연결은 Windows에서만 지원됩니다.' };
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
      // Match scripts/bank-excel-download-automation/ibk.spec.js launch (temp profile, viewport null, downloads)
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
      // Corporate cert: first page only — no setupBrowserContext (avoids route interception; same as spec)
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

      const frame = this._mainFrame();
      if (!frame) {
        this._ibkCorporateCertPhase = 'idle';
        return { success: false, error: 'mainframe not found' };
      }

      try {
        await frame.locator('a:has-text("로그인")').first().click({ timeout: 10000 });
      } catch (e) {
        await this.page.locator('a:has-text("로그인")').first().click({ timeout: 10000 });
      }
      await this.page.waitForTimeout(2000);

      try {
        await frame.evaluate(() => {
          if (typeof DelfinoConfig !== 'undefined') {
            DelfinoConfig.lastUsedCertFirst = true;
          }
        });
      } catch (e) {}

      try {
        await frame.locator('.ec').first().click({ timeout: 10000 });
      } catch (e) {
        await frame.locator('text=(구 공인인증서)').first().click({ timeout: 10000 });
      }

      const uia = await waitForNativeCertificateDialogWindow({
        timeoutMs: 60000,
        pollMs: 1000,
        onLog: (m) => this.log(m),
      });
      if (!uia.ok) {
        this._ibkCorporateCertPhase = 'idle';
        return { success: false, error: uia.error || '인증서 창을 찾지 못했습니다.' };
      }
      this._ibkCorporateCertPhase = 'awaiting_password';
      this.isLoggedIn = false;
      return {
        success: true,
        phase: 'awaiting_password',
        certWindowName: uia.windowName,
        certWindowClass: uia.matchedClass,
        message: '인증서 창이 열렸습니다.',
      };
    } catch (error) {
      this.error('prepareCorporateCertificateLogin (ibk) failed:', error.message);
      this._ibkCorporateCertPhase = 'idle';
      return { success: false, error: error.message };
    }
  }

  async completeCorporateCertificateLogin(creds) {
    const { certificatePassword } = creds || {};
    if (this._ibkCorporateCertPhase !== 'awaiting_password') {
      return { success: false, error: '인증서 준비 단계가 완료되지 않았습니다.' };
    }
    if (!certificatePassword) {
      return { success: false, error: '인증서 비밀번호가 필요합니다.' };
    }
    if (!this.page || this.page.isClosed()) {
      this._ibkCorporateCertPhase = 'idle';
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
        IBK_NATIVE_CERT_STEPS,
        {
          log: this.log.bind(this),
          warn: this.warn.bind(this),
          sendkeysEnterFallbackEnv: 'CORP_CERT_SENDKEYS_ENTER_FALLBACK',
        }
      );
      await this._arduinoHid.disconnect();
      this._arduinoHid = null;

      await this.page.waitForTimeout(5000);

      let frame = this._mainFrame();
      if (frame) await this._closeIbKPopups(frame);
      await this.page.waitForTimeout(2000);

      frame = this.page.frame({ name: 'mainframe' }) || frame;
      const activeFrame = frame;
      if (activeFrame) {
        await activeFrame.evaluate(() => {
          const links = document.querySelectorAll('a');
          for (const a of links) {
            if (a.textContent.trim() === '거래내역조회') {
              a.click();
              return;
            }
          }
        });
      }
      await this.page.waitForTimeout(3000);

      try {
        const f = this._mainFrame();
        const racers = [this.page.waitForSelector('select', { timeout: 12000 })];
        if (f) racers.push(f.waitForSelector('select', { timeout: 12000 }));
        await Promise.race(racers);
      } catch (e) {
        this.warn('[IBK] No <select> soon after 거래내역조회 — account list may be incomplete.');
      }

      const accounts = await this._getIbKAccounts();
      this._ibkCorporateCertPhase = 'completed';
      this.isLoggedIn = true;
      this.userName = 'IBK 기업뱅킹';
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
      this.error('completeCorporateCertificateLogin (ibk) failed:', error.message);
      try {
        await this._disconnectArduinoHid();
      } catch (e) {}
      return { success: false, error: error.message };
    }
  }

  _sanitizeIbkFilenamePart(s) {
    const t = String(s || 'account').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    return t.slice(0, 80);
  }

  _parseIbkAccountFromOption(text, value) {
    const t = (text || '').trim();
    const dashed = t.match(/(\d{3})-(\d{2,4})-(\d{4,7})/);
    if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
    const digits = t.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 16) {
      if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
      return digits;
    }
    const v = String(value || '').replace(/\D/g, '');
    if (v.length >= 10 && v.length <= 16) {
      if (v.length === 13) return `${v.slice(0, 6)}-${v.slice(6, 8)}-${v.slice(8)}`;
      return v;
    }
    return null;
  }

  async _logIbkSelectDebug(scope) {
    if (!scope) return;
    try {
      const all = await scope.evaluate(() => {
        const selects = document.querySelectorAll('select');
        return Array.from(selects).map((s) => ({
          id: s.id,
          name: s.name,
          optionCount: s.options.length,
          firstOptions: Array.from(s.options)
            .slice(0, 6)
            .map((o) => (o.text || '').trim().slice(0, 80)),
        }));
      });
      this.log(`[IBK] account discovery — ${all.length} <select> in scope:`);
      for (const s of all) {
        this.log(`[IBK]   id="${s.id}" name="${s.name}" options=${s.optionCount} first=[${s.firstOptions.join(' | ')}]`);
      }
    } catch (e) {
      this.warn('[IBK] select debug failed:', e.message);
    }
  }

  /**
   * ibk.spec.js uses frame.locator('[id="ecb_user_num01"]'); also search main page and other selects.
   */
  async _findIbkAccountSelect() {
    const primaryId = 'ecb_user_num01';
    const candidates = [primaryId, 'sAcctNo', 'sAccount', 'ID_sAcctNo', 'acct', 'drw_acno', 'sInqAcctNo'];

    const tryScope = async (scope, label) => {
      for (const id of candidates) {
        const n = await scope.locator(`[id="${String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`).count();
        if (n > 0) return { scope, id, label };
      }
      const found = await scope
        .evaluate(() => {
          const selects = document.querySelectorAll('select');
          for (const s of selects) {
            for (const opt of s.options) {
              if (/\d{3}-\d+/.test((opt.text || '').trim()) || /\d{10,}/.test(String(opt.value || ''))) {
                return s.id || null;
              }
            }
          }
          return null;
        })
        .catch(() => null);
      if (found) return { scope, id: found, label };
      return null;
    };

    const frame = this._mainFrame();
    const fromFrame = frame ? await tryScope(frame, 'mainframe') : null;
    if (fromFrame) return fromFrame;

    this.warn('[IBK] No account <select> in mainframe; trying main page.');
    const fromPage = await tryScope(this.page, 'main page');
    if (fromPage) return fromPage;

    return { scope: frame || this.page, id: null, label: 'none' };
  }

  /**
   * Same option list as ibk.spec.js STEP 10 (all options with opt.value), then flexible account parsing.
   */
  async _getIbKAccounts() {
    const { scope, id: acctSelectId } = await this._findIbkAccountSelect();
    await this._logIbkSelectDebug(scope);

    if (!scope || !acctSelectId) {
      this.warn('[IBK] Account dropdown not found.');
      return [];
    }

    const idEsc = String(acctSelectId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const acctSelect = scope.locator(`[id="${idEsc}"]`);

    const rows = await acctSelect
      .evaluate((sel) =>
        Array.from(sel.options)
          .filter((opt) => opt.value)
          .map((opt, i) => ({
            index: i,
            text: (opt.textContent || '').trim(),
            value: opt.value,
          }))
      )
      .catch(() => []);

    const accounts = [];
    const seen = new Set();
    for (const row of rows) {
      let accountNumber = this._parseIbkAccountFromOption(row.text, row.value);
      if (!accountNumber) {
        accountNumber = `value:${String(row.value).slice(0, 48)}`;
      }
      const key =
        accountNumber.startsWith('value:') ? `${accountNumber}:${row.index}` : accountNumber.replace(/-/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      const nameFromText = row.text
        .replace(/\d{3}-\d{2,4}-\d{4,7}/g, '')
        .replace(/\d{10,16}/g, '')
        .trim();
      accounts.push({
        accountNumber,
        accountName: nameFromText || 'IBK 기업 계좌',
        bankId: 'ibk',
        balance: 0,
        currency: 'KRW',
        lastUpdated: new Date().toISOString(),
      });
    }

    return accounts;
  }

  async cancelCorporateCertificateLogin(closeBrowser = true) {
    this._ibkCorporateCertPhase = 'idle';
    try {
      await this._disconnectArduinoHid();
    } catch (e) {}
    if (closeBrowser) await this.cleanup(false);
  }

  async login() {
    return { success: false, error: 'IBK는 기업 공동인증서 연결을 사용하세요.' };
  }

  async getAccounts() {
    return this._getIbKAccounts();
  }

  /**
   * ibk.spec.js — mainframe, ecb_user_num01, inqy_sttg_ymd_* (시작), inqy_fnsh_ymd_* (종료, if present), 저장 → 엑셀파일저장 → DownloadExcel → DownloadButton
   * @returns {Promise<Array<{status:string,filename?:string|null,path?:string|null,extractedData:object}>>}
   */
  async getTransactions(accountNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');
    this.ensureOutputDirectory(this.downloadDir);
    this.log(`IBK: fetching transactions for ${accountNumber} (${startDate} ~ ${endDate})...`);

    try {
      let frame = this.page.frame({ name: 'mainframe' }) || this._mainFrame();
      if (!frame) {
        this.warn('IBK: mainframe missing — waiting');
        await this.page.waitForTimeout(2000);
        frame = this.page.frame({ name: 'mainframe' }) || this._mainFrame();
      }
      if (!frame) {
        this.error('IBK: mainframe not found');
        return [];
      }

      const { scope, id: acctSelectId } = await this._findIbkAccountSelect();
      if (!acctSelectId || !scope) {
        this.error('IBK: account <select> not found');
        return [];
      }
      const idEsc = String(acctSelectId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const acctSelect = scope.locator(`[id="${idEsc}"]`);

      const matchIdx = await scope.evaluate(
        ({ selectId, acc }) => {
          const el = document.getElementById(selectId);
          if (!el) return -1;
          const opts = Array.from(el.options);
          const digits = String(acc).replace(/\D/g, '');
          for (let i = 0; i < opts.length; i++) {
            if (!opts[i].value) continue;
            const text = (opts[i].textContent || '').trim();
            const rowDigits = text.replace(/\D/g, '');
            if (text.includes(acc) || (digits.length >= 10 && rowDigits.includes(digits))) return i;
          }
          return -1;
        },
        { selectId: acctSelectId, acc: accountNumber }
      );
      const pickIdx = matchIdx >= 0 ? matchIdx : 0;
      await acctSelect.selectOption({ index: pickIdx });
      await this.page.waitForTimeout(800);

      const d = (startDate || '').replace(/\D/g, '');
      let yy;
      let mm;
      let dd;
      if (d.length >= 8) {
        yy = d.slice(0, 4);
        mm = d.slice(4, 6);
        dd = d.slice(6, 8);
      } else {
        const now = new Date();
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        yy = String(threeMonthsAgo.getFullYear());
        mm = String(threeMonthsAgo.getMonth() + 1).padStart(2, '0');
        dd = '01';
      }

      const ed = (endDate || '').replace(/\D/g, '');
      let endYy;
      let endMm;
      let endDd;
      if (ed.length >= 8) {
        endYy = ed.slice(0, 4);
        endMm = ed.slice(4, 6);
        endDd = ed.slice(6, 8);
      } else {
        const today = new Date();
        endYy = String(today.getFullYear());
        endMm = String(today.getMonth() + 1).padStart(2, '0');
        endDd = String(today.getDate()).padStart(2, '0');
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yestYY = String(yesterday.getFullYear());
      const yestMM = String(yesterday.getMonth() + 1).padStart(2, '0');
      const yestDD = String(yesterday.getDate()).padStart(2, '0');

      const setYmdTriplet = async (prefix, y, m, day) => {
        await frame.locator(`[id="${prefix}_yy"]`).selectOption(y);
        await frame.locator(`[id="${prefix}_mm"]`).selectOption(m);
        await frame.locator(`[id="${prefix}_dd"]`).selectOption(day);
      };

      try {
        await setYmdTriplet('inqy_sttg_ymd', yy, mm, dd);
      } catch (e) {
        this.warn('IBK: start date selects:', e.message);
      }
      try {
        await setYmdTriplet('inqy_fnsh_ymd', endYy, endMm, endDd);
      } catch (e) {
        this.warn('IBK: end date selects (inqy_fnsh_ymd_*):', e.message);
      }
      await this.page.waitForTimeout(600);

      try {
        await frame.locator('[id="_btnSubmit"]').click({ timeout: 5000 });
      } catch (e) {
        await frame.locator('button:has-text("조회")').click({ timeout: 5000 });
      }
      await this.page.waitForTimeout(3000);

      const dateAlert = await frame.evaluate(() => {
        const els = document.querySelectorAll('.alert, .popup, [class*="msg"], [class*="alert"]');
        for (const el of els) {
          if (el.offsetParent !== null && el.textContent && el.textContent.includes('개설일')) {
            return el.textContent;
          }
        }
        return '';
      });
      if (dateAlert) {
        this.log('IBK: date before account opening — retrying with yesterday');
        try {
          await frame.locator('button:has-text("확인")').first().click({ timeout: 3000 });
        } catch (e) {}
        await this.page.waitForTimeout(800);
        await setYmdTriplet('inqy_sttg_ymd', yestYY, yestMM, yestDD);
        await this.page.waitForTimeout(400);
        try {
          await frame.locator('[id="_btnSubmit"]').click({ timeout: 5000 });
        } catch (e) {
          await frame.locator('button:has-text("조회")').click({ timeout: 5000 });
        }
        await this.page.waitForTimeout(3000);
      }

      const noData = await frame.evaluate(() => {
        const body = document.body?.textContent || '';
        return body.includes('저장할 데이터가 없습니다') || body.includes('조회된 데이터가 없습니다');
      });
      if (noData) {
        this.log('IBK: no data to export');
        try {
          await frame.locator('button:has-text("확인")').first().click({ timeout: 3000 });
        } catch (e) {}
        return [];
      }

      const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });
      try {
        await frame.locator('span:has-text("저장")').first().click({ timeout: 5000 });
        await this.page.waitForTimeout(800);
      } catch (e) {
        this.warn('IBK: 저장 click:', e.message);
      }
      try {
        await frame.locator('span:has-text("엑셀파일저장")').first().click({ timeout: 5000 });
        await this.page.waitForTimeout(600);
      } catch (e) {
        this.warn('IBK: 엑셀파일저장 click:', e.message);
      }
      try {
        await frame.locator('[id="DownloadExcel"]').click({ timeout: 5000 });
        await this.page.waitForTimeout(400);
      } catch (e) {
        this.warn('IBK: DownloadExcel:', e.message);
      }
      try {
        await frame.locator('[id="DownloadButton"]').click({ timeout: 5000 });
      } catch (e) {
        this.warn('IBK: DownloadButton:', e.message);
      }

      const download = await downloadPromise;
      const suggested = download.suggestedFilename() || 'ibk-export.xls';
      const ext = path.extname(suggested) || '.xls';
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safeAcc = this._sanitizeIbkFilenamePart(accountNumber);
      const finalName = `IBK기업_${safeAcc}_${ts}${ext}`;
      const finalPath = path.join(this.downloadDir, finalName);
      await download.saveAs(finalPath);

      let extractedData;
      try {
        const parsed = parseTransactionExcel(finalPath, this);
        extractedData = {
          metadata: {
            bankName: 'IBK기업은행',
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
        this.warn('IBK Excel parse failed:', parseErr.message);
        extractedData = {
          metadata: {
            bankName: 'IBK기업은행',
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
      this.error('IBK getTransactions failed:', error.message);
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

function createIbkAutomator(options = {}) {
  return new IbkBankAutomator(options);
}

module.exports = {
  IbkBankAutomator,
  createIbkAutomator,
};
