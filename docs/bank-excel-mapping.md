# Bank Excel Mapping Reference

Canonical mapping rules for Finance Hub bank Excel imports — **manual upload** and **Playwright automations**. Column schemas live in `src/main/financehub/utils/transactionParser.js` (`BANK_EXCEL_PARSE_SCHEMA`, `BANK_EXCEL_HEADER_ROW_1BASED`). Automators live under `src/main/financehub/banks/*/`.

---

## Automations overview

Each supported bank extends `BaseBankAutomator`, logs into the corporate portal, navigates to an inquiry screen, downloads Excel per account (or per product), then parses and upserts rows.

```
Portal login → menu navigation → set dates / pick account → Excel download
  → parseTransactionExcel (ctx = automator, bank_id from config)
  → upsert bank_transactions (or product table via financehub.ts import*)
```

**Entry points**

| Layer | Role |
|---|---|
| `*BankAutomator.js` | Browser automation + download + inline parse for deposits |
| `main.ts` IPC | Triggers sync; calls `import*FromExcel` for IBK/Hana/Woori product files |
| `FinanceHubScheduler.ts` | Scheduled sync: `getTransactionsWithParsing`, then bank-specific product syncs |
| `scripts/bank-excel-download-automation/*.spec.js` | Standalone Playwright recordings used to develop each flow |

**Deposit sync (all 6 banks)** — method: `getTransactionsWithParsing(accountNumber, startDate, endDate)`

| Bank | Automator | Portal | Frame | Menu path | Parser | DB table |
|---|---|---|---|---|---|---|
| Shinhan | `ShinhanBankAutomator` | `bizbank.shinhan.com` | none | 조회 → 계좌별거래내역 | `parseTransactionExcel(..., this)` | `bank_transactions` |
| Hana | `HanaBankAutomator` | `biz.kebhana.com` | `hanaMainframe` | 조회 → 거래내역 조회 | same | same |
| KB | `KookminBankAutomator` | `obank.kbstar.com` | varies | 조회/이체 → 거래내역 조회 | same | same |
| NH | `NHBankAutomator` | `ibz.nonghyup.com` | none | 입출금거래내역조회 | same | same |
| IBK | `IbkBankAutomator` | `kiup.ibk.co.kr` | `mainframe` | 거래내역조회 | same | same |
| Woori | `WooriBankAutomator` | `nbi.wooribank.com` | none | 조회 → 거래내역조회 | same | same |

Automators pass `this` as parser context so `config.bank.id` selects the correct header row and column schema. Parsed rows are upserted inside `getTransactions` / `getTransactionsWithParsing` before returning to the scheduler.

**Playwright spec scripts** (reference implementations):

| Bank | Spec file |
|---|---|
| Shinhan | `scripts/bank-excel-download-automation/shinhan.spec.js` |
| Hana | `scripts/bank-excel-download-automation/hana.spec.js` |
| KB | `scripts/bank-excel-download-automation/kb.spec.js` |
| NH | `scripts/bank-excel-download-automation/nhbank.spec.js` |
| IBK (deposits) | `scripts/bank-excel-download-automation/ibk.spec.js` |
| IBK (외상매출채권) | `scripts/bank-excel-download-automation/ibkpromissory_notes.spec.js` |
| Woori | `scripts/bank-excel-download-automation/woori.spec.js` |

---

### Per-bank automation details (deposits)

#### Shinhan (`shinhan`)

- **Biz flow:** `_getTransactionsShinhanBiz` when URL contains `bizbank.shinhan.com` (see `shinhan.spec.js`).
- **Retail fallback:** `_getTransactionsShinhanRetail` for non-biz URLs.
- **Download naming:** `shinhan-export.xls` (suggested) → saved under bank output dir.
- **Excel mapping:** [Shinhan column map](#shinhan-shinhan) — header row **1**.

#### Hana (`hana`)

- **Frame:** `#hanaMainframe`; start date field `#sInqStrDt`.
- **Download naming:** `hana-export.xls`.
- **Excel mapping:** [Hana column map](#hana-hana) — header row **7**.
- **Also runs:** `syncLoanHistory()` after deposit sync (debounced 5 min) — see [Product automations](#product-automations-non-deposit).

#### KB Kookmin (`kookmin`)

- **Biz flow:** `_getTransactionsKookminBiz`; date input `#조회검색시작일`.
- **Download naming:** `kb-export.xls`.
- **Excel mapping:** [KB column map](#kb-kookmin-kookmin) — header row **7**.

#### NH (`nh`)

- **Portal:** corporate site `ibz.nonghyup.com` (cert UI in-page, not native window).
- **Download naming:** bank-suggested `.xls`.
- **Excel mapping:** [NH column map](#nh-nh) — header row **10**.

#### IBK (`ibk`)

- **Frame:** `mainframe`; account `<select>` discovered after navigating to 거래내역조회.
- **Account label:** `{digits-hyphens}:{nickname}` via `_parseIbkAccountFromOption` + `accountDisplayNameFromOptionText`.
- **Download naming:** `ibk-export.xls` → `IBK_{account}_{dates}_{ts}.xls`.
- **Excel mapping:** [IBK column map](#ibk-ibk) — header row **3**.
- **Also runs:** `syncLoanTransactions`, `syncPromissoryNotes`, `syncEndorsements` — see below.

#### Woori (`woori`)

- **Account picker:** `#noAccount` dropdown buttons.
- **Export buttons:** `#qcell_qcExportFile` → `#excelExportBtn`.
- **Download naming:** `woori-export.xls` / `우리은행 거래내역조회 YYYYMMDD.xlsx`.
- **Excel mapping:** [Woori column map](#woori-woori) — header row **4**.
- **Also runs:** `syncB2bLoanExecutions()` — see [Product automations](#product-automations-non-deposit).

---

### Product automations (non-deposit)

These download separate Excel layouts and import into dedicated tables. Column maps are in [Other bank product Excel parsers](#other-bank-product-excel-parsers).

| Bank | Automator method | Menu path | Parser module | DB import (`financehub.ts`) | Saved filename pattern |
|---|---|---|---|---|---|
| IBK | `syncPromissoryNotes()` | B2B → 판매기업 → 외상매출채권 → 채권조회/취소신청 | `ibk-promissory-notes-excel.js` | `importIbkB2bReceivablesFromExcel` | `IBK_외상매출채권_{ts}.xls` |
| IBK | `syncEndorsements(opts)` | B2B → 전자어음 → 조회 → 배서내역조회 | `ibk-endorsements-excel.js` | `importIbkEndorsementsFromExcel` | `IBK_배서내역_{ts}.xlsx` |
| IBK | `syncLoanTransactions(opts)` — **신탁 tab** | 뱅킹업무 → 대출 → 대출조회 → 거래내역조회 → tab 신탁 | `ibk-loan-history-excel.js` | `importIbkLoanHistoryFromExcel` | `IBK_신탁거래_{acct}_{dates}_{ts}.xlsx` |
| IBK | `syncLoanTransactions(opts)` — **펀드 tab** | same page → tab 펀드 | *(download only; parse TBD)* | — | `IBK_펀드거래_{acct}_{dates}_{ts}.xlsx` |
| IBK | `syncLoanTransactions(opts)` — **대출 tab** | same page → tab 대출 (`#gnrl_lf_acno`) | `ibk-loan-history-excel.js` | `importIbkLoanHistoryFromExcel` | `IBK_대출거래_{acct}_{dates}_{ts}.xlsx` |
| IBK | `syncLoanTransactions(opts)` — **외화 tab** | same page → tab 외화 | `ibk-foreign-currency-excel.js` | `importIbkForeignCurrencyFromExcel` | `IBK_외화거래_{acct}_{dates}_{ts}.xlsx` |
| Hana | `syncLoanHistory(opts)` | 상품가입•대출 → 대출조회 → 거래내역/대출계산서 조회 | `hana-loan-history-excel.js` | `importHanaLoanHistoryFromExcel` | `hana-loan-history.xls` |
| Woori | `syncB2bLoanExecutions(opts)` | 전자결제 → B2B대출(협력) → 대출_신청 → 실행내역 | `woori-b2b-loan-executions-excel.js` | `importWooriB2bLoanExecutionsFromExcel` | `우리_B2B대출실행내역_{dates}_{ts}.xlsx` |

**IBK `syncLoanTransactions` navigation:** `_navigateIbkToLoanInquiry` → 뱅킹업무 → 대출 (`efncmenuid=E0600000000`) → 대출조회 → 거래내역조회, then iterates tabs (신탁 / 펀드 / 대출 / 외화) with per-account dropdown loops.

**Import split:** IBK promissory and endorsement automators return `{ filePath }`; `main.ts` / scheduler call the matching `import*FromExcel` after download. Loan/foreign imports run inside `IbkBankAutomator.syncLoanTransactions` for 신탁/대출/외화 tabs.

**Scheduler order** (`FinanceHubScheduler.ts`): for each account → `getTransactionsWithParsing` → then bank hooks:
- IBK: `syncLoanTransactions` → `syncPromissoryNotes` → `syncEndorsements`
- Hana: `syncLoanHistory`
- Woori: `syncB2bLoanExecutions`

---

## Target schema (`bank_transactions`)

All bank transaction Excel imports normalize into these DB-facing fields:

| Role (parser) | DB column | Korean label |
|---|---|---|
| `date` | `transaction_date` | 거래일자 |
| `time` | `transaction_time` | 거래시간 |
| `description` | `description` | 적요1 |
| `description2` | `description2` | 적요2 (JSON object) |
| `deposit` | `deposit` | 입금 |
| `withdrawal` | `withdrawal` | 출금 |
| `balance` | `balance` | 잔액 |
| `branch` | `branch` | 취급지점 |
| `counterpartyAccount` | `counterparty_account` | 상대계좌 |
| `counterparty` | `counterparty_name` | 상대계좌예금주명 |

Denormalized account fields (`account_number`, `account_name`) come from the selected account or SERP row columns, not from the transaction column map.

### 적요2 bundle rule

Any source column **not** mapped to a primary target field is bundled into a JSON object stored in `description2` (적요2). Example (IBK):

```json
{ "거래구분": "이자", "CMS코드": "000", "상대은행": "신한" }
```

---

## Account label parsing (dropdown / option text)

When scraping accounts from bank portals, option text is parsed into **계좌번호** + **계좌별칭** using `accountOptionLabel.js`.

| Bank | `bank_id` | Option text format | Example |
|---|---|---|---|
| Shinhan (신한) | `shinhan` | `{account-no}(accountname)` | `110-123-456789(운영자금)` |
| Hana (하나) | `hana` | `{account-no} \| accountname [optional거래중지]` | `213-890060-03104 기업자유예금 [거래중지]` |
| NH (농협) | `nh` | `{account-no}` (digits only) | `301-1234-5678-90` |
| KB Kookmin (국민) | `kookmin` | `{account-no}:{accounttype}-{accountname}` | `123-45-6789010:보통-운영자금` |
| IBK (기업) | `ibk` | `{account-no}:{accountname}(optionalaccounttype)` | `922-001568-15-119:주거래기업부금(정기적립식)` |
| Woori (우리) | `woori` | `{account-no} \| accountname` | `1002-123-456789 \| 법인통장` |

IBK uses a colon separator (`digits-hyphens:digits-hyphens:label`). Other banks use space or pipe after the dashed account token.

---

## Transaction Excel — header row (1-based)

| Bank / format | `bank_id` | Header row |
|---|---|---|
| Shinhan | `shinhan` | 1 |
| Hana | `hana` | 7 |
| KB Kookmin | `kookmin` | 7 |
| IBK | `ibk` | 3 |
| Woori | `woori` | 4 |
| NH | `nh` | 10 |
| SERP (unified) | `serp` | 6 |

Rows above the header row are metadata (account info, query period, etc.) and are ignored for the transaction table.

---

## Transaction Excel — column mappings

### Shinhan (`shinhan`)

| Source (Excel) | Target | Notes |
|---|---|---|
| 거래일시 | 거래일자 + 거래시간 | Split: `YYYYMMDDHHMMSS` → date + time |
| 적요 | 적요1 | |
| 입금액 | 입금 | |
| 출금액 | 출금 | |
| 잔액 | 잔액 | |
| 거래점명 | 취급지점 | |
| 내용 | 적요2 | JSON key: `내용` |

**Datetime style:** `shinhan14`

---

### Hana (`hana`)

| Source (Excel) | Target | Notes |
|---|---|---|
| 거래일시 | 거래일자 + 거래시간 | Split at space: `YYYY-MM-DD HH:MM` |
| 적요 | 적요1 | |
| 입금 | 입금 | |
| 출금 | 출금 | |
| 거래후잔액 | 잔액 | |
| 거래점 | 취급지점 | |
| 의뢰인/수취인 | 상대계좌예금주명 | Alt header: `의뢰인수취인` (spaces stripped) |
| 거래특이사항 | 적요2 | |
| 추가메모 | 적요2 | |
| 구분 | 적요2 | |

**Datetime style:** `hanaSpace`

---

### NH (`nh`)

| Source (Excel) | Target | Notes |
|---|---|---|
| 거래일자 | 거래일자 | Separate date column |
| 거래시간 | 거래시간 | Separate time column |
| 거래기록사항 | 적요1 | |
| 입금금액(원) | 입금 | |
| 출금금액(원) | 출금 | |
| 거래 후 잔액(원) | 잔액 | Normalized as `거래후잔액(원)` |
| 거래점 | 취급지점 | |
| 거래내용 | 적요2 | |
| 이체메모 | 적요2 | |

**Datetime style:** none (separate date/time columns)

---

### KB Kookmin (`kookmin`)

| Source (Excel) | Target | Notes |
|---|---|---|
| 거래일시 | 거래일자 + 거래시간 | Split at space: `YYYY.MM.DD HH:MM` |
| 보낸분/받는분 | 상대계좌예금주명 | Alt header: `보낸분받는분` |
| 적요 | 적요1 | |
| 입금액(원) | 입금 | |
| 출금액(원) | 출금 | |
| 잔액(원) | 잔액 | |
| 처리점 | 취급지점 | |
| 내 통장 표시 | 적요2 | Normalized as `내통장표시` |
| 구분 | 적요2 | |

**Datetime style:** `kbSpace`

---

### IBK (`ibk`)

| Source (Excel) | Target | Notes |
|---|---|---|
| 거래일시 | 거래일자 + 거래시간 | Split at space: `YYYY-MM-DD HH:MM:SS` |
| 납입일자 | 거래일자 | Fallback date (e.g. trust deposits) |
| 거래내용, 비고 | 적요1 | First non-empty wins |
| 입금, 납입금액 | 입금 | First non-empty wins |
| 출금 | 출금 | |
| 거래후 잔액, 잔액 | 잔액 | Normalized as `거래후잔액` |
| 상대계좌번호 | 상대계좌 | |
| 상대계좌예금주명 | 상대계좌예금주명 | |
| 거래구분 | 적요2 | |
| 수표어음금액 | 적요2 | |
| CMS코드 | 적요2 | |
| 상대은행 | 적요2 | |

**Datetime style:** `hanaSpace`

---

### Woori (`woori`)

| Source (Excel) | Target | Notes |
|---|---|---|
| 거래일시 | 거래일자 + 거래시간 | Split at space: `YYYY.MM.DD HH:MM:SS` |
| 적요 | 적요1 | |
| 입금(원) | 입금 | |
| 지급(원) | 출금 | |
| 거래후 잔액(원) | 잔액 | Normalized as `거래후잔액(원)` |
| 취급점 | 취급지점 | |
| 기재내용 | 적요2 | |
| 표·어음·증권금액(원) | 적요2 | Normalized as `표어음증권금액(원)` |

**Datetime style:** `wooriSpace`

---

### SERP unified format (`serp`)

SERP is an **Excel format profile**, not a bank. Manual import uses `bank_id = serp` for routing; actual institution names may appear per row.

| Source (Excel) | Target | Notes |
|---|---|---|
| 거래일자 | 거래일자 | |
| 거래시간 | 거래시간 | |
| 적요1 | 적요1 | |
| 입금 | 입금 | |
| 출금 | 출금 | |
| 잔액 | 잔액 | |
| 취급지점 | 취급지점 | |
| 상대계좌 | 상대계좌 | |
| 상대계좌예금주명 | 상대계좌예금주명 | |
| 은행 | 적요2 | Also used to resolve real `bank_id` on import |
| 계좌번호 | 적요2 | Used for row grouping |
| 계좌별칭 | 적요2 | |
| 비고 | 적요2 | |
| 수기 | 적요2 | |
| 적요2 | 적요2 | |

**Header row:** 6 (1-based). Rows 1–5 are ignored.

**Manual import grouping:** When format is SERP, rows are grouped by `은행` (mapped to real `banks.id`) + `계좌번호`. The `은행` column is matched via `bankLabelToId.js` (신한, 국민, 우리, 하나, 농협, IBK/기업, 카카오, 토스). Unmapped labels store under `serp`. Non-SERP formats keep the selected bank for all rows. Rows without `계좌번호` use the optional UI field or `MANUAL-IMPORT`.

---

## Datetime split styles

| Style | Used by | Input format | Split logic |
|---|---|---|---|
| `shinhan14` | Shinhan | `YYYYMMDDHHMMSS` | 14 digits → `YYYY-MM-DD` + `HH:MM:SS` |
| `hanaSpace` | Hana, IBK | `YYYY-MM-DD HH:MM[:SS]` or `YYYY.MM.DD HH:MM[:SS]` | Split at space |
| `kbSpace` | KB Kookmin | `YYYY.MM.DD HH:MM` | Split at space |
| `wooriSpace` | Woori | `YYYY.MM.DD HH:MM:SS` | Split at space |
| *(none)* | NH, SERP | Separate date/time columns | No combined datetime split |

Header keys are normalized before matching: whitespace removed, middle dots (`·`) removed.

---

## SERP bank label → `banks.id`

From `bankLabelToId.js`:

| Label pattern | `banks.id` |
|---|---|
| 카카오 | `kakao` |
| 토스 | `toss` |
| IBK, 기업은행, 기업 | `ibk` |
| 농협, NH | `nh` |
| 국민, Kookmin, KB (not 카드) | `kookmin` |
| 신한 | `shinhan` |
| 우리 | `woori` |
| 하나, Hana, KEB | `hana` |

---

## Other bank product Excel parsers

These are separate from transaction imports and map product-specific exports to their own tables.

### IBK 외상매출채권 (`ibk-promissory-notes-excel.js`)

- **Header row:** 3 (1-based)
- **Columns:** 일련번호, 어음번호, 구매기업명, 종류, 상태, 취소신청여부, 현금성여부, 채권금액, 채권등록일, 채권만기일, 대출가능일, 대출실행여부, 대출금액, 세금발급일, 입금계좌번호, 결제일자, 압류금액, 최초어음금액, 압류권자, 구매자사업자번호, 지급사업장

### IBK 배서내역 (`ibk-endorsements-excel.js`)

- **Header row:** 3 (1-based)
- **Columns:** 어음번호, 발행업체명, 사업자번호, 발행일자, 만기일자, 배서인명, 배서인실명번호, 처리상태, 배서일자, 무담보배서여부, 배서금지배서여부, 보증여부, 부도처리일자, 최종결제일자, 지급은행및점포코드, 지급은행및점포명, 발행인당좌계좌, 배서인입금계좌, 분할번호, 배서번호, 배서금액, 배서받으시는분업체명, 배서받으시는분실명번호, 배서받으시는분입금계좌

### IBK 대출거래내역 (`ibk-loan-history-excel.js`)

Two export formats auto-detected:

| Format | Header row | Columns |
|---|---|---|
| New | row 3 | 거래일자, 거래구분, 통화구분, 거래금액, 원금, 이자금액, 대출잔액, 이율(%), 시작일, 종료일, 상태구분 |
| Old | row 2 | 거래일, 거래내용, 통화코드, 실행/상환금액, 이자, 수수료, 대출금잔액, 부리시작일, 부리종료일, 이율, 거래점 |

### IBK 외화거래내역 (`ibk-foreign-currency-excel.js`)

- **Header row:** 3 (1-based, row index 2)
- **Columns:** 거래일시, 통화, 입금, 출금, 거래후잔액, 적요, 수출계좌번호, 해외수입업자
- **Metadata row 2:** 계좌번호, 예금주명, 조회기간

### Hana 대출거래내역 (`hana-loan-history-excel.js`)

- **Account row:** row 5 (1-based)
- **Header row:** row 9 (1-based)
- **Columns:** 거래일, 거래내용, 통화코드, 실행/상환금액, 이자, 수수료, 대출금잔액, 부리시작일, 부리종료일, 이율, 거래점
- **Footer:** row where column C is `합계`

### Woori B2B 대출 실행내역 (`woori-b2b-loan-executions-excel.js`)

- **Header row:** 2 (1-based)
- **Columns:** 채권번호, 입금일, 신청금액(원), 이자금액(원), 입금금액(원), 판매처, 거래번호, 접수일, 채권만기일, 채권금액(원), 대출만기일, 대출잔액(원), 대출금리(%)
- **Note:** `No.` column is row index only and is not stored.

---

## Source files

| File | Purpose |
|---|---|
| `src/main/financehub/utils/transactionParser.js` | Transaction Excel parse schema + datetime split |
| `src/main/financehub/utils/accountOptionLabel.js` | Account dropdown label parsing |
| `src/main/financehub/utils/bankLabelToId.js` | SERP `은행` column → `banks.id` |
| `src/main/financehub/banks/*/*BankAutomator.js` | Playwright automations (download + parse) |
| `src/main/financehub/scheduler/FinanceHubScheduler.ts` | Scheduled sync orchestration |
| `src/main/main.ts` | IPC handlers; product Excel import after automator download |
| `src/main/sqlite/financehub.ts` | `import*FromExcel` DB upsert for product exports |
| `scripts/bank-excel-download-automation/*.spec.js` | Reference Playwright flows per bank |
| `scripts/bank-excel-download-automation/excel_parsing_logic.md` | Original design notes |
| `src/main/financehub/utils/*-excel.js` | Product-specific parsers (loans, promissory notes, etc.) |
