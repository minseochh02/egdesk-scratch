# FinanceHub & Scheduler System Documentation

## Table of Contents
- [Overview](#overview)
- [FinanceHub](#financehub)
  - [Features](#features)
  - [Supported Banks](#supported-banks)
  - [Supported Card Companies](#supported-card-companies)
  - [Architecture](#architecture)
  - [Components](#components)
  - [Usage](#usage)
- [Scheduler System](#scheduler-system)
  - [Scheduler Services](#scheduler-services)
  - [Common Patterns](#common-patterns)
  - [Configuration](#configuration)

---

## Overview

This application provides a comprehensive financial management and automation platform with three main systems:

1. **FinanceHub**: Korean banking and financial data aggregation dashboard
2. **Automated Scheduler**: Multi-purpose task scheduling system for finance sync, Playwright tests, and Docker operations
3. **Tax Management**: Integration with Korean Hometax system

---

## FinanceHub

### Features

FinanceHub is a centralized financial data aggregation system that connects to Korean banks, credit card companies, and the Korean tax authority (Hometax).

#### Core Capabilities

- **Bank Integration**: Connect to 8+ Korean banks (Shinhan, KB, Woori, Hana, NH, IBK, Kakao, Toss)
- **Card Management**: Support for 10+ Korean credit card issuers
- **Transaction Sync**: Automatic and manual transaction synchronization with configurable date ranges
- **Tax Management**: Integration with Korean tax authority (국세청) for sales/purchase tax invoices
- **Data Export**: Export to Google Sheets with persistent spreadsheet tracking
- **Scheduled Automation**: Automatic daily sync with retry logic and status notifications
- **Session Management**: Auto-extend browser sessions with countdown timers

### Supported Banks

| Bank | Korean Name | Category | Automation Support |
|------|-------------|----------|-------------------|
| Shinhan | 신한은행 | Major | Yes |
| KB Kookmin | KB국민은행 | Major | No |
| Woori | 우리은행 | Major | No |
| Hana | 하나은행 | Major | No |
| NH | NH농협은행 | Special | Yes |
| IBK | IBK기업은행 | Special | No |
| Kakao | 카카오뱅크 | Internet | No |
| Toss | 토스뱅크 | Internet | No |

### Supported Card Companies

The system supports 10+ Korean credit card companies including major issuers, telecom cards, and internet-only cards.

### Architecture

#### Directory Structure

```
src/renderer/components/FinanceHub/
├── FinanceHub.tsx              # Main dashboard component
├── TransactionsPage.tsx        # Full transactions view
├── SchedulerSettings.tsx       # Scheduler configuration UI
├── types.ts                    # TypeScript definitions
├── utils.ts                    # Utility functions
└── shared/                     # Reusable components
    ├── DataTable.tsx           # Generic table component
    ├── TransactionTable.tsx    # Transaction-specific table
    ├── TransactionFilters.tsx  # Filter controls
    ├── TransactionStats.tsx    # Statistics cards
    ├── SessionStatusIndicator.tsx  # Session health indicator
    └── TaxInvoiceTable.tsx     # Tax invoice table
```

#### Backend Services

- **FinanceHubService** (`src/main/financehub/FinanceHubService.ts`): Core banking integration
- **FinanceHubCardService** (`src/main/financehub/FinanceHubCardService.ts`): Card integration
- **FinanceHubScheduler** (`src/main/financehub/scheduler/FinanceHubScheduler.ts`): Automated sync
- **HometaxService** (`src/main/hometax/HometaxService.ts`): Tax authority integration

### Components

#### Main Components

**FinanceHub.tsx**
- Main dashboard orchestrating all views
- Connection management for banks, cards, and tax
- Credential handling and storage
- Multi-view state management (Dashboard, Bank Transactions, Card Transactions, Tax)

**TransactionsPage.tsx**
- Full-screen transaction view
- Advanced filtering and search
- Data export to CSV and Google Sheets
- Monthly statistics

**SchedulerSettings.tsx**
- Configure automatic sync schedule
- Set sync time and retry logic
- View last sync status
- Trigger manual sync

#### Shared Components

**DataTable**: Generic sortable table with sticky headers and custom rendering

**TransactionTable**: Specialized table for transaction display with sortable columns

**TransactionFilters**: Advanced filtering UI
- Search by description/counterparty
- Bank and account selection
- Date range picker with presets (1w, 1m, 3m, 6m, 1y)
- Transaction type filtering (deposit/withdrawal)
- Amount range filtering

**TransactionStats**: Display cards showing:
- Total transactions count
- Total deposits/withdrawals
- Net change with color coding

**SessionStatusIndicator**: Real-time session monitoring
- Visual status indicators (active, extending, expired, error)
- Countdown timer to next auto-extend
- Manual extend/reconnect controls

**TaxInvoiceTable**: Tax document display with supplier/customer details and amounts

### Usage

#### Connecting to a Bank

1. Click "은행 연결" (Connect Bank) in the dashboard
2. Select your bank from the list
3. Enter your online banking credentials
4. System retrieves available accounts
5. Credentials are securely saved for future use

#### Syncing Transactions

**Manual Sync:**
1. Select connected bank account
2. Choose date range (or use presets)
3. Click "거래내역 가져오기" (Get Transactions)
4. Transactions are imported and deduplicated automatically

**Automatic Sync:**
1. Navigate to Scheduler Settings
2. Enable automatic sync
3. Set preferred sync time (default: 06:00)
4. Configure retry settings
5. System will sync all connected accounts daily

#### Viewing Transactions

1. Navigate to Bank Transactions or Card Transactions view
2. Use filters to narrow down results:
   - Search by description
   - Filter by bank/account
   - Select date range
   - Filter by transaction type
3. Sort by clicking column headers
4. Export to CSV or Google Sheets

#### Tax Invoice Management

1. Navigate to Tax Management tab
2. Load digital certificates
3. Select certificate and enter password
4. Choose invoice type (sales/purchase)
5. View and export tax invoices

---

## Scheduler System

The application implements a multi-layered scheduler system for automated task execution.

### Scheduler Services

#### 1. FinanceHub Scheduler

**Purpose**: Automatically sync financial data from banks and credit cards at scheduled intervals

**Location**: `src/main/financehub/scheduler/FinanceHubScheduler.ts`

**Features**:
- Time-based scheduling (configurable HH:MM, default 06:00)
- Keep-awake functionality during sync (prevents system sleep)
- Retry logic with configurable count and delay
- Event emission to renderer process
- Settings persistence

**Configuration**:
```typescript
{
  enabled: boolean,
  time: string,              // HH:MM format
  retryCount: number,        // Default: 3
  retryDelayMinutes: number, // Default: 5
  lastSyncTime?: string,
  lastSyncStatus?: 'success' | 'failed' | 'running'
}
```

**Execution Flow**:
1. Calculate time until next sync
2. Wait until scheduled time
3. Get all active accounts
4. Sync transactions for each account (last 3 months)
5. Retry on failure up to retryCount times
6. Update sync status and emit events

**IPC Handlers**:
- `finance-hub:scheduler:get-settings`: Get current settings
- `finance-hub:scheduler:update-settings`: Update scheduler configuration
- `finance-hub:scheduler:start`: Start scheduler
- `finance-hub:scheduler:stop`: Stop scheduler
- `finance-hub:scheduler:sync-now`: Trigger manual sync
- `finance-hub:scheduler:last-sync-info`: Get last sync status

#### 2. Playwright Scheduler Service

**Purpose**: Schedule and execute Playwright test automation scripts

**Location**: `src/main/scheduler/playwright-scheduler-service.ts`

**Features**:
- Frequency types: Daily, Weekly, Monthly, Custom intervals
- Test execution with browser automation
- Profile directory and download management
- Stdout/stderr capture
- Execution history tracking

**Database Tables**:
- `playwright_scheduled_tests`: Test configurations
- `playwright_test_executions`: Execution history and results

**Execution Flow**:
1. Register all enabled tests with node-schedule
2. On scheduled time, execute test
3. Create execution record (status: 'running')
4. Run Playwright test in browser
5. Capture results and errors
6. Update execution record and test statistics

#### 3. Docker Scheduler Service

**Purpose**: Schedule and execute Docker container operations

**Location**: `src/main/docker/DockerSchedulerService.ts`

**Features**:
- Frequency types: Once, Daily, Weekly, Monthly, Custom, Cron expressions
- Task types: start_container, stop_container, restart_container, run_image
- Docker connection verification
- Container creation with full options (env vars, volumes, ports)
- Custom interval tracking

**Database Tables**:
- `docker_scheduled_tasks`: Task configurations
- `docker_task_executions`: Execution history and results

**Task Types**:
- `start_container`: Start existing container
- `stop_container`: Stop container
- `restart_container`: Restart container
- `run_image`: Create and run new container from image

**Schedule Types**:
- `once`: Run at specific date/time
- `daily`: Run daily at specified time
- `weekly`: Run on specific day of week
- `monthly`: Run on specific day of month
- `custom`: Run every N days
- `cron`: Use cron expression (e.g., "0 2 * * *")

### Common Patterns

All schedulers follow these patterns:

#### Singleton Pattern
```typescript
private static instance: ServiceType | null = null;
public static getInstance(): ServiceType {
  if (!ServiceType.instance) {
    ServiceType.instance = new ServiceType();
  }
  return ServiceType.instance;
}
```

#### Job Management
- Active jobs stored in `Map<string, schedule.Job>`
- Cancel existing job before creating new one
- Track job count with `getScheduledJobCount()`

#### Statistics Tracking
- `run_count`: Total executions
- `success_count`: Successful executions
- `failure_count`: Failed executions
- `lastRun`: Last execution timestamp
- `nextRun`: Next scheduled execution

#### Error Handling
- Try-catch blocks around async operations
- Errors logged to console
- Retry logic for critical operations
- Status tracked in database

#### Data Persistence
All schedulers persist to SQLite database:
- Task/test configurations
- Execution history with timestamps
- Statistics and metrics
- Status tracking

### Configuration

#### Schedule Rule Examples

**Daily at 14:30**:
```typescript
const rule = new schedule.RecurrenceRule();
rule.hour = 14;
rule.minute = 30;
rule.second = 0;
```

**Weekly (Mondays at 10:00)**:
```typescript
const rule = new schedule.RecurrenceRule();
rule.dayOfWeek = 1;  // Monday
rule.hour = 10;
rule.minute = 0;
```

**Monthly (15th at 06:00)**:
```typescript
const rule = new schedule.RecurrenceRule();
rule.date = 15;
rule.hour = 6;
rule.minute = 0;
```

**Cron Expression** (Docker only):
```typescript
// Every day at 2 AM
"0 2 * * *"
```

#### Debug Mode

Enable debug logging with environment variables:
- `DEBUG_FINANCE_HUB_SCHEDULER=true`
- `DEBUG_PLAYWRIGHT_SCHEDULER=true`
- `DEBUG_DOCKER_SCHEDULER=true`

---

## Data Flow

### FinanceHub Transaction Sync Flow

```
User Request/Scheduled Trigger
  → FinanceHubScheduler/FinanceHubService
  → Login to Bank Website (Playwright automation)
  → Retrieve Account List
  → Fetch Transactions for Date Range
  → Parse and Transform Data
  → FinanceHubDatabase.importTransactions()
  → Deduplicate Transactions
  → Update Account Info
  → Return Results to UI
  → Update Stats and Sync History
```

### Scheduler Execution Flow

```
App Startup
  → Initialize Scheduler Services (Singleton)
  → Load Configurations from SQLite
  → Register Scheduled Jobs with node-schedule
  → Start Periodic Health Checks (60s intervals)

On Scheduled Time
  → Create Execution Record
  → Execute Task (Finance Sync/Playwright Test/Docker Operation)
  → Capture Output and Errors
  → Update Execution Record
  → Update Statistics
  → Emit Events to UI (if applicable)
```

---

## Security Considerations

- Bank credentials stored using Electron's secure storage
- Digital certificates encrypted at rest
- No credentials logged or exposed in UI
- Session tokens managed securely
- OAuth tokens refreshed automatically
- All connections use HTTPS

---

## Dependencies

### Key Libraries

- **node-schedule**: Cron-like scheduling
- **Playwright**: Browser automation for bank login
- **Better SQLite3**: Local data persistence
- **Electron Store**: Settings persistence
- **Google APIs**: Sheets integration
- **Dockerode**: Docker API integration

---

## Development

### File Locations

**Frontend**:
- FinanceHub: `src/renderer/components/FinanceHub/`
- Scheduler UI: `src/renderer/components/FinanceHub/SchedulerSettings.tsx`

**Backend**:
- Finance Service: `src/main/financehub/`
- Schedulers: `src/main/scheduler/`, `src/main/financehub/scheduler/`
- Database: `src/main/financehub/database/`
- IPC Handlers: `src/main/financehub/scheduler/scheduler-ipc-handler.ts`

**Initialization**: `src/main/main.ts` (lines 2853-2864 for scheduler startup)

### Adding a New Bank

1. Add bank configuration to `KOREAN_BANKS` in `types.ts`
2. Implement login automation in `FinanceHubService.ts`
3. Add transaction parsing logic
4. Update UI with bank icon and colors
5. Test connection and transaction sync

### Adding a Scheduler

1. Create new scheduler service extending base pattern
2. Implement singleton pattern
3. Create database tables for tasks and executions
4. Implement schedule rule creation
5. Add IPC handlers for UI integration
6. Initialize in `main.ts`

---

## Troubleshooting

### FinanceHub Issues

**Connection Fails**:
- Verify credentials are correct
- Check if bank website is accessible
- Review browser console for automation errors
- Try manual reconnection

**Transactions Not Syncing**:
- Check session status indicator
- Verify date range is valid
- Ensure account is active
- Review sync operation history

**Scheduler Not Running**:
- Check if scheduler is enabled in settings
- Verify sync time is correctly configured
- Check app logs for errors
- Ensure app is running at scheduled time

### Scheduler Issues

**Jobs Not Executing**:
- Check if scheduler service is started
- Verify task is enabled in database
- Review execution history for errors
- Check system clock synchronization

**Docker Tasks Failing**:
- Verify Docker daemon is running
- Check container/image exists
- Review task execution logs
- Ensure sufficient permissions

---

## Future Enhancements

- Additional bank integrations
- Real-time transaction notifications
- Budget tracking and alerts
- Multi-currency support
- Advanced reporting and analytics
- Mobile app integration
- API for third-party integrations

---

## License

Proprietary - For internal use only
