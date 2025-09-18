/**
 * Project Context Bridge for Main Process
 * Provides access to current project context for AI tools
 */

import { ipcMain } from 'electron';

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  type: 'wordpress' | 'web' | 'node' | 'python' | 'java' | 'cpp' | 'other';
  description?: string;
  lastAccessed: Date;
  isActive: boolean;
  metadata: {
    hasWordPress?: boolean;
    hasPackageJson?: boolean;
    hasRequirementsTxt?: boolean;
    hasPomXml?: boolean;
    hasMakefile?: boolean;
    language?: string;
    framework?: string;
    version?: string;
  };
}

export interface ProjectContext {
  currentProject: ProjectInfo | null;
  recentProjects: ProjectInfo[];
  availableProjects: ProjectInfo[];
  lastUpdated: Date;
}

export class ProjectContextBridge {
  private currentProject: ProjectInfo | null = null;
  private context: ProjectContext | null = null;

  constructor() {
    this.registerIPCHandlers();
  }

  /**
   * Register IPC handlers for project context communication
   */
  private registerIPCHandlers(): void {
    // Handle project context updates from renderer
    ipcMain.handle('project-context-update', async (event, context: ProjectContext) => {
      this.context = context;
      this.currentProject = context.currentProject;
      console.log(`📁 Project context updated: ${this.currentProject?.name || 'None'} (${this.currentProject?.path || 'No path'})`);
      return true;
    });

    // Handle requests for current project
    ipcMain.handle('project-context-get-current', async () => {
      return this.currentProject;
    });

    // Handle requests for full context
    ipcMain.handle('project-context-get', async () => {
      return this.context;
    });
  }

  /**
   * Get current project info
   */
  getCurrentProject(): ProjectInfo | null {
    return this.currentProject;
  }

  /**
   * Get current project path (for tool working directory)
   */
  getCurrentProjectPath(): string {
    return this.currentProject?.path || process.cwd();
  }

  /**
   * Get current project name
   */
  getCurrentProjectName(): string {
    return this.currentProject?.name || 'Unknown Project';
  }

  /**
   * Check if there's an active project
   */
  hasCurrentProject(): boolean {
    return this.currentProject !== null;
  }

  /**
   * Get project type for AI context
   */
  getProjectType(): string {
    if (!this.currentProject) return 'unknown';
    return this.currentProject.type;
  }

  /**
   * Get project metadata for AI context
   */
  getProjectMetadata(): Record<string, any> {
    if (!this.currentProject) return {};
    return {
      type: this.currentProject.type,
      language: this.currentProject.metadata.language,
      framework: this.currentProject.metadata.framework,
      version: this.currentProject.metadata.version,
      hasWordPress: this.currentProject.metadata.hasWordPress,
      hasPackageJson: this.currentProject.metadata.hasPackageJson,
      hasRequirementsTxt: this.currentProject.metadata.hasRequirementsTxt,
    };
  }

  /**
   * Get project context string for AI prompts
   */
  getProjectContextString(): string {
    if (!this.currentProject) {
      return 'No active project selected. Working in default directory.';
    }

    const metadata = this.getProjectMetadata();
    let contextStr = `Current Project: ${this.currentProject.name}\n`;
    contextStr += `Path: ${this.currentProject.path}\n`;
    contextStr += `Type: ${this.currentProject.type}\n`;
    
    if (metadata.language) {
      contextStr += `Language: ${metadata.language}\n`;
    }
    if (metadata.framework) {
      contextStr += `Framework: ${metadata.framework}\n`;
    }
    if (metadata.version) {
      contextStr += `Version: ${metadata.version}\n`;
    }

    contextStr += `\nWhen creating or editing files, use paths relative to: ${this.currentProject.path}`;
    
    return contextStr;
  }
}

// Export singleton instance
export const projectContextBridge = new ProjectContextBridge();
