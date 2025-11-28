# AppsScript Tools Development Guide

This guide explains how to create AI tools that allow the AI to read and interact with Google AppsScript files via tool calls. Each AppsScript operation should have its own dedicated tool, following the same pattern as the existing file system tools in `src/main/ai-code/tools/`.

## Overview

The AI tool system allows the AI to execute tools during conversations. Currently, tools exist for local file system operations:
- `read_file` - Read file contents
- `write_file` - Write file contents
- `list_directory` - List directory contents
- `partial_edit` - Edit file with search/replace
- `move_file` - Move/rename files

This guide shows how to create corresponding AppsScript tools:
- `apps_script_list_files` - List files in AppsScript project
- `apps_script_read_file` - Read file from AppsScript project
- `apps_script_write_file` - Write file to AppsScript project
- `apps_script_partial_edit` - Edit file in AppsScript project
- `apps_script_rename_file` - Rename file in AppsScript project

## Important: SQLite Storage

**All AppsScript content is stored in the EGDesk app's SQLite database (`cloudmcp.db`).**

The AppsScript tools access script content from the `template_copies` table in the `cloudmcp.db` database, which is located at:
- **Database Path**: `{userData}/database/cloudmcp.db`
- **Table**: `template_copies`
- **Key Column**: `script_id` - The AppsScript project ID
- **Content Column**: `script_content` - JSON string containing the full AppsScript project content with files array

The tools use `SQLiteTemplateCopiesManager` to query and update this data. When you provide a `script_id` to any AppsScript tool, it will look up the corresponding template copy record in the database.

## Architecture

### Tool System Components

1. **Tool Executor** (`src/main/ai-code/tool-executor.ts`)
   - Registers and manages all tools
   - Executes tool calls from the AI
   - Maps parameters between AI format (snake_case) and internal format (camelCase)

2. **Tool Interface** (`src/main/types/ai-types.ts`)
   - `ToolExecutor` interface that all tools must implement
   - `ToolDefinition` for tool metadata
   - `ToolCallRequestInfo` and `ToolCallResponseInfo` for execution tracking

3. **SQLite Database** (`src/main/sqlite/`)
   - Stores AppsScript content in `cloudmcp.db` database
   - `SQLiteTemplateCopiesManager` provides access to template copies
   - Script content stored in `template_copies` table with `script_content` JSON column

## SQLite Database Access

All AppsScript tools use the SQLite database to access script content. The tools use the following pattern:

1. **Get SQLite Manager**: Use `getSQLiteManager()` from `src/main/sqlite/manager.ts`
2. **Get Template Copies Manager**: Use `sqliteManager.getTemplateCopiesManager()`
3. **Query by Script ID**: Use `getTemplateCopyByScriptId(scriptId)` to find the template copy
4. **Update Script Content**: Use `updateTemplateCopyScriptContent(scriptId, scriptContent)` to save changes

The `SQLiteTemplateCopiesManager` class provides these methods:
- `getTemplateCopyByScriptId(scriptId: string)` - Get template copy by AppsScript project ID
- `updateTemplateCopyScriptContent(scriptId: string, scriptContent: any)` - Update script content in database

**Note**: The script content is stored as JSON in the `script_content` column. The structure matches the Google Apps Script API format:
```typescript
{
  scriptId: string;
  files: Array<{
    name: string;        // e.g., "Code.gs"
    type: string;        // e.g., "SERVER_JS"
    source: string;      // File source code
    functionSet?: any;   // Function metadata
  }>;
}
```

## AppsScript Tools

Each tool should be created as a separate file in `src/main/ai-code/tools/`. Below are the implementations for each tool.

### 1. apps_script_list_files

**File: `apps-script-list-files.ts`**

Lists all files in a Google AppsScript project.

```typescript
/**
 * List AppsScript Files Tool
 * Lists all files in a Google AppsScript project
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

export class AppsScriptListFilesTool implements ToolExecutor {
  name = 'apps_script_list_files';
  description = 'List all files in a Google AppsScript project. Returns an array of file names and types.';
  dangerous = false;
  requiresConfirmation = false;

  async execute(
    params: { scriptId: string }, 
    signal?: AbortSignal, 
    conversationId?: string
  ): Promise<Array<{name: string; type: string; hasSource: boolean}>> {
    if (!params.scriptId) {
      throw new Error('scriptId parameter is required');
    }

    try {
      const sqliteManager = getSQLiteManager();
      const templateCopiesManager = sqliteManager.getTemplateCopiesManager();
      
      // Get template copy by script ID
      const templateCopy = templateCopiesManager.getTemplateCopyByScriptId(params.scriptId);
      
      if (!templateCopy) {
        throw new Error(`AppsScript project '${params.scriptId}' not found in database`);
      }
      
      if (!templateCopy.scriptContent || !templateCopy.scriptContent.files) {
        return [];
      }
      
      return templateCopy.scriptContent.files.map((file: any) => ({
        name: file.name,
        type: file.type || 'SERVER_JS',
        hasSource: !!file.source
      }));
    } catch (error) {
      const errorMsg = `Failed to list AppsScript files for project '${params.scriptId}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
```

### 2. apps_script_read_file

**File: `apps-script-read-file.ts`**

Reads the contents of a specific file from a Google AppsScript project.

```typescript
/**
 * Read AppsScript File Tool
 * Reads the contents of a specific file from a Google AppsScript project
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

export class AppsScriptReadFileTool implements ToolExecutor {
  name = 'apps_script_read_file';
  description = 'Read the contents of a specific file from a Google AppsScript project. Returns the source code of the file.';
  dangerous = false;
  requiresConfirmation = false;

  async execute(
    params: { scriptId: string; fileName: string }, 
    signal?: AbortSignal, 
    conversationId?: string
  ): Promise<string> {
    if (!params.scriptId) {
      throw new Error('scriptId parameter is required');
    }
    
    if (!params.fileName) {
      throw new Error('fileName parameter is required');
    }

    try {
      const sqliteManager = getSQLiteManager();
      const templateCopiesManager = sqliteManager.getTemplateCopiesManager();
      
      // Get template copy by script ID
      const templateCopy = templateCopiesManager.getTemplateCopyByScriptId(params.scriptId);
      
      if (!templateCopy) {
        throw new Error(`AppsScript project '${params.scriptId}' not found in database`);
      }
      
      if (!templateCopy.scriptContent || !templateCopy.scriptContent.files) {
        throw new Error(`No files found in AppsScript project '${params.scriptId}'`);
      }
      
      const file = templateCopy.scriptContent.files.find((f: any) => f.name === params.fileName);
      
      if (!file) {
        const availableFiles = templateCopy.scriptContent.files.map((f: any) => f.name).join(', ');
        throw new Error(
          `File '${params.fileName}' not found in AppsScript project '${params.scriptId}'. ` +
          `Available files: ${availableFiles}`
        );
      }
      
      if (!file.source) {
        throw new Error(`File '${params.fileName}' has no source content`);
      }
      
      console.log(`📖 Successfully read AppsScript file: ${params.fileName} (${file.source.length} characters)`);
      return file.source;
    } catch (error) {
      const errorMsg = `Failed to read AppsScript file '${params.fileName}' from project '${params.scriptId}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
```

### 3. apps_script_write_file

**File: `apps-script-write-file.ts`**

Writes content to a file in a Google AppsScript project. Creates the file if it doesn't exist, or overwrites it if it does.

```typescript
/**
 * Write AppsScript File Tool
 * Writes content to a file in a Google AppsScript project
 */

import type { ToolExecutor, ToolCallConfirmationDetails } from '../../types/ai-types';
import { googleWorkspaceService } from '../../workspace';

export class AppsScriptWriteFileTool implements ToolExecutor {
  name = 'apps_script_write_file';
  description = 'Write content to a file in a Google AppsScript project. Creates the file if it doesn\'t exist, or overwrites it if it does.';
  dangerous = true;
  requiresConfirmation = true;

  async execute(
    params: { scriptId: string; fileName: string; content: string; fileType?: string }, 
    signal?: AbortSignal, 
    conversationId?: string
  ): Promise<string> {
    if (!params.scriptId) {
      throw new Error('scriptId parameter is required');
    }
    
    if (!params.fileName) {
      throw new Error('fileName parameter is required');
    }
    
    if (params.content === undefined) {
      throw new Error('content parameter is required');
    }

    try {
      const sqliteManager = getSQLiteManager();
      const templateCopiesManager = sqliteManager.getTemplateCopiesManager();
      
      // Get template copy by script ID
      const templateCopy = templateCopiesManager.getTemplateCopyByScriptId(params.scriptId);
      
      if (!templateCopy) {
        throw new Error(`AppsScript project '${params.scriptId}' not found in database`);
      }
      
      // Get current script content or initialize
      const scriptContent = templateCopy.scriptContent || { files: [] };
      const existingFiles = scriptContent.files || [];
      
      // Check if file exists
      const existingFileIndex = existingFiles.findIndex((f: any) => f.name === params.fileName);
      const fileType = params.fileType || 'SERVER_JS';
      
      // Update or add file
      if (existingFileIndex >= 0) {
        existingFiles[existingFileIndex].source = params.content;
        existingFiles[existingFileIndex].type = fileType;
      } else {
        existingFiles.push({
          name: params.fileName,
          type: fileType,
          source: params.content
        });
      }
      
      // Update script content in database
      const updatedScriptContent = {
        ...scriptContent,
        files: existingFiles
      };
      
      const updated = templateCopiesManager.updateTemplateCopyScriptContent(params.scriptId, updatedScriptContent);
      
      if (!updated) {
        throw new Error(`Failed to update script content in database`);
      }
      
      const action = existingFileIndex >= 0 ? 'updated' : 'created';
      const result = `Successfully ${action} AppsScript file '${params.fileName}' (${params.content.length} characters)`;
      console.log(`📝 ${result}`);
      return result;
    } catch (error) {
      const errorMsg = `Failed to write AppsScript file '${params.fileName}' in project '${params.scriptId}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  async shouldConfirm(params: { scriptId: string; fileName: string; content: string }): Promise<ToolCallConfirmationDetails | false> {
    try {
      const sqliteManager = getSQLiteManager();
      const templateCopiesManager = sqliteManager.getTemplateCopiesManager();
      const templateCopy = templateCopiesManager.getTemplateCopyByScriptId(params.scriptId);
      
      if (!templateCopy) {
        return {
          toolName: this.name,
          parameters: params,
          description: `AppsScript project '${params.scriptId}' not found in database`,
          risks: ['Cannot write to a project that does not exist'],
          autoApprove: false
        };
      }
      
      const scriptContent = templateCopy.scriptContent || { files: [] };
      const existingFiles = scriptContent.files || [];
      const fileExists = existingFiles.some((f: any) => f.name === params.fileName);
      
      return {
        toolName: this.name,
        parameters: params,
        description: fileExists 
          ? `Overwrite existing AppsScript file: ${params.fileName} in project ${params.scriptId}`
          : `Create new AppsScript file: ${params.fileName} in project ${params.scriptId}`,
        risks: fileExists 
          ? ['Will overwrite existing file content', 'Original content will be lost']
          : ['Will create a new file in the AppsScript project'],
        autoApprove: false
      };
    } catch (error) {
      return {
        toolName: this.name,
        parameters: params,
        description: `Write AppsScript file: ${params.fileName}`,
        risks: ['Could not verify if file exists'],
        autoApprove: false
      };
    }
  }
}
```

### 4. apps_script_partial_edit

**File: `apps-script-partial-edit.ts`**

Edits a file in a Google AppsScript project by replacing specific text.

```typescript
/**
 * Partial Edit AppsScript File Tool
 * Edits a file in a Google AppsScript project with search/replace functionality
 */

import type { ToolExecutor, ToolCallConfirmationDetails } from '../../types/ai-types';
import { googleWorkspaceService } from '../../workspace';

export interface AppsScriptPartialEditParams {
  scriptId: string;
  fileName: string;
  oldString: string;
  newString: string;
  expectedReplacements?: number;
  flexibleMatching?: boolean;
}

export class AppsScriptPartialEditTool implements ToolExecutor {
  name = 'apps_script_partial_edit';
  description = 'Replace text within a file in a Google AppsScript project. Supports partial edits with exact or flexible matching.';
  dangerous = true;
  requiresConfirmation = true;

  async execute(
    params: AppsScriptPartialEditParams, 
    signal?: AbortSignal, 
    conversationId?: string
  ): Promise<string> {
    if (!params.scriptId || !params.fileName || params.oldString === undefined || params.newString === undefined) {
      throw new Error('scriptId, fileName, oldString, and newString parameters are required');
    }

    try {
      const sqliteManager = getSQLiteManager();
      const templateCopiesManager = sqliteManager.getTemplateCopiesManager();
      
      // Get template copy by script ID
      const templateCopy = templateCopiesManager.getTemplateCopyByScriptId(params.scriptId);
      
      if (!templateCopy) {
        throw new Error(`AppsScript project '${params.scriptId}' not found in database`);
      }
      
      if (!templateCopy.scriptContent || !templateCopy.scriptContent.files) {
        throw new Error(`No files found in AppsScript project '${params.scriptId}'`);
      }
      
      // Find the file
      const fileIndex = templateCopy.scriptContent.files.findIndex((f: any) => f.name === params.fileName);
      if (fileIndex < 0) {
        throw new Error(`File '${params.fileName}' not found in AppsScript project '${params.scriptId}'`);
      }
      
      const file = templateCopy.scriptContent.files[fileIndex];
      if (!file.source) {
        throw new Error(`File '${params.fileName}' has no source content`);
      }
      
      const currentContent = file.source;
      
      // Perform replacement (similar to partial-edit.ts logic)
      const replacementResult = this.calculateReplacement(
        currentContent,
        params.oldString,
        params.newString,
        params.flexibleMatching ?? true
      );
      
      const expectedReplacements = params.expectedReplacements ?? 1;
      
      if (replacementResult.occurrences === 0) {
        throw new Error(`Failed to edit: Could not find the string to replace in ${params.fileName}`);
      }
      
      if (replacementResult.occurrences !== expectedReplacements) {
        throw new Error(`Failed to edit: Expected ${expectedReplacements} occurrence(s) but found ${replacementResult.occurrences}`);
      }
      
      // Update the file
      templateCopy.scriptContent.files[fileIndex].source = replacementResult.newContent;
      
      // Update script content in database
      const updated = templateCopiesManager.updateTemplateCopyScriptContent(params.scriptId, templateCopy.scriptContent);
      
      if (!updated) {
        throw new Error(`Failed to update script content in database`);
      }
      
      const result = `Successfully replaced ${replacementResult.occurrences} occurrence(s) in AppsScript file ${params.fileName}`;
      console.log(`✏️ ${result}`);
      return result;
    } catch (error) {
      const errorMsg = `Failed to edit AppsScript file '${params.fileName}' in project '${params.scriptId}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  private calculateReplacement(
    currentContent: string,
    oldString: string,
    newString: string,
    flexibleMatching: boolean
  ): { newContent: string; occurrences: number } {
    // Normalize line endings
    const normalizedCode = currentContent.replace(/\r\n/g, '\n');
    const normalizedSearch = oldString.replace(/\r\n/g, '\n');
    const normalizedReplace = newString.replace(/\r\n/g, '\n');

    // Try exact replacement first
    const exactOccurrences = normalizedCode.split(normalizedSearch).length - 1;
    if (exactOccurrences > 0) {
      const modifiedCode = normalizedCode.replaceAll(normalizedSearch, normalizedReplace);
      return {
        newContent: this.restoreTrailingNewline(currentContent, modifiedCode),
        occurrences: exactOccurrences
      };
    }

    // Try flexible matching if enabled
    if (flexibleMatching) {
      // Simplified flexible matching - can be enhanced
      const sourceLines = normalizedCode.split('\n');
      const searchLines = normalizedSearch.split('\n').map(l => l.trim());
      const replaceLines = normalizedReplace.split('\n');
      
      // Find and replace with flexible matching
      // (Implementation similar to partial-edit.ts)
    }

    return { newContent: currentContent, occurrences: 0 };
  }

  private restoreTrailingNewline(originalContent: string, modifiedContent: string): string {
    const hadTrailingNewline = originalContent.endsWith('\n');
    if (hadTrailingNewline && !modifiedContent.endsWith('\n')) {
      return modifiedContent + '\n';
    } else if (!hadTrailingNewline && modifiedContent.endsWith('\n')) {
      return modifiedContent.replace(/\n$/, '');
    }
    return modifiedContent;
  }

  async shouldConfirm(params: AppsScriptPartialEditParams): Promise<ToolCallConfirmationDetails | false> {
    return {
      toolName: this.name,
      parameters: params,
      description: `Edit AppsScript file: ${params.fileName} in project ${params.scriptId}\n\nReplace:\n${params.oldString}\n\nWith:\n${params.newString}`,
      risks: [
        'Will modify existing file content',
        'Original content will be changed',
        'Make sure oldString matches exactly including whitespace'
      ],
      autoApprove: false
    };
  }
}
```

### 5. apps_script_rename_file

**File: `apps-script-rename-file.ts`**

Renames a file in a Google AppsScript project.

```typescript
/**
 * Rename AppsScript File Tool
 * Renames a file in a Google AppsScript project
 */

import type { ToolExecutor } from '../../types/ai-types';
import { getSQLiteManager } from '../../sqlite/manager';

export class AppsScriptRenameFileTool implements ToolExecutor {
  name = 'apps_script_rename_file';
  description = 'Rename a file in a Google AppsScript project.';
  dangerous = false;
  requiresConfirmation = false;

  async execute(
    params: { scriptId: string; oldFileName: string; newFileName: string }, 
    signal?: AbortSignal, 
    conversationId?: string
  ): Promise<string> {
    if (!params.scriptId) {
      throw new Error('scriptId parameter is required');
    }
    
    if (!params.oldFileName) {
      throw new Error('oldFileName parameter is required');
    }
    
    if (!params.newFileName) {
      throw new Error('newFileName parameter is required');
    }

    try {
      const sqliteManager = getSQLiteManager();
      const templateCopiesManager = sqliteManager.getTemplateCopiesManager();
      
      // Get template copy by script ID
      const templateCopy = templateCopiesManager.getTemplateCopyByScriptId(params.scriptId);
      
      if (!templateCopy) {
        throw new Error(`AppsScript project '${params.scriptId}' not found in database`);
      }
      
      if (!templateCopy.scriptContent || !templateCopy.scriptContent.files) {
        throw new Error(`No files found in AppsScript project '${params.scriptId}'`);
      }
      
      // Find the file to rename
      const fileIndex = templateCopy.scriptContent.files.findIndex((f: any) => f.name === params.oldFileName);
      if (fileIndex < 0) {
        throw new Error(`File '${params.oldFileName}' not found in AppsScript project '${params.scriptId}'`);
      }
      
      // Check if new name already exists
      if (templateCopy.scriptContent.files.some((f: any) => f.name === params.newFileName)) {
        throw new Error(`File '${params.newFileName}' already exists in AppsScript project '${params.scriptId}'`);
      }
      
      // Rename the file
      templateCopy.scriptContent.files[fileIndex].name = params.newFileName;
      
      // Update script content in database
      const updated = templateCopiesManager.updateTemplateCopyScriptContent(params.scriptId, templateCopy.scriptContent);
      
      if (!updated) {
        throw new Error(`Failed to update script content in database`);
      }
      
      const result = `Successfully renamed AppsScript file from '${params.oldFileName}' to '${params.newFileName}'`;
      console.log(`📝 ${result}`);
      return result;
    } catch (error) {
      const errorMsg = `Failed to rename AppsScript file '${params.oldFileName}' to '${params.newFileName}' in project '${params.scriptId}': ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }
}
```

## Registering Tools

### Step 1: Import Tools

In `src/main/ai-code/tool-executor.ts`, add imports:

```typescript
import { 
  ReadFileTool,
  WriteFileTool,
  ListDirectoryTool,
  ShellCommandTool,
  AnalyzeProjectTool,
  InitProjectTool,
  PartialEditTool,
  MoveFileTool,
  AppsScriptListFilesTool,
  AppsScriptReadFileTool,
  AppsScriptWriteFileTool,
  AppsScriptPartialEditTool,
  AppsScriptRenameFileTool
} from './tools';
```

### Step 2: Register in Tool Registry

In `registerBuiltinTools()`:

```typescript
private registerBuiltinTools(): void {
  // File System Tools
  this.registerTool(new ReadFileTool());
  this.registerTool(new WriteFileTool());
  this.registerTool(new ListDirectoryTool());
  this.registerTool(new MoveFileTool());
  this.registerTool(new PartialEditTool());
  
  // Shell Tools
  this.registerTool(new ShellCommandTool());
  
  // Project Tools
  this.registerTool(new AnalyzeProjectTool());
  this.registerTool(new InitProjectTool());
  
  // AppsScript Tools
  this.registerTool(new AppsScriptListFilesTool());
  this.registerTool(new AppsScriptReadFileTool());
  this.registerTool(new AppsScriptWriteFileTool());
  this.registerTool(new AppsScriptPartialEditTool());
  this.registerTool(new AppsScriptRenameFileTool());
}
```

### Step 3: Add Parameter Schemas

In `getParameterSchema()`, add cases for each tool:

```typescript
case 'apps_script_list_files':
  return {
    type: 'object',
    properties: {
      script_id: {
        type: 'string',
        description: 'The AppsScript project ID'
      }
    },
    required: ['script_id']
  };

case 'apps_script_read_file':
  return {
    type: 'object',
    properties: {
      script_id: {
        type: 'string',
        description: 'The AppsScript project ID'
      },
      file_name: {
        type: 'string',
        description: 'The name of the file to read (e.g., "Code.gs", "MyFunction.gs")'
      }
    },
    required: ['script_id', 'file_name']
  };

case 'apps_script_write_file':
  return {
    type: 'object',
    properties: {
      script_id: {
        type: 'string',
        description: 'The AppsScript project ID'
      },
      file_name: {
        type: 'string',
        description: 'The name of the file to write'
      },
      content: {
        type: 'string',
        description: 'The content to write to the file'
      },
      file_type: {
        type: 'string',
        description: 'Optional: File type (default: "SERVER_JS")'
      }
    },
    required: ['script_id', 'file_name', 'content']
  };

case 'apps_script_partial_edit':
  return {
    type: 'object',
    properties: {
      script_id: {
        type: 'string',
        description: 'The AppsScript project ID'
      },
      file_name: {
        type: 'string',
        description: 'The name of the file to edit'
      },
      old_string: {
        type: 'string',
        description: 'The exact text to replace'
      },
      new_string: {
        type: 'string',
        description: 'The text to replace old_string with'
      },
      expected_replacements: {
        type: 'number',
        description: 'Number of occurrences to replace (default: 1)'
      },
      flexible_matching: {
        type: 'boolean',
        description: 'Whether to use flexible matching (default: true)'
      }
    },
    required: ['script_id', 'file_name', 'old_string', 'new_string']
  };

case 'apps_script_rename_file':
  return {
    type: 'object',
    properties: {
      script_id: {
        type: 'string',
        description: 'The AppsScript project ID'
      },
      old_file_name: {
        type: 'string',
        description: 'The current name of the file'
      },
      new_file_name: {
        type: 'string',
        description: 'The new name for the file'
      }
    },
    required: ['script_id', 'old_file_name', 'new_file_name']
  };
```

### Step 4: Export Tools

In `src/main/ai-code/tools/index.ts`:

```typescript
export * from './apps-script-list-files';
export * from './apps-script-read-file';
export * from './apps-script-write-file';
export * from './apps-script-partial-edit';
export * from './apps-script-rename-file';

export { AppsScriptListFilesTool } from './apps-script-list-files';
export { AppsScriptReadFileTool } from './apps-script-read-file';
export { AppsScriptWriteFileTool } from './apps-script-write-file';
export { AppsScriptPartialEditTool } from './apps-script-partial-edit';
export { AppsScriptRenameFileTool } from './apps-script-rename-file';
```

## Tool Interface Requirements

Every tool must implement the `ToolExecutor` interface:

```typescript
interface ToolExecutor {
  name: string;                    // Tool name (snake_case for AI)
  description: string;             // Description for AI
  dangerous?: boolean;             // Whether tool is dangerous
  requiresConfirmation?: boolean;   // Whether to require user confirmation
  
  execute(
    params: Record<string, any>,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<any>;
  
  shouldConfirm?: (params: Record<string, any>) => Promise<ToolCallConfirmationDetails | false>;
}
```

## Parameter Naming Convention

- **AI-facing parameters**: Use `snake_case` (e.g., `script_id`, `file_name`)
- **Internal parameters**: Use `camelCase` (e.g., `scriptId`, `fileName`)
- The `ToolRegistry` automatically maps between these formats

## SQLite Database Schema

The AppsScript content is stored in the `template_copies` table:

```sql
CREATE TABLE template_copies (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  template_script_id TEXT,
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_url TEXT NOT NULL,
  script_id TEXT,                    -- AppsScript project ID
  script_content TEXT,               -- JSON string with script content
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT
);
```

The `script_content` column stores JSON with this structure:
```typescript
{
  scriptId: string;
  files: Array<{
    name: string;        // e.g., "Code.gs"
    type: string;        // e.g., "SERVER_JS"
    source: string;      // File source code
    functionSet?: any;   // Function metadata
  }>;
}
```

## Database Access Pattern

All tools follow this pattern:

```typescript
import { getSQLiteManager } from '../../sqlite/manager';

// Get managers
const sqliteManager = getSQLiteManager();
const templateCopiesManager = sqliteManager.getTemplateCopiesManager();

// Query by script ID
const templateCopy = templateCopiesManager.getTemplateCopyByScriptId(scriptId);

// Access script content
const scriptContent = templateCopy.scriptContent;
const files = scriptContent.files;

// Update script content
templateCopiesManager.updateTemplateCopyScriptContent(scriptId, updatedScriptContent);
```

## Testing Tools

After creating a tool, test it by:

1. **Starting a conversation with the AI** and asking it to use the tool
2. **Checking console logs** for tool execution
3. **Verifying the tool appears** in `toolRegistry.getToolDefinitions()`

## Best Practices

1. **Error Handling**: Always provide clear, actionable error messages with available file names when applicable
2. **Logging**: Use console.log for successful operations, console.error for failures
3. **Validation**: Validate all required parameters at the start of `execute()`
4. **Type Safety**: Use TypeScript types for parameters and return values
5. **Documentation**: Include JSDoc comments explaining what the tool does
6. **Naming**: Use descriptive names that clearly indicate the tool's purpose
7. **Consistency**: Follow the same patterns as existing file system tools
8. **One Tool Per Operation**: Each AppsScript operation should have its own dedicated tool

## Available Context

The AI has access to conversation context through:
- `conversationId`: Current conversation ID
- `signal`: AbortSignal for cancellation
- Project context via `projectContextBridge`

You can use these to provide better context-aware behavior in your tools.

## Implementation Checklist

For each AppsScript tool:

- [ ] Create tool file in `src/main/ai-code/tools/`
- [ ] Implement `ToolExecutor` interface
- [ ] Add helper methods to `GoogleWorkspaceService` if needed
- [ ] Register tool in `tool-executor.ts` imports
- [ ] Register tool in `registerBuiltinTools()`
- [ ] Add parameter schema in `getParameterSchema()`
- [ ] Export tool in `tools/index.ts`
- [ ] Test tool with AI conversation
- [ ] Verify error handling works correctly

## Related Files

- Tool system: `src/main/ai-code/tool-executor.ts`
- Tool interface: `src/main/types/ai-types.ts`
- Example tools: 
  - `src/main/ai-code/tools/read-file.ts` → `apps-script-read-file.ts`
  - `src/main/ai-code/tools/list-directory.ts` → `apps-script-list-files.ts`
  - `src/main/ai-code/tools/write-file.ts` → `apps-script-write-file.ts`
  - `src/main/ai-code/tools/partial-edit.ts` → `apps-script-partial-edit.ts`
  - `src/main/ai-code/tools/move-file.ts` → `apps-script-rename-file.ts`
- Google Workspace service: `src/main/workspace.ts`
- AI client: `src/main/ai-code/gemini-autonomous-client.ts`

