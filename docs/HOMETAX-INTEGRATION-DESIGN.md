# 전자세금계산서 수집 기능 설계 (Hometax Integration Design)

## 개요 (Overview)

홈택스(Hometax)에서 전자세금계산서를 자동으로 수집하는 기능의 UI 및 데이터 처리 구조 설계

## UI 구조 (UI Structure)

### 1. 연결된 사업자 섹션 (Connected Businesses Section)
**위치**: 세금 관리 탭 상단

**구성 요소**:
- **사업자 추가 버튼**: "사업자 추가하기" - 모달을 열어 홈택스 인증 정보 입력
- **사업자 카드** (각 연결된 사업자마다 하나씩):
  - **헤더**:
    - 🏢 사업자 아이콘
    - 사업자명 (예: "테스트 주식회사")
    - 사업자등록번호 (예: "123-45-67890")
    - 연결 상태 뱃지 (연결됨/연결 끊김/오류)
  - **통계 섹션**:
    - 📤 매출 계산서 개수
    - 📥 매입 계산서 개수
  - **푸터**:
    - 마지막 수집 시간
    - 액션 버튼: "지금 수집", "연결 해제"

**특징**:
- 한 사용자가 여러 사업자를 관리 가능
- 각 사업자는 독립적으로 연결/수집/관리됨
- 은행 연결 카드와 유사한 UI 패턴

### 2. 전자세금계산서 목록 섹션 (Tax Invoice List Section)
**기능**:
- **매입/매출 탭**: 두 가지 유형의 계산서를 구분하여 표시
  - 📤 **매출** (Sales/Outbound): 발행한 세금계산서
  - 📥 **매입** (Purchase/Inbound): 받은 세금계산서
- 수집된 세금계산서 테이블 (현재는 empty state)
- 액션 버튼:
  - ⏰ 자동 수집 설정 (스케줄러)
  - 🔄 지금 수집 (수동 트리거 - 매입/매출 모두)
  - 📊 엑셀로 내보내기 (선택된 유형만)

### 3. 수집 설정 섹션 (Collection Settings)
**설정 항목**:
- **수집 기간**: 최근 3개월, 6개월, 1년 등
- **자동 수집 시간**: 매일 오전 9시 (기본값)
- **데이터 저장 방식**: 엑셀 파일 + 데이터베이스

---

## 데이터 흐름 (Data Flow)

### 1. 연결 흐름 (Connection Flow)
```
사용자 -> "사업자 추가하기" 클릭
       -> 모달 열림 (인증 정보 입력)
       -> 인증 정보:
          - 사업자등록번호 (Business Registration Number)
          - 공동인증서 비밀번호
       -> 인증 정보 저장 (암호화, 사업자등록번호를 키로 사용)
       -> 홈택스 로그인 시도 (공동인증서 사용)
       -> 로그인 성공 시 사업자 정보 자동 조회 (상호명, 대표자명 등)
       -> 성공 시 연결된 사업자 목록에 추가

**다중 사업자 지원**:
- 한 사용자가 여러 사업자등록번호를 추가 가능
- 각 사업자는 독립적으로 관리됨
- 사업자별로 별도의 인증 정보 및 수집 이력 유지
```

### 2. 수집 흐름 (Collection Flow)
```
자동 스케줄러 (매일 9시)
       -> 홈택스 로그인
       -> 매출 전자세금계산서 목록 조회
          -> 엑셀 파일 다운로드
          -> 엑셀 파싱
          -> 데이터베이스 저장 (invoice_type='sales')
       -> 매입 전자세금계산서 목록 조회
          -> 엑셀 파일 다운로드
          -> 엑셀 파싱
          -> 데이터베이스 저장 (invoice_type='purchase')
       -> 원본 엑셀 파일 보관
       -> 수집 로그 기록 (매입/매출 건수 각각)
```

### 3. 수동 수집 (Manual Collection)
```
사용자 -> "지금 수집" 클릭
       -> 수집 기간 선택 (선택사항)
       -> 즉시 수집 프로세스 시작
       -> 진행 상태 표시 (모달 또는 인라인)
       -> 완료 후 목록 새로고침
```

---

## 백엔드 요구사항 (Backend Requirements)

### 1. IPC 핸들러 (IPC Handlers)
```typescript
// Hometax 연결 (다중 사업자 지원)
'hometax:connect'                        // (businessNumber, credentials)
'hometax:disconnect'                     // (businessNumber)
'hometax:get-connected-businesses'       // () -> ConnectedBusiness[]
'hometax:test-connection'                // (businessNumber)

// 인증 정보 관리 (사업자등록번호를 키로 사용)
'hometax:save-credentials'               // (businessNumber, credentials)
'hometax:get-credentials'                // (businessNumber)
'hometax:remove-credentials'             // (businessNumber)

// 전자세금계산서 수집
'hometax:collect-invoices'               // (businessNumber, period) -> 매출+매입 모두
'hometax:get-invoices'                   // ({ type, businessNumber }) -> 필터링된 목록
'hometax:get-collection-history'         // (businessNumber?) -> 특정 또는 전체 사업자

// 스케줄러 (사업자별 설정 가능)
'hometax:set-schedule'                   // (businessNumber, scheduleConfig)
'hometax:get-schedule'                   // (businessNumber)
'hometax:disable-schedule'               // (businessNumber)
```

### 2. 자동화 프로세스 (Automation Process)

**Playwright 기반 자동화**:
```typescript
1. 홈택스 로그인 (https://www.hometax.go.kr)
   - 공동인증서 또는 간편인증 사용
   - 세션 유지

2. 전자세금계산서 메뉴 접근
   - 조회/발급 > 전자세금계산서 > 매출 목록

3. 조회 기간 설정 (매출)
   - 시작일/종료일 입력

4. 엑셀 다운로드 (매출)
   - "엑셀로 받기" 버튼 클릭
   - 다운로드 경로 지정: {business_number}/sales_YYYY-MM-DD.xlsx

5. 매입 목록 조회
   - 조회/발급 > 전자세금계산서 > 매입 목록
   - 동일한 조회 기간 설정

6. 엑셀 다운로드 (매입)
   - "엑셀로 받기" 버튼 클릭
   - 다운로드 경로 지정: {business_number}/purchase_YYYY-MM-DD.xlsx

7. 파일 파싱
   - 매출/매입 엑셀 파일 각각 읽기 (xlsx 라이브러리)
   - 데이터 추출 및 정규화
   - invoice_type 필드로 구분하여 저장
```

---

## 데이터베이스 스키마 (Database Schema)

### 1. 홈택스 연결 정보
```sql
CREATE TABLE hometax_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_number TEXT NOT NULL UNIQUE,  -- 사업자등록번호
  business_name TEXT,                    -- 사업자명/상호 (자동 수집)
  representative_name TEXT,              -- 대표자명 (자동 수집)
  business_type TEXT,                    -- 사업자 유형 (자동 수집)
  connection_status TEXT DEFAULT 'disconnected', -- connected/disconnected/error
  last_connected_at DATETIME,
  sales_count INTEGER DEFAULT 0,         -- 매출 계산서 수 (캐시)
  purchase_count INTEGER DEFAULT 0,      -- 매입 계산서 수 (캐시)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. 전자세금계산서
```sql
CREATE TABLE tax_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_number TEXT NOT NULL,         -- 사업자등록번호
  invoice_number TEXT NOT NULL,          -- 승인번호
  invoice_type TEXT NOT NULL,            -- 매출/매입
  issue_date DATE NOT NULL,              -- 작성일자
  send_date DATETIME,                    -- 전송일시
  supplier_business_number TEXT,         -- 공급자 사업자번호
  supplier_name TEXT,                    -- 공급자 상호
  buyer_business_number TEXT,            -- 공급받는자 사업자번호
  buyer_name TEXT,                       -- 공급받는자 상호
  supply_value INTEGER,                  -- 공급가액
  tax_amount INTEGER,                    -- 세액
  total_amount INTEGER,                  -- 합계금액
  item_name TEXT,                        -- 품목명
  invoice_status TEXT,                   -- 발급상태 (전송완료/발급취소 등)
  remarks TEXT,                          -- 비고
  excel_file_path TEXT,                  -- 원본 엑셀 파일 경로
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(invoice_number, business_number)
);

CREATE INDEX idx_tax_invoices_date ON tax_invoices(issue_date);
CREATE INDEX idx_tax_invoices_type ON tax_invoices(invoice_type);
CREATE INDEX idx_tax_invoices_business ON tax_invoices(business_number);
```

### 3. 수집 이력
```sql
CREATE TABLE hometax_sync_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_number TEXT NOT NULL,
  status TEXT NOT NULL,                  -- running/completed/failed
  start_date DATE NOT NULL,              -- 조회 시작일
  end_date DATE NOT NULL,                -- 조회 종료일
  sales_count INTEGER DEFAULT 0,         -- 매출 계산서 수
  sales_new INTEGER DEFAULT 0,           -- 매출 새로 추가
  sales_duplicate INTEGER DEFAULT 0,     -- 매출 중복
  purchase_count INTEGER DEFAULT 0,      -- 매입 계산서 수
  purchase_new INTEGER DEFAULT 0,        -- 매입 새로 추가
  purchase_duplicate INTEGER DEFAULT 0,  -- 매입 중복
  sales_excel_path TEXT,                 -- 매출 엑셀 파일
  purchase_excel_path TEXT,              -- 매입 엑셀 파일
  error_message TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  duration INTEGER                       -- 소요 시간 (초)
);
```

### 4. 스케줄 설정
```sql
CREATE TABLE hometax_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_number TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT 1,
  schedule_time TEXT DEFAULT '09:00',    -- HH:MM 형식
  collection_period INTEGER DEFAULT 90,  -- 수집 기간 (일)
  last_run_at DATETIME,
  next_run_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 파일 저장 구조 (File Storage Structure)

```
userData/
├── hometax/
│   ├── excel/                          # 다운로드된 엑셀 파일
│   │   ├── {business_number}/
│   │   │   ├── sales/                 # 매출 계산서
│   │   │   │   ├── 2024-01-15.xlsx
│   │   │   │   ├── 2024-02-15.xlsx
│   │   │   │   └── ...
│   │   │   └── purchase/              # 매입 계산서
│   │   │       ├── 2024-01-15.xlsx
│   │   │       ├── 2024-02-15.xlsx
│   │   │       └── ...
│   └── logs/                           # 수집 로그
│       └── sync_2024-01-15.log
```

---

## UI 상태 관리 (State Management)

### Local State (FinanceHub.tsx)
```typescript
// Multi-business support - array of connected businesses
const [connectedBusinesses, setConnectedBusinesses] = useState<ConnectedBusiness[]>([]);

interface ConnectedBusiness {
  businessNumber: string;           // 사업자등록번호
  businessName: string;              // 사업자명/상호 (로그인 후 자동 수집)
  representativeName?: string;       // 대표자명 (로그인 후 자동 수집)
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: Date;
  salesCount?: number;               // 매출 계산서 수
  purchaseCount?: number;            // 매입 계산서 수
}

// Invoice viewing state
const [taxInvoiceType, setTaxInvoiceType] = useState<'sales' | 'purchase'>('sales');
const [selectedBusiness, setSelectedBusiness] = useState<string | 'all'>('all'); // 사업자 필터
const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>([]);
const [syncHistory, setSyncHistory] = useState<SyncOperation[]>([]);
const [isCollecting, setIsCollecting] = useState<string | null>(null); // businessNumber being synced

// Modal state
const [showHometaxModal, setShowHometaxModal] = useState(false);
const [hometaxCredentials, setHometaxCredentials] = useState({
  businessNumber: '',
  certificatePassword: ''
});
const [isConnectingHometax, setIsConnectingHometax] = useState(false);
const [saveHometaxCredentials, setSaveHometaxCredentials] = useState(true);
```

### API Calls
```typescript
// 사업자 연결 (로그인 후 정보 자동 수집)
const handleConnectHometax = async () => {
  setIsConnectingHometax(true);
  try {
    const result = await window.electron.hometax.connect(
      hometaxCredentials.businessNumber,
      { certificatePassword: hometaxCredentials.certificatePassword }
    );

    if (result.success) {
      // result.businessInfo contains auto-fetched data:
      // { businessName, representativeName, businessType, etc. }
      const newBusiness: ConnectedBusiness = {
        businessNumber: hometaxCredentials.businessNumber,
        businessName: result.businessInfo.businessName,
        representativeName: result.businessInfo.representativeName,
        status: 'connected',
        lastSync: new Date(),
        salesCount: 0,
        purchaseCount: 0
      };

      setConnectedBusinesses(prev => [...prev, newBusiness]);
      handleCloseHometaxModal();
    }
  } finally {
    setIsConnectingHometax(false);
  }
};

// 연결된 사업자 목록 로드
const loadConnectedBusinesses = async () => {
  const result = await window.electron.hometax.getConnectedBusinesses();
  if (result.success) {
    setConnectedBusinesses(result.data);
  }
};

// 특정 사업자의 세금계산서 수집
const collectInvoices = async (
  businessNumber: string,
  period?: { startDate: string; endDate: string }
) => {
  setIsCollecting(businessNumber);
  try {
    // 매출 및 매입 모두 수집
    const result = await window.electron.hometax.collectInvoices(businessNumber, period);
    if (result.success) {
      await loadConnectedBusinesses(); // 카운트 업데이트
      await loadTaxInvoices();
      await loadSyncHistory();
      alert(`✅ 수집 완료!\n매출: ${result.data.salesNew}건\n매입: ${result.data.purchaseNew}건`);
    }
  } finally {
    setIsCollecting(null);
  }
};

// 세금계산서 목록 로드 (유형 및 사업자별 필터링)
const loadTaxInvoices = async (
  type: 'sales' | 'purchase' = taxInvoiceType,
  businessNumber?: string
) => {
  const result = await window.electron.hometax.getInvoices({
    type,
    businessNumber: businessNumber === 'all' ? undefined : businessNumber
  });
  if (result.success) {
    setTaxInvoices(result.data);
  }
};

// 탭 전환 핸들러
const handleTabChange = (type: 'sales' | 'purchase') => {
  setTaxInvoiceType(type);
  loadTaxInvoices(type, selectedBusiness);
};

// 사업자 선택 핸들러
const handleBusinessChange = (businessNumber: string) => {
  setSelectedBusiness(businessNumber);
  loadTaxInvoices(taxInvoiceType, businessNumber);
};
```

---

## 연동 패턴 (Integration Pattern)

이 기능은 기존의 **은행/카드 연동 패턴**과 유사하게 구현됩니다:

### 유사점
1. **연결 관리**: 인증 정보 저장/암호화
2. **자동 수집**: 스케줄러 기반 자동화
3. **데이터 저장**: 원본 파일 + 데이터베이스 이중 저장
4. **동기화 이력**: 수집 작업 로그 관리

### 차이점
1. **인증 방식**: 공동인증서 사용 가능
2. **데이터 소스**: 엑셀 파일 (은행은 DOM 파싱)
3. **수집 주기**: 일 단위 (은행은 수동/스케줄)
4. **데이터 구조**: 세금계산서 고유 필드

---

## 다음 단계 (Next Steps)

1. **홈택스 연결 모달 구현**
   - 인증 정보 입력 폼
   - 연결 테스트 기능
   - 암호화된 저장

2. **Playwright 자동화 스크립트**
   - 홈택스 로그인 자동화
   - 전자세금계산서 조회
   - 엑셀 다운로드

3. **엑셀 파싱 로직**
   - xlsx 라이브러리 사용
   - 데이터 정규화
   - 데이터베이스 저장

4. **세금계산서 목록 테이블**
   - 필터링 (매출/매입, 기간)
   - 정렬
   - 상세보기 모달
   - 엑셀 내보내기

5. **스케줄러 통합**
   - 기존 SchedulerSettings 확장
   - 홈택스 수집 작업 추가

---

## 보안 고려사항 (Security Considerations)

1. **인증 정보 암호화**
   - electron-store의 encryptionKey 사용
   - 공동인증서 안전한 저장

2. **세션 관리**
   - 로그인 세션 타임아웃 처리
   - 재인증 플로우

3. **데이터 보호**
   - 민감한 사업자 정보 암호화
   - 로그에 민감 정보 제외

4. **파일 권한**
   - 다운로드 폴더 접근 권한 확인
   - Full Disk Access 요구 (macOS)

---

## 참고사항 (Notes)

### 매입/매출 구분의 중요성
- **매출 계산서**: 사업자가 발행한 계산서 (매출 증빙)
- **매입 계산서**: 사업자가 받은 계산서 (비용/매입 증빙)
- 두 유형은 세무 목적이 다르므로 **반드시 분리 수집 및 관리** 필요
- UI에서 탭으로 명확히 구분하여 사용자가 쉽게 확인 가능

### 다중 사업자 지원의 중요성
- **한 사용자가 여러 사업자 소유**: 개인사업자 + 법인, 또는 여러 법인 동시 운영
- **독립적인 데이터 관리**: 각 사업자등록번호별로 별도의 세금계산서 관리
- **사업자별 인증**: 각 사업자마다 다른 홈택스 계정 사용 가능
- **선택적 조회**: 특정 사업자만 보거나 전체 사업자 통합 조회 가능
- **UI 패턴**: 은행 계좌 연결과 동일한 패턴 사용으로 사용자 학습 곡선 최소화

### 기술적 고려사항
- 홈택스 웹사이트 구조 변경 시 자동화 스크립트 업데이트 필요
- 공동인증서 경로는 OS별로 다름 (Windows/macOS)
- 대량 데이터 수집 시 페이지네이션 고려
- 세금계산서 수정/취소 건에 대한 처리 로직 필요
- 매출/매입 각각 별도의 엑셀 파일로 다운로드 (홈택스 구조상 분리됨)
