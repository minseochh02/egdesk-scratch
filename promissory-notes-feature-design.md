# Promissory Notes (어음) Feature Design

## Overview

This document outlines the design and implementation plan for adding promissory note (어음) functionality to the FinanceHub system. Promissory notes are a critical financial instrument in Korean business practices, and this feature will enable comprehensive tracking and management of both issued and received notes.

## Table of Contents

1. [Database Schema](#database-schema)
2. [TypeScript Interfaces](#typescript-interfaces)
3. [Database Manager Integration](#database-manager-integration)
4. [Migration Strategy](#migration-strategy)
5. [Bank Automator Integration](#bank-automator-integration)
6. [UI Components](#ui-components)
7. [Key Features](#key-features)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Considerations](#considerations)
10. [Implementation status](#implementation-status)

---

## Database Schema

### Promissory Notes Table

```sql
CREATE TABLE promissory_notes (
  -- Primary identification
  id TEXT PRIMARY KEY,

  -- Account association
  account_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,

  -- Note basic information
  note_number TEXT NOT NULL,              -- 어음번호
  note_type TEXT NOT NULL,                -- 'issued' or 'received'

  -- Parties involved
  issuer_name TEXT NOT NULL,              -- 발행인
  issuer_registration_number TEXT,        -- 발행인 사업자등록번호
  payee_name TEXT NOT NULL,               -- 수취인
  payee_registration_number TEXT,         -- 수취인 사업자등록번호

  -- Financial details
  amount INTEGER NOT NULL,                -- 금액 (in KRW, stored as integer)
  currency TEXT DEFAULT 'KRW',

  -- Dates
  issue_date TEXT NOT NULL,               -- 발행일
  maturity_date TEXT NOT NULL,            -- 만기일
  collection_date TEXT,                   -- 추심일 (actual collection date)

  -- Status and lifecycle
  status TEXT NOT NULL,                   -- 'active', 'collected', 'dishonored', 'cancelled', 'endorsed', 'discounted'

  -- Additional transaction details
  endorsement_info TEXT,                  -- 배서 정보 (JSON)
  discount_info TEXT,                     -- 할인 정보 (JSON: bank, date, discount_amount, net_amount)

  -- Bank processing
  processing_bank TEXT,                   -- 추심은행
  bank_branch TEXT,                       -- 지점

  -- Categorization and notes
  category TEXT,                          -- User-defined category
  memo TEXT,                              -- User notes
  is_manual INTEGER DEFAULT 0,            -- Manual entry vs automated

  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT,                          -- JSON for extensibility

  -- Foreign keys
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (bank_id) REFERENCES banks(id),

  -- Indexes
  UNIQUE(note_number, bank_id)
);

-- Indexes for efficient querying
CREATE INDEX idx_promissory_notes_account ON promissory_notes(account_id);
CREATE INDEX idx_promissory_notes_bank ON promissory_notes(bank_id);
CREATE INDEX idx_promissory_notes_maturity ON promissory_notes(maturity_date);
CREATE INDEX idx_promissory_notes_status ON promissory_notes(status);
CREATE INDEX idx_promissory_notes_type ON promissory_notes(note_type);
CREATE INDEX idx_promissory_notes_dates ON promissory_notes(issue_date, maturity_date);
```

### Note Status Lifecycle

- **active**: Note is currently active and awaiting maturity
- **collected**: Note has been successfully collected at maturity
- **dishonored**: Note was dishonored (payment failed)
- **cancelled**: Note was cancelled before maturity
- **endorsed**: Note has been endorsed to another party
- **discounted**: Note has been discounted at a bank

---

## TypeScript Interfaces

### Core Interfaces

```typescript
// src/main/sqlite/financehub.ts

interface PromissoryNote {
  id: string;
  accountId: string;
  bankId: string;

  // Note information
  noteNumber: string;
  noteType: 'issued' | 'received';

  // Parties
  issuerName: string;
  issuerRegistrationNumber?: string;
  payeeName: string;
  payeeRegistrationNumber?: string;

  // Financial
  amount: number;
  currency: string;

  // Dates
  issueDate: string;  // ISO format YYYY-MM-DD
  maturityDate: string;
  collectionDate?: string;

  // Status
  status: 'active' | 'collected' | 'dishonored' | 'cancelled' | 'endorsed' | 'discounted';

  // Additional info
  endorsementInfo?: EndorsementInfo[];
  discountInfo?: DiscountInfo;
  processingBank?: string;
  bankBranch?: string;
  category?: string;
  memo?: string;
  isManual: boolean;

  // Metadata
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

interface EndorsementInfo {
  endorser: string;
  endorsee: string;
  endorsementDate: string;
  registrationNumber?: string;
}

interface DiscountInfo {
  bank: string;
  discountDate: string;
  discountAmount: number;     // 할인료
  netAmount: number;          // 실수령액
  discountRate?: number;      // 할인율 (%)
}

interface PromissoryNoteQueryOptions {
  accountId?: string;
  bankId?: string;
  noteType?: 'issued' | 'received';
  status?: string;
  startDate?: string;
  endDate?: string;
  includeMatured?: boolean;
  sortBy?: 'maturityDate' | 'issueDate' | 'amount';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface PromissoryNoteSummary {
  totalIssued: number;
  totalReceived: number;
  activeIssued: number;
  activeReceived: number;
  maturingThisMonth: number;
  overdueNotes: number;
  totalAmount: {
    issued: number;
    received: number;
    active: number;
  };
}
```

---

## Database Manager Integration

### New Methods for FinanceHubDbManager

Add these methods to the `FinanceHubDbManager` class in `src/main/sqlite/financehub.ts`:

```typescript
// Promissory Note CRUD Operations

/**
 * Insert or update a promissory note
 */
upsertPromissoryNote(data: Partial<PromissoryNote>): PromissoryNote {
  const now = new Date().toISOString();
  const id = data.id || generateId();

  const note: PromissoryNote = {
    id,
    accountId: data.accountId!,
    bankId: data.bankId!,
    noteNumber: data.noteNumber!,
    noteType: data.noteType!,
    issuerName: data.issuerName!,
    issuerRegistrationNumber: data.issuerRegistrationNumber,
    payeeName: data.payeeName!,
    payeeRegistrationNumber: data.payeeRegistrationNumber,
    amount: data.amount!,
    currency: data.currency || 'KRW',
    issueDate: data.issueDate!,
    maturityDate: data.maturityDate!,
    collectionDate: data.collectionDate,
    status: data.status || 'active',
    endorsementInfo: data.endorsementInfo,
    discountInfo: data.discountInfo,
    processingBank: data.processingBank,
    bankBranch: data.bankBranch,
    category: data.category,
    memo: data.memo,
    isManual: data.isManual ?? false,
    createdAt: data.createdAt || now,
    updatedAt: now,
    metadata: data.metadata
  };

  const stmt = this.db.prepare(`
    INSERT INTO promissory_notes (
      id, account_id, bank_id, note_number, note_type,
      issuer_name, issuer_registration_number,
      payee_name, payee_registration_number,
      amount, currency, issue_date, maturity_date, collection_date,
      status, endorsement_info, discount_info,
      processing_bank, bank_branch, category, memo,
      is_manual, created_at, updated_at, metadata
    ) VALUES (
      @id, @accountId, @bankId, @noteNumber, @noteType,
      @issuerName, @issuerRegistrationNumber,
      @payeeName, @payeeRegistrationNumber,
      @amount, @currency, @issueDate, @maturityDate, @collectionDate,
      @status, @endorsementInfo, @discountInfo,
      @processingBank, @bankBranch, @category, @memo,
      @isManual, @createdAt, @updatedAt, @metadata
    )
    ON CONFLICT(note_number, bank_id) DO UPDATE SET
      account_id = @accountId,
      note_type = @noteType,
      issuer_name = @issuerName,
      issuer_registration_number = @issuerRegistrationNumber,
      payee_name = @payeeName,
      payee_registration_number = @payeeRegistrationNumber,
      amount = @amount,
      currency = @currency,
      issue_date = @issueDate,
      maturity_date = @maturityDate,
      collection_date = @collectionDate,
      status = @status,
      endorsement_info = @endorsementInfo,
      discount_info = @discountInfo,
      processing_bank = @processingBank,
      bank_branch = @bankBranch,
      category = @category,
      memo = @memo,
      updated_at = @updatedAt,
      metadata = @metadata
  `);

  stmt.run({
    ...note,
    endorsementInfo: note.endorsementInfo ? JSON.stringify(note.endorsementInfo) : null,
    discountInfo: note.discountInfo ? JSON.stringify(note.discountInfo) : null,
    metadata: note.metadata ? JSON.stringify(note.metadata) : null,
    isManual: note.isManual ? 1 : 0
  });

  return note;
}

/**
 * Get a single promissory note by ID
 */
getPromissoryNote(id: string): PromissoryNote | null {
  const stmt = this.db.prepare('SELECT * FROM promissory_notes WHERE id = ?');
  const row = stmt.get(id);
  return row ? this.parsePromissoryNote(row) : null;
}

/**
 * Query promissory notes with filters
 */
queryPromissoryNotes(options: PromissoryNoteQueryOptions = {}): PromissoryNote[] {
  let query = 'SELECT * FROM promissory_notes WHERE 1=1';
  const params: any = {};

  if (options.accountId) {
    query += ' AND account_id = @accountId';
    params.accountId = options.accountId;
  }

  if (options.bankId) {
    query += ' AND bank_id = @bankId';
    params.bankId = options.bankId;
  }

  if (options.noteType) {
    query += ' AND note_type = @noteType';
    params.noteType = options.noteType;
  }

  if (options.status) {
    query += ' AND status = @status';
    params.status = options.status;
  }

  if (options.startDate) {
    query += ' AND maturity_date >= @startDate';
    params.startDate = options.startDate;
  }

  if (options.endDate) {
    query += ' AND maturity_date <= @endDate';
    params.endDate = options.endDate;
  }

  // Sorting
  const sortBy = options.sortBy || 'maturityDate';
  const sortOrder = options.sortOrder || 'asc';
  query += ` ORDER BY ${sortBy} ${sortOrder}`;

  // Pagination
  if (options.limit) {
    query += ' LIMIT @limit';
    params.limit = options.limit;
  }

  if (options.offset) {
    query += ' OFFSET @offset';
    params.offset = options.offset;
  }

  const stmt = this.db.prepare(query);
  const rows = stmt.all(params);
  return rows.map(row => this.parsePromissoryNote(row));
}

/**
 * Get promissory notes maturing soon (within specified days)
 */
getMaturingNotes(days: number = 30): PromissoryNote[] {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  return this.queryPromissoryNotes({
    startDate: today,
    endDate: futureDateStr,
    status: 'active',
    sortBy: 'maturityDate',
    sortOrder: 'asc'
  });
}

/**
 * Get overdue promissory notes
 */
getOverdueNotes(): PromissoryNote[] {
  const today = new Date().toISOString().split('T')[0];
  const stmt = this.db.prepare(`
    SELECT * FROM promissory_notes
    WHERE status = 'active'
    AND maturity_date < ?
    ORDER BY maturity_date ASC
  `);

  const rows = stmt.all(today);
  return rows.map(row => this.parsePromissoryNote(row));
}

/**
 * Update promissory note status
 */
updatePromissoryNoteStatus(
  id: string,
  status: PromissoryNote['status'],
  additionalData?: { collectionDate?: string; memo?: string }
): boolean {
  const updates: string[] = ['status = @status', 'updated_at = @updatedAt'];
  const params: any = {
    id,
    status,
    updatedAt: new Date().toISOString()
  };

  if (additionalData?.collectionDate) {
    updates.push('collection_date = @collectionDate');
    params.collectionDate = additionalData.collectionDate;
  }

  if (additionalData?.memo) {
    updates.push('memo = @memo');
    params.memo = additionalData.memo;
  }

  const stmt = this.db.prepare(`
    UPDATE promissory_notes
    SET ${updates.join(', ')}
    WHERE id = @id
  `);

  const result = stmt.run(params);
  return result.changes > 0;
}

/**
 * Get promissory note summary statistics
 */
getPromissoryNoteSummary(accountId?: string): PromissoryNoteSummary {
  const baseQuery = accountId
    ? 'WHERE account_id = ?'
    : 'WHERE 1=1';

  const params = accountId ? [accountId] : [];

  const summary = this.db.prepare(`
    SELECT
      COUNT(CASE WHEN note_type = 'issued' THEN 1 END) as totalIssued,
      COUNT(CASE WHEN note_type = 'received' THEN 1 END) as totalReceived,
      COUNT(CASE WHEN note_type = 'issued' AND status = 'active' THEN 1 END) as activeIssued,
      COUNT(CASE WHEN note_type = 'received' AND status = 'active' THEN 1 END) as activeReceived,
      SUM(CASE WHEN note_type = 'issued' THEN amount ELSE 0 END) as totalIssuedAmount,
      SUM(CASE WHEN note_type = 'received' THEN amount ELSE 0 END) as totalReceivedAmount,
      SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as totalActiveAmount
    FROM promissory_notes ${baseQuery}
  `).get(...params);

  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthStr = nextMonth.toISOString().split('T')[0];

  const maturingThisMonth = this.db.prepare(`
    SELECT COUNT(*) as count
    FROM promissory_notes
    ${baseQuery}
    AND status = 'active'
    AND maturity_date >= ?
    AND maturity_date < ?
  `).get(...params, today, nextMonthStr);

  const overdueNotes = this.db.prepare(`
    SELECT COUNT(*) as count
    FROM promissory_notes
    ${baseQuery}
    AND status = 'active'
    AND maturity_date < ?
  `).get(...params, today);

  return {
    totalIssued: summary.totalIssued || 0,
    totalReceived: summary.totalReceived || 0,
    activeIssued: summary.activeIssued || 0,
    activeReceived: summary.activeReceived || 0,
    maturingThisMonth: maturingThisMonth.count || 0,
    overdueNotes: overdueNotes.count || 0,
    totalAmount: {
      issued: summary.totalIssuedAmount || 0,
      received: summary.totalReceivedAmount || 0,
      active: summary.totalActiveAmount || 0
    }
  };
}

/**
 * Bulk insert promissory notes (for bank automation)
 */
bulkInsertPromissoryNotes(
  accountId: string,
  bankId: string,
  notes: Partial<PromissoryNote>[]
): { inserted: number; updated: number; skipped: number } {
  const results = { inserted: 0, updated: 0, skipped: 0 };

  const insertStmt = this.db.prepare(`
    INSERT INTO promissory_notes (
      id, account_id, bank_id, note_number, note_type,
      issuer_name, issuer_registration_number,
      payee_name, payee_registration_number,
      amount, currency, issue_date, maturity_date,
      status, processing_bank, bank_branch,
      is_manual, created_at, updated_at
    ) VALUES (
      @id, @accountId, @bankId, @noteNumber, @noteType,
      @issuerName, @issuerRegistrationNumber,
      @payeeName, @payeeRegistrationNumber,
      @amount, @currency, @issueDate, @maturityDate,
      @status, @processingBank, @bankBranch,
      0, @createdAt, @updatedAt
    )
    ON CONFLICT(note_number, bank_id) DO UPDATE SET
      account_id = @accountId,
      amount = @amount,
      status = @status,
      processing_bank = @processingBank,
      updated_at = @updatedAt
  `);

  for (const noteData of notes) {
    try {
      const now = new Date().toISOString();
      const id = noteData.id || generateId();

      const result = insertStmt.run({
        id,
        accountId,
        bankId,
        noteNumber: noteData.noteNumber,
        noteType: noteData.noteType,
        issuerName: noteData.issuerName,
        issuerRegistrationNumber: noteData.issuerRegistrationNumber || null,
        payeeName: noteData.payeeName,
        payeeRegistrationNumber: noteData.payeeRegistrationNumber || null,
        amount: noteData.amount,
        currency: noteData.currency || 'KRW',
        issueDate: noteData.issueDate,
        maturityDate: noteData.maturityDate,
        status: noteData.status || 'active',
        processingBank: noteData.processingBank || null,
        bankBranch: noteData.bankBranch || null,
        createdAt: now,
        updatedAt: now
      });

      if (result.changes > 0) {
        // Check if it was an insert or update
        const existing = this.db.prepare(
          'SELECT id FROM promissory_notes WHERE note_number = ? AND bank_id = ?'
        ).get(noteData.noteNumber, bankId);

        if (existing && existing.id !== id) {
          results.updated++;
        } else {
          results.inserted++;
        }
      }
    } catch (error) {
      console.error('Failed to insert promissory note:', error);
      results.skipped++;
    }
  }

  return results;
}

/**
 * Parse database row to PromissoryNote object
 */
private parsePromissoryNote(row: any): PromissoryNote {
  return {
    id: row.id,
    accountId: row.account_id,
    bankId: row.bank_id,
    noteNumber: row.note_number,
    noteType: row.note_type,
    issuerName: row.issuer_name,
    issuerRegistrationNumber: row.issuer_registration_number,
    payeeName: row.payee_name,
    payeeRegistrationNumber: row.payee_registration_number,
    amount: row.amount,
    currency: row.currency,
    issueDate: row.issue_date,
    maturityDate: row.maturity_date,
    collectionDate: row.collection_date,
    status: row.status,
    endorsementInfo: row.endorsement_info ? JSON.parse(row.endorsement_info) : undefined,
    discountInfo: row.discount_info ? JSON.parse(row.discount_info) : undefined,
    processingBank: row.processing_bank,
    bankBranch: row.bank_branch,
    category: row.category,
    memo: row.memo,
    isManual: row.is_manual === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined
  };
}
```

---

## Migration Strategy

> **Note:** The concrete migration shipped in the app differs slightly from the illustrative SQL at the top of this document (e.g. `CHECK` constraints, `currency` default, trigger for `updated_at`). The source of truth is `src/main/sqlite/migrations/023-create-promissory-notes.ts`.

### Migration file (implemented): `023-create-promissory-notes.ts`

- **Path:** `src/main/sqlite/migrations/023-create-promissory-notes.ts`
- **Export:** `migrate023CreatePromissoryNotes(db: Database.Database)`
- **Behavior:**
  - Idempotent: if `promissory_notes` already exists in `sqlite_master`, the migration logs and returns without altering schema.
  - Creates `promissory_notes` with columns aligned to this design (`note_number` + `bank_id` unique for upserts, FKs to `accounts` with `ON DELETE CASCADE`, FK to `banks`).
  - Creates indexes: `account`, `bank`, `maturity`, `status`, `type`, compound `(issue_date, maturity_date)`.
  - Adds an `AFTER UPDATE` trigger to set `updated_at = datetime('now')`.

### Integration with `init.ts` (implemented)

In `src/main/sqlite/init.ts`, after migration 022 and **only for the dedicated FinanceHub database** (`financeHubDb`), the app runs:

```typescript
try {
  const { migrate023CreatePromissoryNotes } = await import('./migrations/023-create-promissory-notes');
  migrate023CreatePromissoryNotes(financeHubDb);
} catch (migration023Error: unknown) {
  console.error('⚠️ Migration 023 error:', (migration023Error as Error).message);
}
```

Failures are logged; they do not block the rest of SQLite initialization.

---

## Bank Automator Integration

### Extension to Bank Automators

Each bank automator (e.g., `HanaBankAutomator.js`, `ShinhanBankAutomator.js`) should be extended to support promissory note scraping.

**Sync model (implemented in Finance Hub):** Unlike **거래내역** sync, which is driven **per account** (date range: 1일, 1주일, …), **어음** resync is **bank-scoped only**: one action per connected bank, no account picker and no period submenu. The renderer calls IPC with `bankId` only; the main process uses the **active automator session** for that bank. Banks implement an optional method:

```javascript
/**
 * Optional. If present, invoked from IPC `finance-hub:sync-promissory-notes`.
 * Should navigate/scrape bank 어음 screens and persist via FinanceHub DB (upsert).
 * @returns {Promise<{ success: boolean, imported?: number, error?: string }>}
 */
async syncPromissoryNotes() { /* ... */ }
```

If the automator does not define `syncPromissoryNotes`, the main process returns a clear Korean error: the bank’s 어음 automation is not wired yet. If there is **no active browser automator** for that bank (user has not logged in / session expired), the user is prompted to connect or run a normal transaction sync first.

The older **per-account** illustrative API below remains a possible internal shape for scrapers that still need an account context **inside** the automator; the **user-facing** entry point remains bank-only.

#### Illustrative per-account scraping (internal / legacy pattern)

```javascript
class HanaBankAutomator extends BaseBankAutomator {
  // ... existing methods

  /**
   * Fetch promissory notes for an account (example — may be used inside syncPromissoryNotes)
   * @param {string} accountNumber - The account number
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of promissory note data
   */
  async fetchPromissoryNotes(accountNumber, options = {}) {
    console.log('[Hana] Fetching promissory notes for account:', accountNumber);

    try {
      // Navigate to promissory note management page
      await this.navigateToPromissoryNotes();

      // Select account
      await this.selectAccount(accountNumber);

      // Set date range if provided
      if (options.startDate || options.endDate) {
        await this.setDateRange(options.startDate, options.endDate);
      }

      // Scrape promissory note data
      const notes = await this.scrapePromissoryNoteTable();

      // Parse and normalize data
      return notes.map(note => this.parsePromissoryNote(note));

    } catch (error) {
      console.error('[Hana] Error fetching promissory notes:', error);
      throw error;
    }
  }

  /**
   * Parse promissory note from bank-specific format
   */
  parsePromissoryNote(rawData) {
    return {
      noteNumber: rawData.어음번호,
      noteType: rawData.구분 === '발행' ? 'issued' : 'received',
      issuerName: rawData.발행인,
      issuerRegistrationNumber: rawData.발행인사업자번호,
      payeeName: rawData.수취인,
      amount: this.parseAmount(rawData.금액),
      issueDate: this.parseDate(rawData.발행일),
      maturityDate: this.parseDate(rawData.만기일),
      status: this.parseStatus(rawData.상태),
      processingBank: rawData.추심은행,
      bankBranch: rawData.지점
    };
  }

  /**
   * Parse promissory note status from bank format
   */
  parseStatus(bankStatus) {
    const statusMap = {
      '정상': 'active',
      '추심완료': 'collected',
      '부도': 'dishonored',
      '취소': 'cancelled',
      '배서': 'endorsed',
      '할인': 'discounted'
    };
    return statusMap[bankStatus] || 'active';
  }
}
```

### Database Handler Updates

Update `database-transfer-handler.ts` to include promissory notes in export/import:

```typescript
// Add to exportDatabase method
const promissoryNotes = financeDb.prepare(
  'SELECT * FROM promissory_notes ORDER BY maturity_date DESC'
).all();

// Add to import validation
if (data.promissory_notes && Array.isArray(data.promissory_notes)) {
  // Validate promissory note structure
  for (const note of data.promissory_notes) {
    if (!note.noteNumber || !note.amount || !note.maturityDate) {
      throw new Error('Invalid promissory note data structure');
    }
  }
}

// Add to table list
const tables = [
  'banks',
  'accounts',
  'bank_transactions',
  'card_transactions',
  'promissory_notes', // ADD THIS
  'sync_operations',
  'saved_credentials'
];
```

---

## UI Components

### Component Structure

```
src/renderer/components/FinanceHub/
├── PromissoryNotes/
│   ├── PromissoryNotesList.tsx       # Main list view
│   ├── PromissoryNoteDetail.tsx      # Detail/edit view
│   ├── PromissoryNoteForm.tsx        # Add/edit form
│   ├── PromissoryNoteSummary.tsx     # Dashboard summary widget
│   ├── MaturingNoteAlert.tsx         # Alert for maturing notes
│   └── PromissoryNoteFilters.tsx     # Filter controls
```

### Key UI Features

#### 1. **PromissoryNotesList Component**

```tsx
interface PromissoryNotesListProps {
  accountId?: string;
  noteType?: 'issued' | 'received' | 'all';
}

export function PromissoryNotesList({ accountId, noteType = 'all' }: PromissoryNotesListProps) {
  // Features:
  // - Tabular view with sortable columns
  // - Filter by status, date range, note type
  // - Quick status updates (mark as collected, dishonored, etc.)
  // - Visual indicators for overdue notes
  // - Export to CSV/Excel
  // - Bulk actions (bulk status update, bulk categorization)
}
```

#### 2. **PromissoryNoteSummary Component**

```tsx
export function PromissoryNoteSummary() {
  // Dashboard widget showing:
  // - Total issued vs received
  // - Active notes count and amount
  // - Notes maturing this month
  // - Overdue notes alert
  // - Charts: Timeline of maturities, issued vs received breakdown
}
```

#### 3. **MaturingNoteAlert Component**

```tsx
export function MaturingNoteAlert() {
  // Alert banner showing:
  // - Notes maturing in next 7/14/30 days
  // - Overdue notes
  // - Quick actions: mark as collected, view details
}
```

### Integration with Main FinanceHub Component

Update `src/renderer/components/FinanceHub/FinanceHub.tsx`:

```tsx
// Add new tab/section for promissory notes
<Tab label="어음 관리" value="promissory-notes">
  <PromissoryNotesView />
</Tab>

// Add summary widget to dashboard
<DashboardGrid>
  <TransactionSummary />
  <AccountBalances />
  <PromissoryNoteSummary /> {/* NEW */}
  <MaturingNoteAlert />      {/* NEW */}
</DashboardGrid>
```

**Implemented:** The **어음 관리** nav item renders `PromissoryNotesPage`. On the **연결된 계좌** (connected banks) section, each **connected** bank card footer includes a bank-only **어음** control (dropdown) with a single action **어음 재동기화** — see [Implementation status](#implementation-status).

---

## Key Features

### 1. **Automated Scraping**
- Integrate with existing bank automators to fetch promissory note data
- Support for major Korean banks (Hana, Shinhan, Kookmin, Woori, IBK)
- Scheduled automatic syncing (planned; see scheduler)
- **Manual bank-level resync (implemented):** In **연결된 계좌**, each connected bank has **어음 → 어음 재동기화** (no per-account menu). IPC: `finance-hub:sync-promissory-notes`; automators may implement `syncPromissoryNotes()`. See [Implementation status](#implementation-status).

### 2. **Manual Entry**
- Form-based manual entry for notes from banks without automation
- Validation for required fields
- Duplicate detection

### 3. **Status Management**
- Track lifecycle: active → collected/dishonored/cancelled
- Automatic status updates based on maturity date
- Manual status override with notes

### 4. **Alerts and Notifications**
- Dashboard alerts for notes maturing soon
- Overdue note warnings
- Customizable alert thresholds (7, 14, 30 days)

### 5. **Reporting**
- Summary reports: total issued/received, active amounts
- Maturity timeline view
- Overdue notes report
- Export to Excel/CSV for accounting

### 6. **Advanced Features**
- **Endorsement tracking**: Record chain of endorsements
- **Discount tracking**: Track discounting transactions with banks
- **Categorization**: User-defined categories for better organization
- **Search and filter**: By date range, status, amount, counterparty
- **Multi-account view**: Aggregate view across all accounts

### 7. **Integration with Transactions**
- Link promissory note collections to bank transactions
- Automatic matching when note is collected
- Transaction categorization based on note type

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Database schema migration (023)
- [ ] TypeScript interfaces
- [ ] Database manager methods
- [ ] Unit tests for database operations

### Phase 2: UI Components (Week 2-3)
- [ ] Basic list view component
- [ ] Detail/edit form
- [ ] Summary dashboard widget
- [ ] Filter and search functionality

### Phase 3: Bank Automation (Week 3-4)
- [ ] Extend BaseBankAutomator with promissory note methods
- [ ] Implement for Hana Bank (pilot)
- [ ] Implement for Shinhan Bank
- [ ] Implement for other major banks

### Phase 4: Advanced Features (Week 4-5)
- [ ] Endorsement tracking
- [ ] Discount tracking
- [ ] Alert system
- [ ] Export functionality

### Phase 5: Integration & Testing (Week 5-6)
- [ ] Integration with transaction system
- [ ] Database export/import updates
- [ ] End-to-end testing
- [ ] User acceptance testing

### Phase 6: Polish & Documentation (Week 6)
- [ ] UI/UX refinements
- [ ] Performance optimization
- [ ] User documentation
- [ ] Code documentation

---

## Considerations

### Accounting & Financial

1. **Double-entry bookkeeping**:
   - Issued notes = Liability
   - Received notes = Asset
   - Need to integrate with accounting system

2. **Discounting calculations**:
   - Discount rate calculation
   - Net amount received
   - Interest/fee tracking

3. **Maturity tracking**:
   - Automatic status updates on maturity
   - Grace period handling
   - Dishonor procedures

### Legal & Compliance

1. **Korean Commercial Code compliance**:
   - 어음법 (Bills and Notes Act)
   - Required information validation
   - Legal format requirements

2. **Record retention**:
   - Keep records for statutory period (typically 5-10 years)
   - Audit trail for status changes

3. **Security**:
   - Sensitive financial data encryption
   - Access control for note management
   - Audit logging for all changes

### Technical

1. **Data validation**:
   - Amount validation (positive integers)
   - Date validation (maturity > issue date)
   - Business registration number format

2. **Performance**:
   - Indexes on frequently queried fields
   - Pagination for large datasets
   - Efficient date range queries

3. **Error handling**:
   - Bank scraping failures
   - Duplicate note detection
   - Invalid data handling

4. **Backup & recovery**:
   - Include in regular database backups
   - Export/import functionality
   - Version control for schema changes

### User Experience

1. **Accessibility**:
   - Clear visual indicators for status
   - Color-coded urgency (overdue = red, maturing soon = yellow)
   - Keyboard navigation support

2. **Localization**:
   - Korean and English labels
   - Korean business terminology (어음, 발행, 수취, 만기)
   - Currency formatting (KRW)

3. **Mobile responsiveness**:
   - Responsive table design
   - Touch-friendly controls
   - Mobile alerts/notifications

### Future Enhancements

1. **Electronic promissory notes (전자어음)**:
   - Integration with electronic promissory note platforms
   - Different data model for e-notes
   - API integration with financial institutions

2. **Analytics**:
   - Cash flow forecasting based on note maturities
   - Trend analysis (issued vs received over time)
   - Counterparty analysis

3. **Automation**:
   - Auto-categorization using ML
   - Predictive dishonor detection
   - Optimal discount timing recommendations

4. **Integration**:
   - Export to accounting software (더존, ERP systems)
   - Integration with tax filing systems
   - API for third-party integrations

---

## Implementation status

This section records what is **already implemented** in the repo (as of the last update to this document), so the high-level sections above stay the long-term design while this stays the factual changelog.

### Database migration 023

- **File:** `src/main/sqlite/migrations/023-create-promissory-notes.ts`
- **Function:** `migrate023CreatePromissoryNotes(financeHubDb)`
- **Wiring:** `src/main/sqlite/init.ts` (after migration 022, dynamic `import()`, errors logged only)
- **Details:** See [Migration Strategy](#migration-strategy) for table columns, indexes, and idempotent behavior.

### Bank-level 어음 sync — UI (`FinanceHub.tsx`)

- **Where:** “연결된 계좌” → each bank card **footer** (`finance-hub__bank-actions`), only when `connection.status === 'connected'`.
- **Pattern:** Same dropdown shell as elsewhere (`finance-hub__sync-dropdown` / `finance-hub__sync-options`).
- **Actions:** Unlike **거래내역** (per-account sync with 1일 / 1주일 / …), 어음 uses **one menu entry per bank:** **어음 재동기화** — no account list and no date-range submenu.
- **Button:** Labeled **어음** (file-invoice icon); shows spinner while sync runs.
- **Handler:** `handleSyncPromissoryNotes(bankId)` — if the bank is disconnected/error, attempts `reconnectBankFromSavedCredentials` first; calls IPC; on known “no session” errors, retries once after reconnect; shows alerts for success/failure; updates `lastSync` on success.

### Bank-level 어음 sync — Electron API

| Layer | Detail |
|--------|--------|
| **Preload** | `window.electron.financeHub.syncPromissoryNotes(bankId)` → `ipcRenderer.invoke('finance-hub:sync-promissory-notes', { bankId })` |
| **Main** | `ipcMain.handle('finance-hub:sync-promissory-notes', …)` resolves the **active automator** for `bankId` from the same map used for transaction sync. If **no automator**, returns `{ success: false, error: '…활성 브라우저 세션…' }` (Korean). If automator exposes **`syncPromissoryNotes()`**, invokes it; return value may include `success`, `imported`, `error`. If the method is **missing**, returns a Korean message that this bank’s 어음 automation is **not connected yet**. |
| **Types** | `src/renderer/preload.d.ts` — `FinanceHubAPI.syncPromissoryNotes` |

### Automator contract

- Optional instance method: **`syncPromissoryNotes()`** on the bank automator class.
- When implemented, it should perform whatever navigation/scrape is needed **for that bank** (possibly iterating accounts internally) and persist rows via the FinanceHub DB layer (`promissory_notes`, upsert by `note_number` + `bank_id`).
- Until a bank implements this method, users still see a clear error instead of a silent no-op.

---

## Conclusion

This promissory note feature will significantly enhance the FinanceHub system by providing comprehensive management of a critical financial instrument in Korean business. The implementation follows existing patterns in the codebase while adding powerful new capabilities for tracking, managing, and reporting on promissory notes.

The phased approach allows for incremental development and testing, ensuring stability while building out functionality. The design is extensible, allowing for future enhancements like electronic note integration and advanced analytics.

**Next Steps:**
1. Review and approve this design document
2. Implement `syncPromissoryNotes()` (and DB upserts) per target bank automator
3. Wire `PromissoryNotesPage` to live `financeHubDb` queries instead of mock data only
4. Optional: scheduler entry for periodic 어음 sync (bank-scoped, aligned with this sync model)

---

**Document Version:** 1.1
**Last Updated:** 2026-04-14
**Author:** Claude (with FinanceHub architecture analysis)
**Status:** Draft — migration 023 + bank-level 어음 sync UI/IPC documented as implemented
