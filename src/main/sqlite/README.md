# SQLite Manager for AI Chat Storage

## Overview

The SQLite system is managed through a central `SQLiteManager` singleton that provides a unified API for AI chat storage operations. This makes the code more maintainable and provides a single entry point for all SQLite functionality.

## Architecture

```
SQLiteManager (Singleton)
├── Database Connection (better-sqlite3)
├── Conversations Table
└── Messages Table
```

## Database Schema

### Conversations Table
- `id` (TEXT PRIMARY KEY) - Unique conversation identifier
- `title` (TEXT) - Optional conversation title
- `created_at` (DATETIME) - Creation timestamp
- `updated_at` (DATETIME) - Last update timestamp
- `project_context` (TEXT) - JSON string for project context
- `is_active` (BOOLEAN) - Whether conversation is active

### Messages Table
- `id` (TEXT PRIMARY KEY) - Unique message identifier
- `conversation_id` (TEXT) - Foreign key to conversations
- `role` (TEXT) - 'user' or 'model'
- `content` (TEXT) - Message content
- `timestamp` (DATETIME) - Message timestamp
- `tool_call_id` (TEXT) - Optional tool call identifier
- `tool_status` (TEXT) - Tool execution status
- `metadata` (TEXT) - JSON string for additional data

## Usage

### 1. Getting the Manager Instance

```typescript
import { getSQLiteManager } from './sqlite/sqlite-manager';

const sqliteManager = getSQLiteManager();
```

### 2. Initialization

```typescript
// Initialize SQLite database
const result = await sqliteManager.initialize();
if (!result.success) {
  console.error('SQLite initialization failed:', result.error);
}
```

### 3. Basic Operations

```typescript
// Check if SQLite is available
if (sqliteManager.isAvailable()) {
  console.log('SQLite is ready');
} else {
  console.log('SQLite not available:', sqliteManager.getInitializationError());
}

// Get database status
const status = sqliteManager.getStatus();
console.log('Database path:', status.databasePath);
console.log('Database size:', sqliteManager.getDatabaseSize(), 'MB');
```

### 4. Database Access

```typescript
// Get database instance for direct operations
const db = sqliteManager.getDatabase();

// Example: Create a conversation
const conversationId = 'conv_' + Date.now();
const stmt = db.prepare(`
  INSERT INTO conversations (id, title, project_context) 
  VALUES (?, ?, ?)
`);
stmt.run(conversationId, 'My AI Chat', JSON.stringify({ project: 'my-project' }));

// Example: Add a message
const messageId = 'msg_' + Date.now();
const messageStmt = db.prepare(`
  INSERT INTO messages (id, conversation_id, role, content) 
  VALUES (?, ?, ?, ?)
`);
messageStmt.run(messageId, conversationId, 'user', 'Hello AI!');
```

## Benefits

1. **Single Entry Point**: All SQLite operations go through one manager
2. **Singleton Pattern**: Ensures only one instance exists
3. **Error Handling**: Centralized error handling and initialization
4. **Type Safety**: Full TypeScript support
5. **Maintainability**: Easy to add new features or modify existing ones
6. **Testing**: Easy to mock and test
7. **Resource Management**: Centralized cleanup and resource management

## Database Location

The SQLite database is stored at:
```
~/Library/Application Support/EGDesk/ai-chat/ai-chat.db
```

## Error Handling

The manager provides graceful error handling:
- Initialization errors are captured and can be retrieved
- Individual operations throw descriptive errors
- Fallback mechanisms for when SQLite is not available

## Performance Features

- **Indexes**: Optimized for common queries
- **Triggers**: Automatic timestamp updates
- **Foreign Keys**: Data integrity constraints
- **Prepared Statements**: Efficient query execution