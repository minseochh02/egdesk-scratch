# @egdesk/next-api-plugin

Next.js plugin for EGDesk database proxy integration. Provides middleware-based CORS-free database access for Next.js applications.

## Features

- 🔒 CORS-free database access via Next.js middleware
- 🌐 Works in both local and tunneled environments
- 📝 Type-safe table definitions and helper functions
- 🚀 Auto-discovery of database tables
- 🔧 Zero configuration after setup

## Installation

```bash
npm install @egdesk/next-api-plugin
# or
yarn add @egdesk/next-api-plugin
# or
pnpm add @egdesk/next-api-plugin
```

## Quick Start

1. Run the setup command in your Next.js project:

```bash
npx egdesk-next-setup
```

This will generate:
- `middleware.ts` - Database proxy middleware
- `egdesk.config.ts` - Type-safe table definitions
- `egdesk-helpers.ts` - Helper functions for database access
- `.env.local` - Environment variables

2. Add `.env.local` to your `.gitignore` (if not already there)

3. Restart your Next.js dev server

4. Use the helpers in your components:

```typescript
import { queryTable } from './egdesk-helpers';
import { TABLES } from './egdesk.config';

export default async function MyPage() {
  const data = await queryTable(TABLES.table1.name, { limit: 10 });

  return (
    <div>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

## Configuration

### Environment Variables

The plugin uses Next.js environment variables:

```env
NEXT_PUBLIC_EGDESK_API_URL=http://localhost:8080
NEXT_PUBLIC_EGDESK_API_KEY=your-api-key-here
```

### Custom Setup

You can programmatically run the setup:

```typescript
import { setupNextApiPlugin } from '@egdesk/next-api-plugin';

await setupNextApiPlugin('/path/to/project', {
  egdeskUrl: 'http://localhost:8080',
  apiKey: 'optional-api-key'
});
```

## How It Works

The plugin creates a Next.js middleware that intercepts requests to `__user_data_proxy` and forwards them to your EGDesk MCP server. This allows your Next.js app to make database queries without CORS issues, even in tunneled environments.

**Request Flow:**
1. Your component calls `queryTable()` or other helpers
2. Helper makes a fetch to `__user_data_proxy`
3. Next.js middleware intercepts the request
4. Middleware forwards to `localhost:8080/user-data/tools/call`
5. Response is returned to your component

## API Reference

### Helper Functions

```typescript
// Query table data
queryTable(tableName: string, options?: {
  filters?: Record<string, string>;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
})

// Search table
searchTable(tableName: string, searchQuery: string, limit?: number)

// Aggregate data
aggregateTable(tableName: string, column: string, aggregateFunction: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT', options?: {
  filters?: Record<string, string>;
  groupBy?: string;
})

// Execute raw SQL
executeSQL(query: string)

// List all tables
listTables()

// Get table schema
getTableSchema(tableName: string)
```

### Configuration Types

```typescript
interface TableDefinition {
  name: string;
  displayName: string;
  description?: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
}

const TABLES = {
  table1: TableDefinition,
  table2: TableDefinition,
  // ...
}

const TABLE_NAMES = {
  table1: 'actual_table_name',
  table2: 'another_table_name',
  // ...
}
```

## Troubleshooting

### Middleware not working

Make sure:
- `middleware.ts` is in your project root (not in `src/` or `app/`)
- Your Next.js version is 13.0.0 or higher
- You've restarted your dev server after setup

### CORS errors

If you're still seeing CORS errors:
- Check that middleware.ts was generated correctly
- Verify environment variables are set in `.env.local`
- Make sure you're using the relative URL `__user_data_proxy` (no leading slash)

### Table discovery fails

Ensure:
- EGDesk MCP server is running on `localhost:8080`
- You have tables imported in EGDesk
- API key is correct (if required)

## License

MIT
