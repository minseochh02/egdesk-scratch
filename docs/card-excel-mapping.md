# Card Excel Mapping Reference

Canonical mapping rules for Finance Hub **card** Excel imports — manual upload and Playwright automations. Parsers live in `src/main/financehub/cards/*/*CardAutomator.js`. Normalization to DB rows uses `cardTransactionMapper.js` → `financehub.ts` (`importTransactions` / `bulkInsertCardTransactions`).

---

## Automations overview

Each implemented card company extends `BaseCardAutomator`, logs into the corporate portal, navigates to 승인내역 (or equivalent), downloads Excel, parses rows, and upserts into `card_transactions`.

```
Portal login → 승인내역 menu → set dates → Excel download
  → *CardAutomator.parse*Excel / parseDownloadedExcel
  → transformCardTransaction (cardTransactionMapper.js)
  → bulkInsertCardTransactions
```

**Entry points**

| Layer | Role |
|---|---|
| `*CardAutomator.js` | Browser automation, download, parse |
| `main.ts` `finance-hub:card:import-excel` | Manual Excel import (no browser) |
| `FinanceHubScheduler.ts` | Scheduled sync: login → `getTransactions(null, start, end, { parse: true })` |
| `cardExportMapper.js` | Reverse mapping: DB → standardized 15-column export layout |

**Implementation status**

| `card_company_id` | Korean | Automator | Automation |
|---|---|---|---|
| `shinhan-card` | 신한카드 | `ShinhanCardAutomator` | ✅ |
| `kb-card` | KB국민카드 | `KBCardAutomator` | ✅ |
| `nh-card` | NH농협카드 | `NHCardAutomator` | ✅ |
| `bc-card` | BC카드 | `BCCardAutomator` | ✅ |
| `hana-card` | 하나카드 | `HanaCardAutomator` | ✅ |
| `samsung-card` | 삼성카드 | `SamsungCardAutomator` | 🚧 placeholder |
| `hyundai-card` | 현대카드 | `HyundaiCardAutomator` | 🚧 placeholder |
| `lotte-card` | 롯데카드 | `LotteCardAutomator` | 🚧 placeholder |

Registry: `src/main/financehub/cards/index.js`

---

### Per-card automation summary

| Card | Portal | Menu path | Parse method | Header row (1-based) | Download format | Notes |
|---|---|---|---|---|---|---|
| Shinhan | `shinhancard.com` | 사이트맵 → 이용내역조회 | `parseDownloadedExcel` | Auto-scan (first 10 rows) | `.xls` / `.xlsx` | **All cards in one file**; ~7-day max range |
| KB | `biz.kbcard.com` | Menu → 승인내역조회 | `parseKBCardExcel` | Auto-scan (승인일 + 카드번호 + 가맹점명) | Excel | Paginates all pages before download |
| NH | `nhbizcard.nonghyup.com` | 조회/결제 → 승인내역 | `parseNHCardExcel` | **10** | Excel | Usage + cancellation split into 2 rows |
| BC | `wisebiz.bccard.com` | 카드이용조회 → 승인내역조회 | `parseDownloadedExcel` | Auto-scan (카드번호 + 승인일자 + 승인금액) | **ZIP → .xlsx** | Card list via 카드정보조회 → 보유카드조회 Excel |
| Hana | `hanacard.co.kr` | 승인내역 (기업) | `parseExcelTransactions` | **6** (rows 1–5 metadata) | Excel | **Per department** loop; all cards per dept |

**Scheduler behavior:** `FinanceHubScheduler` calls `getTransactions(null, startDate, endDate, { parse: true })` for the last 7 days. Card numbers in exports are often masked — transactions may import under one account when numbers cannot be matched.

**Manual import:** `finance-hub:card:import-excel` creates a headless automator and calls the same parsers; rows are grouped by `카드번호` / `이용카드` / `cardNumber` before DB upsert.

---

## Target schema (`card_transactions`)

| Parser / metadata field | DB column | Korean label |
|---|---|---|
| `approvalDatetime` / combined date+time | `approval_datetime` | 접수일자/(승인일자) + time |
| `approvalDate` | `approval_date` | 승인일 / 이용일 |
| `merchantName` / `description` | `merchant_name` | 가맹점명/국가명 |
| `amount` (via withdrawal/deposit) | `amount` | 이용금액 / 승인금액 |
| `cardNumber` | `card_number` | 카드번호 |
| `headquartersName` | `headquarters_name` | 본부명 |
| `departmentName` | `department_name` | 부서명 |
| `cardType` | `card_type` | 카드구분 |
| `cardholderName` / `userName` / `cardHolder` | `cardholder_name` | 카드소지자 / 이용자명 |
| `transactionBank` | `transaction_bank` | 거래은행 |
| `usageType` / `transactionType` | `usage_type` | 사용구분 / 이용구분 |
| `salesType` | `sales_type` | 매출종류 |
| `billingDate` / `결제일` | `billing_date` | 청구일자 / 결제일 |
| `approvalNumber` | `approval_number` | 승인번호 |
| `foreignAmountUsd` (computed) | `foreign_amount_usd` | (US $) |
| `memo` / notes | `memo` | 비고 |
| `isCancelled` | `is_cancelled` | 취소 여부 |

**Transform pipeline:** `transformCardTransaction` maps card-specific Excel fields → unified `{ date, time, withdrawal, deposit, description, metadata }`. Cancelled/refund rows become `deposit`; normal charges become `withdrawal`. Remaining card-specific columns stay in `metadata` JSON when using the unified `transactions` table path.

---

## Standardized export layout (15 columns)

`cardExportMapper.js` maps DB records to a common export shape used across card companies:

| Export column | Primary sources |
|---|---|
| 카드사 | `card_company_id` |
| 본부명 | BC: `metadata.headquartersName` |
| 부서명 | BC, KB: `metadata.departmentName` |
| 카드번호 | `metadata.cardNumber` |
| 카드구분 | BC: `metadata.cardType`; default `법인` |
| 카드소지자 | BC: `cardHolder`; KB: `representativeName`; others: `userName` |
| 거래은행 | BC: `metadata.transactionBank` |
| 사용구분 | BC: `usageType`; KB: `approvalType`; Shinhan: `transactionType`; NH: `transactionMethod` |
| 매출종류 | `metadata.salesType` |
| 접수일자/(승인일자) | `transaction.date` |
| 청구일자 | NH `결제일`; Shinhan `paymentDueDate` |
| 승인번호 | `metadata.approvalNumber` |
| 가맹점명/국가명(도시명) | `description` / `counterparty` |
| 이용금액 | `withdrawal` or negative `deposit` |
| (US $) | `foreignAmountKRW / exchangeRate` |
| 비고 | cancellation, installment, foreign flags |

---

## Card Excel — column mappings

### Shinhan Card (`shinhan-card`)

**Header row:** auto-detected (scan first 10 rows for `카드번호`, `승인일`, `이용일`, `승인금액`).

| Source (Excel) | Parser field | DB / metadata |
|---|---|---|
| 이용일시 | `transactionDate` | `approval_datetime` |
| 승인번호 | `approvalNumber` | `approval_number` |
| 이용카드 | `cardUsed` | `card_number` |
| 이용자번호 | `userNumber` | metadata |
| 가상카드번호 | `virtualCardNumber` | metadata |
| 이용자명 | `userName` | `cardholder_name` |
| 가맹점명 | `merchantName` | `merchant_name` |
| 이용금액 | `amount` | `amount` |
| 이용구분 | `transactionType` | `usage_type` |
| 할부개월수 | `installmentMonths` | metadata (notes) |
| 카드구분 | `cardType` | `card_type` |
| 취소일자 | `cancellationDate` | metadata → `is_cancelled` |
| 매입상태 | `purchaseStatus` | metadata |
| 결제예정일 | `paymentDueDate` | `billing_date` |

**Automation:** `navigateToTransactionHistory()` via sitemap → 이용내역조회. Downloads **all cards** in one Excel (cardNumber param ignored).

---

### KB Card (`kb-card`)

**Header row:** auto-detected when row contains `승인일`, `카드번호`, `가맹점명`.

| Source (Excel) | Parser field | DB / metadata |
|---|---|---|
| 승인일 | `approvalDate` | `approval_date` |
| 승인시간 | `approvalTime` | time part of `approval_datetime` |
| 부서번호 | `departmentNumber` | metadata |
| 부서명 | `departmentName` | `department_name` |
| 카드번호 | `cardNumber` | `card_number` |
| 이용자명 | `userName` | metadata (holder via export mapper uses `representativeName` if set) |
| 가맹점명 | `merchantName` | `merchant_name` |
| 업종명 | `businessType` | metadata |
| 결제방법 | `paymentMethod` | metadata |
| 할부개월수 | `installmentMonths` | metadata |
| 승인금액 | `amount` | `amount` |
| 부가세 | `vat` | metadata |
| 승인구분 | `approvalType` | `usage_type` / cancellation detection |
| 승인방식 | `approvalMethod` | metadata |
| 승인번호 | `approvalNumber` | `approval_number` |
| 상태 | `status` | metadata |
| 과세유형 | `taxType` | metadata |
| 가맹점상태 | `merchantStatus` | metadata |
| 가맹점번호 | `merchantNumber` | metadata |
| 가맹점사업자등록번호 | `merchantBusinessNumber` | metadata |
| 대표자성명 | `representativeName` | export `카드소지자` |
| 가맹점주소 | `merchantAddress` | metadata |
| 가맹점전화번호 | `merchantPhone` | metadata |

**Automation:** Menu hover → 승인내역조회 → set dates → paginate → Excel download.

---

### NH Card (`nh-card`)

**Header row:** **10** (1-based). Data from row 11.

| Source (Excel) | Target | Notes |
|---|---|---|
| 이용카드 | `이용카드` | Card identifier |
| 사용자명 | `userName` | Cardholder |
| 이용일시 | combined datetime | `dateTime` via mapper |
| 승인번호 | `approvalNumber` | |
| 국내이용금액(원) | `amount` (usage row) | Separate row `transactionType: usage` |
| 취소금액 | `amount` (cancellation row) | Separate row `transactionType: cancellation`, negative |
| 가맹점명 | `merchantName` | |
| 매출종류 | `salesType` | Cancellation detection |
| 할부기간 | `installmentPeriod` | metadata |
| 취소여부 | `cancellationStatus` | metadata |
| 접수년월일 | `receiptDate` | metadata |
| 결제일 | `billingDate` | `billing_date` |
| 국내외구분 | `domesticForeign` | metadata |
| 공급가액(원) | metadata | |
| 부가세(원) | metadata | |
| 보증금(원) | metadata | |
| 봉사료(원) | metadata | |
| 가맹점사업자번호 | metadata | |
| 가맹점업종 | metadata | |
| 가맹점우편번호 | metadata | |
| 가맹점주소1 / 2 / (전체) | metadata | |
| 가맹점전화번호 | metadata | |
| 가맹점대표자명 | metadata | |
| 기타도로명우편번호 | metadata | |
| 신주소 | metadata | |

**Automation:** 조회/결제 → 승인내역. Card discovery: 카드신청/관리 → 카드발급내역.

---

### BC Card (`bc-card`)

**Header row:** auto-detected (first 10 rows must contain `카드번호`, `승인일자`, `승인금액`). Expected **16 columns** per `BC_CARD_COLUMNS` in `config.js`.

| Source (Excel) | Parser field | DB column |
|---|---|---|
| 본부명 | `headquartersName` | `headquarters_name` |
| 부서명 | `departmentName` | `department_name` |
| 카드번호 | `cardNumber` | `card_number` |
| 카드구분 | `cardType` | `card_type` |
| 카드소지자 | `cardHolder` | `cardholder_name` |
| 거래은행 | `transactionBank` | `transaction_bank` |
| 사용구분 | `usageType` | `usage_type` |
| 매출종류 | `salesType` | `sales_type` (+ cancellation via `매입취소`) |
| 할부기간 | `installmentPeriod` | metadata |
| 승인일자 | `approvalDate` | `approval_date` |
| 승인시간 | `approvalTime` | time |
| 승인번호 | `approvalNumber` | `approval_number` |
| 가맹점명/국가명 | `merchantName` | `merchant_name` |
| 승인금액 | `approvalAmount` | `amount` |
| 환율 | `exchangeRate` | metadata |
| 해외승인원화금액 | `foreignAmountKRW` | metadata; USD derived in export |

**Automation:** 카드이용조회 → 승인내역조회. Download is often a **ZIP** containing `.xlsx` (extracted before parse).

---

### Hana Card (`hana-card`)

**Layout:** rows 1–5 = metadata (본부명, 부서명); **row 6** = header; row 7+ = data.

| Source (Excel) | Internal key | Maps to |
|---|---|---|
| NO | `no` | row index (not stored) |
| 이용일 | `usageDate` | `approval_date` |
| 이용시간 | `usageTime` | time |
| 카드번호 | `cardNumber` | `card_number` |
| 승인번호 | `approvalNumber` | `approval_number` |
| 승인금액 | `approvalAmount` | `amount` |
| 승인취소금액 | `approvalCancelAmount` | cancellation / `is_cancelled` |
| 가맹점명 | `merchantName` | `merchant_name` |
| 업종명 | `businessType` | metadata |
| 가맹점번호 | `merchantNumber` | metadata |
| 가맹점사업자번호 | `merchantBusinessNumber` | metadata |
| 이용구분 | `usageType` | `usage_type` |
| 할부기간 | `installmentPeriod` | metadata |
| 매입 | `purchase` | metadata |
| 매입금액 | `purchaseAmount` | metadata |
| 매출취소금액 | `salesCancelAmount` | metadata |
| 매입일 | `purchaseDate` | metadata |
| 상태 | `status` | metadata (`승인취소` → cancelled) |
| 부가세 | `vat` | metadata |
| 하위몰정보 | `subMallInfo` | metadata |

**Automation:** 기업 login → 승인내역 → iterate **organization tree departments** → Excel per department. `cardNumber` parameter is ignored (all cards in dept export).

---

## Card number cleaning

`cleanCardNumber()` strips issuer prefixes before storage:

`BC카드`, `KB국민카드`, `KB카드`, `NH농협카드`, `NH카드`, `신한카드`, `삼성카드`, `현대카드`, `롯데카드`, `하나카드`

---

## Cancellation / amount rules

| Card | Detection | Amount handling |
|---|---|---|
| NH | Separate `취소금액` column → second row | Cancellation row: negative `amount` |
| BC | `매출종류` contains 취소; negative 승인금액 | `foreignAmountKRW` preferred when non-zero |
| Shinhan | `취소일자`, `이용구분` | Standard withdrawal/deposit flip |
| KB | `승인구분` | Standard |
| Hana | `승인취소금액`, `status === 승인취소` | `netAmount = approval + cancel amounts` |

---

## Source files

| File | Purpose |
|---|---|
| `src/main/financehub/cards/index.js` | Card registry + `createCardAutomator` |
| `src/main/financehub/cards/*/*CardAutomator.js` | Automation + Excel parsers |
| `src/main/financehub/cards/*/config.js` | Portal URLs, XPaths, column constants (BC) |
| `src/main/financehub/utils/cardTransactionMapper.js` | Excel row → DB transform |
| `src/main/financehub/utils/cardExportMapper.js` | DB → 15-column export |
| `src/main/financehub/core/BaseCardAutomator.js` | Shared browser / popup / download helpers |
| `src/main/sqlite/financehub.ts` | `bulkInsertCardTransactions`, `importTransactions` |
| `src/main/main.ts` | `finance-hub:card:import-excel` |
| `src/main/financehub/scheduler/FinanceHubScheduler.ts` | Scheduled card sync |

See also: [bank-excel-mapping.md](./bank-excel-mapping.md) for deposit account Excel rules.
