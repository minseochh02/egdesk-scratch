import React, { useEffect, useState, useRef } from 'react';
import { DualScreenAIEditor } from './DualScreenAIEditor';
import { WebsitePreview } from './WebsitePreview';
import CodeEditor from '../CodeEditor';
import { URLFileViewer } from './URLFileViewer';
import './DualScreenEditor.css';
import ProjectContextService, { ProjectInfo } from '../../services/projectContextService';
import PageRouteService from '../../services/pageRouteService';

interface DualScreenEditorProps {
  isVisible: boolean;
  currentFile: {
    path: string;
    name: string;
    content: string;
    language: string;
  } | null;
  onApplyEdits: (edits: any[]) => void;
  onClose: () => void;
}

export const DualScreenEditor: React.FC<DualScreenEditorProps> = ({
  isVisible,
  currentFile,
  onApplyEdits,
  onClose
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [routeFiles, setRouteFiles] = useState<string[]>([]);
  const [routeFilesWithContent, setRouteFilesWithContent] = useState<Array<{
    path: string;
    name: string;
    content: string;
    language: string;
  }>>([]);
  const [currentProject, setCurrentProject] = useState<ProjectInfo | null>(null);
  const [serverEnsured, setServerEnsured] = useState<boolean>(false);
  const aiRequestInFlightRef = useRef<boolean>(false);
  const lastPathRef = useRef<string>('');
  const debounceTimerRef = useRef<any>(null);
  const initialHomeRequestedRef = useRef<boolean>(false);
  const homeTriggeredRef = useRef<boolean>(false);
  
  // Toggle between editing and non-editing states
  const toggleEditingMode = () => {
    setIsEditing(!isEditing);
  };

  // Resolve route to files using a simple heuristic
  const resolveFilesForUrl = (url: string): string[] => {
    try {
      const u = new URL(url);
      const path = u.pathname; // e.g., /about or /index.php
      const projectRoot = currentProject?.path || '';
      if (!projectRoot) return [];

      const candidates: string[] = [];
      // If WordPress-like project
      candidates.push(`${projectRoot}/index.php`);
      candidates.push(`${projectRoot}/wp-content/themes`);
      candidates.push(`${projectRoot}/wp-content/plugins`);

      // Map /about to about.php/html and assets
      const base = path.replace(/^\//, '');
      if (base) {
        candidates.push(`${projectRoot}/${base}.php`);
        candidates.push(`${projectRoot}/${base}.html`);
        candidates.push(`${projectRoot}/${base}/index.php`);
        candidates.push(`${projectRoot}/${base}/index.html`);
      }

      // Common entry points
      candidates.push(`${projectRoot}/index.html`);
      candidates.push(`${projectRoot}/style.css`);
      candidates.push(`${projectRoot}/styles.css`);
      candidates.push(`${projectRoot}/script.js`);
      candidates.push(`${projectRoot}/app.js`);

      // De-duplicate
      return Array.from(new Set(candidates));
    } catch {
      return [];
    }
  };

  const handleUrlChange = (url: string) => {
    if (!url) return;
    const path = (() => { try { return new URL(url).pathname || '/'; } catch { return '/'; } })();
    if (path === lastPathRef.current) return; // ignore duplicates
    lastPathRef.current = path;
    setCurrentUrl(url);
    PageRouteService.getInstance().setCurrentUrl(url);
    // immediate heuristic
    setRouteFiles(resolveFilesForUrl(url));
    PageRouteService.getInstance().setFilesToOpen(resolveFilesForUrl(url));
    // debounce AI requests per path
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void suggestFilesWithAI(url);
    }, 400);
  };

  // Recursively gather project directory tree (relative paths), aligning with Codespace analysis
  const gatherProjectTree = async (root: string, maxDepth: number = 6, currentDepth: number = 0): Promise<string[]> => {
    if (currentDepth > maxDepth) return [];
    const skipDirs = new Set([
      'node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'out',
      'coverage', '.nyc_output', 'tmp', 'temp', 'logs', 'cache',
      '.next', '.nuxt', '.output', '.svelte-kit', '.astro'
    ]);
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
      '.php', '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
      '.rs', '.go', '.rb', '.swift', '.kt', '.scala', '.clj', '.hs', '.ml',
      '.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.md', '.txt'
    ];
    try {
      const result = await (window as any).electron?.fileSystem?.readDirectory?.(root);
      if (!result?.success || !Array.isArray(result.items)) return [];
      const paths: string[] = [];
      for (const item of result.items) {
        if (!item?.name || !item?.path) continue;
        if (item.isDirectory) {
          if (skipDirs.has(item.name) || item.isHidden) continue;
          const relDir = item.path.startsWith(root) ? item.path.substring(root.length).replace(/^\//, '') : item.path;
          paths.push(relDir + '/');
          const sub = await gatherProjectTree(item.path, maxDepth, currentDepth + 1);
          paths.push(...sub);
        } else if (item.isFile) {
          const lower = item.name.toLowerCase();
          if (codeExtensions.some(ext => lower.endsWith(ext))) {
            const rel = item.path.startsWith(root) ? item.path.substring(root.length).replace(/^\//, '') : item.path;
            paths.push(rel);
          }
        }
      }
      return paths;
    } catch {
      return [];
    }
  };

  // Ask Gemini 1.5 to suggest files to open for editing based on URL path and project tree
  const suggestFilesWithAI = async (fullUrl: string) => {
    if (aiRequestInFlightRef.current) return;
    if (!currentProject?.path) return;
    try {
      aiRequestInFlightRef.current = true;
      await PageRouteService.getInstance().requestFilesForUrl(currentProject.path, fullUrl);
      const mapping = PageRouteService.getInstance().getFilesForPath(currentProject.path, new URL(fullUrl).pathname || '/');
      const abs = mapping.map(p => (p.startsWith('/') ? p : `${currentProject.path}/${p}`));
      if (abs.length > 0) setRouteFiles(abs);
    } catch {
      // ignore
    } finally {
      aiRequestInFlightRef.current = false;
    }
  };

  // Subscribe to global project context
  useEffect(() => {
    const service = ProjectContextService.getInstance();
    // set initial
    const context = service.getContext();
    setCurrentProject(context.currentProject || null);
    const unsubscribe = service.subscribe((ctx) => {
      setCurrentProject(ctx.currentProject || null);
    });
    return unsubscribe;
  }, []);

  // Keep PageRouteService in sync with current project and add debug logging
  useEffect(() => {
    if (currentProject?.path) {
      PageRouteService.getInstance().setProject(currentProject.path, currentProject.id);
    }
  }, [currentProject?.path, currentProject?.id]);

  // Function to load content for route files
  const loadRouteFilesContent = async (filePaths: string[]) => {
    if (!filePaths || filePaths.length === 0) {
      setRouteFilesWithContent([]);
      return;
    }

    try {
      const filesWithContent = await Promise.all(
        filePaths.map(async (filePath) => {
          try {
            const result = await window.electron.fileSystem.readFile(filePath);
            if (result.success && result.content) {
              const fileName = filePath.split('/').pop() || filePath;
              const extension = fileName.split('.').pop()?.toLowerCase();
              const languageMap: { [key: string]: string } = {
                'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
                'php': 'php', 'html': 'html', 'css': 'css', 'scss': 'scss', 'sass': 'sass',
                'json': 'json', 'md': 'markdown', 'py': 'python', 'java': 'java', 'cpp': 'cpp',
                'c': 'c', 'cs': 'csharp', 'go': 'go', 'rs': 'rust', 'rb': 'ruby',
                'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml'
              };
              
              return {
                path: filePath,
                name: fileName,
                content: result.content,
                language: languageMap[extension || ''] || 'plaintext'
              };
            }
            return null;
          } catch (error) {
            console.error(`Failed to read file ${filePath}:`, error);
            return null;
          }
        })
      );

      const validFiles = filesWithContent.filter(file => file !== null);
      setRouteFilesWithContent(validFiles);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Route Files Content] Loaded ${validFiles.length} files with content`);
      }
    } catch (error) {
      console.error('Failed to load route files content:', error);
      setRouteFilesWithContent([]);
    }
  };

  useEffect(() => {
    const svc = PageRouteService.getInstance();
    const unsub = svc.subscribe((state) => {
      if (process.env.NODE_ENV === 'development') {
        const mappings = svc.getMappingsList(state.projectRoot);
        // Debug: show the latest route -> files mapping in console
        console.log('[Route->Files] Project:', state.projectRoot);
        console.table(mappings);
        // Also show the most recent change concisely
        const latest = mappings.find(m => m.route === state.urlPath);
        if (latest) {
          console.log(`[Route->Files] ${latest.route} =>`, latest.files);
        }
      }
      // Use the service's current filesToOpen to drive the code editor
      if (state.filesToOpen && state.filesToOpen.length > 0) {
        setRouteFiles(state.filesToOpen);
        // Load content for AI context
        loadRouteFilesContent(state.filesToOpen);
      } else {
        setRouteFilesWithContent([]);
      }
    });
    return unsub;
  }, []);

  // Kick off initial homepage route resolution once when project/server ready
  useEffect(() => {
    if (!currentProject?.path) return;
    if (!serverEnsured) return;
    if (initialHomeRequestedRef.current) return;
    (async () => {
      try {
        const defaultUrl = currentUrl || 'http://localhost:8000/';
        const path = (() => { try { return new URL(defaultUrl).pathname || '/'; } catch { return '/'; } })();
        // If we already handled this path or have a mapping, skip
        if (lastPathRef.current === path) return;
        const existing = PageRouteService.getInstance().getFilesForPath(currentProject.path, path);
        if (existing && existing.length > 0) {
          const abs = existing.map(p => (p.startsWith('/') ? p : `${currentProject.path}/${p}`));
          setRouteFiles(abs);
          lastPathRef.current = path;
          initialHomeRequestedRef.current = true;
          return;
        }
        // Request AI mapping once
        initialHomeRequestedRef.current = true;
        await PageRouteService.getInstance().requestFilesForUrl(currentProject.path, defaultUrl);
        const rels = PageRouteService.getInstance().getFilesForPath(currentProject.path, path);
        const abs2 = rels.map(p => (p.startsWith('/') ? p : `${currentProject.path}/${p}`));
        if (abs2.length > 0) {
          setRouteFiles(abs2);
          lastPathRef.current = path;
        }
      } catch {
        // ignore
      }
    })();
  }, [currentProject?.path, serverEnsured]);

  // Ensure local server is running when entering this page
  useEffect(() => {
    const ensureServer = async () => {
      if (!isVisible) return;
      if (!currentProject || !currentProject.path) return;
      if (serverEnsured) return;
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('[debug] initial server start');
        }
        // Check status first
        const statusResult = await (window as any).electron?.wordpressServer?.getServerStatus?.();
        const isRunning = !!(statusResult && statusResult.success && statusResult.status && statusResult.status.isRunning);
        if (isRunning) {
          setServerEnsured(true);
          if (!homeTriggeredRef.current) {
            homeTriggeredRef.current = true;
            if (process.env.NODE_ENV === 'development') {
              console.log('[debug] calling PageRouteService for homepage (server already running)');
            }
            const defaultUrl = currentUrl || 'http://localhost:8000/';
            await PageRouteService.getInstance().requestFilesForUrl(currentProject.path, defaultUrl);
          }
          return;
        }
        // Analyze folder (optional but helpful)
        await (window as any).electron?.wordpressServer?.analyzeFolder?.(currentProject.path);
        // Start server on default port (8000)
        const startResult = await (window as any).electron?.wordpressServer?.startServer?.(currentProject.path, 8000);
        if (startResult && startResult.success) {
          setServerEnsured(true);
          if (!homeTriggeredRef.current) {
            homeTriggeredRef.current = true;
            if (process.env.NODE_ENV === 'development') {
              console.log('[debug] calling PageRouteService for homepage (after start)');
            }
            const defaultUrl = currentUrl || `http://localhost:${startResult.port || 8000}/`;
            await PageRouteService.getInstance().requestFilesForUrl(currentProject.path, defaultUrl);
          }
        }
      } catch (err) {
        // Swallow errors to avoid breaking the page; server controls UI can still be used
        // console.error('Failed to ensure local server:', err);
      }
    };
    ensureServer();
  }, [isVisible, currentProject, serverEnsured]);

  if (!isVisible) return null;

  return (
    <div className="dual-screen-editor">
    {/* Dual Screen Content */}
    <div className="dual-screen-content">
      {/* Left Panel - Chat/AI Editor */}
      <div className="panel left-panel">
        <div className="panel-content">
                  <DualScreenAIEditor
          isVisible={true}
          currentFile={currentFile}
          onApplyEdits={onApplyEdits}
          onClose={() => {}} // Don't close, just hide
          isEditing={isEditing}
          onToggleEditing={toggleEditingMode}
          routeFiles={routeFilesWithContent}
        />
        </div>
      </div>

      {/* Right Panel - Code View/Website */}
      <div className="panel right-panel">
        <div className="panel-content">
          {isEditing ? (
            <URLFileViewer 
              filesToOpen={routeFiles}
              instanceId="dual-screen"
            />
          ) : (
            <WebsitePreview 
              isEditing={isEditing}
              onToggleEditing={toggleEditingMode}
              onUrlChange={handleUrlChange}
            />
          )}
        </div>
      </div>
    </div>

    
    </div>
  );
};
