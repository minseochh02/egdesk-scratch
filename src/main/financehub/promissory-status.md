# Promissory Note (어음) Automation Status & Roadmap

This document summarizes the current state of promissory note and B2B credit product automation within FinanceHub.

## 1. Currently Implemented (`done`)

### IBK Industrial Bank (IBK 기업은행)
*   **Product 1**: 외상매출채권 (B2B e-receivable, seller side)
    *   **Status**: Fully automated (Integrated into `syncPromissoryNotes`).
    *   **Navigation**: `B2B > 판매기업 > 외상매출채권 > 채권조회/취소신청`
    *   **Flow**: Login (Corporate Cert) → Navigation → Date Range Selection → Excel Download → SQLite Import.
    *   **Database Table**: `ibk_b2b_receivables`.
    *   **Details**: Captures 21 columns, including metadata for loan-availability (`대출가능일`, `대출실행여부`).
*   **Product 2**: 대출거래내역 (Loan Transactions)
    *   **Status**: Fully automated (Integrated into main Bank Sync flow).
    *   **Navigation**: `뱅킹업무 > 대출 > 대출조회 > 거래내역조회`
    *   **Flow**: Main Bank Sync → Navigation → Account Iteration → Excel Download → SQLite Import.
    *   **Database Table**: `ibk_loan_history`.
    *   **Details**: Per-account transaction ledger capturing principal, interest, and running balance.
*   **Product 3**: 배서내역조회 (Endorsements)
    *   **Status**: Fully automated (Integrated into main Bank Sync flow).
    *   **Navigation**: `B2B > 전자어음 > 조회 > 배서내역조회`
    *   **Database Table**: `ibk_endorsements`.

### Woori Bank (우리은행)
*   **B2B대출(협력) 실행내역**:
    *   **Navigation**: `전자결제 > B2B 대출(협력) > 대출신청 > 실행내역`
    *   **Status**: Scaffolded. Requires implementation of the side-by-side calendar date-picker logic.
*   **받음전자어음 (Received e-bills)**: Menu path identified. Needs mapping to a new `woori_received_ebills` table.
*   **수표어음신청조회**: Path identified; covers issued checks and bill applications.
*   **할인어음 (Bill Discount)**: Path identified; loan-shaped product.
*   **자기앞수표조회 (Cashier's Checks)**: Path identified.

### Hana Bank (하나은행)
*   **거래내역/대출계산서 조회**:
    *   **Navigation**: `상품가입•대출 > 대출조회 > 거래내역/대출계산서 조회`
    *   **Status**: Path identified. Needs automator implementation and parser.

---

## 3. Requiring Research & New Creation

These categories exist across most major banks but require initial research, DOM mapping, and schema definitions.

### Major Banks (Shinhan, KB, NH)
*   **전자어음 — 수취/발행 (e-bills)**: Primary target for expanding note automation.
*   **외상매출채권담보대출 (Receivable-backed loans)**: Needs a first-class `loans` table or dedicated schema beyond simple metadata.
*   **상생결제 (Sangsaeng)**: Large-buyer credit products.
*   **매출채권매입 / 팩토링 (Factoring)**: Common corporate product requiring new Excel parsers.
*   **종이어음 (Legacy paper bills)**: Low priority but still relevant for specific sectors.

---

## 4. Technical Infrastructure Status

### Scheduler (`FinanceHubScheduler.ts`)
*   **Current State**: The `syncPromissoryNotes` method is currently hardcoded to only handle IBK Excel files.
*   **Required Change**: Refactor the import logic to use a factory pattern or switch statement that routes the downloaded file to the correct bank/product importer based on the `bankId`.

### Base Classes
*   **Popup Handling**: Improved in `IbkBankAutomator.js` with `_robustCleanupIbkPopups()` to handle asynchronous modal overlays.
*   **Arduino Detection**: Now unified across all scheduled runs (Banks, Cards, Promissory) using `resolveArduinoPortForBankSync()`.
