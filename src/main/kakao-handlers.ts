import { ipcMain, app } from 'electron';
import { getStore } from './storage';
import * as path from 'path';
import * as fs from 'fs';

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

// ── kakao:createChannel ──────────────────────────────────────────────────────

async function createKakaoChannel(
  profileDir: string,
  channelName: string,
  searchId: string
): Promise<{ success: true; searchId: string; channelUrl: string } | { success: false; error: string }> {
  const context = await launchBrowser(profileDir);
  const page = context.pages()[0];

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

    // 2. Navigate to Profiles & click "새 채널 만들기" — retry up to 3×
    let wizardFrame: any = null;

    for (let attempt = 1; attempt <= 3 && !wizardFrame; attempt++) {
      console.log(`[kakao:createChannel] Navigating to profiles (attempt ${attempt})...`);
      await page.goto('https://business.kakao.com/profiles');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      console.log(`[kakao:createChannel] Clicking "새 채널 만들기" (attempt ${attempt})...`);
      const createBtn = page.locator('button').filter({ hasText: '새 채널 만들기' }).first();
      try {
        await createBtn.waitFor({ timeout: 15000 });
        await createBtn.click();
      } catch {
        await page.click('.btn_rc_highlight').catch(() => {});
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

    while (true) {
      console.log(`\n[kakao:createChannel] --- [STEP ${wizardStep}] ---`);
      await page.waitForTimeout(3000);

      // Check main page settings (appear after wizard completes)
      const profileDirect = page.locator('#profileDirect');
      const enableSearch = page.locator('#enableSearch');

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

      if (await enableSearch.count() > 0) {
        console.log('[kakao:createChannel] Found "검색 허용" setting.');
        if (!(await enableSearch.isChecked())) {
          console.log('[kakao:createChannel] Toggling "검색 허용" ON...');
          await enableSearch.click({ force: true });
          await page.waitForTimeout(1000);
          const confirmBtn = page.locator('button').filter({ hasText: '확인' }).first();
          if (await confirmBtn.count() > 0) {
            await confirmBtn.click();
            await page.waitForTimeout(2000);
          }
        }
      }

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
          console.log(`[kakao:createChannel] Profile image path: ${profileImagePath} (exists: ${fs.existsSync(profileImagePath)})`);
          if (await fileInput.count() > 0 && fs.existsSync(profileImagePath)) {
            console.log(`[kakao:createChannel] Uploading profile image: ${profileImagePath}`);
            await fileInput.setInputFiles(profileImagePath);
            await page.waitForTimeout(1000);
          } else if (await fileInput.count() > 0) {
            console.warn(`[kakao:createChannel] Skipping image upload — file not found at: ${profileImagePath}`);
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

          console.log('[kakao:createChannel] Clicking "채널" in sidebar...');
          const channelMenu = page.locator('a[data-menu-id="channel"], a.link_snb:has-text("채널")').first();
          try {
            await channelMenu.waitFor({ timeout: 20000 });
            await channelMenu.click();
            console.log('[kakao:createChannel] Clicked "채널". Waiting for settings page...');
            await page.waitForTimeout(5000);
          } catch (e: any) {
            console.error('[kakao:createChannel] Failed to click "채널" menu:', e.message);
          }
        }

        wizardStep++;
      } else {
        // No Next button — check if we're on the settings page (done)
        if (await profileDirect.count() > 0) {
          console.log('[kakao:createChannel] Settings applied. Done.');
          break;
        }
        console.log('[kakao:createChannel] No Next button found. Stopping.');
        break;
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

    return { success: true, searchId, channelUrl };
  } finally {
    await context.close().catch(() => {});
  }
}

// ── kakao:createBot ──────────────────────────────────────────────────────────

async function createKakaoBot(
  profileDir: string,
  botName: string,
  channelSearchId: string,
  skillUrl: string
): Promise<{ success: true; botName: string } | { success: false; error: string }> {
  const context = await launchBrowser(profileDir);
  const page = context.pages()[0];

  const skillName = 'openclawresponse';
  const fullSkillUrl = skillUrl ? `${skillUrl}/kakao/skill` : '';
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
    }

    // Wait for chatbot admin to fully load
    await page.waitForSelector('.layer_head, .btn_g:has-text("채널 챗봇 만들기"), bot-list-welcome-dialog', { timeout: 60000 });
    console.log('[kakao:createBot] Page loaded.');
    await page.waitForTimeout(500);

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

    // 3. Create bot
    console.log('[kakao:createBot] Creating bot...');
    const createBtn = page.locator('button').filter({ hasText: '채널 챗봇 만들기' }).first();
    await createBtn.waitFor({ state: 'visible', timeout: 10000 });
    await createBtn.click({ force: true });
    await page.waitForTimeout(500);

    const botTypeLink = page.locator('a, button').filter({ hasText: /카카오톡 챗봇|카카오톡 채널 기반 챗봇/ }).first();
    await botTypeLink.waitFor({ timeout: 10000 });
    await botTypeLink.click({ force: true });
    await page.waitForTimeout(500);

    await page.waitForSelector('#tf1');
    await page.fill('#tf1', botName);
    await page.waitForTimeout(500);

    const confirmBtn = page.locator('.layer_newbot button').filter({ hasText: '확인' }).first();
    await confirmBtn.click({ force: true });

    try {
      await page.waitForSelector('.layer_newbot', { state: 'hidden', timeout: 10000 });
    } catch {
      await confirmBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(500);

    // 4. Settings → select development channel
    console.log('[kakao:createBot] Selecting development channel...');
    const settingsLink = page.locator('.link_snb').filter({ hasText: '설정' }).first();
    await settingsLink.waitFor({ state: 'visible', timeout: 30000 });
    await settingsLink.click({ force: true });
    await page.waitForTimeout(2000);

    const selectDevChannelBtn = page.getByRole('button', { name: '개발 채널 선택하기' });
    if (await selectDevChannelBtn.count() > 0) {
      await selectDevChannelBtn.click({ force: true });
      await page.waitForTimeout(2000);

      const channelCell = page.locator('td').filter({ hasText: channelSearchId }).first();
      try {
        await channelCell.waitFor({ state: 'visible', timeout: 10000 });
        await channelCell.click({ force: true });
        await page.waitForTimeout(500);
        await page.waitForSelector('mat-dialog-container', { state: 'hidden', timeout: 10000 }).catch(() => {});

        const saveBtn = page.locator('button.btn_save').filter({ hasText: '저장' }).first();
        await saveBtn.click({ force: true });
        console.log('[kakao:createBot] Channel selected and saved.');
        await page.waitForTimeout(3000);
      } catch (e: any) {
        console.warn(`[kakao:createBot] Could not select channel "${channelSearchId}":`, e.message);
        await page.keyboard.press('Escape');
      }
    }
    await page.waitForTimeout(500);

    // 5. Apply for callback
    console.log('[kakao:createBot] Applying for callback...');
    const aiChatbotLink = page.locator('a.link_tab').filter({ hasText: 'AI 챗봇 관리' }).first();
    await aiChatbotLink.waitFor({ state: 'visible', timeout: 30000 });
    await aiChatbotLink.click({ force: true });
    await page.waitForTimeout(3000);

    const callbackBtn = page.getByRole('button', { name: '콜백 사용 신청' });
    await callbackBtn.waitFor({ timeout: 10000 });
    await callbackBtn.click({ force: true });
    await page.waitForTimeout(500);

    await page.fill('#tfPurpose', 'OpenClaw AI 챗봇과 카카오톡 연동을 위한 비동기 응답 처리');
    await page.waitForTimeout(500);
    await page.fill('#tfReason', 'OpenClaw 기반 AI 챗봇을 카카오톡 채널에 연동하려 합니다. AI 모델의 응답 생성에 5초 이상 소요될 수 있어, 기본 스킬 타임아웃(5초) 내에 응답이 불가능합니다. 콜백 API를 통해 즉시 대기 메시지를 반환한 후, OpenClaw Gateway에서 AI 응답을 받아 callbackUrl로 전송하는 방식으로 구현할 예정입니다.');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '신청' }).click({ force: true });
    console.log('[kakao:createBot] Callback application submitted.');
    await page.waitForTimeout(500);

    // 6. Create skill
    console.log(`[kakao:createBot] Creating skill "${skillName}"...`);
    const skillMenu = page.locator('.link_snb').filter({ hasText: '스킬' }).first();
    await skillMenu.waitFor({ state: 'visible', timeout: 10000 });
    await skillMenu.click({ force: true });
    await page.waitForTimeout(1000);

    const skillListLink = page.locator('.link_sub').filter({ hasText: '스킬 목록' }).first();
    await skillListLink.waitFor({ state: 'visible', timeout: 10000 });
    await skillListLink.click({ force: true });
    await page.waitForTimeout(1000);

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

    // 7. Wait for callback approval (up to 20 × 30s = 10 min)
    console.log('[kakao:createBot] Waiting for callback approval...');
    let approved = false;
    let attempts = 0;

    while (!approved) {
      attempts++;
      console.log(`[kakao:createBot] Attempt ${attempts}: checking callback approval...`);

      const scenarioLink = page.locator('a.link_snb').filter({ hasText: '시나리오' }).first();
      await scenarioLink.waitFor({ state: 'visible', timeout: 10000 });
      await scenarioLink.click({ force: true });
      await page.waitForTimeout(2000);

      const fallbackBtn = page.locator('button.link_item').filter({ hasText: '폴백 블록' }).first();
      await fallbackBtn.waitFor({ state: 'visible', timeout: 10000 });
      await fallbackBtn.click({ force: true });
      await page.waitForTimeout(2000);

      const settingsBtn = page.locator('button.btn_util.btn_modify').first();
      await settingsBtn.waitFor({ state: 'visible', timeout: 10000 });
      await settingsBtn.click({ force: true });
      await page.waitForTimeout(1000);

      const callbackLink = page.locator('a.link_modify').filter({ hasText: 'Callback 설정' });
      if (await callbackLink.count() > 0) {
        console.log('[kakao:createBot] Callback approved!');
        await callbackLink.click({ force: true });
        approved = true;
      } else {
        if (attempts > 20) {
          console.error('[kakao:createBot] Timeout: callback not approved within 10 minutes.');
          break;
        }
        console.log('[kakao:createBot] Not approved yet. Waiting 30s...');
        await page.waitForTimeout(30000);
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Close popup after reload if present
        const dlg = page.locator('bot-list-welcome-dialog');
        if (await dlg.count() > 0) {
          await dlg.locator('span.ico_bot').filter({ hasText: '닫기' }).first().click({ force: true }).catch(() => {});
        }
      }
    }

    if (!approved) {
      return { success: false, error: 'Callback was not approved within 10 minutes' };
    }

    // 8. Configure callback
    console.log('[kakao:createBot] Configuring callback...');
    const callbackLayer = page.locator('.layer_reply');
    await callbackLayer.waitFor({ state: 'visible', timeout: 10000 });

    await page.locator('xpath=/html/body/div[2]/div[2]/div/mat-dialog-container/div/div/reply-url-component/div/div[2]/div/div[1]/button').click({ force: true });
    await page.waitForTimeout(500);
    await page.fill('#tfReply', 'EGClaw가 생각중입니다...');
    await page.waitForTimeout(500);
    await callbackLayer.locator('button').filter({ hasText: '확인' }).click({ force: true });
    await callbackLayer.waitFor({ state: 'hidden', timeout: 10000 });
    console.log('[kakao:createBot] Callback enabled.');
    await page.waitForTimeout(1000);

    // 9. Link skill to fallback block
    console.log('[kakao:createBot] Linking skill to fallback block...');
    const skillSearchInput = page.locator('#optionSearch, .opt_search').first();
    await skillSearchInput.waitFor({ state: 'visible', timeout: 10000 });
    console.log('[kakao:createBot] Clicking skill search input...');
    await skillSearchInput.click({ force: true });
    await page.waitForTimeout(1000);

    console.log(`[kakao:createBot] Waiting for skill option "${skillName}" in dropdown...`);
    const skillOption = page.locator('.list_opt .link_opt').filter({ hasText: skillName }).first();
    await skillOption.waitFor({ state: 'visible', timeout: 10000 });
    await skillOption.click({ force: true });
    await page.waitForTimeout(1000);

    const skillDataBubbleLink = page.locator('.bubble_response .link_util').filter({ hasText: '스킬데이터' }).first();
    await skillDataBubbleLink.waitFor({ state: 'visible', timeout: 10000 });
    await skillDataBubbleLink.click({ force: true });
    await page.waitForTimeout(1000);

    const linkSaveBtn = page.locator('button').filter({ hasText: '저장' }).first();
    await linkSaveBtn.click({ force: true });
    console.log('[kakao:createBot] Skill linked.');
    await page.waitForTimeout(3000);

    // 10. Deploy
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
    async (_event, { profileName, channelName, searchId }: { profileName: string; channelName: string; searchId: string }) => {
      try {
        const profileDir = getProfileDir(getGoogleProfilesDir, profileName);
        return await createKakaoChannel(profileDir, channelName, searchId);
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
      }
    }
  );

  ipcMain.handle(
    'kakao:createBot',
    async (_event, { profileName, botName, channelSearchId, skillUrl }: { profileName: string; botName: string; channelSearchId: string; skillUrl: string }) => {
      try {
        const profileDir = getProfileDir(getGoogleProfilesDir, profileName);
        return await createKakaoBot(profileDir, botName, channelSearchId, skillUrl);
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
      }
    }
  );
}
