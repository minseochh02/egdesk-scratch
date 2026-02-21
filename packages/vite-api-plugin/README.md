# @egdesk/vite-api-plugin

Vite plugin for handling API endpoints in EGDesk tunneled projects. Automatically handles both local development and tunneled URLs.

## Features

- ✅ Define API routes directly in your Vite config
- ✅ Automatic routing for both local (`/api/*`) and tunneled paths (`/t/{id}/p/{name}/api/*`)
- ✅ Support for GET, POST, PUT, DELETE, PATCH methods
- ✅ Automatic JSON body parsing for POST/PUT/PATCH
- ✅ TypeScript support
- ✅ Zero configuration required for basic use
- ✅ **Automatic discovery of EGDesk user-data SQLite tables**
- ✅ **Auto-generates type-safe config files and helper functions**

## Installation

```bash
npm install --save-dev @egdesk/vite-api-plugin
```

## Basic Usage

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { viteApiPlugin, jsonResponse } from '@egdesk/vite-api-plugin';

// Mock data store
let data = {
  users: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ]
};

export default defineConfig({
  plugins: [
    viteApiPlugin({
      routes: [
        {
          path: '/api/users',
          method: 'GET',
          handler: (req, res) => {
            jsonResponse(res, { users: data.users });
          }
        },
        {
          path: '/api/users',
          method: 'POST',
          handler: (req, res, body) => {
            const newUser = { id: data.users.length + 1, ...body };
            data.users.push(newUser);
            jsonResponse(res, { user: newUser }, 201);
          }
        },
        {
          path: '/api/users/:id',
          method: 'DELETE',
          handler: (req, res) => {
            // Extract ID from URL
            const id = parseInt(req.url?.split('/').pop() || '0');
            data.users = data.users.filter(u => u.id !== id);
            jsonResponse(res, { success: true });
          }
        }
      ]
    })
  ]
});
```

## Advanced Usage

### Dynamic Routes

Load routes dynamically from a separate file:

```typescript
// api-routes.ts
import type { ApiRoute } from '@egdesk/vite-api-plugin';

export const routes: ApiRoute[] = [
  // ... your routes
];

// vite.config.ts
import { viteApiPlugin } from '@egdesk/vite-api-plugin';
import { routes } from './api-routes';

export default defineConfig({
  plugins: [
    viteApiPlugin({ routes })
  ]
});
```

### Async Route Loading

```typescript
viteApiPlugin({
  routes: async () => {
    // Load routes from a file, database, etc.
    const { routes } = await import('./api-routes');
    return routes;
  }
})
```

### Debug Mode

Enable debug logging to see request handling:

```typescript
viteApiPlugin({
  routes: [...],
  debug: true
})
```

### Custom Route Matching

Provide a custom route matcher if you need special URL handling:

```typescript
viteApiPlugin({
  routes: [...],
  routeMatcher: (url) => {
    // Custom logic to extract API path from URL
    if (url.startsWith('/custom-api/')) {
      return url.split('?')[0]; // Return path without query params
    }
    return null; // Not an API request
  }
})
```

## EGDesk User Data Integration

The plugin automatically discovers and configures access to your EGDesk SQLite user-data tables when your Vite dev server starts.

### Automatic Setup

When you start your Vite dev server with this plugin installed:

1. **Auto-Discovery**: The plugin connects to your EGDesk HTTP MCP server (default: `http://localhost:8080`)
2. **Table Detection**: Discovers all available user-data tables
3. **File Generation**: Creates three files in your project:
   - `.env.egdesk` - Environment variables with table names and API key
   - `egdesk.config.ts` - Type-safe table definitions
   - `egdesk-helpers.ts` - Helper functions for querying data

### Configuration

```typescript
// vite.config.ts
import { viteApiPlugin } from '@egdesk/vite-api-plugin';

export default defineConfig({
  plugins: [
    viteApiPlugin({
      // User-data auto-setup (enabled by default)
      autoSetupUserData: true,

      // EGDesk HTTP server URL (default: http://localhost:8080)
      egdeskUrl: process.env.VITE_EGDESK_API_URL || 'http://localhost:8080',

      // API key for EGDesk (optional, reads from env)
      egdeskApiKey: process.env.VITE_EGDESK_API_KEY,

      // Your API routes
      routes: [...]
    })
  ]
});
```

### Generated Files

#### `.env.egdesk`

Contains environment variables for your tables:

```env
# EGDesk User Data Configuration
VITE_EGDESK_API_URL=http://localhost:8080
VITE_EGDESK_API_KEY=your-api-key

# Available Tables
VITE_TABLE_1_NAME=sales_data
VITE_MAIN_TABLE=sales_data
```

#### `egdesk.config.ts`

Type-safe table definitions:

```typescript
export const EGDESK_CONFIG = {
  apiUrl: 'http://localhost:8080',
  apiKey: 'your-api-key',
} as const;

export const TABLES = {
  table1: {
    name: 'sales_data',
    displayName: 'Sales Data',
    rowCount: 1500,
    columnCount: 25,
    columns: ['id', '일자', '판매처명', '공급가액', ...]
  }
} as const;
```

#### `egdesk-helpers.ts`

Helper functions for data access:

```typescript
import { queryTable, searchTable, aggregateTable } from './egdesk-helpers';

// Query with filters
const data = await queryTable('sales_data', {
  filters: { '판매처명': 'ACME Corp' },
  limit: 100
});

// Search
const results = await searchTable('sales_data', 'keyword');

// Aggregate
const total = await aggregateTable('sales_data', '공급가액', 'SUM');
```

### Using in API Routes

Combine with API routes to create endpoints that query your EGDesk data:

```typescript
// vite.config.ts
import { viteApiPlugin, jsonResponse } from '@egdesk/vite-api-plugin';
import { queryTable } from './egdesk-helpers';
import { TABLES } from './egdesk.config';

export default defineConfig({
  plugins: [
    viteApiPlugin({
      routes: [
        {
          path: '/api/sales',
          method: 'GET',
          handler: async (req, res) => {
            const data = await queryTable(TABLES.table1.name, {
              limit: 50,
              orderBy: '일자',
              orderDirection: 'DESC'
            });
            jsonResponse(res, data);
          }
        }
      ]
    })
  ]
});
```

### Disable Auto-Setup

If you don't want automatic user-data setup:

```typescript
viteApiPlugin({
  autoSetupUserData: false,
  routes: [...]
})
```

### Manual Setup CLI

You can also manually trigger setup:

```bash
npx egdesk-setup
npx egdesk-setup --api-key YOUR_KEY
npx egdesk-setup --url http://localhost:8080
```

## How It Works

### Local Development

When running locally without the `--base` flag:
- Request: `GET /api/users`
- Plugin matches: `/api/users`
- Handler executes

### Tunneled Development

When running through EGDesk tunnel with `--base /t/vicky-cha4/p/myproject`:
- Request: `GET /t/vicky-cha4/p/myproject/api/users`
- Plugin extracts: `/api/users`
- Handler executes

The plugin automatically handles the base path stripping, so your route handlers work identically in both environments.

## API Reference

### `viteApiPlugin(options)`

Main plugin function.

**Options:**
- `routes?: ApiRoute[] | (() => ApiRoute[] | Promise<ApiRoute[]>)` - API routes to register
- `routeMatcher?: (url: string) => string | null` - Custom route matching function
- `debug?: boolean` - Enable debug logging
- `autoSetupUserData?: boolean` - Automatically discover and setup EGDesk user-data tables (default: `true`)
- `egdeskUrl?: string` - EGDesk HTTP server URL (default: `process.env.VITE_EGDESK_API_URL || 'http://localhost:8080'`)
- `egdeskApiKey?: string` - API key for EGDesk HTTP server (default: `process.env.VITE_EGDESK_API_KEY`)

### `ApiRoute`

Route definition interface:

```typescript
interface ApiRoute {
  path: string;              // API path (e.g., '/api/users')
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: (req, res, body?) => void | Promise<void>;
}
```

### `jsonResponse(res, data, statusCode?)`

Helper function to send JSON responses:

```typescript
jsonResponse(res, { message: 'Success' }, 200);
```

## Integration with Frontend

Use Vite's `BASE_URL` to construct API paths:

```typescript
// React component
const apiUrl = (endpoint: string) => {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL.slice(0, -1)
    : import.meta.env.BASE_URL;
  const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  return `${base}${path}`;
};

// Usage
const response = await fetch(apiUrl('api/users'));
const data = await response.json();
```

## License

MIT
