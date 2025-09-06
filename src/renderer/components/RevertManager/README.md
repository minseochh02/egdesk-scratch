# 🔄 AI Change Revert System

A comprehensive system for reverting AI-made changes using backup files that are automatically created when the AI modifies your code.

## Features

### 🔍 **Backup Discovery**
- Automatically finds all backup files in your project
- Supports recursive directory scanning
- Validates backup file integrity
- Sorts backups by timestamp (newest first)

### 🔄 **Smart Revert Operations**
- Revert single files or multiple files at once
- Preview changes before reverting
- Automatic backup of current state before reverting
- Atomic operations with rollback on failure

### 🎯 **Multiple UI Components**
- **RevertManager**: Full-featured modal for managing all backups
- **RevertButton**: Compact button for quick single-file reverts
- Seamless integration with existing AI editor components

### 🛡️ **Safety Features**
- Backup validation before revert operations
- Pre-revert backup creation
- Comprehensive error handling
- Operation history and logging

## Usage

### Quick Revert with RevertButton

```tsx
import { RevertButton } from '../RevertManager';

<RevertButton
  filePath="/path/to/your/file.php"
  projectRoot="/path/to/your/project"
  onRevertComplete={(success, message) => {
    console.log(success ? '✅' : '❌', message);
  }}
  size="small"
  showText={true}
/>
```

### Full Revert Management

```tsx
import { RevertManager } from '../RevertManager';

<RevertManager
  projectRoot="/path/to/your/project"
  onRevertComplete={(result) => {
    if (result.success) {
      console.log(`Reverted ${result.restoredFiles.length} files`);
    }
  }}
  onClose={() => setShowRevertManager(false)}
/>
```

### Direct Service Usage

```tsx
import { revertService } from '../../services/revertService';

// Find backups for a specific file
const backups = await revertService.findBackupsForFile('/path/to/file.php');

// Find all backups in project
const allBackups = await revertService.findAllBackups('/path/to/project');

// Preview a revert operation
const preview = await revertService.getRevertPreview(
  '/path/to/file.php',
  '/path/to/file.php.backup.2025-09-06T09-30-22-151Z'
);

// Revert a single file
const result = await revertService.revertFile(
  '/path/to/file.php',
  '/path/to/file.php.backup.2025-09-06T09-30-22-151Z',
  {
    createBackupOfCurrent: true,
    validateContent: true,
    deleteOriginalBackup: false
  }
);
```

## Backup File Format

The system works with backup files created by the existing FileWriterService:

```
original-file.ext.backup.YYYY-MM-DDTHH-mm-ss-sssZ
```

Example:
```
index.php.backup.2025-09-06T09-30-22-151Z
```

## Integration with AI Editor

The revert system is seamlessly integrated into the DualScreenEditor:

1. **Header Controls**: Quick access to revert current file
2. **Revert Manager Button**: Opens full backup management interface
3. **Notifications**: Real-time feedback on revert operations
4. **Context Awareness**: Automatically detects project root and current files

## API Reference

### RevertService

#### Methods

- `findBackupsForFile(filePath: string): Promise<BackupFile[]>`
- `findAllBackups(projectRoot: string): Promise<Map<string, BackupFile[]>>`
- `revertFile(originalPath: string, backupPath: string, options?: RevertOptions): Promise<RevertResult>`
- `revertMultipleFiles(operations: RevertOperation[], options?: RevertOptions): Promise<RevertResult>`
- `getRevertPreview(originalPath: string, backupPath: string): Promise<PreviewResult>`
- `cleanupBackups(projectRoot: string, options?: CleanupOptions): Promise<CleanupResult>`

#### Types

```typescript
interface BackupFile {
  originalFilePath: string;
  backupFilePath: string;
  timestamp: Date;
  size: number;
  isValid: boolean;
  createdBy?: string;
  operationId?: string;
}

interface RevertResult {
  success: boolean;
  restoredFiles: string[];
  errors: string[];
  summary: string;
}

interface RevertOptions {
  createBackupOfCurrent?: boolean; // Default: true
  deleteOriginalBackup?: boolean;  // Default: false
  validateContent?: boolean;       // Default: true
}
```

## Safety Considerations

1. **Pre-Revert Backups**: The system creates a backup of the current state before reverting
2. **Validation**: Backup files are validated before use
3. **Atomic Operations**: Reverts either succeed completely or fail without changes
4. **Error Recovery**: Failed operations attempt to restore original state
5. **Logging**: Comprehensive logging for debugging and audit trails

## Testing

Use the `RevertTest` component to verify functionality:

```tsx
import RevertTest from './RevertTest';

// Render the test component to run various tests
<RevertTest />
```

The test component provides:
- Backup discovery tests
- Project-wide backup scanning
- Revert preview generation
- Real-time test results

## File Structure

```
RevertManager/
├── index.ts              # Exports
├── RevertManager.tsx     # Full backup management UI
├── RevertManager.css     # Styles for RevertManager
├── RevertButton.tsx      # Compact revert button
├── RevertButton.css      # Styles for RevertButton
├── RevertTest.tsx        # Test component
└── README.md            # This documentation

services/
└── revertService.ts     # Core revert logic
```

## Future Enhancements

- **Git Integration**: Sync with git history
- **Diff Visualization**: Enhanced diff viewing with syntax highlighting
- **Batch Operations**: Revert multiple files based on time ranges
- **Backup Compression**: Compress old backup files to save space
- **Metadata Enhancement**: Store more context about AI operations
- **Conflict Resolution**: Handle conflicts when reverting modified files

## Troubleshooting

### Common Issues

1. **No backups found**: Ensure backup creation is enabled in FileWriterService
2. **Invalid backup files**: Check file permissions and disk space
3. **Revert failures**: Verify target files are not locked by other processes
4. **Path resolution**: Ensure project root is correctly set

### Debug Mode

Enable debug logging by setting:
```javascript
console.log('🔍 DEBUG: Revert operation details');
```

The service provides extensive logging for troubleshooting operations.
