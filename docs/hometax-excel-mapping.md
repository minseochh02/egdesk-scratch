# Hometax Excel Mapping Reference

Canonical mapping rules for **국세청 홈택스** Excel imports — Playwright automation downloads and manual upload. Parsers live in `src/main/hometax-excel-parser.ts`; DB upsert in `src/main/sqlite/hometax.ts`. Browser automation in `src/main/hometax-automation.ts`.

---

## Automations overview

Hometax automation uses Playwright (Chrome persistent context) with **공인인증서** login. Downloads land in `~/Downloads/EGDesk-Hometax/`.

```
Certificate login → menu navigation → set year/month & 매출/매입 → Excel download
  → parseHometaxExcel | parseTaxExemptExcel | parseCashReceiptExcel
  → importTaxInvoices | importTaxExemptInvoices | importCashReceipts
```

**Entry points**

| Layer | Role |
|---|---|
| `hometax-automation.ts` | Login, navigate, download Excel (and scrape tax bills as HTML) |
| `hometax-excel-parser.ts` | Parse downloaded `.xls` / `.xlsx` |
| `storage.ts` / IPC | `hometax:import-excel`, `hometax:collect-invoices`, `hometax:collect-bills` |
| `FinanceHubScheduler.ts` | `syncTax()` — current + last month collection per saved certificate |

**Portal:** `https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=index3`

**Auth:** `#mf_txppWframe_loginboxFrame_anchor22` → cert popup → `#dscert` iframe password → submit.

---

### Automation jobs summary

| Job | Function | Menu path | Parser | DB table | Download pattern |
|---|---|---|---|---|---|
| 세금계산서 매출 | `connectToHometax(..., 'sales', 'tax')` | 조회 → 월/분기별 목록조회 (`#grpMenuAtag_46_4609050300`) | `parseHometaxExcel` | `tax_invoices` | Filename contains `매출` |
| 세금계산서 매입 | `connectToHometax(..., 'purchase', 'tax')` | same | same | same | Filename contains `매입` |
| 전자계산서 매출 | `connectToHometax(..., 'sales', 'tax-exempt')` | same + radio `tax-exempt` | `parseTaxExemptExcel` | `tax_exempt_invoices` | `매출` + renamed `tax-exempt` |
| 전자계산서 매입 | `connectToHometax(..., 'purchase', 'tax-exempt')` | same | same | same | `매입` + `tax-exempt` |
| 현금영수증 | `downloadCashReceipts()` | 가맹점 매출 조회 → 현금영수증 매출내역 조회 → **주별** tab | `parseCashReceiptExcel` | `cash_receipts` | Filename contains `매출내역` |
| 납부고지서 | `downloadTaxBills()` | 납부·고지·환급 → 고지내역 | *(HTML scrape, not Excel)* | `tax_documents` | `TaxBill_*.html` |

**Batch collector:** `collectTaxInvoicesInRange(cert, password, startYear, startMonth, endYear, endMonth)` loops every month × `{sales, purchase}` × `{tax, tax-exempt}`, then optionally cash receipts when range includes current month.

**Default sync:** `collectTaxInvoices()` = **last month + current month** for all four invoice types + cash receipt.

**Saved filename pattern (invoices):** `{originalBase}_{YYYYMM}_{sales|purchase}_{tax|tax-exempt}_{timestamp}.xls(x)`

**Saved filename pattern (cash receipt):** `{originalBase}_cash_receipt_{timestamp}.xls(x)`

**Dialog handling:** `"조회된 내역이 없습니다"` sets `noDataDetected` — download skipped gracefully.

---

### Navigation details

#### Electronic tax invoice / e-invoice list (`navigateToInvoicePage`)

1. `#mf_wfHeader_wq_uuid_358` (전체메뉴)
2. 조회 → `#grpMenuLi_46_4609050000`
3. 월/분기별 목록조회 → `#grpMenuAtag_46_4609050300`

On inquiry page per download:

- **Category:** `mf_txppWframe_wf01_radioEtxivClsfCd` — index `0` = 세금계산서, `1` = 전자계산서 (면세)
- **Type:** `#mf_txppWframe_radio3` — index `0` = 매출, `1` = 매입
- **Year/month:** XPath selects under `dl[2]/dd/div/select[2]` (year) and `select[3]` (month)
- **Search:** XPath span under `div[4]/div/span`
- **Excel:** category-specific download button → confirm dialogs (`div[last()]/div[2]/div[1]/div/...`)

#### Cash receipts (`downloadCashReceipts`)

1. 전체메뉴 → `#grpMenuLi_46_4606010000` (가맹점 매출 조회)
2. `#grpMenuAtag_46_4606010100` (현금영수증 매출내역 조회)
3. Tab `#mf_txppWframe_tabControl1_UTECRCB057_tab_tabs2_tabHTML` (주별)
4. 조회 → 내려받기 → confirm

#### Tax bills (`downloadTaxBills`) — not Excel

1. 홈 → 전체메뉴 → **납부·고지·환급** → `#grpMenuAtag_42_4204040000` (고지내역)
2. Date range: `#mf_txppWframe_idx_strtDt_input`, `#mf_txppWframe_idx_endDt_input` (`YYYY.MM.DD`)
3. Scrape `div.notice_view` cards → **열람하기** opens report → save `.report_paint_div` HTML
4. Import via `parseTaxBillData` → `importTaxBillData` (`sqlite/tax-bills.ts`)

---

## Manual import (`hometax:import-excel`)

| `kind` | Parser | `invoice_type` / notes |
|---|---|---|
| `sales` | `parseHometaxExcel` | `sales` — type from UI, not filename |
| `purchase` | `parseHometaxExcel` | `purchase` |
| `tax-exempt-sales` | `parseTaxExemptExcel` | `sales` |
| `tax-exempt-purchase` | `parseTaxExemptExcel` | `purchase` |
| `cash-receipt` | `parseCashReceiptExcel` | **`businessNumber` required** from UI (not in Excel) |

Dedup keys:

- `tax_invoices`, `tax_exempt_invoices`: `UNIQUE(business_number, 승인번호)`
- `cash_receipts`: `UNIQUE(business_number, 승인번호, 매출일시)`

---

## Shared Excel layout — 세금계산서 (`parseHometaxExcel`)

Hometax export uses **fixed row positions** (0-based indices in code):

| Row (1-based) | Index | Content |
|---|---|---|
| 1 | 0 | Business metadata (see below) |
| 2 | 1 | *(often empty / label row)* |
| 3 | 2 | Period totals (see below) |
| 4–5 | 3–4 | *(padding)* |
| 6 | 5 | Column headers |
| 7+ | 6+ | Transaction rows (min 33 columns) |

**Row 1 metadata (index 0)**

| Col index | Field |
|---|---|
| 1 | `businessNumber` (사업자등록번호) |
| 3 | `businessName` (상호) |
| 5 | `representativeName` (대표자명) |

**Row 3 totals (index 2)**

| Col index | Field |
|---|---|
| 1 | 합계금액 (total) |
| 3 | 공급가액 합계 |
| 5 | 세액 합계 |

**Type detection:** filename contains `매출` → `sales`, `매입` → `purchase` (automation only; manual import uses `kind`).

### Column mapping — 세금계산서 (33 columns, index 0–32)

| Col | Source (Excel) | DB column |
|---|---|---|
| 0 | 작성일자 | `작성일자` |
| 1 | 승인번호 | `승인번호` |
| 2 | 발급일자 | `발급일자` |
| 3 | 전송일자 | `전송일자` |
| 4 | 공급자사업자등록번호 | `공급자사업자등록번호` |
| 5 | 공급자종사업장번호 | `공급자종사업장번호` |
| 6 | 공급자상호 | `공급자상호` |
| 7 | 공급자대표자명 | `공급자대표자명` |
| 8 | 공급자주소 | `공급자주소` |
| 9 | 공급받는자사업자등록번호 | `공급받는자사업자등록번호` |
| 10 | 공급받는자종사업장번호 | `공급받는자종사업장번호` |
| 11 | 공급받는자상호 | `공급받는자상호` |
| 12 | 공급받는자대표자명 | `공급받는자대표자명` |
| 13 | 공급받는자주소 | `공급받는자주소` |
| 14 | 합계금액 | `합계금액` |
| 15 | 공급가액 | `공급가액` |
| 16 | 세액 | `세액` |
| 17 | 전자세금계산서분류 | `전자세금계산서분류` |
| 18 | 전자세금계산서종류 | `전자세금계산서종류` |
| 19 | 발급유형 | `발급유형` |
| 20 | 비고 | `비고` |
| 21 | 영수청구구분 | `영수청구구분` |
| 22 | 공급자이메일 | `공급자이메일` |
| 23 | 공급받는자이메일1 | `공급받는자이메일1` |
| 24 | 공급받는자이메일2 | `공급받는자이메일2` |
| 25 | 품목일자 | `품목일자` |
| 26 | 품목명 | `품목명` |
| 27 | 품목규격 | `품목규격` |
| 28 | 품목수량 | `품목수량` |
| 29 | 품목단가 | `품목단가` |
| 30 | 품목공급가액 | `품목공급가액` |
| 31 | 품목세액 | `품목세액` |
| 32 | 품목비고 | `품목비고` |

**DB:** `tax_invoices` + `invoice_type` (`sales` | `purchase`) + `business_number` + `excel_file_path`.

Numeric fields: commas stripped via `parseInt`.

---

## 전자계산서 / 면세 (`parseTaxExemptExcel`)

Same top layout as 세금계산서 (rows 0–2 metadata/totals). **31 data columns** (indices 0–30); `세액` and `품목세액` are stored as **0**.

**Header row:** auto-detect first row where col0 = `작성일자` and col1 = `승인번호`; fallback index **5** (1-based row **6**). Data starts at `headerRowIndex + 1` (minimum index 6).

| Col | Source (Excel) | DB column | Notes |
|---|---|---|---|
| 0–13 | *(same as tax invoice)* | supplier / buyer fields | |
| 14 | 합계금액 | `합계금액` | |
| 15 | 공급가액 | `공급가액` | |
| 16 | *(n/a)* | `세액` | forced `0` |
| 17–23 | classification, emails | same names | |
| 24–28 | 품목일자 … 품목단가 | same names | |
| 29 | 품목공급가액 | `품목공급가액` | |
| 30 | 품목비고 | `품목비고` | no separate 품목세액 column |

Rows without `승인번호` are skipped. **DB:** `tax_exempt_invoices`.

---

## 현금영수증 (`parseCashReceiptExcel`)

Simpler layout — **header row 1** (index 0), data from row 2 (index 1).

| Col | Source (Excel) | DB column |
|---|---|---|
| 0 | 발행구분 | `발행구분` |
| 1 | 매출일시 | `매출일시` |
| 2 | 공급가액 | `공급가액` |
| 3 | 부가세 | `부가세` |
| 4 | 봉사료 | `봉사료` |
| 5 | 총금액 | `총금액` |
| 6 | 승인번호 | `승인번호` |
| 7 | 신분확인뒷4자리 | `신분확인뒷4자리` |
| 8 | 거래구분 | `거래구분` |
| 9 | 용도구분 | `용도구분` |
| 10 | 비고 | `비고` |

**No business metadata row** — `business_number` must be supplied at import time (connected business in UI or scheduler certificate context).

**DB:** `cash_receipts`.

---

## Scheduler flow (`FinanceHubScheduler.syncTax`)

For each saved certificate (keyed by business display name):

1. `collectTaxInvoices(cert, password, keepAlive: true)` — downloads up to 8 Excel files + optional cash receipt
2. Parse & import:
   - `thisMonthSalesFile`, `lastMonthSalesFile` → `importTaxInvoices(..., 'sales')`
   - `thisMonthPurchaseFile`, `lastMonthPurchaseFile` → `importTaxInvoices(..., 'purchase')`
   - `thisMonthTaxExempt*`, `lastMonthTaxExempt*` → `importTaxExemptInvoices`
   - `cashReceiptFile` → `importCashReceipts` (requires `businessNumber` from parser — **note:** cash receipt parser does not extract BN; scheduler path should pass cert business number)
3. `downloadTaxBills(lastMonth..thisMonth)` → `importTaxBillData`

---

## Related tables (non-Excel)

| Table | Source |
|---|---|
| `hometax_connections` | Connection metadata, spreadsheet URLs, counts |
| `hometax_sync_operations` | Sync audit log |
| `tax_entities`, `tax_items`, `tax_documents`, `tax_payments` | Scraped **고지서** HTML |

---

## Source files

| File | Purpose |
|---|---|
| `src/main/hometax-excel-parser.ts` | Excel parsers + `TaxInvoiceData` types |
| `src/main/hometax-automation.ts` | Playwright login, download, collect orchestration |
| `src/main/sqlite/hometax.ts` | `importTaxInvoices`, `importTaxExemptInvoices`, `importCashReceipts` |
| `src/main/sqlite/tax-bills.ts` | Tax bill HTML import |
| `src/main/sqlite/migrations/002-hometax-schema.ts` | `tax_invoices` schema |
| `src/main/sqlite/migrations/005-cash-receipts-schema.ts` | `cash_receipts` |
| `src/main/sqlite/migrations/024-tax-exempt-invoices-schema.ts` | `tax_exempt_invoices` |
| `src/main/storage.ts` | IPC handlers for collect / import |
| `src/main/financehub/scheduler/FinanceHubScheduler.ts` | Scheduled Hometax sync |

See also: [bank-excel-mapping.md](./bank-excel-mapping.md), [card-excel-mapping.md](./card-excel-mapping.md).
