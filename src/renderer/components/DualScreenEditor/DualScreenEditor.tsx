import React, { useEffect, useState, useRef } from 'react';
import { DualScreenAIEditor } from './DualScreenAIEditor';
import { BrowserWindow } from './BrowserWindow';
import CodeEditor from '../CodeEditor';
import { URLFileViewer } from './URLFileViewer';
import { RevertManager, RevertButton } from '../RevertManager';
import './DualScreenEditor.css';
import ProjectContextService, {
  ProjectInfo,
} from '../../services/projectContextService';
import PageRouteService from '../../services/pageRouteService';
import { restartServer, refreshBrowserWindows } from './utils/serverOperations';

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
  onFileRefresh?: (filePath: string) => void; // Callback to refresh file content
  onFileSelect?: (file: {
    path: string;
    name: string;
    content: string;
    language: string;
  }) => void; // Callback to select a file
}

export const DualScreenEditor: React.FC<DualScreenEditorProps> = ({
  isVisible,
  currentFile,
  onApplyEdits,
  onClose,
  onFileRefresh,
  onFileSelect,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [routeFiles, setRouteFiles] = useState<string[]>([]);
  const [routeFilesWithContent, setRouteFilesWithContent] = useState<
    Array<{
      path: string;
      name: string;
      content: string;
      language: string;
    }>
  >([]);
  const [currentProject, setCurrentProject] = useState<ProjectInfo | null>(
    null,
  );
  const [serverEnsured, setServerEnsured] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [diffData, setDiffData] = useState<{
    filePath: string;
    diff: { before: string; after: string; lineNumber: number };
  } | null>(null);
  const [showRevertManager, setShowRevertManager] = useState(false);
  const [revertMessage, setRevertMessage] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [refreshedFileContent, setRefreshedFileContent] = useState<{
    path: string;
    name: string;
    content: string;
    language: string;
  } | null>(null);
  const aiRequestInFlightRef = useRef<boolean>(false);
  const lastPathRef = useRef<string>('');
  const debounceTimerRef = useRef<any>(null);
  const initialHomeRequestedRef = useRef<boolean>(false);
  const homeTriggeredRef = useRef<boolean>(false);
  const isRevertingRef = useRef<boolean>(false);

  // Toggle between editing and non-editing states
  const toggleEditingMode = () => {
    setIsEditing(!isEditing);
  };

  // Refresh file content from disk
  const refreshFileContent = async (filePath: string) => {
    try {
      console.log(
        `🔄 Refreshing file content from disk: ${filePath} (isReverting: ${isRevertingRef.current})`,
      );

      const result = await window.electron.fileSystem.readFile(filePath);
      if (result.success && result.content !== undefined) {
        const fileName = filePath.split('/').pop() || filePath;
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

        // Simple language detection based on file extension
        const getLanguageFromExtension = (ext: string): string => {
          const languageMap: { [key: string]: string } = {
            js: 'javascript',
            jsx: 'javascript',
            ts: 'typescript',
            tsx: 'typescript',
            php: 'php',
            html: 'html',
            css: 'css',
            scss: 'scss',
            json: 'json',
            md: 'markdown',
            py: 'python',
            java: 'java',
            cpp: 'cpp',
            c: 'c',
            xml: 'xml',
            sql: 'sql',
          };
          return languageMap[ext] || 'text';
        };

        const refreshedFile = {
          path: filePath,
          name: fileName,
          content: result.content,
          language: getLanguageFromExtension(fileExtension),
        };

        console.log(
          `📁 Setting refreshed file content: ${filePath} (${result.content.length} characters, isReverting: ${isRevertingRef.current})`,
        );

        // Add debugging for revert operations
        if (isRevertingRef.current) {
          console.log(
            `🔄 REVERT DEBUG: Setting refreshed content for ${filePath}`,
            {
              contentLength: result.content.length,
              contentPreview: `${result.content.substring(0, 100)}...`,
              timestamp: new Date().toISOString(),
            },
          );
        }

        setRefreshedFileContent(refreshedFile);

        // Also call the parent callback if provided
        if (onFileRefresh) {
          onFileRefresh(filePath);
        }

        console.log(
          `✅ File content refreshed successfully: ${filePath} (${result.content.length} characters)`,
        );
        return refreshedFile;
      }
      console.error(`❌ Failed to refresh file content: ${result.error}`);
      return null;
    } catch (error) {
      console.error(`❌ Error refreshing file content:`, error);
      return null;
    }
  };

  // Handle revert operations
  const handleRevertComplete = async (result: any) => {
    console.log(`🔄 handleRevertComplete called with result:`, result);

    if (result.success) {
      setRevertMessage({
        type: 'success',
        message:
          result.summary ||
          `Successfully reverted ${result.restoredFiles.length} file(s)`,
      });

      // Set reverting flag to prevent useEffect from clearing content
      isRevertingRef.current = true;
      console.log(`🔄 Set isRevertingRef to true`);

      // Refresh the current file content if it was reverted
      if (currentFile && result.restoredFiles.includes(currentFile.path)) {
        console.log(
          `🔄 Current file was reverted, refreshing content: ${currentFile.path}`,
        );
        await refreshFileContent(currentFile.path);
      } else if (!currentFile && result.restoredFiles.length > 0) {
        // If we don't have a current file but files were reverted,
        // set the first reverted file as the current file to show in the UI
        console.log(
          `🔄 No current file selected, setting first reverted file as current: ${result.restoredFiles[0]}`,
        );
        const firstRevertedFile = await refreshFileContent(
          result.restoredFiles[0],
        );
        if (firstRevertedFile) {
          // This will trigger the UI to show the reverted content
          console.log(
            `🔄 Set first reverted file as current file for UI display`,
          );
        }
      } else {
        console.log(
          `🔄 Current file was not reverted or not found in restored files`,
          {
            currentFile: currentFile?.path,
            restoredFiles: result.restoredFiles,
          },
        );

        // Only refresh other reverted files if we have a current file and it wasn't reverted
        if (currentFile) {
          for (const revertedFilePath of result.restoredFiles) {
            if (revertedFilePath !== currentFile.path) {
              console.log(`🔄 Refreshing reverted file: ${revertedFilePath}`);
              await refreshFileContent(revertedFilePath);
            }
          }
        }
      }

      // Ensure the refreshed content persists by adding a small delay
      // This prevents the useEffect from clearing the refreshed content too quickly
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Reset flag after a short delay to allow the refresh to complete
      setTimeout(() => {
        isRevertingRef.current = false;
        console.log(`🔄 Set isRevertingRef to false`);
      }, 100);

      // Restart server and refresh browser to show reverted changes
      try {
        console.log('🔄 Restarting server to show reverted changes...');
        const serverResult = await restartServer({ currentProject });
        if (serverResult.success) {
          console.log(
            '✅ Server restarted successfully, changes should be visible at:',
            serverResult.url,
          );
        } else {
          console.warn(
            '⚠️ Server restart failed, but files were reverted:',
            serverResult.error,
          );
          // Still try to refresh browser windows
          await refreshBrowserWindows();
        }
      } catch (error) {
        console.error('❌ Error restarting server after bulk revert:', error);
        // Still try to refresh browser windows
        await refreshBrowserWindows();
      }
    } else {
      setRevertMessage({
        type: 'error',
        message: result.summary || `Revert failed: ${result.errors.join(', ')}`,
      });
    }

    // Auto-dismiss the message after 5 seconds
    setTimeout(() => setRevertMessage(null), 5000);
  };

  const handleRevertButtonComplete = async (
    success: boolean,
    message: string,
    filePath?: string,
  ) => {
    console.log(
      `🔄 handleRevertButtonComplete called with success: ${success}, message: ${message}, filePath: ${filePath}`,
    );

    setRevertMessage({
      type: success ? 'success' : 'error',
      message,
    });

    // If revert was successful and we have a current file, refresh its content
    if (success && currentFile) {
      console.log(
        `🔄 Single file revert successful, refreshing content: ${currentFile.path}`,
      );
      isRevertingRef.current = true; // Set flag to prevent useEffect from clearing content
      console.log(`🔄 Set isRevertingRef to true (single file revert)`);
      await refreshFileContent(currentFile.path);
      // Reset flag after a short delay to allow the refresh to complete
      setTimeout(() => {
        isRevertingRef.current = false;
        console.log(`🔄 Set isRevertingRef to false (single file revert)`);
      }, 100);

      // Restart server and refresh browser to show reverted changes
      try {
        console.log('🔄 Restarting server to show reverted changes...');
        const serverResult = await restartServer({ currentProject });
        if (serverResult.success) {
          console.log(
            '✅ Server restarted successfully, changes should be visible at:',
            serverResult.url,
          );
        } else {
          console.warn(
            '⚠️ Server restart failed, but file was reverted:',
            serverResult.error,
          );
          // Still try to refresh browser windows
          await refreshBrowserWindows();
        }
      } catch (error) {
        console.error('❌ Error restarting server after revert:', error);
        // Still try to refresh browser windows
        await refreshBrowserWindows();
      }
    } else if (success && !currentFile && filePath) {
      // If revert was successful but we don't have a current file,
      // use the filePath parameter to refresh the reverted file
      console.log(
        `🔄 Single file revert successful but no current file, using filePath: ${filePath}`,
      );

      isRevertingRef.current = true;
      const refreshedFile = await refreshFileContent(filePath);
      if (refreshedFile && onFileSelect) {
        console.log(`🔄 Selecting reverted file: ${filePath}`);
        onFileSelect(refreshedFile);
      }
      setTimeout(() => {
        isRevertingRef.current = false;
        console.log(
          `🔄 Set isRevertingRef to false (single file revert - no current file)`,
        );
      }, 100);

      // Restart server and refresh browser to show reverted changes
      try {
        console.log('🔄 Restarting server to show reverted changes...');
        const serverResult = await restartServer({ currentProject });
        if (serverResult.success) {
          console.log(
            '✅ Server restarted successfully, changes should be visible at:',
            serverResult.url,
          );
        } else {
          console.warn(
            '⚠️ Server restart failed, but file was reverted:',
            serverResult.error,
          );
          // Still try to refresh browser windows
          await refreshBrowserWindows();
        }
      } catch (error) {
        console.error('❌ Error restarting server after revert:', error);
        // Still try to refresh browser windows
        await refreshBrowserWindows();
      }
    } else {
      console.log(`🔄 Single file revert not successful or no current file`, {
        success,
        currentFile: currentFile?.path,
      });
    }

    // Auto-dismiss the message after 5 seconds
    setTimeout(() => setRevertMessage(null), 5000);
  };

  // Handle diff display from AI Editor
  const handleShowDiff = (
    filePath: string,
    diff: { before: string; after: string; lineNumber: number },
  ) => {
    setDiffData({ filePath, diff });

    // Switch to editing mode if not already in editing mode
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  // Clear refreshed file content when current file changes
  useEffect(() => {
    console.log(
      `🔍 useEffect triggered - currentFile: ${currentFile?.path}, refreshedFileContent: ${refreshedFileContent?.path}, isReverting: ${isRevertingRef.current}`,
    );

    // Don't clear refreshed content if we're in the middle of a revert operation
    if (isRevertingRef.current) {
      console.log(`🔄 Skipping content clear during revert operation`);
      return;
    }

    // Only clear refreshed content if the current file path is different from refreshed content path
    // AND we're not in the middle of a revert operation
    if (
      currentFile &&
      refreshedFileContent &&
      currentFile.path !== refreshedFileContent.path
    ) {
      console.log(
        `📁 Clearing refreshed content due to file change: ${refreshedFileContent.path} -> ${currentFile.path}`,
      );
      setRefreshedFileContent(null);
    }
  }, [currentFile?.path, refreshedFileContent?.path]); // Include refreshedFileContent to handle revert scenarios

  // Handle server status changes
  const handleServerStatusChange = (status: any) => {
    setServerStatus(status);
    if (status?.url && status.url !== currentUrl) {
      setCurrentUrl(status.url);
      handleUrlChange(status.url);
    } else if (status?.port) {
      const newServerUrl = `http://localhost:${status.port}`;
      if (newServerUrl !== currentUrl) {
        setCurrentUrl(newServerUrl);
        handleUrlChange(newServerUrl);
      }
    }
  };

  // Cleanup server when component becomes invisible
  useEffect(() => {
    if (!isVisible && serverEnsured) {
      // Component is being hidden, stop the server
      (async () => {
        try {
          await (window as any).electron?.wordpressServer?.stopServer?.();
          setServerEnsured(false);
          setServerStatus(null);
        } catch (err) {
          console.warn('Failed to stop server when hiding component:', err);
        }
      })();
    }
  }, [isVisible, serverEnsured]);

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
    const path = (() => {
      try {
        return new URL(url).pathname || '/';
      } catch {
        return '/';
      }
    })();
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
  const gatherProjectTree = async (
    root: string,
    maxDepth: number = 6,
    currentDepth: number = 0,
  ): Promise<string[]> => {
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
      for (const item of result.items) {
        if (!item?.name || !item?.path) continue;
        if (item.isDirectory) {
          if (skipDirs.has(item.name) || item.isHidden) continue;
          const relDir = item.path.startsWith(root)
            ? item.path.substring(root.length).replace(/^\//, '')
            : item.path;
          paths.push(`${relDir}/`);
          const sub = await gatherProjectTree(
            item.path,
            maxDepth,
            currentDepth + 1,
          );
          paths.push(...sub);
        } else if (item.isFile) {
          const lower = item.name.toLowerCase();
          if (codeExtensions.some((ext) => lower.endsWith(ext))) {
            const rel = item.path.startsWith(root)
              ? item.path.substring(root.length).replace(/^\//, '')
              : item.path;
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
      await PageRouteService.getInstance().requestFilesForUrl(
        currentProject.path,
        fullUrl,
      );
      const mapping = PageRouteService.getInstance().getFilesForPath(
        currentProject.path,
        new URL(fullUrl).pathname || '/',
      );
      const abs = mapping.map((p) =>
        p.startsWith('/') ? p : `${currentProject.path}/${p}`,
      );
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
      PageRouteService.getInstance().setProject(
        currentProject.path,
        currentProject.id,
      );
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
                js: 'javascript',
                jsx: 'javascript',
                ts: 'typescript',
                tsx: 'typescript',
                php: 'php',
                html: 'html',
                css: 'css',
                scss: 'scss',
                sass: 'sass',
                json: 'json',
                md: 'markdown',
                py: 'python',
                java: 'java',
                cpp: 'cpp',
                c: 'c',
                cs: 'csharp',
                go: 'go',
                rs: 'rust',
                rb: 'ruby',
                xml: 'xml',
                yaml: 'yaml',
                yml: 'yaml',
              };

              return {
                path: filePath,
                name: fileName,
                content: result.content,
                language: languageMap[extension || ''] || 'plaintext',
              };
            }
            return null;
          } catch (error) {
            console.error(`Failed to read file ${filePath}:`, error);
            return null;
          }
        }),
      );

      const validFiles = filesWithContent.filter((file) => file !== null);
      setRouteFilesWithContent(validFiles);
    } catch (error) {
      console.error('Failed to load route files content:', error);
      setRouteFilesWithContent([]);
    }
  };

  useEffect(() => {
    const svc = PageRouteService.getInstance();
    const unsub = svc.subscribe((state) => {
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
        const path = (() => {
          try {
            return new URL(defaultUrl).pathname || '/';
          } catch {
            return '/';
          }
        })();
        // If we already handled this path or have a mapping, skip
        if (lastPathRef.current === path) return;
        const existing = PageRouteService.getInstance().getFilesForPath(
          currentProject.path,
          path,
        );
        if (existing && existing.length > 0) {
          const abs = existing.map((p) =>
            p.startsWith('/') ? p : `${currentProject.path}/${p}`,
          );
          setRouteFiles(abs);
          lastPathRef.current = path;
          initialHomeRequestedRef.current = true;
          return;
        }
        // Request AI mapping once
        initialHomeRequestedRef.current = true;
        await PageRouteService.getInstance().requestFilesForUrl(
          currentProject.path,
          defaultUrl,
        );
        const rels = PageRouteService.getInstance().getFilesForPath(
          currentProject.path,
          path,
        );
        const abs2 = rels.map((p) =>
          p.startsWith('/') ? p : `${currentProject.path}/${p}`,
        );
        if (abs2.length > 0) {
          setRouteFiles(abs2);
          lastPathRef.current = path;
        }
      } catch {
        // ignore
      }
    })();
  }, [currentProject?.path, serverEnsured]);

  // Cleanup server when component unmounts or project changes
  useEffect(() => {
    return () => {
      // Cleanup function - stop server when component unmounts
      if (serverEnsured) {
        (async () => {
          try {
            await (window as any).electron?.wordpressServer?.stopServer?.();
          } catch (err) {
            console.warn('Failed to stop server on cleanup:', err);
          }
        })();
      }
    };
  }, [serverEnsured]);

  // Handle project changes - stop current server and reset state
  useEffect(() => {
    if (currentProject?.path) {
      // Reset server state when project changes
      setServerEnsured(false);
      setServerStatus(null);
      homeTriggeredRef.current = false;
      initialHomeRequestedRef.current = false;
    }
  }, [currentProject?.path]);

  // Periodic server status check to ensure we have the latest status
  useEffect(() => {
    if (!isVisible || !currentProject?.path) return;

    const checkServerStatus = async () => {
      try {
        const statusResult = await (
          window as any
        ).electron?.wordpressServer?.getServerStatus?.();
        if (statusResult && statusResult.success && statusResult.status) {
          // Update server status if it's different
          setServerStatus((prevStatus: any) => {
            if (
              !prevStatus ||
              prevStatus.isRunning !== statusResult.status.isRunning
            ) {
              if (statusResult.status.isRunning && !serverEnsured) {
                setServerEnsured(true);
              }
              return statusResult.status;
            }
            return prevStatus;
          });
        }
      } catch (err) {
        // Ignore errors in periodic check
      }
    };

    // Check immediately
    checkServerStatus();

    // Then check every 2 seconds
    const interval = setInterval(checkServerStatus, 2000);
    return () => clearInterval(interval);
  }, [isVisible, currentProject?.path, serverEnsured]); // Removed serverStatus from dependencies

  // Ensure local server is running when entering this page
  useEffect(() => {
    const ensureServer = async () => {
      if (!isVisible) return;
      if (!currentProject || !currentProject.path) return;
      if (serverEnsured) return;
      try {
        // Check status first and clean up any existing servers
        const statusResult = await (
          window as any
        ).electron?.wordpressServer?.getServerStatus?.();
        const isRunning = !!(
          statusResult &&
          statusResult.success &&
          statusResult.status &&
          statusResult.status.isRunning
        );

        if (isRunning) {
          // Check if the running server is for the current project
          const currentServerPath = statusResult.status?.projectPath;
          if (currentServerPath === currentProject.path) {
            // Server is already running for this project, use it
            setServerEnsured(true);
            setServerStatus(statusResult.status);
            if (!homeTriggeredRef.current) {
              homeTriggeredRef.current = true;
              const defaultUrl = currentUrl || 'http://localhost:8000/';
              await PageRouteService.getInstance().requestFilesForUrl(
                currentProject.path,
                defaultUrl,
              );
            }
            return;
          }
          // Different project is running, stop it first
          try {
            await (window as any).electron?.wordpressServer?.stopServer?.();
            // Wait a moment for the server to fully stop
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (stopErr) {
            console.warn('Failed to stop existing server:', stopErr);
          }
        } else {
          // No server is running, but let's also check for any orphaned processes
          // and try to clean up any potential port conflicts
          try {
            // Attempt to stop any potential orphaned server
            await (window as any).electron?.wordpressServer?.stopServer?.();
            // Brief wait to ensure cleanup
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (cleanupErr) {
            // This is expected if no server was running, so we ignore the error
          }
        }

        // Analyze folder (optional but helpful)
        await (window as any).electron?.wordpressServer?.analyzeFolder?.(
          currentProject.path,
        );

        // Start server on default port (8000)
        const startResult = await (
          window as any
        ).electron?.wordpressServer?.startServer?.(currentProject.path, 8000);
        if (startResult && startResult.success) {
          // Wait a moment for the server to fully start
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Get the actual server status after starting
          const statusResult = await (
            window as any
          ).electron?.wordpressServer?.getServerStatus?.();
          if (statusResult && statusResult.success && statusResult.status) {
            setServerEnsured(true);
            setServerStatus(statusResult.status);
            if (!homeTriggeredRef.current) {
              homeTriggeredRef.current = true;
              const defaultUrl =
                currentUrl || `http://localhost:${startResult.port || 8000}/`;
              await PageRouteService.getInstance().requestFilesForUrl(
                currentProject.path,
                defaultUrl,
              );
            }
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
      {/* Header with controls */}

      {/* Revert message notification */}
      {revertMessage && (
        <div
          className={`revert-notification revert-notification--${revertMessage.type}`}
        >
          <span>{revertMessage.message}</span>
          <button
            className="revert-notification__close"
            onClick={() => setRevertMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Dual Screen Content */}
      <div className="dual-screen-content">
        {/* Left Panel - Chat/AI Editor */}
        <div className="panel left-panel">
          <div className="panel-content">
            <DualScreenAIEditor
              isVisible
              currentFile={refreshedFileContent || currentFile}
              onApplyEdits={onApplyEdits}
              onClose={() => {}} // Don't close, just hide
              isEditing={isEditing}
              onToggleEditing={toggleEditingMode}
              routeFiles={routeFilesWithContent}
              onShowDiff={handleShowDiff}
              projectContext={{
                currentProject,
                availableFiles: routeFilesWithContent,
              }}
              onRevertComplete={handleRevertButtonComplete}
              onShowRevertManager={() => setShowRevertManager(true)}
            />
          </div>
        </div>

        {/* Right Panel - Code View/Website */}
        <div className="panel right-panel">
          <div className="panel-content">
            <BrowserWindow
              isVisible={serverEnsured}
              onClose={() => {}}
              initialUrl={currentUrl || 'http://localhost:8000'}
              title="EGDesk Browser"
              embedded
              onUrlChange={handleUrlChange}
              serverStatus={serverStatus}
              onServerStatusChange={handleServerStatusChange}
              halfScreenPosition="right"
              resizeMainWindow
              showFileViewer={isEditing}
              filesToOpen={routeFiles}
              onToggleView={toggleEditingMode}
              diffData={diffData}
            />
          </div>
        </div>
      </div>

      {/* Revert Manager Modal */}
      {showRevertManager && (
        <div className="revert-manager-modal">
          <RevertManager
            projectRoot={currentProject?.path}
            onRevertComplete={handleRevertComplete}
            onClose={() => setShowRevertManager(false)}
          />
        </div>
      )}
    </div>
  );
};
