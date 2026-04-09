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

  /**
   * Debug: only the cert row labeled 2026-08-15 (no .xwup-tableview-cell / XPath fallbacks).
   * Logs id / class / text / approximate xpath for cert-related nodes before clicking.
   */
  async _logWooriCertSelectionDebug() {
    const dump = await this.page.evaluate(() => {
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
      document.querySelectorAll('div, td, span, a, button').forEach((el) => {
        const t = (el.textContent || '').trim();
        if (!t.includes('2026-08-15')) return;
        if (textHits.length >= 25) return;
        textHits.push({ ...snippet(el), xpathApprox: xpathFor(el) });
      });

      return { cellCount: cells.length, cells: cellInfo, textHitsContainingDate: textHits };
    });
    this.log('[WOORI DEBUG] .xwup-tableview-cell count=', dump.cellCount);
    for (let i = 0; i < dump.cells.length; i++) {
      this.log(`[WOORI DEBUG] cell[${i}]`, JSON.stringify(dump.cells[i]));
    }
    for (let i = 0; i < dump.textHitsContainingDate.length; i++) {
      this.log(`[WOORI DEBUG] textHit[${i}] (contains 2026-08-15)`, JSON.stringify(dump.textHitsContainingDate[i]));
    }
  }

  /**
   * Same cascade as woori.spec.js STEP 4: getByRole → .xwup-tableview-cell → XPath.
   * getByRole can be count=0 when the date cell has no accessible name in this Chromium build;
   * the spec still works because catch #2 uses the recorded XPath to tr[1]/td[3]/div (expiry column).
   */
  async _wooriClickCertTableCell() {
    const TARGET = '2026-08-15';
    if (process.env.WOORI_DEBUG_CERT === '1') {
      await this._logWooriCertSelectionDebug();
    }

    try {
      const locator = this.page.getByRole('div', { name: TARGET });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      this.log(`[WOORI] cert row: getByRole('div', { name: '${TARGET}' })`);
    } catch (error) {
      this.warn('[WOORI] getByRole failed (common in Electron — a11y name may differ):', error.message);
      try {
        const table = this.page.locator('#xwup_cert_table');
        const byText = table.getByText(TARGET, { exact: true });
        await byText.first().hover({ force: true });
        await byText.first().click({ timeout: 5000 });
        this.log(`[WOORI] cert row: #xwup_cert_table getByText('${TARGET}', exact)`);
      } catch (errorText) {
        this.warn('[WOORI] #xwup_cert_table getByText failed, spec CSS fallback (.first() cell):', errorText.message);
        try {
          const fallbackLocator = this.page.locator('.xwup-tableview-cell');
          await fallbackLocator.hover({ force: true });
          await fallbackLocator.click({ timeout: 5000 });
          this.warn('[WOORI] cert row: first .xwup-tableview-cell (woori.spec.js fallback — often wrong cell)');
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
