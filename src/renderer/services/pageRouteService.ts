import { aiKeysStore } from '../components/AIKeysManager/store/aiKeysStore';
import { ChatService } from '../components/ChatInterface/services/chatService';

export interface PageRouteState {
  currentUrl: string;
  urlPath: string;
  filesToOpen: string[];
  lastUpdated: Date;
  projectRoot: string;
  projectId?: string;
  // Nested mapping: projectRoot -> urlPath -> files
  routeToFiles: Record<string, Record<string, string[]>>;
}

class PageRouteService {
  private static instance: PageRouteService;

  private state: PageRouteState = {
    currentUrl: '',
    urlPath: '/',
    filesToOpen: [],
    lastUpdated: new Date(),
    projectRoot: '',
    routeToFiles: {},
  };

  private listeners: Set<(state: PageRouteState) => void> = new Set();

  private aiInFlightByPath: Record<string, boolean> = {};

  static getInstance(): PageRouteService {
    if (!PageRouteService.instance) {
      PageRouteService.instance = new PageRouteService();
    }
    return PageRouteService.instance;
  }

  subscribe(listener: (state: PageRouteState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): PageRouteState {
    return { ...this.state, filesToOpen: [...this.state.filesToOpen] };
  }

  setProject(projectRoot: string, projectId?: string): void {
    if (!projectRoot) return;
    const unchanged =
      projectRoot === this.state.projectRoot &&
      projectId === this.state.projectId;
    if (unchanged) return;
    this.state = {
      ...this.state,
      projectRoot,
      projectId,
      lastUpdated: new Date(),
    };
    this.notify();
  }

  setCurrentUrl(url: string): void {
    if (!url || url === this.state.currentUrl) {
      return;
    }
    
    const urlPath = this.safeGetPath(url);
    const pathChanged = this.state.urlPath !== urlPath;
    
    // Only log when path actually changes or it's a significant URL change
    if (pathChanged || this.state.currentUrl === '') {
      console.log('🔍 PageRouteService.setCurrentUrl - URL changed:', {
        oldUrl: this.state.currentUrl,
        newUrl: url,
        oldPath: this.state.urlPath,
        newPath: urlPath,
        pathChanged
      });
    }
    
    this.state = {
      ...this.state,
      currentUrl: url,
      urlPath,
      lastUpdated: new Date(),
    };
    this.notify();
  }

  setRoute(projectRoot: string, url: string, projectId?: string): void {
    const urlPath = this.safeGetPath(url);
    const sameProject =
      projectRoot === this.state.projectRoot &&
      projectId === this.state.projectId;
    const sameUrl =
      url === this.state.currentUrl && urlPath === this.state.urlPath;
    
    if (sameProject && sameUrl) {
      return;
    }
    
    // Only log when there's an actual change
    console.log('🔍 PageRouteService.setRoute - Route changed:', {
      projectRoot,
      url,
      urlPath,
      projectChanged: !sameProject,
      urlChanged: !sameUrl
    });
    
    this.state = {
      ...this.state,
      projectRoot,
      projectId,
      currentUrl: url,
      urlPath,
      lastUpdated: new Date(),
    };
    this.notify();
  }

  setFilesToOpen(files: string[]): void {
    const unique = Array.from(new Set((files || []).filter(Boolean)));
    const same =
      unique.length === this.state.filesToOpen.length &&
      unique.every((f, i) => f === this.state.filesToOpen[i]);
    if (same) return;
    this.state = {
      ...this.state,
      filesToOpen: unique,
      lastUpdated: new Date(),
    };
    // If we have current project and urlPath, record mapping
    if (this.state.projectRoot && this.state.urlPath) {
      this.setFilesForPath(
        this.state.projectRoot,
        this.state.urlPath,
        unique,
        /* notify */ false,
      );
    }
    this.notify();
  }

  /**
   * Explicitly set mapping of files for a given projectRoot and urlPath.
   * If notify=false, suppress immediate notify (useful when called from setters).
   */
  setFilesForPath(
    projectRoot: string,
    urlPath: string,
    files: string[],
    notify: boolean = true,
  ): void {
    const cleanRoot = projectRoot || '';
    const cleanPath = urlPath || '/';
    const uniqueAbs = Array.from(new Set((files || []).filter(Boolean)));
    // store relative-to-project for mapping readability
    const unique = uniqueAbs.map((f) => this.toRelative(cleanRoot, f));
    const current = this.state.routeToFiles[cleanRoot]?.[cleanPath] || [];
    const same =
      unique.length === current.length &&
      unique.every((f, i) => f === current[i]);
    if (same) return;

    const rootMap = { ...(this.state.routeToFiles[cleanRoot] || {}) };
    rootMap[cleanPath] = unique;
    this.state = {
      ...this.state,
      routeToFiles: {
        ...this.state.routeToFiles,
        [cleanRoot]: rootMap,
      },
      lastUpdated: new Date(),
    };
    if (notify) this.notify();
  }

  getFilesForPath(projectRoot: string, urlPath: string): string[] {
    return [...(this.state.routeToFiles[projectRoot]?.[urlPath] || [])];
  }

  getAllMappings(
    projectRoot?: string,
  ): Record<string, string[]> | Record<string, Record<string, string[]>> {
    if (projectRoot) {
      return { ...(this.state.routeToFiles[projectRoot] || {}) };
    }
    return JSON.parse(JSON.stringify(this.state.routeToFiles));
  }

  getMappingsList(
    projectRoot: string,
  ): Array<{ route: string; files: string[] }> {
    const rootMap = this.state.routeToFiles[projectRoot] || {};
    return Object.entries(rootMap).map(([route, files]) => ({
      route,
      files: [...files],
    }));
  }

  private toRelative(projectRoot: string, filePath: string): string {
    if (!projectRoot) return filePath;
    if (filePath.startsWith(projectRoot)) {
      return filePath.substring(projectRoot.length).replace(/^\/+/, '');
    }
    return filePath;
  }

  /**
   * Ensure AI file suggestions exist for a given URL using current projectRoot.
   */
  async ensureFilesForUrl(fullUrl: string): Promise<void> {
    const { projectRoot } = this.state;
    if (!projectRoot) return;
    await this.requestFilesForUrl(projectRoot, fullUrl);
  }

  /**
   * Call OpenAI with URL path and project tree to get files to open.
   * Saves both mapping and current filesToOpen.
   */
  async requestFilesForUrl(
    projectRoot: string,
    fullUrl: string,
  ): Promise<void> {
    if (!projectRoot || !fullUrl) return;
    const urlPath = this.safeGetPath(fullUrl);
    const inflightKey = `${projectRoot}::${urlPath}`;
    if (this.aiInFlightByPath[inflightKey]) return;
    this.aiInFlightByPath[inflightKey] = true;

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('[debug] creating project directory tree');
      }
      const tree = await this.gatherProjectTree(projectRoot, 5);
      // Resolve OpenAI key and model
      const openaiKeys = aiKeysStore.getKeysByProvider('openai');
      const key = openaiKeys[0];
      const model = 'gpt-4o-mini';
      if (!key) return;

      const systemPromptText =
        'You are an expert code navigator for a local web project.';
      const userPromptText = [
        'Given the current URL path and the project directory tree, list the local source files that are most relevant to edit for this page.',
        'Rules:',
        '- Return a JSON array of project-root-relative file paths (strings).',
        '- Include templates, route handlers, components, styles directly used by this path.',
        '- Prefer existing files from the provided tree.',
        '- IMPORTANT: Use the EXACT relative paths as shown in the project tree below.',
        '- For example, if the tree shows "www/inc/header.php", return exactly "www/inc/header.php"',
        '- Do NOT return partial paths like "inc/header.php" - use the full relative path from project root.',
        '',
        `Project root: ${projectRoot}`,
        `URL path: ${urlPath}`,
        'Project tree (relative to root):',
        tree.slice(0, 2000).join('\n'),
      ].join('\n');

      if (process.env.NODE_ENV === 'development') {
        console.log('[debug] sending request to OpenAI with prompt:');
        console.log('--- system ---');
        console.log(systemPromptText);
        console.log('--- user ---');
        console.log(userPromptText);
      }

      const response = await ChatService.sendMessage(
        key,
        model,
        [
          { id: 'sys', role: 'system', content: systemPromptText } as any,
          { id: 'usr', role: 'user', content: userPromptText } as any,
        ],
        { temperature: 0.1, maxTokens: 4096 },
      );

      if (response?.success && response.message) {
        let files: string[] = [];
        const text = response.message.trim();
        try {
          const jsonMatch = text.match(/```json[\s\S]*?```/i);
          const raw = jsonMatch
            ? jsonMatch[0].replace(/```json|```/g, '')
            : text;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed))
            files = parsed.filter((x) => typeof x === 'string');
        } catch {
          files = text
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean);
        }

        if (files.length > 0) {
          // Update mapping with relative paths and expose filesToOpen as absolute for consumers
          this.setFilesForPath(projectRoot, urlPath, files, /* notify */ false);
          const abs = files.map((p) =>
            p.startsWith('/') ? p : `${projectRoot}/${p}`,
          );
          this.setFilesToOpen(abs);
        }
      }
    } catch {
      // ignore
    } finally {
      delete this.aiInFlightByPath[inflightKey];
    }
  }

  // Recursively gather project directory tree with proper hierarchy notation
  private async gatherProjectTree(
    root: string,
    maxDepth: number = 6,
    currentDepth: number = 0,
  ): Promise<string[]> {
    if (currentDepth > maxDepth) return [];
    const skipDirs = new Set([
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'dist',
      'build',
      'out',
      'coverage',
      '.nyc_output',
      'tmp',
      'temp',
      'logs',
      'cache',
      '.next',
      '.nuxt',
      '.output',
      '.svelte-kit',
      '.astro',
    ]);
    const codeExtensions = [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.h',
      '.hpp',
      '.php',
      '.html',
      '.css',
      '.scss',
      '.sass',
      '.less',
      '.vue',
      '.svelte',
      '.rs',
      '.go',
      '.rb',
      '.swift',
      '.kt',
      '.scala',
      '.clj',
      '.hs',
      '.ml',
      '.json',
      '.yaml',
      '.yml',
      '.toml',
      '.ini',
      '.conf',
      '.md',
      '.txt',
    ];

    try {
      const result = await (
        window as any
      ).electron?.fileSystem?.readDirectory?.(root);
      if (!result?.success || !Array.isArray(result.items)) return [];

      const paths: string[] = [];
      const indent = '  '.repeat(currentDepth); // 2 spaces per depth level

      // Sort items: directories first, then files
      const sortedItems = result.items.sort((a: any, b: any) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const item of sortedItems) {
        if (!item?.name || !item?.path) continue;

        if (item.isDirectory) {
          if (skipDirs.has(item.name) || item.isHidden) continue;
          const relDir = item.path.startsWith(root)
            ? item.path.substring(root.length).replace(/^\//, '')
            : item.path;
          // Add directory with proper indentation and tree notation
          paths.push(`${indent}📁 ${item.name}/`);

          // Recursively get subdirectory contents
          const sub = await this.gatherProjectTree(
            item.path,
            maxDepth,
            currentDepth + 1,
          );
          paths.push(...sub);
        } else if (item.isFile) {
          const lower = item.name.toLowerCase();
          if (codeExtensions.some((ext) => lower.endsWith(ext))) {
            // Add file with proper indentation and file icon
            const fileIcon = this.getFileIcon(lower);
            paths.push(`${indent}${fileIcon} ${item.name}`);
          }
        }
      }
      return paths;
    } catch {
      return [];
    }
  }

  // Helper method to get appropriate file icon based on extension
  private getFileIcon(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const iconMap: { [key: string]: string } = {
      js: '📄',
      jsx: '⚛️',
      ts: '📘',
      tsx: '⚛️',
      php: '🐘',
      html: '🌐',
      css: '🎨',
      scss: '🎨',
      sass: '🎨',
      json: '📋',
      md: '📝',
      py: '🐍',
      java: '☕',
      cpp: '⚙️',
      c: '⚙️',
      cs: '🔷',
      go: '🐹',
      rs: '🦀',
      rb: '💎',
      xml: '📄',
      yaml: '📄',
      yml: '📄',
      vue: '💚',
      svelte: '🧡',
    };
    return iconMap[ext] || '📄';
  }

  private notify(): void {
    // Only log and notify if there are listeners
    if (this.listeners.size === 0) {
      return;
    }
    
    // Only log significant state changes, not every notification
    if (this.state.urlPath !== '/' || this.state.filesToOpen.length > 0) {
      console.log('🔍 PageRouteService.notify - State updated:', {
        urlPath: this.state.urlPath,
        filesCount: this.state.filesToOpen.length,
        projectRoot: this.state.projectRoot ? 'set' : 'unset'
      });
    }
    
    for (const l of this.listeners) l(this.getState());
  }

  private safeGetPath(url: string): string {
    try {
      const pathname = new URL(url).pathname || '/';
      return pathname;
    } catch (error) {
      console.warn('🔍 PageRouteService.safeGetPath - Invalid URL, using "/":', url);
      return '/';
    }
  }
}

export default PageRouteService;
