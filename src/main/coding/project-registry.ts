import * as path from 'path';

export interface RegisteredProject {
  projectName: string;
  folderPath: string;
  port: number;
  url: string;
  status: 'starting' | 'running' | 'stopped' | 'error' | 'rebuilding';
  registeredAt: string;
  type?: 'nextjs' | 'vite' | 'react' | 'unknown';
  mode: 'dev' | 'production';
  availableModes: ('dev' | 'production')[];
}

export class ProjectRegistry {
  private projects: Map<string, RegisteredProject> = new Map();

  /**
   * Register a project (called when dev server starts)
   */
  register(
    folderPath: string,
    port: number,
    url: string,
    status: 'starting' | 'running' | 'stopped' | 'error' | 'rebuilding',
    type?: 'nextjs' | 'vite' | 'react' | 'unknown',
    mode: 'dev' | 'production' = 'production'
  ): RegisteredProject {
    // Use folder name as project name
    const projectName = path.basename(folderPath);

    const project: RegisteredProject = {
      projectName,
      folderPath,
      port,
      url,
      status,
      registeredAt: new Date().toISOString(),
      type,
      mode,
      availableModes: ['dev', 'production']
    };

    this.projects.set(projectName, project);
    console.log(`✅ Registered project: ${projectName} (${type || 'unknown'}) in ${mode} mode on port ${port}`);

    return project;
  }

  /**
   * Update project status
   */
  updateStatus(projectName: string, status: 'starting' | 'running' | 'stopped' | 'error' | 'rebuilding'): void {
    const project = this.projects.get(projectName);
    if (project) {
      project.status = status;
      console.log(`📝 Updated project ${projectName} status to ${status}`);
    }
  }

  /**
   * Unregister a project (called when dev server stops)
   */
  unregister(projectName: string): void {
    if (this.projects.delete(projectName)) {
      console.log(`🗑️ Unregistered project: ${projectName}`);
    }
  }

  /**
   * Get project by name
   */
  getProject(projectName: string): RegisteredProject | undefined {
    return this.projects.get(projectName);
  }

  /**
   * Get project by folder path
   */
  getProjectByPath(folderPath: string): RegisteredProject | undefined {
    const projectName = path.basename(folderPath);
    return this.projects.get(projectName);
  }

  /**
   * Get all registered projects
   */
  getAllProjects(): RegisteredProject[] {
    return Array.from(this.projects.values());
  }

  /**
   * Check if project exists
   */
  hasProject(projectName: string): boolean {
    return this.projects.has(projectName);
  }

  /**
   * Get project count
   */
  getProjectCount(): number {
    return this.projects.size;
  }

  /**
   * Clear all projects (useful for cleanup)
   */
  clear(): void {
    this.projects.clear();
    console.log('🧹 Cleared all projects from registry');
  }
}

// Singleton instance
let projectRegistryInstance: ProjectRegistry | null = null;

export function getProjectRegistry(): ProjectRegistry {
  if (!projectRegistryInstance) {
    projectRegistryInstance = new ProjectRegistry();
  }
  return projectRegistryInstance;
}
