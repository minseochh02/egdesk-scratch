import Database from 'better-sqlite3';
import { SQLiteTemplateCopiesManager, TemplateCopy } from '../../sqlite/template-copies';
import { randomUUID } from 'crypto';

export interface FileInfo {
  name: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
}

/**
 * Apps Script Service (Virtual Filesystem)
 * 
 * Implements a virtual filesystem over the Apps Script projects stored in SQLite.
 * Structure:
 * / (Root) -> Lists all projects as directories
 * /{ProjectId}/ -> Lists files in that project
 * /{ProjectId}/{Filename} -> Content of the file
 */
export class AppsScriptService {
  private db: Database.Database;
  private copiesManager: SQLiteTemplateCopiesManager;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.copiesManager = new SQLiteTemplateCopiesManager(this.db);
  }

  /**
   * Parse a virtual path into project ID and relative file path
   * Format: /ProjectId/path/to/file
   */
  private parsePath(path: string): { projectId: string | null; filePath: string | null } {
    // Normalize path
    const normalized = path.replace(/\\/g, '/').replace(/^\//, '');
    
    if (!normalized) {
      return { projectId: null, filePath: null };
    }

    const parts = normalized.split('/');
    const projectId = parts[0];
    const filePath = parts.slice(1).join('/');

    return { 
      projectId, 
      filePath: filePath || null 
    };
  }

  /**
   * Get project details including bound spreadsheet info
   */
  getProjectDetails(projectId: string): {
    id: string;
    name: string;
    scriptId?: string;
    spreadsheetId: string;
    spreadsheetUrl: string;
    createdAt: string;
    fileCount: number;
  } | null {
    // Handle "Name [ID]" format
    let targetId = projectId;
    const idMatch = projectId.match(/\[(.*?)\]$/);
    if (idMatch) targetId = idMatch[1];

    const copy = this.copiesManager.getTemplateCopy(targetId);
    if (!copy) return null;

    const files = copy.scriptContent?.files || [];
    
    return {
      id: copy.id,
      name: copy.metadata?.name || 'Untitled Project',
      scriptId: copy.scriptId,
      spreadsheetId: copy.spreadsheetId,
      spreadsheetUrl: copy.spreadsheetUrl,
      createdAt: copy.createdAt,
      fileCount: files.length,
    };
  }

  /**
   * List all projects with their bound spreadsheet info
   */
  listProjectsWithDetails(): Array<{
    id: string;
    name: string;
    displayName: string;
    scriptId?: string;
    spreadsheetId: string;
    spreadsheetUrl: string;
    createdAt: string;
    fileCount: number;
  }> {
    const copies = this.copiesManager.getAllTemplateCopies();
    
    return copies.map(copy => {
      const name = copy.metadata?.name || 'Untitled Project';
      const files = copy.scriptContent?.files || [];
      
      return {
        id: copy.id,
        name: name,
        displayName: `${name} [${copy.id}]`,
        scriptId: copy.scriptId,
        spreadsheetId: copy.spreadsheetId,
        spreadsheetUrl: copy.spreadsheetUrl,
        createdAt: copy.createdAt,
        fileCount: files.length,
      };
    });
  }

  /**
   * List entries in a directory (Project or Root)
   */
  async listDirectory(path: string): Promise<Array<{ name: string, type: string } | string>> {
    const { projectId, filePath } = this.parsePath(path);

    // 1. Root Directory: List all projects
    if (!projectId) {
      const copies = this.copiesManager.getAllTemplateCopies();
      // Format: "Project Name (ID)" or just ID if no metadata name
      return copies.map(copy => {
        const name = copy.metadata?.name || 'Untitled Project';
        return `${name} [${copy.id}]`;
      });
    }

    // 2. Project Directory: List files in the project
    const copy = this.copiesManager.getTemplateCopy(projectId);
    if (!copy) {
        // Try to find by "Name [ID]" format if AI used the display name
        const idMatch = projectId.match(/\[(.*?)\]$/);
        if (idMatch) {
            const id = idMatch[1];
            const copyById = this.copiesManager.getTemplateCopy(id);
            if (copyById) {
                // Found it! Recurse with the clean ID
                return this.listDirectory(id + (filePath ? '/' + filePath : ''));
            }
        }
        throw new Error(`Project not found: ${projectId}`);
    }

    if (!copy.scriptContent || !copy.scriptContent.files) {
      return [];
    }

    const files = copy.scriptContent.files as Array<{name: string, type: string}>;
    
    // If filePath is provided, we might want to filter (but Apps Script is flat-ish)
    // Apps Script files are "name" (e.g. "Code") and "type" (e.g. "server_js")
    // We return objects to make it easier for clients to handle file types
    
    return files.map(f => {
      let ext = '';
      
      // Map internal types to extensions
      switch(f.type.toLowerCase()) {
        case 'server_js':
        case 'server_js': // handle both cases if needed
          ext = '.gs';
          break;
        case 'html':
          ext = '.html';
          break;
        case 'json':
          ext = '.json';
          break;
        default:
          // Fallback: if type is unknown, default to .html if not server_js, or just use .html
          // Better logic: check if name already has extension
          if (!f.name.includes('.')) {
             ext = '.html'; // Default for unknown types in Apps Script is often HTML/Frontend
          }
      }

      // Override for known types from Google API that might be uppercase
      if (f.type === 'SERVER_JS') ext = '.gs';
      if (f.type === 'HTML') ext = '.html';
      if (f.type === 'JSON') ext = '.json';

      return {
        name: `${f.name}${ext}`,
        type: f.type
      };
    });
  }

  /**
   * Read a file
   */
  async readFile(path: string): Promise<string> {
    const { projectId, filePath } = this.parsePath(path);
    
    if (!projectId || !filePath) {
      throw new Error(`Invalid file path: ${path}. Expected format: /{ProjectId}/{Filename}`);
    }

    // Handle "Name [ID]" format
    let targetId = projectId;
    const idMatch = projectId.match(/\[(.*?)\]$/);
    if (idMatch) targetId = idMatch[1];

    const copy = this.copiesManager.getTemplateCopy(targetId);
    if (!copy) {
      throw new Error(`Project not found: ${targetId}`);
    }

    if (!copy.scriptContent || !copy.scriptContent.files) {
      throw new Error(`Project ${targetId} has no files.`);
    }

    // Apps Script files don't store extension in the name usually
    // "Code.gs" -> name: "Code", type: "server_js"
    // "index.html" -> name: "index", type: "html"
    // "appsscript.json" -> name: "appsscript", type: "json"
    
    const targetName = filePath.replace(/\.(gs|html|json)$/, '');
    let targetType = 'server_js';
    if (filePath.endsWith('.html')) targetType = 'html';
    else if (filePath.endsWith('.json')) targetType = 'json';
    else if (filePath.endsWith('.gs')) targetType = 'server_js';

    // Handle case-insensitive type matching (e.g., "JSON" vs "json", "SERVER_JS" vs "server_js")
    const file = copy.scriptContent.files.find((f: any) => 
      f.name === targetName && f.type.toLowerCase() === targetType.toLowerCase()
    );
    
    if (!file) {
        // Fallback: try matching just name
        const fileByName = copy.scriptContent.files.find((f: any) => f.name === targetName);
        if (fileByName) {
          // Ensure source is returned as string (JSON files may be stored as objects)
          const source = fileByName.source;
          return typeof source === 'object' ? JSON.stringify(source, null, 2) : source;
        }
        
        throw new Error(`File not found: ${filePath} in project ${targetId}`);
    }

    // Ensure source is returned as string (JSON files may be stored as objects)
    const source = file.source;
    return typeof source === 'object' ? JSON.stringify(source, null, 2) : source;
  }

  /**
   * Write a file
   */
  async writeFile(path: string, content: string): Promise<void> {
    const { projectId, filePath } = this.parsePath(path);
    
    if (!projectId || !filePath) {
      throw new Error(`Invalid file path: ${path}. Expected format: /{ProjectId}/{Filename}`);
    }

    // Handle "Name [ID]" format
    let targetId = projectId;
    const idMatch = projectId.match(/\[(.*?)\]$/);
    if (idMatch) targetId = idMatch[1];

    const copy = this.copiesManager.getTemplateCopy(targetId);
    if (!copy) {
      throw new Error(`Project not found: ${targetId}`);
    }

    const scriptContent = copy.scriptContent || { files: [] };
    const files = scriptContent.files || [];

    const targetName = filePath.replace(/\.(gs|html|json)$/, '');
    let targetType = 'server_js';
    if (filePath.endsWith('.html')) targetType = 'html';
    else if (filePath.endsWith('.json')) targetType = 'json';
    else if (filePath.endsWith('.gs')) targetType = 'server_js';

    const existingFileIndex = files.findIndex((f: any) => 
      f.name === targetName && f.type.toLowerCase() === targetType.toLowerCase()
    );

    if (existingFileIndex >= 0) {
      // Update existing
      files[existingFileIndex].source = content;
    } else {
      // Create new
      files.push({
        name: targetName,
        type: targetType,
        source: content
      });
    }

    // Update in DB
    this.copiesManager.updateTemplateCopyScriptContent(copy.scriptId!, { ...scriptContent, files });
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    const { projectId, filePath } = this.parsePath(path);
    
    if (!projectId || !filePath) {
        throw new Error(`Invalid file path: ${path}`);
    }

    let targetId = projectId;
    const idMatch = projectId.match(/\[(.*?)\]$/);
    if (idMatch) targetId = idMatch[1];

    const copy = this.copiesManager.getTemplateCopy(targetId);
    if (!copy) throw new Error(`Project not found: ${targetId}`);

    const scriptContent = copy.scriptContent || { files: [] };
    const files = scriptContent.files || [];

    const targetName = filePath.replace(/\.(gs|html|json)$/, '');
    let targetType = 'server_js';
    if (filePath.endsWith('.html')) targetType = 'html';
    else if (filePath.endsWith('.json')) targetType = 'json';
    else if (filePath.endsWith('.gs')) targetType = 'server_js';

    const newFiles = files.filter((f: any) => 
      !(f.name === targetName && f.type.toLowerCase() === targetType.toLowerCase())
    );

    if (newFiles.length === files.length) {
       throw new Error(`File not found to delete: ${filePath}`);
    }

    this.copiesManager.updateTemplateCopyScriptContent(copy.scriptId!, { ...scriptContent, files: newFiles });
  }
}

