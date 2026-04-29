import * as dotenv from 'dotenv';
import path from 'path';
import * as readline from 'readline';

// 1. Electron 모듈 모킹
const mockElectron = {
  ipcMain: { handle: () => {}, on: () => {}, send: () => {} },
  app: {
    getPath: (name: string) => {
      const home = process.env.USERPROFILE || process.env.HOME || '.';
      return path.join(home, name === 'userData' ? '.egdesk-standalone-data' : '.egdesk-standalone-temp');
    },
    getAppPath: () => process.cwd(),
  },
};
require.cache[require.resolve('electron')] = {
  id: require.resolve('electron'),
  exports: mockElectron,
  loaded: true,
} as any;

dotenv.config();

// 필요한 모듈들을 가져옵니다.
const { createIbkAutomator } = require('./src/main/financehub/banks/ibk');
const { isWindows, waitForNativeCertificateDialogWindow, getFocusedElementProperties, getMaskedInputVerification, getNativeButtonsInfo, focusCertElement } = require('./src/main/financehub/utils/windows-uia-native');
const { ArduinoHidBankSession } = require('./src/main/financehub/utils/arduino-hid-bank');
const { runNativeCertArduinoSteps, IBK_NATIVE_CERT_STEPS } = require('./src/main/financehub/utils/corporate-cert-native-steps');

function askPassword(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question('🔐 [IBK] 인증서 비밀번호를 입력해 주세요: ', (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function run() {
  let certPassword = process.argv[2] || process.env.IBK_CERT_PW || process.env.SHINHAN_CERT_PW;
  if (!certPassword) certPassword = await askPassword();

  const arduinoPort = process.env.ARDUINO_PORT || 'COM6';

  console.log('\n🚀 IBK 기업뱅킹 인증서 자동화 (Pruning) 시작 - 처음 5단계');
  console.log('------------------------------------------------------------');

  const automator = createIbkAutomator({ headless: false });

  try {
    // 1️⃣ [Action 1] OS 확인
    console.log('1️⃣ [Action 1] 실행 환경 확인 중...');
    if (!isWindows()) throw new Error('Windows 환경이 아닙니다.');
    console.log('✅ Windows 환경 확인 완료');

    // 2️⃣ [Action 2] 브라우저 실행
    console.log('2️⃣ [Action 2] IBK 전용 브라우저 프로필로 실행 중...');
    const corpDownloadsPath = path.join(automator.outputDir, 'corporate-cert-downloads');
    const { browser, context } = await automator.createBrowser(undefined, {
      useKbScriptPlaywrightProfile: true,
      extraChromeArgs: ['--start-maximized'],
      viewport: null,
      acceptDownloads: true,
      downloadsPath: corpDownloadsPath,
    });
    automator.browser = browser;
    automator.context = context;
    automator.page = context.pages()[0] || await context.newPage();
    console.log('✅ 브라우저 생성 완료');

    // 3️⃣ [Action 3] IBK 기업뱅킹 접속
    const entryUrl = automator.config.xpaths.entryUrl || 'https://kiup.ibk.co.kr/';
    console.log(`3️⃣ [Action 3] IBK 기업뱅킹 접속 중: ${entryUrl}`);
    await automator.page.goto(entryUrl, { waitUntil: 'domcontentloaded' });
    await automator.page.waitForTimeout(3000);
    console.log('✅ 페이지 접속 완료');

    // 4️⃣ [Action 4] 로그인 페이지 이동 (프레임 처리)
    console.log('4️⃣ [Action 4] 로그인 메뉴 클릭 중...');
    const frame = automator.page.frame({ name: 'mainframe' });
    if (!frame) throw new Error('mainframe을 찾을 수 없습니다.');
    
    try {
      await frame.locator('a:has-text("로그인")').first().click({ timeout: 10000 });
    } catch (e) {
      await automator.page.locator('a:has-text("로그인")').first().click({ timeout: 10000 });
    }
    await automator.page.waitForTimeout(2000);
    console.log('✅ 로그인 페이지 이동 완료');

    // 5️⃣ [Action 5] (구)공동인증서 버튼 클릭 (인증서 창 트리거)
    console.log('5️⃣ [Action 5] 공동인증서 버튼 클릭 중...');
    try {
      // IBK 특화 버튼 (.ec 클래스 또는 특정 텍스트)
      await frame.locator('.ec').first().click({ timeout: 10000 });
    } catch (e) {
      await frame.locator('text=(구 공인인증서)').first().click({ timeout: 10000 });
    }
    console.log('✅ 인증서 선택 창 트리거 완료');

    // 6️⃣ [Action 6] 네이티브 인증서 창 감지
    console.log('6️⃣ [Action 6] Windows 네이티브 인증서 창 감지 중...');
    const uia = await waitForNativeCertificateDialogWindow({
      timeoutMs: 30000,
      pollMs: 1000,
      onLog: (m: string) => console.log(`   [UIA] ${m}`),
    });
    if (!uia.ok) throw new Error('인증서 창을 찾지 못했습니다.');
    console.log(`✅ 인증서 창 감지 완료: ${uia.windowName}`);

    // 7️⃣ [Action 7] Arduino HID를 통한 비밀번호 입력 (안정성 강화 버전)
    console.log('7️⃣ [Action 7] Arduino HID를 통한 비밀번호 입력 중...');
    const arduinoHid = new ArduinoHidBankSession({
      portPath: arduinoPort,
      log: (m: string) => console.log(`   [Arduino] ${m}`),
    });
    
    // 타이밍 이슈 방지를 위한 보수적인 커스텀 스텝 정의
    const STABLE_IBK_STEPS_WITHOUT_ENTER = [
      { waitMs: 1500 }, // 1. 창 감지 후 안정화 대기
      { key: 'ENTER' }, // 2. 첫 번째 인증서 선택
      { waitMs: 3000 }, // 3. 인증서 선택 후 비밀번호 필드 활성화 대기
      { key: 'TAB', repeat: 4, interKeyMs: 500 }, // 4. 포커스 이동
      { type: 'password' }, // 5. 비밀번호 입력
      { waitMs: 1000 }, // 6. 입력 후 잠시 대기 (검증 전)
    ];

    try {
      await arduinoHid.connect();
      
      // 1. 비밀번호 입력 (직접 포커스)
      console.log('⌨️  비밀번호 입력 중 (UIA 직접 포커스)...');
      
      const focusResult = focusCertElement(uia.matchedClass, 'passwordFrame');
      if (!focusResult.ok) {
        throw new Error(`인증서 입력창 포커스 실패: ${focusResult.error}`);
      }
      
      console.log(`   ✅ passwordFrame에 직접 포커스 성공! (${focusResult.method})`);

      // TAB 단계를 완전히 제외하고 입력만 진행
      const inputSteps = [...IBK_NATIVE_CERT_STEPS].filter(s => s.key !== 'TAB' && s.key !== 'ENTER');

      await runNativeCertArduinoSteps(
        arduinoHid,
        automator.page,
        certPassword,
        inputSteps,
        { log: (m: string) => console.log(`   [HID Step] ${m}`) }
      );

      // 2. [검증] 입력된 비밀번호 상태 확인 (엔터 치기 전)
      console.log('🔍 [Action 7-Verify] 마스킹 문자 입력 상태 및 버튼 점검 중...');
      try {
        const verification = getMaskedInputVerification(uia.matchedClass);
        console.log(`   📊 [마스킹 결과] ${verification}`);

        const buttons = getNativeButtonsInfo(uia.matchedClass);
        console.log(`   🛡️ [버튼 안전 점검] ${buttons}`);
      } catch (e) {}

      // 3. 마지막 엔터 입력
      console.log('⌨️  최종 엔터 입력 중...');
      await runNativeCertArduinoSteps(
        arduinoHid,
        automator.page,
        certPassword,
        [{ key: 'ENTER' }],
        { log: (m: string) => console.log(`   [HID Step] ${m}`) }
      );

      await arduinoHid.disconnect();
      console.log('✅ 비밀번호 입력 및 로그인 시도 완료');
    } catch (e: any) {
      console.error(`⚠️ Arduino 입력 실패 (포트 확인 필요): ${e.message}`);
      console.log('   (수동 입력을 기다리거나 포트 설정을 확인해 주세요...)');
      await automator.page.waitForTimeout(5000);
    }

    // 8️⃣ [Action 8] 로그인 완료 및 대시보드 진입 대기
    console.log('8️⃣ [Action 8] 로그인 완료 및 페이지 전환 대기 중...');
    await automator.page.waitForTimeout(5000);
    
    // 팝업 정리
    let currentFrame = automator.page.frame({ name: 'mainframe' });
    if (currentFrame) {
      console.log('   - 로그인 후 초기 팝업 정리 중...');
      await automator._cleanupIbkPopups();
    }

    // 9️⃣ [Action 9] 거래 내역 조회 페이지 이동
    console.log('9️⃣ [Action 9] 거래 내역 조회 페이지로 이동 중...');
    currentFrame = automator.page.frame({ name: 'mainframe' });
    if (currentFrame) {
      await currentFrame.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const target = links.find(a => a.textContent?.trim() === '거래내역조회');
        if (target) target.click();
      });
      await automator.page.waitForTimeout(5000);
    }
    console.log('✅ 거래 내역 조회 페이지 진입 시도 완료');

    // 🔟 [Action 10] 계좌 목록 추출
    console.log('🔟 [Action 10] 계좌 목록 추출 중...');
    const accounts = await automator._getIbKAccounts();
    if (!accounts || accounts.length === 0) {
      console.log('⚠️ 계좌를 찾지 못했습니다. 스크립트를 종료합니다.');
      return;
    }
    console.log(`✅ ${accounts.length}개의 계좌 발견.`);

    // 1️⃣1️⃣ [Action 11-15] 계좌별 거래 내역 조회 및 다운로드 루프
    console.log('------------------------------------------------------------');
    console.log('🚀 [Action 11-15] 계좌별 거래 내역 조회 및 다운로드를 시작합니다.');
    
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    
    const formatDate = (date: Date) => date.toISOString().split('T')[0].replace(/-/g, '');
    const startDate = formatDate(sevenDaysAgo);
    const endDate = formatDate(yesterday);
    
    console.log(`📅 조회 기간: ${startDate} ~ ${endDate}`);

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      console.log(`\n👉 [${i + 1}/${accounts.length}] 계좌 처리 중: ${account.accountNumber} (${account.accountName})`);
      
      try {
        const result = await automator.getTransactions(account.accountNumber, startDate, endDate);
        
        if (result && result.length > 0) {
          const item = result[0];
          console.log(`   ✅ 엑셀 다운로드 성공!`);
          console.log(`      📁 파일명: ${item.filename}`);
          console.log(`      📊 거래 건수: ${item.extractedData.summary.totalCount}건`);
        } else {
          console.log(`   ⚠️ 엑셀 다운로드 결과: 저장할 데이터가 없습니다. (다음 계좌로 이동)`);
        }
      } catch (err: any) {
        console.error(`   ❌ 계좌 처리 중 오류 발생: ${err.message}`);
      }
      
      await automator.page.waitForTimeout(2000);
    }

    console.log('\n------------------------------------------------------------');
    console.log('🎊 모든 계좌에 대한 자동화 프로세스가 완료되었습니다!');
    console.log('추출된 파일들을 확인해 주세요. 5초 후 브라우저를 닫습니다.');
    await automator.page.waitForTimeout(5000);

  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message || error);
  } finally {
    if (automator.browser) await automator.browser.close();
    console.log('🏁 스크립트 종료');
  }
}

run();
