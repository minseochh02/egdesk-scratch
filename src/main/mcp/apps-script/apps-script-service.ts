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
   * List entries in a directory (Project or Root)
   */
  async listDirectory(path: string): Promise<string[]> {
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
    // We expose them as "Code.gs", "index.html"
    
    return files.map(f => {
      const ext = f.type === 'server_js' ? '.gs' : '.html';
      return `${f.name}${ext}`;
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
    
    const targetName = filePath.replace(/\.(gs|html)$/, '');
    const targetType = filePath.endsWith('.html') ? 'html' : 'server_js';

    const file = copy.scriptContent.files.find((f: any) => f.name === targetName && f.type === targetType);
    
    if (!file) {
        // Fallback: try matching just name
        const fileByName = copy.scriptContent.files.find((f: any) => f.name === targetName);
        if (fileByName) return fileByName.source;
        
        throw new Error(`File not found: ${filePath} in project ${targetId}`);
    }

    return file.source;
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

    const targetName = filePath.replace(/\.(gs|html)$/, '');
    const targetType = filePath.endsWith('.html') ? 'html' : 'server_js';

    const existingFileIndex = files.findIndex((f: any) => f.name === targetName && f.type === targetType);

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

    const targetName = filePath.replace(/\.(gs|html)$/, '');
    const targetType = filePath.endsWith('.html') ? 'html' : 'server_js';

    const newFiles = files.filter((f: any) => !(f.name === targetName && f.type === targetType));

    if (newFiles.length === files.length) {
       throw new Error(`File not found to delete: ${filePath}`);
    }

    this.copiesManager.updateTemplateCopyScriptContent(copy.scriptId!, { ...scriptContent, files: newFiles });
  }
}

