/**
 * 수집 엔진(Automators)의 계좌번호 파싱 및 정규식 수정 본에 대한 무의존성 검증 테스트 스크립트
 */
const assert = require('assert');

// 1. 우리은행 정규식 검증
function testWooriRegex() {
  console.log('--- 우리은행 정규식 검증 시작 ---');
  // 수정한 정규식
  const re = /(\d{3,4}-\d{2,6}-\d{3,7})/;

  // 테스트 케이스 목록
  const cases = [
    { input: '우리 기업 계좌 1005-803-257683 (주계좌)', expected: '1005-803-257683' }, // 13자리 4-3-6 구조 (기존엔 앞자리 1이 짤렸음)
    { input: '우리 일반 040-327921-220 예금', expected: '040-327921-220' },          // 12자리 3-6-3 구조 (기존엔 누락되었음)
    { input: '123-45-67890', expected: '123-45-67890' },
    { input: '계좌번호 없음', expected: null }
  ];

  for (const tc of cases) {
    const m = tc.input.match(re);
    const result = m ? m[1] : null;
    console.log(`입력: [${tc.input}] ➔ 결과: [${result}]`);
    assert.strictEqual(result, tc.expected, `우리은행 검증 실패: 입력 [${tc.input}]`);
  }
  console.log('✅ 우리은행 정규식 검증 통과!\n');
}

// 2. 하나은행 파싱 로직 검증 (수정된 HanaBankAutomator._parseAccountNumberFromOptionText 로직 추출)
function testHanaParsing() {
  console.log('--- 하나은행 파싱 로직 검증 시작 ---');
  
  const parseHanaAccount = (text) => {
    const t = (text || '').trim();
    const dashed = t.match(/(\d{3,4})-(\d{2,6})-(\d{3,7})/);
    if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
    const digits = t.replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 16) {
      if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
      if (digits.length === 14) return `${digits.slice(0, 3)}-${digits.slice(3, 9)}-${digits.slice(9)}`;
      return digits;
    }
    return null;
  };

  const cases = [
    { input: '하나 기업 243-890022-37204', expected: '243-890022-37204' }, // 대시 포함 14자리
    { input: ' 24389002237204 ', expected: '243-890022-37204' },          // 대시 없는 14자리 (3-6-5 자동 변환)
    { input: '하나 123-45678-90123', expected: '123-45678-90123' },       // 대시 포함 타 포맷
    { input: '1234567890123', expected: '123456-78-90123' },              // 대시 없는 13자리 (6-2-5 기존 유지)
    { input: '짧은숫자 123456', expected: null }
  ];

  for (const tc of cases) {
    const result = parseHanaAccount(tc.input);
    console.log(`입력: [${tc.input}] ➔ 결과: [${result}]`);
    assert.strictEqual(result, tc.expected, `하나은행 검증 실패: 입력 [${tc.input}]`);
  }
  console.log('✅ 하나은행 파싱 로직 검증 통과!\n');
}

// 3. 기업은행 파싱 로직 검증 (수정된 IbkBankAutomator._parseIbkAccountFromOption 로직 추출)
function testIbkParsing() {
  console.log('--- 기업은행 파싱 로직 검증 시작 ---');
  
  const parseIbkAccount = (text, value) => {
    const t = (text || '').trim();
    const match = t.match(/([\d-]{10,22})/);
    if (match) {
      const parsed = match[1];
      if (parsed.includes('-')) return parsed;
      const digits = parsed.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 16) {
        if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
        if (digits.length === 14) return `${digits.slice(0, 3)}-${digits.slice(3, 9)}-${digits.slice(9, 11)}-${digits.slice(11)}`;
        return digits;
      }
    }
    const v = String(value || '').replace(/\D/g, '');
    if (v.length >= 10 && v.length <= 16) {
      if (v.length === 13) return `${v.slice(0, 6)}-${v.slice(6, 8)}-${v.slice(8)}`;
      if (v.length === 14) return `${v.slice(0, 3)}-${v.slice(3, 9)}-${v.slice(9, 11)}-${v.slice(11)}`;
      return v;
    }
    return null;
  };

  const cases = [
    { text: '기업 306-063568-01-061', value: '', expected: '306-063568-01-061' }, // 대시 3개 포함 14자리 (기존엔 매칭 안되었음)
    { text: ' 30606356801061 ', value: '', expected: '306-063568-01-061' },       // 대시 없는 14자리 (3-6-2-3 자동 변환)
    { text: '기업 일반', value: '30606356801061', expected: '306-063568-01-061' }, // Value 기준 14자리 대시 자동 부여
    { text: '1234567890123', value: '', expected: '123456-78-90123' },            // 대시 없는 13자리 (6-2-5 기존 유지)
    { text: '잘못된 텍스트', value: '123', expected: null }
  ];

  console.log('>> IbkBankAutomator 파싱 로직 검사');
  for (const tc of cases) {
    const result = parseIbkAccount(tc.text, tc.value);
    console.log(`입력(text: [${tc.text}], value: [${tc.value}]) ➔ 결과: [${result}]`);
    assert.strictEqual(result, tc.expected, `기업은행 검증 실패`);
  }

  console.log('✅ 기업은행 파싱 로직 검증 통과!\n');
}

// 전체 테스트 실행
try {
  testWooriRegex();
  testHanaParsing();
  testIbkParsing();
  testKookminRegex();
  console.log('==================================================');
  console.log('🎉 모든 은행 Automator 계좌번호 파싱 검증 테스트를 성공적으로 통과했습니다!');
  console.log('==================================================');
} catch (err) {
  console.error('❌ 검증 테스트 중 오류 발생:');
  console.error(err);
  process.exit(1);
}

// 4. 국민은행 정규식 검증
function testKookminRegex() {
  console.log('--- 국민은행 정규식 검증 시작 ---');
  const re = /(\d{3,6}-\d{2,6}-\d{3,7})/;

  const cases = [
    { input: 'KB 기업 669116-01-573291 (기본)', expected: '669116-01-573291' },  // 14자리 6-2-6 구조 (사용자 제보, 기존엔 짤렸음)
    { input: 'KB 일반 601-04-165951 예금', expected: '601-04-165951' },        // 11자리 3-2-6 구조 (기존 유지)
    { input: '123-45-67890', expected: '123-45-67890' },
    { input: '계좌번호 없음', expected: null }
  ];

  for (const tc of cases) {
    const m = tc.input.match(re);
    const result = m ? m[1] : null;
    console.log(`입력: [${tc.input}] ➔ 결과: [${result}]`);
    assert.strictEqual(result, tc.expected, `국민은행 검증 실패: 입력 [${tc.input}]`);
  }
  console.log('✅ 국민은행 정규식 검증 통과!\n');
}
