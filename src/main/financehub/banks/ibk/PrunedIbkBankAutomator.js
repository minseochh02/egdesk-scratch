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

class PrunedIbkBankAutomator extends BaseBankAutomator {
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
    this._ibkCertWindowClass = null;
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

          const targets = Array.from(document.querySelectorAll(closeSelectors))
            .filter(el => {
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0;
            });

          targets.forEach(el => {
            (el.closest('a, button') || el).click();
          });

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
        try { await this.browser.close(); } catch (e) {}
        this.browser = null;
      }
      const corpDownloadsPath = path.join(this.outputDir, 'corporate-cert-downloads');
      this.ensureOutputDirectory(corpDownloadsPath);
      const { browser, context } = await this.createBrowser(proxy, {
        useKbScriptPlaywrightProfile: true,
        extraChromeArgs: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
        viewport: null,
        acceptDownloads: true,
        downloadsPath: corpDownloadsPath,
      });
      this.browser = browser;
      this.context = context;
      this.page = context.pages()[0] || await context.newPage();
      
      this.page.on('dialog', async (dialog) => {
        try { await dialog.accept(); } catch (e) {}
      });

      await this.page.goto(this.config.xpaths.entryUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(3000);

      const frame = this._mainFrame();
      if (!frame) return { success: false, error: 'mainframe not found' };

      try {
        await frame.locator('a:has-text("로그인")').first().click({ timeout: 10000 });
      } catch (e) {
        await this.page.locator('a:has-text("로그인")').first().click({ timeout: 10000 });
      }
      await this.page.waitForTimeout(2000);

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
      if (!uia.ok) return { success: false, error: uia.error || '인증서 창을 찾지 못했습니다.' };
      
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
      return { success: false, error: error.message };
    }
  }

  async completeCorporateCertificateLogin(creds) {
    const { certificatePassword } = creds || {};
    if (this._ibkCorporateCertPhase !== 'awaiting_password') {
      return { success: false, error: '인증서 준비 단계가 완료되지 않았습니다.' };
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

      // [안정화] 직접 포커스 시도 (TAB 방식 제거)
      this.log(`[IBK] 인증서 입력창 직접 포커스 시도 (${this._ibkCertWindowClass})...`);
      const focusResult = focusCertElement(this._ibkCertWindowClass, 'passwordFrame');
      
      if (!focusResult.ok) {
        throw new Error(`인증서 입력창 포커스 실패: ${focusResult.error}`);
      }
      this.log(`   ✅ 포커스 성공! (${focusResult.method})`);

      // [안정화] 직접 포커스 성공 시: 비밀번호 입력과 그 이후의 스텝(ENTER)만 남깁니다.
      const passwordStepIdx = IBK_NATIVE_CERT_STEPS.findIndex(s => s.type === 'password');
      const inputSteps = IBK_NATIVE_CERT_STEPS.slice(passwordStepIdx);

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
      if (frame) {
        await frame.evaluate(() => {
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

      const accounts = await this._getIbKAccounts();
      this._ibkCorporateCertPhase = 'completed';
      this.isLoggedIn = true;
      this.userName = 'IBK 기업뱅킹';
      
      return { success: true, isLoggedIn: this.isLoggedIn, userName: this.userName, accounts };
    } catch (error) {
      this.error('completeCorporateCertificateLogin (ibk) failed:', error.message);
      await this._disconnectArduinoHid();
      return { success: false, error: error.message };
    }
  }

  async _getIbKAccounts() {
    const { scope, id: acctSelectId } = await this._findIbkAccountSelect();
    if (!scope || !acctSelectId) return [];

    const idEsc = String(acctSelectId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const acctSelect = scope.locator(`[id="${idEsc}"]`);

    const rows = await acctSelect.evaluate((sel) =>
      Array.from(sel.options).filter((opt) => opt.value).map((opt, i) => ({
        index: i,
        text: (opt.textContent || '').trim(),
        value: opt.value,
      }))
    ).catch(() => []);

    const accounts = [];
    const seen = new Set();
    for (const row of rows) {
      let accountNumber = this._parseIbkAccountFromOption(row.text, row.value);
      if (!accountNumber) accountNumber = `value:${String(row.value).slice(0, 48)}`;
      const key = accountNumber.replace(/-/g, '');
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

  async _findIbkAccountSelect() {
    const candidates = ['ecb_user_num01', 'sAcctNo', 'sAccount', 'ID_sAcctNo'];
    const frame = this._mainFrame();
    const scope = frame || this.page;
    for (const id of candidates) {
      const n = await scope.locator(`[id="${id}"]`).count();
      if (n > 0) return { scope, id };
    }
    return { scope, id: null };
  }

  _parseIbkAccountFromOption(text, value) {
    const t = (text || '').trim();
    const dashed = t.match(/(\d{3})-(\d{2,6})-(\d{4,7})/);
    if (dashed) return dashed[0];
    const digits = t.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 16) return digits;
    return null;
  }

  async getTransactions(accountNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');
    this.ensureOutputDirectory(this.downloadDir);
    this.log(`[IBK] Fetching transactions for ${accountNumber}...`);

    try {
      let frame = this.page.frame({ name: 'mainframe' }) || this._mainFrame();
      if (!frame) return [];

      const { scope, id: acctSelectId } = await this._findIbkAccountSelect();
      if (!acctSelectId) return [];

      // 계좌 선택
      await scope.locator(`[id="${acctSelectId}"]`).selectOption({ label: new RegExp(accountNumber) });
      await this.page.waitForTimeout(1000);

      // 날짜 설정 유틸리티
      const setYmdTriplet = async (prefix, y, m, day) => {
        await frame.evaluate(({ p, year, month, d }) => {
          const setVal = (suffix, val) => {
            const el = document.getElementById(`${p}_${suffix}`);
            if (el) {
              el.value = val;
              el.dispatchEvent(new Event('change', { bubbles: true }));
              if (typeof el.onchange === 'function') el.onchange();
              return true;
            }
            return false;
          };
          setVal('yy', year);
          setVal('mm', month);
          setVal('dd', d);
        }, { p: prefix, year: y, month: m, d: day });
      };

      const d = (startDate || '').replace(/\D/g, '');
      if (d.length >= 8) {
        await setYmdTriplet('inqy_sttg_ymd', d.slice(0, 4), d.slice(4, 6), d.slice(6, 8));
      }

      // 조회 버튼 클릭
      try {
        await frame.locator('[id="_btnSubmit"]').click({ timeout: 5000 });
      } catch (e) {
        await frame.locator('button:has-text("조회")').click({ timeout: 5000 });
      }
      await this.page.waitForTimeout(3000);

      // [안정화] 데이터 없음 조기 감지
      const noData = await frame.evaluate(() => {
        const text = document.body.innerText || '';
        return ['까지 조회결과가 없습니다', '조회된 데이터가 없습니다', '저장할 데이터가 없습니다'].some(p => text.includes(p));
      });
      if (noData) {
        this.log('   [IBK] 조회 결과 없음 (스킵)');
        return [];
      }

      const exportStartedAt = Date.now();
      const downloadPromise = this.context.waitForEvent('download', { timeout: 60000 });

      // [안정화] 엑셀 다운로드 직접 트리거 (evaluate)
      await frame.evaluate(() => {
        const clickText = (txt) => {
          const el = Array.from(document.querySelectorAll('span, a, button')).find(e => e.textContent.includes(txt));
          if (el) el.click();
        };
        clickText('저장');
      });
      await this.page.waitForTimeout(1000);
      await frame.evaluate(() => {
        const el = Array.from(document.querySelectorAll('span, a, button')).find(e => e.textContent.includes('엑셀파일저장'));
        if (el) el.click();
      });
      await this.page.waitForTimeout(1500);
      await frame.evaluate(() => {
        const radio = document.getElementById('DownloadExcel');
        if (radio) radio.click();
        const btn = document.getElementById('DownloadButton');
        if (btn) btn.click();
      });

      // [안정화] Race: 이벤트 vs 폴링
      const pollForFile = async (startTime) => {
        for (let i = 0; i < 30; i++) {
          const found = this.findRecentDownloadFile([this.downloadDir], startTime);
          if (found) return { type: 'polling', data: found };
          await new Promise(r => setTimeout(r, 1000));
        }
        throw new Error('timeout');
      };

      const raced = await Promise.race([
        downloadPromise.then(dl => ({ type: 'download', data: dl })),
        pollForFile(exportStartedAt),
        this.page.waitForTimeout(40000).then(() => ({ type: 'timeout' }))
      ]).catch(() => ({ type: 'timeout' }));

      if (raced.type === 'timeout') return [];

      let finalPath = (raced.type === 'polling') ? raced.data.path : (await raced.data.path());
      const finalName = `IBK_Pruned_${accountNumber}_${Date.now()}.xls`;
      const targetPath = path.join(this.downloadDir, finalName);
      
      const fs = require('fs');
      fs.copyFileSync(finalPath, targetPath);

      return [{ status: 'downloaded', filename: finalName, path: targetPath, extractedData: { summary: { totalCount: 0 } } }];
    } catch (error) {
      this.error('IBK getTransactions failed:', error.message);
      return [];
    }
  }
}

function createPrunedIbkAutomator(options = {}) {
  return new PrunedIbkBankAutomator(options);
}

module.exports = {
  PrunedIbkBankAutomator,
  createPrunedIbkAutomator,
};
