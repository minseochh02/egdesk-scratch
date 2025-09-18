# WordPress Data Storage Analysis

**Date:** September 18, 2025  
**Status:** Analysis Complete  
**Recommendation:** Remove unused SQLite WordPress system

## Overview

The EGDesk application currently has **two separate storage systems** for WordPress data, but only one is actually being used. This document analyzes the current state and provides recommendations for cleanup.

## Current Storage Systems

### 1. ✅ Electron Store (ACTIVELY USED)

**Location:** `/Users/minseocha/Library/Application Support/EGDesk/config.json`

**Data Stored:**
- `wordpressConnections[]` - WordPress site connections, credentials, metadata
- `scheduledTasks[]` - Blog posting schedules and task configurations
- `taskExecutions[]` - Execution history for scheduled tasks
- `userPreferences` - App settings and preferences

**Usage:**
- ✅ WordPress connections are saved via `window.electron.wordpress.saveConnection()`
- ✅ All UI components use Electron Store for WordPress data
- ✅ Task scheduling uses Electron Store for persistence
- ✅ Data persists across app restarts

**File Size:** ~348KB (contains actual data)

### 2. ❌ SQLite Database (UNUSED)

**Location:** `/Users/minseocha/Library/Application Support/EGDesk/wordpress-sync/wordpress-sync.db`

**Database Tables:**
- `wordpress_posts` - For storing synced blog posts (0 records)
- `wordpress_media` - For storing media files (0 records)
- `sync_operations` - For tracking sync operations (0 records)
- `sync_file_details` - For individual file sync records (0 records)

**Infrastructure:**
- ✅ Database properly initialized
- ✅ All tables created with proper schemas
- ✅ IPC handlers implemented (`wp-sync-*` endpoints)
- ❌ **Never called from UI components**
- ❌ **Contains zero data**

**File Size:** 88KB (empty database with just table structures)

## Code Analysis

### Electron Store Usage (Active)

```typescript
// WordPress connections saved to Electron Store
const saveResult = await window.electron.wordpress.saveConnection(newSite);

// Data retrieved from Electron Store
const connections = this.store.get('wordpressConnections', []);
```

### SQLite Usage (Inactive)

```typescript
// SQLite handlers exist but are never called
ipcMain.handle('wp-sync-save-post', async (event, post) => {
  this.getSQLiteManager().savePost(post); // Never executed
});

ipcMain.handle('wp-sync-get-posts', async (event, siteId) => {
  const posts = this.getSQLiteManager().getPostsBySite(siteId); // Never called
});
```

## Files Involved

### Electron Store System
- `src/main/storage.ts` - Store initialization
- `src/main/wordpress/wordpress-handler.ts` - WordPress connection handlers
- `src/renderer/components/BlogManager/WordPressConnector.tsx` - UI using store
- `src/renderer/components/BlogManager/WordPressSitesList.tsx` - UI using store

### SQLite System (Unused)
- `src/main/sqlite/sqlite-manager.ts` - Central SQLite manager
- `src/main/sqlite/wordpress-sqlite-manager.ts` - WordPress-specific SQLite operations
- `src/main/sqlite/wordpress-export-utils.ts` - Export utilities
- `src/main/sqlite/README.md` - Documentation

## Database Verification

```bash
# Check database contents
sqlite3 "/Users/minseocha/Library/Application Support/EGDesk/wordpress-sync/wordpress-sync.db" 
"SELECT COUNT(*) as posts FROM wordpress_posts; 
 SELECT COUNT(*) as media FROM wordpress_media; 
 SELECT COUNT(*) as operations FROM sync_operations;"

# Results: 0, 0, 0 (all tables empty)
```

## Recommendations

### Option 1: Remove SQLite WordPress System (Recommended)

**Pros:**
- Eliminates unused code complexity
- Reduces bundle size
- Simplifies maintenance
- Removes empty 88KB database file

**Cons:**
- Loses potential for future sync functionality
- Removes infrastructure for offline WordPress data

**Files to Remove:**
- `src/main/sqlite/wordpress-sqlite-manager.ts`
- `src/main/sqlite/wordpress-export-utils.ts`
- SQLite WordPress-related code from `sqlite-manager.ts`
- WordPress sync IPC handlers from `wordpress-handler.ts`

### Option 2: Implement SQLite Usage

**Pros:**
- Enables offline WordPress data storage
- Provides better data organization
- Allows for advanced sync operations

**Cons:**
- Requires significant UI development
- Adds complexity to current simple workflow
- May not provide value for current use case

## Current Workflow

1. **User connects to WordPress site** → Data saved to Electron Store
2. **User schedules blog posts** → Tasks saved to Electron Store  
3. **Scheduled tasks execute** → Results logged to Electron Store
4. **SQLite database** → Remains completely unused

## Decision Factors

- **Current functionality works perfectly** with Electron Store
- **No user complaints** about data storage
- **SQLite adds complexity** without providing value
- **88KB empty database** is wasteful
- **Future sync features** can be added later if needed

## Conclusion

The SQLite WordPress system is **legacy infrastructure** that was prepared but never implemented in the UI. All WordPress functionality currently works through the Electron Store, which is simpler and sufficient for the current needs.

**Recommendation:** Remove the unused SQLite WordPress system to clean up the codebase and eliminate unnecessary complexity.

---

**Next Steps:**
1. Confirm removal decision with team
2. Backup any important SQLite schemas if needed
3. Remove SQLite WordPress files and handlers
4. Update documentation
5. Test application functionality after cleanup
