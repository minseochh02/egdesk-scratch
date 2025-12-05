import Database from 'better-sqlite3';
import { SQLiteTemplateCopiesManager, TemplateCopy } from '../../sqlite/template-copies';
import { randomUUID } from 'crypto';
import { getAuthService } from '../../auth/auth-service';

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

  /**
   * Push local changes to Google Apps Script
   * Uses the Apps Script API to update the actual script content
   */
  async pushToGoogle(projectId: string): Promise<{ success: boolean; message: string }> {
    // Handle "Name [ID]" format
    let targetId = projectId;
    const idMatch = projectId.match(/\[(.*?)\]$/);
    if (idMatch) targetId = idMatch[1];

    const copy = this.copiesManager.getTemplateCopy(targetId);
    if (!copy) {
      throw new Error(`Project not found: ${targetId}`);
    }

    if (!copy.scriptId) {
      throw new Error(`Project ${targetId} is not linked to a Google Apps Script. Missing scriptId.`);
    }

    if (!copy.scriptContent || !copy.scriptContent.files) {
      throw new Error(`Project ${targetId} has no files to push.`);
    }

    // Get OAuth token
    const authService = getAuthService();
    const token = await authService.getGoogleWorkspaceToken();
    
    if (!token?.access_token) {
      throw new Error('No Google OAuth token available. Please sign in with Google.');
    }

    // Prepare files for Google Apps Script API format
    // Google expects: { files: [{ name, type, source }] }
    const files = copy.scriptContent.files.map((f: any) => ({
      name: f.name,
      type: f.type.toUpperCase(), // Google API uses uppercase (SERVER_JS, HTML, JSON)
      source: f.source,
    }));

    // Call Google Apps Script API to update content
    const response = await fetch(`https://script.googleapis.com/v1/projects/${copy.scriptId}/content`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || errorData.message || `HTTP ${response.status}`;
      throw new Error(`Failed to push to Google: ${errorMsg}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      message: `Successfully pushed ${files.length} file(s) to Google Apps Script (${copy.scriptId})`,
    };
  }

  /**
   * Pull latest from Google Apps Script and update local
   */
  async pullFromGoogle(projectId: string): Promise<{ success: boolean; message: string; fileCount: number }> {
    // Handle "Name [ID]" format
    let targetId = projectId;
    const idMatch = projectId.match(/\[(.*?)\]$/);
    if (idMatch) targetId = idMatch[1];

    const copy = this.copiesManager.getTemplateCopy(targetId);
    if (!copy) {
      throw new Error(`Project not found: ${targetId}`);
    }

    if (!copy.scriptId) {
      throw new Error(`Project ${targetId} is not linked to a Google Apps Script. Missing scriptId.`);
    }

    // Get OAuth token
    const authService = getAuthService();
    const token = await authService.getGoogleWorkspaceToken();
    
    if (!token?.access_token) {
      throw new Error('No Google OAuth token available. Please sign in with Google.');
    }

    // Call Google Apps Script API to get content
    const response = await fetch(`https://script.googleapis.com/v1/projects/${copy.scriptId}/content`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || errorData.message || `HTTP ${response.status}`;
      throw new Error(`Failed to pull from Google: ${errorMsg}`);
    }

    const result = await response.json();
    const files = result.files || [];

    // Convert to our internal format (lowercase types)
    const normalizedFiles = files.map((f: any) => ({
      name: f.name,
      type: f.type.toLowerCase(),
      source: f.source,
    }));

    // Update local SQLite
    this.copiesManager.updateTemplateCopyScriptContent(copy.scriptId, { 
      ...copy.scriptContent, 
      files: normalizedFiles 
    });

    return {
      success: true,
      message: `Successfully pulled ${normalizedFiles.length} file(s) from Google Apps Script`,
      fileCount: normalizedFiles.length,
    };
  }

  /**
   * Run a function in the Apps Script project remotely
   * POST /v1/scripts/{scriptId}:run
   */
  async runFunction(
    projectId: string, 
    functionName: string, 
    parameters?: any[]
  ): Promise<{ success: boolean; result?: any; error?: string; logs?: string[] }> {
    // Handle "Name [ID]" format
    let targetId = projectId;
    const idMatch = projectId.match(/\[(.*?)\]$/);
    if (idMatch) targetId = idMatch[1];

    const copy = this.copiesManager.getTemplateCopy(targetId);
    if (!copy) {
      throw new Error(`Project not found: ${targetId}`);
    }

    if (!copy.scriptId) {
      throw new Error(`Project ${targetId} is not linked to a Google Apps Script. Missing scriptId.`);
    }

    // Get OAuth token
    const authService = getAuthService();
    const token = await authService.getGoogleWorkspaceToken();
    
    if (!token?.access_token) {
      throw new Error('No Google OAuth token available. Please sign in with Google.');
    }

    // Call Google Apps Script API to run function
    const response = await fetch(`https://script.googleapis.com/v1/scripts/${copy.scriptId}:run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        function: functionName,
        parameters: parameters || [],
        devMode: true, // Run against the HEAD version (most recent save)
      }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      const errorMsg = result.error?.message || result.error?.details?.[0]?.errorMessage || `HTTP ${response.status}`;
      return {
        success: false,
        error: errorMsg,
      };
    }

    return {
      success: true,
      result: result.response?.result,
      logs: result.response?.logs || [],
    };
  }

  /**
   * Create a new version (immutable snapshot)
   * POST /v1/projects/{scriptId}/versions
   */
  async createVersion(projectId: string, description?: string): Promise<{ 
    success: boolean; 
    versionNumber?: number; 
    description?: string;
    createTime?: string;
  }> {
    // Handle "Name [ID]" format
    let targetId = projectId;
    const idMatch = projectId.match(/\[(.*?)\]$/);
    if (idMatch) targetId = idMatch[1];

    const copy = this.copiesManager.getTemplateCopy(targetId);
    if (!copy) {
      throw new Error(`Project not found: ${targetId}`);
    }

    if (!copy.scriptId) {
      throw new Error(`Project ${targetId} is not linked to a Google Apps Script. Missing scriptId.`);
    }

    // Get OAuth token
    const authService = getAuthService();
    const token = await authService.getGoogleWorkspaceToken();
    
    if (!token?.access_token) {
      throw new Error('No Google OAuth token available. Please sign in with Google.');
    }

    const response = await fetch(`https://script.googleapis.com/v1/projects/${copy.scriptId}/versions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: description || `Version created from EGDesk at ${new Date().toISOString()}`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
      throw new Error(`Failed to create version: ${errorMsg}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      versionNumber: result.versionNumber,
      description: result.description,
      createTime: result.createTime,
    };
  }

  /**
   * List all versions of a script
   * GET /v1/projects/{scriptId}/versions
   */
  async listVersions(projectId: string): Promise<Array<{
    versionNumber: number;
    description?: string;
    createTime: string;
  }>> {
    // Handle "Name [ID]" format
    let targetId = projectId;
    const idMatch = projectId.match(/\[(.*?)\]$/);
    if (idMatch) targetId = idMatch[1];

    const copy = this.copiesManager.getTemplateCopy(targetId);
    if (!copy) {
      throw new Error(`Project not found: ${targetId}`);
    }

    if (!copy.scriptId) {
      throw new Error(`Project ${targetId} is not linked to a Google Apps Script. Missing scriptId.`);
    }

    // Get OAuth token
    const authService = getAuthService();
    const token = await authService.getGoogleWorkspaceToken();
    
    if (!token?.access_token) {
      throw new Error('No Google OAuth token available. Please sign in with Google.');
    }

    const response = await fetch(`https://script.googleapis.com/v1/projects/${copy.scriptId}/versions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
      throw new Error(`Failed to list versions: ${errorMsg}`);
    }

    const result = await response.json();
    
    return (result.versions || []).map((v: any) => ({
      versionNumber: v.versionNumber,
      description: v.description,
      createTime: v.createTime,
    }));
  }

  /**
   * List all deployments of a script
   * GET /v1/projects/{scriptId}/deployments
   */
  async listDeployments(projectId: string): Promise<Array<{
    deploymentId: string;
    versionNumber?: number;
    description?: string;
    webAccessConfig?: {
      access: string;
      executeAs: string;
    };
    entryPoints?: Array<{
      entryPointType: string;
      webApp?: { url: string };
    }>;
  }>> {
    // Handle "Name [ID]" format
    let targetId = projectId;
    const idMatch = projectId.match(/\[(.*?)\]$/);
    if (idMatch) targetId = idMatch[1];

    const copy = this.copiesManager.getTemplateCopy(targetId);
    if (!copy) {
      throw new Error(`Project not found: ${targetId}`);
    }

    if (!copy.scriptId) {
      throw new Error(`Project ${targetId} is not linked to a Google Apps Script. Missing scriptId.`);
    }

    // Get OAuth token
    const authService = getAuthService();
    const token = await authService.getGoogleWorkspaceToken();
    
    if (!token?.access_token) {
      throw new Error('No Google OAuth token available. Please sign in with Google.');
    }

    const response = await fetch(`https://script.googleapis.com/v1/projects/${copy.scriptId}/deployments`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
      throw new Error(`Failed to list deployments: ${errorMsg}`);
    }

    const result = await response.json();
    
    return (result.deployments || []).map((d: any) => ({
      deploymentId: d.deploymentId,
      versionNumber: d.deploymentConfig?.versionNumber,
      description: d.deploymentConfig?.description,
      webAccessConfig: d.deploymentConfig?.webAccessConfig,
      entryPoints: d.entryPoints,
    }));
  }

  /**
   * Get execution metrics for a script
   * GET /v1/projects/{scriptId}/metrics
   */
  async getMetrics(projectId: string): Promise<{
    totalExecutions?: number;
    activeUsers?: { total?: number };
    failedExecutions?: number;
  }> {
    // Handle "Name [ID]" format
    let targetId = projectId;
    const idMatch = projectId.match(/\[(.*?)\]$/);
    if (idMatch) targetId = idMatch[1];

    const copy = this.copiesManager.getTemplateCopy(targetId);
    if (!copy) {
      throw new Error(`Project not found: ${targetId}`);
    }

    if (!copy.scriptId) {
      throw new Error(`Project ${targetId} is not linked to a Google Apps Script. Missing scriptId.`);
    }

    // Get OAuth token
    const authService = getAuthService();
    const token = await authService.getGoogleWorkspaceToken();
    
    if (!token?.access_token) {
      throw new Error('No Google OAuth token available. Please sign in with Google.');
    }

    const response = await fetch(
      `https://script.googleapis.com/v1/projects/${copy.scriptId}/metrics?metricsGranularity=DAILY`, 
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
      throw new Error(`Failed to get metrics: ${errorMsg}`);
    }

    const result = await response.json();
    
    return {
      totalExecutions: result.metrics?.[0]?.totalExecutions,
      activeUsers: result.activeUsers,
      failedExecutions: result.metrics?.[0]?.failedExecutions,
    };
  }
}

