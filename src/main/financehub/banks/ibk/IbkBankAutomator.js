const path = require('path');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { parseTransactionExcel } = require('../../utils/transactionParser');
const { isWindows, waitForNativeCertificateDialogWindow, focusCertElement } = require('../../utils/windows-uia-native');
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
      this._ibkCertWindowClass = uia.matchedClass;
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

      // [개선] 직접 포커스 시도
      this.log(`[IBK] 인증서 입력창 직접 포커스 시도 (${this._ibkCertWindowClass})...`);
      const focusResult = focusCertElement(this._ibkCertWindowClass, 'passwordFrame');
      
      if (!focusResult.ok) {
        throw new Error(`인증서 입력창 포커스 실패: ${focusResult.error}`);
      }
      this.log(`   ✅ 포커스 성공! (${focusResult.method})`);

      // TAB 단계 및 비밀번호 입력 전의 ENTER 단계를 제외한 입력 스텝 준비
      const pwIndex = IBK_NATIVE_CERT_STEPS.findIndex(s => s.type === 'password');
      const inputSteps = IBK_NATIVE_CERT_STEPS.filter((s, idx) => {
        if (s.key === 'TAB') return false;
        if (s.key === 'ENTER' && idx < pwIndex) return false;
        return true;
      });

      await runNativeCertArduinoSteps(
        this._arduinoHid,
        this.page,
        certificatePassword,
        inputSteps,
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
    const match = t.match(/([\d-]{10,22})/);
    if (match) {
      const parsed = match[1];
      if (parsed.includes('-')) return parsed;
      const digits = parsed.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 16) {
        if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
        if (digits.length === 14) return `${digits.slice(0, 3)}-${digits.slice(3, 9)}-${digits.slice(9, 11)}-${digits.slice(11)}`;
        return digits;
      }
    }
    const v = String(value || '').replace(/\D/g, '');
    if (v.length >= 10 && v.length <= 16) {
      if (v.length === 13) return `${v.slice(0, 6)}-${v.slice(6, 8)}-${v.slice(8)}`;
      if (v.length === 14) return `${v.slice(0, 3)}-${v.slice(3, 9)}-${v.slice(9, 11)}-${v.slice(11)}`;
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
        await mainframe.evaluate(({ sy, sm, sd, ey, em, ed }) => {
          const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
              el.value = val;
              el.dispatchEvent(new Event('change', { bubbles: true }));
              if (typeof el.onchange === 'function') el.onchange();
              return true;
            }
            return false;
          };
          setVal('inqy_sttg_ymd_yy', sy);
          setVal('inqy_sttg_ymd_mm', sm);
          setVal('inqy_sttg_ymd_dd', sd);
          setVal('inqy_eymd_yy', ey);
          setVal('inqy_eymd_mm', em);
          setVal('inqy_eymd_dd', ed);
        }, { sy: startYY, sm: startMM, sd: startDD, ey: endYY, em: endMM, ed: endDD });
        this.log(`IBK promissory: date range set via evaluate (${startYY}-${startMM}-${startDD} ~ ${endYY}-${endMM}-${endDD})`);
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

  // ============================================================================
  // IBK 대출 → 대출조회 → 대출계좌조회 → 거래내역조회 (per-account)
  // Recording: output/browser-recorder-tests/ibk-대출거래.spec.js
  // ============================================================================

  /**
   * Default = last 12 months: today minus 365 days → today.
   */
  _ibkDefaultLoanDateRange() {
    const now = new Date();
    const back = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
    const fmt = (d) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return { startDate: fmt(back), endDate: fmt(now) };
  }

  /**
   * Navigate top-nav 뱅킹업무 → sidebar 대출 → 대출조회 → 거래내역조회.
   * (Recording: output/browser-recorder-tests/egdesk-browser-recorder-2026-05-08T00-27-25-139Z.spec.js)
   *
   * Lands directly on the loan-transaction inquiry page with the #gnrl_lf_acno
   * account dropdown — no need to drill 대출계좌조회 → row pick → toolbar.
   */
  async _navigateIbkToLoanInquiry(mainframe) {
    // 1) Top-nav: 뱅킹업무
    const bankingCandidates = [
      () => mainframe.locator('img[alt="뱅킹업무"]').first(),
      () => mainframe.locator('a[title="뱅킹업무"]').first(),
      () => mainframe.locator('a').filter({ hasText: /^뱅킹업무$/ }).first(),
      () => mainframe.locator('xpath=/html/body/div[10]/div[1]/div[4]/div/ul/li[3]/a/img').first(),
    ];
    let bankingClicked = false;
    for (const get of bankingCandidates) {
      try {
        const el = get();
        const visible = await el.isVisible({ timeout: 1500 }).catch(() => false);
        if (!visible) continue;
        await el.hover({ force: true }).catch(() => {});
        await this.page.waitForTimeout(400);
        await el.click({ force: true });
        bankingClicked = true;
        this.log('[IBK loan] 뱅킹업무 top-nav clicked');
        break;
      } catch (e) {
        this.warn(`[IBK loan] 뱅킹업무 candidate failed: ${e.message}`);
      }
    }
    if (!bankingClicked) this.warn('[IBK loan] could not click 뱅킹업무');
    await this.page.waitForTimeout(2000);

    // 2) 대출 (efncmenuid="E0600000000", confirmed in user log)
    let ok = await this._robustClickMainframe(mainframe, 'a[efncmenuid="E0600000000"]');
    if (!ok) {
      ok = await mainframe.evaluate(() => {
        const cand = Array.from(document.querySelectorAll('a[efncmenuid^="E06"]')).find(
          (a) => (a.textContent || '').trim() === '대출',
        );
        if (!cand) return false;
        cand.scrollIntoView();
        ['mousedown', 'mouseup', 'click'].forEach((t) =>
          cand.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })),
        );
        if (typeof cand.onclick === 'function') cand.onclick();
        return true;
      });
    }
    if (!ok) throw new Error('대출 sidebar item not found');
    await this.page.waitForTimeout(1500);
    await this.page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    mainframe = this.page.frame({ name: 'mainframe' }) || mainframe;

    // 3) 대출조회
    ok = await mainframe.evaluate(() => {
      const cand = Array.from(document.querySelectorAll('a[efncmenuid^="E06"]')).find(
        (a) => (a.textContent || '').trim() === '대출조회',
      );
      if (!cand) return false;
      cand.scrollIntoView();
      ['mousedown', 'mouseup', 'click'].forEach((t) =>
        cand.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })),
      );
      if (typeof cand.onclick === 'function') cand.onclick();
      return true;
    });
    if (!ok) throw new Error('대출조회 sidebar item not found');
    await this.page.waitForTimeout(1500);
    mainframe = this.page.frame({ name: 'mainframe' }) || mainframe;

    // 4) 거래내역조회 — sibling of 대출계좌조회 under 대출조회.
    ok = await mainframe.evaluate(() => {
      // Prefer one whose efncmenuid starts with E06 (loan-section IDs); exact text match.
      const all = Array.from(document.querySelectorAll('a[efncmenuid^="E06"]')).filter(
        (a) => (a.textContent || '').trim() === '거래내역조회',
      );
      const cand = all[0];
      if (!cand) return false;
      cand.scrollIntoView();
      ['mousedown', 'mouseup', 'click'].forEach((t) =>
        cand.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })),
      );
      if (typeof cand.onclick === 'function') cand.onclick();
      return true;
    });
    if (!ok) throw new Error('거래내역조회 sidebar item not found');
    this.log('[IBK loan] sidebar 거래내역조회 clicked');
    await this.page.waitForTimeout(3000);
  }

  /**
   * Poll for the loan-account dropdown on the inquiry page. Tries the known id
   * `#gnrl_lf_acno` first; falls back to the generic finder.
   */
  async _waitForIbkLoanAccountDropdown(mainframe, { maxWaitMs = 20000, pollMs = 1000 } = {}) {
    const deadline = Date.now() + maxWaitMs;
    let attempt = 0;
    while (Date.now() < deadline) {
      attempt++;
      const byId = await mainframe.evaluate(() => {
        const sel = document.getElementById('gnrl_lf_acno');
        if (!sel || sel.tagName !== 'SELECT' || sel.options.length === 0) return null;
        return {
          id: sel.id,
          name: sel.name,
          matchedCount: sel.options.length,
          options: Array.from(sel.options).map((opt) => ({
            value: opt.value || '',
            text: (opt.text || '').trim(),
          })),
        };
      });
      if (byId && byId.options.length > 0) {
        this.log(`[IBK loan] #gnrl_lf_acno found after ${attempt} attempt(s) with ${byId.options.length} options`);
        return byId;
      }
      // Generic fallback (any select with account-format options)
      const generic = await this._findIbkLoanAccountDropdown(mainframe);
      if (generic && generic.options.length > 0) {
        this.log(`[IBK loan] generic dropdown found after ${attempt} attempt(s): id="${generic.id}"`);
        return generic;
      }
      await this.page.waitForTimeout(pollMs);
    }
    return null;
  }

  /**
   * Legacy: navigate via 대출계좌조회. Kept as a fallback if the direct
   * 거래내역조회 path ever stops working.
   */
  async _navigateIbkToLoanAccountList(mainframe) {
    // 1) Top-nav: 뱅킹업무 icon. Try alt-text first, then a text/title match,
    //    then fall back to the recording's positional xpath (li[3] under the
    //    top-nav <ul>).
    const bankingCandidates = [
      () => mainframe.locator('img[alt="뱅킹업무"]').first(),
      () => mainframe.locator('a[title="뱅킹업무"]').first(),
      () => mainframe.locator('a').filter({ hasText: /^뱅킹업무$/ }).first(),
      () => mainframe.locator('xpath=/html/body/div[10]/div[1]/div[4]/div/ul/li[3]/a/img').first(),
    ];
    let bankingClicked = false;
    for (const get of bankingCandidates) {
      try {
        const el = get();
        const visible = await el.isVisible({ timeout: 1500 }).catch(() => false);
        if (!visible) continue;
        await el.hover({ force: true }).catch(() => {});
        await this.page.waitForTimeout(400);
        await el.click({ force: true });
        bankingClicked = true;
        this.log('[IBK loan] 뱅킹업무 top-nav clicked');
        break;
      } catch (e) {
        this.warn(`[IBK loan] 뱅킹업무 candidate failed: ${e.message}`);
      }
    }
    if (!bankingClicked) {
      this.warn('[IBK loan] could not click 뱅킹업무 — sidebar may not populate, but trying anyway');
    }
    await this.page.waitForTimeout(2000);

    // 2) Sidebar drill via _robustClickMainframe (JS-dispatched click, bypasses
    //    Playwright's visibility check — same pattern as syncPromissoryNotes).
    //    Menu IDs come from the user's diagnostic log:
    //      대출       → efncmenuid="E0600000000" (menulvlvl=2)
    //      대출조회   → efncmenuid="E0601000000" (menulvlvl=3, inferred from siblings)
    //      대출계좌조회 → efncmenuid="E0601010000" (menulvlvl=4, confirmed)

    let ok = await this._robustClickMainframe(mainframe, 'a[efncmenuid="E0600000000"]');
    if (!ok) {
      this.warn('[IBK loan] 대출 not found by efncmenuid — trying exact-text fallback');
      ok = await mainframe.evaluate(() => {
        const cand = Array.from(document.querySelectorAll('a[efncmenuid^="E06"]')).find(
          (a) => (a.textContent || '').trim() === '대출',
        );
        if (!cand) return false;
        cand.scrollIntoView();
        ['mousedown', 'mouseup', 'click'].forEach((t) =>
          cand.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })),
        );
        if (typeof cand.onclick === 'function') cand.onclick();
        return true;
      });
    }
    if (!ok) throw new Error('대출 sidebar item not found');
    await this.page.waitForTimeout(1500);

    // 대출 click navigates the frame; let it settle before looking for the next item.
    await this.page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    mainframe = this.page.frame({ name: 'mainframe' }) || mainframe;

    ok = await this._robustClickMainframe(mainframe, 'a[efncmenuid="E0601000000"]');
    if (!ok) {
      this.warn('[IBK loan] 대출조회 not found by efncmenuid — trying broad-text fallback');
      const result = await mainframe.evaluate(() => {
        // Cast a wide net: any element whose trimmed text is exactly "대출조회".
        // Then walk up to the nearest <a> for the actual click target (recording
        // showed the visible text often lives inside a <span> inside the <a>).
        const all = Array.from(document.querySelectorAll('a, span, li, button, div'));
        const matches = all.filter((el) => (el.textContent || '').trim() === '대출조회');
        const anchor =
          matches.find((el) => el.tagName === 'A') ||
          matches.map((el) => el.closest && el.closest('a')).find((a) => !!a);

        // Always return diagnostic info so the warn log can show what we saw.
        const diag = matches.slice(0, 5).map((el) => ({
          tag: el.tagName,
          efncmenuid: el.getAttribute && el.getAttribute('efncmenuid'),
          parentTag: el.parentElement && el.parentElement.tagName,
          parentEfncmenuid: el.parentElement && el.parentElement.getAttribute
            ? el.parentElement.getAttribute('efncmenuid')
            : null,
        }));

        if (!anchor) {
          // Also dump up to 8 anchors with efncmenuid starting with E06 so we can
          // see what loan-related items are actually in the DOM.
          const e06 = Array.from(document.querySelectorAll('a[efncmenuid^="E06"]'))
            .slice(0, 12)
            .map((a) => ({
              efncmenuid: a.getAttribute('efncmenuid'),
              text: (a.textContent || '').trim().slice(0, 40),
              menulvl: a.getAttribute('menulvlvl'),
            }));
          return { ok: false, matchCount: matches.length, matches: diag, e06 };
        }

        anchor.scrollIntoView();
        ['mousedown', 'mouseup', 'click'].forEach((t) =>
          anchor.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })),
        );
        if (typeof anchor.onclick === 'function') anchor.onclick();
        return { ok: true, matchCount: matches.length, matches: diag };
      });
      if (result && result.ok) {
        ok = true;
      } else {
        this.warn(
          `[IBK loan] 대출조회 fallback diagnostic: matchCount=${result?.matchCount}, matches=${JSON.stringify(result?.matches)}, e06=${JSON.stringify(result?.e06)}`,
        );
      }
    }
    if (!ok) throw new Error('대출조회 sidebar item not found');
    await this.page.waitForTimeout(1500);

    ok = await this._robustClickMainframe(mainframe, 'a[efncmenuid="E0601010000"]');
    if (!ok) {
      this.warn('[IBK loan] 대출계좌조회 not found by efncmenuid — trying exact-text fallback');
      ok = await this._robustClickMainframe(mainframe, 'a', '대출계좌조회');
    }
    if (!ok) throw new Error('대출계좌조회 sidebar item not found');
    await this.page.waitForTimeout(2500);
  }

  /**
   * Read the loan-account list table and return one record per row.
   * Each row's account_number is the cell that matches an IBK loan-account number
   * pattern; extra cells go into `cellTexts` for diagnostics.
   */
  /**
   * Poll the page until the loan-account table populates. The data grid loads
   * asynchronously after navigating to 대출계좌조회 — a single read right after
   * the menu click usually finds an empty grid.
   */
  async _readIbkLoanAccountRows(mainframe, { maxWaitMs = 20000, pollMs = 1500 } = {}) {
    const deadline = Date.now() + maxWaitMs;
    let attempt = 0;
    let lastResult = null;
    while (Date.now() < deadline) {
      attempt++;
      lastResult = await this._scanIbkLoanAccountTables(mainframe);
      if (lastResult.rows.length > 0) {
        this.log(
          `IBK loan: discovered ${lastResult.rows.length} loan account row(s) after ${attempt} attempt(s) (table index=${lastResult.chosenTable})`,
        );
        return lastResult.rows;
      }
      await this.page.waitForTimeout(pollMs);
    }
    this.warn(
      `[IBK loan] timed out (${maxWaitMs}ms, ${attempt} attempts) waiting for loan-account table. Diagnostic:`,
    );
    if (lastResult && lastResult.summaries) {
      for (const s of lastResult.summaries) {
        this.warn(
          `  table[${s.tableIndex}] rows=${s.rowCount} matched=${s.matchedRows} parents=${JSON.stringify(s.parentChain)} sample=${JSON.stringify(s.sampleFirst3Rows)}`,
        );
      }
    }
    return (lastResult && lastResult.rows) || [];
  }

  /**
   * Pure scan — no logging, no waiting. Used by `_readIbkLoanAccountRows`.
   */
  async _scanIbkLoanAccountTables(mainframe) {
    return await mainframe.evaluate(() => {
      // Per-row account detection — prefer hyphenated forms over bare digits.
      // Iterate patterns from most-specific to least, scanning all cells per pattern
      // before moving to the next one. This way "306-063568-04-036" wins over a
      // bare 14-digit blob that may appear in another column (customer id, etc.).
      const findAccountInRow = (texts) => {
        const hyphenPatterns = [
          /\d{3}-\d{2,6}-\d{2,4}-\d{1,4}/,
          /\d{2,4}-\d{4,8}-\d{2,4}/,
          /\d{3}-\d{6,10}/,
        ];
        for (const re of hyphenPatterns) {
          for (const tx of texts) {
            const m = String(tx || '').match(re);
            if (m) return m[0];
          }
        }
        // Last resort: bare 10–14 digit number.
        for (const tx of texts) {
          const m = String(tx || '').match(/\b\d{10,14}\b/);
          if (m) return m[0];
        }
        return null;
      };

      const tables = Array.from(document.querySelectorAll('table'));
      const tableSummaries = [];
      const allFound = [];

      for (let ti = 0; ti < tables.length; ti++) {
        const t = tables[ti];
        // tbody tr OR direct tr (some IBK grid widgets omit tbody)
        const trs = Array.from(t.querySelectorAll(':scope > tbody > tr, :scope > tr'));
        if (trs.length === 0) continue;

        const rowsHere = [];
        const sampleCells = [];
        for (let i = 0; i < trs.length; i++) {
          const tds = Array.from(trs[i].querySelectorAll(':scope > td'));
          const texts = tds.map((td) => (td.textContent || '').trim().replace(/\s+/g, ' '));
          if (i < 3) sampleCells.push(texts.slice(0, 12).map((s) => s.slice(0, 40)));
          const acc = findAccountInRow(texts);
          if (acc) {
            rowsHere.push({ rowIndex: i, accountNumber: acc, cellTexts: texts });
          }
        }

        const parentChain = (() => {
          const chain = [];
          let p = t.parentElement;
          for (let n = 0; n < 5 && p; n++) {
            chain.push(`${p.tagName}.${typeof p.className === 'string' ? p.className.slice(0, 30) : ''}`);
            p = p.parentElement;
          }
          return chain;
        })();

        tableSummaries.push({
          tableIndex: ti,
          rowCount: trs.length,
          matchedRows: rowsHere.length,
          sampleFirst3Rows: sampleCells,
          parentChain,
        });

        if (rowsHere.length > 0) allFound.push({ tableIndex: ti, rows: rowsHere });
      }

      allFound.sort((a, b) => b.rows.length - a.rows.length);
      const best = allFound[0];
      return {
        rows: best ? best.rows : [],
        chosenTable: best ? best.tableIndex : null,
        totalTables: tables.length,
        summaries: tableSummaries.slice(0, 12),
      };
    });
  }

  /**
   * Close the IBK download popup by JS-dispatching click on the recording's
   * exact target. The popup renders "a bit at the top" (partial render) so
   * Playwright's visibility/click flow rejects it. JS dispatch fires the
   * onclick handler regardless of element render state.
   *
   * Tries BOTH the mainframe document and the outer page — the recording
   * captured the click event in both contexts, so the popup likely lives in
   * mainframe (where most IBK content does).
   *
   * Recording xpath: body/div[1]/div/div/div[6]/.../button/img
   * @returns {Promise<{ok: boolean, target?: string, dump?: any}>}
   */
  async _closeIbkLoanDownloadPopupViaRecording() {
    if (!this.page || this.page.isClosed()) return { ok: false };

    // The evaluate body is identical for mainframe and page; this is the script.
    const closerScript = () => {
      const fireClick = (el) => {
        if (!el) return false;
        try {
          el.scrollIntoView();
        } catch (_) {}
        ['mousedown', 'mouseup', 'click'].forEach((t) =>
          el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })),
        );
        if (typeof el.onclick === 'function') {
          try { el.onclick(); } catch (_) {}
        }
        return true;
      };
      const xpathFind = (xp) => {
        try {
          const r = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          return r.singleNodeValue;
        } catch (_) {
          return null;
        }
      };

      // Strategy 1: recording xpath — try both BUTTON and its IMG child
      const btn = xpathFind('/html/body/div[1]/div/div/div[6]/div/div/div/div/div[1]/div[2]/button');
      const img = xpathFind('/html/body/div[1]/div/div/div[6]/div/div/div/div/div[1]/div[2]/button/img');
      if (btn) {
        fireClick(btn);
        if (img) fireClick(img);
        return { ok: true, target: 'recording-xpath' };
      }

      // Strategy 2: ANY button with an img child whose src/alt looks close-ish.
      const buttonsWithImg = Array.from(document.querySelectorAll('button')).filter(
        (b) => b.querySelector('img') !== null,
      );
      for (const b of buttonsWithImg) {
        const im = b.querySelector('img');
        const src = (im?.getAttribute('src') || '').toLowerCase();
        const alt = (im?.getAttribute('alt') || '').toLowerCase();
        if (
          /close|btn_x|btn-x|btn_close|x_icon|gnb_sub_close|pop.*close/.test(src) ||
          /닫기|close/.test(alt)
        ) {
          fireClick(b);
          fireClick(im);
          return { ok: true, target: `icon-heuristic src="${src}" alt="${alt}"` };
        }
      }

      // Diagnostic dump.
      const dumps = buttonsWithImg.slice(0, 10).map((b) => {
        const im = b.querySelector('img');
        const r = b.getBoundingClientRect();
        return {
          cls: typeof b.className === 'string' ? b.className.slice(0, 40) : '',
          oc: (b.getAttribute('onclick') || '').slice(0, 60),
          src: im?.getAttribute('src') || '',
          alt: im?.getAttribute('alt') || '',
          rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        };
      });
      // Also dump body's first-child structure so we can see if recording xpath
      // is just one level off.
      const bodyDump = (() => {
        const root = document.body && document.body.children[0];
        if (!root) return null;
        const path = [];
        let n = root;
        for (let depth = 0; depth < 6 && n; depth++) {
          path.push(`${n.tagName}.${typeof n.className === 'string' ? n.className.slice(0, 20) : ''}#${n.id || ''}[${n.children.length}ch]`);
          n = n.children[0];
        }
        return path;
      })();
      return {
        ok: false,
        dump: {
          context: 'unknown',
          totalButtons: document.querySelectorAll('button').length,
          buttonsWithImg: buttonsWithImg.length,
          samples: dumps,
          bodyChain: bodyDump,
        },
      };
    };

    // The IBK page is an old-school <frameset> (not a single iframe). The popup
    // could live in ANY frame, not just `mainframe`. Try every frame on every
    // page in this context.
    const allTargets = [];
    try {
      const pages = this.context ? this.context.pages() : [this.page];
      for (let pi = 0; pi < pages.length; pi++) {
        const p = pages[pi];
        if (!p || p.isClosed()) continue;
        // The page itself
        allTargets.push({ kind: 'page', label: `page[${pi}]`, ctx: p });
        // Each frame in the page
        for (const f of p.frames()) {
          allTargets.push({ kind: 'frame', label: `page[${pi}].frame[name=${f.name()}]`, ctx: f });
        }
      }
    } catch (e) {
      this.warn(`[IBK loan] context enumeration failed: ${e.message}`);
    }

    const allDiags = [];
    for (const t of allTargets) {
      try {
        const r = await t.ctx.evaluate(closerScript);
        if (r && r.ok) {
          this.log(`[IBK loan] popup closed in ${t.label} via ${r.target}`);
          return r;
        }
        if (r && r.dump && (r.dump.totalButtons > 0 || r.dump.buttonsWithImg > 0)) {
          // Only collect diagnostics from contexts that actually have content
          allDiags.push({ label: t.label, ...r.dump });
        }
      } catch (e) {
        // Some frames are cross-origin or detached — skip silently
      }
    }

    if (allDiags.length === 0) {
      this.warn(`[IBK loan] popup close failed — no frame had any buttons. Searched ${allTargets.length} contexts.`);
    } else {
      this.warn(`[IBK loan] popup close failed in all contexts. Diags from non-empty frames: ${JSON.stringify(allDiags)}`);
    }
    return { ok: false };
  }

  /**
   * Aggressive popup-closer for the IBK loan-flow download popup.
   *
   * The IBK download popup lives on the OUTER page at body > div:nth-child(1)
   * (recording xpath: /html/body/div[1]/div/div/div[6]/.../button/img). It
   * doesn't always have the close-classes _cleanupIbkPopups checks for, so:
   *   1. Find any visible element that looks like a popup container under body[0]
   *   2. Click EVERY visible <button> / clickable img inside it
   *   3. Try common close-handler JS (window.close, popup.close, etc.)
   *   4. Dump the container HTML so we can refine
   *
   * @param {string} acct For logging context only
   */
  async _closeIbkLoanDownloadPopupAggressive(acct) {
    if (!this.page || this.page.isClosed()) return;
    try {
      const result = await this.page.evaluate(() => {
        // The popup container is body > div:nth-child(1) > div > div (>div[6]).
        // We scan all body children and find any with a visible nested popup.
        const isVisible = (el) =>
          el && (el.offsetParent || el.getClientRects().length > 0);

        // Candidate popup containers: anything at body[0] subtree that has a
        // visible nested <button> with an <img> child.
        const findPopupContainers = () => {
          const out = [];
          const root = document.body && document.body.children[0];
          if (!root) return out;
          const all = Array.from(root.querySelectorAll('div'));
          for (const d of all) {
            if (!isVisible(d)) continue;
            const buttons = Array.from(d.querySelectorAll('button')).filter(isVisible);
            const hasImgBtn = buttons.some((b) => b.querySelector('img'));
            const isSmall = d.offsetWidth > 0 && d.offsetWidth < 1200;
            if (hasImgBtn && isSmall) {
              out.push({ container: d, buttonCount: buttons.length });
            }
          }
          return out;
        };

        const containers = findPopupContainers();
        const before = containers.length;
        let totalClicked = 0;
        const dumps = [];

        for (const { container } of containers) {
          // Click every visible button inside this container
          const buttons = Array.from(container.querySelectorAll('button')).filter(isVisible);
          for (const b of buttons) {
            try {
              b.click();
              totalClicked++;
            } catch (e) {}
          }
          // Also click anchors with onclick
          const anchors = Array.from(container.querySelectorAll('a[onclick]')).filter(isVisible);
          for (const a of anchors) {
            try {
              a.click();
              totalClicked++;
            } catch (e) {}
          }

          // If still visible, dump structure for diagnosis
          if (isVisible(container)) {
            const dump = {
              tag: container.tagName,
              id: container.id,
              cls: typeof container.className === 'string' ? container.className.slice(0, 80) : '',
              size: `${container.offsetWidth}x${container.offsetHeight}`,
              buttons: Array.from(container.querySelectorAll('button')).slice(0, 8).map((b) => ({
                text: (b.textContent || '').trim().slice(0, 30),
                cls: typeof b.className === 'string' ? b.className.slice(0, 40) : '',
                onclick: (b.getAttribute('onclick') || '').slice(0, 60),
                imgSrc: b.querySelector('img')?.getAttribute('src') || '',
                imgAlt: b.querySelector('img')?.getAttribute('alt') || '',
              })),
            };
            dumps.push(dump);
            // Last-resort force-hide
            container.style.display = 'none';
            container.setAttribute('aria-hidden', 'true');
          }
        }

        return { containersFound: before, totalClicked, dumps };
      });

      if (result.containersFound === 0) {
        // Nothing to do — popup wasn't there
        return;
      }
      this.log(
        `[IBK loan] aggressive popup close (acct=${acct}): containers=${result.containersFound}, clicks=${result.totalClicked}`,
      );
      if (result.dumps && result.dumps.length > 0) {
        this.warn(
          `[IBK loan] popup container(s) still visible after clicks. Dump: ${JSON.stringify(result.dumps)}`,
        );
      }
    } catch (e) {
      this.warn(`[IBK loan] aggressive popup close threw: ${e.message}`);
    }
  }

  /**
   * Close the IBK Excel-download popup that appears after the download finishes.
   *
   * IMPORTANT: this popup lives on the OUTER `page`, NOT inside `mainframe`.
   * That's why `_cleanupIbkPopups` (mainframe-scoped) doesn't dismiss it.
   *
   * Recording xpath: /html/body/div[1]/div/div/div[6]/.../button/img
   * The clickable target is the parent <button>, not the <img>.
   */
  async _closeIbkDownloadPopup() {
    if (!this.page || this.page.isClosed()) return;

    // Strategy 1: recording's exact xpath for the close <button>.
    try {
      const btn = this.page.locator(
        'xpath=/html/body/div[1]/div/div/div[6]/div/div/div/div/div[1]/div[2]/button',
      );
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        await btn.click({ force: true, timeout: 2000 });
        this.log('[IBK loan] download popup closed (xpath)');
        return;
      }
    } catch (_) {
      /* fall through */
    }

    // Strategy 2: any visible <button> on the outer page whose <img> child has
    // a close-ish src/alt. The IBK download popup uses an icon button (no text).
    try {
      const closed = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        for (const b of buttons) {
          if (!(b.offsetParent || b.getClientRects().length)) continue;
          const img = b.querySelector('img');
          if (!img) continue;
          const src = (img.getAttribute('src') || '').toLowerCase();
          const alt = (img.getAttribute('alt') || '').toLowerCase();
          if (
            /close|btn_x|btn-x|btn_close|x_icon|gnb_sub_close/.test(src) ||
            /닫기|close/.test(alt)
          ) {
            b.click();
            return true;
          }
        }
        return false;
      });
      if (closed) {
        this.log('[IBK loan] download popup closed (icon heuristic)');
        return;
      }
    } catch (_) {
      /* swallow */
    }

    this.warn('[IBK loan] could not close download popup (xpath+icon both missed)');
  }

  /**
   * Click td[4] (the checkbox cell) of the given row in the loan-account table,
   * via JS-dispatched mouse events. Re-resolves the table the same way the
   * scanner does, so we click the exact same row that was enumerated.
   * Returns true if the click landed.
   */
  async _clickIbkLoanAccountRow(mainframe, rowIndex) {
    return await mainframe.evaluate((idx) => {
      const findTable = () => {
        const tables = Array.from(document.querySelectorAll('table'));
        let best = null;
        let bestMatched = 0;
        const hyphen = /\d{3}-\d{2,6}-\d{2,4}-\d{1,4}|\d{2,4}-\d{4,8}-\d{2,4}/;
        const bare = /\b\d{10,14}\b/;
        for (const t of tables) {
          const trs = Array.from(t.querySelectorAll(':scope > tbody > tr, :scope > tr'));
          let matched = 0;
          for (const tr of trs) {
            const tds = Array.from(tr.querySelectorAll(':scope > td'));
            const all = tds.map((td) => (td.textContent || '').trim()).join(' ');
            if (hyphen.test(all) || bare.test(all)) matched++;
          }
          if (matched > bestMatched) {
            bestMatched = matched;
            best = t;
          }
        }
        return best;
      };
      const table = findTable();
      if (!table) return false;
      const trs = Array.from(table.querySelectorAll(':scope > tbody > tr, :scope > tr'));
      const tr = trs[idx];
      if (!tr) return false;
      const tds = Array.from(tr.querySelectorAll(':scope > td'));
      // td[4] in the recording = index 3 zero-based (the checkbox cell). Fall
      // back to td[0] then to <tr> if the table layout differs.
      const target = tds[3] || tds[0] || tr;
      target.scrollIntoView();
      ['mousedown', 'mouseup', 'click'].forEach((t) =>
        target.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })),
      );
      if (typeof target.onclick === 'function') target.onclick();
      // Also tick any checkbox inside the row (some grids use real <input>s).
      const cb = tr.querySelector('input[type="checkbox"]');
      if (cb && !cb.checked) {
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    }, rowIndex);
  }

  /**
   * Find the account-selector <select> on the inquiry page. Looks for the
   * <select> whose options contain account-number-format strings; that's the
   * "switch which account I'm querying" dropdown we use to iterate.
   */
  async _findIbkLoanAccountDropdown(mainframe) {
    return await mainframe.evaluate(() => {
      const accountRe = /\d{3}-\d{2,6}-\d{2,4}-\d{1,4}|\d{2,4}-\d{4,8}-\d{2,4}|\b\d{10,14}\b/;
      const selects = Array.from(document.querySelectorAll('select'));
      let bestSelect = null;
      let bestMatched = 0;
      for (const s of selects) {
        let matched = 0;
        for (const opt of s.options) {
          const blob = `${opt.text || ''} ${opt.value || ''}`;
          if (accountRe.test(blob)) matched++;
        }
        if (matched > bestMatched) {
          bestMatched = matched;
          bestSelect = s;
        }
      }
      if (!bestSelect) return null;
      return {
        id: bestSelect.id,
        name: bestSelect.name,
        matchedCount: bestMatched,
        options: Array.from(bestSelect.options).map((opt) => ({
          value: opt.value || '',
          text: (opt.text || '').trim(),
        })),
      };
    });
  }

  /**
   * Pull the hyphenated (preferred) or bare-digit account number out of a
   * dropdown option's text/value.
   *
   * Last segment widened to 1-6 digits — IBK loan accounts like
   * "922-001568-32-00169" have 5-digit suffixes, and the prior 1-4 cap was
   * silently truncating them (00169 → 0016), causing dropdown options to
   * collide on the same DB account_number.
   */
  _extractAccountFromText(text) {
    const t = String(text || '');
    const m1 = t.match(/\d{3}-\d{2,6}-\d{2,4}-\d{1,6}/);
    if (m1) return m1[0];
    const m2 = t.match(/\d{2,4}-\d{4,8}-\d{2,6}/);
    if (m2) return m2[0];
    const m3 = t.match(/\b\d{10,16}\b/);
    if (m3) return m3[0];
    return null;
  }

  /**
   * Drive a date select trio (yy/mm/dd) for either start or end side.
   */
  async _setIbkLoanDate(mainframe, side, parts) {
    const idYY = side === 'start' ? 'inqy_sttg_ymd_yy' : 'inqy_eymd_yy';
    const idMM = side === 'start' ? 'inqy_sttg_ymd_mm' : 'inqy_eymd_mm';
    const idDD = side === 'start' ? 'inqy_sttg_ymd_dd' : 'inqy_eymd_dd';
    await mainframe.locator(`[id="${idYY}"]`).selectOption(parts.yyyy).catch(() => {});
    await mainframe.locator(`[id="${idMM}"]`).selectOption(parts.mm).catch(() => {});
    await mainframe.locator(`[id="${idDD}"]`).selectOption(parts.dd).catch(() => {});
  }

  _parseYmdParts(input) {
    const d = String(input || '').replace(/\D/g, '');
    if (d.length < 8) throw new Error(`Invalid date: ${input}`);
    return { yyyy: d.slice(0, 4), mm: d.slice(4, 6), dd: d.slice(6, 8) };
  }

  /**
   * Driver: walk every loan account row, run 거래내역조회, download or skip on
   * "조회결과가 없습니다", import each Excel into `ibk_loan_transactions`.
   *
   * Returns aggregate counts; per-account warnings/errors are logged.
   */
  async syncLoanTransactions(opts = {}) {
    if (!this.page) return { success: false, error: '브라우저 페이지가 없습니다.' };
    this.ensureOutputDirectory(this.downloadDir);

    let { startDate, endDate } =
      opts.startDate && opts.endDate ? opts : this._ibkDefaultLoanDateRange();
    const today = this._ibkDefaultLoanDateRange().endDate;
    const sd = String(startDate || '').replace(/\D/g, '');
    const ed = String(endDate || '').replace(/\D/g, '');
    if (sd && sd > today) return { success: false, error: `시작일이 미래입니다 (${startDate} > 오늘 ${today}).` };
    if (ed && ed > today) {
      this.warn(`[IBK loan] endDate ${endDate} > today ${today} — clamping`);
      endDate = today;
    }
    if (sd && ed && sd > ed) {
      return { success: false, error: `시작일이 종료일보다 늦습니다 (${startDate} > ${endDate}).` };
    }

    this.log(`[IBK loan] syncLoanTransactions ${startDate} ~ ${endDate} 시작...`);

    try {
      await this._cleanupIbkPopups();
      let mainframe = this.page.frame({ name: 'mainframe' }) || this._mainFrame();
      if (!mainframe) {
        await this.page.waitForTimeout(2000);
        mainframe = this.page.frame({ name: 'mainframe' }) || this._mainFrame();
      }
      if (!mainframe) return { success: false, error: 'mainframe을 찾을 수 없습니다.' };

      await this._navigateIbkToLoanInquiry(mainframe);
      await this._cleanupIbkPopups();
      mainframe = this.page.frame({ name: 'mainframe' }) || mainframe;

      const sParts = this._parseYmdParts(startDate);
      const eParts = this._parseYmdParts(endDate);

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getSQLiteManager } = (() => {
        try {
          // Lazy require so the file remains plain JS importable.
          return require('../../../sqlite/manager');
        } catch (_) {
          return { getSQLiteManager: null };
        }
      })();

      // ===========================================================
      // Find #gnrl_lf_acno (the account dropdown). The inquiry page loads
      // async; poll up to 20s.
      // ===========================================================
      const dropdown = await this._waitForIbkLoanAccountDropdown(mainframe, { maxWaitMs: 20000 });
      if (!dropdown || !dropdown.options || dropdown.options.length === 0) {
        try {
          const formDump = await mainframe.evaluate(() => {
            const selects = Array.from(document.querySelectorAll('select')).slice(0, 8).map((s) => ({
              id: s.id,
              name: s.name,
              optionCount: s.options.length,
              firstOptions: Array.from(s.options).slice(0, 6).map((o) => (o.text || '').trim().slice(0, 40)),
            }));
            return { selects, hasGnrl: !!document.getElementById('gnrl_lf_acno') };
          });
          this.warn(`[IBK loan] could not find account dropdown. Form dump: ${JSON.stringify(formDump)}`);
        } catch (_) {}
        return { success: false, error: '계좌 드롭다운을 찾지 못했습니다.' };
      }
      this.log(
        `[IBK loan] account dropdown id="${dropdown.id}" totalOptions=${dropdown.options.length}`,
      );

      // Filter dropdown options to those that look like accounts (skip "선택" / placeholder).
      const accountOpts = dropdown.options.filter((opt) => {
        const blob = `${opt.text || ''} ${opt.value || ''}`;
        return /\d{3}-\d{2,6}-\d{2,4}-\d{1,4}|\d{2,4}-\d{4,8}-\d{2,4}|\b\d{10,14}\b/.test(blob);
      });
      this.log(`[IBK loan] iterating ${accountOpts.length} accounts via dropdown`);

      // ===========================================================
      // Loop: select dropdown option → set dates → 조회 → download → import.
      // No 목록으로 click — we stay on the inquiry page the entire time.
      // ===========================================================
      const perAccount = [];
      for (let i = 0; i < accountOpts.length; i++) {
        const opt = accountOpts[i];
        const acct = this._extractAccountFromText(`${opt.text} ${opt.value}`) || opt.value || '(unknown)';
        this.log(`[IBK loan] (${i + 1}/${accountOpts.length}) account=${acct}`);

        try {
          mainframe = this.page.frame({ name: 'mainframe' }) || mainframe;

          // Select the option in the dropdown — try by value, then by label.
          const dropdownLoc = mainframe.locator(`[id="${dropdown.id}"]`);
          let selectOk = false;
          try {
            await dropdownLoc.selectOption(opt.value, { timeout: 3000 });
            selectOk = true;
          } catch (e) {
            this.warn(`[IBK loan] account=${acct}: selectOption(value=${opt.value}) failed: ${e.message}`);
          }
          if (!selectOk) {
            try {
              await dropdownLoc.selectOption({ label: opt.text }, { timeout: 3000 });
              selectOk = true;
            } catch (e) {
              this.warn(`[IBK loan] account=${acct}: selectOption(label) failed: ${e.message}`);
            }
          }
          this.log(`[IBK loan] account=${acct}: dropdown select → ${selectOk}`);
          if (!selectOk) {
            perAccount.push({ accountNumber: acct, imported: 0, error: 'dropdown select failed' });
            continue;
          }
          await this.page.waitForTimeout(500);

          // Set dates
          this.log(`[IBK loan] account=${acct}: setting dates ${startDate} ~ ${endDate}`);
          await this._setIbkLoanDate(mainframe, 'start', sParts);
          await this._setIbkLoanDate(mainframe, 'end', eParts);
          await this.page.waitForTimeout(400);

          // Click 조회. The new inquiry page's button is at body/div[8]/div[4]/div[2]/div[2]/a
          // — NOT inside a <form>. So we drop the form-scope and use exact-text + class.
          let queryClicked = false;
          try {
            await mainframe
              .locator('a.btn_ok')
              .filter({ hasText: /^조회$/ })
              .first()
              .click({ force: true, timeout: 5000 });
            queryClicked = true;
          } catch (e) {
            this.warn(`[IBK loan] a.btn_ok 조회 click failed: ${e.message}`);
          }
          if (!queryClicked) {
            // Fallback: scope to #ibkContent (the page content area) so we don't
            // grab a sidebar 조회 menu.
            try {
              await mainframe
                .locator('#ibkContent')
                .locator('a, button')
                .filter({ hasText: /^조회$/ })
                .first()
                .click({ force: true, timeout: 3000 });
              queryClicked = true;
            } catch (e) {
              this.warn(`[IBK loan] #ibkContent 조회 fallback failed: ${e.message}`);
            }
          }
          if (!queryClicked) {
            perAccount.push({ accountNumber: acct, imported: 0, error: '조회 click failed' });
            continue;
          }
          this.log(`[IBK loan] account=${acct}: 조회 clicked, waiting...`);
          await this.page.waitForTimeout(3500);

          // No-data check. The new inquiry page renders the message inside the
          // result panel (e.g. "까지 조회결과가 없습니다."), not always under
          // #spErrTitle. So check both.
          const noData = await mainframe
            .evaluate(() => {
              const sp = document.getElementById('spErrTitle');
              const spText = (sp && sp.textContent) || '';
              const bodyText = document.body ? document.body.innerText || '' : '';
              return {
                spText: spText.slice(0, 120),
                hit: /조회결과가 없습니다/.test(spText) || /조회결과가 없습니다/.test(bodyText),
              };
            })
            .catch(() => ({ hit: false, spText: '' }));
          this.log(`[IBK loan] account=${acct}: noDataCheck hit=${noData.hit} spText=${JSON.stringify(noData.spText)}`);
          if (noData.hit) {
            this.log(`[IBK loan] account=${acct} — no transactions (skip)`);
            perAccount.push({ accountNumber: acct, imported: 0, skipped: true });
            continue;
          }

          // Trigger download. Use the 4-way race pattern from getTransactions
          // (line ~1996) — Playwright event + filesystem poll + no-data watcher
          // + hard timeout. Whichever signal fires first wins. Tags each result
          // so we know exactly what detected the file.
          await this.focusPlaywrightPage();
          const exportStartedAt = Date.now();
          const downloadPromise = this.context.waitForEvent('download', { timeout: 60000 });

          this.log(`[IBK loan] account=${acct}: clicking 저장 / 출력용 / DownloadExcel / DownloadButton`);
          await this._robustClickMainframe(mainframe, '[id="save_to_file"]').catch(() => {});
          await this.page.waitForTimeout(800);
          await this._robustClickMainframe(mainframe, 'span', '엑셀파일저장(출력용)').catch(() => {});
          await this.page.waitForTimeout(800);
          await this._robustClickMainframe(mainframe, '[id="DownloadExcel"]').catch(() => {});
          await this.page.waitForTimeout(400);
          await this._robustClickMainframe(mainframe, '[id="DownloadButton"]').catch(() => {});

          const scanDirs = [this.downloadDir, path.join(this.outputDir, 'corporate-cert-downloads')];

          // Filesystem poll: check every 1s for up to 60s. Verifies file size
          // is stable across two reads (indicates download is complete, not in
          // progress) before returning.
          const pollForFile = async () => {
            let prevPath = null;
            let prevSize = -1;
            for (let i = 0; i < 60; i++) {
              const found = this.findRecentDownloadFile(scanDirs, exportStartedAt);
              if (found) {
                if (found.path === prevPath && found.size === prevSize && found.size > 0) {
                  return { type: 'polling', data: found };
                }
                prevPath = found.path;
                prevSize = found.size;
              }
              await new Promise((r) => setTimeout(r, 1000));
            }
            return { type: 'polling-timeout' };
          };

          // No-data watcher: poll page text for late-appearing error messages.
          const nodataWatcher = (async () => {
            const phrases = ['저장할 데이터가 없습니다', '조회된 데이터가 없습니다', '까지 조회결과가 없습니다', '조회결과가 없습니다'];
            for (let i = 0; i < 40; i++) {
              const hit = await mainframe
                .evaluate((ps) => {
                  const txt = (document.body && document.body.innerText) || '';
                  return ps.find((p) => txt.includes(p)) || null;
                }, phrases)
                .catch(() => null);
              if (hit) return { type: 'nodata', phrase: hit };
              await new Promise((r) => setTimeout(r, 1000));
            }
            return { type: 'nodata-timeout' };
          })();

          const raced = await Promise.race([
            downloadPromise.then((dl) => ({ type: 'download-event', data: dl })).catch(() => ({ type: 'download-error' })),
            pollForFile(),
            nodataWatcher,
            this.page.waitForTimeout(60000).then(() => ({ type: 'hard-timeout' })),
          ]);

          let download = null;
          let suggested = '거래내역조회.xlsx';
          let fallbackFile = null;

          if (raced.type === 'nodata') {
            this.log(`[IBK loan] account=${acct} — late no-data detected ("${raced.phrase}"), skip`);
            perAccount.push({ accountNumber: acct, imported: 0, skipped: true });
            await this._cleanupIbkPopups().catch(() => {});
            continue;
          }
          if (raced.type === 'download-event') {
            download = raced.data;
            suggested = download.suggestedFilename() || suggested;
            this.log(`[IBK loan] account=${acct}: download event won (${suggested})`);
          } else if (raced.type === 'polling') {
            fallbackFile = raced.data;
            suggested = path.basename(fallbackFile.path);
            this.log(`[IBK loan] account=${acct}: filesystem poll won (${suggested}, ${fallbackFile.size}B)`);
          } else {
            // hard-timeout / download-error / polling-timeout — last-chance scan
            const lastChance = this.findRecentDownloadFile(scanDirs, exportStartedAt);
            if (lastChance) {
              fallbackFile = lastChance;
              suggested = path.basename(fallbackFile.path);
              this.log(`[IBK loan] account=${acct}: last-chance scan found ${suggested} (race=${raced.type})`);
            } else {
              this.warn(`[IBK loan] account=${acct} — download failed (race=${raced.type})`);
              perAccount.push({ accountNumber: acct, imported: 0, error: `download failed: ${raced.type}` });
              await this._cleanupIbkPopups().catch(() => {});
              continue;
            }
          }

          const ext = path.extname(suggested) || '.xlsx';
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const safeAcct = String(acct).replace(/[^\w-]/g, '_');
          const finalName = `IBK_대출거래_${safeAcct}_${startDate}_${endDate}_${ts}${ext}`;
          const finalPath = path.join(this.downloadDir, finalName);
          const saved = await this.saveDownloadSafely(download, fallbackFile?.path, finalPath);
          if (!saved) {
            perAccount.push({ accountNumber: acct, imported: 0, error: 'save failed' });
            continue;
          }
          this.log(`[IBK loan] account=${acct} downloaded → ${finalPath}`);

          // Close the post-download popup. ORDER MATTERS: JS-dispatch the
          // recording's exact close button FIRST (no visibility check — popup
          // partially renders at top of viewport so Playwright's flow rejects
          // it). Only fall back to _cleanupIbkPopups force-hide if that misses.
          const closeResult = await this._closeIbkLoanDownloadPopupViaRecording();
          if (!closeResult || !closeResult.ok) {
            await this._cleanupIbkPopups();
            await this._closeIbkLoanDownloadPopupAggressive(acct);
          }
          await this.page.waitForTimeout(400);

          // Import
          let imported = 0;
          if (getSQLiteManager) {
            try {
              const fhm = getSQLiteManager().getFinanceHubManager();
              const imp = fhm.importIbkLoanTransactionsFromExcel(finalPath, acct);
              imported = imp.imported || 0;
              if (imp.warnings && imp.warnings.length) {
                this.warn(`[IBK loan] account=${acct} parser warnings: ${imp.warnings.join('; ')}`);
              }
              if (imp.success === false) {
                this.warn(`[IBK loan] account=${acct} import failed: ${imp.error}`);
              }
            } catch (importErr) {
              this.warn(`[IBK loan] account=${acct} import threw: ${importErr.message}`);
            }
          }
          perAccount.push({ accountNumber: acct, imported, filePath: finalPath });

          // No 목록으로 — stay on inquiry page for the next dropdown iteration.
        } catch (perAcctErr) {
          this.error(`[IBK loan] account=${acct} loop error:`, perAcctErr.message);
          perAccount.push({ accountNumber: acct, imported: 0, error: perAcctErr.message });
          await this._cleanupIbkPopups().catch(() => {});
        }
      }

      const totalImported = perAccount.reduce((a, b) => a + (b.imported || 0), 0);
      const skipped = perAccount.filter((r) => r.skipped).length;
      this.log(`[IBK loan] complete. accounts=${perAccount.length}, imported=${totalImported}, skipped=${skipped}`);
      return {
        success: true,
        accounts: perAccount.length,
        imported: totalImported,
        skipped,
        perAccount,
      };
    } catch (error) {
      this.error('[IBK loan] syncLoanTransactions failed:', error.message);
      try {
        await this._cleanupIbkPopups();
      } catch (e) {}
      return { success: false, error: error.message };
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
        const report = await frame.evaluate(({ p, year, month, d }) => {
          const results = {};
          const setVal = (suffix, val) => {
            const id = `${p}_${suffix}`;
            const el = document.getElementById(id);
            if (el) {
              el.value = val;
              // 표준 이벤트 발생
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new Event('input', { bubbles: true }));
              // 인라인 핸들러(onchange) 강제 호출
              if (typeof el.onchange === 'function') {
                el.onchange();
              } else if (el.getAttribute('onchange')) {
                // attribute로만 존재하는 경우 eval (위험할 수 있으나 IBK 환경에선 필요)
                try { new Function(el.getAttribute('onchange')).call(el); } catch(e) {}
              }
              results[id] = 'ok';
              return true;
            }
            results[id] = 'not_found';
            return false;
          };
          setVal('yy', year);
          setVal('mm', month);
          setVal('dd', d);
          return results;
        }, { p: prefix, year: y, month: m, d: day });

        const missing = Object.entries(report).filter(([_, status]) => status !== 'ok').map(([id]) => id);
        if (missing.length > 0) {
          this.warn(`[IBK] 날짜 설정 요소 찾지 못함: ${missing.join(', ')}`);
        } else {
          this.log(`   [IBK] 날짜 설정 완료 (${prefix}: ${y}-${m}-${day})`);
        }
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

      // [신규] "조회 결과 없음" 사전 체크
      const noDataFoundEarly = await frame.evaluate(() => {
        const checkPhrases = ['까지 조회결과가 없습니다', '조회된 데이터가 없습니다', '저장할 데이터가 없습니다'];
        const allText = document.body.innerText || '';
        return checkPhrases.some(phrase => allText.includes(phrase));
      });

      if (noDataFoundEarly) {
        this.log('   [IBK] 조회 결과 없음이 확인되었습니다. (다운로드 스킵)');
        return [];
      }

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
      
      // [개선] 페이지가 아닌 컨텍스트 전체에서 다운로드 감시 (팝업 다운로드 대응)
      const downloadPromise = this.context.waitForEvent('download', { timeout: 60000 });
      
      // Step 1: Trigger download sequence
      try {
        console.log('   [IBK] "저장" -> "엑셀파일저장" 직접 클릭 시도...');
        await frame.evaluate(() => {
          const findAndClick = (txt) => {
            const el = Array.from(document.querySelectorAll('span, a, button'))
              .find(e => e.textContent.includes(txt));
            if (el) el.click();
          };
          findAndClick('저장');
        });
        await this.page.waitForTimeout(1000);

        await frame.evaluate(() => {
          const el = Array.from(document.querySelectorAll('span, a, button'))
            .find(e => e.textContent.includes('엑셀파일저장'));
          if (el) el.click();
        });
        await this.page.waitForTimeout(1500);
        
        // 라디오 버튼 및 최종 다운로드 버튼 클릭
        await frame.evaluate(() => {
          const radio = document.getElementById('DownloadExcel');
          if (radio) radio.click();
          
          const btn = document.getElementById('DownloadButton');
          if (btn) btn.click();
        });
        console.log('   [IBK] 다운로드 트리거 완료.');
      } catch (e) {
        this.warn('IBK: Error during download click sequence:', e.message);
      }

      // Step 2: [개선] 다운로드 이벤트와 파일 시스템 폴링을 동시에 Race
      console.log('   [IBK] 다운로드 완료 대기 중 (Event + Polling)...');
      
      const pollForFile = async (startTime) => {
        for (let i = 0; i < 30; i++) { // 최대 30초 폴링
          const found = this.findRecentDownloadFile(
            [this.downloadDir, path.join(this.outputDir, 'corporate-cert-downloads')],
            startTime
          );
          if (found) return { type: 'polling', data: found };
          await new Promise(r => setTimeout(r, 1000));
        }
        throw new Error('polling timeout');
      };

      const raced = await Promise.race([
        downloadPromise.then((dl) => ({ type: 'download', data: dl })),
        pollForFile(exportStartedAt),
        this.page.waitForTimeout(40000).then(() => ({ type: 'timeout' })),
        frame.evaluate(() => {
          return new Promise((resolve) => {
            const check = () => {
              const checkPhrases = ['저장할 데이터가 없습니다', '조회된 데이터가 없습니다', '까지 조회결과가 없습니다'];
              const allText = document.body.innerText || '';
              if (checkPhrases.some(phrase => allText.includes(phrase))) resolve({ type: 'nodata' });
              else setTimeout(check, 1000);
            };
            check();
          });
        }),
      ]).catch(() => ({ type: 'timeout' }));

      let download = null;
      let suggested = 'ibk-export.xls';
      let fallbackFile = null;

      if (raced.type === 'nodata') {
        this.log('   [IBK] 데이터 없음 확인 (메시지 감지)');
        return [];
      }

      if (raced.type === 'polling') {
        this.log(`   [IBK] 파일 시스템 폴링으로 다운로드 감지 성공: ${path.basename(raced.data.path)}`);
        fallbackFile = raced.data;
        suggested = path.basename(fallbackFile.path);
      } else if (raced.type === 'download') {
        this.log('   [IBK] 브라우저 다운로드 이벤트 감지 성공');
        download = raced.data;
        suggested = download.suggestedFilename() || suggested;
      } else {
        this.error('   [IBK] 다운로드 감지 실패 (타임아웃)');
        return [];
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
    
    // [수정] 내역 없음(Graceful Exit) 시 실패가 아닌 성공으로 반환
    if (!downloadResult || downloadResult.length === 0) {
      this.log('IBK: getTransactions returned empty (no data), returning success with empty transactions.');
      return {
        success: true,
        transactions: [],
        metadata: { bankName: 'IBK기업은행', accountNumber, totalCount: 0 },
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

function createIbkAutomator(options = {}) {
  return new IbkBankAutomator(options);
}

module.exports = {
  IbkBankAutomator,
  createIbkAutomator,
};
