const path = require('path');
const { BaseBankAutomator } = require('../../core/BaseBankAutomator');
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

  async _wooriClickCertTableCell() {
    const certLabel = process.env.CERT_EXPIRY || process.env.WOORI_CERT_ROW_LABEL || '2026-08-15';
    try {
      const locator = this.page.getByRole('div', { name: certLabel });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
    } catch (error) {
      try {
        const fallbackLocator = this.page.locator('.xwup-tableview-cell');
        await fallbackLocator.hover({ force: true });
        await fallbackLocator.click({ timeout: 5000 });
      } catch (error2) {
        const xpathLocator = this.page.locator(
          'xpath=/html/body/div[1]/div/div[2]/div[3]/table/tbody/tr[1]/td[3]/div'
        );
        await xpathLocator.hover({ force: true });
        await xpathLocator.click();
      }
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

      try {
        await this.page.getByRole('link', { name: '조회' }).click({ timeout: 5000 });
      } catch (e) {
        await this.page.locator('header a').filter({ hasText: '조회' }).first().click({ timeout: 5000 });
      }
      await this.page.waitForTimeout(2000);
      try {
        await this.page.getByRole('link', { name: '거래내역조회' }).click({ timeout: 5000 });
      } catch (e) {
        await this.page.locator('a').filter({ hasText: '거래내역조회' }).first().click({ timeout: 5000 });
      }
      await this.page.waitForTimeout(3000);

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
}

function createWooriAutomator(options = {}) {
  return new WooriBankAutomator(options);
}

module.exports = {
  WooriBankAutomator,
  createWooriAutomator,
};
