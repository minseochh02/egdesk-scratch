# Billing System — User Data Tables

## Overview

Users are charged a monthly subscription fee for each user data table they create in the My DB section. The system urges payment persistently but never blocks access.

---

## Pricing

| Unit | Price |
|------|-------|
| 1 table | 10,000원 / month |

- No free tier — all tables require a subscription from the moment of creation.
- Monthly billing cycle per table.
- Total monthly charge = number of tables × 10,000원.

---

## Payment Provider

**PortOne** (포트원)

- Integration code will be provided separately from the main EGDesk purchase site.
- The billing IPC layer should expose a stub `billing:initiate-payment` that accepts a list of table IDs and returns a payment intent object. PortOne wires into this stub.
- On successful payment callback from PortOne, call `billing:record-payment` with the paid table IDs to update `billing_paid_until` in the database.

---

## Enforcement — Soft Urging (No Blocking)

Users are **never blocked** from accessing, editing, or using their tables regardless of payment status.

Instead, unpaid tables are surfaced persistently:

| Location | Behaviour |
|----------|-----------|
| UserData page top | Sticky banner: "X개 테이블 미결제 · 이번달 Y원" + "결제하기" button |
| Table list card | Orange "미결제" badge on each unpaid table |
| Table viewer header | Subtle inline notice with a pay link |

The banner and badges remain visible until the table is paid.

---

## Billing Status

A table has one of two billing states, derived from `billing_paid_until`:

| State | Condition | Badge |
|-------|-----------|-------|
| `paid` | `billing_paid_until >= today` | — |
| `unpaid` | `billing_paid_until` is NULL or `< today` | Orange "미결제" |

No distinction between "never paid" and "lapsed" in the UI — both show the same urging.

---

## Database Schema

Add one column to `user_tables` (migration-safe `ALTER TABLE`):

```sql
ALTER TABLE user_tables ADD COLUMN billing_paid_until TEXT;
-- ISO 8601 datetime string. NULL = never paid. Past date = lapsed.
```

---

## IPC Handlers

All handlers live in `src/main/user-data/billing-ipc-handler.ts` and are registered from `main.ts` alongside `registerUserDataIPCHandlers()`.

### `billing:get-summary`

Returns the billing state of all tables.

**Request:** none

**Response:**
```ts
{
  tables: Array<{
    id: string;
    displayName: string;
    isPaid: boolean;
    paidUntil: string | null; // ISO date or null
  }>;
  unpaidCount: number;
  monthlyTotal: number; // unpaidCount × 10000
}
```

### `billing:record-payment`

Called after a successful PortOne payment. Extends each table's subscription by 1 month from today.

**Request:**
```ts
{ tableIds: string[] }
```

**Response:**
```ts
{ success: boolean; updatedCount: number }
```

### `billing:initiate-payment` *(stub — PortOne wires in here)*

Called when the user clicks "결제하기". Returns the data needed to open the PortOne payment sheet.

**Request:**
```ts
{ tableIds: string[] }
```

**Response (stub):**
```ts
{
  merchantUid: string;   // unique order ID
  amount: number;        // tableIds.length × 10000
  tableIds: string[];
  // PortOne-specific fields added when integration code is provided
}
```

---

## Frontend Components

### `useBilling` hook (`src/renderer/hooks/useBilling.ts`)

```ts
const { summary, loading, refresh } = useBilling();
// summary: { tables, unpaidCount, monthlyTotal }
```

Called on `UserDataPage` mount and after any payment action.

### Billing banner (`UserDataPage.tsx`)

Rendered above the table list whenever `unpaidCount > 0`:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  3개 테이블 미결제 · 이번달 30,000원          [ 결제하기 ]  │
└─────────────────────────────────────────────────────────────────┘
```

### Unpaid badge (`TableList.tsx`)

Small orange pill on each table card where `isPaid === false`:

```
┌──────────────────────────────────────┐
│  고객 데이터       [미결제]           │
│  1,204행 · 8열                       │
└──────────────────────────────────────┘
```

---

## PortOne Integration Points (to be completed)

When the PortOne code from the purchase site is provided, wire it into:

1. `billing:initiate-payment` IPC handler — add PortOne merchant/channel keys and construct the payment request payload.
2. PortOne success/failure callbacks — on success, call `billing:record-payment` with the returned table IDs; on failure, show an error toast.
3. `BillingPaymentModal` component — renders the PortOne payment sheet UI.

---

## Open Questions

- Should `billing_paid_until` be extended from today or from the previous `billing_paid_until` when renewing early (avoids penalising early payers)?
- Should deleted tables be excluded from the monthly total, or should there be a warning before deleting a paid table?
- Email/push notifications for upcoming renewal or lapsed payment — out of scope for now.
