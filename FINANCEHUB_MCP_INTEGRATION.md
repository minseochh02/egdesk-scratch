# FinanceHub MCP Integration Guide

## Overview

FinanceHub database is exposed as a **read-only** MCP (Model Context Protocol) service that provides AI assistants access to Korean bank account and transaction data. All credential operations are explicitly excluded for security.

## Architecture

### 1. Database Location
- **Path**: `[UserData]/database/financehub.db`
- **Type**: SQLite database
- **Access**: Read-only through MCP tools

### 2. MCP Service Structure

```
FinanceHub MCP Service (financehub-mcp-service.ts)
    ↓
FinanceHubDbManager (sqlite/financehub.ts)
    ↓
SQLite Database (financehub.db)
```

### 3. HTTP Endpoint Exposure

The MCP server exposes FinanceHub through HTTP endpoints:

**Base URL**: `http://localhost:8080` (default)

**Available Endpoints**:
- `GET /financehub/tools` - List available tools
- `POST /financehub/tools/call` - Execute a tool

## Available MCP Tools

### 1. **financehub_list_banks**
List all registered banks/cards with metadata

**Input**: None required

**Output**:
```json
{
  "totalBanks": 5,
  "banks": [
    {
      "id": "shinhan",
      "name": "Shinhan Bank",
      "nameKo": "신한은행",
      "color": "#0046ff",
      "icon": "shinhan.png",
      "supportsAutomation": true
    }
  ]
}
```

**Example Call**:
```typescript
const response = await fetch('http://localhost:8080/financehub/tools/call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Optional: 'X-Api-Key': 'your-api-key'
  },
  body: JSON.stringify({
    tool: 'financehub_list_banks',
    arguments: {}
  })
});

const result = await response.json();
console.log(result.result.banks);
```

### 2. **financehub_list_accounts**
List bank accounts with balances

**Input Parameters**:
- `bankId` (optional): Filter by specific bank ID
- `isActive` (optional): Filter by active status

**Output**:
```json
{
  "totalAccounts": 3,
  "accounts": [
    {
      "id": "acc_123",
      "bankId": "shinhan",
      "accountNumber": "110-123-456789",
      "accountName": "입출금통장",
      "customerName": "홍길동",
      "balance": 5000000,
      "availableBalance": 4800000,
      "currency": "KRW",
      "accountType": "CHECKING",
      "openDate": "2020-01-15",
      "isActive": true,
      "lastSyncedAt": "2024-12-15T10:30:00Z"
    }
  ]
}
```

**Example Call**:
```typescript
// List all active accounts
const response = await fetch('http://localhost:8080/financehub/tools/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tool: 'financehub_list_accounts',
    arguments: {
      isActive: true
    }
  })
});
```

### 3. **financehub_query_transactions**
Query transactions with filtering, sorting, and pagination

**Input Parameters**:
- `accountId` (optional): Filter by account ID
- `bankId` (optional): Filter by bank ID
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)
- `category` (optional): Transaction category
- `minAmount` (optional): Minimum amount
- `maxAmount` (optional): Maximum amount
- `searchText` (optional): Search in description/memo/counterparty
- `limit` (optional): Max results (default: 100, max: 1000)
- `offset` (optional): Pagination offset (default: 0)
- `orderBy` (optional): Sort by 'date', 'amount', or 'balance' (default: 'date')
- `orderDir` (optional): 'asc' or 'desc' (default: 'desc')

**Output**:
```json
{
  "totalReturned": 50,
  "limit": 100,
  "offset": 0,
  "transactions": [
    {
      "id": "tx_123",
      "accountId": "acc_123",
      "bankId": "shinhan",
      "date": "2024-12-15",
      "time": "14:30:00",
      "transaction_datetime": "2024-12-15T14:30:00Z",
      "type": "WITHDRAWAL",
      "category": "식비",
      "withdrawal": 45000,
      "deposit": 0,
      "description": "스타벅스 강남점",
      "memo": "커피 구매",
      "balance": 4955000,
      "branch": "강남지점",
      "counterparty": "스타벅스",
      "transactionId": "TX20241215143000001"
    }
  ]
}
```

**Example Call**:
```typescript
// Get last month's transactions over 100,000 KRW
const response = await fetch('http://localhost:8080/financehub/tools/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tool: 'financehub_query_transactions',
    arguments: {
      startDate: '2024-11-01',
      endDate: '2024-11-30',
      minAmount: 100000,
      orderBy: 'amount',
      orderDir: 'desc',
      limit: 100
    }
  })
});
```

### 4. **financehub_get_statistics**
Get transaction statistics (totals, counts, net change)

**Input Parameters**:
- `accountId` (optional): Filter by account
- `bankId` (optional): Filter by bank
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)

**Output**:
```json
{
  "totalTransactions": 342,
  "totalDeposits": 15000000,
  "totalWithdrawals": 8500000,
  "depositCount": 45,
  "withdrawalCount": 297,
  "netChange": 6500000,
  "filters": {
    "accountId": null,
    "bankId": "shinhan",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }
}
```

### 5. **financehub_get_monthly_summary**
Get monthly breakdown of deposits/withdrawals per bank

**Input Parameters**:
- `accountId` (optional): Filter by account
- `bankId` (optional): Filter by bank
- `year` (optional): Specific year
- `months` (optional): Number of months to return (default: 12)

**Output**:
```json
{
  "totalMonths": 12,
  "summary": [
    {
      "yearMonth": "2024-12",
      "bankId": "shinhan",
      "depositCount": 8,
      "withdrawalCount": 45,
      "totalDeposits": 2500000,
      "totalWithdrawals": 1800000,
      "netChange": 700000
    }
  ]
}
```

### 6. **financehub_get_overall_stats**
Get high-level overview of all banks, accounts, and transactions

**Input**: None required

**Output**:
```json
{
  "totalBanks": 5,
  "totalAccounts": 8,
  "totalTransactions": 1523,
  "totalBalance": 25000000,
  "bankBreakdown": [
    {
      "bankId": "shinhan",
      "bankName": "신한은행",
      "accountCount": 2,
      "transactionCount": 652,
      "totalBalance": 12000000
    }
  ]
}
```

### 7. **financehub_get_sync_history**
Get sync operation history with status and timing

**Input Parameters**:
- `limit` (optional): Max operations to return (default: 50)

**Output**:
```json
{
  "totalReturned": 50,
  "syncOperations": [
    {
      "id": "sync_123",
      "accountId": "acc_123",
      "bankId": "shinhan",
      "status": "completed",
      "syncType": "auto",
      "startedAt": "2024-12-15T10:00:00Z",
      "completedAt": "2024-12-15T10:02:30Z",
      "duration": 150000,
      "queryPeriodStart": "2024-11-15",
      "queryPeriodEnd": "2024-12-15",
      "transactionsImported": 45,
      "transactionsSkipped": 2,
      "errorMessage": null
    }
  ]
}
```

## How AI Can Utilize This

### 1. **Financial Analysis**
```typescript
// Example: Analyze spending patterns
async function analyzeSpending() {
  // Get monthly summary
  const summaryResponse = await fetch('http://localhost:8080/financehub/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'financehub_get_monthly_summary',
      arguments: { months: 6 }
    })
  });

  const { result } = await summaryResponse.json();

  // Analyze spending trends
  const spendingTrend = result.summary.map(month => ({
    month: month.yearMonth,
    netChange: month.netChange,
    spendingRate: month.totalWithdrawals / month.totalDeposits
  }));

  return spendingTrend;
}
```

### 2. **Budget Tracking**
```typescript
// Example: Check if spending exceeds budget
async function checkBudget(category: string, budgetLimit: number) {
  const response = await fetch('http://localhost:8080/financehub/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'financehub_get_statistics',
      arguments: {
        category,
        startDate: '2024-12-01',
        endDate: '2024-12-31'
      }
    })
  });

  const { result } = await response.json();
  const spent = result.totalWithdrawals;
  const remaining = budgetLimit - spent;

  return {
    spent,
    remaining,
    percentUsed: (spent / budgetLimit) * 100,
    isOverBudget: spent > budgetLimit
  };
}
```

### 3. **Transaction Search**
```typescript
// Example: Find all coffee shop purchases
async function findCoffeeShops() {
  const response = await fetch('http://localhost:8080/financehub/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'financehub_query_transactions',
      arguments: {
        searchText: '스타벅스',
        orderBy: 'date',
        orderDir: 'desc'
      }
    })
  });

  const { result } = await response.json();
  return result.transactions;
}
```

### 4. **Account Balance Monitoring**
```typescript
// Example: Check all account balances
async function checkBalances() {
  const response = await fetch('http://localhost:8080/financehub/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'financehub_list_accounts',
      arguments: { isActive: true }
    })
  });

  const { result } = await response.json();

  return result.accounts.map(acc => ({
    bank: acc.bankId,
    accountNumber: acc.accountNumber,
    balance: acc.balance,
    availableBalance: acc.availableBalance
  }));
}
```

## Security

### 1. **Read-Only Access**
- All tools provide **read-only** access
- No write, update, or delete operations
- Credentials are never exposed

### 2. **API Key Authentication** (Optional)
The server supports optional API key authentication:

```typescript
fetch('http://localhost:8080/financehub/tools/call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': 'your-api-key-here'  // Optional
  },
  body: JSON.stringify({ tool: 'financehub_list_accounts', arguments: {} })
});
```

### 3. **MCP Server Control**
The FinanceHub MCP server can be enabled/disabled:

```typescript
// Enable FinanceHub MCP server
await ipcRenderer.invoke('mcp-server-enable', 'financehub');

// Disable FinanceHub MCP server
await ipcRenderer.invoke('mcp-server-disable', 'financehub');
```

## Response Format

All MCP tool calls return data in this format:

```json
{
  "success": true,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{ ... JSON data ... }"
      }
    ]
  }
}
```

Parse the response:
```typescript
const response = await fetch('http://localhost:8080/financehub/tools/call', { ... });
const data = await response.json();

if (data.success) {
  // Parse the MCP response format
  const resultText = data.result.content[0].text;
  const parsedData = JSON.parse(resultText);
  console.log(parsedData);
}
```

## Use Cases for AI Assistants

1. **Financial Reporting**: Generate monthly/yearly financial reports
2. **Spending Analysis**: Identify spending patterns and anomalies
3. **Budget Planning**: Help users create and track budgets
4. **Transaction Search**: Find specific transactions by description, amount, date
5. **Balance Monitoring**: Track account balances across multiple banks
6. **Category Analysis**: Analyze spending by category
7. **Sync Status**: Monitor automated sync operations
8. **Bank Comparison**: Compare transaction volumes and balances across banks

## Integration Example

```typescript
// Complete example: Financial health check
async function financialHealthCheck() {
  const baseUrl = 'http://localhost:8080/financehub/tools/call';
  const headers = { 'Content-Type': 'application/json' };

  // 1. Get overall stats
  const statsRes = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tool: 'financehub_get_overall_stats',
      arguments: {}
    })
  });
  const stats = await statsRes.json();

  // 2. Get monthly summary (last 3 months)
  const summaryRes = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tool: 'financehub_get_monthly_summary',
      arguments: { months: 3 }
    })
  });
  const summary = await summaryRes.json();

  // 3. Get current month statistics
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentStatsRes = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tool: 'financehub_get_statistics',
      arguments: {
        startDate: firstDay.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0]
      }
    })
  });
  const currentStats = await currentStatsRes.json();

  return {
    overview: JSON.parse(stats.result.content[0].text),
    monthlySummary: JSON.parse(summary.result.content[0].text),
    currentMonth: JSON.parse(currentStats.result.content[0].text)
  };
}
```

---

*This document provides complete information for AI assistants to access and analyze FinanceHub data through the MCP protocol.*
