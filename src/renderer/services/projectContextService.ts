export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  type: 'wordpress' | 'web' | 'node' | 'python' | 'java' | 'cpp' | 'other';
  description?: string;
  lastAccessed: Date;
  isActive: boolean;
  isInitialized: boolean; // New: tracks if project has been initialized (.backup folder exists)
  createdAt: Date; // New: when project was first added
  metadata: {
    hasWordPress?: boolean;
    hasPackageJson?: boolean;
    hasRequirementsTxt?: boolean;
    hasPomXml?: boolean;
    hasMakefile?: boolean;
    language?: string;
    framework?: string;
    version?: string;
    // New: initialization metadata
    hasBackupFolder?: boolean;
    initializationDate?: Date;
    initializationStatus?: 'pending' | 'completed' | 'failed';
  };
}

export interface ProjectContext {
  currentProject: ProjectInfo | null;
  recentProjects: ProjectInfo[];
  availableProjects: ProjectInfo[];
  lastUpdated: Date;
}

class ProjectContextService {
  private static instance: ProjectContextService;

  private context: ProjectContext = {
    currentProject: null,
    recentProjects: [],
    availableProjects: [],
    lastUpdated: new Date(),
  };

  private listeners: Set<(context: ProjectContext) => void> = new Set();

  private constructor() {
    this.loadContext();
  }

  static getInstance(): ProjectContextService {
    if (!ProjectContextService.instance) {
      ProjectContextService.instance = new ProjectContextService();
    }
    return ProjectContextService.instance;
  }

  /**
   * Subscribe to project context changes
   */
  subscribe(listener: (context: ProjectContext) => void): () => void {
    this.listeners.add(listener);
    listener(this.context); // Initial call

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of context changes
   */
  private notifyListeners(): void {
    this.context.lastUpdated = new Date();
    this.listeners.forEach((listener) => listener(this.context));
    this.saveContext();
  }

  /**
   * Get current project context
   */
  getContext(): ProjectContext {
    return { ...this.context };
  }

  /**
   * Get current active project
   */
  getCurrentProject(): ProjectInfo | null {
    return this.context.currentProject;
  }

  /**
   * Set current active project
   */
  async setCurrentProject(projectPath: string): Promise<ProjectInfo | null> {
    try {
      // Check if project already exists
      let project = this.context.availableProjects.find(
        (p) => p.path === projectPath,
      );

      if (!project) {
        // Analyze and create new project
        project = await this.analyzeAndCreateProject(projectPath);
        if (project) {
          this.context.availableProjects.push(project);
        }
      }

      if (project) {
        // Update project access time
        project.lastAccessed = new Date();
        project.isActive = true;

        // Deactivate other projects
        this.context.availableProjects.forEach((p) => (p.isActive = false));

        // Set as current project
        this.context.currentProject = project;

        // Add to recent projects (remove if exists, add to front)
        this.context.recentProjects = this.context.recentProjects.filter(
          (p) => p.id !== project.id,
        );
        this.context.recentProjects.unshift(project);

        // Keep only last 10 recent projects
        this.context.recentProjects = this.context.recentProjects.slice(0, 10);

        this.notifyListeners();
        return project;
      }
    } catch (error) {
      console.error('Failed to set current project:', error);
    }

    return null;
  }

  /**
   * Analyze a folder and create project info
   */
  private async analyzeAndCreateProject(
    projectPath: string,
  ): Promise<ProjectInfo | null> {
    try {
      const projectId = this.generateProjectId(projectPath);
      const projectName = this.extractProjectName(projectPath);

      // Analyze project structure
      const metadata = await this.analyzeProjectStructure(projectPath);

      // Check if project is initialized (has .backup folder)
      const isInitialized = await this.checkFileExists(`${projectPath}/.backup`);
      
      const project: ProjectInfo = {
        id: projectId,
        name: projectName,
        path: projectPath,
        type: this.determineProjectType(metadata),
        description: this.generateProjectDescription(metadata),
        lastAccessed: new Date(),
        isActive: false,
        isInitialized,
        createdAt: new Date(),
        metadata: {
          ...metadata,
          hasBackupFolder: isInitialized,
          initializationDate: isInitialized ? new Date() : undefined,
          initializationStatus: isInitialized ? 'completed' : 'pending',
        },
      };

      return project;
    } catch (error) {
      console.error('Failed to analyze project:', error);
      return null;
    }
  }

  /**
   * Analyze project structure to determine type and metadata
   */
  private async analyzeProjectStructure(
    projectPath: string,
  ): Promise<ProjectInfo['metadata']> {
    const metadata: ProjectInfo['metadata'] = {};

    try {
      // Check for WordPress
      const hasWordPress =
        (await this.checkFileExists(`${projectPath}/wp-config.php`)) ||
        (await this.checkFileExists(`${projectPath}/wp-content`)) ||
        (await this.checkFileExists(`${projectPath}/wp-admin`));
      metadata.hasWordPress = hasWordPress;

      // Check for Node.js
      const hasPackageJson = await this.checkFileExists(
        `${projectPath}/package.json`,
      );
      metadata.hasPackageJson = hasPackageJson;

      // Check for Python
      const hasRequirementsTxt =
        (await this.checkFileExists(`${projectPath}/requirements.txt`)) ||
        (await this.checkFileExists(`${projectPath}/pyproject.toml`)) ||
        (await this.checkFileExists(`${projectPath}/setup.py`));
      metadata.hasRequirementsTxt = hasRequirementsTxt;

      // Check for Java
      const hasPomXml =
        (await this.checkFileExists(`${projectPath}/pom.xml`)) ||
        (await this.checkFileExists(`${projectPath}/build.gradle`));
      metadata.hasPomXml = hasPomXml;

      // Check for C/C++
      const hasMakefile =
        (await this.checkFileExists(`${projectPath}/Makefile`)) ||
        (await this.checkFileExists(`${projectPath}/CMakeLists.txt`));
      metadata.hasMakefile = hasMakefile;

      // Determine primary language
      metadata.language = this.determinePrimaryLanguage(metadata);

      // Determine framework
      metadata.framework = this.determineFramework(metadata);

      // Get version if available
      metadata.version = await this.extractProjectVersion(
        projectPath,
        metadata,
      );
    } catch (error) {
      console.error('Error analyzing project structure:', error);
    }

    return metadata;
  }

  /**
   * Check if a file exists
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      const result = await window.electron.fileSystem.readFile(filePath);
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Determine project type based on metadata
   */
  private determineProjectType(
    metadata: ProjectInfo['metadata'],
  ): ProjectInfo['type'] {
    if (metadata.hasWordPress) return 'wordpress';
    if (metadata.hasPackageJson) return 'node';
    if (metadata.hasRequirementsTxt) return 'python';
    if (metadata.hasPomXml) return 'java';
    if (metadata.hasMakefile) return 'cpp';
    return 'other';
  }

  /**
   * Determine primary language
   */
  private determinePrimaryLanguage(metadata: ProjectInfo['metadata']): string {
    if (metadata.hasWordPress) return 'PHP';
    if (metadata.hasPackageJson) return 'JavaScript/TypeScript';
    if (metadata.hasRequirementsTxt) return 'Python';
    if (metadata.hasPomXml) return 'Java';
    if (metadata.hasMakefile) return 'C/C++';
    return 'Unknown';
  }

  /**
   * Determine framework
   */
  private determineFramework(metadata: ProjectInfo['metadata']): string {
    if (metadata.hasWordPress) return 'WordPress';
    if (metadata.hasPackageJson) return 'Node.js';
    if (metadata.hasRequirementsTxt) return 'Python';
    if (metadata.hasPomXml) return 'Java';
    if (metadata.hasMakefile) return 'C/C++';
    return 'Unknown';
  }

  /**
   * Extract project version
   */
  private async extractProjectVersion(
    projectPath: string,
    metadata: ProjectInfo['metadata'],
  ): Promise<string | undefined> {
    try {
      if (metadata.hasPackageJson) {
        const result = await window.electron.fileSystem.readFile(
          `${projectPath}/package.json`,
        );
        if (result.success && result.content) {
          const packageJson = JSON.parse(result.content);
          return packageJson.version;
        }
      }

      if (metadata.hasRequirementsTxt) {
        // Try to find version in requirements.txt or pyproject.toml
        const result = await window.electron.fileSystem.readFile(
          `${projectPath}/pyproject.toml`,
        );
        if (result.success && result.content) {
          const match = result.content.match(/version\s*=\s*["']([^"']+)["']/);
          if (match) return match[1];
        }
      }

      if (metadata.hasPomXml) {
        const result = await window.electron.fileSystem.readFile(
          `${projectPath}/pom.xml`,
        );
        if (result.success && result.content) {
          const match = result.content.match(/<version>([^<]+)<\/version>/);
          if (match) return match[1];
        }
      }
    } catch (error) {
      console.error('Error extracting project version:', error);
    }

    return undefined;
  }

  /**
   * Generate project description
   */
  private generateProjectDescription(
    metadata: ProjectInfo['metadata'],
  ): string {
    const parts: string[] = [];

    if (metadata.hasWordPress) parts.push('WordPress site');
    if (metadata.hasPackageJson) parts.push('Node.js application');
    if (metadata.hasRequirementsTxt) parts.push('Python project');
    if (metadata.hasPomXml) parts.push('Java application');
    if (metadata.hasMakefile) parts.push('C/C++ project');

    if (parts.length === 0) parts.push('General project');

    return parts.join(', ');
  }

  /**
   * Generate unique project ID
   */
  private generateProjectId(projectPath: string): string {
    // Create a hash from the project path
    let hash = 0;
    for (let i = 0; i < projectPath.length; i++) {
      const char = projectPath.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash &= hash; // Convert to 32-bit integer
    }
    return `project_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Extract project name from path
   */
  private extractProjectName(projectPath: string): string {
    const parts = projectPath.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'Untitled Project';
  }

  /**
   * Get project by ID
   */
  getProjectById(projectId: string): ProjectInfo | null {
    return (
      this.context.availableProjects.find((p) => p.id === projectId) || null
    );
  }

  /**
   * Get project by path
   */
  getProjectByPath(projectPath: string): ProjectInfo | null {
    return (
      this.context.availableProjects.find((p) => p.path === projectPath) || null
    );
  }

  /**
   * Remove project from context
   */
  removeProject(projectId: string): void {
    this.context.availableProjects = this.context.availableProjects.filter(
      (p) => p.id !== projectId,
    );
    this.context.recentProjects = this.context.recentProjects.filter(
      (p) => p.id !== projectId,
    );

    if (this.context.currentProject?.id === projectId) {
      this.context.currentProject = null;
    }

    this.notifyListeners();
  }

  /**
   * Update project metadata
   */
  async updateProjectMetadata(projectId: string): Promise<void> {
    const project = this.getProjectById(projectId);
    if (project) {
      const updatedMetadata = await this.analyzeProjectStructure(project.path);
      project.metadata = { ...project.metadata, ...updatedMetadata };
      project.type = this.determineProjectType(project.metadata);
      project.description = this.generateProjectDescription(project.metadata);

      this.notifyListeners();
    }
  }

  /**
   * Refresh all projects metadata
   */
  async refreshAllProjects(): Promise<void> {
    for (const project of this.context.availableProjects) {
      await this.updateProjectMetadata(project.id);
    }
  }

  /**
   * Load context from storage
   */
  private loadContext(): void {
    try {
      const stored = localStorage.getItem('projectContext');
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Convert date strings back to Date objects
        if (parsed.currentProject) {
          parsed.currentProject.lastAccessed = new Date(parsed.currentProject.lastAccessed);
          parsed.currentProject.createdAt = new Date(parsed.currentProject.createdAt || parsed.currentProject.lastAccessed);
          if (parsed.currentProject.metadata?.initializationDate) {
            parsed.currentProject.metadata.initializationDate = new Date(parsed.currentProject.metadata.initializationDate);
          }
        }
        
        parsed.recentProjects = parsed.recentProjects.map((p: any) => ({
          ...p,
          lastAccessed: new Date(p.lastAccessed),
          createdAt: new Date(p.createdAt || p.lastAccessed),
          isInitialized: p.isInitialized || false,
          metadata: {
            ...p.metadata,
            hasBackupFolder: p.metadata?.hasBackupFolder || false,
            initializationStatus: p.metadata?.initializationStatus || 'pending',
            initializationDate: p.metadata?.initializationDate ? new Date(p.metadata.initializationDate) : undefined,
          },
        }));
        
        parsed.availableProjects = parsed.availableProjects.map((p: any) => ({
          ...p,
          lastAccessed: new Date(p.lastAccessed),
          createdAt: new Date(p.createdAt || p.lastAccessed),
          isInitialized: p.isInitialized || false,
          metadata: {
            ...p.metadata,
            hasBackupFolder: p.metadata?.hasBackupFolder || false,
            initializationStatus: p.metadata?.initializationStatus || 'pending',
            initializationDate: p.metadata?.initializationDate ? new Date(p.metadata.initializationDate) : undefined,
          },
        }));
        
        parsed.lastUpdated = new Date(parsed.lastUpdated);

        this.context = parsed;
      }
    } catch (error) {
      console.error('Failed to load project context:', error);
    }
  }

  /**
   * Save context to storage
   */
  private saveContext(): void {
    try {
      localStorage.setItem('projectContext', JSON.stringify(this.context));
    } catch (error) {
      console.error('Failed to save project context:', error);
    }
  }

  /**
   * Mark project as initialized
   */
  markProjectAsInitialized(projectId: string): void {
    const project = this.getProjectById(projectId);
    if (project) {
      project.isInitialized = true;
      project.metadata.hasBackupFolder = true;
      project.metadata.initializationDate = new Date();
      project.metadata.initializationStatus = 'completed';
      this.notifyListeners();
    }
  }

  /**
   * Update project initialization status
   */
  updateProjectInitializationStatus(projectId: string, status: 'pending' | 'completed' | 'failed'): void {
    const project = this.getProjectById(projectId);
    if (project) {
      project.metadata.initializationStatus = status;
      if (status === 'completed') {
        project.isInitialized = true;
        project.metadata.hasBackupFolder = true;
        project.metadata.initializationDate = new Date();
      }
      this.notifyListeners();
    }
  }

  /**
   * Get initialization status for a project
   */
  getProjectInitializationStatus(projectId: string): {
    isInitialized: boolean;
    status: 'pending' | 'completed' | 'failed';
    initializationDate?: Date;
  } {
    const project = this.getProjectById(projectId);
    if (project) {
      return {
        isInitialized: project.isInitialized,
        status: project.metadata.initializationStatus || 'pending',
        initializationDate: project.metadata.initializationDate,
      };
    }
    return {
      isInitialized: false,
      status: 'pending',
    };
  }

  /**
   * Clear all project context
   */
  clearContext(): void {
    this.context = {
      currentProject: null,
      recentProjects: [],
      availableProjects: [],
      lastUpdated: new Date(),
    };
    this.notifyListeners();
  }
}

export default ProjectContextService;
