import { ipcMain, app } from 'electron';
import { getStore } from './storage';
import * as path from 'path';
import * as fs from 'fs';
import { focusPlaywrightPage } from './shared/browser/focus-page';

function getDefaultProfileImagePath(): string {
  // In production: process.resourcesPath/assets/icons/512x512.png
  // In dev: app.getAppPath() returns the repo root (where package.json lives)
  const resourcesPath = app?.isPackaged
    ? process.resourcesPath
    : app.getAppPath();
  return path.join(resourcesPath, 'assets', 'icons', '512x512.png');
}

// Lazily imported so playwright-core doesn't load until needed
async function launchBrowser(profileDir: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { chromium } = require('playwright-core');
  return chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    args: ['--no-default-browser-check', '--disable-blink-features=AutomationControlled'],
  });
}

function getProfileDir(getGoogleProfilesDir: () => string, profileName: string): string {
  return path.join(getGoogleProfilesDir(), profileName);
}

// ── Popup dismissal helper ────────────────────────────────────────────────────

/**
 * Dismiss any Kakao Business overlay popup (.wrap_layer / .open_layer).
 * Clicks the close button (.btn_close) on every visible layer.
 * Safe to call at any point — does nothing if no popup is present.
 */
async function dismissKakaoPopups(page: any): Promise<void> {
  try {
    // There may be multiple stacked layers; close them all
    const closeBtns = page.locator('.wrap_layer .btn_close, .open_layer .btn_close, .layer_comm .btn_close, .go1141946668 .btn_close');
    const count = await closeBtns.count();
    for (let i = 0; i < count; i++) {
      const btn = closeBtns.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        console.log('[kakao] Closing popup layer...');
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
      }
    }
  } catch { /* non-fatal */ }
}

// ── Existing channel detection ────────────────────────────────────────────────

/**
 * Check the /profiles page for existing channel cards and, if found, navigate
 * to the channel settings page to extract the search ID and channel URL.
 * Returns { found: false } if no existing channel is detected.
 *
 * Multiple selector fallbacks because Kakao's frontend framework varies between
 * releases — having several attempts makes this more resilient to UI updates.
 */
async function detectExistingChannel(page: any, targetSearchId?: string): Promise<
  { found: false } | { found: true; searchId: string; channelUrl: string }
> {
  // business.kakao.com/profiles shows .box_plus cards for each channel alongside
  // the "새 채널 만들기" button.  Active channels (not pending deletion) have class
  // .box_plus without .box_delete.  Pending-deletion ones have .box_plus.box_delete
  // with "N일후 완전 삭제" text.  Active channel links point to /_CODE/dashboard;
  // the public URL is https://pf.kakao.com/_CODE.
  // The search ID is shown in p.desc_invite as "@egdesk_363".
  
  await page.goto('https://business.kakao.com/profiles');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await dismissKakaoPopups(page);

  // Loop through pages if pagination exists
  for (let pageNum = 1; pageNum <= 5; pageNum++) {
    console.log(`[kakao:detectChannel] Checking page ${pageNum}...`);
    const channelCards = page.locator('.box_plus');
    const count = await channelCards.count();

    if (count > 0) {
      // 1. Try to find by search ID if provided
      if (targetSearchId) {
        const cleanTargetId = targetSearchId.replace(/^@/, '').trim().toLowerCase();
        for (let i = 0; i < count; i++) {
          const card = channelCards.nth(i);
          const rawSearchId = (await card.locator('p.desc_invite').first()
            .textContent({ timeout: 3000 }).catch(() => ''))?.trim() ?? '';
          const searchId = rawSearchId.replace(/^@/, '').trim();
          
          if (searchId.toLowerCase() === cleanTargetId) {
            const linkLocator = card.locator('a.link_plus').first();
            const href = (await linkLocator.getAttribute('href').catch(() => '')) ?? '';
            const channelCode = href.replace('/dashboard', '').trim();
            const channelUrl = channelCode ? `https://pf.kakao.com${channelCode}` : '';
            
            console.log(`[kakao:detectChannel] Found exact match for channel: "${searchId}" on page ${pageNum}`);
            return { found: true, searchId, channelUrl };
          }
        }
      }
    }

    // Check for "Next" button in pagination
    const nextBtn = page.locator('.paging_comm .btn_next, button:has-text("다음")').first();
    if (await nextBtn.count() > 0 && await nextBtn.isVisible()) {
      const isDisabled = await nextBtn.evaluate((el: HTMLButtonElement) => el.disabled || el.classList.contains('disabled'));
      if (!isDisabled) {
        console.log(`[kakao:detectChannel] Navigating to next page...`);
        await nextBtn.click();
        await page.waitForTimeout(2000);
        await dismissKakaoPopups(page);
        continue;
      }
    }
    break;
  }

  // If we reached here, the exact match wasn't found on any page.
  // Fall back to the first page and pick the first channel that looks like an EGDesk channel.
  console.log('[kakao:detectChannel] Exact match not found. Returning to first page for fallback...');
  await page.goto('https://business.kakao.com/profiles').catch(() => {});
  await page.waitForTimeout(2000);

  const channelCards = page.locator('.box_plus');
  const count = await channelCards.count();

  if (count === 0) {
    console.log('[kakao:detectChannel] No channel cards found on first page');
    return { found: false };
  }

  // 1. Try to find any channel that contains "egdesk"
  for (let i = 0; i < count; i++) {
    const card = channelCards.nth(i);
    const rawSearchId = (await card.locator('p.desc_invite').first()
      .textContent({ timeout: 3000 }).catch(() => ''))?.trim() ?? '';
    const searchId = rawSearchId.replace(/^@/, '').trim();
    
    if (searchId.toLowerCase().includes('egdesk')) {
      const linkLocator = card.locator('a.link_plus').first();
      const href = (await linkLocator.getAttribute('href').catch(() => '')) ?? '';
      const channelCode = href.replace('/dashboard', '').trim();
      const channelUrl = channelCode ? `https://pf.kakao.com${channelCode}` : '';
      
      console.log(`[kakao:detectChannel] Falling back to existing EGDesk channel: "${searchId}"`);
      return { found: true, searchId, channelUrl };
    }
  }

  console.log('[kakao:detectChannel] No EGDesk-like channel found — proceeding with creation.');
  return { found: false };
}

// ── Existing bot detection ────────────────────────────────────────────────────

/**
 * After chatbot.kakao.com has loaded, check whether existing bots are already
 * listed. If so, return the name of the first one so we can skip creation.
 */
async function detectExistingBot(page: any, targetBotName?: string): Promise<
  { found: false } | { found: true; botName: string; index: number }
> {
  // chatbot.kakao.com lists bots as my-list-bot-item elements inside div.botlist_body.
  // Active bots:          my-list-bot-item div.item_botlist          (no .off_item)
  // Pending-deletion bots: my-list-bot-item div.item_botlist.off_item (has span.txt_status.status_del)
  // Bot name is in span.txt_name > span.inner_txt.

  // Loop through pages if pagination exists
  for (let pageNum = 1; pageNum <= 5; pageNum++) { // Check up to 5 pages
    console.log(`[kakao:detectBot] Checking page ${pageNum}...`);
    const botCards = page.locator('my-list-bot-item .item_botlist');
    const count = await botCards.count();
    
    if (count > 0) {
      // 1. Try to find by name if provided
      if (targetBotName) {
        for (let i = 0; i < count; i++) {
          const card = botCards.nth(i);
          const name = (await card.locator('span.txt_name span.inner_txt').first()
            .textContent({ timeout: 2000 }).catch(() => ''))?.trim() ?? '';
          
          // Exact match or fuzzy match for EGClaw bots
          const isEGFuzzy = name.includes('EGClaw Bot') && targetBotName.includes('EGClaw Bot');
          if (name === targetBotName || isEGFuzzy) {
            console.log(`[kakao:detectBot] Found match for bot: "${name}" at index ${i} on page ${pageNum}`);
            return { found: true, botName: name, index: i };
          }
        }
      }

      // 2. If it's the first page and no exact match, we might want to remember the first active bot
      // but we should still keep looking through pages for an exact match.
    }

    // Check for "Next" button in pagination
    const nextBtn = page.locator('.paging_comm .btn_next, .pagination .next, button:has-text("다음")').first();
    if (await nextBtn.count() > 0 && await nextBtn.isVisible()) {
      const isDisabled = await nextBtn.evaluate((el: HTMLButtonElement) => el.disabled || el.classList.contains('disabled'));
      if (!isDisabled) {
        console.log(`[kakao:detectBot] Navigating to next page...`);
        await nextBtn.click();
        await page.waitForTimeout(2000);
        await dismissKakaoPopups(page);
        continue;
      }
    }
    
    // No more pages or target not found
    break;
  }

  // If we reached here, the exact match wasn't found on any page.
  // Fall back to the first page and pick the first active bot.
  console.log('[kakao:detectBot] Exact match not found. Returning to first page for fallback...');
  await page.goto('https://chatbot.kakao.com/').catch(() => {});
  await page.waitForTimeout(2000);
  
  const botCards = page.locator('my-list-bot-item .item_botlist');
  const count = await botCards.count();

  if (count === 0) {
    console.log('[kakao:detectBot] No bot cards found on first page');
    return { found: false };
  }

  for (let i = 0; i < count; i++) {
    const card = botCards.nth(i);
    const isOff = await card.evaluate((el: HTMLElement) => el.classList.contains('off_item'));
    if (!isOff) {
      const name = (await card.locator('span.txt_name span.inner_txt').first()
        .textContent({ timeout: 2000 }).catch(() => ''))?.trim() ?? '';
      console.log(`[kakao:detectBot] Reusing first active bot on first page: "${name}" at index ${i}`);
      return { found: true, botName: name, index: i };
    }
  }

  const firstCardName = (await botCards.first().locator('span.txt_name span.inner_txt').first()
    .textContent({ timeout: 2000 }).catch(() => ''))?.trim() ?? '';
  console.log(`[kakao:detectBot] Falling back to first bot card on first page: "${firstCardName}"`);
  return { found: true, botName: firstCardName || '(existing bot)', index: 0 };
}

// ── kakao:createChannel ──────────────────────────────────────────────────────

async function createKakaoChannel(
  profileDir: string,
  channelName: string,
  searchId: string,
  reuseExisting: boolean = false
): Promise<{ success: true; searchId: string; channelUrl: string } | { success: false; error: string }> {
  const context = await launchBrowser(profileDir);
  const page = context.pages()[0];
  await focusPlaywrightPage(page);

  try {
    // 1. Login Phase — always go through login URL (resolves instantly if already logged in)
    console.log('[kakao:createChannel] Navigating to Kakao login...');
    await page.goto('https://accounts.kakao.com/login/?continue=https%3A%2F%2Fbusiness.kakao.com%2Fdashboard%2F#login');
    try {
      await page.getByRole('button', { name: /QR코드 로그인|Log in with QR code/i }).click({ timeout: 5000 });
    } catch {
      await page.click('.btn_g:nth-match(2)').catch(() => {});
    }
    console.log('[kakao:createChannel] Waiting for login (scan QR if needed)...');
    await page.waitForURL((url: URL) => !url.href.includes('accounts.kakao.com'), { timeout: 300000 });
    console.log('[kakao:createChannel] Login confirmed.');
    await dismissKakaoPopups(page);

    // 2. Check for an existing channel before running the creation wizard
    if (reuseExisting) {
      console.log('[kakao:createChannel] Checking for existing channels on business.kakao.com/profiles...');
      const existingChannel = await detectExistingChannel(page, searchId);
      if (existingChannel.found) {
        console.log(`[kakao:createChannel] Reusing existing channel — skipping wizard.`);
        return { success: true, searchId: existingChannel.searchId, channelUrl: existingChannel.channelUrl, reused: true };
      }
      console.log('[kakao:createChannel] No existing channel found — running creation wizard.');
    } else {
      console.log('[kakao:createChannel] Skipping existing channel detection — proceeding with creation wizard.');
    }

    // 3. Navigate to Profiles & click "새 채널 만들기" — retry up to 3×
    let wizardFrame: any = null;

    for (let attempt = 1; attempt <= 3 && !wizardFrame; attempt++) {
      console.log(`[kakao:createChannel] Navigating to profiles (attempt ${attempt})...`);
      await page.goto('https://business.kakao.com/profiles');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      await dismissKakaoPopups(page);

      console.log(`[kakao:createChannel] Clicking "새 채널 만들기" (attempt ${attempt})...`);
      // Handle both the standard profiles page and the brand-new user landing page
      const createBtn = page.locator('button').filter({ hasText: /새 채널\s?만들기/ }).first();
      try {
        await createBtn.waitFor({ state: 'visible', timeout: 15000 });
        await createBtn.click({ force: true });
      } catch {
        // Fallback selectors
        const fallbacks = [
          '.btn_rc_highlight',
          '.new_info .btn_g2',
          'button:has-text("새 채널만들기")'
        ];
        let clicked = false;
        for (const sel of fallbacks) {
          try {
            const loc = page.locator(sel).first();
            if (await loc.isVisible({ timeout: 3000 })) {
              await loc.click({ force: true });
              clicked = true;
              break;
            }
          } catch {}
        }
        if (!clicked) console.log(`[kakao:createChannel] Could not find create button with primary or fallback selectors.`);
      }

      // Wait for wizard iframe — up to 45 s per attempt
      console.log('[kakao:createChannel] Waiting for wizard iframe...');
      const startTime = Date.now();
      while (Date.now() - startTime < 45000) {
        const frame = page.frames().find((f: any) => f.url().includes('/wizard/export'));
        if (frame) {
          const count = await frame.locator('li.item_wizcard.person1, #radio_false, .btn_comm, input').count().catch(() => 0);
          if (count > 0) { wizardFrame = frame; break; }
        }
        await page.waitForTimeout(1000);
      }

      if (!wizardFrame && attempt < 3) {
        console.log(`[kakao:createChannel] Wizard not found, retrying...`);
      }
    }

    if (!wizardFrame) {
      return { success: false, error: 'Wizard iframe not found after 3 attempts' };
    }
    console.log('[kakao:createChannel] Wizard frame ready.');

    // 3. Discovery loop — mirrors kakaotalk-discovery.js exactly
    const profileImagePath = getDefaultProfileImagePath();
    let wizardStep = 1;
    let wizardFinished = false;

    while (!wizardFinished) {
      console.log(`\n[kakao:createChannel] --- [STEP ${wizardStep}] ---`);
      
      // Re-find wizard iframe each iteration — the iframe navigates internally between steps
      // which detaches the saved reference. Search by URL pattern to get the current frame.
      const currentWizardFrame = page.frames().find((f: any) => f.url().includes('/wizard/export')) ?? null;
      if (currentWizardFrame) {
        wizardFrame = currentWizardFrame;
      }

      // Wizard frame actions
      const isWizardAttached = wizardFrame !== null && page.frames().includes(wizardFrame);
      let hasNext = false;
      let nextButton: any = null;

      if (isWizardAttached) {
        nextButton = wizardFrame.locator('button, .btn_comm, span, .btn_fix').filter({ hasText: /다음|Next|확인|계속|완료|대시보드로 이동/ }).first();
        hasNext = (await nextButton.count()) > 0;

        // Step 1: Select "Basic Channel"
        if (wizardStep === 1) {
          const radioFalse = wizardFrame.locator('#radio_false');
          if (await radioFalse.count() > 0 && !(await radioFalse.isChecked())) {
            console.log('[kakao:createChannel] Step 1: selecting "기본 채널형"...');
            await wizardFrame.locator('li.item_wizcard.person1').click().catch(
              () => radioFalse.click({ force: true })
            );
            await page.waitForTimeout(1000);
          }
        }

        // Step 2: "아니오, 나중에 할게요"
        if (wizardStep === 2) {
          const noLater = wizardFrame.locator('label').filter({ hasText: /아니오, 나중에 할게요/ });
          if (await noLater.count() > 0) {
            console.log('[kakao:createChannel] Step 2: selecting "아니오, 나중에 할게요"...');
            await noLater.click();
            await page.waitForTimeout(1000);
          }
        }

        // Step 3: Fill profile info
        if (wizardStep === 3) {
          console.log('[kakao:createChannel] Step 3: filling profile info...');

          // Profile image
          const fileInput = wizardFrame.locator('.field_photo input[type="file"]');
          if (await fileInput.count() > 0 && fs.existsSync(profileImagePath)) {
            console.log(`[kakao:createChannel] Uploading profile image: ${profileImagePath}`);
            await fileInput.setInputFiles(profileImagePath);
            await page.waitForTimeout(1000);
          }

          // Channel name
          const channelNameInput = wizardFrame.locator('.field_input input.inp_txt');
          if (await channelNameInput.count() > 0) {
            console.log(`[kakao:createChannel] Entering channel name: "${channelName}"`);
            await channelNameInput.fill(channelName);
          }

          // Category 1: IT
          const firstCategory = wizardFrame.locator('.field_select .box_bizopt2').first();
          if (await firstCategory.count() > 0) {
            await firstCategory.locator('.link_selected').click();
            await page.waitForTimeout(500);
            const itOption = firstCategory.locator('.link_subselect').filter({ hasText: 'IT' });
            if (await itOption.count() > 0) await itOption.click();

            // Wait for category 2 to enable
            await wizardFrame.waitForFunction(() => {
              const el = (document.querySelectorAll('.field_select .box_bizopt2') as NodeListOf<HTMLElement>)[1];
              const list = el ? el.querySelector('.list_select') : null;
              return el && !el.classList.contains('disabled') && list && (list as HTMLElement).children.length > 0;
            }, { timeout: 10000 }).catch(() => {});

            // Category 2: IT 일반
            const secondCategory = wizardFrame.locator('.field_select .box_bizopt2').nth(1);
            if (await secondCategory.count() > 0) {
              await secondCategory.locator('.link_selected').click();
              await page.waitForTimeout(500);
              const itGeneralOption = secondCategory.locator('.link_subselect').filter({ hasText: 'IT 일반' });
              if (await itGeneralOption.count() > 0) await itGeneralOption.click();
            }
          }

          // Search ID
          const searchIdInput = wizardFrame.locator('.field_searchId input.inp_txt');
          if (await searchIdInput.count() > 0) {
            console.log(`[kakao:createChannel] Entering search ID: "${searchId}"`);
            await searchIdInput.fill(searchId);
          }

          await page.waitForTimeout(1000);
        }
      }

      if (hasNext) {
        const btnText = await nextButton.innerText();
        console.log(`[kakao:createChannel] Clicking: "${btnText.trim()}"`);
        await nextButton.click();

        if (btnText.includes('대시보드로 이동')) {
          console.log('[kakao:createChannel] Waiting for dashboard to load...');
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(5000);
          wizardFinished = true;
        } else {
          await page.waitForTimeout(2000);
          wizardStep++;
        }
      } else {
        // No Next button — check if we're already on the dashboard
        const dashboardCheck = page.locator('a[data-menu-id="channel"], a.link_snb:has-text("채널")').first();
        if (await dashboardCheck.count() > 0) {
          console.log('[kakao:createChannel] Already on dashboard.');
          wizardFinished = true;
        } else {
          console.log('[kakao:createChannel] No Next button found and not on dashboard. Waiting...');
          await page.waitForTimeout(3000);
          if (wizardStep > 10) break; // Safety break
        }
      }
    }

    // 4. Post-wizard configuration: Navigate to "채널" settings
    console.log('[kakao:createChannel] Configuring channel settings...');
    const channelMenu = page.locator('a[data-menu-id="channel"], a.link_snb:has-text("채널")').first();
    try {
      await channelMenu.waitFor({ state: 'visible', timeout: 20000 });
      await channelMenu.click();
      await page.waitForTimeout(3000);
      await dismissKakaoPopups(page);
    } catch (e: any) {
      console.error('[kakao:createChannel] Failed to click "채널" menu:', e.message);
    }

    // Toggle "채널 공개" ON
    const profileDirect = page.locator('#profileDirect');
    if (await profileDirect.count() > 0) {
      console.log('[kakao:createChannel] Found "채널 공개" setting.');
      if (!(await profileDirect.isChecked())) {
        console.log('[kakao:createChannel] Toggling "채널 공개" ON...');
        await profileDirect.click({ force: true });
        await page.waitForTimeout(1000);
        const confirmBtn = page.locator('button').filter({ hasText: '확인' }).first();
        if (await confirmBtn.count() > 0) {
          await confirmBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    // Extract channel URL from 채널 정보 section
    let channelUrl = '';
    try {
      const channelUrlDl = page.locator('dl.list_comm').filter({
        has: page.locator('dt', { hasText: '채널 URL' }),
      });
      const rawUrl = await channelUrlDl.locator('dd span.txt_list').textContent({ timeout: 5000 });
      channelUrl = rawUrl?.trim() ?? '';
      console.log(`[kakao:createChannel] Channel URL: ${channelUrl}`);
    } catch (e: any) {
      console.warn('[kakao:createChannel] Could not extract channel URL:', e.message);
    }

    return { success: true, searchId, channelUrl, reused: false };
  } finally {
    await context.close().catch(() => {});
  }
}

// ── kakao:createBot ──────────────────────────────────────────────────────────

async function createKakaoBot(
  profileDir: string,
  botName: string,
  channelSearchId: string,
  skillUrl: string,
  reuseExisting: boolean = false
): Promise<{ success: true; botName: string; message?: string } | { success: false; error: string }> {
  const context = await launchBrowser(profileDir);
  const page = context.pages()[0];
  await focusPlaywrightPage(page);

  // Capture and log any browser alerts/dialogs
  page.on('dialog', async (dialog: any) => {
    const msg = dialog.message();
    console.log(`[kakao:createBot] BROWSER ALERT DETECTED: "${msg}" (type: ${dialog.type()})`);
    
    // If it's a confirmation (like "Leave page?"), accept it to proceed with navigation
    // This is critical for bypassing the "Unsaved changes" alert.
    if (dialog.type() === 'beforeunload' || dialog.type() === 'confirm' || msg.includes('저장하지 않은')) {
      console.log(`[kakao:createBot] Automatically accepting dialog: "${msg}"`);
      await dialog.accept().catch((e: any) => console.error('[kakao:createBot] Failed to accept dialog:', e.message));
    } else {
      await dialog.dismiss().catch(() => {});
    }
  });

  const skillName = 'openclawresponse';
  const fullSkillUrl = skillUrl ? `${skillUrl}/kakao/skill` : '';
  
  if (!fullSkillUrl) {
    throw new Error('Skill URL is missing. Please ensure the tunnel is running or provide a Skill URL.');
  }

  const apiKey: string = (getStore().get('mcpConfiguration') as any)?.kakaoCallbackApiKey ?? '';

  try {
    // 1. Navigate to chatbot admin
    console.log('[kakao:createBot] Navigating to chatbot.kakao.com...');
    await page.goto('https://chatbot.kakao.com/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Check if redirected to Kakao login page
    if (page.url().includes('accounts.kakao.com')) {
      console.log('[kakao:createBot] Not logged in. Showing QR code...');
      try {
        await page.getByRole('button', { name: /QR코드 로그인|Log in with QR code/i }).click({ timeout: 5000 });
      } catch {
        await page.click('.btn_g:nth-match(2)').catch(() => {});
      }
      await page.waitForURL((url: URL) => !url.href.includes('accounts.kakao.com'), { timeout: 300000 });
      console.log('[kakao:createBot] Login detected.');
      await page.waitForTimeout(1000);
      await dismissKakaoPopups(page);
    }

    // Wait for chatbot admin to fully load
    await page.waitForSelector('.layer_head, .btn_g:has-text("채널 챗봇 만들기"), bot-list-welcome-dialog, div.botlist_body', { timeout: 60000 });
    console.log('[kakao:createBot] Page loaded.');
    await page.waitForTimeout(500);
    await dismissKakaoPopups(page);

    // 2. Close welcome popup if present
    const welcomeDialog = page.locator('bot-list-welcome-dialog');
    for (let i = 0; i < 10; i++) {
      if (await welcomeDialog.count() > 0) {
        console.log('[kakao:createBot] Closing welcome popup...');
        await page.waitForTimeout(1500);
        await welcomeDialog.locator('.layer_head').click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
        const closeBtn = welcomeDialog.locator('span.ico_bot').filter({ hasText: '닫기' }).first();
        await closeBtn.click({ force: true });
        try {
          await welcomeDialog.waitFor({ state: 'hidden', timeout: 5000 });
          console.log('[kakao:createBot] Popup closed.');
          break;
        } catch {
          await welcomeDialog.locator('button.btn_close').click({ force: true }).catch(() => {});
        }
      }
      await page.waitForTimeout(1000);
    }

    // 3. Check for an existing bot before running the creation flow
    await page.waitForTimeout(1000);
    if (reuseExisting) {
      console.log('[kakao:createBot] Checking for existing bots...');
      const existingBot = await detectExistingBot(page, botName);
      if (existingBot.found) {
        console.log(`[kakao:createBot] Reusing existing bot "${existingBot.botName}" — entering dashboard.`);
        
        // Find and click the bot card to enter its dashboard
        const botCard = page.locator('my-list-bot-item .item_botlist').nth(existingBot.index);
        await botCard.click({ force: true });
        await page.waitForTimeout(3000);
        await dismissKakaoPopups(page);
        
        // Skip the creation step (Step 4) and go straight to configuration
      } else {
        console.log('[kakao:createBot] No existing bot found — running creation flow.');
        await runCreationFlow(page, botName);
      }
    } else {
      console.log('[kakao:createBot] Skipping existing bot detection — proceeding with creation flow.');
      await runCreationFlow(page, botName);
    }

    // Helper for Step 4: Create bot
    async function runCreationFlow(p: any, name: string) {
      console.log('[kakao:createBot] Creating bot...');
      const createBtn = p.locator('button').filter({ hasText: '채널 챗봇 만들기' }).first();
      await createBtn.waitFor({ state: 'visible', timeout: 10000 });
      await createBtn.click({ force: true });
      await p.waitForTimeout(500);

      const botTypeLink = p.locator('a, button').filter({ hasText: /카카오톡 챗봇|카카오톡 채널 기반 챗봇/ }).first();
      await botTypeLink.waitFor({ timeout: 10000 });
      await botTypeLink.click({ force: true });
      await p.waitForTimeout(500);

      await p.waitForSelector('#tf1');
      await p.fill('#tf1', name);
      await p.waitForTimeout(500);

      const confirmBtn = p.locator('.layer_newbot button').filter({ hasText: '확인' }).first();
      await confirmBtn.click({ force: true });

      try {
        await p.waitForSelector('.layer_newbot', { state: 'hidden', timeout: 10000 });
      } catch {
        await confirmBtn.click({ force: true }).catch(() => {});
        await p.waitForTimeout(2000);
      }
      await p.waitForTimeout(500);
    }

    // 5. Settings → select development channel
    console.log('[kakao:createBot] Selecting development channel...');
    const settingsLink = page.locator('.link_snb').filter({ hasText: '설정' }).first();
    await settingsLink.waitFor({ state: 'visible', timeout: 30000 });
    await settingsLink.click({ force: true });
    await page.waitForTimeout(2000);

    // Check if the correct channel is already selected
    const cleanId = channelSearchId.startsWith('@') ? channelSearchId.slice(1) : channelSearchId;
    const currentChannelText = await page.locator('.box_bizopt2 .link_selected, .box_bizopt2 .txt_selected, .box_bizopt2 span').first().textContent().catch(() => '');
    console.log(`[kakao:createBot] Current selected channel text: "${currentChannelText?.trim()}" (looking for "${cleanId}")`);
    
    if (currentChannelText?.toLowerCase().includes(cleanId.toLowerCase())) {
      console.log(`[kakao:createBot] Channel "${cleanId}" is already selected. Skipping selection.`);
    } else {
      const selectDevChannelBtn = page.getByRole('button', { name: '개발 채널 선택하기' });
      if (await selectDevChannelBtn.count() > 0) {
        await selectDevChannelBtn.click({ force: true });
        await page.waitForTimeout(2000);

        // Try to find the channel by search ID (with or without @)
        const channelCell = page.locator('td').filter({ hasText: new RegExp(`${cleanId}|@${cleanId}`, 'i') }).first();
        
        try {
          console.log(`[kakao:createBot] Looking for channel: ${cleanId}...`);
          await channelCell.waitFor({ state: 'visible', timeout: 15000 });
          await channelCell.click({ force: true });
          await page.waitForTimeout(1000);
          
          // Confirm selection if a secondary button appears
          const confirmSelectionBtn = page.locator('mat-dialog-container button').filter({ hasText: /선택|확인/ }).first();
          if (await confirmSelectionBtn.count() > 0) {
            await confirmSelectionBtn.click({ force: true });
          }

          await page.waitForSelector('mat-dialog-container', { state: 'hidden', timeout: 10000 }).catch(() => {});
        } catch (e: any) {
          console.warn(`[kakao:createBot] Could not select channel "${channelSearchId}" automatically:`, e.message);
          console.log('[kakao:createBot] Proceeding anyway (user might have selected manually)...');
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(1000);
        }

        // ALWAYS try to click "저장" before leaving the settings page
        const saveBtn = page.locator('button.btn_save').filter({ hasText: '저장' }).first();
        try {
          if (await saveBtn.isVisible({ timeout: 5000 })) {
            console.log('[kakao:createBot] Clicking "저장" button...');
            await saveBtn.click({ force: true });
            await page.waitForTimeout(3000);
            
            if (await saveBtn.isEnabled().catch(() => false)) {
              console.log('[kakao:createBot] Save button still enabled, retrying click...');
              await saveBtn.click({ force: true });
              await page.waitForTimeout(2000);
            }
          }
        } catch (saveErr) {
          console.warn('[kakao:createBot] Warning: Could not click "저장" button:', (saveErr as any).message);
        }
        
        console.log('[kakao:createBot] Channel selection step complete.');
        await page.waitForTimeout(2000);
      }
    }
    await page.waitForTimeout(500);

    // 6. Apply for callback
    console.log('[kakao:createBot] Navigating to AI Chatbot Management...');
    // Ensure any leftover modals are closed
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1000);

    const aiChatbotLink = page.locator('a.link_tab').filter({ hasText: 'AI 챗봇 관리' }).first();
    await aiChatbotLink.waitFor({ state: 'visible', timeout: 15000 });
    
    console.log('[kakao:createBot] Clicking AI Chatbot Management tab...');
    await aiChatbotLink.click({ force: true });
    await page.waitForTimeout(4000);

    // Define the callback button locator with multiple fallbacks
    const getCallbackBtn = () => {
      return page.locator('button, .btn_g, .btn_comm, a').filter({ hasText: /콜백 사용 신청|콜백|Callback/ }).first();
    };

    let btnVisible = await getCallbackBtn().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    
    // If not visible, check for "already applied" status
    if (!btnVisible) {
      console.log('[kakao:createBot] Callback button not visible. Checking for "AI Chatbot" status...');
      const pageText = await page.innerText('body').catch(() => '');
      const alreadyApplied = /사용|콜백 사용 중|신청 완료|심사 중|일반 챗봇 전환/.test(pageText);

      if (alreadyApplied) {
        console.log('[kakao:createBot] Callback appears to be already applied or in use. Skipping.');
        btnVisible = true;
      }
    }

    if (!btnVisible) {
      throw new Error(`Failed to navigate to AI Chatbot Management tab or find callback button. Final URL: ${page.url()}`);
    }

    // Only click if we found the button and it's not already applied
    const callbackBtnToClick = getCallbackBtn();
    if (await callbackBtnToClick.isVisible().catch(() => false)) {
      console.log('[kakao:createBot] Applying for callback...');
      await callbackBtnToClick.click({ force: true });
      await page.waitForTimeout(2000);
    } else {
      console.log('[kakao:createBot] Callback button not visible for clicking (likely already applied).');
    }

    // Check if we are on the application form or if it was already submitted
    const isFormVisible = await page.locator('#tfPurpose').isVisible({ timeout: 5000 }).catch(() => false);
    if (isFormVisible) {
      await page.fill('#tfPurpose', 'OpenClaw AI 챗봇과 카카오톡 연동을 위한 비동기 응답 처리');
      await page.waitForTimeout(500);
      await page.fill('#tfReason', 'OpenClaw 기반 AI 챗봇을 카카오톡 채널에 연동하려 합니다. AI 모델의 응답 생성에 5초 이상 소요될 수 있어, 기본 스킬 타임아웃(5초) 내에 응답이 불가능합니다. 콜백 API를 통해 즉시 대기 메시지를 반환한 후, OpenClaw Gateway에서 AI 응답을 받아 callbackUrl로 전송하는 방식으로 구현할 예정입니다.');
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: '신청' }).click({ force: true });
      console.log('[kakao:createBot] Callback application submitted.');
      await page.waitForTimeout(1000);
    } else {
      console.log('[kakao:createBot] Application form not visible (likely already submitted or approved).');
    }

    // 7. Create skill
    console.log(`[kakao:createBot] Creating skill "${skillName}"...`);
    const skillMenu = page.locator('.link_snb').filter({ hasText: '스킬' }).first();
    await skillMenu.waitFor({ state: 'visible', timeout: 10000 });
    await skillMenu.click({ force: true });
    await page.waitForTimeout(1000);

    const skillListLink = page.locator('.link_sub').filter({ hasText: '스킬 목록' }).first();
    await skillListLink.waitFor({ state: 'visible', timeout: 10000 });
    await skillListLink.click({ force: true });
    await page.waitForTimeout(2000);
    await page.waitForSelector('table, .list_skill, .item_skill', { timeout: 10000 }).catch(() => {});

    // Check if skill already exists with correct URL
    const existingSkillRow = page.locator('tr, .item_skill').filter({ hasText: skillName }).first();
    let skipSkillCreation = false;
    if (await existingSkillRow.count() > 0) {
      const existingUrl = await existingSkillRow.locator('td, .txt_url').filter({ hasText: /http/ }).first().textContent().catch(() => '');
      const cleanExisting = existingUrl?.trim().replace(/\/$/, '') || '';
      const cleanTarget = fullSkillUrl.trim().replace(/\/$/, '');
      console.log(`[kakao:createBot] Found existing skill "${skillName}" with URL: "${cleanExisting}" (target: "${cleanTarget}")`);
      
      if (cleanExisting === cleanTarget) {
        console.log(`[kakao:createBot] Skill "${skillName}" already exists with correct URL. Skipping creation.`);
        skipSkillCreation = true;
      } else {
        console.log(`[kakao:createBot] Skill "${skillName}" exists but with different URL. Re-creating...`);
        // Delete existing skill
        await existingSkillRow.locator('button').filter({ hasText: '삭제' }).click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
        const confirmDeleteBtn = page.locator('mat-dialog-container button').filter({ hasText: '확인' }).first();
        if (await confirmDeleteBtn.count() > 0) {
          await confirmDeleteBtn.click({ force: true });
          await page.waitForTimeout(2000);
        }
      }
    }

    if (!skipSkillCreation) {
      const createSkillBtn = page.getByRole('button', { name: '생성' });
      await createSkillBtn.waitFor({ state: 'visible', timeout: 10000 });
      await createSkillBtn.click({ force: true });
      await page.waitForTimeout(500);

      await page.fill('#tfSet2', skillName);
      await page.waitForTimeout(500);
      console.log(`[kakao:createBot] Skill URL: "${fullSkillUrl || '(empty)'}"`);
      await page.fill('#tfSet22', fullSkillUrl);
      await page.waitForTimeout(500);
      await page.fill('[id^="tfInpKey_"]', 'X-Api-Key');
      await page.waitForTimeout(500);
      await page.locator('xpath=/html/body/app-page/div[2]/div/bot-page/div/div/main/skill-page/div/div/div/skill-info/div/div[3]/div[1]/div[2]/div[2]/div[1]/div[2]/bee-input/div/input').fill(apiKey);
      await page.waitForTimeout(500);

      const skillSaveBtn = page.getByRole('button', { name: '저장' });
      await skillSaveBtn.click({ force: true });
      console.log('[kakao:createBot] Skill created.');
      await page.waitForTimeout(3000);
    }

    // 8. Wait for callback approval (up to 20 × 30s = 10 min)
    console.log('[kakao:createBot] Waiting for callback approval...');
    let approved = false;
    let attempts = 0;

    // Navigate to Scenario → Fallback Block once
    const scenarioLink = page.locator('a.link_snb').filter({ hasText: '시나리오' }).first();
    await scenarioLink.waitFor({ state: 'visible', timeout: 15000 });
    await scenarioLink.click({ force: true });
    await page.waitForTimeout(2000);

    const fallbackBtn = page.locator('button.link_item').filter({ hasText: '폴백 블록' }).first();
    await fallbackBtn.waitFor({ state: 'visible', timeout: 15000 });
    await fallbackBtn.click({ force: true });
    await page.waitForTimeout(2000);

    // Check if skill is already linked to fallback block
    const skillBubble = page.locator('.bubble_response').first();
    const currentSkillText = await skillBubble.locator('.txt_item, .txt_skill, span').first().textContent().catch(() => '');
    console.log(`[kakao:createBot] Current linked skill text: "${currentSkillText?.trim()}" (looking for "${skillName}")`);
    
    let skipSkillLinking = false;
    if (currentSkillText?.includes(skillName)) {
      console.log(`[kakao:createBot] Skill "${skillName}" is already linked. Checking callback...`);
      skipSkillLinking = true;
    }

    while (!approved) {
      if (skipSkillLinking) {
        console.log('[kakao:createBot] Skill already linked, assuming callback is already approved.');
        approved = true;
        break;
      }
      attempts++;
      console.log(`[kakao:createBot] Attempt ${attempts}: checking callback approval...`);

      // Click the settings icon to open the options list
      const settingsBtn = page.locator('button.btn_util.btn_modify').first();
      await settingsBtn.waitFor({ state: 'visible', timeout: 10000 });
      await settingsBtn.click({ force: true });
      await page.waitForTimeout(1500);

      const callbackLink = page.locator('a.link_modify').filter({ hasText: 'Callback 설정' });
      if (await callbackLink.count() > 0) {
        console.log('[kakao:createBot] Callback approved!');
        await callbackLink.click({ force: true });
        approved = true;
      } else {
        if (attempts >= 20) {
          console.error('[kakao:createBot] Timeout: callback not approved within 10 minutes.');
          break;
        }
        
        console.log('[kakao:createBot] Not approved yet. Closing options and waiting 30s...');
        // Press Escape to close the options list
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(30000);

        // Every 5 attempts, do a full page reload to be safe
        if (attempts % 5 === 0) {
          console.log('[kakao:createBot] Periodic reload to refresh state...');
          await page.reload();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(3000);
          await dismissKakaoPopups(page);
          
          // Re-navigate
          await scenarioLink.waitFor({ state: 'visible', timeout: 15000 });
          await scenarioLink.click({ force: true });
          await page.waitForTimeout(2000);
          await fallbackBtn.waitFor({ state: 'visible', timeout: 15000 });
          await fallbackBtn.click({ force: true });
          await page.waitForTimeout(2000);
        }
      }
    }

    if (!approved) {
      return { success: false, error: 'Callback was not approved within 10 minutes' };
    }

    // 9. Configure callback
    console.log('[kakao:createBot] Configuring callback...');
    await dismissKakaoPopups(page);
    await page.waitForTimeout(500);

    // The callback settings dialog may be inside a mat-dialog-container or .layer_reply
    const callbackLayer = page.locator('mat-dialog-container reply-url-component, .layer_reply');
    await callbackLayer.first().waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);

    // Enable callback toggle — button.btn_switch is the known toggle in reply-url-component
    const toggle = page.locator('reply-url-component button.btn_switch').first();
    if (await toggle.count() > 0) {
      console.log('[kakao:createBot] Clicking callback toggle (button.btn_switch)');
      await toggle.click({ force: true });
    } else {
      // Fallback: first button inside the component
      console.log('[kakao:createBot] btn_switch not found, falling back to first button');
      await page.locator('reply-url-component button').first().click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(500);

    await page.fill('#tfReply', 'EGClaw가 생각중입니다...');
    await page.waitForTimeout(500);

    const callbackConfirmBtn = page.locator('reply-url-component button, .layer_reply button').filter({ hasText: '확인' }).first();
    await callbackConfirmBtn.click({ force: true });
    await page.locator('mat-dialog-container reply-url-component, .layer_reply').first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    console.log('[kakao:createBot] Callback enabled.');
    await page.waitForTimeout(1000);

    // 10. Link skill to fallback block
    if (skipSkillLinking) {
      console.log('[kakao:createBot] Skill already linked. Skipping linking step.');
    } else {
      console.log('[kakao:createBot] Linking skill to fallback block...');
      const skillSearchInput = page.locator('#optionSearch, .opt_search').first();
      await skillSearchInput.waitFor({ state: 'visible', timeout: 15000 });
      console.log('[kakao:createBot] Clicking skill search input...');
      await skillSearchInput.click({ force: true });
      await page.waitForTimeout(1500);

      console.log(`[kakao:createBot] Searching and selecting skill "${skillName}"...`);
      let skillLinked = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const skillOption = page.locator('.list_opt .link_opt').filter({ hasText: skillName }).first();
          if (await skillOption.count() > 0) {
            await skillOption.click({ force: true });
            await page.waitForTimeout(2000);
            
            const skillDataBubbleLink = page.locator('.bubble_response .link_util').filter({ hasText: '스킬데이터' }).first();
            if (await skillDataBubbleLink.isVisible({ timeout: 5000 })) {
              console.log('[kakao:createBot] Skill bubble detected, clicking "스킬데이터"...');
              await skillDataBubbleLink.click({ force: true });
              await page.waitForTimeout(1000);
              skillLinked = true;
              break;
            }
          }
          
          // If not found or bubble didn't appear, try re-clicking search input
          console.log(`[kakao:createBot] Skill link attempt ${attempt} failed, retrying...`);
          await skillSearchInput.click({ force: true });
          await page.waitForTimeout(1500);
        } catch (e: any) {
          console.warn(`[kakao:createBot] Skill link attempt ${attempt} error:`, e.message);
        }
      }

      if (!skillLinked) {
        throw new Error(`Failed to link skill "${skillName}" to fallback block after 3 attempts.`);
      }

      const linkSaveBtn = page.locator('button').filter({ hasText: '저장' }).first();
      if (await linkSaveBtn.isVisible()) {
        console.log('[kakao:createBot] Clicking "저장" button for skill link...');
        await linkSaveBtn.click({ force: true });
        await page.waitForTimeout(3000);
      }
      console.log('[kakao:createBot] Skill linked.');
      await page.waitForTimeout(1000);
    }

    // 11. Deploy
    console.log('[kakao:createBot] Deploying bot...');
    const deploySidebarLink = page.locator('a.link_snb').filter({ hasText: '배포' }).first();
    await deploySidebarLink.waitFor({ state: 'visible', timeout: 10000 });
    await deploySidebarLink.click({ force: true });
    await page.waitForTimeout(2000);

    const deployBtn = page.locator('button.btn_g.btn_g2').filter({ hasText: '배포' }).first();
    await deployBtn.waitFor({ state: 'visible', timeout: 10000 });
    await deployBtn.click({ force: true });
    await page.waitForTimeout(1000);

    const finalDeployBtn = page.locator('mat-dialog-container button').filter({ hasText: '배포' }).first();
    if (await finalDeployBtn.count() > 0) {
      await finalDeployBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }

    await page.getByRole('button', { name: '확인' }).click({ timeout: 5000, force: true }).catch(() => {});
    console.log('[kakao:createBot] Bot deployed successfully!');

    return { success: true, botName };
  } catch (err: any) {
    console.error('[kakao:createBot] Error:', err);
    return { success: false, error: err?.message || String(err) };
  } finally {
    await context.close().catch(() => {});
  }
}

// ── Registration ─────────────────────────────────────────────────────────────

export function registerKakaoHandlers(getGoogleProfilesDir: () => string): void {
  ipcMain.handle(
    'kakao:createChannel',
    async (_event, { profileName, channelName, searchId, reuseExisting }: { profileName: string; channelName: string; searchId: string; reuseExisting?: boolean }) => {
      try {
        const profileDir = getProfileDir(getGoogleProfilesDir, profileName);
        return await createKakaoChannel(profileDir, channelName, searchId, reuseExisting ?? true);
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
      }
    }
  );

  ipcMain.handle(
    'kakao:createBot',
    async (_event, { profileName, botName, channelSearchId, skillUrl, reuseExisting }: { profileName: string; botName: string; channelSearchId: string; skillUrl: string; reuseExisting?: boolean }) => {
      try {
        const profileDir = getProfileDir(getGoogleProfilesDir, profileName);
        
        // Fallback to stored tunnel URL if skillUrl is empty
        let finalSkillUrl = skillUrl?.trim();
        if (!finalSkillUrl) {
          const { getStore } = require('./storage');
          const mcpConfig = (getStore().get('mcpConfiguration') as any) ?? {};
          const publicUrl = mcpConfig?.tunnel?.publicUrl;
          if (publicUrl) {
            console.log(`[kakao:createBot] Using stored tunnel URL: ${publicUrl}`);
            finalSkillUrl = publicUrl;
          }
        }

        return await createKakaoBot(profileDir, botName, channelSearchId, finalSkillUrl, reuseExisting ?? true);
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
      }
    }
  );
}
