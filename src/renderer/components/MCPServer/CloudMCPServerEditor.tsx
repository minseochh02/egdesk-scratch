import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCode, 
  faFileCode, 
  faSpinner,
  faExternalLinkAlt,
  faCalendarAlt,
  faDatabase,
  faPaperPlane,
  faRobot,
  faUser,
  faArrowLeft,
  faSave,
  faPlus,
  faHistory,
  faUndo,
  faCloudUpload,
  faCloudDownload,
  faCheckCircle,
  faChevronDown,
  faChevronUp,
  faCodeBranch,
  faRefresh,
  faChevronLeft,
  faChevronRight,
  faPlay,
  faTimes
} from '../../utils/fontAwesomeIcons';
import { chatWithGemma, OllamaChatMessage, GemmaToolCall } from '../../lib/gemmaClient';
import CodeViewerWithLineNumbers from './CodeViewerWithLineNumbers';
import './CloudMCPServerEditor.css';

interface TemplateCopy {
  id: string;
  templateId: string;
  templateScriptId?: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  scriptId?: string;
  scriptContent?: {
    files?: Array<{
      name: string;
      type: string;
      source?: string;
      functionSet?: any;
    }>;
  };
  createdAt: string;
  metadata?: any;
}

interface CloudMCPServerEditorProps {
  initialCopyId?: string;
  onBack?: () => void;
}

const CloudMCPServerEditor: React.FC<CloudMCPServerEditorProps> = ({ initialCopyId, onBack }) => {
  const [templateCopies, setTemplateCopies] = useState<TemplateCopy[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCopy, setSelectedCopy] = useState<TemplateCopy | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; isActive: boolean }>>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // Ollama state
  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [isPullingModel, setIsPullingModel] = useState(false);

  // Push/Pull state
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pushed' | 'pulled' | 'error'>('idle');
  const [lastPushedVersion, setLastPushedVersion] = useState<number | null>(null);

  // Version history state
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [versions, setVersions] = useState<Array<{ versionNumber: number; description?: string; createTime: string }>>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionContent, setVersionContent] = useState<Array<{ name: string; type: string; source: string }> | null>(null);
  const [loadingVersionContent, setLoadingVersionContent] = useState(false);
  const [viewingVersionFile, setViewingVersionFile] = useState<string | null>(null);
  const filesListRef = useRef<HTMLDivElement>(null);
  const [showScrollLeft, setShowScrollLeft] = useState(false);
  const [showScrollRight, setShowScrollRight] = useState(false);

  // Run function state
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [functionToRun, setFunctionToRun] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ success: boolean; result?: any; error?: string; logs?: string[] } | null>(null);
  const [availableFunctions, setAvailableFunctions] = useState<string[]>([]);
  const [loadingFunctions, setLoadingFunctions] = useState(false);

  const GEMMA_MODEL = 'gemma3:4b';

  // Fetch all template copies
  const loadTemplateCopies = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.electron.templateCopies.getAll(100, 0);
      
      if (result.success && result.data) {
        setTemplateCopies(result.data);
        
        // If we have a selected copy, update it with fresh data
        if (selectedCopy) {
          const updatedCopy = result.data.find(copy => copy.id === selectedCopy.id);
          if (updatedCopy) {
            setSelectedCopy(updatedCopy);
          }
        }
        
        // Auto-select copy if initialCopyId is provided AND no copy is currently selected
        if (initialCopyId && !selectedCopy && result.data.length > 0) {
          const copyToSelect = result.data.find(copy => copy.id === initialCopyId);
          if (copyToSelect) {
            setSelectedCopy(copyToSelect);
            // Auto-select first file if available
            if (copyToSelect.scriptContent?.files && copyToSelect.scriptContent.files.length > 0) {
              setSelectedFile(copyToSelect.scriptContent.files[0].name);
            }
          }
        }
      } else {
        setError(result.error || 'Failed to load template copies');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplateCopies();
  }, []);

  // Check Ollama installation status on mount
  const checkOllamaStatus = useCallback(async () => {
    if (!window.electron) {
      console.warn('Electron API not available for Ollama check');
      return;
    }

    setOllamaLoading(true);
    setOllamaError(null);

    try {
      const result = await (window.electron as any).ollama.checkInstalled();
      if (result.success) {
        setOllamaInstalled(result.installed || false);
        
        if (result.installed) {
          // Note: We'll need to add listModels to OllamaAPI or use invoke
          // For now, we'll check for Gemma model directly
          const gemmaResult = await (window.electron as any).ollama.hasModel(GEMMA_MODEL);
          if (gemmaResult.success && gemmaResult.exists) {
            setOllamaModels([GEMMA_MODEL]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check Ollama status:', error);
      setOllamaError('Failed to check Ollama installation');
    } finally {
      setOllamaLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkOllamaStatus();
  }, [checkOllamaStatus]);

  // Install Ollama if needed
  const handleInstallOllama = useCallback(async () => {
    if (!window.electron) return;

    setOllamaLoading(true);
    setOllamaError(null);

    try {
      const result = await (window.electron as any).ollama.ensure();
      if (result.success && result.installed) {
        setOllamaInstalled(true);
        await checkOllamaStatus();
      } else {
        setOllamaError('Failed to install Ollama');
      }
    } catch (error) {
      console.error('Failed to install Ollama:', error);
      setOllamaError(error instanceof Error ? error.message : 'Installation failed');
    } finally {
      setOllamaLoading(false);
    }
  }, [checkOllamaStatus]);

  // Pull Gemma model
  const handlePullGemma = useCallback(async () => {
    if (!window.electron) return;

    setIsPullingModel(true);
    setOllamaError(null);

    try {
      const result = await (window.electron as any).ollama.pullModel(GEMMA_MODEL);
      if (result.success) {
        await checkOllamaStatus();
      } else {
        setOllamaError(result.error || 'Failed to pull Gemma model');
      }
    } catch (error) {
      console.error('Failed to pull Gemma model:', error);
      setOllamaError(error instanceof Error ? error.message : 'Model pull failed');
    } finally {
      setIsPullingModel(false);
    }
  }, [GEMMA_MODEL, checkOllamaStatus]);

  // Check if Gemma is installed
  const hasGemma = useMemo(() => {
    return ollamaModels.some((model) => model.toLowerCase().includes('gemma'));
  }, [ollamaModels]);

  const ollamaReady = ollamaInstalled && hasGemma;

  // Update selection when initialCopyId changes
  useEffect(() => {
    if (initialCopyId && templateCopies.length > 0) {
      const copyToSelect = templateCopies.find(copy => copy.id === initialCopyId);
      if (copyToSelect && copyToSelect.id !== selectedCopy?.id) {
        setSelectedCopy(copyToSelect);
        if (copyToSelect.scriptContent?.files && copyToSelect.scriptContent.files.length > 0) {
          setSelectedFile(copyToSelect.scriptContent.files[0].name);
        }
      }
    }
  }, [initialCopyId, templateCopies]);

  // Get selected file content
  const getSelectedFileContent = (): string => {
    if (!selectedCopy || !selectedFile || !selectedCopy.scriptContent?.files) {
      return '';
    }

    const file = selectedCopy.scriptContent.files.find(f => f.name === selectedFile);
    return file?.source || '';
  };

  // Handle save - uses AppsScript tools
  const handleSave = async () => {
    if (!selectedCopy || !selectedFile || !selectedCopy.scriptId) {
      return;
    }

    const fileContent = getSelectedFileContent();
    if (!fileContent) {
      return;
    }

    try {
      const result = await window.electron.appsScriptTools.writeFile(
        selectedCopy.scriptId,
        selectedFile,
        fileContent
      );
      
      if (result.success) {
        // Reload template copies to get updated content
        await loadTemplateCopies();
        alert('File saved successfully!');
      } else {
        alert(`Failed to save file: ${result.error}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert(`Error saving file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle push to Google
  const handlePushToGoogle = async () => {
    if (!selectedCopy?.id) {
      alert('No project selected');
      return;
    }

    const confirmMsg = 'Push local changes to Google Apps Script and create a new version?\n\nThis will overwrite the cloud version with your local changes and create an immutable snapshot.';
    
    if (!confirm(confirmMsg)) {
      return;
    }

    setIsPushing(true);
    setSyncStatus('idle');
    setError(null);

    try {
      console.log(`⬆️ Pushing to Google Apps Script with version...`);
      const result = await (window.electron as any).appsScriptTools.pushToGoogle(
        selectedCopy.id,
        true,
        `Push from EGDesk at ${new Date().toLocaleString()}`
      );

      if (result.success && result.data) {
        setSyncStatus('pushed');
        
        if (result.data.versionNumber) {
          setLastPushedVersion(result.data.versionNumber);
          console.log(`✅ Pushed and created version ${result.data.versionNumber}`);
        } else {
          setLastPushedVersion(null);
        }
        
        setTimeout(() => {
          setSyncStatus('idle');
          setLastPushedVersion(null);
        }, 4000);
      } else {
        setError(result.error || 'Failed to push to Google');
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Error pushing to Google:', err);
      setError(err instanceof Error ? err.message : 'Error pushing to Google');
      setSyncStatus('error');
    } finally {
      setIsPushing(false);
    }
  };

  // Handle pull from Google
  const handlePullFromGoogle = async () => {
    if (!selectedCopy?.id) {
      alert('No project selected');
      return;
    }

    if (!confirm('Pull latest from Google Apps Script?\n\nThis will overwrite your local changes with the cloud version.')) {
      return;
    }

    setIsPulling(true);
    setSyncStatus('idle');
    setError(null);

    try {
      console.log(`⬇️ Pulling from Google Apps Script...`);
      const result = await (window.electron as any).appsScriptTools.pullFromGoogle(selectedCopy.id);

      if (result.success && result.data) {
        setSyncStatus('pulled');
        // Refresh local files to show updated content
        await loadTemplateCopies();
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        setError(result.error || 'Failed to pull from Google');
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Error pulling from Google:', err);
      setError(err instanceof Error ? err.message : 'Error pulling from Google');
      setSyncStatus('error');
    } finally {
      setIsPulling(false);
    }
  };

  // Load versions for the selected project
  const loadVersions = async () => {
    if (!selectedCopy?.id) return;

    setLoadingVersions(true);
    try {
      console.log('📜 Loading versions...');
      const result = await (window.electron as any).appsScriptTools.listVersions(selectedCopy.id);
      
      if (result.success && result.data) {
        // Sort by version number descending (newest first)
        const sortedVersions = [...result.data].sort((a, b) => b.versionNumber - a.versionNumber);
        setVersions(sortedVersions);
        console.log(`✅ Loaded ${sortedVersions.length} versions`);
      } else {
        console.warn('Failed to load versions:', result.error);
        setVersions([]);
      }
    } catch (err) {
      console.error('Error loading versions:', err);
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  // Load content for a specific version
  const loadVersionContent = async (versionNumber: number) => {
    if (!selectedCopy?.id) return;

    setLoadingVersionContent(true);
    setVersionContent(null);
    setViewingVersionFile(null);

    try {
      console.log(`📜 Loading content for version ${versionNumber}...`);
      const result = await (window.electron as any).appsScriptTools.getVersionContent(selectedCopy.id, versionNumber);
      
      if (result.success && result.data) {
        setVersionContent(result.data.files);
        // Auto-select first file
        if (result.data.files.length > 0) {
          setViewingVersionFile(result.data.files[0].name);
        }
        console.log(`✅ Loaded ${result.data.files.length} files from version ${versionNumber}`);
      } else {
        console.warn('Failed to load version content:', result.error);
        alert(`Failed to load version content: ${result.error}`);
      }
    } catch (err) {
      console.error('Error loading version content:', err);
      alert(`Error loading version content: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingVersionContent(false);
    }
  };

  // Handle version selection
  const handleVersionSelect = async (versionNumber: number | null) => {
    setSelectedVersion(versionNumber);
    setShowVersionDropdown(false);
    
    if (versionNumber === null) {
      // Clear version content when selecting HEAD
      setVersionContent(null);
      setViewingVersionFile(null);
    } else {
      // Load content for selected version
      await loadVersionContent(versionNumber);
    }
  };

  // Restore version to local
  const handleRestoreVersion = async () => {
    if (!selectedCopy?.id || !versionContent || selectedVersion === null) return;

    if (!confirm(`Restore version ${selectedVersion} to local?\n\nThis will replace your local content with this version's content.`)) {
      return;
    }

    try {
      // Update local script content with version content
      const scriptContent = {
        ...selectedCopy.scriptContent,
        files: versionContent.map(f => ({
          name: f.name,
          type: f.type,
          source: f.source,
        })),
      };

      const result = await window.electron.templateCopies.updateScriptContent(
        selectedCopy.scriptId!,
        scriptContent
      );

      if (result.success) {
        alert(`Successfully restored version ${selectedVersion} to local!`);
        // Reset to HEAD view
        setSelectedVersion(null);
        setVersionContent(null);
        setViewingVersionFile(null);
        // Reload template copies to see updated content
        await loadTemplateCopies();
      } else {
        alert(`Failed to restore version: ${result.error}`);
      }
    } catch (err) {
      console.error('Error restoring version:', err);
      alert(`Error restoring version: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Load versions when project changes
  useEffect(() => {
    if (selectedCopy?.scriptId) {
      loadVersions();
    } else {
      setVersions([]);
      setSelectedVersion(null);
      setVersionContent(null);
    }
  }, [selectedCopy?.id]);

  // Extract function names from script files
  const extractFunctions = useCallback(() => {
    if (!selectedCopy?.scriptContent?.files) {
      console.log('🔍 No script files found for function detection');
      setAvailableFunctions([]);
      return;
    }

    const functions: string[] = [];
    // Match function declarations - handles various formats
    const functionRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;

    console.log('🔍 Scanning files for functions:', selectedCopy.scriptContent.files.map(f => ({ name: f.name, type: f.type, hasSource: !!f.source })));

    for (const file of selectedCopy.scriptContent.files) {
      // Check for .gs files - type could be 'server_js', 'SERVER_JS', or file name ends with .gs
      const isGsFile = 
        file.type?.toLowerCase() === 'server_js' || 
        file.name?.endsWith('.gs') ||
        file.type === 'SERVER_JS';
      
      if (isGsFile && file.source) {
        // Reset regex lastIndex for each file
        functionRegex.lastIndex = 0;
        let match;
        while ((match = functionRegex.exec(file.source)) !== null) {
          const funcName = match[1];
          // Skip private functions (starting with _)
          if (!funcName.startsWith('_') && !functions.includes(funcName)) {
            functions.push(funcName);
          }
        }
        console.log(`📄 Found functions in ${file.name}:`, functions.filter(f => file.source?.includes(`function ${f}`)));
      }
    }

    // Sort alphabetically, but put common entry points first
    const priorityFunctions = ['doGet', 'doPost', 'onOpen', 'onEdit', 'onInstall', 'main', 'run'];
    functions.sort((a, b) => {
      const aIdx = priorityFunctions.indexOf(a);
      const bIdx = priorityFunctions.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b);
    });

    console.log('✅ Total functions detected:', functions);
    setAvailableFunctions(functions);
  }, [selectedCopy]);

  // Update available functions when selected copy changes
  useEffect(() => {
    extractFunctions();
  }, [extractFunctions]);

  // Run a function in the Apps Script project
  const handleRunFunction = async () => {
    if (!functionToRun.trim() || !selectedCopy?.scriptId) {
      return;
    }

    setIsRunning(true);
    setRunResult(null);

    try {
      console.log(`▶️ Running function: ${functionToRun}...`);
      const result = await (window.electron as any).appsScriptTools.runFunction(
        selectedCopy.scriptId,
        functionToRun.trim()
      );

      if (result.success) {
        setRunResult({
          success: true,
          result: result.data?.response?.result,
          logs: result.data?.logs || []
        });
        console.log(`✅ Function executed successfully`);
      } else {
        setRunResult({
          success: false,
          error: result.error || 'Function execution failed'
        });
        console.error(`❌ Function execution failed:`, result.error);
      }
    } catch (err) {
      console.error('Error running function:', err);
      setRunResult({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Open run dialog
  const openRunDialog = () => {
    setShowRunDialog(true);
    // Auto-select first function if available
    setFunctionToRun(availableFunctions.length > 0 ? availableFunctions[0] : '');
    setRunResult(null);
  };

  // Close run dialog
  const closeRunDialog = () => {
    setShowRunDialog(false);
    setFunctionToRun('');
    setRunResult(null);
  };

  // Format date
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  // Scroll chat to bottom
  const scrollChatToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle file list scrolling
  const handleScroll = useCallback(() => {
    if (filesListRef.current) {
      const { scrollWidth, clientWidth, scrollLeft } = filesListRef.current;
      setShowScrollLeft(scrollLeft > 0);
      setShowScrollRight(scrollLeft < scrollWidth - clientWidth);
    }
  }, []);

  const handleScrollLeft = () => {
    if (filesListRef.current) {
      filesListRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (filesListRef.current) {
      filesListRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  // Add scroll and resize listeners for file tabs
  useEffect(() => {
    const filesListElement = filesListRef.current;
    if (filesListElement) {
      filesListElement.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleScroll);
      // Initial check
      handleScroll();
      return () => {
        filesListElement.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [handleScroll, selectedCopy, selectedVersion]);

  useEffect(() => {
    scrollChatToBottom();
  }, [chatMessages]);

  // Execute tool call
  const executeTool = async (toolCall: GemmaToolCall): Promise<string> => {
    if (!selectedCopy?.scriptId) {
      return 'Error: No script selected or script ID missing.';
    }

    const { name, args } = toolCall;
    const scriptId = selectedCopy.scriptId;

    try {
      switch (name) {
        case 'apps_script_list_files':
          const listResult = await window.electron.appsScriptTools.listFiles(scriptId);
          return listResult.success 
            ? JSON.stringify(listResult.data, null, 2) 
            : `Error listing files: ${listResult.error}`;

        case 'apps_script_read_file':
          if (!args?.fileName) return 'Error: fileName argument required.';
          const readResult = await window.electron.appsScriptTools.readFile(scriptId, args.fileName);
          return readResult.success 
            ? readResult.data || 'File is empty' 
            : `Error reading file: ${readResult.error}`;

        case 'apps_script_write_file':
          if (!args?.fileName || args.content === undefined) return 'Error: fileName and content arguments required.';
          // If the user just specified 'file', map it to fileName
          const fileName = args.fileName || args.file;
          const writeResult = await window.electron.appsScriptTools.writeFile(
            scriptId, 
            fileName, 
            args.content, 
            args.fileType,
            currentConversationId || undefined
          );
          if (writeResult.success) {
            // Refresh copies to show update
            await loadTemplateCopies();
            return `Successfully wrote to ${fileName}`;
          }
          return `Error writing file: ${writeResult.error}`;

        case 'apps_script_partial_edit':
          if (!args?.fileName || !args.oldString || args.newString === undefined) {
            return 'Error: fileName, oldString, and newString arguments required.';
          }
          const editResult = await window.electron.appsScriptTools.partialEdit(
            scriptId,
            args.fileName,
            args.oldString,
            args.newString,
            args.expectedReplacements,
            args.flexibleMatching,
            currentConversationId || undefined
          );
          if (editResult.success) {
            await loadTemplateCopies();
            return `Successfully edited ${args.fileName}`;
          }
          return `Error editing file: ${editResult.error}`;

        case 'apps_script_rename_file':
          if (!args?.oldFileName || !args.newFileName) {
            return 'Error: oldFileName and newFileName arguments required.';
          }
          const renameResult = await window.electron.appsScriptTools.renameFile(
            scriptId,
            args.oldFileName,
            args.newFileName,
            currentConversationId || undefined
          );
          if (renameResult.success) {
            await loadTemplateCopies();
            return `Successfully renamed ${args.oldFileName} to ${args.newFileName}`;
          }
          return `Error renaming file: ${renameResult.error}`;

        case 'apps_script_delete_file':
          if (!args?.fileName) {
            return 'Error: fileName argument required.';
          }
          const deleteResult = await window.electron.appsScriptTools.deleteFile(
            scriptId,
            args.fileName,
            currentConversationId || undefined
          );
          if (deleteResult.success) {
            await loadTemplateCopies();
            return `Successfully deleted ${args.fileName}`;
          }
          return `Error deleting file: ${deleteResult.error}`;

        default:
          return `Error: Unknown tool '${name}'`;
      }
    } catch (err: any) {
      return `Error executing ${name}: ${err.message}`;
    }
  };

  // Build system prompt with code context
  const buildSystemPrompt = useCallback(() => {
    const fileContent = getSelectedFileContent();
    const fileName = selectedFile || 'No file selected';
    const fileType = selectedCopy?.scriptContent?.files?.find(f => f.name === fileName)?.type || 'unknown';
    const scriptId = selectedCopy?.scriptId;
    const allFiles = selectedCopy?.scriptContent?.files || [];

    let codeContext = '';
    if (fileContent && fileContent.trim().length > 0) {
      codeContext = `\n\nCURRENT FILE CONTEXT:
File Name: ${fileName}
File Type: ${fileType}
Script ID: ${scriptId || 'N/A'}
File Content:
\`\`\`${fileType === 'server_js' ? 'javascript' : fileType === 'html' ? 'html' : 'javascript'}
${fileContent.slice(0, 5000)}${fileContent.length > 5000 ? '\n... (truncated)' : ''}
\`\`\`
`;
    }

    const toolsInfo = scriptId ? `
AVAILABLE TOOLS:
You can use these AppsScript tools to interact with the code:
- apps_script_list_files: List all files in the AppsScript project
- apps_script_read_file: Read any file from the project (args: fileName)
- apps_script_write_file: CREATE NEW files or REPLACE entire file content (args: fileName, content, fileType?)
- apps_script_partial_edit: Make targeted edits to EXISTING files only (args: fileName, oldString, newString)
- apps_script_rename_file: Rename files (args: oldFileName, newFileName)
- apps_script_delete_file: Delete files (args: fileName)

⚠️ CRITICAL TOOL USAGE RULES:
1. **For NEW files**: ALWAYS use apps_script_write_file (partial_edit will fail on non-existent files!)
2. **For editing EXISTING files**: Use apps_script_partial_edit for small changes, apps_script_write_file for full rewrites
3. **Before editing**: ALWAYS use apps_script_list_files first to see what files exist
4. **File names must match exactly**: Check the file list before editing

TOOL USAGE INSTRUCTIONS:
1. To take ANY action on the code, you MUST output a JSON object in your response.
2. DO NOT hallucinate tool executions. DO NOT say "Tool Execution: ... Result: ...".
3. ONLY output the JSON request. The system will execute it and give you the result in the next turn.
4. You can wrap the JSON in \`\`\`json ... \`\`\` blocks.

JSON FORMAT:
{
  "content": "Brief explanation of what you are doing",
  "toolCalls": [
    {
      "name": "apps_script_write_file",
      "args": {
        "fileName": "example.gs",
        "content": "function test() {}"
      }
    }
  ]
}

💾 LOCAL-FIRST WORKFLOW:
All changes are stored LOCALLY in the EGDesk database (cloudmcp.db) until user clicks "Push to Google".
- Your edits do NOT immediately go to Google Apps Script
- User can review changes before pushing
- This allows safe experimentation without affecting the live script
` : '';

    return `You are an expert Google Apps Script developer assistant. You help users write, debug, and improve their Apps Script code.

PROJECT CONTEXT:
- Script ID: ${scriptId || 'N/A'}
- Currently open file: ${fileName}
- All files in project: ${allFiles.map(f => f.name).join(', ') || 'None'}

${codeContext}

${toolsInfo}

📋 PROJECT DOCUMENTATION APPROACH:
When user shares a script project or asks you to build one, FIRST create a checklist:
1. Document what the project requires (inputs, outputs, data sources)
2. Outline the logic needed to address each requirement
3. Then implement with the best practices below

🏆 APPS SCRIPT BEST PRACTICES (ALWAYS FOLLOW):

1. **PropertiesService for Dynamic Variables**
   - NEVER hardcode file IDs, folder IDs, or API keys in code
   - Use PropertiesService.getScriptProperties() or .getUserProperties()
   - Example: PropertiesService.getScriptProperties().setProperty('FOLDER_ID', folderId)

2. **Self-Initializing Setup (One-Click Ready)**
   - Create a setupEnvironment() function that initializes everything
   - If folder/file doesn't exist, CREATE it automatically - don't ask user for IDs
   - Store created resource IDs in PropertiesService for future use
   - User should be able to copy the project and run with ONE button click

3. **Proper appsscript.json Manifest**
   - Always generate/update appsscript.json with correct oauthScopes
   - Include timeZone, exceptionLogging, runtimeVersion: "V8"
   - Add webapp config if deploying as web app

4. **Official Google APIs**
   - Use official Google API documentation
   - Prefer built-in services (SpreadsheetApp, DriveApp) over REST APIs when possible
   - For advanced features, use UrlFetchApp with official Google APIs

5. **Logging with Logger**
   - Use Logger.log() for debugging and audit trails
   - Use console.log() for V8 runtime debugging
   - Add meaningful log messages at key steps

6. **Triggers for Automation**
   - Use ScriptApp.newTrigger() for scheduled/continuous tasks
   - Add 'https://www.googleapis.com/auth/script.scriptapp' scope for trigger management
   - Provide install/remove trigger functions for user control

7. **Immediate File Generation**
   - When starting a project, IMMEDIATELY create appsscript.json and Code.gs
   - Don't just explain - actually write the files using apps_script_write_file

📐 STANDARD UI MENU PATTERN (Use for Spreadsheet-bound scripts):
\`\`\`javascript
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('🧩 Project Name');
  
  // ZONE 1: Primary Actions (Daily Use)
  menu.addItem('▶️ Run Main Task', 'mainFunction')
      .addItem('📊 Generate Report', 'reportFunction');
  
  // ZONE 2: Automation (Triggers)
  menu.addSeparator()
      .addItem('⏰ Enable Auto-Run', 'installTrigger')
      .addItem('🛑 Disable Auto-Run', 'removeTrigger');
  
  // ZONE 3: Settings (Sub-menu for cleaner UI)
  const settingsMenu = ui.createMenu('⚙️ Settings');
  settingsMenu.addItem('🚀 Initial Setup', 'setupEnvironment')
              .addSeparator()
              .addItem('🔑 Set API Key', 'setApiKey')
              .addItem('👀 View Status', 'checkStatus')
              .addItem('🗑️ Clear Data', 'clearData');
  
  menu.addSeparator().addSubMenu(settingsMenu);
  menu.addToUi();
}
\`\`\`

APPS SCRIPT SPECIFIC KNOWLEDGE:
- .gs files are server-side JavaScript (Google's V8 runtime)
- .html files can include CSS/JS and use scriptlets: <?= ?>, <? ?>, <?!= ?>
- Use google.script.run.functionName() to call server functions from HTML
- SpreadsheetApp, DriveApp, GmailApp, etc. are available server-side
- HtmlService.createHtmlOutputFromFile('filename') serves HTML pages

IMPORTANT BEHAVIORS:
- When user asks about code, refer to the current file context above
- If they ask to modify code, use the AppsScript tools to make changes directly
- Always explain what changes you're making and why
- Be concise but thorough in your explanations
- If the file content is truncated, mention that you're working with a partial view
- You have access to all files in the AppsScript project via tools
- NEVER pretend to execute a tool. Send the JSON request and wait for the system result.
- RESPOND WITH JSON ONLY WHEN USING TOOLS.
- When user asks to "create HTML" or "make a page", IMMEDIATELY create the file
- For HTML files in Apps Script, use proper Apps Script HTML service patterns
- Always generate COMPLETE, working code - don't use placeholders like "// your code here"

Respond naturally and helpfully. If the user asks about code that isn't in the current context, use the tools to read that file first.`;
  }, [selectedFile, selectedCopy]);

  // Save message to DB
  const saveMessageToDB = useCallback(async (role: 'user' | 'assistant', content: string, metadata?: any) => {
    if (!selectedCopy?.id || !(window.electron as any)?.aiChatData || !currentConversationId) return;

    try {
      // Map 'assistant' to 'model' for database compatibility if needed
      // DB schema check: role IN ('user', 'model', 'tool')
      const dbRole = role === 'assistant' ? 'model' : role;
      
      await (window.electron as any).aiChatData.addMessage({
        conversation_id: currentConversationId,
        role: dbRole,
        content,
        tool_call_id: null,
        tool_status: null,
        metadata: JSON.stringify({ 
          timestamp: new Date().toISOString(),
          ...metadata 
        })
      });
    } catch (err) {
      console.error('Failed to save message to DB:', err);
    }
  }, [selectedCopy, currentConversationId]);

  // Create a new conversation
  const createNewConversation = async (title?: string) => {
    if (!selectedCopy?.id || !(window.electron as any)?.aiChatData) return;

    try {
      const id = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTitle = title || `New Chat ${new Date().toLocaleTimeString()}`;
      
      // Include copyId in project_context so we can filter by it
      const projectContext = JSON.stringify({
        copyId: selectedCopy.id,
        spreadsheetId: selectedCopy.spreadsheetId,
        scriptId: selectedCopy.scriptId,
        serverName: (selectedCopy.metadata as any)?.serverName
      });

      await (window.electron as any).aiChatData.createConversation({
        id,
        title: newTitle,
        project_context: projectContext,
        is_active: true
      });

      setConversations(prev => [{ id, title: newTitle, isActive: true }, ...prev]);
      setCurrentConversationId(id);
      setChatMessages([]);
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  // Load conversations for the selected copy
  const loadConversations = async () => {
    if (!selectedCopy?.id || !(window.electron as any)?.aiChatData) return;

    try {
      // We filter by projectContext containing the copyId
      // Note: This is a simple string match, so we rely on copyId being unique enough
      const result = await (window.electron as any).aiChatData.getConversations({
        limit: 50,
        projectContext: selectedCopy.id // This will match the copyId in the JSON string
      });

      if (result.success && result.data) {
        const loadedConversations = result.data.map((c: any) => ({
          id: c.id,
          title: c.title,
          isActive: c.is_active
        }));
        
        setConversations(loadedConversations);

        // specific logic: if there are no conversations, create one
        if (loadedConversations.length === 0) {
            await createNewConversation(`Chat 1: ${(selectedCopy.metadata as any)?.serverName || 'Script'}`);
        } else if (!currentConversationId) {
            // select the most recent one
            setCurrentConversationId(loadedConversations[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  // Load messages for current conversation
  useEffect(() => {
    const loadMessages = async () => {
        if (!currentConversationId || !(window.electron as any)?.aiChatData) return;

        try {
            const messagesResult = await (window.electron as any).aiChatData.getMessages(currentConversationId);
            
            if (messagesResult.success && messagesResult.data) {
                const uiMessages = messagesResult.data.map((msg: any) => ({
                    // Map DB 'model' role back to 'assistant' for UI
                    role: (msg.role === 'model' ? 'assistant' : msg.role) as 'user' | 'assistant',
                    content: msg.content,
                    timestamp: new Date(JSON.parse(msg.metadata || '{}').timestamp || Date.now())
                }));
                setChatMessages(uiMessages);
            }
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    };

    loadMessages();
  }, [currentConversationId]);

  // Initialize when selectedCopy changes
  useEffect(() => {
    if (selectedCopy) {
        loadConversations();
    } else {
        setConversations([]);
        setCurrentConversationId(null);
        setChatMessages([]);
    }
  }, [selectedCopy]);

  // Handle chat send
  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading || !ollamaReady) {
      if (!ollamaReady) {
        setOllamaError('Gemma is not ready. Complete the setup before chatting.');
      }
      return;
    }

    const userMessage = {
      role: 'user' as const,
      content: chatInput.trim(),
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    const prompt = chatInput.trim();
    setChatInput('');
    setIsChatLoading(true);
    setOllamaError(null);
    
    // Save user message
    void saveMessageToDB('user', prompt);

    try {
      // Build context from previous messages
      const priorContext: OllamaChatMessage[] = chatMessages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // Get AI response
      const { content: assistantContent, toolCalls } = await chatWithGemma(
        prompt,
        priorContext,
        {
          systemPrompt: buildSystemPrompt(),
        }
      );

      // Process tool calls if any
      let responseContent = assistantContent || '';
      
      // If we have tool calls, execute them
      if (toolCalls && toolCalls.length > 0) {
        // Add the assistant's thought process first
        if (responseContent) {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: responseContent,
            timestamp: new Date(),
          }]);
          void saveMessageToDB('assistant', responseContent);
        }

        // Execute each tool call
        for (const toolCall of toolCalls) {
          // Map 'file' to 'fileName' if needed (common mistake by models)
          if (toolCall.args && toolCall.args.file && !toolCall.args.fileName) {
            toolCall.args.fileName = toolCall.args.file;
          }

          // Show tool execution status
          const toolMsgId = Date.now();
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: `⚙️ Executing tool: ${toolCall.name}...`,
            timestamp: new Date(),
          }]);

          const result = await executeTool(toolCall);
          
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: `✅ Tool Result:\n${result}`,
            timestamp: new Date(),
          }]);
          
          // Save tool execution and result
          void saveMessageToDB('assistant', `Tool Execution: ${toolCall.name}\nResult: ${result}`, {
            isTool: true,
            toolName: toolCall.name,
            toolArgs: toolCall.args,
            toolResult: result
          });
          
          // Append tool result to context for next turn (implicitly handled by chatMessages state)
        }
      } else {
        // No tool calls, just show the message
      const assistantMessage = {
        role: 'assistant' as const,
          content: responseContent || 'I apologize, but I could not generate a response.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, assistantMessage]);
        void saveMessageToDB('assistant', assistantMessage.content);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setOllamaError(error instanceof Error ? error.message : 'Chat failed');
      const errorMessage = {
        role: 'assistant' as const,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure Ollama is running and try again.`,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, isChatLoading, ollamaReady, chatMessages, buildSystemPrompt]);

  // Handle Enter key in chat input
  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Ctrl/Cmd+Z for undo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handleUndo();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  // Handle undo logic
  const handleUndo = async () => {
    if (!currentConversationId || !window.electron?.backup?.revertConversation) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Undo functionality is not available.',
        timestamp: new Date(),
      }]);
      return;
    }

    try {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '↩️ Reverting last change...',
        timestamp: new Date(),
      }]);

      const result = await window.electron.backup.revertConversation(currentConversationId);
      
      if (result.success) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: '✅ Successfully reverted last change.',
          timestamp: new Date(),
        }]);
        // Reload template copies to reflect reverted state
        await loadTemplateCopies();
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `❌ Revert failed: ${result.error || 'Unknown error'}`,
          timestamp: new Date(),
        }]);
      }
    } catch (error) {
      console.error('Undo error:', error);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Undo error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    }
  };

  return (
    <div className="cloud-mcp-server-editor">
      <div className="editor-header">
        <div className="header-content">
          {onBack && (
            <button 
              className="back-button"
              onClick={onBack}
              title="Back to MCP Servers"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
          )}
          
        </div>
        <div className="header-actions">
          {/* Open Spreadsheet Button */}
          {selectedCopy && (
            <button
              className="open-spreadsheet-button"
              onClick={() => {
                if (selectedCopy.spreadsheetUrl) {
                  window.open(selectedCopy.spreadsheetUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              title="Open spreadsheet in browser"
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} />
              Open
            </button>
          )}
          
          {/* Save Button */}
          {selectedFile && getSelectedFileContent() && selectedCopy?.scriptId && (
            <button
              className="save-button"
              onClick={handleSave}
              title="Save changes to Apps Script (uses AppsScript tools)"
            >
              <FontAwesomeIcon icon={faSave} />
              Save
            </button>
          )}
          
          {/* Push/Pull Sync Buttons */}
          {selectedCopy?.scriptId && (
            <>
              <div className="sync-button-group">
                <button
                  className="push-button"
                  onClick={handlePushToGoogle}
                  disabled={isPushing || isPulling}
                  title="Push and create version"
                >
                  {isPushing ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    <FontAwesomeIcon icon={faCloudUpload} />
                  )}
                  Push
                </button>
              </div>
              
              <button
                className="pull-button"
                onClick={handlePullFromGoogle}
                disabled={isPushing || isPulling}
                title="Pull latest from Google Apps Script"
              >
                {isPulling ? (
                  <FontAwesomeIcon icon={faSpinner} spin />
                ) : (
                  <FontAwesomeIcon icon={faCloudDownload} />
                )}
                Pull
              </button>
              
              {syncStatus === 'pushed' && (
                <span className="sync-status sync-status-pushed">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  {lastPushedVersion ? `Pushed! (v${lastPushedVersion})` : 'Pushed!'}
                </span>
              )}
              {syncStatus === 'pulled' && (
                <span className="sync-status sync-status-pulled">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  Pulled!
                </span>
              )}
            </>
          )}
          
          {/* Run Function Button */}
          {selectedCopy?.scriptId && (
            <button
              className="run-button"
              onClick={openRunDialog}
              disabled={isRunning}
              title="Run a function"
            >
              {isRunning ? (
                <FontAwesomeIcon icon={faSpinner} spin />
              ) : (
                <FontAwesomeIcon icon={faPlay} />
              )}
              Run
            </button>
          )}
          
          <button 
            className="refresh-button"
            onClick={loadTemplateCopies}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faRefresh} spin={loading} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <FontAwesomeIcon icon={faSpinner} spin />
          <span>Loading template copies...</span>
        </div>
      )}

      {error && (
        <div className="error-state">
          <span>{error}</span>
          <button onClick={loadTemplateCopies}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="editor-layout">
          {/* Left sidebar - Template copies list */}
          <div className="editor-sidebar">
            <div className="sidebar-header">
              <FontAwesomeIcon icon={faDatabase} />
              <span>Template Copies ({templateCopies.length})</span>
            </div>
            <div className="copies-list">
              {templateCopies.length === 0 ? (
                <div className="empty-state">
                  <p>No template copies found</p>
                  <p className="empty-hint">Create a template copy to see script content here</p>
                </div>
              ) : (
                templateCopies.map((copy) => (
                  <div
                    key={copy.id}
                    className={`copy-item ${selectedCopy?.id === copy.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedCopy(copy);
                      setSelectedFile(null);
                    }}
                  >
                    <div className="copy-item-header">
                      <FontAwesomeIcon icon={faFileCode} />
                      <span className="copy-title">
                        {(copy.metadata as any)?.serverName || copy.spreadsheetId.substring(0, 20) + '...'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Version History Dropdown - Below project selector */}
            {selectedCopy?.scriptId && (
              <div className="version-dropdown-container">
                <div className="sidebar-header version-header">
                  <FontAwesomeIcon icon={faCodeBranch} />
                  <span>Version History {loadingVersions && <FontAwesomeIcon icon={faSpinner} spin className="loading-spinner-small" />}</span>
                </div>
                <button 
                  className="version-dropdown-toggle"
                  onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                  disabled={loadingVersions}
                >
                  <span className="version-toggle-label">
                    {loadingVersionContent ? 'Loading...' : selectedVersion ? `v${selectedVersion}` : 'Current (HEAD)'}
                  </span>
                  <FontAwesomeIcon 
                    icon={showVersionDropdown ? faChevronUp : faChevronDown} 
                    className="dropdown-chevron"
                  />
                </button>
                
                {showVersionDropdown && (
                  <div className="version-dropdown-list">
                    <div 
                      className={`version-dropdown-item ${selectedVersion === null ? 'active' : ''}`}
                      onClick={() => handleVersionSelect(null)}
                    >
                      <div className="version-item-header">
                        <span className="version-number">Current (HEAD)</span>
                      </div>
                      <span className="version-description">Local working copy</span>
                    </div>
                    
                    {versions.length === 0 && !loadingVersions && (
                      <div className="version-dropdown-item version-empty">
                        <span className="version-description">No versions found. Push with version enabled to create one.</span>
                      </div>
                    )}
                    
                    {versions.map((version) => (
                      <div 
                        key={version.versionNumber}
                        className={`version-dropdown-item ${selectedVersion === version.versionNumber ? 'active' : ''}`}
                        onClick={() => handleVersionSelect(version.versionNumber)}
                      >
                        <div className="version-item-header">
                          <span className="version-number">v{version.versionNumber}</span>
                          <span className="version-date">
                            {new Date(version.createTime).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="version-description">{version.description || 'No description'}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Restore button when viewing a version */}
                {selectedVersion !== null && versionContent && (
                  <button 
                    className="restore-version-button"
                    onClick={handleRestoreVersion}
                    title="Restore this version to local"
                  >
                    <FontAwesomeIcon icon={faUndo} />
                    Restore v{selectedVersion} to Local
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Middle panel - Script content */}
          <div className="editor-content">
            {!selectedCopy ? (
              <div className="empty-content">
                <FontAwesomeIcon icon={faCode} className="empty-icon" />
                <h3>Select a template copy to view script content</h3>
                <p>Choose a template copy from the left sidebar to see its Apps Script files</p>
              </div>
            ) : !selectedCopy.scriptContent?.files || selectedCopy.scriptContent.files.length === 0 ? (
              <div className="empty-content">
                <FontAwesomeIcon icon={faFileCode} className="empty-icon" />
                <h3>No script content available</h3>
                <p>This template copy doesn't have any Apps Script files</p>
                <div className="copy-info">
                  <div className="info-item">
                    <strong>Spreadsheet ID:</strong> {selectedCopy.spreadsheetId}
                  </div>
                  <div className="info-item">
                    <strong>Spreadsheet URL:</strong>{' '}
                    <a 
                      href={selectedCopy.spreadsheetUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {selectedCopy.spreadsheetUrl}
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </a>
                  </div>
                  {selectedCopy.scriptId && (
                    <div className="info-item">
                      <strong>Script ID:</strong> {selectedCopy.scriptId}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* File tabs - shows version files or current files */}
                <div className="file-selector-wrapper">
                  {showScrollLeft && (
                    <button className="scroll-button scroll-left" onClick={handleScrollLeft}>
                      <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                  )}
                  <div className="files-list" ref={filesListRef}>
                    {/* Show version content files or current files */}
                    {selectedVersion !== null && versionContent ? (
                      versionContent.map((file, index) => (
                        <div
                          key={index}
                          className={`file-item ${viewingVersionFile === file.name ? 'active' : ''}`}
                          onClick={() => setViewingVersionFile(file.name)}
                        >
                          <FontAwesomeIcon icon={faFileCode} />
                          <span>{file.name}</span>
                          <span className="file-type">{file.type}</span>
                        </div>
                      ))
                    ) : (
                      selectedCopy.scriptContent.files.map((file, index) => (
                        <div
                          key={index}
                          className={`file-item ${selectedFile === file.name ? 'active' : ''}`}
                          onClick={() => setSelectedFile(file.name)}
                        >
                          <FontAwesomeIcon icon={faFileCode} />
                          <span>{file.name}</span>
                          <span className="file-type">{file.type}</span>
                        </div>
                      ))
                    )}
                  </div>
                  {showScrollRight && (
                    <button className="scroll-button scroll-right" onClick={handleScrollRight}>
                      <FontAwesomeIcon icon={faChevronRight} />
                    </button>
                  )}
                </div>

                {/* Code viewer */}
                <div className="code-viewer">

                  <div className="code-content-script">
                    {/* Show version content or current content */}
                    {selectedVersion !== null ? (
                      // Version content viewer
                      loadingVersionContent ? (
                        <div className="code-placeholder">
                          <FontAwesomeIcon icon={faSpinner} spin />
                          <p>Loading version content...</p>
                        </div>
                      ) : viewingVersionFile && versionContent ? (
                        <CodeViewerWithLineNumbers
                          code={versionContent.find(f => f.name === viewingVersionFile)?.source || 'No content available'}
                          className="version-code"
                        />
                      ) : (
                        <div className="code-placeholder">
                          <p>Select a file from the list above to view its content</p>
                        </div>
                      )
                    ) : (
                      // Current content viewer
                      selectedFile ? (
                        <CodeViewerWithLineNumbers
                          code={getSelectedFileContent() || 'No content available'}
                        />
                      ) : (
                        <div className="code-placeholder">
                          <p>Select a file from the list above to view its content</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right panel - Chat interface */}
          <div className="editor-chat">
            <div className="chat-header">
              <div className="chat-header-left">
              <FontAwesomeIcon icon={faRobot} />
                <div className="chat-title-container" onClick={() => setShowHistory(!showHistory)}>
                    <span className="chat-title">
                        {conversations.find(c => c.id === currentConversationId)?.title || 'AI Assistant'}
                    </span>
                    <FontAwesomeIcon icon={faHistory} className="history-icon" title="Chat History" />
                </div>
              </div>
              
              <div className="chat-header-actions">
                 <button 
                    className="undo-button"
                    onClick={handleUndo}
                    title="Undo Last Change (Ctrl+Z)"
                    disabled={!currentConversationId}
                 >
                    <FontAwesomeIcon icon={faUndo} />
                 </button>
                 <button 
                    className="new-chat-button"
                    onClick={() => createNewConversation()}
                    title="New Chat"
                 >
                    <FontAwesomeIcon icon={faPlus} />
                 </button>
              <span className={`chat-status ${ollamaReady ? 'chat-status--ready' : ''}`}>
                {ollamaLoading
                  ? 'Checking...'
                  : ollamaReady
                  ? '🟢'
                  : '⚪ Setup Required'}
              </span>
            </div>
            </div>
            
            {showHistory && (
                <div className="chat-history-dropdown">
                    <div className="history-list">
                        {conversations.map(conv => (
                            <div 
                                key={conv.id} 
                                className={`history-item ${conv.id === currentConversationId ? 'active' : ''}`}
                                onClick={() => {
                                    setCurrentConversationId(conv.id);
                                    setShowHistory(false);
                                }}
                            >
                                <span className="history-title">{conv.title}</span>
                                <span className="history-date">
                                    {/* We could add date here if available */}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!ollamaReady ? (
              <div className="chat-setup">
                <div className="chat-setup-card">
                  <h3>🤖 Local AI Setup</h3>
                  {ollamaLoading ? (
                    <div className="chat-setup-status">
                      <FontAwesomeIcon icon={faSpinner} spin />
                      <span>Checking Ollama status...</span>
                    </div>
                  ) : ollamaError ? (
                    <div className="chat-setup-error">
                      <p>⚠️ {ollamaError}</p>
                      <button type="button" onClick={checkOllamaStatus}>
                        Retry
                      </button>
                    </div>
                  ) : ollamaInstalled === false ? (
                    <div className="chat-setup-install">
                      <p>Ollama is not installed. Install it to use local AI models.</p>
                      <button
                        type="button"
                        className="chat-setup-action"
                        onClick={handleInstallOllama}
                        disabled={ollamaLoading}
                      >
                        Install Ollama
                      </button>
                    </div>
                  ) : !hasGemma ? (
                    <div className="chat-setup-model">
                      <p>Gemma 4B model is not installed. Pull it to start chatting.</p>
                      <button
                        type="button"
                        className="chat-setup-action"
                        onClick={handlePullGemma}
                        disabled={isPullingModel}
                      >
                        {isPullingModel ? 'Pulling Gemma 4B...' : 'Pull Gemma 4B'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="chat-messages">
                  {chatMessages.length === 0 ? (
                    <div className="chat-empty">
                      <FontAwesomeIcon icon={faRobot} className="chat-empty-icon" />
                      <p>Ask me anything about your Apps Script code!</p>
                      <p className="chat-empty-hint">I can help you understand, modify, or debug your scripts.</p>
                      {selectedFile && (
                        <p className="chat-empty-hint">
                          Currently viewing: <strong>{selectedFile}</strong>
                        </p>
                      )}
                    </div>
                  ) : (
                    chatMessages.map((message, index) => (
                      <div key={index} className={`chat-message ${message.role}`}>
                        <div className="chat-message-avatar">
                          <FontAwesomeIcon icon={message.role === 'user' ? faUser : faRobot} />
                        </div>
                        <div className="chat-message-content">
                          <div className="chat-message-text">{message.content}</div>
                          <div className="chat-message-time">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isChatLoading && (
                    <div className="chat-message assistant">
                      <div className="chat-message-avatar">
                        <FontAwesomeIcon icon={faRobot} />
                      </div>
                      <div className="chat-message-content">
                        <div className="chat-message-text">
                          <FontAwesomeIcon icon={faSpinner} spin /> Thinking...
                        </div>
                      </div>
                    </div>
                  )}
                  {ollamaError && (
                    <div className="chat-error">
                      <p>⚠️ {ollamaError}</p>
                    </div>
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>
                <div className="chat-input-container">
                  <textarea
                    className="chat-input"
                    placeholder={selectedFile ? `Ask about ${selectedFile}...` : "Ask about your code..."}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    rows={3}
                    disabled={isChatLoading || !ollamaReady}
                  />
                  <button
                    className="chat-send-button"
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || isChatLoading || !ollamaReady}
                  >
                    <FontAwesomeIcon icon={faPaperPlane} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Run Function Dialog */}
      {showRunDialog && (
        <div className="run-dialog-overlay" onClick={closeRunDialog}>
          <div className="run-dialog" onClick={e => e.stopPropagation()}>
            <div className="run-dialog-header">
              <h3>
                <FontAwesomeIcon icon={faPlay} />
                Run Function
              </h3>
              <button className="run-dialog-close" onClick={closeRunDialog}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="run-dialog-content">
              <div className="run-dialog-field">
                <label>Select Function</label>
                <div className="run-function-select-wrapper">
                  <select
                    value={functionToRun}
                    onChange={(e) => setFunctionToRun(e.target.value)}
                    className="run-function-select"
                    autoFocus
                  >
                    <option value="">-- Select a function --</option>
                    {availableFunctions.map((func) => (
                      <option key={func} value={func}>
                        {func}
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon icon={faChevronDown} className="select-arrow" />
                </div>
                {availableFunctions.length === 0 ? (
                  <p className="run-dialog-hint warning">
                    No functions detected. Make sure your .gs files contain valid function declarations.
                  </p>
                ) : (
                  <p className="run-dialog-hint">
                    Found {availableFunctions.length} function{availableFunctions.length !== 1 ? 's' : ''} in project. Runs in devMode.
                  </p>
                )}
              </div>

              {runResult && (
                <div className={`run-result ${runResult.success ? 'success' : 'error'}`}>
                  <div className="run-result-header">
                    {runResult.success ? (
                      <>
                        <FontAwesomeIcon icon={faCheckCircle} />
                        <span>Success</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faTimes} />
                        <span>Error</span>
                      </>
                    )}
                  </div>
                  {runResult.success ? (
                    <pre className="run-result-content">
                      {runResult.result !== undefined 
                        ? JSON.stringify(runResult.result, null, 2) 
                        : '(no return value)'}
                    </pre>
                  ) : (
                    <p className="run-result-error">{runResult.error}</p>
                  )}
                  {runResult.logs && runResult.logs.length > 0 && (
                    <div className="run-result-logs">
                      <strong>Logs:</strong>
                      {runResult.logs.map((log, i) => (
                        <div key={i} className="log-line">{log}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="run-dialog-actions">
              <button className="run-dialog-cancel" onClick={closeRunDialog}>
                Cancel
              </button>
              <button
                className="run-dialog-run"
                onClick={handleRunFunction}
                disabled={!functionToRun.trim() || isRunning}
              >
                {isRunning ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    Running...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPlay} />
                    Run
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CloudMCPServerEditor;

