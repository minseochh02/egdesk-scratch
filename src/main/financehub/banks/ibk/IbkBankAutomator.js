const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
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
      const { browser, context } = await this.createBrowser(proxy);
      this.browser = browser;
      this.context = context;
      await this.setupBrowserContext(context, null);
      this.page = await context.newPage();
      await this.setupBrowserContext(context, this.page);

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

      const accounts = await this._getIbKAccounts(activeFrame);
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

  async _getIbKAccounts(frame) {
    if (!frame) return [];
    const acctSelect = frame.locator('[id="ecb_user_num01"]');
    if ((await acctSelect.count()) === 0) return [];
    const rows = await acctSelect.evaluate((sel) =>
      Array.from(sel.options)
        .filter((o) => o.value)
        .map((o) => ({ text: (o.textContent || '').trim(), value: o.value }))
    );
    const accounts = [];
    const seen = new Set();
    const re = /(\d{3}-\d{2,4}-\d{4,7})/;
    for (const row of rows) {
      const m = row.text.match(re);
      if (!m) continue;
      const accountNumber = m[1];
      const key = accountNumber.replace(/-/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      accounts.push({
        accountNumber,
        accountName: row.text.replace(accountNumber, '').trim() || 'IBK 기업 계좌',
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
    return this._getIbKAccounts(this._mainFrame());
  }
}

function createIbkAutomator(options = {}) {
  return new IbkBankAutomator(options);
}

module.exports = {
  IbkBankAutomator,
  createIbkAutomator,
};
