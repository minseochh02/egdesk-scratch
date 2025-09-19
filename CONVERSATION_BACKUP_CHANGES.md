# Conversation-Based Backup System

## Overview
This update changes the backup system from timestamp-based to conversation-based backups. This ensures that multiple `write_file` calls within a single AI conversation are grouped together in the same backup folder, rather than creating separate timestamped folders for each file operation.

## Changes Made

### 1. Updated Type Definitions
- **File**: `src/main/types/ai-types.ts`
- **Changes**:
  - Added `conversationId?: string` to `ToolCallRequestInfo` interface
  - Updated `ToolExecutor.execute()` method signature to include `conversationId?: string` parameter

### 2. Updated Tool Execution
- **File**: `src/main/ai-services/tool-executor.ts`
- **Changes**:
  - Modified `executeToolCall()` to pass `conversationId` to tool execute methods

### 3. Updated AI Client
- **File**: `src/main/ai-services/gemini-autonomous-client.ts`
- **Changes**:
  - Modified tool call request creation to include `conversationId` from current conversation

### 4. Updated WriteFileTool
- **File**: `src/main/ai-services/tools/write-file.ts`
- **Changes**:
  - Updated `execute()` method signature to accept `conversationId`
  - Modified `createBackup()` method to use conversation ID instead of timestamp
  - Backup folder naming: `conversation-{conversationId}-backup` instead of `{timestamp}-backup`

### 5. Updated CreateHistoryManager
- **File**: `src/main/create-history.ts`
- **Changes**:
  - Added `conversationId?: string` to `CreateHistoryParams` interface
  - Updated backup folder creation to use conversation ID
  - Backup folder naming: `conversation-{conversationId}-backup` instead of `{timestamp}-backup`

### 6. Updated All Tool Classes
- **Files**: All tool classes in `src/main/ai-services/tools/`
- **Changes**:
  - Updated `execute()` method signatures to include `conversationId?: string` parameter

## Backup Folder Structure

### Before (Timestamp-based)
```
.backup/
  ├── 2024-01-15T10-30-45-123Z-backup/
  │   └── file1.txt
  ├── 2024-01-15T10-30-46-456Z-backup/
  │   └── file2.txt
  └── 2024-01-15T10-30-47-789Z-backup/
      └── file3.txt
```

### After (Conversation-based)
```
.backup/
  └── conversation-abc123-def456-backup/
      ├── file1.txt
      ├── file2.txt
      └── file3.txt
```

## Benefits

1. **Better Organization**: All files modified in a single conversation are grouped together
2. **Easier Recovery**: Users can easily find all changes made during a specific conversation
3. **Reduced Clutter**: Fewer backup folders created during multi-file operations
4. **Better Context**: Backup folders are named with conversation IDs, making them more meaningful

## Fallback Behavior

If no `conversationId` is provided (e.g., for legacy calls or direct tool usage), the system falls back to timestamp-based naming:
- `timestamp-{ISO-timestamp}-backup`

## Testing

A test script is provided at `test-conversation-backup.js` to verify the functionality. Run it to ensure multiple write operations in the same conversation use the same backup folder.
