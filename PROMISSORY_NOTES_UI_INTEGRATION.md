# Promissory Notes UI Integration Guide

## Quick Start

The PromissoryNotesPage component is ready to use with mock data. Here's how to integrate it into your FinanceHub.

## Integration Steps

### 1. Add to FinanceHub.tsx

Update the imports section:

```typescript
// Add to imports at the top
import PromissoryNotesPage from './PromissoryNotesPage';
```

Update the `currentView` type:

```typescript
// Line ~105
const [currentView, setCurrentView] = useState<
  'account-management' |
  'bank-transactions' |
  'card-transactions' |
  'tax-invoices' |
  'tax-management' |
  'data-management' |
  'promissory-notes'  // ADD THIS
>('account-management');
```

Add the tab/navigation button in your view switcher:

```typescript
{/* Add this to your navigation */}
<button
  className={currentView === 'promissory-notes' ? 'active' : ''}
  onClick={() => setCurrentView('promissory-notes')}
>
  <FontAwesomeIcon icon={faFileInvoice} />
  어음 관리
</button>
```

Add the view rendering:

```typescript
{/* Add this to your view rendering section */}
{currentView === 'promissory-notes' && (
  <PromissoryNotesPage />
)}
```

### 2. Import FontAwesome Icon

If you don't have `faFileInvoice` imported yet, add it to your imports:

```typescript
import {
  // ... existing icons
  faFileInvoice,
} from '@fortawesome/free-solid-svg-icons';
```

## Component Features

### Summary Cards
- **발행 어음 (Issued Notes)**: Shows total issued notes and amount payable
- **받을 어음 (Received Notes)**: Shows total receivable notes and amounts
- **순 포지션 (Net Position)**: Automatic calculation of receivables minus payables
- **주의 필요 (Alerts)**: Shows overdue, maturing in 7 days, and maturing in 30 days

### Filters
- **구분 (Type)**: All / Issued / Received
- **상태 (Status)**: All / Active / Collected / Dishonored / Cancelled / Endorsed / Discounted
- **긴급도 (Urgency)**: All / Overdue / Maturing in 7 days / Maturing in 30 days
- **Date Range**: Start date and end date for maturity dates
- **Search**: Search by note number, issuer name, payee name, or memo

### Quick Filter Chips
Pre-configured filter buttons for:
- Overdue notes
- Maturing in 7 days
- Issued notes only
- Received notes only

### Note Card Features
- **Color-coded urgency**:
  - Red border + red background: Overdue
  - Orange border + orange background: Maturing in 7 days
  - Yellow border: Maturing in 30 days
- **Expandable details**: Click any note card to see full details
- **Status badges**: Visual status indicators with icons
- **Action buttons**: Mark as collected, dishonored, endorse, discount
- **Edit functionality**: Quick edit button

### Visual Indicators
- **발행 (Issued)**: Orange badge and amounts
- **받을 (Received)**: Green badge and amounts
- **Status colors**:
  - Active: Blue
  - Collected: Green
  - Dishonored: Red
  - Cancelled: Gray
  - Endorsed: Orange
  - Discounted: Purple

## Mock Data

The component currently displays 9 mock promissory notes with various scenarios:
- Active issued and received notes
- Collected notes
- Dishonored note
- Different banks (하나, 신한, 국민, 우리, IBK)
- Various maturity dates for testing urgency indicators
- Different amounts and counterparties

## Next Steps for Production

To connect to real data, you'll need to:

1. **Create IPC handlers** in `src/main/ipc/` for:
   - `getPromissoryNotes(filters)`
   - `upsertPromissoryNote(noteData)`
   - `updatePromissoryNoteStatus(id, status)`
   - `getPromissoryNoteSummary(accountId?)`

2. **Add hooks** similar to `useTransactions.ts`:
   - `usePromissoryNotes.ts` with state management
   - Filter state
   - Loading states
   - Refresh functionality

3. **Implement database methods** (already documented in the design MD):
   - Migration 023
   - FinanceHubDbManager methods
   - Database queries

4. **Add bank automator support**:
   - Extend bank automators to fetch promissory note data
   - Parse bank-specific formats
   - Bulk insert functionality

## File Structure

```
src/renderer/components/FinanceHub/
├── PromissoryNotesPage.tsx     ✅ Created
├── PromissoryNotesPage.css     ✅ Created
└── FinanceHub.tsx              ⚠️ Needs update
```

## Preview the Component

The component is fully functional with mock data. Simply integrate it into FinanceHub and navigate to the promissory notes view to see it in action.

All interactions work:
- Expanding/collapsing note cards
- Filtering and searching
- Quick filter chips
- Visual urgency indicators
- Responsive design (mobile-friendly)

## Customization

The component uses your existing FinanceHub patterns:
- FontAwesome icons
- CSS modules approach
- Korean/English labels
- formatCurrency utility
- Consistent color scheme

You can easily customize:
- Colors in the CSS file
- Status options
- Filter options
- Mock data for different scenarios
