# Activity Logging System Guide

This guide documents the Activity Logging system implemented in EGDesk. The system uses a dedicated SQLite database (`activity.db`) to store logs separately from application data, ensuring that logging operations do not impact the performance of core features.

## Overview

The activity logger is designed to help debug user issues by tracking what actions were taken leading up to a problem. It supports structured logging with JSON details, status tracking, and error reporting.

### Database Schema

The `activity_logs` table contains the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | TEXT | UUID of the log entry |
| `type` | TEXT | Category (e.g., 'user', 'system', 'error', 'audit') |
| `action` | TEXT | The specific action taken (e.g., 'login', 'click', 'save_post') |
| `target` | TEXT | Optional target of the action (e.g., button ID, file path) |
| `details` | JSON | Optional JSON object with arbitrary context |
| `status` | TEXT | Status: 'success', 'failure', 'pending', 'info' |
| `error_message` | TEXT | Description of error if status is failure |
| `user_id` | TEXT | Optional ID of the user performing the action |
| `created_at` | DATETIME | Timestamp (default: current time) |
| `metadata` | JSON | Extra metadata |

## Usage

### 1. Logging from the Main Process

Use the `SQLiteManager` singleton to access the activity manager.

```typescript
import { getSQLiteManager } from './sqlite/manager';

// Basic info log
getSQLiteManager().getActivityManager().createActivity({
  type: 'system',
  action: 'startup',
  status: 'success',
  details: { version: '1.0.0' }
});

// Error logging
try {
  // ... risky operation ...
} catch (error) {
  getSQLiteManager().getActivityManager().createActivity({
    type: 'error',
    action: 'process_image',
    target: '/path/to/image.png',
    status: 'failure',
    errorMessage: error.message,
    details: { stack: error.stack }
  });
}
```

### 2. Logging from the Renderer Process (UI)

Use the IPC handlers exposed via `window.electron.invoke`.

> **Note**: Ensure your `preload.ts` exposes an `invoke` method or specific wrappers for these channels.

#### Log a User Action
```typescript
// Inside a React component or event handler
const handleSave = async () => {
  // Log the attempt
  await window.electron.invoke('sqlite-activity-create', {
    type: 'user',
    action: 'click_save',
    target: 'settings_form',
    status: 'pending'
  });

  try {
    await saveSettings();
    
    // Log success
    await window.electron.invoke('sqlite-activity-create', {
      type: 'user',
      action: 'save_settings',
      status: 'success'
    });
  } catch (e) {
    // Log failure
    await window.electron.invoke('sqlite-activity-create', {
      type: 'user',
      action: 'save_settings',
      status: 'failure',
      errorMessage: e.message
    });
  }
};
```

### 3. Viewing Logs

You can retrieve recent logs to display in an admin view or for debugging.

```typescript
// Get last 100 logs
const logs = await window.electron.invoke('sqlite-activity-get-recent', 100, 0);

// Get logs with filters
const errorLogs = await window.electron.invoke('sqlite-activity-get-recent', 50, 0, {
  status: 'failure'
});

console.table(logs);
```

## Maintenance

The system includes a method to clean up old logs to prevent the database from growing too large.

```typescript
// In a scheduled background task (Main Process)
import { getSQLiteManager } from './sqlite/manager';

// Keep logs for 30 days
getSQLiteManager().getActivityManager().clearOldLogs(30);
```

## Real-World Example: EGBlogging Component

Here's how activity logging was implemented in `EGBlogging.tsx`:

### Step 1: Create a Helper Function

```typescript
/**
 * Helper function to log activities to the activity log system
 */
const logActivity = async (
  type: string,
  action: string,
  status: 'success' | 'failure' | 'pending' | 'info',
  options?: {
    target?: string;
    details?: any;
    errorMessage?: string;
  }
): Promise<void> => {
  try {
    if (window.electron?.invoke) {
      await window.electron.invoke('sqlite-activity-create', {
        type,
        action,
        status,
        target: options?.target,
        details: options?.details,
        errorMessage: options?.errorMessage,
      });
    }
  } catch (error) {
    // Silently fail - don't let logging errors break the app
    console.warn('Failed to log activity:', error);
  }
};
```

### Step 2: Log Component Lifecycle Events

```typescript
useEffect(() => {
  const loadConnections = async () => {
    await logActivity('system', 'egblogging_component_mount', 'pending');
    
    try {
      // ... component initialization logic ...
      await logActivity('system', 'egblogging_component_mount', 'success');
    } catch (err) {
      await logActivity('error', 'egblogging_component_mount', 'failure', {
        errorMessage: err.message,
        details: { stack: err.stack }
      });
    }
  };
  
  loadConnections();
}, []);
```

### Step 3: Log User Actions

```typescript
const handleViewConnection = (connection: BlogConnection) => {
  logActivity('user', 'view_connection', 'info', {
    target: connection.id,
    details: {
      connectionName: connection.name,
      connectionType: connection.type
    }
  });
  setSelectedConnection(connection);
  setCurrentView('connection-dashboard');
};

const handleTestConnection = async (connection: BlogConnection) => {
  await logActivity('user', 'test_connection', 'pending', {
    target: connection.id,
    details: { connectionName: connection.name }
  });
  
  try {
    // ... test logic ...
    await logActivity('user', 'test_connection', 'success', {
      target: connection.id
    });
  } catch (err) {
    await logActivity('user', 'test_connection', 'failure', {
      target: connection.id,
      errorMessage: err.message
    });
  }
};
```

### Step 4: Log Async Operations with Status Tracking

```typescript
const checkExistingConnections = async () => {
  await logActivity('system', 'check_existing_connections', 'pending');
  
  try {
    // ... load connections ...
    
    await logActivity('system', 'check_existing_connections', 'success', {
      details: {
        totalConnections: allConnections.length,
        wordpressCount: allConnections.filter(c => c.type === 'wordpress').length
      }
    });
  } catch (err) {
    await logActivity('error', 'check_existing_connections', 'failure', {
      errorMessage: err.message,
      details: { stack: err.stack }
    });
  }
};
```

### Key Patterns from This Example

1. **Helper Function**: Create a reusable `logActivity` helper that wraps the IPC call and handles errors gracefully.
2. **Lifecycle Logging**: Log component mount/unmount and initialization steps.
3. **User Action Logging**: Log all user interactions (clicks, navigation, form submissions).
4. **Async Operation Tracking**: Use 'pending' → 'success'/'failure' pattern for async operations.
5. **Error Context**: Always include error messages and stack traces when logging failures.
6. **Rich Details**: Include relevant context in the `details` object (connection IDs, names, counts, etc.).

## Best Practices

1.  **Be Specific**: Use clear `action` names (e.g., `blog_post_generate` instead of just `generate`).
2.  **Include Context**: Use the `details` object to store relevant IDs, configuration names, or state that helps reproduce the issue.
3.  **Don't Log Sensitive Data**: Avoid putting passwords, tokens, or full file contents in the `details` field.
4.  **Log the "Why"**: When logging errors, include the error message and stack trace if possible.
5.  **Use Appropriate Types**: 
   - `'user'` for user-initiated actions
   - `'system'` for system/background operations
   - `'error'` for error conditions
   - `'audit'` for security-sensitive operations
6.  **Don't Break the App**: Always wrap logging in try-catch or use a helper that fails silently.

