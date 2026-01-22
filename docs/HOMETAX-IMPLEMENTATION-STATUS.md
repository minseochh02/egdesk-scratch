# 홈택스 연동 구현 현황 (Hometax Integration Status)

## ✅ 완료된 항목 (Completed)

### 1. Frontend UI (FinanceHub.tsx)
- ✅ 세금 관리 탭 추가
- ✅ 연결된 사업자 섹션 (Empty State + 카드 레이아웃)
- ✅ 홈택스 연결 모달 구현
  - 사업자등록번호 입력
  - 공동인증서 비밀번호 입력
  - 인증서 비밀번호 저장 옵션
  - 보안 안내 메시지
- ✅ 전자세금계산서 목록 섹션
  - 매출/매입 탭
  - 사업자 필터 (댓글로 준비됨)
  - Empty State
- ✅ 추가 기능 섹션 (현금영수증, 납부/환급, 부가세, 연말정산)
- ✅ State management 구조

### 2. Backend Infrastructure (storage.ts)
- ✅ IPC 핸들러 등록:
  - `hometax:connect` - 브라우저 자동화 시작
  - `hometax:disconnect` - 연결 해제
  - `hometax:get-connection-status` - 상태 조회
  - `hometax:save-credentials` - 인증 정보 암호화 저장
  - `hometax:get-credentials` - 저장된 인증 정보 조회
  - `hometax:remove-credentials` - 인증 정보 삭제
  - `hometax:get-connected-businesses` - 연결된 사업자 목록

### 3. Playwright Automation (hometax-automation.ts)
- ✅ Browser launch configuration:
  - Downloads 폴더: `~/Downloads/EGDesk-Hometax`
  - Persistent context with temporary profile
  - Chrome channel with specific args
  - Dialog auto-accept
- ✅ Hometax 페이지 탐색
- ✅ 공동인증서 로그인 팝업 처리
- ✅ 페이지 스택 관리 (탭 전환)

### 4. Preload API (preload.ts)
- ✅ `window.electron.hometax` API 노출
- ✅ TypeScript 타입 정의

### 5. Design Documentation
- ✅ `HOMETAX-INTEGRATION-DESIGN.md` - 전체 설계 문서
- ✅ `HOMETAX-IMPLEMENTATION-STATUS.md` - 구현 현황 (이 파일)

---

## 🚧 구현 필요 항목 (To Be Implemented)

### 1. Playwright Automation 완성
**위치**: `src/main/hometax-automation.ts`

현재 구현된 부분:
```typescript
✅ 브라우저 시작
✅ 홈택스 메인 페이지 접속
✅ 공동인증서 로그인 팝업 열기
✅ 팝업 탭 전환 처리
```

구현 필요:
```typescript
❌ 공동인증서 선택 (사업자등록번호 기반)
❌ 인증서 비밀번호 입력
❌ 로그인 제출
❌ 로그인 성공 확인
❌ 사업자 정보 자동 추출 (상호명, 대표자명 등)
❌ 에러 처리 (잘못된 비밀번호, 인증서 없음 등)
```

**참고할 코드**:
- `src/main/chrome-handlers.ts` - 기존 Playwright 패턴
- 은행 자동화 로직 참고

### 2. 연결된 사업자 목록 관리
**위치**: `src/renderer/components/FinanceHub/FinanceHub.tsx`

구현 필요:
```typescript
❌ loadConnectedBusinesses() 함수 구현
❌ 사업자 카드 렌더링 (현재 주석 처리됨)
❌ 사업자별 "지금 수집" 버튼 핸들러
❌ 사업자 "연결 해제" 핸들러
❌ 사업자 목록 새로고침 로직
```

### 3. 데이터베이스 스키마
**위치**: `src/main/sqlite/` (새 마이그레이션 필요)

구현 필요:
```sql
❌ hometax_connections 테이블 생성
❌ tax_invoices 테이블 생성
❌ hometax_sync_operations 테이블 생성
❌ hometax_schedules 테이블 생성
```

### 4. 전자세금계산서 수집
**위치**: `src/main/hometax-automation.ts`

구현 필요:
```typescript
❌ collectTaxInvoices(businessNumber, startDate, endDate)
❌ 매출 계산서 조회 페이지 이동
❌ 매입 계산서 조회 페이지 이동
❌ 엑셀 다운로드 자동화
❌ 엑셀 파일 파싱 (xlsx 라이브러리)
❌ 데이터베이스 저장
```

### 5. 세금계산서 목록 UI
**위치**: `src/renderer/components/FinanceHub/`

구현 필요:
```typescript
❌ TaxInvoiceTable 컴포넌트 생성
❌ 매출/매입 탭 전환 기능
❌ 사업자 필터 드롭다운
❌ 테이블 렌더링 (날짜, 거래처, 금액, 상태 등)
❌ 상세보기 모달
❌ 엑셀 내보내기 기능
```

### 6. 자동 수집 스케줄러
**위치**: `src/main/financehub/scheduler/`

구현 필요:
```typescript
❌ Hometax 스케줄 작업 추가
❌ 사업자별 개별 스케줄 설정
❌ 매일 자동 수집 로직
❌ 스케줄러 UI 통합
```

---

## 🔧 현재 동작 방식 (Current Behavior)

### 사용자 플로우
1. **세금 관리 탭 클릭** → 홈택스 연동 UI 표시
2. **사업자 추가하기 클릭** → 모달 열림
3. **사업자등록번호 + 공동인증서 비밀번호 입력**
4. **홈택스 연결하기 클릭** →
   - ✅ 브라우저가 시작됨 (Playwright)
   - ✅ Hometax.go.kr 접속
   - ✅ 공동인증서 로그인 팝업 열림
   - ⚠️ **이후 수동 작업 필요** (인증서 선택, 비밀번호 입력)
   - ⚠️ 성공 시 placeholder 데이터 반환

### 백엔드 호출 흐름
```
Frontend (FinanceHub.tsx)
  ↓ handleConnectHometax()
  ↓ window.electron.hometax.connect()
  ↓
Preload (preload.ts)
  ↓ ipcRenderer.invoke('hometax:connect')
  ↓
Main Process (storage.ts)
  ↓ ipcMain.handle('hometax:connect')
  ↓ connectToHometax()
  ↓
Automation (hometax-automation.ts)
  ↓ Playwright browser launch
  ↓ Navigate to Hometax
  ↓ Open certificate login popup
  ✅ Return placeholder result
```

---

## 📝 다음 구현 우선순위 (Next Steps Priority)

### Priority 1: 로그인 자동화 완성
1. 공동인증서 선택 자동화
2. 비밀번호 입력 자동화
3. 로그인 성공 확인
4. 사업자 정보 실제 추출

### Priority 2: 데이터베이스 구조
1. 마이그레이션 파일 생성
2. 테이블 스키마 적용
3. CRUD 작업 IPC 핸들러

### Priority 3: 세금계산서 수집
1. 매출/매입 조회 페이지 자동화
2. 엑셀 다운로드
3. 파싱 및 DB 저장

### Priority 4: UI 완성
1. 연결된 사업자 카드 렌더링
2. 세금계산서 테이블
3. 필터 및 검색

---

## 🎯 테스트 방법 (Testing)

### 현재 테스트 가능한 항목
1. ✅ 모달 열기/닫기
2. ✅ 폼 입력 검증
3. ✅ 브라우저 시작 (수동 로그인 후 확인)

### 테스트 필요 항목
1. ❌ 실제 공동인증서로 자동 로그인
2. ❌ 사업자 정보 추출
3. ❌ 다중 사업자 관리
4. ❌ 세금계산서 수집
5. ❌ 스케줄러 동작

---

## 📚 관련 파일 (Related Files)

### Frontend
- `src/renderer/components/FinanceHub/FinanceHub.tsx` - Main UI
- `src/renderer/components/FinanceHub/FinanceHub.css` - Styles

### Backend
- `src/main/hometax-automation.ts` - Playwright automation
- `src/main/storage.ts` - IPC handlers
- `src/main/preload.ts` - API exposure

### Documentation
- `HOMETAX-INTEGRATION-DESIGN.md` - Complete design spec
- `HOMETAX-IMPLEMENTATION-STATUS.md` - This file

---

## 💡 구현 참고사항 (Implementation Notes)

### 공동인증서 처리
- 인증서 위치:
  - Windows: `C:\Program Files\NPKI`
  - macOS: `~/Library/Preferences/NPKI`
- 인증서 파일 구조: `{발급기관}/{사용자ID}/signCert.der` + `signPri.key`
- Playwright로 파일 선택 다이얼로그 처리 필요

### 보안 고려사항
- ✅ 인증서 비밀번호는 electron-store의 encryptionKey로 암호화
- ✅ 사업자등록번호를 키로 사용하여 다중 사업자 지원
- ⚠️ 브라우저 세션 관리 (타임아웃, 재인증)

### 에러 처리
- 인증서 없음
- 잘못된 비밀번호
- 네트워크 오류
- 홈택스 서버 점검
- 세션 만료

---

## 🚀 Ready to Test!

현재 구현으로 브라우저를 시작하고 홈택스 로그인 팝업까지 열 수 있습니다.

**테스트 방법**:
1. 앱 실행
2. Finance Hub → 세금 관리 탭
3. "사업자 추가하기" 클릭
4. 사업자등록번호 입력 (예: 123-45-67890)
5. 공동인증서 비밀번호 입력
6. "홈택스 연결하기" 클릭
7. ✅ Chrome 브라우저가 자동으로 열림
8. ✅ 홈택스 페이지 로드
9. ✅ 공동인증서 로그인 팝업 표시
10. ⚠️ 이후 수동으로 인증서 선택 및 로그인 필요

다음 단계는 인증서 선택과 비밀번호 입력을 자동화하는 것입니다!
