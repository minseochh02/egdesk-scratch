import { AIEdit } from '../components/AIEditor/types';
import { fileWriterService } from '../services/fileWriterService';

/**
 * Utility functions for applying code changes safely and efficiently
 */

/**
 * Apply code changes to files with comprehensive error handling and backup
 */
export async function applyCodeChanges(
  edits: AIEdit[],
  options: {
    createBackups?: boolean;
    validateBeforeWrite?: boolean;
    onProgress?: (progress: {
      current: number;
      total: number;
      file: string;
    }) => void;
  } = {},
): Promise<{
  success: boolean;
  modifiedFiles: string[];
  errors: string[];
  backupPaths?: string[];
  summary: string;
}> {
  const {
    createBackups = true,
    validateBeforeWrite = true,
    onProgress,
  } = options;

  console.log(`🚀 Starting to apply ${edits.length} code changes...`);
  console.log(`📋 Options:`, {
    createBackups,
    validateBeforeWrite,
    hasProgressCallback: !!onProgress,
  });

  // Configure the file writer service
  fileWriterService.setBackupEnabled(createBackups);

  try {
    // Validate edits before processing if requested
    if (validateBeforeWrite) {
      const validationResult = validateEdits(edits);
      if (!validationResult.valid) {
        return {
          success: false,
          modifiedFiles: [],
          errors: validationResult.errors,
          summary: `Validation failed: ${validationResult.errors.length} errors found`,
        };
      }
    }

    // Group edits by file for progress reporting
    const fileGroups = groupEditsByFile(edits);
    let currentFileIndex = 0;

    // Apply changes using the file writer service
    const result = await fileWriterService.applyChangesToFiles(edits);

    // Report progress if callback provided
    if (onProgress) {
      for (const [filePath] of fileGroups) {
        currentFileIndex++;
        onProgress({
          current: currentFileIndex,
          total: fileGroups.size,
          file: filePath,
        });
      }
    }

    // Generate summary
    const summary = generateSummary(result, edits.length);

    return {
      ...result,
      summary,
    };
  } catch (error) {
    const errorMessage = `Failed to apply code changes: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('❌', errorMessage);

    return {
      success: false,
      modifiedFiles: [],
      errors: [errorMessage],
      summary: `Operation failed: ${errorMessage}`,
    };
  }
}

/**
 * Apply a single edit to a string content (for in-memory operations)
 */
export function applySingleEdit(
  content: string,
  edit: AIEdit,
): {
  success: boolean;
  content: string;
  error?: string;
} {
  return fileWriterService.applyEditToContent(content, edit);
}

/**
 * Apply multiple edits to string content (for in-memory operations)
 */
export function applyEditsToContent(
  content: string,
  edits: AIEdit[],
): {
  success: boolean;
  content: string;
  errors: string[];
} {
  return fileWriterService.applyEditsToContent(content, edits);
}

/**
 * Create a safe backup of a file before modification
 */
export async function createFileBackup(filePath: string): Promise<{
  success: boolean;
  backupPath?: string;
  error?: string;
}> {
  try {
    // Read the original file
    const readResult = await window.electron.fileSystem.readFile(filePath);
    if (!readResult.success) {
      return {
        success: false,
        error: `Cannot read file for backup: ${readResult.error}`,
      };
    }

    // Generate backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;

    // Write backup
    const writeResult = await window.electron.fileSystem.writeFile(
      backupPath,
      readResult.content || '',
    );

    if (writeResult.success) {
      console.log(`💾 Created backup: ${backupPath}`);
      return {
        success: true,
        backupPath,
      };
    }
    return {
      success: false,
      error: `Failed to write backup: ${writeResult.error}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Backup creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validate edits before applying them
 */
export function validateEdits(edits: AIEdit[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log(`🔍 Validating ${edits.length} edits...`);

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const editId = `Edit #${i + 1}`;

    // Check required fields
    if (!edit.type) {
      errors.push(`${editId}: Missing edit type`);
      continue;
    }

    if (!edit.description) {
      warnings.push(`${editId}: Missing description`);
    }

    // Type-specific validation
    switch (edit.type) {
      case 'replace':
        if (!edit.oldText) {
          errors.push(`${editId}: Replace edit missing oldText`);
        }
        if (!edit.newText && edit.newText !== '') {
          errors.push(`${editId}: Replace edit missing newText`);
        }
        if (!edit.filePath && !edit.range) {
          errors.push(`${editId}: Replace edit needs either filePath or range`);
        }
        break;

      case 'insert':
        if (!edit.newText && edit.newText !== '') {
          errors.push(`${editId}: Insert edit missing newText`);
        }
        if (!edit.range && !edit.filePath) {
          errors.push(`${editId}: Insert edit needs position information`);
        }
        break;

      case 'delete':
        if (!edit.oldText && !edit.range) {
          errors.push(`${editId}: Delete edit needs oldText or range`);
        }
        break;

      case 'create':
        if (!edit.filePath) {
          errors.push(`${editId}: Create edit missing filePath`);
        }
        if (!edit.newText && edit.newText !== '') {
          errors.push(`${editId}: Create edit missing newText`);
        }
        break;

      case 'delete_file':
        if (!edit.filePath) {
          errors.push(`${editId}: Delete file edit missing filePath`);
        }
        break;

      default:
        warnings.push(`${editId}: Unknown edit type: ${edit.type}`);
    }

    // Check for potential conflicts (same file, overlapping ranges)
    if (edit.filePath) {
      const conflictingEdits = edits
        .slice(i + 1)
        .filter(
          (otherEdit) =>
            otherEdit.filePath === edit.filePath &&
            edit.range &&
            otherEdit.range &&
            rangesOverlap(edit.range, otherEdit.range),
        );

      if (conflictingEdits.length > 0) {
        warnings.push(
          `${editId}: Potential conflict with ${conflictingEdits.length} other edit(s) on same file`,
        );
      }
    }
  }

  const valid = errors.length === 0;

  console.log(`✅ Validation complete: ${valid ? 'PASSED' : 'FAILED'}`);
  console.log(
    `📊 Results: ${errors.length} errors, ${warnings.length} warnings`,
  );

  return { valid, errors, warnings };
}

/**
 * Generate a human-readable summary of the operation results
 */
function generateSummary(
  result: {
    success: boolean;
    modifiedFiles: string[];
    errors: string[];
    backupPaths?: string[];
  },
  totalEdits: number,
): string {
  if (result.success) {
    const fileCount = result.modifiedFiles.length;
    const backupCount = result.backupPaths?.length || 0;

    let summary = `✅ Successfully applied ${totalEdits} code change${totalEdits !== 1 ? 's' : ''} to ${fileCount} file${fileCount !== 1 ? 's' : ''}`;

    if (backupCount > 0) {
      summary += ` (${backupCount} backup${backupCount !== 1 ? 's' : ''} created)`;
    }

    return summary;
  }
  const errorCount = result.errors.length;
  const successCount = result.modifiedFiles.length;

  let summary = `❌ Failed to apply code changes: ${errorCount} error${errorCount !== 1 ? 's' : ''}`;

  if (successCount > 0) {
    summary += ` (${successCount} file${successCount !== 1 ? 's' : ''} modified successfully)`;
  }

  return summary;
}

/**
 * Group edits by file path
 */
function groupEditsByFile(edits: AIEdit[]): Map<string, AIEdit[]> {
  const grouped = new Map<string, AIEdit[]>();

  for (const edit of edits) {
    const filePath = edit.filePath || 'unknown';
    if (!grouped.has(filePath)) {
      grouped.set(filePath, []);
    }
    grouped.get(filePath)!.push(edit);
  }

  return grouped;
}

/**
 * Check if two ranges overlap
 */
function rangesOverlap(range1: any, range2: any): boolean {
  if (!range1 || !range2) return false;

  // Check line-based overlap
  if (
    range1.startLine &&
    range1.endLine &&
    range2.startLine &&
    range2.endLine
  ) {
    return !(
      range1.endLine < range2.startLine || range2.endLine < range1.startLine
    );
  }

  // Check character-based overlap
  if (
    typeof range1.start === 'number' &&
    typeof range1.end === 'number' &&
    typeof range2.start === 'number' &&
    typeof range2.end === 'number'
  ) {
    return !(range1.end < range2.start || range2.end < range1.start);
  }

  return false;
}

/**
 * Configuration options for the file writer service
 */
export const codeChangeConfig = {
  /**
   * Enable or disable automatic backups
   */
  setBackupEnabled(enabled: boolean): void {
    fileWriterService.setBackupEnabled(enabled);
  },

  /**
   * Set maximum number of backups to keep
   */
  setMaxBackups(max: number): void {
    fileWriterService.setMaxBackups(max);
  },

  /**
   * Check if backups are enabled
   */
  isBackupEnabled(): boolean {
    return fileWriterService.isBackupEnabled();
  },
};

// Export the file writer service instance for direct access if needed
export { fileWriterService };
