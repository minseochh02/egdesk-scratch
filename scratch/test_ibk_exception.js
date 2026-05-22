const { IbkBankAutomator } = require('../src/main/financehub/banks/ibk/IbkBankAutomator');

async function testException() {
  const automator = new IbkBankAutomator({ headless: true });
  
  // Page가 없을 때 getTransactionsWithParsing이 에러를 잡아 success: false를 반환하는지 검증
  console.log('Test 1: Page가 없는 상태에서 호출');
  try {
    const result = await automator.getTransactionsWithParsing('123-45678-90-123', '2026-01-01', '2026-05-22');
    console.log('Result:', result);
    if (result.success === false && result.error.includes('Browser page not initialized')) {
      console.log('✅ Test 1 Passed: 에러를 정상적으로 캐치하여 success: false를 반환함.');
    } else {
      console.log('❌ Test 1 Failed:', result);
    }
  } catch (e) {
    console.log('❌ Test 1 Exception leaked:', e);
  }

  // Page가 존재하지만 mainframe이 없는 경우 모킹
  console.log('\nTest 2: Page는 존재하지만 mainframe이 없는 상태 모킹');
  const mockPage = {
    frame: () => null,
  };
  automator.page = mockPage;
  automator._mainFrame = () => null;

  try {
    const result = await automator.getTransactionsWithParsing('123-45678-90-123', '2026-01-01', '2026-05-22');
    console.log('Result:', result);
    if (result.success === false && result.error.includes('mainframe을 찾을 수 없습니다')) {
      console.log('✅ Test 2 Passed: mainframe 미발견 에러를 정상적으로 캐치함.');
    } else {
      console.log('❌ Test 2 Failed:', result);
    }
  } catch (e) {
    console.log('❌ Test 2 Exception leaked:', e);
  }
}

testException().catch(console.error);
