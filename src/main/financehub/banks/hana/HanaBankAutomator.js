const fs = require('fs');
const path = require('path');
const os = require('os');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
const { parseTransactionExcel } = require('../../utils/transactionParser');
const { isWindows, waitForNativeCertificateDialogWindow, waitForCertWindowClose, dismissCertErrorConfirmButton, ensureCertWindowOnScreen, focusCertElement } = require('../../utils/windows-uia-native');
const { ArduinoHidBankSession } = require('../../utils/arduino-hid-bank');
const {
  runNativeCertArduinoSteps,
  HANA_NATIVE_CERT_STEPS,
} = require('../../utils/corporate-cert-native-steps');
const { HANA_CONFIG } = require('./config');
const { accountDisplayNameFromOptionText } = require('../../utils/accountOptionLabel');

class HanaBankAutomator extends BaseBankAutomator {
  constructor(options = {}) {
    const config = {
      ...HANA_CONFIG,
      headless: options.headless ?? HANA_CONFIG.headless,
      chromeProfile: options.chromeProfile ?? HANA_CONFIG.chromeProfile,
    };
    super(config);
    this.outputDir = options.outputDir || this.getSafeOutputDir('hana');
    // 앱 전용 출력 폴더(AppData)로 경로 복구
    this.downloadDir = path.join(this.outputDir, 'hana-biz-downloads');
    this.ensureOutputDirectory(this.downloadDir);
    this.arduinoPort = options.arduinoPort || null;
    this.arduinoBaudRate = options.arduinoBaudRate || 9600;
    this._arduinoHid = null;
    this._hanaCorporateCertPhase = 'idle';
    this._hanaCertAttempt = 0;
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
    let totalClicked = 0;
    for (const target of [this.page, this._hanaFrame()].filter(Boolean)) {
      try {
        const clicked = await target.evaluate(() => {
          let count = 0;
          const btns = document.querySelectorAll('button, a, span, div');
          for (const b of btns) {
            const text = b.textContent?.trim() || '';
            if (
              (text === '닫기' || text === '팝업 닫기' || text === '오늘 하루 열지않기' || text === '확인') &&
              b.offsetParent !== null
            ) {
              const rect = b.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                b.click();
                count++;
              }
            }
          }
          const layers = document.querySelectorAll('.layer_popup, .popup_wrap, .pop_wrap, [class*="popup"]');
          for (const l of layers) {
            const closeBtn = l.querySelector('.btn_close, .close, [class*="close"]');
            if (closeBtn) {
              closeBtn.click();
              count++;
            }
          }
          return count;
        });
        totalClicked += clicked;
      } catch (e) {}
    }
    return totalClicked;
  }

  /**
   * Wait for hanaMainframe — close popups on main document between attempts (overlay can block frame).
   */
  async _waitForHanaMainframe({ maxWaitMs = 40000, minWaitMs = 5000 } = {}) {
    const start = Date.now();
    const deadline = start + maxWaitMs;
    let frame = null;
    
    while (Date.now() < deadline) {
      await this._closeHanaPopups();
      frame = this._hanaFrame();
      
      const elapsed = Date.now() - start;
      if (frame && elapsed >= minWaitMs) {
        return frame;
      }
      
      await this.page.waitForTimeout(1000);
    }
    return frame || this._hanaFrame();
  }

  async prepareCorporateCertificateLogin(proxyUrl) {
    if (!isWindows()) {
      return { success: false, error: '하나 기업 인증서 연결은 Windows에서만 지원됩니다.' };
    }
    const proxy = this.buildProxyOption(proxyUrl);
    try {
      if (this.browser) {
        try {
          const pages = this.context?.pages() || [];
          const activePage = pages.find(p => !p.isClosed());
          if (activePage) {
            this.page = activePage;
            const currentUrl = this.page.url();
            // If already on Hana Bank site and not explicitly closed, try to reuse
            if (currentUrl.includes('hanabank.com')) {
              this.log('Hana: Reusing existing browser session...');
              await this.page.goto(this.config.xpaths.entryUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
              
              // [개선] 재사용 시에도 초기 팝업 처리 강화
              for (let i = 0; i < 2; i++) {
                await this._closeHanaPopups();
                await this.page.waitForTimeout(1000);
              }

              const frame = await this._waitForHanaMainframe({ maxWaitMs: 10000, minWaitMs: 3000 });
              if (frame) {
                // Check if already logged in by looking for logout button or similar
                const isLoggedIn = await frame.evaluate(() => {
                  return !!Array.from(document.querySelectorAll('button, a, span')).find(e => e.textContent?.includes('로그아웃'));
                }).catch(() => false);
                
                if (isLoggedIn) {
                  this.log('Hana: Already logged in, skipping auth steps.');
                  this.isLoggedIn = true;
                  return { success: true, isLoggedIn: true, message: 'Already logged in.' };
                }
              }
            }
          }
          // If not reusable, close and start fresh
          await this.browser.close().catch(() => {});
        } catch (e) {
          this.warn('Hana: Failed to reuse browser:', e.message);
        }
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
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--allow-running-insecure-content',
          '--disable-features=PrivateNetworkAccessSendPreflights',
          '--disable-features=PrivateNetworkAccessRespectPreflightResults',
        ],
        viewport: null,
        acceptDownloads: true,
        downloadsPath: this.downloadDir, 
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
      
      // [개선] 초기 팝업 닫기 루프 강화: 팝업이 뜨는 시간을 충분히 기다리며 여러 번 시도
      this.log('Hana: Starting robust initial popup closing sequence...');
      for (let i = 0; i < 3; i++) {
        const clicked = await this._closeHanaPopups();
        if (clicked > 0) this.log(`Hana: Initial loop closed ${clicked} popups (iteration ${i+1})`);
        await this.page.waitForTimeout(1500);
      }

      const frame = await this._waitForHanaMainframe({ maxWaitMs: 40000, minWaitMs: 5000 });
      if (!frame) {
        this._hanaCorporateCertPhase = 'idle';
        return { success: false, error: 'hanaMainframe not found' };
      }

      // hana.spec.js STEP 1: closePopups again in frame + page, then 1s before first 로그인
      await this._closeHanaPopups();
      await this.page.waitForTimeout(1000);

      await frame.locator('button:has-text("로그인")').first().click({ timeout: 20000 });
      await this.page.waitForTimeout(2000);

      try {
        await frame.evaluate(() => {
          if (typeof DelfinoConfig !== 'undefined') {
            DelfinoConfig.lastUsedCertFirst = true;
          }
        });
      } catch (e) {}

      await frame.locator(`[id="${this.config.xpaths.certLoginButtonId}"]`).click({ timeout: 20000 });

      const uia = await waitForNativeCertificateDialogWindow({
        timeoutMs: 60000,
        pollMs: 1000,
        onLog: (m) => this.log(m),
      });
      if (!uia.ok) {
        this._hanaCorporateCertPhase = 'idle';
        return { success: false, error: uia.error || '인증서 창을 찾지 못했습니다.' };
      }
      this._hanaCertWindowClass = uia.matchedClass;
      const _hanaScreenCheck = ensureCertWindowOnScreen(uia.matchedClass);
      if (_hanaScreenCheck.moved) this.log('[Hana] 인증서 창이 화면 밖에 있어 화면 가운데로 이동했습니다.');
      this._hanaCorporateCertPhase = 'awaiting_password';
      this._hanaCertAttempt = 0;
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
    const { certificatePassword, certificateIndex } = creds || {};
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

    const maxAttempts = 3;
    while (this._hanaCertAttempt < maxAttempts) {
      this._hanaCertAttempt += 1;
      const useSlowTyping = this._hanaCertAttempt >= 2;
      if (useSlowTyping) {
        this.warn(`[Hana] 인증서 로그인 재시도 (${this._hanaCertAttempt}/${maxAttempts}) — 느린 타이핑 모드 사용`);
      } else {
        this.log(`[Hana] 인증서 로그인 시도 (${this._hanaCertAttempt}/${maxAttempts})...`);
      }

      try {
        this._arduinoHid = new ArduinoHidBankSession({
          portPath: this.arduinoPort,
          baudRate: this.arduinoBaudRate,
          log: (m) => this.log(m),
        });
        await this._arduinoHid.connect();

        let inputSteps = HANA_NATIVE_CERT_STEPS;

        // [개선] 직접 포커스 시도 (Delfino QWidget 환경)
        // 단, certificateIndex가 1보다 큰 경우(인증서 선택이 필요한 경우)에는 안전을 위해 기본 TAB 방식을 사용합니다.
        if (this._hanaCertWindowClass && (!certificateIndex || certificateIndex <= 1)) {
          this.log(`[Hana] 인증서 입력창 직접 포커스 시도 (${this._hanaCertWindowClass})...`);
          const focusResult = focusCertElement(this._hanaCertWindowClass, 'passwordFrame');
          
          if (focusResult.ok) {
            this.log(`   ✅ 포커스 성공! (${focusResult.method}) - TAB 단계를 건너뜁니다.`);
            // TAB 단계 및 비밀번호 입력 전의 ENTER 단계를 제외한 입력 스텝 준비
            const pwIndex = HANA_NATIVE_CERT_STEPS.findIndex(s => s.type === 'password');
            inputSteps = HANA_NATIVE_CERT_STEPS.filter((s, idx) => {
              if (s.key === 'TAB') return false;
              if (s.key === 'ENTER' && idx < pwIndex) return false;
              return true;
            });
          } else {
            this.warn(`   ⚠️ 직접 포커스 실패 (${focusResult.error}) - 기본 TAB 방식으로 진행합니다.`);
          }
        }

        // [추가] certificateIndex 지원 (1보다 큰 경우 DOWN 키로 선택)
        if (certificateIndex && certificateIndex > 1) {
          this.log(`[Hana] ${certificateIndex}번째 인증서 선택을 위해 DOWN 키를 ${certificateIndex - 1}회 전송합니다.`);
          const indexSteps = [];
          for (let i = 0; i < certificateIndex - 1; i++) {
            indexSteps.push({ key: 'DOWN', waitMs: 200 });
          }
          inputSteps = [...indexSteps, ...inputSteps];
        }

        await runNativeCertArduinoSteps(
          this._arduinoHid,
          this.page,
          certificatePassword,
          inputSteps,
          {
            log: this.log.bind(this),
            warn: this.warn.bind(this),
            slowType: useSlowTyping,
            sendkeysEnterFallbackEnv: 'CORP_CERT_SENDKEYS_ENTER_FALLBACK',
          }
        );
        await this._arduinoHid.disconnect();
        this._arduinoHid = null;

        // Check if cert window closed (success) or still open (wrong password)
        this.log('[HANA] 인증서 비밀번호 확인 중...');
        const certClosed = await waitForCertWindowClose(this._hanaCertWindowClass, {
          timeoutMs: 5000,
          pollMs: 500,
          onLog: (m) => this.log(m),
        });

        if (certClosed.closed) {
          this._hanaCertAttempt = 0; // Reset on success
          break; // Exit retry loop
        } else {
          this.warn(`[HANA] 인증서 창이 닫히지 않음 (시도 ${this._hanaCertAttempt}/${maxAttempts}) — 비밀번호 오류 가능성. 오류 팝업 닫기 시도...`);
          const dismissed = dismissCertErrorConfirmButton(this._hanaCertWindowClass);
          this.log(`[HANA] 오류 팝업 닫기: ${dismissed.ok ? `성공 (${dismissed.method})` : dismissed.error}`);
          
          if (this._hanaCertAttempt >= maxAttempts) {
            this.error(`[HANA] 최대 재시도 횟수(${maxAttempts}회) 도달. 비밀번호 잠김 방지를 위해 중단합니다.`);
            this._hanaCorporateCertPhase = 'awaiting_password';
            return { 
              success: false, 
              wrongPassword: true, 
              error: `인증서 비밀번호가 올바르지 않습니다. (${maxAttempts}회 시도 실패) 비밀번호 잠김 방지를 위해 중단합니다. 직접 확인 후 다시 시도해주세요.` 
            };
          }
          
          this.log('[HANA] 1.5초 대기 후 재시도합니다...');
          await this.page.waitForTimeout(1500);
          continue; // Retry loop
        }
      } catch (error) {
        this.error(`completeCorporateCertificateLogin (hana) attempt ${this._hanaCertAttempt} failed:`, error.message);
        try {
          await this._disconnectArduinoHid();
        } catch (e) {}
        
        if (this._hanaCertAttempt >= maxAttempts) {
          this.error(`[HANA] 인증서 로그인 중 오류 발생 (${this._hanaCertAttempt}/${maxAttempts}). 중단합니다:`, error.message);
          return { success: false, error: `인증서 로그인 중 오류가 발생했습니다: ${error.message}` };
        }
        await this.page.waitForTimeout(1500);
        continue;
      }
    }

    try {
      await this.page.waitForTimeout(2000);
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
    const dashed = t.match(/(\d{3,4})-(\d{2,6})-(\d{3,7})/);
    if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
    const digits = t.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 16) {
      if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
      if (digits.length === 14) return `${digits.slice(0, 3)}-${digits.slice(3, 9)}-${digits.slice(9)}`;
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
    const acctSelect = scope.locator(`select[id="${idEsc}"]`);
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
        accountName: accountDisplayNameFromOptionText(row.text, '하나 기업 계좌'),
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

  async login(credentials, proxyUrl) {
    if (credentials.accountType === 'corporate') {
      this.log('[Hana] Re-login attempt for corporate account...');
      const prep = await this.prepareCorporateCertificateLogin(proxyUrl);
      if (!prep.success) return prep;
      if (prep.isLoggedIn) return prep;

      return await this.completeCorporateCertificateLogin({
        certificatePassword: credentials.certificatePassword || credentials.password,
        certificateIndex: credentials.certificateIndex,
        xpath: credentials.certificateXPath
      });
    }
    return { success: false, error: '하나은행은 기업 공동인증서 연결을 사용하세요.' };
  }

  async getAccounts() {
    this.log('[Hana] getAccounts() 시작...');
    const sessionActive = await this.ensureSession();
    if (!sessionActive) {
      return { success: false, sessionExpired: true, error: '세션이 만료되었습니다. 다시 로그인해주세요.' };
    }
    const accounts = await this._getHanaAccounts();
    this.log(`[Hana] Found ${accounts.length} accounts from dropdown. Starting detail scraping (Timing A)...`);

    const finalAccounts = [];
    const processedCleanNos = new Set();

    try {
      // 1. 상세조회(보유계좌 조회) 페이지로 1회 네비게이션
      const frame = await this.navigateToAccountDetailsPage();
      
      // 2. 보유계좌 테이블 스크래핑
      const detailsMap = await this.scrapeAllAccountDetails(frame);
      
      // 3. 루프 돌며 기존 드롭다운 계좌 상세 병합
      for (const account of accounts) {
        const cleanNo = account.accountNumber.replace(/-/g, '');
        processedCleanNos.add(cleanNo);

        const matchKey = Object.keys(detailsMap).find(k => k.replace(/-/g, '') === cleanNo);
        if (matchKey) {
          const details = detailsMap[matchKey];
          this.log(`[Hana] 추가 계좌 메타데이터 매칭 성공 (${account.accountNumber}):`, JSON.stringify(details));
          
          if (details.customerName) account.customerName = details.customerName;
          if (details.accountType) account.accountType = details.accountType;
          if (details.openDate) account.openDate = details.openDate;
          if (details.balance !== undefined) account.balance = details.balance;
          if (details.availableBalance !== undefined) account.availableBalance = details.availableBalance;
          if (details.currency) account.currency = details.currency;
          
          account.metadata = {
            ...(account.metadata || {}),
            ...(details.metadata || {})
          };
        }
        finalAccounts.push(account);
      }
    } catch (e) {
      this.error('[Hana] 계좌 상세 수집 루프 실행 중 실패:', e.message);
      // 예외 발생 시 드롭다운 계좌들이라도 누락 없이 반환
      if (finalAccounts.length === 0) {
        return accounts;
      }
    } finally {
      // 5. 원래 거래내역조회 페이지로 안전하게 복귀!
      try {
        await this.navigateToTransactionQueryPage();
      } catch (e) {
        this.warn('[Hana] 거래내역조회 페이지 복귀 실패:', e.message);
      }
    }

    return finalAccounts;
  }

  /**
   * 계좌상세조회(보유계좌 조회) 페이지로 네비게이션을 시도합니다.
   * @returns {Promise<import('playwright-core').Frame>}
   */
  async navigateToAccountDetailsPage() {
    this.log('[Hana] 계좌상세조회(보유계좌 조회) 페이지로 네비게이션을 시도합니다...');
    let frame = this.page.frame({ name: 'hanaMainframe' }) || this._hanaFrame();
    if (!frame) {
      await this.page.waitForTimeout(2000);
      frame = this.page.frame({ name: 'hanaMainframe' }) || this._hanaFrame();
    }
    if (!frame) {
      throw new Error('hanaMainframe not found during page navigation');
    }

    // 팝업 닫기
    await this._closeHanaPopups();

    // 1. GNB '조회' 대메뉴 클릭 ([id="15000"])
    try {
      await frame.locator('[id="15000"]').click({ timeout: 10000 });
      this.log('[Hana] GNB "조회" 버튼 클릭 완료');
    } catch (e) {
      try {
        await this.page.getByRole('link', { name: '조회' }).click({ timeout: 10000 });
        this.log('[Hana] GNB "조회" 롤 버튼 클릭 완료');
      } catch (err) {
        await frame.evaluate(() => {
          const el = document.getElementById('15000');
          if (el) el.click();
        });
      }
    }
    await this.page.waitForTimeout(1500);

    // 2. '보유계좌 조회' 서브메뉴 클릭
    try {
      await frame.locator('a:has-text("보유계좌 조회")').click({ timeout: 10000 });
      this.log('[Hana] "보유계좌 조회" 링크 클릭 완료');
    } catch (e) {
      await frame.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const target = links.find(a => a.textContent.trim() === '보유계좌 조회');
        if (target) {
          target.click();
        } else {
          const hrefTarget = Array.from(document.querySelectorAll('a')).find(a => a.getAttribute('href')?.includes('wcdep700r16i'));
          if (hrefTarget) hrefTarget.click();
        }
      });
    }
    await this.page.waitForTimeout(3000);

    // 3. '전체계좌' 탭 클릭
    try {
      await frame.locator('a:has-text("전체계좌")').click({ timeout: 10000 });
      this.log('[Hana] "전체계좌" 탭 클릭 완료');
    } catch (e) {
      await frame.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a'));
        const target = tabs.find(a => a.textContent.trim() === '전체계좌');
        if (target) target.click();
      });
    }
    await this.page.waitForTimeout(3000);
    this.log('[Hana] ✓ 보유계좌 조회 (전체계좌 탭) 페이지 로딩 및 진입 완료.');
    return frame;
  }

  /**
   * 원래의 거래내역조회 페이지로 복귀합니다.
   */
  async navigateToTransactionQueryPage() {
    this.log('[Hana] 거래내역조회 페이지로 복귀합니다...');
    let frame = this.page.frame({ name: 'hanaMainframe' }) || this._hanaFrame();
    if (!frame) return;

    await this._closeHanaPopups();

    // GNB '조회' 클릭
    try {
      await frame.locator('[id="15000"]').click({ timeout: 5000 });
    } catch (e) {
      try {
        await this.page.getByRole('link', { name: '조회' }).click({ timeout: 5000 });
      } catch (err) {}
    }
    await this.page.waitForTimeout(1000);

    // GNB '거래내역 조회' 클릭
    try {
      await frame.locator('a[href*="menuItemId=wcdep700r16i"]').first().click({ timeout: 5000 });
      this.log('[Hana] "거래내역 조회" 링크 클릭 완료');
    } catch (e) {
      await frame.evaluate(() => {
        const links = document.querySelectorAll('a, button, span');
        for (const a of links) {
          const txt = a.textContent.trim();
          if ((txt === '거래내역 조회' || txt === '거래내역조회') && a.offsetParent !== null) {
            a.click();
            return;
          }
        }
      });
    }
    await this.page.waitForTimeout(2000);
    this.log('[Hana] ✓ 거래내역조회 페이지 복귀 완료.');
  }

  /**
   * 보유계좌 조회 페이지의 전체 테이블을 스크래핑하여 모든 계좌의 추가 정보(예금주명, 예금종류, 신규일자, 약정금액 등)를 획득합니다.
   * @param {object} frame 
   * @returns {Promise<object>}
   */
  async scrapeAllAccountDetails(frame) {
    this.log('[Hana] 보유계좌 목록 테이블 스크래핑 시작...');
    const result = await frame.evaluate(() => {
      const accountsMap = {};

      const tables = Array.from(document.querySelectorAll('table'));
      
      for (const table of tables) {
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim().replace(/\s+/g, ' '));
        if (headers.length === 0) continue;

        const rows = Array.from(table.querySelectorAll('tbody tr'));
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
          if (cells.length === 0) continue;

          const rowData = {};
          headers.forEach((header, idx) => {
            if (cells[idx] !== undefined) {
              rowData[header] = cells[idx];
            }
          });

          let acctNoRaw = '';
          let acctName = '';
          let openDate = '';
          let accountStatus = '활동';
          let branchName = '';
          let isLimitAccount = 'NO';
          let payableAmount = '';
          let contractAmount = '';

          // 1. 예금/신탁 테이블
          if (headers.includes('[별칭] 계좌명') && headers.includes('계좌번호')) {
            acctName = rowData['[별칭] 계좌명'] || '';
            acctNoRaw = rowData['계좌번호'] || '';
            openDate = rowData['신규일'] || '';
            
            const allText = row.textContent || '';
            if (allText.includes('거래중지')) {
              accountStatus = '거래중지';
            } else if (allText.includes('해지')) {
              accountStatus = '해지';
            }

            // 지급가능잔액/출금가능잔액 컬럼 자동 검색 및 대입
            const payableKey = headers.find(h => h.includes('지급가능') || h.includes('출금가능') || h.includes('지급 가능') || h.includes('출금 가능'));
            if (payableKey) {
              payableAmount = rowData[payableKey] || '';
            }

            // 약정금액/한도금액 컬럼 자동 검색 및 대입
            const contractKey = headers.find(h => h.includes('약정금액') || h.includes('약정한도') || h.includes('한도금액') || h.includes('한도 제한') || h.includes('대출한도') || h.includes('약정 한도'));
            if (contractKey) {
              contractAmount = rowData[contractKey] || '';
            }
          }
          // 2. 대출 테이블
          else if (headers.includes('대출종류/계좌번호')) {
            const firstCellText = rowData['대출종류/계좌번호'] || '';
            const parts = firstCellText.split(/\s+/).map(p => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
              acctName = parts[0];
              acctNoRaw = parts[1];
            } else {
              acctNoRaw = firstCellText;
            }
            openDate = rowData['신규일'] || '';
            contractAmount = rowData['약정한도'] || '';

            const payableKey = headers.find(h => h.includes('지급가능') || h.includes('출금가능') || h.includes('지급 가능') || h.includes('출금 가능'));
            if (payableKey) {
              payableAmount = rowData[payableKey] || '';
            }
          }
          // 3. 기타 일반적인 계좌 테이블
          else {
            const acctColIdx = headers.findIndex(h => h.includes('계좌번호') || h.includes('계좌 번호'));
            if (acctColIdx !== -1) {
              acctNoRaw = cells[acctColIdx];
              
              const nameColIdx = headers.findIndex(h => h.includes('계좌명') || h.includes('상품명') || h.includes('종류'));
              if (nameColIdx !== -1) acctName = cells[nameColIdx];

              const openColIdx = headers.findIndex(h => h.includes('신규일') || h.includes('개설일'));
              if (openColIdx !== -1) openDate = cells[openColIdx];

              const payableKey = headers.find(h => h.includes('지급가능') || h.includes('출금가능') || h.includes('지급 가능') || h.includes('출금 가능'));
              if (payableKey && cells[headers.indexOf(payableKey)] !== undefined) {
                payableAmount = cells[headers.indexOf(payableKey)];
              }

              const contractKey = headers.find(h => h.includes('약정금액') || h.includes('약정한도') || h.includes('한도금액') || h.includes('한도 제한') || h.includes('대출한도') || h.includes('약정 한도'));
              if (contractKey && cells[headers.indexOf(contractKey)] !== undefined) {
                contractAmount = cells[headers.indexOf(contractKey)];
              }
            }
          }

          if (acctNoRaw) {
            const cleanAcctNo = acctNoRaw.split(/\s+/)[0].replace(/[^0-9-]/g, '').trim();
            if (cleanAcctNo) {
              // 줄바꿈 및 다중 공백 제거, 거래중지/해지 등의 부가 텍스트를 제거하여 순수 상품명 정제
              let cleanAcctName = acctName ? acctName.replace(/\s+/g, ' ').trim() : 'checking';
              cleanAcctName = cleanAcctName.replace(/거래중지/g, '').replace(/해지/g, '').trim();

              if (cleanAcctName.includes('한도제한') || cleanAcctName.includes('한도 제한')) {
                isLimitAccount = 'YES';
              }

              accountsMap[cleanAcctNo] = {
                accountNumber: cleanAcctNo,
                customerName: '', 
                accountType: cleanAcctName,
                openDate: openDate ? openDate.replace(/\s+/g, '').trim() : null,
                metadata: {
                  accountStatus,
                  branchName,
                  isLimitAccount,
                  payableAmount: payableAmount ? payableAmount.replace(/\s+/g, '').trim() : '',
                  contractAmount: contractAmount ? contractAmount.replace(/\s+/g, '').trim() : ''
                }
              };
            }
          }
        }
      }

      return accountsMap;
    });

    this.log(`[Hana] 스크래핑 완료. 총 ${Object.keys(result).length}개 계좌 상세 정보 획득.`);
    return result;
  }

  /**
   * 단일 계좌 정보 조회용 호환성 래퍼 메서드
   */
  async getAccountAdditionalInfo(accountNumber) {
    this.log(`[Hana] 단일 getAccountAdditionalInfo(${accountNumber}) 요청 수신.`);
    try {
      const frame = await this.navigateToAccountDetailsPage();
      const detailsMap = await this.scrapeAllAccountDetails(frame);
      await this.navigateToTransactionQueryPage();

      const cleanNo = accountNumber.replace(/-/g, '');
      const matchKey = Object.keys(detailsMap).find(k => k.replace(/-/g, '') === cleanNo);
      return matchKey ? detailsMap[matchKey] : null;
    } catch (e) {
      this.error(`[Hana] 단일 getAccountAdditionalInfo 실패:`, e.message);
      return null;
    }
  }

  _sanitizeHanaFilenamePart(s) {
    const t = String(s || 'account').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    return t.slice(0, 80);
  }

  _findRecentHanaExportFileSince(sinceMs) {
    const dirs = [this.downloadDir, path.join(this.outputDir, 'corporate-cert-downloads')];
    const hits = [];
    for (const dir of dirs) {
      try {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          if (!ent.isFile()) continue;
          if (!/\.(xls|xlsx|csv)$/i.test(ent.name)) continue;
          const p = path.join(dir, ent.name);
          const st = fs.statSync(p);
          if (st.mtimeMs >= sinceMs - 2000) {
            hits.push({ path: p, mtimeMs: st.mtimeMs, size: st.size });
          }
        }
      } catch (e) {
        this.warn('Hana: fallback file scan failed for', dir, e?.message || e);
      }
    }
    hits.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return hits[0] || null;
  }

  /**
   * hana.spec.js — frame, account select, sInqStrDt, 조회, 전체엑셀다운로드 / fallbacks
   */
  async getTransactions(accountNumber, startDate, endDate) {
    if (!this.page) throw new Error('Browser page not initialized');
    const sessionActive = await this.ensureSession();
    if (!sessionActive) {
      return { success: false, sessionExpired: true, error: '세션이 만료되었습니다. 다시 로그인해주세요.' };
    }
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
        const acctSelect = scope.locator(`select[id="${idEsc}"]`);
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
          this.log(`Hana: account select id=${acctSelectId}, pickedValue=${picked}`);
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
      this.log(`Hana: startDate input set to ${startDateStr}`);
      await this.page.waitForTimeout(400);

      try {
        await frame.evaluate(() => {
          const el = document.getElementById('ID_sRqstNcnt4');
          if (el) el.value = '100';
        });
      } catch (e) {}

      try {
        await frame.locator('button:has-text("조회")').click({ timeout: 5000 });
        this.log('Hana: search click via text("조회")');
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
        this.log('Hana: search click via frame evaluate fallback');
      }
      await this.page.waitForTimeout(3000);
      this.log('Hana: search wait complete');

      // [개선] 메인 페이지와 프레임 모두에서 에러 메시지 감지 (조회 기간 및 개설일 관련)
      const checkError = async (target) => {
        if (!target) return false;
        return await target.evaluate(() => {
          const body = document.body.textContent || '';
          return (
            body.includes('계좌 개설일보다 과거를 선택할 수 없습니다') || 
            body.includes('조회시작일이 계좌개설일') ||
            body.includes('조회기간은') ||
            body.includes('과거 일자를 선택')
          );
        }).catch(() => false);
      };

      const dateErrorPage = await checkError(this.page);
      const dateErrorFrame = await checkError(frame);

      if (dateErrorPage || dateErrorFrame) {
        this.warn('Hana: date error detected, retrying with yesterday');
        // [개선] 특정 프레임의 버튼이 아닌 전체 팝업 닫기 로직 사용 (메인 페이지 팝업 대응)
        await this._closeHanaPopups();
        await this.page.waitForTimeout(800);
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
          this.log('Hana: retry search click via text("조회")');
        } catch (e) {}
        await this.page.waitForTimeout(3000);
        this.log(`Hana: retry search complete with startDate=${yStr}`);
      }

      await this.page.waitForTimeout(2000); // [추가] 로딩 대기 시간: 오판 방지용

      // [정밀화] 명확하게 지정된 문구만 감지
      const earlyNoData = await frame.evaluate(() => {
        const targetPhrases = ['조회 결과가 없습니다', '조회결과가 없습니다'];
        
        // 보이는 모든 요소에서 정확한 문구 검색
        const allElements = document.querySelectorAll('div, span, p, td, th, li');
        for (const el of allElements) {
          if (el.offsetParent !== null) { // 현재 화면에 보이는 요소만
            const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if (targetPhrases.some(phrase => text.includes(phrase))) return true;
          }
        }
        return false;
      });

      if (earlyNoData) {
        this.log('Hana: confirmed "조회 결과가 없습니다" (Graceful Exit)');
        // [개선] 특정 프레임의 버튼이 아닌 전체 팝업 닫기 로직 사용
        await this._closeHanaPopups();
        return [];
      }

      await this.focusPlaywrightPage();
      this.log('Hana: focused page, waiting for next download event');
      const exportStartedAt = Date.now();
      
      // context 대신 page 이벤트를 기다리는 hana.spec.js 방식 시도
      const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 }).catch(() => null);

      // 다운로드 버튼 클릭
      try {
        await frame.locator('button:has-text("전체엑셀다운로드")').click({ timeout: 5000 });
        this.log('Hana: clicked export button');
      } catch (e) {
        try {
          await frame.locator('button:has-text("엑셀다운로드")').click({ timeout: 5000 });
        } catch (e2) {
          await frame.locator('button:has-text("엑셀")').first().click({ timeout: 5000 });
        }
      }

      let download = null;
      let fallbackFile = null;

      // 5초 동안 이벤트가 발생하는지 레이싱
      const result = await Promise.race([
        downloadPromise,
        this.page.waitForTimeout(5000).then(() => 'timeout')
      ]);

      if (result === 'timeout' || !result) {
        this.log('Hana: download event not received within 5s, checking for no-data popup...');
        const noDataMsg = await frame.evaluate(() => {
          const body = document.body.textContent || '';
          return (
            body.includes('조회된 내역이 없습니다') ||
            body.includes('조회 내역이 없습니다') ||
            body.includes('저장할 데이터가 없습니다') ||
            body.includes('조회결과가 없습니다') ||
            body.includes('거래내역이 없습니다') ||
            body.includes('조회된 데이터가 없습니다')
          );
        });

        if (noDataMsg) {
          this.log('Hana: confirmed no data via message check (Graceful Exit)');
          // [개선] 특정 프레임의 버튼이 아닌 전체 팝업 닫기 로직 사용
          await this._closeHanaPopups();
          return [];
        }

        this.log('Hana: no-data popup not found, checking filesystem for GUID files...');
        // 이벤트는 안 떴지만 파일은 이미 생성되었을 수 있으므로 즉시 스캔
        fallbackFile = this._findRecentHanaExportFileSince(exportStartedAt);
        
        if (!fallbackFile) {
          this.log('Hana: still no file, waiting a bit more for download event...');
          download = await downloadPromise; // 최종 대기
        }
      } else {
        download = result;
      }

      if (!download && !fallbackFile) {
        // 마지막 수단으로 다시 한번 파일 시스템 체크
        fallbackFile = this._findRecentHanaExportFileSince(exportStartedAt);
      }

      if (download) {
        this.log(`Hana: download event received (${download.suggestedFilename()})`);
      } else if (fallbackFile) {
        this.log(`Hana: found fallback file on disk (${path.basename(fallbackFile.path)})`);
      } else {
        this.error('Hana: failed to catch download via event or filesystem');
        return [];
      }

      const suggested = (download && download.suggestedFilename()) || (fallbackFile && path.basename(fallbackFile.path)) || 'hana-export.xls';
      const ext = path.extname(suggested) || '.xls';
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safeAcc = this._sanitizeHanaFilenamePart(accountNumber);
      
      // 한글 파일명 오류 방지를 위해 영문 접두사 사용
      const finalName = `HanaBank_${safeAcc}_${ts}${ext}`;
      const finalPath = path.join(this.downloadDir, finalName);
      
      if (download) {
        try {
          const tempPath = await download.path();
          if (tempPath && fs.existsSync(tempPath)) {
            this.log(`Hana: Moving download from ${tempPath} to ${finalPath}`);
            fs.copyFileSync(tempPath, finalPath);
            // 복사 성공 후 임시 파일 삭제 시도 (실패해도 무방)
            try { fs.unlinkSync(tempPath); } catch (e) {}
          } else {
            // tempPath가 없거나 접근 불가하면 saveAs 시도
            await download.saveAs(finalPath);
          }
        } catch (saveErr) {
          this.warn(`Hana: Primary save failed (${saveErr.message}), trying fallback saveAs...`);
          await download.saveAs(finalPath).catch(e => this.error('Hana: saveAs also failed:', e.message));
        }
      } else if (fallbackFile && fallbackFile.path !== finalPath) {
        fs.copyFileSync(fallbackFile.path, finalPath);
      }
      
      if (fs.existsSync(finalPath)) {
        this.log(`Hana: download successfully saved to ${finalPath}`);
      } else {
        this.error(`Hana: failed to save file at ${finalPath}`);
      }

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

  // ============================================================================
  // 하나 상품가입•대출 → 대출조회 → 거래내역/대출계산서 조회
  // ============================================================================

  /**
   * Navigate to 하나 대출상세내역 (거래내역/대출계산서 조회) and download Excel.
   * @param {object} opts
   * @param {string} [opts.startDate] YYYYMMDD
   * @param {string} [opts.endDate]   YYYYMMDD
   * @returns {Promise<{ success: boolean, filePath?: string|null, error?: string }>}
   */
  async syncLoanHistory({ startDate, endDate } = {}) {
    if (!this.page) {
      return { success: false, error: '브라우저 페이지가 없습니다.' };
    }
    // De-duplicate: the UI calls this once per account, so it fires N times.
    // Only run the full sync once; subsequent calls within 5 min return cached result.
    const now = Date.now();
    const DEBOUNCE_MS = 5 * 60 * 1000;
    if (this._loanHistoryLastSync && (now - this._loanHistoryLastSync) < DEBOUNCE_MS) {
      this.log('[Hana loan] syncLoanHistory skipped — already ran recently');
      return {
        success: true,
        filePath: this._loanHistoryLastPaths?.[0] ?? null,
        filePaths: this._loanHistoryLastPaths ?? [],
        message: 'Already synced recently (debounced).',
      };
    }
    this._loanHistoryLastSync = now;
    this._loanHistoryLastPaths = [];
    this.log('Hana: syncLoanHistory (대출상세내역) 시작...');

    try {
      let frame = await this._waitForHanaMainframe();
      await this._closeHanaPopups();

      // ── Top nav: 상품가입•대출 ──────────────────────────────────────────────
      const loanNavClicked = await (async () => {
        const candidates = [
          () => this.page.locator('a').filter({ hasText: /^상품가입[•・]대출$/ }).first(),
          () => this.page.locator('a').filter({ hasText: '상품가입' }).first(),
          () => frame.locator('a').filter({ hasText: /상품가입/ }).first(),
        ];
        for (const get of candidates) {
          try {
            const el = get();
            const visible = await el.isVisible({ timeout: 2000 }).catch(() => false);
            if (!visible) continue;
            await el.hover({ force: true });
            await this.page.waitForTimeout(300);
            await el.click({ timeout: 4000 });
            return true;
          } catch (e) {
            this.warn('[Hana loan] 상품가입•대출 candidate failed:', e.message);
          }
        }
        return false;
      })();
      if (!loanNavClicked) {
        this.warn('[Hana loan] 상품가입•대출 top-nav click failed — proceeding anyway');
      }
      await this.page.waitForTimeout(1500);

      // ── Hover 대출조회 to expand its submenu ────────────────────────────────
      try {
        const loanInquiry = this.page.locator('a').filter({ hasText: /^대출조회$/ }).first();
        await loanInquiry.hover({ force: true });
        await this.page.waitForTimeout(400);
      } catch (e) {
        this.warn('[Hana loan] 대출조회 hover failed:', e.message);
      }

      // ── 거래내역/대출계산서 조회 (re-hover parent then click child) ─────────
      try {
        const loanInquiry = this.page.locator('a').filter({ hasText: /^대출조회$/ }).first();
        await loanInquiry.hover({ force: true });
        await this.page.waitForTimeout(200);
        const target = this.page.locator('a').filter({ hasText: /거래내역.*대출계산서|대출계산서.*거래내역/ }).first();
        await target.waitFor({ state: 'visible', timeout: 5000 });
        await target.hover({ force: true });
        await this.page.waitForTimeout(200);
        await target.click({ timeout: 5000 });
      } catch (e) {
        this.warn('[Hana loan] 거래내역/대출계산서 조회 click failed, trying frame evaluate:', e.message);
        await frame.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const t = links.find(a => /거래내역.*계산서|계산서.*거래내역/.test(a.textContent || ''));
          if (t) t.click();
        }).catch(() => {});
      }
      await this.page.waitForTimeout(3000);

      frame = this._hanaFrame() || frame;

      // ── Enumerate all accounts ──────────────────────────────────────────────
      const accountNames = [];
      try {
        const accountDropdown = frame.locator('.selected').first();
        await accountDropdown.waitFor({ state: 'visible', timeout: 5000 });
        await accountDropdown.click({ timeout: 5000 });
        this.log('[Hana loan] Opened account dropdown for enumeration');
        await this.page.waitForTimeout(800);
        const allTitles = frame.locator('.seltitle');
        const titleCount = await allTitles.count();
        for (let i = 0; i < titleCount; i++) {
          const text = (await allTitles.nth(i).innerText().catch(() => '')).trim();
          if (text && text !== '계좌선택') {
            accountNames.push(text);
          }
        }
        // Close dropdown without selecting anything
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(300);
        this.log(`[Hana loan] Found ${accountNames.length} account(s): ${accountNames.join(', ')}`);
      } catch (e) {
        this.warn('[Hana loan] Account enumeration failed:', e.message);
      }

      if (accountNames.length === 0) {
        return { success: false, error: '계좌를 찾을 수 없습니다.' };
      }

      // ── Pre-compute date range (same for all accounts) ──────────────────────
      const fmt = (yyyymmdd) =>
        `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
      const today = new Date();
      const defaultEnd = today.toISOString().slice(0, 10);
      const defaultStart = new Date(today.getTime() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const startVal = startDate ? fmt(startDate) : defaultStart;
      const endVal = endDate ? fmt(endDate) : defaultEnd;

      const downloadedPaths = [];

      for (const accountName of accountNames) {
        this.log(`[Hana loan] ── Processing account: ${accountName} ──`);
        try {

          // ── Select this account ───────────────────────────────────────────
          try {
            const accountDropdown = frame.locator('.selected').first();
            await accountDropdown.waitFor({ state: 'visible', timeout: 5000 });
            await accountDropdown.click({ timeout: 5000 });
            await this.page.waitForTimeout(800);
            const allTitles = frame.locator('.seltitle');
            const titleCount = await allTitles.count();
            let selected = false;
            for (let i = 0; i < titleCount; i++) {
              const text = (await allTitles.nth(i).innerText().catch(() => '')).trim();
              if (text === accountName) {
                await allTitles.nth(i).click({ timeout: 5000 });
                this.log(`[Hana loan] Selected account: ${text}`);
                selected = true;
                break;
              }
            }
            if (!selected) {
              this.warn(`[Hana loan] Could not find account "${accountName}" in dropdown — skipping`);
              continue;
            }
            await this.page.waitForTimeout(1500);
          } catch (e) {
            this.warn('[Hana loan] Account selection failed:', e.message);
            continue;
          }

          // ── 실행번호 popup ────────────────────────────────────────────────
          try {
            await frame.locator('[id="numSearchDiv"]').click({ timeout: 5000 });
            this.log('[Hana loan] Opened 실행번호 popup');
            await this.page.waitForTimeout(3000);

            const hasData = await frame.locator('.GMBodyMid').first().isVisible().catch(() => false);
            if (!hasData) {
              this.log('[Hana loan] 실행번호 popup has no data rows — closing and skipping selection');
              let popupClosed = false;
              try {
                await this.page.evaluate(() => ocp.common.layerpopup.closeLayer_fnc('openPopupLoanExecNoSearch'));
                popupClosed = true;
                this.log('[Hana loan] Popup closed via ocp.common.layerpopup (page context)');
              } catch (_) {}
              if (!popupClosed) {
                try {
                  await frame.evaluate(() => ocp.common.layerpopup.closeLayer_fnc('openPopupLoanExecNoSearch'));
                  popupClosed = true;
                  this.log('[Hana loan] Popup closed via ocp.common.layerpopup (frame context)');
                } catch (_) {}
              }
              if (!popupClosed) {
                this.log('[Hana loan] JS close failed — falling back to direct DOM hide');
                await frame.evaluate(() => {
                  const popup = document.getElementById('openPopupLoanExecNoSearch');
                  const mask = document.getElementById('openPopupLoanExecNoSearchocp_modalMaskID_generatedByJS');
                  if (popup) popup.style.display = 'none';
                  if (mask) mask.style.display = 'none';
                }).catch(() => {});
              }
              await this.page.waitForTimeout(1000);
            } else {
              try {
                await frame.locator('td.GMBool2').first().click({ timeout: 5000 });
                this.log('[Hana loan] 실행번호 선택 checkbox clicked');
              } catch (e) {
                try {
                  await this.page.locator('td.GMBool2').first().click({ timeout: 5000 });
                  this.log('[Hana loan] 실행번호 선택 checkbox clicked (page context)');
                } catch (e2) {
                  this.warn('[Hana loan] 선택 checkbox click failed:', e2.message);
                }
              }
              await this.page.waitForTimeout(1000);
              try {
                await frame.locator('a:has-text("확인")').first().click({ timeout: 5000 });
              } catch (e) {
                await this.page.locator('a:has-text("확인")').first().click({ timeout: 5000 })
                  .catch(() => this.warn('[Hana loan] 확인 click failed entirely'));
              }
              this.log('[Hana loan] 실행번호 selected and confirmed');
              await this.page.waitForTimeout(2000);
            }
          } catch (e) {
            this.warn('[Hana loan] 실행번호 popup flow failed:', e.message);
          }

          // ── Date range ────────────────────────────────────────────────────
          try {
            await frame.locator('[id="inqStrDt"]').fill(startVal);
            await frame.locator('[id="inqEndDt"]').fill(endVal);
            this.log(`Hana loan: date range set (${startVal} ~ ${endVal})`);
          } catch (e) {
            try {
              await frame.evaluate(
                ({ s, e }) => {
                  const setInput = (id, val) => {
                    const el = document.getElementById(id);
                    if (!el) return false;
                    el.value = val;
                    ['input', 'change'].forEach((ev) =>
                      el.dispatchEvent(new Event(ev, { bubbles: true })),
                    );
                    if (typeof el.onchange === 'function') el.onchange();
                    return true;
                  };
                  setInput('inqStrDt', s) || setInput('sInqStrDt', s) || setInput('startDate', s);
                  setInput('inqEndDt', e) || setInput('sInqEndDt', e) || setInput('endDate', e);
                },
                { s: startVal, e: endVal },
              );
              this.log(`Hana loan: date range set via evaluate (${startVal} ~ ${endVal})`);
            } catch (e2) {
              this.warn('Hana loan: date range set failed:', e2.message);
            }
          }
          await this.page.waitForTimeout(500);

          // ── 조회 ──────────────────────────────────────────────────────────
          try {
            await frame.evaluate(() =>
              cpb.loan.inquiry.transaction.searchInquiry(document.forms['wclon700_02iForm']),
            );
            this.log('[Hana loan] 조회 triggered via frame evaluate');
          } catch (e) {
            this.warn('[Hana loan] 조회 evaluate failed, falling back to click:', e.message);
            await frame.locator('a.btn').filter({ hasText: /^조회$/ }).first()
              .click({ timeout: 5000 })
              .catch(() => {});
          }
          await this.page.waitForTimeout(4000);

          // ── No-data check ─────────────────────────────────────────────────
          const isEmpty = await frame
            .evaluate(() => {
              const body = document.body?.textContent || '';
              return (
                body.includes('조회된 내역이 없습니다') ||
                body.includes('조회 내역이 없습니다') ||
                body.includes('저장할 데이터가 없습니다') ||
                body.includes('조회결과가 없습니다') ||
                body.includes('거래내역이 없습니다') ||
                body.includes('조회된 데이터가 없습니다')
              );
            })
            .catch(() => false);
          if (isEmpty) {
            this.log(`[Hana loan] No data for account ${accountName} — skipping`);
            continue;
          }

          // ── Excel download ─────────────────────────────────────────────────
          const exportStartedAt = Date.now();
          const downloadPromise = this.page.waitForEvent('download', { timeout: 60000 });

          try {
            await frame.locator('a:has-text("전체엑셀다운로드")').click({ timeout: 5000 });
          } catch (e) {
            try {
              await frame.locator('a:has-text("엑셀다운로드"), button:has-text("엑셀다운로드")').first().click({ timeout: 5000 });
            } catch (e2) {
              await frame
                .evaluate(() => {
                  const btn = Array.from(document.querySelectorAll('button,a')).find((b) =>
                    /엑셀/.test(b.textContent || ''),
                  );
                  if (btn) btn.click();
                })
                .catch(() => {});
            }
          }

          let download = null;
          let fallbackFile = null;

          const dlResult = await Promise.race([
            downloadPromise,
            this.page.waitForTimeout(5000).then(() => 'timeout'),
          ]);

          if (dlResult === 'timeout' || !dlResult) {
            fallbackFile = this._findRecentHanaExportFileSince(exportStartedAt);
            if (!fallbackFile) {
              download = await downloadPromise.catch(() => null);
            }
          } else {
            download = dlResult;
          }

          if (!download && !fallbackFile) {
            fallbackFile = this._findRecentHanaExportFileSince(exportStartedAt);
          }

          if (!download && !fallbackFile) {
            this.warn(`[Hana loan] Download failed for account ${accountName} — skipping`);
            continue;
          }

          const suggested =
            (download && download.suggestedFilename()) ||
            (fallbackFile && path.basename(fallbackFile.path)) ||
            'hana-loan-history.xls';
          const ext = path.extname(suggested) || '.xls';
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const safeAcct = accountName.replace(/[^a-zA-Z0-9가-힣_\-]/g, '_');
          const finalName = `Hana_대출상세내역_${safeAcct}_${ts}${ext}`;
          const finalPath = path.join(this.downloadDir, finalName);

          if (download) {
            try {
              const tempPath = await download.path();
              if (tempPath && fs.existsSync(tempPath)) {
                fs.copyFileSync(tempPath, finalPath);
                try { fs.unlinkSync(tempPath); } catch (e) {}
              } else {
                await download.saveAs(finalPath);
              }
            } catch (saveErr) {
              this.warn(`Hana loan: primary save failed (${saveErr.message}), trying saveAs...`);
              await download.saveAs(finalPath).catch((e) => this.error('Hana loan: saveAs also failed:', e.message));
            }
          } else if (fallbackFile && fallbackFile.path !== finalPath) {
            fs.copyFileSync(fallbackFile.path, finalPath);
          }

          if (!fs.existsSync(finalPath)) {
            this.warn(`[Hana loan] File save failed for account ${accountName} — skipping`);
            continue;
          }

          this.log(`[Hana loan] Downloaded: ${finalPath}`);
          downloadedPaths.push(finalPath);

        } catch (err) {
          this.warn(`[Hana loan] Account ${accountName} processing failed:`, err.message);
        }
      } // end for-of accountNames

      this._loanHistoryLastPaths = downloadedPaths;
      return {
        success: true,
        filePath: downloadedPaths[0] || null,
        filePaths: downloadedPaths,
        message: `Hana loan history downloaded for ${downloadedPaths.length} account(s).`,
      };
    } catch (error) {
      this.error('Hana syncLoanHistory failed:', error.message);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getTransactionsWithParsing(accountNumber, startDate, endDate) {
    const downloadResult = await this.getTransactions(accountNumber, startDate, endDate);
    
    // [수정] 내역 없음(Graceful Exit) 시 실패가 아닌 성공으로 반환
    if (!downloadResult || downloadResult.length === 0) {
      this.log('Hana: getTransactions returned empty (no data), returning success with empty transactions.');
      return {
        success: true,
        transactions: [],
        metadata: { bankName: '하나은행', accountNumber, totalCount: 0 },
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

function createHanaAutomator(options = {}) {
  return new HanaBankAutomator(options);
}

module.exports = {
  HanaBankAutomator,
  createHanaAutomator,
};
