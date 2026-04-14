/**
 * IBK (기업은행) - 외상매출채권 (Promissory Notes) Automation
 * Site: kiup.ibk.co.kr
 * Flow: Login via cert -> 판매기업 -> 외상매출채권 -> 채권조회/취소신청 -> Excel download
 */

require('dotenv').config();
const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');
const { ArduinoHID } = require('./arduino-typer');

(async () => {
  const arduino = new ArduinoHID();
  await arduino.connect();
  console.log('[Arduino] Connected and ready.');

  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Browser', 'ibk-promissory');
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }
  console.log('📥 Downloads:', downloadsPath);

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-profile-'));

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    viewport: null,
    permissions: ['clipboard-read', 'clipboard-write'],
    acceptDownloads: true,
    downloadsPath: downloadsPath,
    args: [
      '--start-maximized',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--allow-running-insecure-content',
    ],
  });

  let page = context.pages()[0] || await context.newPage();

  page.on('dialog', async (dialog) => {
    console.log(`🔔 Dialog: ${dialog.type()} - "${dialog.message()}"`);
    await dialog.accept();
  });

  process.on('SIGINT', async () => {
    console.log('\n[SIGINT] Cleaning up...');
    try { await arduino.close(); } catch (e) {}
    try { await context.close(); } catch (e) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
    process.exit(0);
  });

  function ps(cmd, timeout = 10000) {
    return execSync(
      `powershell -command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${cmd}"`,
      { encoding: 'utf8', timeout }
    ).trim();
  }

  try {
    // ══════════════════════════════════════════════════════════════
    // STEP 1-5: Login Flow (Navigate -> Cert Window -> Select)
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 1] Navigating to kiup.ibk.co.kr...');
    await page.goto('https://kiup.ibk.co.kr/uib/jsp/index.jsp');
    await page.waitForTimeout(3000);

    console.log('[STEP 2] Clicking 로그인...');
    let frame = page.frame({ name: 'mainframe' });
    if (!frame) throw new Error('mainframe not found');
    await frame.locator('a:has-text("로그인")').first().click();
    await page.waitForTimeout(2000);

    console.log('[STEP 3] Clicking 공인인증서...');
    try {
      await frame.locator('.ec').first().click({ timeout: 5000 });
    } catch (e) {
      await frame.locator('text=(구 공인인증서)').first().click();
    }
    await page.waitForTimeout(3000);

    console.log('[STEP 4] Detecting cert window...');
    let windowFound = false;
    for (let i = 0; i < 20; i++) {
        const qwidgetCheck = ps("Add-Type -AssemblyName UIAutomationClient; $r = [System.Windows.Automation.AutomationElement]::RootElement; $c = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'QWidget'); $w = $r.FindFirst([System.Windows.Automation.TreeScope]::Children, $c); if ($w) { $w.Current.Name } else { '' }");
        if (qwidgetCheck) { windowFound = true; break; }
        await page.waitForTimeout(1000);
    }
    if (!windowFound) throw new Error('Cert window not detected.');

    console.log('[STEP 5] Selecting cert (Enter)...');
    await arduino.key('ENTER');
    await page.waitForTimeout(2000);

    // ══════════════════════════════════════════════════════════════
    // STEP 6: 비밀번호 입력 (아두이노)
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 6] 비밀번호 입력 칸으로 이동 중 (TAB 4회)...');
    for (let i = 1; i <= 4; i++) {
      await arduino.key('TAB');
      await page.waitForTimeout(300);
    }

    const certPassword = process.env.CERT_PASSWORD;
    if (!certPassword) throw new Error('CERT_PASSWORD 환경 변수가 설정되지 않았습니다.');
    
    console.log('[STEP 6] 비밀번호 입력 중...');
    await arduino.type(certPassword);
    await page.waitForTimeout(2000);

    // ══════════════════════════════════════════════════════════════
    // STEP 7: 엔터 키 입력으로 로그인 확정
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 7] ENTER로 로그인 확정...');
    await arduino.key('ENTER');
    await page.waitForTimeout(5000);

    // ══════════════════════════════════════════════════════════════
    // STEP 8: 로그인 후 팝업 닫기 및 프레임 재식별
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 8] 팝업 체크 및 프레임 재식별...');
    const mainframe = page.frame({ name: 'mainframe' });
    if (!mainframe) throw new Error('mainframe을 찾을 수 없습니다.');

    const popupSelectors = ['button:has-text("닫기")', 'button:has-text("확인")', '.popup_close', '.btn_close'];
    for (const sel of popupSelectors) {
      try {
        const btn = mainframe.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 })) await btn.click();
      } catch (e) {}
    }

    /**
     * 요소에 대해 JS 이벤트와 물리 클릭을 모두 수행하는 헬퍼 함수
     */
    const robustClick = async (frame, selector, matchText = null) => {
      const result = await frame.evaluate(([sel, text]) => {
        let el;
        if (text) {
          el = Array.from(document.querySelectorAll(sel)).find(e => e.textContent.includes(text));
        } else {
          el = document.querySelector(sel);
        }
        if (!el) return null;
        
        el.scrollIntoView();
        const rect = el.getBoundingClientRect();
        ['mousedown', 'mouseup', 'click'].forEach(type => {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        });
        if (el.onclick) el.onclick();
        
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }, [selector, matchText]);

      if (result) {
        try { await page.mouse.click(result.x, result.y); } catch (e) {}
        return true;
      }
      return false;
    };

    // ══════════════════════════════════════════════════════════════
    // STEP 9: 메뉴 내비게이션 (판매기업 -> 외상매출채권)
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 9] 메뉴 내비게이션을 시작합니다...');

    console.log('[STEP 9-1] "B2B" 상단 메뉴 활성화...');
    try {
      const b2bImg = mainframe.locator('img[alt="B2B"]').first();
      await b2bImg.hover();
      await page.waitForTimeout(500);
      await b2bImg.click();
    } catch (e) {}
    await page.waitForTimeout(2000);

    console.log('[STEP 9-2] "판매기업" 클릭...');
    await robustClick(mainframe, 'a[efncmenuid="E0303000000"]');
    await page.waitForTimeout(1500);

    console.log('[STEP 9-3] "외상매출채권" 클릭...');
    await robustClick(mainframe, 'a[efncmenuid="E0303040000"]');
    await page.waitForTimeout(1500);

    console.log('[STEP 9-4] "채권조회/취소신청" 클릭...');
    await robustClick(mainframe, 'a', '채권조회/취소신청');
    await page.waitForTimeout(3000);

    // ══════════════════════════════════════════════════════════════
    // STEP 10: 날짜 범위 설정 (2022-01-01 ~ 어제)
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 10] 날짜 범위를 설정 중 (2022-01-01 ~ 어제)...');
    
    const startYY = '2022';
    const startMM = '01';
    const startDD = '01';

    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const endYY = String(yesterday.getFullYear());
    const endMM = String(yesterday.getMonth() + 1).padStart(2, '0');
    const endDD = String(yesterday.getDate()).padStart(2, '0');

    console.log(`[STEP 10] 설정 범위: ${startYY}-${startMM}-${startDD} ~ ${endYY}-${endMM}-${endDD}`);

    try {
      await mainframe.locator('[id="inqy_sttg_ymd_yy"]').selectOption(startYY);
      await mainframe.locator('[id="inqy_sttg_ymd_mm"]').selectOption(startMM);
      await mainframe.locator('[id="inqy_sttg_ymd_dd"]').selectOption(startDD);
      await mainframe.locator('[id="inqy_eymd_yy"]').selectOption(endYY);
      await mainframe.locator('[id="inqy_eymd_mm"]').selectOption(endMM);
      await mainframe.locator('[id="inqy_eymd_dd"]').selectOption(endDD);
      console.log('[STEP 10] ✓ 날짜 범위 설정 완료.');
    } catch (e) {
      console.log(`[STEP 10] ⚠️ 날짜 설정 오류: ${e.message}`);
    }
    await page.waitForTimeout(1000);

    // ══════════════════════════════════════════════════════════════
    // STEP 11: 조회 실행 (진단 로그 기반 확정 버튼)
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 11] 조회 버튼 클릭 중 (a.btn_ok)...');
    const searchOk = await robustClick(mainframe, 'a.btn_ok', '조회');
    if (searchOk) {
      console.log('[STEP 11] ✓ 조회 명령 전달됨.');
    } else {
      await mainframe.locator('a:has-text("조회")').first().click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(4000);

    // ══════════════════════════════════════════════════════════════
    // STEP 12: 엑셀 다운로드
    // ══════════════════════════════════════════════════════════════
    console.log('[STEP 12] 엑셀 다운로드 시도...');
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);

    // 12-1. 저장/엑셀 버튼 클릭
    console.log('[STEP 12-1] "저장" 버튼 클릭 중...');
    await robustClick(mainframe, '#save_to_file');
    await robustClick(mainframe, 'a', '저장');
    await page.waitForTimeout(1500);

    // 12-2. 엑셀파일저장(출력용) 클릭
    console.log('[STEP 12-2] "엑셀파일저장" 클릭 중...');
    await robustClick(mainframe, 'span', '엑셀파일저장');
    await robustClick(mainframe, 'a', '엑셀');
    await page.waitForTimeout(1500);

    // 12-3. 최종 다운로드 버튼들 클릭
    console.log('[STEP 12-3] 다운로드 트리거 클릭 중...');
    await robustClick(mainframe, '#DownloadExcel');
    await page.waitForTimeout(1000);
    await robustClick(mainframe, '#DownloadButton');

    const download = await downloadPromise;
    if (download) {
      const suggestedFilename = download.suggestedFilename();
      const finalPath = path.resolve(downloadsPath, suggestedFilename);
      await download.saveAs(finalPath);
      console.log(`[STEP 12] 🏆 다운로드 완료: ${finalPath}`);
      console.log('\n🎉 IBK 외상매출채권 자동화 프로세스가 성공적으로 완료되었습니다!');
    } else {
      console.log('[STEP 12] ⚠️ 다운로드가 감지되지 않았습니다.');
    }

  } finally {
    await arduino.close();
    await context.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(console.error);
