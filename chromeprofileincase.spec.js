/**
 * RECORDED_ACTIONS:
 * [{"type":"navigate","url":"https://accounts.google.com/","timestamp":4295},{"type":"click","selector":"[id=\"identifierId\"]","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div[1]/span/section/div/div/div[1]/div[1]/div[1]/div/div[1]/input","value":"","innerText":"","role":"input","ariaLabel":"Email or phone","timestamp":8132},{"type":"keypress","key":"Enter","selector":"[id=\"identifierId\"]","timestamp":12180},{"type":"fill","selector":"[id=\"identifierId\"]","value":"minseochh02@gmail.com","timestamp":12190,"xpath":"","inputType":"email"},{"type":"click","selector":"span:nth-match(3)","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[1]/div/h1/span","value":"Use your passkey to confirm it’s really you","innerText":"Use your passkey to confirm it’s really you","role":"span","ariaLabel":"","timestamp":25811},{"type":"click","selector":".dMNVAe","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[1]/div/div/div","value":"Your device will ask for your fingerprint, face, or screen lock","innerText":"Your device will ask for your fingerprint, face, or screen lock","role":"div","ariaLabel":"","timestamp":28008},{"type":"click","selector":".VfPpkd-vQzf8d:nth-match(2)","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[2]/div/div/button/span","value":"Try another way","innerText":"Try another way","role":"span","ariaLabel":"","timestamp":29728},{"type":"click","selector":".l5PPKe:nth-match(2)","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[2]/div/div/section/div/div/div/ul/li[2]/div/div[2]","value":"Enter your password","innerText":"Enter your password","role":"div","ariaLabel":"","timestamp":33608},{"type":"click","selector":".whsOnd:nth-match(1)","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[2]/div/div/div[1]/div[1]/div/div/div/div/div[1]/div/div[1]/input","value":"","innerText":"","role":"input","ariaLabel":"Enter your password","timestamp":37678},{"type":"click","selector":".VfPpkd-vQzf8d:nth-match(2)","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[1]/div/div/button/span","value":"Next","innerText":"Next","role":"span","ariaLabel":"","timestamp":41515},{"type":"click","selector":".whsOnd:nth-match(1)","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[2]/div/div/div[1]/div[1]/div/div/div/div/div[1]/div/div[1]/input","value":"","innerText":"","role":"input","ariaLabel":"Enter your password","timestamp":45500},{"type":"click","selector":".VfPpkd-RLmnJb:nth-match(2)","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[1]/div/div/button/div[3]","value":"","innerText":"","role":"div","ariaLabel":"","timestamp":63897},{"type":"click","selector":"span:nth-match(6)","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[1]/header/div/h2/span","value":"2-Step Verification","innerText":"2-Step Verification","role":"span","ariaLabel":"","timestamp":71308},{"type":"click","selector":"span:nth-match(12)","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[3]/div/div/section/header/div/h2/span/span","value":"Choose how you want to sign in:","innerText":"Choose how you want to sign in:","role":"span","ariaLabel":"","timestamp":72860},{"type":"click","selector":"strong:nth-match(1)","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[3]/div/div/section/div/div/div/ul/li[2]/div/div[2]/strong","value":"Yes","innerText":"Yes","role":"strong","ariaLabel":"","timestamp":79724},{"type":"click","selector":"span:nth-match(8)","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[2]/div/div/section/div/div/section/div/div/section/header/div/h2/span","value":"Check your Galaxy S24 FE","innerText":"Check your Galaxy S24 FE","role":"span","ariaLabel":"","timestamp":83830},{"type":"click","selector":".dMNVAe:nth-match(1)","xpath":"/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[2]/div/div/section/div/div/section/div/div/section/div/div/div","value":"Google sent a notification to your Galaxy S24 FE. Tap Yes on the notification to verify it’s you.","innerText":"Google sent a notification to your Galaxy S24 FE. Tap Yes on the notification to verify it’s you.","role":"div","ariaLabel":"","timestamp":84577}]
 *
 * CHROME_EXTENSIONS:
 * []
 */

const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Original extension paths from recording session
const EXTENSION_PATHS = [];

/**
 * Copy Chrome extensions to temporary directory
 * Returns { paths: string[], tempDir: string }
 */
function copyExtensionsToTemp(profileDir) {
  if (EXTENSION_PATHS.length === 0) return { paths: [], tempDir: null };
  
  try {
    const tempExtensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'egdesk-extensions-'));
    console.log('[Replay] Copying', EXTENSION_PATHS.length, 'extensions to:', tempExtensionsDir);
    
    const copiedPaths = [];
    
    for (const extPath of EXTENSION_PATHS) {
      if (!fs.existsSync(extPath)) {
        console.warn('[Replay] Extension not found:', extPath);
        continue;
      }
      
      const version = path.basename(extPath);
      const extensionId = path.basename(path.dirname(extPath));
      const destPath = path.join(tempExtensionsDir, `${extensionId}-${version}`);
      
      fs.cpSync(extPath, destPath, { recursive: true });
      copiedPaths.push(destPath);
      console.log('[Replay] ✓ Copied:', extensionId);
    }
    
    // Copy native messaging hosts
    copyNativeMessagingHosts(profileDir);
    
    console.log('[Replay] Successfully copied', copiedPaths.length + '/' + EXTENSION_PATHS.length, 'extensions');
    return { paths: copiedPaths, tempDir: tempExtensionsDir };
  } catch (error) {
    console.error('[Replay] Error copying extensions:', error);
    return { paths: [], tempDir: null };
  }
}

/**
 * Copy native messaging host manifests to profile directory
 */
function copyNativeMessagingHosts(profileDir) {
  try {
    const nativeHostLocations = [
      '/Library/Google/Chrome/NativeMessagingHosts',
      '/Library/Application Support/Google/Chrome/NativeMessagingHosts',
      path.join(os.homedir(), 'Library/Application Support/Google/Chrome/NativeMessagingHosts'),
      '/Library/Application Support/Chromium/NativeMessagingHosts',
      path.join(os.homedir(), 'Library/Application Support/Chromium/NativeMessagingHosts')
    ];
    
    const destNativeHostsDir = path.join(profileDir, 'NativeMessagingHosts');
    if (!fs.existsSync(destNativeHostsDir)) {
      fs.mkdirSync(destNativeHostsDir, { recursive: true });
    }
    
    let copiedCount = 0;
    for (const location of nativeHostLocations) {
      if (fs.existsSync(location)) {
        const files = fs.readdirSync(location);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const sourcePath = path.join(location, file);
            const destPath = path.join(destNativeHostsDir, file);
            if (!fs.existsSync(destPath)) {
              fs.copyFileSync(sourcePath, destPath);
              copiedCount++;
            }
          }
        }
      }
    }
    
    if (copiedCount > 0) {
      console.log(`[Replay] ✓ Copied ${copiedCount} native messaging host(s)`);
    }
  } catch (error) {
    console.warn('[Replay] Error copying native hosts:', error);
  }
}

/** Persist preferredLocatorStrategy into this file's RECORDED_ACTIONS comment after a successful run */
function __egdeskMergeSelectorPrefsIntoSpec(filePath, learnMap) {
  if (!learnMap || typeof learnMap !== 'object') return;
  const ks = Object.keys(learnMap);
  if (ks.length === 0) return;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const marker = 'RECORDED_ACTIONS:';
    const idx = raw.indexOf(marker);
    if (idx === -1) return;
    let pos = idx + marker.length;
    while (pos < raw.length && /\s/.test(raw[pos])) pos++;
    while (pos < raw.length && (raw[pos] === '*' || raw[pos] === ' ')) {
      if (raw[pos] === '*') { pos++; while (pos < raw.length && raw[pos] === ' ') pos++; }
      else pos++;
    }
    if (pos >= raw.length || raw[pos] !== '[') return;
    const startBracket = pos;
    let depth = 0, inString = false, stringQuote = null, escape = false;
    let endBracket = -1;
    for (let i = startBracket; i < raw.length; i++) {
      const c = raw[i];
      if (inString) {
        if (escape) { escape = false; continue; }
        if (c === '\') { escape = true; continue; }
        if (stringQuote && c === stringQuote) { inString = false; stringQuote = null; }
        continue;
      }
      if (c === '"' || c === "'") { inString = true; stringQuote = c; continue; }
      if (c === '[') depth++;
      if (c === ']') {
        depth--;
        if (depth === 0) { endBracket = i + 1; break; }
      }
    }
    if (endBracket < 0) return;
    const jsonStr = raw.slice(startBracket, endBracket);
    const actions = JSON.parse(jsonStr);
    for (const k of ks) {
      const ix = parseInt(k, 10);
      if (actions[ix]) actions[ix].preferredLocatorStrategy = learnMap[k];
    }
    const newJson = JSON.stringify(actions);
    fs.writeFileSync(filePath, raw.slice(0, startBracket) + newJson + raw.slice(endBracket), 'utf8');
    console.log('[Replay] 📝 Saved preferredLocatorStrategy for', ks.length, 'action(s)');
  } catch (e) {
    console.warn('[Replay] Could not persist selector preferences:', e && e.message);
  }
}

(async () => {
  console.log('🎬 Starting test replay...');
  
  // Create downloads directory in system Downloads folder (grouped under EGDesk-Browser)
  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Browser', 'chromeprofileincase');
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }
  console.log('📥 Downloads will be saved to:', downloadsPath);

  // Create temporary profile directory
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-profile-'));
  console.log('📁 Using profile directory:', profileDir);

  // Copy Chrome extensions if any were used during recording
  let copiedExtensionPaths = [];
  let tempExtensionsDir = null;
  if (EXTENSION_PATHS.length > 0) {
    const extensionResult = copyExtensionsToTemp(profileDir);
    copiedExtensionPaths = extensionResult.paths;
    tempExtensionsDir = extensionResult.tempDir;
  }

  // Launch browser with persistent context (more reliable in production)
  const browserChannel = copiedExtensionPaths.length > 0 ? 'chromium' : 'chrome';
  console.log(`🎭 Launching with channel: ${browserChannel}`);
  if (copiedExtensionPaths.length > 0) {
    console.log('🧩 Loading', copiedExtensionPaths.length, 'Chrome extension(s)');
  }

  // Build browser args
  const args = [
    '--window-size=907,867',
    '--window-position=605,0',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    // Permission handling for localhost and private network access
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--allow-running-insecure-content',
    '--disable-features=PrivateNetworkAccessSendPreflights',
    '--disable-features=PrivateNetworkAccessRespectPreflightResults'
  ];

  // Add extension loading args if extensions were copied
  if (copiedExtensionPaths.length > 0) {
    const extensionPathsStr = copiedExtensionPaths.join(',');
    args.push(`--disable-extensions-except=${extensionPathsStr}`);
    args.push(`--load-extension=${extensionPathsStr}`);
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: browserChannel,
    viewport: null,
    permissions: ['clipboard-read', 'clipboard-write'],
    acceptDownloads: true,
    downloadsPath: downloadsPath,
    args: args
  });

  // Get or create page
  const pages = context.pages();
  let page = pages.length > 0 ? pages[0] : await context.newPage(); // Use 'let' to allow tab switching
  const pageStack = []; // Track page history for popup close handling

  // Set up dialog handling (auto-accept alerts/confirms for downloads)
  page.on('dialog', async (dialog) => {
    console.log(`🔔 Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
    await dialog.accept();
    console.log('✅ Dialog accepted');
  });

  try {
    const __selectorLearn = {};
    function __egdeskRecordStrategy(actionIndex, strategy) {
      if (strategy) __selectorLearn[actionIndex] = strategy;
    }

    await page.goto('https://accounts.google.com/');
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: semantic → css → xpath)
    try {
      // getByRole + aria-label
      const locator = page.getByRole('input', { name: 'Email or phone' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(1, 'semantic');
    } catch (error0) {
      try {
        // CSS selector
        const locator = page.locator('[id="identifierId"]');
        await locator.hover({ force: true });
        await locator.click({ timeout: 5000 });
        __egdeskRecordStrategy(1, 'css');
      } catch (error1) {
        try {
          // XPath
          const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div[1]/span/section/div/div/div[1]/div[1]/div[1]/div/div[1]/input');
          await xpathLocator.hover({ force: true });
          await xpathLocator.click();
          __egdeskRecordStrategy(1, 'xpath');
        }
      }
    }
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.keyboard.press('Enter'); // Submit form
    await page.fill('[id="identifierId"]', 'minseochh02@gmail.com');
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: semantic → css → xpath)
    try {
      // getByRole + text
      const locator = page.getByRole('span', { name: 'Use your passkey to confirm it’s really you' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(4, 'semantic');
    } catch (error0) {
      try {
        // CSS selector
        const locator = page.locator('span:nth-match(3)');
        await locator.hover({ force: true });
        await locator.click({ timeout: 5000 });
        __egdeskRecordStrategy(4, 'css');
      } catch (error1) {
        try {
          // XPath
          const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[1]/div/h1/span');
          await xpathLocator.hover({ force: true });
          await xpathLocator.click();
          __egdeskRecordStrategy(4, 'xpath');
        }
      }
    }
    await page.waitForTimeout(2197); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: css → xpath)
    try {
      // CSS selector
      const locator = page.locator('.dMNVAe');
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(5, 'css');
    } catch (error0) {
      try {
        // XPath
        const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[1]/div/div/div');
        await xpathLocator.hover({ force: true });
        await xpathLocator.click();
        __egdeskRecordStrategy(5, 'xpath');
      }
    }
    await page.waitForTimeout(1720); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: semantic → css → xpath)
    try {
      // getByRole + text
      const locator = page.getByRole('span', { name: 'Try another way' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(6, 'semantic');
    } catch (error0) {
      try {
        // CSS selector
        const locator = page.locator('.VfPpkd-vQzf8d:nth-match(2)');
        await locator.hover({ force: true });
        await locator.click({ timeout: 5000 });
        __egdeskRecordStrategy(6, 'css');
      } catch (error1) {
        try {
          // XPath
          const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[2]/div/div/button/span');
          await xpathLocator.hover({ force: true });
          await xpathLocator.click();
          __egdeskRecordStrategy(6, 'xpath');
        }
      }
    }
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: semantic → css → xpath)
    try {
      // getByRole + text
      const locator = page.getByRole('div', { name: 'Enter your password' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(7, 'semantic');
    } catch (error0) {
      try {
        // CSS selector
        const locator = page.locator('.l5PPKe:nth-match(2)');
        await locator.hover({ force: true });
        await locator.click({ timeout: 5000 });
        __egdeskRecordStrategy(7, 'css');
      } catch (error1) {
        try {
          // XPath
          const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[2]/div/div/section/div/div/div/ul/li[2]/div/div[2]');
          await xpathLocator.hover({ force: true });
          await xpathLocator.click();
          __egdeskRecordStrategy(7, 'xpath');
        }
      }
    }
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: semantic → css → xpath)
    try {
      // getByRole + aria-label
      const locator = page.getByRole('input', { name: 'Enter your password' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(8, 'semantic');
    } catch (error0) {
      try {
        // CSS selector
        const locator = page.locator('.whsOnd:nth-match(1)');
        await locator.hover({ force: true });
        await locator.click({ timeout: 5000 });
        __egdeskRecordStrategy(8, 'css');
      } catch (error1) {
        try {
          // XPath
          const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[2]/div/div/div[1]/div[1]/div/div/div/div/div[1]/div/div[1]/input');
          await xpathLocator.hover({ force: true });
          await xpathLocator.click();
          __egdeskRecordStrategy(8, 'xpath');
        }
      }
    }
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: semantic → css → xpath)
    try {
      // getByRole + text
      const locator = page.getByRole('span', { name: 'Next' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(9, 'semantic');
    } catch (error0) {
      try {
        // CSS selector
        const locator = page.locator('.VfPpkd-vQzf8d:nth-match(2)');
        await locator.hover({ force: true });
        await locator.click({ timeout: 5000 });
        __egdeskRecordStrategy(9, 'css');
      } catch (error1) {
        try {
          // XPath
          const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[1]/div/div/button/span');
          await xpathLocator.hover({ force: true });
          await xpathLocator.click();
          __egdeskRecordStrategy(9, 'xpath');
        }
      }
    }
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: semantic → css → xpath)
    try {
      // getByRole + aria-label
      const locator = page.getByRole('input', { name: 'Enter your password' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(10, 'semantic');
    } catch (error0) {
      try {
        // CSS selector
        const locator = page.locator('.whsOnd:nth-match(1)');
        await locator.hover({ force: true });
        await locator.click({ timeout: 5000 });
        __egdeskRecordStrategy(10, 'css');
      } catch (error1) {
        try {
          // XPath
          const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[2]/div/div/div[1]/div[1]/div/div/div/div/div[1]/div/div[1]/input');
          await xpathLocator.hover({ force: true });
          await xpathLocator.click();
          __egdeskRecordStrategy(10, 'xpath');
        }
      }
    }
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: css → xpath)
    try {
      // CSS selector
      const locator = page.locator('.VfPpkd-RLmnJb:nth-match(2)');
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(11, 'css');
    } catch (error0) {
      try {
        // XPath
        const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[3]/div/div[1]/div/div/button/div[3]');
        await xpathLocator.hover({ force: true });
        await xpathLocator.click();
        __egdeskRecordStrategy(11, 'xpath');
      }
    }
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: semantic → css → xpath)
    try {
      // getByRole + text
      const locator = page.getByRole('span', { name: '2-Step Verification' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(12, 'semantic');
    } catch (error0) {
      try {
        // CSS selector
        const locator = page.locator('span:nth-match(6)');
        await locator.hover({ force: true });
        await locator.click({ timeout: 5000 });
        __egdeskRecordStrategy(12, 'css');
      } catch (error1) {
        try {
          // XPath
          const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[1]/header/div/h2/span');
          await xpathLocator.hover({ force: true });
          await xpathLocator.click();
          __egdeskRecordStrategy(12, 'xpath');
        }
      }
    }
    await page.waitForTimeout(1552); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: semantic → css → xpath)
    try {
      // getByRole + text
      const locator = page.getByRole('span', { name: 'Choose how you want to sign in:' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(13, 'semantic');
    } catch (error0) {
      try {
        // CSS selector
        const locator = page.locator('span:nth-match(12)');
        await locator.hover({ force: true });
        await locator.click({ timeout: 5000 });
        __egdeskRecordStrategy(13, 'css');
      } catch (error1) {
        try {
          // XPath
          const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[3]/div/div/section/header/div/h2/span/span');
          await xpathLocator.hover({ force: true });
          await xpathLocator.click();
          __egdeskRecordStrategy(13, 'xpath');
        }
      }
    }
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: semantic → css → xpath)
    try {
      // getByRole + text
      const locator = page.getByRole('strong', { name: 'Yes' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(14, 'semantic');
    } catch (error0) {
      try {
        // CSS selector
        const locator = page.locator('strong:nth-match(1)');
        await locator.hover({ force: true });
        await locator.click({ timeout: 5000 });
        __egdeskRecordStrategy(14, 'css');
      } catch (error1) {
        try {
          // XPath
          const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[3]/div/div/section/div/div/div/ul/li[2]/div/div[2]/strong');
          await xpathLocator.hover({ force: true });
          await xpathLocator.click();
          __egdeskRecordStrategy(14, 'xpath');
        }
      }
    }
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // Try multiple selector strategies for resilience (order: semantic → css → xpath)
    try {
      // getByRole + text
      const locator = page.getByRole('span', { name: 'Check your Galaxy S24 FE' });
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(15, 'semantic');
    } catch (error0) {
      try {
        // CSS selector
        const locator = page.locator('span:nth-match(8)');
        await locator.hover({ force: true });
        await locator.click({ timeout: 5000 });
        __egdeskRecordStrategy(15, 'css');
      } catch (error1) {
        try {
          // XPath
          const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[2]/div/div/section/div/div/section/div/div/section/header/div/h2/span');
          await xpathLocator.hover({ force: true });
          await xpathLocator.click();
          __egdeskRecordStrategy(15, 'xpath');
        }
      }
    }
    // Try multiple selector strategies for resilience (order: css → xpath)
    try {
      // CSS selector
      const locator = page.locator('.dMNVAe:nth-match(1)');
      await locator.hover({ force: true });
      await locator.click({ timeout: 5000 });
      __egdeskRecordStrategy(16, 'css');
    } catch (error0) {
      try {
        // XPath
        const xpathLocator = page.locator('xpath=/html/body/div[2]/div[1]/div[1]/div[2]/c-wiz/main/div[2]/div/div/div/span/section[2]/div/div/section/div/div/section/div/div/section/div/div/div');
        await xpathLocator.hover({ force: true });
        await xpathLocator.click();
        __egdeskRecordStrategy(16, 'xpath');
      }
    }
    __egdeskMergeSelectorPrefsIntoSpec(__filename, __selectorLearn);
  } finally {
    await context.close();
    // Clean up profile directory
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to clean up profile directory:', e);
    }
    // Clean up temporary extensions directory
    if (tempExtensionsDir) {
      try {
        fs.rmSync(tempExtensionsDir, { recursive: true, force: true });
        console.log('🧹 Cleaned up extensions directory');
      } catch (e) {
        console.warn('Failed to clean up extensions directory:', e);
      }
    }
  }
})().catch(console.error);