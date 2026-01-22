# Date Picker Enhancement Proposal

**Created:** 2026-01-22
**Status:** Proposal
**Priority:** High

---

## Problem Statement

Current date picker system is too rigid:
- ❌ Assumes all date pickers have Year + Month + Day
- ❌ Doesn't handle Year-only pickers (e.g., "Select graduation year")
- ❌ Doesn't handle Month-Year only pickers (e.g., credit card expiry)
- ❌ Doesn't handle Quarter pickers (Q1, Q2, Q3, Q4)
- ❌ Doesn't handle Week pickers
- ❌ Doesn't handle Date Range pickers (Start Date → End Date)
- ❌ Doesn't handle custom calendar widgets
- ❌ Forces users to mark all three components even if not needed

**Real-world Examples:**
1. **Credit Card Expiry**: Month + Year only
2. **Birth Year**: Year only
3. **Quarterly Reports**: Quarter + Year
4. **Booking Systems**: Start Date + End Date (range)
5. **Month/Year Archives**: Month + Year
6. **Fiscal Year**: Year only
7. **Week Selector**: Week number + Year

---

## Proposed Solution: Flexible Date Component System

### Core Concept
Instead of fixed "Year → Month → Day" flow, allow users to:
1. **Mark any combination** of date components
2. **Add multiple components** dynamically (not limited to 3)
3. **Support date ranges** (start date + end date)
4. **Preview before saving** to verify correctness
5. **Save as reusable templates** for common patterns

---

## Architecture

### Updated Interface Structure

```typescript
interface DateComponent {
  id: string;                          // Unique ID (e.g., 'comp-1', 'comp-2')
  type: 'year' | 'month' | 'day' | 'quarter' | 'week' | 'hour' | 'minute' | 'custom';
  label: string;                       // User-provided label (e.g., 'Expiry Year', 'Start Month')
  selector: string;                    // CSS selector
  xpath?: string;                      // XPath fallback
  elementType: 'select' | 'input' | 'button' | 'calendar' | 'dropdown';

  // For dropdowns with separate trigger and options
  dropdownTriggerSelector?: string;    // Element to click to open dropdown
  dropdownOptionsSelector?: string;    // Selector for dropdown options container

  // For calendar widgets
  calendarContainerSelector?: string;  // Main calendar container
  calendarNavigationSelector?: string; // Next/prev buttons

  // Formatting
  format?: string;                     // e.g., 'YYYY', 'MM', 'MMM' (Jan, Feb), 'Q1', 'Q2'
  inputFormat?: string;                // How to input (e.g., '2024', '01', 'January')

  // Position in sequence
  order: number;                       // Order to fill (1, 2, 3...)

  // Relationship to other components (for ranges)
  rangeRole?: 'start' | 'end' | 'single';
  rangeGroupId?: string;               // Groups start/end components together
}

interface DatePickerAction {
  type: 'datePicker';                  // Simplified from 'datePickerGroup'

  components: DateComponent[];         // Array of components (flexible length)

  // Date calculation
  dateStrategy: 'offset' | 'fixed' | 'relative' | 'dynamic';

  // For offset strategy (most common)
  offsetDays?: number;                 // Days from today (0 = today, 1 = tomorrow)

  // For fixed strategy
  fixedDate?: {
    year?: number;
    month?: number;
    day?: number;
  };

  // For relative strategy (e.g., "end of month", "start of quarter")
  relativeStrategy?: 'startOfMonth' | 'endOfMonth' | 'startOfQuarter' | 'endOfQuarter' | 'startOfYear' | 'endOfYear';

  // For dynamic strategy (JavaScript expression)
  dynamicExpression?: string;          // e.g., "new Date().getFullYear() - 5"

  // Metadata
  patternName?: string;                // Optional: "Credit Card Expiry", "Date Range"
  timestamp: number;
}

// Reusable templates
interface DatePickerTemplate {
  id: string;
  name: string;                        // e.g., "Credit Card Expiry (MM/YY)"
  description: string;
  components: Omit<DateComponent, 'selector' | 'xpath'>[]; // Template without selectors
  dateStrategy: DatePickerAction['dateStrategy'];
  commonUseCases: string[];            // ["Payment forms", "Subscription forms"]
  createdAt: Date;
}
```

---

## User Flow: Marking Date Components

### Step-by-Step Process

```
1. User clicks "📅 Mark Date Picker" button in controller
   ↓
2. Mode activated - Show instruction overlay:
   "Click on date components in the order you want to fill them"

   Options panel appears:
   [+ Add Component] [Preview] [Save] [Cancel]

   ↓
3. User clicks first element (e.g., Month dropdown)
   ↓
4. Modal appears:
   ┌─────────────────────────────────────────────┐
   │  Configure Date Component                    │
   ├─────────────────────────────────────────────┤
   │  Component Type:                             │
   │  ○ Year    ● Month    ○ Day                 │
   │  ○ Quarter ○ Week     ○ Custom              │
   │                                              │
   │  Label: [Expiry Month        ]              │
   │                                              │
   │  Element Type:                               │
   │  ● Dropdown  ○ Input  ○ Calendar Widget     │
   │                                              │
   │  [Advanced Options ▼]                        │
   │    Format: ○ Number (01-12)                 │
   │            ● Name (January, February...)     │
   │            ○ Short (Jan, Feb...)             │
   │                                              │
   │  Range Component:                            │
   │  ○ Single date                               │
   │  ○ Start of range                            │
   │  ○ End of range                              │
   │                                              │
   │  [Cancel]  [Save & Add Another]  [Save]     │
   └─────────────────────────────────────────────┘

   ↓
5. User clicks "Save & Add Another"
   ↓
6. User clicks next element (e.g., Year dropdown)
   ↓
7. Repeat modal for Year component
   ↓
8. User clicks "Save" (done marking)
   ↓
9. Preview panel shows:
   ┌─────────────────────────────────────────────┐
   │  Date Picker Preview                         │
   ├─────────────────────────────────────────────┤
   │  Components marked:                          │
   │  1. Month (Dropdown) - "Expiry Month"       │
   │  2. Year (Dropdown) - "Expiry Year"         │
   │                                              │
   │  Date Strategy:                              │
   │  ● Days from today: [0 ] (today)            │
   │  ○ Fixed date                                │
   │  ○ Relative (end of month, etc.)            │
   │  ○ Dynamic expression                        │
   │                                              │
   │  Test Preview:                               │
   │  If test runs today (Jan 22, 2026):          │
   │    Month: January                            │
   │    Year: 2026                                │
   │                                              │
   │  Save as template?                           │
   │  □ Save as "Credit Card Expiry"              │
   │                                              │
   │  [Cancel]  [Save Date Picker]                │
   └─────────────────────────────────────────────┘

   ↓
10. User clicks "Save Date Picker"
    ↓
11. Action recorded, mode exits, recording continues
```

---

## Enhanced Controller UI

### Date Picker Button Dropdown Menu

```
┌─────────────────────────────────────────┐
│  📅 Date Picker ▼                        │
├─────────────────────────────────────────┤
│  ✨ Mark New Date Picker                │  ← Current functionality (enhanced)
│  📋 Use Template                         │  ← Quick apply saved templates
│  💾 Manage Templates                     │  ← View/edit/delete templates
│  ❓ Help & Examples                      │  ← Show common patterns
└─────────────────────────────────────────┘
```

### Template Gallery (Quick Access)

When user clicks "Use Template":
```
┌─────────────────────────────────────────────────────────────┐
│  Select Date Picker Template                                 │
├─────────────────────────────────────────────────────────────┤
│  📅 Full Date (Month/Day/Year)                              │
│     Common in: Booking forms, Event registration            │
│     [Use Template]                                           │
│                                                              │
│  💳 Credit Card Expiry (Month/Year)                         │
│     Common in: Payment forms, Subscription forms            │
│     [Use Template]                                           │
│                                                              │
│  📊 Quarter Picker (Quarter/Year)                           │
│     Common in: Financial reports, Quarterly forms           │
│     [Use Template]                                           │
│                                                              │
│  📆 Date Range (Start Date + End Date)                      │
│     Common in: Booking systems, Report generation           │
│     [Use Template]                                           │
│                                                              │
│  📅 Month/Year Only                                         │
│     Common in: Archive browsing, Date filters               │
│     [Use Template]                                           │
│                                                              │
│  🎓 Year Only                                               │
│     Common in: Graduation year, Birth year                  │
│     [Use Template]                                           │
│                                                              │
│  [+ Create Custom]  [Cancel]                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Generation Examples

### Example 1: Year-Only Picker
```typescript
// Recorded Action
{
  type: 'datePicker',
  components: [
    {
      id: 'comp-1',
      type: 'year',
      label: 'Graduation Year',
      selector: '#graduationYear',
      elementType: 'select',
      order: 1,
      rangeRole: 'single'
    }
  ],
  dateStrategy: 'offset',
  offsetDays: 0
}

// Generated Code
const today = new Date();
const targetDate = new Date(today.getTime() + (0 * 24 * 60 * 60 * 1000));
const year = targetDate.getFullYear();

await page.locator('#graduationYear').selectOption(year.toString());
```

### Example 2: Month/Year (Credit Card)
```typescript
// Recorded Action
{
  type: 'datePicker',
  components: [
    {
      id: 'comp-1',
      type: 'month',
      label: 'Expiry Month',
      selector: '#expiryMonth',
      elementType: 'select',
      format: 'MM',
      order: 1
    },
    {
      id: 'comp-2',
      type: 'year',
      label: 'Expiry Year',
      selector: '#expiryYear',
      elementType: 'select',
      format: 'YYYY',
      order: 2
    }
  ],
  dateStrategy: 'offset',
  offsetDays: 365  // 1 year from now
}

// Generated Code
const today = new Date();
const targetDate = new Date(today.getTime() + (365 * 24 * 60 * 60 * 1000));
const month = String(targetDate.getMonth() + 1).padStart(2, '0');
const year = targetDate.getFullYear();

await page.locator('#expiryMonth').selectOption(month);
await page.locator('#expiryYear').selectOption(year.toString());
```

### Example 3: Date Range
```typescript
// Recorded Action
{
  type: 'datePicker',
  components: [
    {
      id: 'comp-1',
      type: 'month',
      label: 'Check-in Month',
      selector: '#checkinMonth',
      elementType: 'select',
      order: 1,
      rangeRole: 'start',
      rangeGroupId: 'booking-range'
    },
    {
      id: 'comp-2',
      type: 'day',
      label: 'Check-in Day',
      selector: '#checkinDay',
      elementType: 'select',
      order: 2,
      rangeRole: 'start',
      rangeGroupId: 'booking-range'
    },
    {
      id: 'comp-3',
      type: 'year',
      label: 'Check-in Year',
      selector: '#checkinYear',
      elementType: 'select',
      order: 3,
      rangeRole: 'start',
      rangeGroupId: 'booking-range'
    },
    {
      id: 'comp-4',
      type: 'month',
      label: 'Check-out Month',
      selector: '#checkoutMonth',
      elementType: 'select',
      order: 4,
      rangeRole: 'end',
      rangeGroupId: 'booking-range'
    },
    {
      id: 'comp-5',
      type: 'day',
      label: 'Check-out Day',
      selector: '#checkoutDay',
      elementType: 'select',
      order: 5,
      rangeRole: 'end',
      rangeGroupId: 'booking-range'
    },
    {
      id: 'comp-6',
      type: 'year',
      label: 'Check-out Year',
      selector: '#checkoutYear',
      elementType: 'select',
      order: 6,
      rangeRole: 'end',
      rangeGroupId: 'booking-range'
    }
  ],
  dateStrategy: 'offset',
  offsetDays: 7  // Start: today, End: 7 days from today
}

// Generated Code
const today = new Date();

// Start date (today)
const startDate = new Date(today);
const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
const startDay = String(startDate.getDate()).padStart(2, '0');
const startYear = startDate.getFullYear();

// End date (7 days from today)
const endDate = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
const endDay = String(endDate.getDate()).padStart(2, '0');
const endYear = endDate.getFullYear();

// Fill start date
await page.locator('#checkinMonth').selectOption(startMonth);
await page.locator('#checkinDay').selectOption(startDay);
await page.locator('#checkinYear').selectOption(startYear.toString());

// Fill end date
await page.locator('#checkoutMonth').selectOption(endMonth);
await page.locator('#checkoutDay').selectOption(endDay);
await page.locator('#checkoutYear').selectOption(endYear.toString());
```

### Example 4: Quarter Picker
```typescript
// Recorded Action
{
  type: 'datePicker',
  components: [
    {
      id: 'comp-1',
      type: 'quarter',
      label: 'Fiscal Quarter',
      selector: '#fiscalQuarter',
      elementType: 'select',
      format: 'Q1',  // Q1, Q2, Q3, Q4
      order: 1
    },
    {
      id: 'comp-2',
      type: 'year',
      label: 'Fiscal Year',
      selector: '#fiscalYear',
      elementType: 'select',
      order: 2
    }
  ],
  dateStrategy: 'relative',
  relativeStrategy: 'startOfQuarter'
}

// Generated Code
const today = new Date();
const currentQuarter = Math.floor(today.getMonth() / 3) + 1;
const currentYear = today.getFullYear();

await page.locator('#fiscalQuarter').selectOption(`Q${currentQuarter}`);
await page.locator('#fiscalYear').selectOption(currentYear.toString());
```

### Example 5: Dynamic Expression
```typescript
// Recorded Action
{
  type: 'datePicker',
  components: [
    {
      id: 'comp-1',
      type: 'year',
      label: 'Birth Year (18 years ago)',
      selector: '#birthYear',
      elementType: 'select',
      order: 1
    }
  ],
  dateStrategy: 'dynamic',
  dynamicExpression: 'new Date().getFullYear() - 18'
}

// Generated Code
const birthYear = new Date().getFullYear() - 18;
await page.locator('#birthYear').selectOption(birthYear.toString());
```

---

## Implementation Plan

### Phase 1: Core Flexibility (Week 1-2)
- ✅ Update `RecordedAction` interface to support `DatePickerAction`
- ✅ Update `DateComponent` interface with all new fields
- ✅ Modify date marking mode to support variable-length component arrays
- ✅ Add component configuration modal
- ✅ Update code generation to handle flexible components
- ✅ Support year-only, month-year, full date scenarios

### Phase 2: Advanced Features (Week 3-4)
- ✅ Add date range support (start/end components)
- ✅ Add quarter picker support
- ✅ Add week picker support
- ✅ Implement relative date strategies (startOfMonth, endOfQuarter, etc.)
- ✅ Implement dynamic expression support
- ✅ Add preview panel with test calculations

### Phase 3: Templates & UX (Week 5-6)
- ✅ Build template system (save/load/manage)
- ✅ Create pre-built templates library (credit card, booking, etc.)
- ✅ Add template gallery UI
- ✅ Implement template quick-apply
- ✅ Add help & examples panel
- ✅ Polish UI/UX with better instructions

### Phase 4: Calendar Widgets (Week 7-8)
- ✅ Add support for JavaScript calendar widgets (Flatpickr, DatePicker, etc.)
- ✅ Detect calendar popups and containers
- ✅ Handle calendar navigation (next/prev month)
- ✅ Handle calendar cell selection
- ✅ Generate code for calendar interactions

---

## Database Schema Changes

### Add Templates Table
```sql
CREATE TABLE date_picker_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  components_json TEXT NOT NULL,  -- JSON array of DateComponent (without selectors)
  date_strategy TEXT NOT NULL,
  relative_strategy TEXT,
  common_use_cases_json TEXT,     -- JSON array of strings
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  usage_count INTEGER DEFAULT 0
);
```

### Update Actions Storage
Existing `RecordedAction` storage should already handle this via JSON serialization, but verify:
- `dateComponents` field can now be variable length
- Add migration to convert old `datePickerGroup` actions to new `datePicker` format

---

## Backward Compatibility

### Migration Strategy
```typescript
// Convert old datePickerGroup to new datePicker format
function migrateOldDatePickerAction(oldAction: OldDatePickerAction): DatePickerAction {
  const components: DateComponent[] = [];

  if (oldAction.dateComponents?.year) {
    components.push({
      id: 'comp-year',
      type: 'year',
      label: 'Year',
      selector: oldAction.dateComponents.year.selector,
      elementType: oldAction.dateComponents.year.elementType,
      dropdownSelector: oldAction.dateComponents.year.dropdownSelector,
      order: 1,
      rangeRole: 'single'
    });
  }

  if (oldAction.dateComponents?.month) {
    components.push({
      id: 'comp-month',
      type: 'month',
      label: 'Month',
      selector: oldAction.dateComponents.month.selector,
      elementType: oldAction.dateComponents.month.elementType,
      dropdownSelector: oldAction.dateComponents.month.dropdownSelector,
      order: 2,
      rangeRole: 'single'
    });
  }

  if (oldAction.dateComponents?.day) {
    components.push({
      id: 'comp-day',
      type: 'day',
      label: 'Day',
      selector: oldAction.dateComponents.day.selector,
      elementType: oldAction.dateComponents.day.elementType,
      dropdownSelector: oldAction.dateComponents.day.dropdownSelector,
      order: 3,
      rangeRole: 'single'
    });
  }

  return {
    type: 'datePicker',
    components,
    dateStrategy: 'offset',
    offsetDays: oldAction.dateOffset || 0,
    timestamp: oldAction.timestamp
  };
}
```

---

## Benefits

### For Users
✅ **Handles all date picker types** - No more "it doesn't work with my date picker"
✅ **Faster recording** - Templates for common patterns
✅ **More accurate** - Precise control over each component
✅ **Better visibility** - Preview shows exactly what will happen
✅ **Reusable** - Save patterns for similar forms

### For Developers
✅ **Flexible architecture** - Easy to extend with new component types
✅ **Clean code generation** - Modular, testable code
✅ **Type-safe** - Full TypeScript support
✅ **Maintainable** - Template system reduces custom code

### For Tests
✅ **More reliable** - Handles edge cases (month-year, year-only)
✅ **More readable** - Clear component labels in generated code
✅ **More flexible** - Dynamic expressions for complex scenarios
✅ **More robust** - Fallback selectors and strategies

---

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| **Complexity for users** | Provide templates for 80% of use cases, hide advanced options by default |
| **Breaking changes** | Implement migration for old actions, maintain backward compatibility |
| **UI clutter** | Use progressive disclosure (basic → advanced), clean modal design |
| **Performance** | Lazy load templates, cache common patterns, optimize re-renders |
| **Learning curve** | Add help panel with examples, tooltips, video tutorials |

---

## Success Metrics

- ✅ Support 10+ date picker patterns (year-only, month-year, full date, range, quarter, week)
- ✅ 80% of users use templates instead of custom marking
- ✅ 90% reduction in "date picker doesn't work" support tickets
- ✅ Average time to mark date picker < 30 seconds
- ✅ Zero breaking changes to existing tests

---

## Next Steps

1. **Review & Approve** this proposal
2. **Create implementation tasks** in project management tool
3. **Design UI mockups** for modals and templates gallery
4. **Set up database migrations** for templates table
5. **Begin Phase 1 development** (core flexibility)
6. **Write unit tests** for date calculation logic
7. **Update BROWSER_RECORDER_README.md** with new features

---

## Questions for Decision

1. Should we support **time pickers** (hour/minute/second) in same system?
2. Should templates be **user-specific** or **shared across users**?
3. Should we **auto-detect** common patterns and suggest templates?
4. Should we support **custom format strings** (e.g., "dd/MM/yyyy")?
5. Should we add **visual calendar picker** for testing date calculations?

---

**End of Proposal**
*Ready for review and implementation*
