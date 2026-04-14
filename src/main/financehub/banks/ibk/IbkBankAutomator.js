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
const { accountDisplayNameFromOptionText } = require('../../utils/accountOptionLabel');

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
    this.promissoryDownloadDir = path.join(this.outputDir, 'ibk-promissory-downloads');
    this.ensureOutputDirectory(this.downloadDir);
    this.ensureOutputDirectory(this.promissoryDownloadDir);
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

  async _cleanupIbkPopups() {
    const runCleanup = async (scope) => {
      try {
        await scope.evaluate(() => {
          const TARGET_IMG = 'gnb_sub_close';
          const closeSelectors = [
            `img[src*="${TARGET_IMG}"]`,
            '[title*="닫기"]',
            'button[aria-label*="닫기"]',
            '.btn-pop-close',
            '.pop_close',
            '.btn_close'
          ].join(', ');

          // Find visible targets
          const targets = Array.from(document.querySelectorAll(closeSelectors))
            .filter(el => {
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0;
            });

          targets.forEach(el => {
            (el.closest('a, button') || el).click();
          });

          // Force hide common modal containers as fallback
          const modals = document.querySelectorAll('div[role="dialog"].open, .pop-modal1.open, .popup_layer, [id*="Layer"][style*="display: block"]');
          modals.forEach(m => { 
            m.style.display = 'none'; 
            m.style.visibility = 'hidden'; 
            m.classList.remove('open');
          });
        });
      } catch (e) {}
    };

    try {
      const mf = this.page.frame({ name: 'mainframe' }) || this._mainFrame();
      if (mf) await runCleanup(mf);
      await runCleanup(this.page);
      await this.page.waitForTimeout(500);
    } catch (e) {}
  }

  async _closeIbKPopups(frame) {
    await this._cleanupIbkPopups();
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
    const dashed = t.match(/(\d{3})-(\d{2,6})-(\d{4,7})/);
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
      accounts.push({
        accountNumber,
        accountName: accountDisplayNameFromOptionText(row.text, 'IBK 기업 계좌'),
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
   * DOM helper from ibkpromissory_notes.spec.js — JS click + physical mouse for stubborn IBK menus.
   * @param {import('playwright-core').Frame} frame
   * @param {string} selector
   * @param {string|null} matchText
   * @returns {Promise<boolean>}
   */
  async _robustClickMainframe(frame, selector, matchText = null) {
    if (!this.page || !frame) return false;
    const result = await frame.evaluate(
      ([sel, text]) => {
        let el;
        if (text) {
          el = Array.from(document.querySelectorAll(sel)).find(
            (e) => e.textContent && e.textContent.includes(text),
          );
        } else {
          el = document.querySelector(sel);
        }
        if (!el) return null;
        el.scrollIntoView();
        const rect = el.getBoundingClientRect();
        ['mousedown', 'mouseup', 'click'].forEach((type) => {
          el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        });
        if (typeof el.onclick === 'function') el.onclick();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      },
      [selector, matchText],
    );
    if (result) {
      try {
        await this.page.mouse.click(result.x, result.y);
      } catch (e) {
        /* ignore */
      }
      return true;
    }
    return false;
  }

  /**
   * IBK 기업뱅킹 — 외상매출채권 (promissory notes / receivables) export.
   * Flow mirrors egdesk-scratch/ibkpromissory_notes.spec.js: 판매기업 → 외상매출채권 → 채권조회/취소신청 → 조회 → Excel save.
   * Excel parsing / DB upsert is intentionally left blank; returns saved file path and imported: 0.
   *
   * @returns {Promise<{ success: boolean, imported?: number, filePath?: string|null, error?: string, message?: string }>}
   */
  async syncPromissoryNotes() {
    if (!this.page) {
      return { success: false, error: '브라우저 페이지가 없습니다.' };
    }
    this.ensureOutputDirectory(this.promissoryDownloadDir);
    this.log('IBK: syncPromissoryNotes (외상매출채권) 시작...');

    try {
      await this._cleanupIbkPopups();

      let mainframe = this.page.frame({ name: 'mainframe' }) || this._mainFrame();
      if (!mainframe) {
        await this.page.waitForTimeout(2000);
        mainframe = this.page.frame({ name: 'mainframe' }) || this._mainFrame();
      }
      if (!mainframe) {
        return { success: false, error: 'mainframe을 찾을 수 없습니다.' };
      }

      const popupSelectors = ['button:has-text("닫기")', 'button:has-text("확인")', '.popup_close', '.btn_close'];
      for (const sel of popupSelectors) {
        try {
          const btn = mainframe.locator(sel).first();
          if (await btn.isVisible({ timeout: 800 }).catch(() => false)) await btn.click();
        } catch (e) {
          /* ignore */
        }
      }
      await this.page.waitForTimeout(500);

      // STEP 9: B2B → 판매기업 → 외상매출채권 → 채권조회/취소신청
      try {
        const b2bImg = mainframe.locator('img[alt="B2B"]').first();
        await b2bImg.hover();
        await this.page.waitForTimeout(500);
        await b2bImg.click();
      } catch (e) {
        this.warn('IBK promissory: B2B menu click optional failed:', e.message);
      }
      await this.page.waitForTimeout(2000);

      await this._robustClickMainframe(mainframe, 'a[efncmenuid="E0303000000"]');
      await this.page.waitForTimeout(1500);

      await this._robustClickMainframe(mainframe, 'a[efncmenuid="E0303040000"]');
      await this.page.waitForTimeout(1500);

      await this._robustClickMainframe(mainframe, 'a', '채권조회/취소신청');
      await this.page.waitForTimeout(3000);

      mainframe = this.page.frame({ name: 'mainframe' }) || mainframe;

      // Date range: wide default (2022-01-01 ~ 당해 연말) — includes future-dated receivables IBK may show
      const startYY = '2022';
      const startMM = '01';
      const startDD = '01';
      const now = new Date();
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      const endYY = String(endOfYear.getFullYear());
      const endMM = String(endOfYear.getMonth() + 1).padStart(2, '0');
      const endDD = String(endOfYear.getDate()).padStart(2, '0');

      try {
        await mainframe.locator('[id="inqy_sttg_ymd_yy"]').selectOption(startYY);
        await mainframe.locator('[id="inqy_sttg_ymd_mm"]').selectOption(startMM);
        await mainframe.locator('[id="inqy_sttg_ymd_dd"]').selectOption(startDD);
        await mainframe.locator('[id="inqy_eymd_yy"]').selectOption(endYY);
        await mainframe.locator('[id="inqy_eymd_mm"]').selectOption(endMM);
        await mainframe.locator('[id="inqy_eymd_dd"]').selectOption(endDD);
        this.log(`IBK promissory: date range ${startYY}-${startMM}-${startDD} ~ ${endYY}-${endMM}-${endDD}`);
      } catch (e) {
        this.warn('IBK promissory: date selects failed:', e.message);
      }
      await this.page.waitForTimeout(1000);

      const searchOk = await this._robustClickMainframe(mainframe, 'a.btn_ok', '조회');
      if (!searchOk) {
        await mainframe.locator('a:has-text("조회")').first().click({ force: true }).catch(() => {});
      }
      await this.page.waitForTimeout(4000);

      await this.focusPlaywrightPage();
      const exportStartedAt = Date.now();
      const downloadPromise = this.waitForNextDownload({ timeout: 60000 });

      await this._robustClickMainframe(mainframe, '#save_to_file');
      await this._robustClickMainframe(mainframe, 'a', '저장');
      await this.page.waitForTimeout(1500);

      await this._robustClickMainframe(mainframe, 'span', '엑셀파일저장');
      await this._robustClickMainframe(mainframe, 'a', '엑셀');
      await this.page.waitForTimeout(1500);

      await this._robustClickMainframe(mainframe, '#DownloadExcel');
      await this.page.waitForTimeout(1000);
      await this._robustClickMainframe(mainframe, '#DownloadButton');

      let download = await downloadPromise.catch(() => null);
      let suggested = 'ibk-promissory.xls';
      let fallbackFile = null;

      if (!download) {
        this.warn('IBK promissory: no download event; checking filesystem fallback...');
        fallbackFile = this.findRecentDownloadFile(
          [this.promissoryDownloadDir, this.downloadDir, path.join(this.outputDir, 'corporate-cert-downloads')],
          exportStartedAt,
        );
        if (!fallbackFile) {
          await this._cleanupIbkPopups();
          return {
            success: false,
            error: '엑셀 다운로드를 확인할 수 없습니다. 화면에서 조회 결과와 저장 버튼을 확인해 주세요.',
          };
        }
        suggested = path.basename(fallbackFile.path);
      } else {
        suggested = download.suggestedFilename() || suggested;
      }

      const ext = path.extname(suggested) || '.xls';
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const finalName = `IBK_외상매출채권_${ts}${ext}`;
      const finalPath = path.join(this.promissoryDownloadDir, finalName);

      const saved = await this.saveDownloadSafely(download, fallbackFile?.path, finalPath);
      if (!saved) {
        await this._cleanupIbkPopups();
        return { success: false, error: '다운로드 파일 저장에 실패했습니다.' };
      }

      await this._cleanupIbkPopups();

      return {
        success: true,
        imported: 0,
        filePath: finalPath,
        message: 'Download complete; IBK Excel is imported in the main process after this call.',
      };
    } catch (error) {
      this.error('IBK syncPromissoryNotes failed:', error.message);
      try {
        await this._cleanupIbkPopups();
      } catch (e) {
        /* ignore */
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * ibk.spec.js — mainframe, ecb_user_num01, inqy_sttg_ymd_* (시작), 저장 → 엑셀파일저장 → DownloadExcel → DownloadButton
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

      await this.focusPlaywrightPage();
      const exportStartedAt = Date.now();
      const downloadPromise = this.waitForNextDownload({ timeout: 60000 });
      
      // Step 1: Trigger download sequence
      try {
        await frame.locator('span:has-text("저장")').first().click({ timeout: 5000 });
        await this.page.waitForTimeout(800);
        await frame.locator('span:has-text("엑셀파일저장")').first().click({ timeout: 5000 });
        await this.page.waitForTimeout(800);
        
        // Handle radio button only if visible; it's often already checked but visually hidden
        const radio = frame.locator('[id="DownloadExcel"]');
        if (await radio.isVisible({ timeout: 1000 }).catch(() => false)) {
          await radio.click({ timeout: 2000 }).catch(() => {});
        }
        
        await this.page.waitForTimeout(400);
        await frame.locator('[id="DownloadButton"]').click({ timeout: 5000 });
      } catch (e) {
        this.warn('IBK: Error during download click sequence, will check for fallback anyway:', e.message);
      }

      // Step 2: Race download vs "No Data" message vs Timeout (shortened for faster failure/fallback)
      const raced = await Promise.race([
        downloadPromise.then((dl) => ({ type: 'download', data: dl })),
        this.page.waitForTimeout(15000).then(() => ({ type: 'timeout' })),
        frame.evaluate(() => {
          return new Promise((resolve) => {
            const check = () => {
              const checkPhrases = ['저장할 데이터가 없습니다', '조회된 데이터가 없습니다'];
              const allElements = Array.from(document.querySelectorAll('body *'));
              const found = allElements.some(el => {
                const style = window.getComputedStyle(el);
                const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0;
                return isVisible && checkPhrases.some(phrase => (el.textContent || '').includes(phrase));
              });
              if (found) resolve({ type: 'nodata' });
              else setTimeout(check, 500);
            };
            check();
          });
        }),
      ]).catch(() => ({ type: 'timeout' }));

      let download = null;
      let suggested = 'ibk-export.xls';
      let fallbackFile = null;

      if (raced.type === 'nodata') {
        this.log('IBK: confirmed no data to export via popup/message');
        try {
          await frame.locator('button:has-text("확인")').first().click({ timeout: 3000 }).catch(() => {});
        } catch (e) {}
        return [];
      }

      if (raced.type === 'timeout' || !raced.type) {
        this.warn('IBK: download event timed out or error occurred, checking file system fallback...');
        fallbackFile = this.findRecentDownloadFile(
          [this.downloadDir, path.join(this.outputDir, 'corporate-cert-downloads')],
          exportStartedAt
        );
        if (!fallbackFile) {
          this.error('IBK: No download event and no fallback file found.');
          return [];
        }
        suggested = path.basename(fallbackFile.path);
      } else {
        download = raced.data;
        suggested = download.suggestedFilename() || suggested;
      }

      const ext = path.extname(suggested) || '.xls';
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safeAcc = this._sanitizeIbkFilenamePart(accountNumber);
      const finalName = `IBK기업_${safeAcc}_${ts}${ext}`;
      const finalPath = path.join(this.downloadDir, finalName);
      
      const saved = await this.saveDownloadSafely(download, fallbackFile?.path, finalPath);
      if (!saved) {
        throw new Error('Failed to save IBK export file via all methods');
      }

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
      
      // Clean up popups regardless of what happened
      await this._cleanupIbkPopups();

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
      await this._cleanupIbkPopups(); // Always cleanup on fail too
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
