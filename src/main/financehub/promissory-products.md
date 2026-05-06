# Promissory Notes & B2B Credit Products — Bank Coverage Matrix

Planning doc for expanding `promissory_notes` automation beyond IBK 외상매출채권.
Fill in per-bank details below; once complete, this drives the schema and per-bank automator work.

Supported banks today: **Shinhan, KB Kookmin, NH, IBK, Hana, Woori**.

---

## 1. Quick reference matrix

Status legend:
- `done` — automator + parser + DB import implemented
- `menu` — menu path / portal location known, not yet automated
- `?` — not yet researched (fill in)
- `n/a` — bank does not offer this product
- `skip` — bank offers it but we've decided not to support

| Product (KO / EN)                             | Shinhan | KB | NH | IBK   | Hana | Woori |
|-----------------------------------------------|:------:|:--:|:--:|:-----:|:----:|:-----:|
| 외상매출채권 (B2B e-receivable, seller side)   |   ?    | ?  | ?  | done  |  ?   |   ?   |
| 외상매출채권담보대출 (receivable-backed loan)  |   ?    | ?  | ?  |  ?    |  ?   |   ?   |
| 전자어음 — 수취 (e-bill, received)            |   ?    | ?  | ?  |  ?    |  ?   |   ?   |
| 전자어음 — 발행 (e-bill, issued)              |   ?    | ?  | ?  |  ?    |  ?   |   ?   |
| 종이어음 (paper bill, legacy)                 |   ?    | ?  | ?  |  ?    |  ?   |   ?   |
| 어음할인 (bill discount → loan-like)          |   ?    | ?  | ?  |  ?    |  ?   |   ?   |
| 구매자금대출 (purchase financing loan)        |   ?    | ?  | ?  |  ?    |  ?   |   ?   |
| 상생결제 (Sangsaeng — large-buyer-credit)     |   ?    | ?  | ?  |  ?    |  ?   |   ?   |
| 매출채권매입 / 팩토링 (factoring)             |   ?    | ?  | ?  |  ?    |  ?   |   ?   |

> Add a row if a bank offers something not listed above.

---

## 2. Per-bank details

### Shinhan (신한)

- **Portal / login URL:** _to fill in_
- **Frame model:** _e.g. mainframe iframe, in-page SPA, etc._
- **Products offered (notes/loans):** _list_

| Product | Status | Menu path | Excel header row | Notes |
|---|---|---|---|---|
|  |  |  |  |  |

---

### KB Kookmin (KB 국민)

- **Portal / login URL:** _to fill in_
- **Frame model:** _to fill in_
- **Products offered:** _list_

| Product | Status | Menu path | Excel header row | Notes |
|---|---|---|---|---|
|  |  |  |  |  |

---

### NH (NH 농협)

- **Portal / login URL:** _to fill in_
- **Frame model:** _to fill in_
- **Products offered:** _list_

| Product | Status | Menu path | Excel header row | Notes |
|---|---|---|---|---|
|  |  |  |  |  |

---

### IBK (IBK 기업)

- **Portal / login URL:** `https://kiup.ibk.co.kr/uib/jsp/index.jsp`
- **Frame model:** Top-level `mainframe` iframe; menu uses `efncmenuid` attributes.
- **Products offered:** 외상매출채권 (currently scraped); per-row metadata also captures loan-availability flags (`대출가능일 / 대출실행여부 / 대출금액`), so receivable-backed loan data is partially present in the same export.

| Product | Status | Menu path | Excel header row | Notes |
|---|---|---|---|---|
| 외상매출채권 (수취) | done | B2B → 판매기업 → 외상매출채권 → 채권조회/취소신청 (`efncmenuid="E0303000000"` → `"E0303040000"`) | row 3 | 21 columns. Date range default 2022-01-01 ~ 당해 연말. Status mapping in `ibk-promissory-notes-excel.js:mapStatusToDb`. |
| 외상매출채권담보대출 | ? |  |  | Loan flags already in metadata; first-class table TBD. |
| 전자어음 (수취) | ? |  |  |  |
| 전자어음 (발행) | ? |  |  |  |
| 구매자금대출 | ? |  |  |  |
| 상생결제 | ? |  |  |  |

---

### Hana (하나)

- **Portal / login URL:** _to fill in (current automator uses `entryUrl` from `banks/hana/config.js`; check biz.kebhana.com)_
- **Frame model:** `hanaMainframe` iframe.
- **Products offered:** _list_

| Product | Status | Menu path | Excel header row | Notes |
|---|---|---|---|---|
|  |  |  |  |  |

---

### Woori (우리)

- **Portal / login URL:** `https://nbi.wooribank.com/nbi/woori?withyou=bi`
- **Frame model:** Single-page; INI cert UI uses `xwup_*` ids.
- **Top-nav tabs (corporate portal):** 조회 · 이체 · 전자결제 · 외환 · 빌링 · 금융상품 · 자금관리 · 기업서비스 · 빌링관리
- **조회 → 수표/어음 column** (from screenshot 2026-05-06):
  - **수표어음신청조회** (+ has submenus)
  - **받음어음** (+ has submenus)
  - **할인어음** (+ has submenus)
  - **자기앞수표조회**

| Product (Woori name)        | Status | Menu path                                | Table slug | Excel header row | Notes |
|-----------------------------|--------|------------------------------------------|------------|------------------|-------|
| B2B대출(협력) → 대출_신청 → 실행내역 | scaffold | 전자결제 → B2B대출(협력) → 대출_신청 → 실행내역 | `woori_b2b_loan_executions` | ?  | Seller-side B2B loan execution history. Date filter = calendar UI (see "Date picker recipe" below). Default range = current month. No-data signal: `.js-alert` overlay with text `해당 자료가 존재하지 않습니다.` (안내코드 BELAM00004). |
| 수표어음신청조회             | menu   | 조회 → 수표/어음 → 수표어음신청조회 (+)   | TBD        | ?                | Submenus not yet captured. Likely covers issued check / bill applications. |
| 받음어음                    | menu   | 조회 → 수표/어음 → 받음어음 (+)           | TBD        | ?                | Submenus not yet captured. Likely the received-bill ledger; map to 전자어음 수취 once leaf names confirmed. |
| 할인어음                    | menu   | 조회 → 수표/어음 → 할인어음 (+)           | TBD        | ?                | Loan-shaped (bill discount). |
| 자기앞수표조회               | menu   | 조회 → 수표/어음 → 자기앞수표조회         | TBD        | ?                | Cashier's check inquiry; decide whether to include. |

#### Date picker recipe (Woori 전자결제 menus)

These menus refuse to accept typed input on `#inqSdt10` / `#inqEdt10`. The successful flow (verified in `output/browser-recorder-tests/wooripromissorynote.spec.js`):

1. Click `#staDtBtn` (the "조회시작일" button next to the start-date input). Opens a **single overlay containing both start and end calendars side by side.**
2. Within the overlay, two halves at index 1 (start) and 2 (end). Each half has:
   - `select.rt-qc-ui-datepicker-year` — year dropdown
   - `select.rt-qc-ui-datepicker-month` — month dropdown
   - `a.rt-qc-ui-state-default` — day cells, text = day number
3. Set start year/month via `selectOption()`, click day `<a>` whose text matches; do the same on the end side.
4. Click `.btn-com1` (확인) — both `#inqSdt10` and `#inqEdt10` populate.
5. Click `#btnDoInquiry` (조회).

Avoid `:nth-match(N)` selectors used by the recorder — scope by side container (`overlay.locator('...').nth(0)` for start, `.nth(1)` for end) for stability.

**Other 조회 columns observed** (not promissory-related but useful context for future automation): 계좌조회, 거래내역조회, 증명서 발급, 금융정보조회, 수수료내역조회.

#### 전자결제 tab (from screenshot 2026-05-06 153630)

The 전자결제 tab is where most B2B credit/note products live. Six column groups.

**통합관리** (cross-product aggregation — possibly the easiest "one-shot" sync entry points):
- 약정내역통합조회 — agreements summary across all products
- 당일이용내역조회 — same-day usage
- 판매내역 통합조회 — seller-side aggregated history
- 구매내역 통합조회 — buyer-side aggregated history
- 세금계산서 — tax invoices
- SMS서비스 — notification settings

**판매기업** (seller-side; "협약" suffix = agreement-side party):
- B2B대출(협약), 기업팩토링(협약), 상생팩토링(협약), 구매자금대출(협약)
- 세이프e-구매보증(협약), 상생플러스론(협약)
- 네트워크론(상거래), 우리 CUBE 데이터론, 원비즈데이터론

**구매기업** (buyer-side; "주계약" suffix = primary-contract party):
- B2B대출(주계약), 기업팩토링(주계약), 상생파트너론(주계약), 구매자금대출(주계약)
- 세이프e-구매보증(주계약), 세이프e-구매대금대출
- 우리공동구매보증(...) — bottom partially obscured
- 상생플러스론(주계약), 단기수요자금융

**전자어음/채권** (e-bills — primary target for note automation):
- 지급전자어음 — payable e-bills (issued by us)
- 받음전자어음 — receivable e-bills (held by us)
- 보증전자어음 — guaranteed e-bills
- 전자어음수수료조회 — fee inquiry
- 전자어음발행(입력) — issuance entry
- 부도어음발행(입금청구) — dishonored bill / collection request
- 전자어음발행(반려/취소) — rejection / cancellation
- 전자어음신청내역조회 — application history
- 전자어음사고신고/사고서조회 — incident reports
- 전자어음보관계좌조회 — custody account inquiry
- 만기전자지급제시신청 — maturity presentation request

**상생전자지급보증서** (Sangsaeng e-payment guarantee certificates):
- 지급보증서조회
- 지급보증서조회(보증신청)
- 지급보증서조회(보증신청완료)

**Bottom-row groups (partially visible):**
- 협약보증서대출 → 트러스트온(Trust-On)
- 주류구매 → 주류구매전용카드
- 전자결제가이드 → B2B대출

#### Notes on the 통합관리 column

- **약정내역통합조회** lists currently-active loans / guarantees / contracts and which company is using which service. It does **not** show transferred amounts. Useful for inventory of agreements, not for transaction-level data.
- Not all banks offer an equivalent unified view, so this is a Woori-specific convenience rather than a general pattern to design around.

---

## 3. Open design questions (revisit after matrix is filled)

1. **Loans table?** Loan-flavored products (구매자금대출, 어음할인) have interest rate / principal / repayment schedule that don't fit `promissory_notes`. Decide: stuff into `metadata` (Option A) or new `loans` table (Option B).
2. **`product_type` column on `promissory_notes`?** Needed if we keep all note-shaped products in one table (paper bill vs e-bill vs B2B receivable vs sangsaeng).
3. **Sync UX:** one "sync everything" button per bank, or per-product picker?
4. **Status enum gaps:** current enum is `active|collected|dishonored|cancelled|endorsed|discounted`. Some products may need additional states (e.g., 만기연장, 분할배서, 분할할인) — decide whether to extend the enum or push into metadata.
5. **Account linkage:** today the importer assigns `account_id = first IBK active account`. With multi-product, multi-bank, we need a deterministic rule (per-product default account? per-row from the Excel's `입금계좌번호`?).

---

## 4. Naming convention (table & column)

**Tables: `{bank_id}_{product_slug}`** — `bank_id` matches the existing automator id (`ibk`, `woori`, `shinhan`, `kookmin`, `hana`, `nh`); `product_slug` is a descriptive English noun phrase in `snake_case`. Examples:

| Korean product name | Table slug |
|---|---|
| 외상매출채권 (B2B receivable) | `ibk_b2b_receivables` |
| 받음전자어음 | `woori_received_ebills` |
| 지급전자어음 | `woori_payable_ebills` |
| 할인어음 (bill discount) | `woori_discounted_bills` |
| 자기앞수표 | `woori_cashier_checks` |
| 보증전자어음 | `woori_guaranteed_ebills` |
| 구매자금대출 | `{bank}_purchase_loans` |
| 상생결제 | `{bank}_sangsaeng_payments` |
| 매출채권매입 (factoring) | `{bank}_factoring` |

**Columns: `snake_case` English** mapping meaning, not transliteration.

- Dates: `_date` suffix (`maturity_date`, `registered_date`)
- Amounts (KRW won): `_amount` suffix, stored as `INTEGER`
- Y/N flags from the Excel: keep the bank's raw `Y`/`N`/`예`/`아니오` text in the column; don't pre-translate
- `status`, `kind`, `category`-type free-text fields: store the Korean text as-is. Do not map to a global enum (each bank has its own lifecycle)

**Standard columns every (bank, product) table has:**

- `id TEXT PRIMARY KEY` — generated, stable across re-syncs
- `synced_at TEXT NOT NULL DEFAULT (datetime('now'))` — when this row was last refreshed
- `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
- `updated_at TEXT NOT NULL DEFAULT (datetime('now'))` — bumped by trigger

No `bank_id` column (implied by table name). No `account_id` (notes are not per-account). No `source_file` (we don't keep the Excel files).

**Reference column mapping for `ibk_b2b_receivables`** (the first table; serves as the template):

| Korean header | Column | Type |
|---|---|---|
| 일련번호 | `serial_number` | TEXT |
| 어음번호 | `note_number` | TEXT (UNIQUE) |
| 구매기업명 | `buyer_name` | TEXT |
| 종류 | `kind` | TEXT |
| 상태 | `status` | TEXT (raw Korean) |
| 취소신청여부 | `cancellation_requested` | TEXT (Y/N) |
| 현금성여부 | `cash_equivalent` | TEXT (Y/N) |
| 채권금액 | `receivable_amount` | INTEGER |
| 채권등록일 | `registered_date` | TEXT (YYYY-MM-DD) |
| 채권만기일 | `maturity_date` | TEXT |
| 대출가능일 | `loan_available_date` | TEXT |
| 대출실행여부 | `loan_executed` | TEXT (Y/N) |
| 대출금액 | `loan_amount` | INTEGER |
| 세금발급일 | `tax_issued_date` | TEXT |
| 입금계좌번호 | `deposit_account_number` | TEXT |
| 결제일자 | `payment_date` | TEXT |
| 압류금액 | `seizure_amount` | INTEGER |
| 최초어음금액 | `original_note_amount` | INTEGER |
| 압류권자 | `seizure_claimant` | TEXT |
| 구매자사업자번호 | `buyer_biz_no` | TEXT |
| 지급사업장 | `payment_branch` | TEXT |

---

## 5. Conventions for filling this in

- **Menu path:** write the user-visible breadcrumb (`판매기업 → 외상매출채권 → 채권조회`). If you know the DOM hook (an `efncmenuid`, a CSS id, a frame name), include it in parentheses.
- **Excel header row:** 1-based row number where column titles live. Mention if the Excel ships as `.xls` (HTML-table-as-xls is common — Woori does this) vs real `.xlsx`.
- **Notes:** anything that varies from the IBK pattern (date-range constraints, popup quirks, multi-step wizards, captcha, etc.).
- **Status:** prefer `done` / `menu` / `?` / `n/a` / `skip` — keeps the matrix scannable.
