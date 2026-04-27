/**
 * Data-driven native cert dialog choreography after UIA detects the window.
 * Steps are interpreted by runNativeCertArduinoSteps.
 *
 * @typedef {object} CertStep
 * @property {'password'} [type] - type certificate password
 * @property {string} [key] - KEY name for Arduino (ENTER, TAB, ...)
 * @property {number} [repeat] - repeat key (default 1)
 * @property {number} [waitMs] - wait on Playwright page
 * @property {number} [interKeyMs] - delay between repeated keys (default 300)
 */

const { sendEnterKeyViaSendKeys, getFocusedNativeElementName, dismissNativeDeletionConfirmDialog } = require('./windows-uia-native');

/**
 * @param {import('./arduino-hid-bank').ArduinoHidBankSession} hid
 * @param {import('playwright').Page} page
 * @param {string} certificatePassword
 * @param {CertStep[]} steps
 * @param {{ log?: (s:string)=>void, warn?: (s:string)=>void, sendkeysEnterFallbackEnv?: string }} [opts]
 */
async function runNativeCertArduinoSteps(hid, page, certificatePassword, steps, opts = {}) {
  const log = opts.log || (() => {});
  const warn = opts.warn || (() => {});
  const fallbackEnv = opts.sendkeysEnterFallbackEnv || 'CORP_CERT_SENDKEYS_ENTER_FALLBACK';

  for (const step of steps) {
    if (step.waitMs != null && step.waitMs > 0) {
      await page.waitForTimeout(step.waitMs);
      continue;
    }
    if (step.type === 'password') {
      await hid.typeViaNaturalTiming(certificatePassword);
      continue;
    }
    if (step.key) {
      const repeat = step.repeat != null ? Math.max(1, step.repeat) : 1;
      const inter = step.interKeyMs != null ? step.interKeyMs : 300;
      for (let r = 0; r < repeat; r++) {
        await hid.sendKey(step.key);
        if (r < repeat - 1) {
          await page.waitForTimeout(inter);
        }
        if (step.key === 'TAB') {
          const focusedName = getFocusedNativeElementName();
          if (focusedName.includes('삭제')) {
            warn(`[cert-steps] TAB landed on 삭제 element ("${focusedName}") — sending extra TAB to skip`);
            await page.waitForTimeout(300);
            const dismissResult = dismissNativeDeletionConfirmDialog();
            if (dismissResult === 'clicked') {
              warn('[cert-steps] Deletion confirmation dialog detected — clicked 취소');
            }
            await hid.sendKey('TAB');
            await page.waitForTimeout(inter);
          }
        }
      }
      continue;
    }
    log(`[cert-steps] skip unknown step: ${JSON.stringify(step)}`);
  }

  if (process.env[fallbackEnv] === '1') {
    const enterResult = sendEnterKeyViaSendKeys();
    if (!enterResult.ok) {
      warn('SendKeys Enter fallback failed:', enterResult.error);
    }
  }
}

/** Shinhan: password field focused — type PW, wait, ENTER */
const SHINHAN_NATIVE_CERT_STEPS = [
  { type: 'password' },
  { waitMs: 1000 },
  { key: 'ENTER' },
];

/** KB obiz + IBK + Hana (Delfino QWidget): ENTER pick cert, TAB×4 to PW, type, confirm */
function delfinoQwidgetSteps(opts = {}) {
  const afterFirstEnter = opts.afterFirstEnterMs ?? 2000;
  const afterPassword = opts.afterPasswordMs ?? 1000;
  return [
    { key: 'ENTER' },
    { waitMs: afterFirstEnter },
    { key: 'TAB', repeat: 4, interKeyMs: 300 },
    { type: 'password' },
    { waitMs: afterPassword },
    { key: 'ENTER' },
  ];
}

const KOOKMIN_NATIVE_CERT_STEPS = delfinoQwidgetSteps({ afterFirstEnterMs: 2000, afterPasswordMs: 1000 });
const IBK_NATIVE_CERT_STEPS = delfinoQwidgetSteps({ afterFirstEnterMs: 2000, afterPasswordMs: 2000 });
const HANA_NATIVE_CERT_STEPS = delfinoQwidgetSteps({ afterFirstEnterMs: 2000, afterPasswordMs: 2000 });

module.exports = {
  runNativeCertArduinoSteps,
  SHINHAN_NATIVE_CERT_STEPS,
  KOOKMIN_NATIVE_CERT_STEPS,
  IBK_NATIVE_CERT_STEPS,
  HANA_NATIVE_CERT_STEPS,
  delfinoQwidgetSteps,
};
