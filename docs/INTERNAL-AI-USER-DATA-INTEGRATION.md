# Internal AI Chat - User Data Integration

## Overview

Successfully integrated User Data MCP tools into the internal AI chat system, enabling your coding assistant to query and analyze user-imported database tables (Excel, CSV data).

---

## What Changed

Your internal AI chat assistant can now:
- ✅ List all imported data tables
- ✅ Query table data with filters
- ✅ Search across table columns
- ✅ Compute aggregations (SUM, AVG, COUNT, etc.)
- ✅ Analyze imported Excel/CSV data
- ✅ Generate data-driven insights

---

## Implementation Details

### 1. Created 4 New AI Tools

#### Tool 1: `user_data_list_tables`
**File:** `src/main/ai-code/tools/user-data-list-tables.ts`

Lists all user-imported tables with metadata:
```typescript
{
  name: 'user_data_list_tables',
  description: 'List all user-imported database tables',
  parameters: {}  // No parameters required
}
```

**Example Response:**
```json
{
  "totalTables": 2,
  "tables": [
    {
      "tableName": "customers",
      "displayName": "Customer Data",
      "rowCount": 1523,
      "columnCount": 8,
      "columns": ["id", "name", "email", "status", ...]
    }
  ]
}
```

#### Tool 2: `user_data_query`
**File:** `src/main/ai-code/tools/user-data-query.ts`

Queries table data with filters and pagination:
```typescript
{
  name: 'user_data_query',
  parameters: {
    table_name: string;        // Required
    filters?: object;          // {"status": "active", "age": ">30"}
    limit?: number;            // Default: 100, Max: 1000
    offset?: number;           // For pagination
    order_by?: string;         // Column name
    order_direction?: string;  // ASC or DESC
  }
}
```

**Example Usage:**
```json
{
  "table_name": "customers",
  "filters": {"status": "active", "city": "New York"},
  "limit": 50,
  "order_by": "created_at",
  "order_direction": "DESC"
}
```

#### Tool 3: `user_data_search`
**File:** `src/main/ai-code/tools/user-data-search.ts`

Full-text search across all columns:
```typescript
{
  name: 'user_data_search',
  parameters: {
    table_name: string;    // Required
    search_query: string;  // Required
    limit?: number;        // Default: 100, Max: 1000
  }
}
```

**Example Usage:**
```json
{
  "table_name": "customers",
  "search_query": "john@example.com",
  "limit": 20
}
```

#### Tool 4: `user_data_aggregate`
**File:** `src/main/ai-code/tools/user-data-aggregate.ts`

Computes statistical aggregations:
```typescript
{
  name: 'user_data_aggregate',
  parameters: {
    table_name: string;         // Required
    column: string;             // Required
    function: string;           // SUM, AVG, COUNT, MIN, MAX
    filters?: object;           // Optional filters
    group_by?: string;          // Optional grouping
  }
}
```

**Example Usage:**
```json
{
  "table_name": "sales",
  "column": "order_total",
  "function": "AVG",
  "filters": {"status": "completed"}
}
```

### 2. Updated Tool Registry

**File:** `src/main/ai-code/tool-executor.ts`

- ✅ Imported new tool classes
- ✅ Registered tools in `registerBuiltinTools()`
- ✅ Added parameter schemas for Gemini
- ✅ Added snake_case to camelCase parameter mapping
- ✅ Created `getUserDataTools()` export function
- ✅ Updated `getToolNamesForContext()` to include 'user-data' context

### 3. Updated System Prompt

**File:** `src/main/ai-code/prompts/system-prompt.ts`

- ✅ Added "User Data Tools" section to available tools list
- ✅ Added example conversations showing tool usage
- ✅ Documented when and how to use each tool

---

## Usage Examples

### Example 1: List Available Tables
**User:** "What data tables do I have?"

**AI Response:**
```
[tool_call: user_data_list_tables]
You have 3 imported data tables:

1. customers (1,523 rows, 8 columns)
   - Imported from: customers_2024.xlsx
   - Columns: id, name, email, phone, status, city, created_at, order_count

2. sales (4,892 rows, 6 columns)
   - Imported from: sales_report_Q4.csv
   - Columns: id, date, customer_id, amount, product, status

3. inventory (234 rows, 5 columns)
   - Imported from: inventory.xlsx
   - Columns: id, sku, product_name, quantity, price
```

### Example 2: Query with Filters
**User:** "Show me customers from New York with more than 10 orders"

**AI Response:**
```
[tool_call: user_data_query with:
  table_name: "customers",
  filters: {"city": "New York", "order_count": ">10"},
  order_by: "order_count",
  order_direction: "DESC"
]

Found 23 customers from New York with 10+ orders:
- John Smith (john@example.com) - 45 orders
- Jane Doe (jane@example.com) - 32 orders
...
```

### Example 3: Statistical Analysis
**User:** "What's the total revenue from completed sales?"

**AI Response:**
```
[tool_call: user_data_aggregate with:
  table_name: "sales",
  column: "amount",
  function: "SUM",
  filters: {"status": "completed"}
]

Total revenue from completed sales: $1,245,892.50
Based on 4,234 completed transactions.
```

### Example 4: Search for Specific Data
**User:** "Find any customer records mentioning 'premium'"

**AI Response:**
```
[tool_call: user_data_search with:
  table_name: "customers",
  search_query: "premium",
  limit: 50
]

Found 12 customers with "premium" in their records:
- Premium account holders
- Notes containing "premium support"
- Premium tier subscriptions
```

### Example 5: Grouped Analysis
**User:** "Break down sales by product category"

**AI Response:**
```
[tool_call: user_data_aggregate with:
  table_name: "sales",
  column: "amount",
  function: "SUM",
  group_by: "product"
]

Sales breakdown by product:
- Laptop: $450,230
- Monitor: $234,890
- Keyboard: $89,450
- Mouse: $45,670
```

---

## Benefits

### 🎯 **Unified AI Assistant**
Your internal AI can now help with both:
- **Code:** Edit files, run commands, analyze project
- **Data:** Query tables, analyze imports, generate insights

### 💡 **Smart Data Analysis**
AI can:
- Automatically discover available tables
- Suggest relevant queries based on conversation
- Combine data analysis with code generation
- Create reports by querying multiple tables

### 🔄 **Seamless Workflow**
Example workflow:
1. User imports Excel file → Creates table
2. User asks AI: "Analyze my sales data"
3. AI discovers table, queries data, provides insights
4. User asks: "Generate a report script"
5. AI writes Python/JS script using the discovered schema

### 🛡️ **Secure by Design**
- Read-only access (no INSERT/UPDATE/DELETE)
- Uses existing security infrastructure
- Respects table permissions
- Proper error handling

---

## Architecture After Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    Internal AI Chat System                       │
│                  (Autonomous Gemini Client)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐    ┌──────────┐    ┌──────────┐
    │  File  │    │ Apps     │    │User Data │
    │ System │    │ Script   │    │  Tools   │
    │ Tools  │    │ Tools    │    │  (NEW!)  │
    └────┬───┘    └────┬─────┘    └────┬─────┘
         │             │               │
         ▼             ▼               ▼
    Project      cloudmcp.db     user_data.db
     Files      (Apps Script)   (Excel/CSV)
```

---

## Before vs After

### BEFORE (Previous Security Analysis)
```
Internal AI Chat:
  ✅ File system access
  ✅ Shell commands
  ✅ AppsScript operations
  ❌ NO user data access  ← This was the limitation
```

### AFTER (Current Implementation)
```
Internal AI Chat:
  ✅ File system access
  ✅ Shell commands
  ✅ AppsScript operations
  ✅ User data queries     ← NOW AVAILABLE!
  ✅ Data analysis
  ✅ Statistical aggregations
```

---

## Complete Tool Set

Your internal AI now has **21 tools** total:

### File System (8 tools)
- read_file
- write_file
- list_directory
- move_file
- partial_edit
- shell_command
- analyze_project
- init_project

### AppsScript (12 tools)
- apps_script_list_files
- apps_script_read_file
- apps_script_write_file
- apps_script_partial_edit
- apps_script_rename_file
- apps_script_delete_file
- apps_script_docs
- apps_script_docs_list
- apps_script_push_to_dev
- apps_script_pull_from_dev
- apps_script_push_dev_to_prod
- apps_script_pull_prod_to_dev

### User Data (4 tools) **← NEW!**
- user_data_list_tables
- user_data_query
- user_data_search
- user_data_aggregate

---

## Testing the Integration

### Test 1: List Tables
Open your internal AI chat and ask:
```
"What data tables do I have available?"
```

Expected behavior:
- AI calls `user_data_list_tables`
- Returns list of imported tables with metadata

### Test 2: Query Data
```
"Show me the first 10 rows from my customers table"
```

Expected behavior:
- AI calls `user_data_query` with table_name="customers", limit=10
- Returns customer records

### Test 3: Search
```
"Find all records containing 'premium' in my customers data"
```

Expected behavior:
- AI calls `user_data_search` with search_query="premium"
- Returns matching records

### Test 4: Analysis
```
"What's the total sales amount from my sales table?"
```

Expected behavior:
- AI calls `user_data_aggregate` with function="SUM"
- Returns total

### Test 5: Combined Workflow
```
"Analyze my sales data and create a Python script to generate a monthly report"
```

Expected behavior:
1. AI queries sales table schema
2. AI analyzes data structure
3. AI generates Python script using discovered columns
4. AI saves script to project

---

## Parameter Mapping

Tools automatically convert between naming conventions:

| Gemini AI (snake_case) | Internal Tool (camelCase) |
|------------------------|---------------------------|
| table_name             | tableName                 |
| search_query           | searchQuery               |
| order_by               | orderBy                   |
| order_direction        | orderDirection            |
| group_by               | groupBy                   |

This happens automatically in `mapParameterNames()`.

---

## Error Handling

### Table Not Found
```json
{
  "error": "Table 'xyz' not found. Use user_data_list_tables to see available tables."
}
```

### Missing Parameters
```json
{
  "error": "tableName parameter is required"
}
```

### Invalid Aggregation
```json
{
  "error": "Invalid function 'AVERAGE'. Must be one of: SUM, AVG, COUNT, MIN, MAX"
}
```

---

## Real-World Use Cases

### 1. **Data-Driven Code Generation**
```
User: "Create a dashboard component for my sales data"

AI:
1. [user_data_list_tables] → Discovers "sales" table
2. [user_data_query] → Examines data structure
3. [write_file] → Creates React component with charts
4. Uses actual column names and data types from schema
```

### 2. **Business Intelligence**
```
User: "What are my top 5 customers by order value?"

AI:
1. [user_data_aggregate] → SUM order_total GROUP BY customer_id
2. [user_data_query] → Get customer details for top 5
3. Returns formatted analysis
```

### 3. **Data Quality Analysis**
```
User: "Check my customer data for duplicates"

AI:
1. [user_data_query] → Get all customer emails
2. [user_data_aggregate] → COUNT GROUP BY email
3. Identifies duplicate email addresses
4. Reports findings
```

### 4. **Report Generation**
```
User: "Generate an Excel report of monthly sales trends"

AI:
1. [user_data_aggregate] → SUM by month
2. Creates Excel export script
3. [write_file] → Saves script
4. [shell_command] → Runs script to generate report
```

---

## Integration Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    User asks question                            │
│              "What's in my customer database?"                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│               Autonomous Gemini Client                           │
│  - Receives system prompt with tool descriptions                │
│  - Decides which tool to use                                    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Tool Registry                                │
│  - Validates tool exists                                        │
│  - Maps parameters (snake_case → camelCase)                     │
│  - Calls tool.execute()                                         │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│              UserDataListTablesTool                             │
│              UserDataQueryTool                                  │
│              UserDataSearchTool                                 │
│              UserDataAggregateTool                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                   SQLiteManager                                  │
│              getUserDataManager()                               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                 UserDataDbManager                                │
│  - getAllTables()                                               │
│  - getTableByName()                                             │
│  - queryData()                                                  │
│  - searchData()                                                 │
│  - aggregate()                                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    user_data.db                                  │
│  - user_tables (metadata)                                       │
│  - import_operations (tracking)                                 │
│  - User-created data tables                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Conversation Examples

### Conversation 1: Data Discovery

**User:** "I imported an Excel file yesterday. Can you help me understand what's in it?"

**AI:**
```
[Calls: user_data_list_tables]

You have a table called "daily_reports" with 156 rows and 12 columns:
- date
- revenue
- expenses
- profit
- customer_count
- order_count
- average_order_value
- region
- product_category
- sales_rep
- notes
- created_at

Would you like me to analyze specific columns or time periods?
```

**User:** "Yes, show me the last 7 days of revenue"

**AI:**
```
[Calls: user_data_query with filters on date]

Here's your revenue for the last 7 days:
- 2024-02-05: $12,450
- 2024-02-06: $15,230
- 2024-02-07: $18,900
- 2024-02-08: $14,670
- 2024-02-09: $16,540
- 2024-02-10: $19,230
- 2024-02-11: $21,450

Total: $118,470
Average: $16,924/day
Trend: +72% week-over-week
```

### Conversation 2: Data + Code

**User:** "Create a dashboard for my sales data"

**AI:**
```
[Calls: user_data_list_tables]
[Calls: user_data_query to examine structure]

I'll create a React dashboard component using your sales table.

[Calls: write_file for SalesDashboard.tsx]

Created components/SalesDashboard.tsx with:
- Real-time data fetching from your sales table
- Charts showing: revenue trends, top products, regional breakdown
- Filters for date range, region, product category
- Uses your actual column names: date, amount, product, region, status

The component queries your imported data using the User Data API.
Ready to integrate into your app!
```

### Conversation 3: Business Intelligence

**User:** "Which product has the highest sales?"

**AI:**
```
[Calls: user_data_aggregate with:
  table_name: "sales",
  column: "amount",
  function: "SUM",
  group_by: "product"
]

Top products by sales revenue:
1. Laptop Pro: $450,230 (234 orders)
2. Monitor XL: $234,890 (567 orders)
3. Keyboard Elite: $89,450 (890 orders)
4. Mouse Premium: $45,670 (456 orders)

The Laptop Pro is your best-selling product with almost 2x the revenue of your #2 product.
```

---

## Security & Privacy

### ✅ **Safe Operations**
- **Read-only:** All tools only read data, never modify
- **No writes:** Cannot INSERT, UPDATE, or DELETE
- **No dangerous SQL:** Only SELECT queries allowed
- **Query limits:** Maximum 1000 rows per query

### 🔒 **Data Protection**
- **Local only:** Data never leaves your machine
- **No external API calls:** Direct SQLite access
- **Same security as other tools:** Uses existing SQLiteManager infrastructure

### ⚙️ **User Control**
Users can still:
- Import/delete tables via UI
- Control what data is imported
- View query logs in console
- Disable tools if needed (modify tool registration)

---

## Performance Considerations

### ✅ **Optimized**
- Uses existing SQLiteManager (already initialized)
- Lazy database connection (only opens when needed)
- Proper pagination for large datasets
- Indexed queries for fast results

### 📊 **Limits**
- Max 1000 rows per query (prevents memory issues)
- JSON serialization for AI-friendly format
- Automatic error handling and recovery

---

## Comparison with External MCP

### Internal AI Tools (NEW)
```typescript
// Direct SQLite access through UserDataDbManager
const manager = getSQLiteManager().getUserDataManager();
const result = manager.queryData(tableId, options);
// Fast, local, no HTTP overhead
```

### External MCP Server (Already Existed)
```typescript
// HTTP API for Claude Desktop, Cursor, etc.
POST http://localhost:3100/user-data/tools/call
// Slower, requires HTTP server, but works with any MCP client
```

### Both Use Same Backend!
```
Internal AI Tools ─┐
                   ├─→ UserDataDbManager ─→ user_data.db
External MCP ──────┘
```

---

## What's Next

### Potential Enhancements

1. **Add More Tools:**
   - `user_data_get_schema` - Get detailed table schema
   - `user_data_sql_query` - Execute custom SELECT queries
   - `user_data_export` - Export query results to file

2. **Enhanced Analysis:**
   - Cross-table joins
   - Time-series analysis
   - Data visualization generation
   - Anomaly detection

3. **Integration Features:**
   - Auto-generate API endpoints from tables
   - Create CRUD components from schema
   - Generate TypeScript types from columns

---

## Files Modified

1. ✅ `src/main/ai-code/tools/user-data-list-tables.ts` (NEW)
2. ✅ `src/main/ai-code/tools/user-data-query.ts` (NEW)
3. ✅ `src/main/ai-code/tools/user-data-search.ts` (NEW)
4. ✅ `src/main/ai-code/tools/user-data-aggregate.ts` (NEW)
5. ✅ `src/main/ai-code/tools/index.ts` (exports)
6. ✅ `src/main/ai-code/tool-executor.ts` (registration + schemas)
7. ✅ `src/main/ai-code/prompts/system-prompt.ts` (documentation + examples)

---

## Conclusion

Your internal AI chat assistant now has **powerful data analysis capabilities**! It can:
- 🔍 Discover and explore imported tables
- 📊 Query and filter data
- 🔎 Search across columns
- 📈 Compute statistics and aggregations
- 💻 Generate data-driven code
- 📝 Create reports and insights

All while maintaining security, performance, and user control. The integration is complete and ready to use! ✅
