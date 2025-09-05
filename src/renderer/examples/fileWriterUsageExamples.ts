/**
 * Usage Examples for the Enhanced File Writer Service
 * 
 * This file demonstrates how to use the new file writing functionality
 * that can apply code changes safely with backup and validation.
 */

import { AIEdit } from '../components/AIEditor/types';
import { applyCodeChanges, applySingleEdit, applyEditsToContent, validateEdits, createFileBackup, codeChangeConfig } from '../utils/codeChangeUtils';

/**
 * Example 1: Apply a simple search and replace operation
 */
export async function exampleSearchReplace() {
  console.log('📝 Example 1: Search and Replace');
  
  const edits: AIEdit[] = [
    {
      type: 'replace',
      filePath: 'src/components/Button.tsx',
      oldText: 'className="btn-primary"',
      newText: 'className="btn-primary btn-lg"',
      description: 'Add large size class to primary button'
    }
  ];

  const result = await applyCodeChanges(edits, {
    createBackups: true,
    validateBeforeWrite: true,
    onProgress: (progress) => {
      console.log(`Progress: ${progress.current}/${progress.total} - ${progress.file}`);
    }
  });

  console.log('Result:', result.summary);
  if (!result.success) {
    console.error('Errors:', result.errors);
  }
}

/**
 * Example 2: Create a new file
 */
export async function exampleCreateFile() {
  console.log('📝 Example 2: Create New File');
  
  const edits: AIEdit[] = [
    {
      type: 'create',
      filePath: 'src/utils/newUtility.ts',
      newText: `/**
 * New utility functions
 */

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
`,
      description: 'Create new utility file with date and string functions'
    }
  ];

  const result = await applyCodeChanges(edits);
  console.log('Result:', result.summary);
}

/**
 * Example 3: Multiple edits to the same file
 */
export async function exampleMultipleEdits() {
  console.log('📝 Example 3: Multiple Edits to Same File');
  
  const edits: AIEdit[] = [
    {
      type: 'replace',
      filePath: 'src/components/Header.tsx',
      range: { startLine: 10, endLine: 10 },
      oldText: 'const [isOpen, setIsOpen] = useState(false);',
      newText: 'const [isOpen, setIsOpen] = useState(false);\n  const [isLoading, setIsLoading] = useState(false);',
      description: 'Add loading state to Header component'
    },
    {
      type: 'replace',
      filePath: 'src/components/Header.tsx',
      range: { startLine: 25, endLine: 25 },
      oldText: '<button onClick={() => setIsOpen(!isOpen)}>',
      newText: '<button onClick={() => setIsOpen(!isOpen)} disabled={isLoading}>',
      description: 'Disable button when loading'
    }
  ];

  const result = await applyCodeChanges(edits, {
    createBackups: true,
    validateBeforeWrite: true
  });

  console.log('Result:', result.summary);
  console.log('Modified files:', result.modifiedFiles);
  console.log('Backup paths:', result.backupPaths);
}

/**
 * Example 4: In-memory content editing (no file I/O)
 */
export function exampleInMemoryEditing() {
  console.log('📝 Example 4: In-Memory Content Editing');
  
  const originalContent = `function greet(name) {
  console.log("Hello, " + name);
}`;

  const edit: AIEdit = {
    type: 'replace',
    oldText: 'console.log("Hello, " + name);',
    newText: 'console.log(`Hello, ${name}!`);',
    description: 'Convert to template literal and add exclamation'
  };

  const result = applySingleEdit(originalContent, edit);
  
  if (result.success) {
    console.log('✅ Edit applied successfully');
    console.log('Original:', originalContent);
    console.log('Modified:', result.content);
  } else {
    console.error('❌ Edit failed:', result.error);
  }
}

/**
 * Example 5: Validation before applying edits
 */
export function exampleValidation() {
  console.log('📝 Example 5: Edit Validation');
  
  const edits: AIEdit[] = [
    {
      type: 'replace',
      // Missing required fields to demonstrate validation
      oldText: 'old text',
      description: 'This edit is missing filePath and newText'
    } as AIEdit,
    {
      type: 'create',
      filePath: 'src/test.ts',
      newText: 'console.log("test");',
      description: 'Valid create edit'
    },
    {
      type: 'invalid_type' as any,
      description: 'This edit has an invalid type'
    } as AIEdit
  ];

  const validation = validateEdits(edits);
  
  console.log('Validation result:', validation.valid ? 'PASSED' : 'FAILED');
  
  if (validation.errors.length > 0) {
    console.log('❌ Errors:');
    validation.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (validation.warnings.length > 0) {
    console.log('⚠️ Warnings:');
    validation.warnings.forEach(warning => console.log(`  - ${warning}`));
  }
}

/**
 * Example 6: Manual backup creation
 */
export async function exampleBackup() {
  console.log('📝 Example 6: Manual Backup Creation');
  
  const filePath = 'src/important-file.ts';
  
  const backupResult = await createFileBackup(filePath);
  
  if (backupResult.success) {
    console.log('✅ Backup created:', backupResult.backupPath);
  } else {
    console.error('❌ Backup failed:', backupResult.error);
  }
}

/**
 * Example 7: Configuration management
 */
export function exampleConfiguration() {
  console.log('📝 Example 7: Configuration Management');
  
  // Check current backup setting
  console.log('Backup enabled:', codeChangeConfig.isBackupEnabled());
  
  // Disable backups temporarily
  codeChangeConfig.setBackupEnabled(false);
  console.log('Backup disabled');
  
  // Set maximum number of backups
  codeChangeConfig.setMaxBackups(5);
  console.log('Max backups set to 5');
  
  // Re-enable backups
  codeChangeConfig.setBackupEnabled(true);
  console.log('Backup re-enabled');
}

/**
 * Example 8: Complex multi-file operation
 */
export async function exampleComplexOperation() {
  console.log('📝 Example 8: Complex Multi-File Operation');
  
  const edits: AIEdit[] = [
    // Update component
    {
      type: 'replace',
      filePath: 'src/components/UserProfile.tsx',
      oldText: 'interface UserProps {',
      newText: 'interface UserProps {\n  avatar?: string;',
      description: 'Add optional avatar prop to UserProfile'
    },
    
    // Update styles
    {
      type: 'replace',
      filePath: 'src/components/UserProfile.css',
      oldText: '.user-profile {',
      newText: '.user-profile {\n  position: relative;',
      description: 'Add relative positioning to user profile'
    },
    
    // Add new CSS for avatar
    {
      type: 'insert',
      filePath: 'src/components/UserProfile.css',
      newText: `

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  position: absolute;
  top: 10px;
  right: 10px;
}`,
      description: 'Add avatar styles'
    },
    
    // Update test file
    {
      type: 'replace',
      filePath: 'src/components/__tests__/UserProfile.test.tsx',
      oldText: 'const defaultProps = {',
      newText: 'const defaultProps = {\n  avatar: "https://example.com/avatar.jpg",',
      description: 'Add avatar to test props'
    }
  ];

  const result = await applyCodeChanges(edits, {
    createBackups: true,
    validateBeforeWrite: true,
    onProgress: (progress) => {
      const percentage = Math.round((progress.current / progress.total) * 100);
      console.log(`📊 Progress: ${percentage}% - Processing ${progress.file}`);
    }
  });

  console.log('🎯 Operation completed:', result.summary);
  
  if (result.success) {
    console.log('✅ Successfully modified files:');
    result.modifiedFiles.forEach(file => console.log(`  - ${file}`));
    
    if (result.backupPaths && result.backupPaths.length > 0) {
      console.log('💾 Backups created:');
      result.backupPaths.forEach(backup => console.log(`  - ${backup}`));
    }
  } else {
    console.log('❌ Operation failed with errors:');
    result.errors.forEach(error => console.log(`  - ${error}`));
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🚀 Running all File Writer Service examples...\n');
  
  try {
    exampleInMemoryEditing();
    console.log('\n' + '='.repeat(50) + '\n');
    
    exampleValidation();
    console.log('\n' + '='.repeat(50) + '\n');
    
    exampleConfiguration();
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Note: File I/O examples are commented out to prevent actual file modifications
    // Uncomment these if you want to test with actual files:
    
    // await exampleSearchReplace();
    // console.log('\n' + '='.repeat(50) + '\n');
    
    // await exampleCreateFile();
    // console.log('\n' + '='.repeat(50) + '\n');
    
    // await exampleMultipleEdits();
    // console.log('\n' + '='.repeat(50) + '\n');
    
    // await exampleBackup();
    // console.log('\n' + '='.repeat(50) + '\n');
    
    // await exampleComplexOperation();
    
    console.log('✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Make examples available globally for testing in browser console
if (typeof window !== 'undefined') {
  (window as any).fileWriterExamples = {
    exampleSearchReplace,
    exampleCreateFile,
    exampleMultipleEdits,
    exampleInMemoryEditing,
    exampleValidation,
    exampleBackup,
    exampleConfiguration,
    exampleComplexOperation,
    runAllExamples
  };
  
  console.log('🧪 File Writer examples available at: window.fileWriterExamples');
}
