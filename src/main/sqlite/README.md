# SQLite Manager Architecture

## Overview

The SQLite system is now managed through a central `SQLiteManager` singleton that provides a unified API for all database operations. This makes the code more maintainable and provides a single entry point for all SQLite functionality.

## Architecture

```
SQLiteManager (Singleton)
├── WordPressSQLiteManager (WordPress data)
└── WordPressExportUtils (Export functionality)
```

## Usage

### 1. Getting the Manager Instance

```typescript
import { getSQLiteManager } from './sqlite/sqlite-manager';

const sqliteManager = getSQLiteManager();
```

### 2. Initialization

```typescript
// Initialize all SQLite components
const result = await sqliteManager.initialize();
if (!result.success) {
  console.error('SQLite initialization failed:', result.error);
}
```

### 3. WordPress Operations

```typescript
// Save a post
const post: WordPressPost = {
  id: 123,
  title: 'My Post',
  content: '<p>Post content</p>',
  // ... other fields
};
sqliteManager.savePost(post);

// Get posts for a site
const posts = sqliteManager.getPostsBySite('site-123', 50, 0);

// Save media
const media: WordPressMedia = {
  id: 456,
  title: 'Image',
  source_url: 'https://example.com/image.jpg',
  local_data: Buffer.from('...'),
  // ... other fields
};
sqliteManager.saveMedia(media);
```

### 4. Sync Operations

```typescript
// Create a sync operation
const operationId = sqliteManager.createSyncOperation({
  site_id: 'site-123',
  site_name: 'My Site',
  operation_type: 'full_sync',
  status: 'pending',
  start_time: new Date().toISOString(),
  total_posts: 100,
  synced_posts: 0,
  total_media: 50,
  synced_media: 0,
  errors: '[]',
  export_format: 'wordpress'
});

// Update sync progress
sqliteManager.updateSyncOperation(operationId, {
  synced_posts: 25,
  status: 'running'
});
```

### 5. Export Operations

```typescript
// Export to WordPress XML
const result = await sqliteManager.exportPostsToWordPressXML('site-123', '/path/to/export.xml');

// Export to Markdown
const result = await sqliteManager.exportPostsToMarkdown('site-123', '/path/to/markdown/');

// Export to JSON
const result = await sqliteManager.exportPostsToJSON('site-123', '/path/to/posts.json');
```

### 6. Statistics and Monitoring

```typescript
// Get sync statistics
const stats = sqliteManager.getSyncStats('site-123');
console.log(`Total posts: ${stats.totalPosts}`);
console.log(`Total media: ${stats.totalMedia}`);

// Get database statistics
const dbStats = sqliteManager.getDatabaseStats();
console.log(`Database size: ${dbStats.databaseSize} bytes`);

// Check if SQLite is available
if (sqliteManager.isAvailable()) {
  console.log('SQLite is ready');
} else {
  console.log('SQLite not available:', sqliteManager.getInitializationError());
}
```

### 7. Database Maintenance

```typescript
// Optimize database
sqliteManager.optimize();

// Vacuum database
sqliteManager.vacuum();

// Backup database
const backupResult = await sqliteManager.backup('/path/to/backup.db');

// Restore from backup
const restoreResult = await sqliteManager.restore('/path/to/backup.db');
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
~/Library/Application Support/egdesk/wordpress-sync/wordpress-sync.db
```

## Error Handling

The manager provides graceful error handling:
- Initialization errors are captured and can be retrieved
- Individual operations throw descriptive errors
- Fallback mechanisms for when SQLite is not available
