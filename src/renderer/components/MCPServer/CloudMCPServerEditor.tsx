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
import { AIService } from '../../services/ai-service';
import type { AIStreamEvent } from '../../../main/types/ai-types';
import CodeViewerWithLineNumbers from './CodeViewerWithLineNumbers';
import './CloudMCPServerEditor.css';

interface TemplateCopy {
  id: string;
  templateId: string;
  templateScriptId?: string;
  spreadsheetId: string; // Production spreadsheet ID
  spreadsheetUrl: string; // Production spreadsheet URL
  scriptId?: string; // Production Apps Script ID
  devSpreadsheetId?: string; // Development spreadsheet ID
  devSpreadsheetUrl?: string; // Development spreadsheet URL
  devScriptId?: string; // Development Apps Script ID
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

  // AI state
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const aiConversationIdRef = useRef<string | null>(null);

  // Ollama setup state (for when local models need installation)
  const [ollamaInstalled, setOllamaInstalled] = useState<boolean | null>(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [isPullingModel, setIsPullingModel] = useState(false);
  const [hasGemma, setHasGemma] = useState(false);

  // Push/Pull state (Apps Script)
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pushed' | 'pulled' | 'error'>('idle');
  const [lastPushedVersion, setLastPushedVersion] = useState<number | null>(null);

  // Dev Script Sync state (Local ↔ Dev ↔ Prod flow)
  const [hasDevScript, setHasDevScript] = useState(false);
  const [isCreatingDevScript, setIsCreatingDevScript] = useState(false);
  const [isDevPushing, setIsDevPushing] = useState(false);
  const [isDevPulling, setIsDevPulling] = useState(false);
  const [isProdPushing, setIsProdPushing] = useState(false);
  const [isProdPulling, setIsProdPulling] = useState(false);
  const [devSyncStatus, setDevSyncStatus] = useState<'idle' | 'dev-pushed' | 'dev-pulled' | 'prod-pushed' | 'prod-pulled' | 'error'>('idle');
  const [devSyncMessage, setDevSyncMessage] = useState<string | null>(null);

  // Version history state - DEV
  const [showDevVersionDropdown, setShowDevVersionDropdown] = useState(false);
  const [selectedDevVersion, setSelectedDevVersion] = useState<number | null>(null);
  const [devVersions, setDevVersions] = useState<Array<{ versionNumber: number; description?: string; createTime: string }>>([]);
  const [loadingDevVersions, setLoadingDevVersions] = useState(false);
  
  // Version history state - PROD
  const [showProdVersionDropdown, setShowProdVersionDropdown] = useState(false);
  const [selectedProdVersion, setSelectedProdVersion] = useState<number | null>(null);
  const [prodVersions, setProdVersions] = useState<Array<{ versionNumber: number; description?: string; createTime: string }>>([]);
  const [loadingProdVersions, setLoadingProdVersions] = useState(false);
  
  // Shared version content state
  const [versionContent, setVersionContent] = useState<Array<{ name: string; type: string; source: string }> | null>(null);
  const [loadingVersionContent, setLoadingVersionContent] = useState(false);
  const [viewingVersionFile, setViewingVersionFile] = useState<string | null>(null);
  const [activeVersionEnv, setActiveVersionEnv] = useState<'dev' | 'prod' | null>(null);
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

  // Check AI status and fetch models
  const refreshAIStatus = useCallback(async () => {
    if (!window.electron) return;

    setAiLoading(true);
    setOllamaError(null);

    try {
      // 1. Check Ollama installation (for setup UI if needed)
      const ollamaResult = await (window.electron as any).ollama.checkInstalled();
      if (ollamaResult.success) {
        setOllamaInstalled(ollamaResult.installed || false);
        if (ollamaResult.installed) {
          const gemmaResult = await (window.electron as any).ollama.hasModel(GEMMA_MODEL);
          setHasGemma(!!(gemmaResult.success && gemmaResult.exists));
        }
      }

      // 2. Fetch all available models (Cloud + Local)
      // This will automatically fetch from the key manager if available
      const models = await AIService.getAvailableModels();
      setAvailableModels(models);

      // 3. Check if AI service is configured
      const isConfigured = await AIService.isConfigured();
      
      // 4. If not configured or model changed, configure now
      if (!isConfigured || selectedModel) {
        const configured = await AIService.configure({
          model: selectedModel,
          temperature: 0.7,
          maxOutputTokens: 8192,
          apiKey: '' // Will fetch from key manager in main process
        });
        setAiReady(configured);
      } else {
        setAiReady(true);
      }

      console.log('✅ AI status refreshed:', { 
        models, 
        selectedModel,
        hasCloudModels: models.some(m => !m.startsWith('ollama:')),
        hasLocalModels: models.some(m => m.startsWith('ollama:')),
        isConfigured
      });
    } catch (error) {
      console.error('Failed to refresh AI status:', error);
      setAiReady(false);
      setOllamaError('Failed to initialize AI service. Check your settings.');
    } finally {
      setAiLoading(false);
    }
  }, [selectedModel, GEMMA_MODEL]);

  useEffect(() => {
    void refreshAIStatus();
  }, [refreshAIStatus]);

  // Handle model change
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    setShowModelDropdown(false);
  };

  // Install Ollama if needed
  const handleInstallOllama = useCallback(async () => {
    if (!window.electron) return;
    setOllamaLoading(true);
    setOllamaError(null);
    try {
      const result = await (window.electron as any).ollama.ensure();
      if (result.success && result.installed) {
        setOllamaInstalled(true);
        await refreshAIStatus();
      } else {
        setOllamaError('Failed to install Ollama');
      }
    } catch (error) {
      console.error('Failed to install Ollama:', error);
      setOllamaError(error instanceof Error ? error.message : 'Installation failed');
    } finally {
      setOllamaLoading(false);
    }
  }, [refreshAIStatus]);

  // Pull local model
  const handlePullModel = useCallback(async (modelName: string) => {
    if (!window.electron) return;
    setIsPullingModel(true);
    setOllamaError(null);
    try {
      // If it's a model ID from our list (e.g. ollama:gemma), strip the prefix
      const normalizedName = modelName.startsWith('ollama:') ? modelName.substring(7) : modelName;
      const result = await (window.electron as any).ollama.pullModel(normalizedName);
      if (result.success) {
        await refreshAIStatus();
      } else {
        setOllamaError(result.error || `Failed to pull model ${normalizedName}`);
      }
    } catch (error) {
      console.error('Failed to pull model:', error);
      setOllamaError(error instanceof Error ? error.message : 'Model pull failed');
    } finally {
      setIsPullingModel(false);
    }
  }, [refreshAIStatus]);

  // Derived state for legacy setup cards
  const isOllamaSelected = selectedModel.startsWith('ollama:');
  const isGemmaSelected = selectedModel.includes('gemma');
  const ollamaReady = ollamaInstalled && (isGemmaSelected ? hasGemma : true);

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

  // Helper: prefer MCP tool call, fall back to IPC AppsScriptTools
  const callListVersions = async (projectId: string) => {
    const mcpCall = (window as any)?.electron?.mcp?.callTool;
    if (typeof mcpCall === 'function') {
      console.log('🧰 Using MCP tool: apps_script_list_versions');
      try {
        const mcpResult = await mcpCall('apps_script_list_versions', { projectId });
        console.log('🧰 MCP list_versions result:', mcpResult);
        return { source: 'mcp', result: mcpResult };
      } catch (err) {
        console.warn('⚠️ MCP list_versions failed, falling back to IPC:', err);
      }
    }

    console.log('🧰 Using IPC appsScriptTools.listVersions');
    const ipcResult = await (window.electron as any).appsScriptTools.listVersions(projectId);
    console.log('🧰 IPC appsScriptTools.listVersions result:', ipcResult);
    return { source: 'ipc', result: ipcResult };
  };

  // Helper to normalize versions response
  const normalizeVersionsResponse = (result: any): Array<{ versionNumber: number; description?: string; createTime: string }> => {
    let versionsData: any = result.data ?? result;

    // 1) Raw MCP text content
    if (versionsData?.content?.[0]?.text) {
      try {
        const parsed = JSON.parse(versionsData.content[0].text);
        versionsData = parsed.versions || parsed || [];
      } catch {
        versionsData = [];
      }
    }
    // 2) useMCPTools parsed object with versions
    else if (versionsData?.content && typeof versionsData.content === 'object' && !Array.isArray(versionsData.content)) {
      versionsData = versionsData.content.versions || versionsData.content || [];
    }
    // 3) Direct { versions: [...] }
    else if (versionsData?.versions) {
      versionsData = versionsData.versions;
    }

    const normalized = Array.isArray(versionsData) ? versionsData : [];
    return [...normalized].sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));
  };

  // Load versions for DEV script
  const loadDevVersions = async () => {
    if (!selectedCopy?.devScriptId) {
      setDevVersions([]);
      return;
    }

    setLoadingDevVersions(true);
    try {
      console.log('📜 Loading DEV versions...');
      const { source, result } = await callListVersions(selectedCopy.id);
      
      if (result?.success ?? !result?.error) {
        const sortedVersions = normalizeVersionsResponse(result);
        setDevVersions(sortedVersions);
        console.log(`✅ Loaded ${sortedVersions.length} DEV versions`);
      } else {
        console.warn(`Failed to load DEV versions via ${source}:`, result?.error);
        setDevVersions([]);
      }
    } catch (err) {
      console.error('Error loading DEV versions:', err);
      setDevVersions([]);
    } finally {
      setLoadingDevVersions(false);
    }
  };

  // Load versions for PROD script
  const loadProdVersions = async () => {
    if (!selectedCopy?.scriptId) {
      setProdVersions([]);
      return;
    }

    setLoadingProdVersions(true);
    try {
      console.log('📜 Loading PROD versions...');
      // For prod, we need to call with the prod script ID specifically
      const { source, result } = await callListVersions(selectedCopy.id);
      
      if (result?.success ?? !result?.error) {
        const sortedVersions = normalizeVersionsResponse(result);
        setProdVersions(sortedVersions);
        console.log(`✅ Loaded ${sortedVersions.length} PROD versions`);
      } else {
        console.warn(`Failed to load PROD versions via ${source}:`, result?.error);
        setProdVersions([]);
      }
    } catch (err) {
      console.error('Error loading PROD versions:', err);
      setProdVersions([]);
    } finally {
      setLoadingProdVersions(false);
    }
  };

  // Load all versions
  const loadAllVersions = async () => {
    await Promise.all([loadDevVersions(), loadProdVersions()]);
  };

  // Load content for a specific version (dev or prod)
  const loadVersionContent = async (versionNumber: number, env: 'dev' | 'prod') => {
    if (!selectedCopy?.id) return;

    setLoadingVersionContent(true);
    setVersionContent(null);
    setViewingVersionFile(null);
    setActiveVersionEnv(env);

    try {
      console.log(`📜 Loading content for ${env.toUpperCase()} version ${versionNumber}...`);
      const result = await (window.electron as any).appsScriptTools.getVersionContent(selectedCopy.id, versionNumber);
      
      if (result.success && result.data) {
        let filesData: any = result.data;

        // Handle different response shapes
        if (filesData?.content?.[0]?.text) {
          try {
            const parsed = JSON.parse(filesData.content[0].text);
            filesData = parsed.files || [];
          } catch {
            filesData = [];
          }
        } else if (filesData?.content && typeof filesData.content === 'object' && !Array.isArray(filesData.content)) {
          filesData = filesData.content.files || [];
        } else if (filesData?.files) {
          filesData = filesData.files;
        }

        const normalizedFiles = Array.isArray(filesData) ? filesData : [];
        setVersionContent(normalizedFiles);
        // Auto-select first file
        if (normalizedFiles.length > 0) {
          setViewingVersionFile(normalizedFiles[0].name);
        }
        console.log(`✅ Loaded ${normalizedFiles.length} files from version ${versionNumber}`);
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

  // Handle DEV version selection
  const handleDevVersionSelect = async (versionNumber: number | null) => {
    setSelectedDevVersion(versionNumber);
    setSelectedProdVersion(null); // Deselect prod version
    setShowDevVersionDropdown(false);
    
    if (versionNumber === null) {
      setVersionContent(null);
      setViewingVersionFile(null);
      setActiveVersionEnv(null);
    } else {
      await loadVersionContent(versionNumber, 'dev');
    }
  };

  // Handle PROD version selection
  const handleProdVersionSelect = async (versionNumber: number | null) => {
    setSelectedProdVersion(versionNumber);
    setSelectedDevVersion(null); // Deselect dev version
    setShowProdVersionDropdown(false);
    
    if (versionNumber === null) {
      setVersionContent(null);
      setViewingVersionFile(null);
      setActiveVersionEnv(null);
    } else {
      await loadVersionContent(versionNumber, 'prod');
    }
  };

  // Restore version to local
  const handleRestoreVersion = async () => {
    const selectedVersion = selectedDevVersion ?? selectedProdVersion;
    const envLabel = activeVersionEnv === 'dev' ? 'DEV' : 'PROD';
    
    if (!selectedCopy?.id || !versionContent || selectedVersion === null) return;

    if (!confirm(`Restore ${envLabel} version ${selectedVersion} to local?\n\nThis will replace your local content with this version's content.`)) {
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

      const scriptId = activeVersionEnv === 'dev' ? selectedCopy.devScriptId : selectedCopy.scriptId;
      const result = await window.electron.templateCopies.updateScriptContent(
        scriptId!,
        scriptContent
      );

      if (result.success) {
        alert(`Successfully restored ${envLabel} version ${selectedVersion} to local!`);
        // Reset to HEAD view
        setSelectedDevVersion(null);
        setSelectedProdVersion(null);
        setVersionContent(null);
        setViewingVersionFile(null);
        setActiveVersionEnv(null);
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
    if (selectedCopy?.scriptId || selectedCopy?.devScriptId) {
      loadAllVersions();
    } else {
      setDevVersions([]);
      setProdVersions([]);
      setSelectedDevVersion(null);
      setSelectedProdVersion(null);
      setVersionContent(null);
      setActiveVersionEnv(null);
    }
  }, [selectedCopy?.id]);

  // Check if selected copy has a dev script
  // Check if dev environment exists (both spreadsheet and script)
  useEffect(() => {
    setHasDevScript(!!(selectedCopy?.devScriptId && selectedCopy?.devSpreadsheetId));
  }, [selectedCopy]);

  // Create Dev Environment (clone production spreadsheet + script)
  const handleCreateDevScript = async () => {
    if (!selectedCopy?.id) {
      alert('No project selected');
      return;
    }

    if (!confirm('Create Dev Environment?\n\nThis will create:\n• Dev Spreadsheet (copy of production)\n• Dev Apps Script (bound to dev spreadsheet)')) {
      return;
    }

    setIsCreatingDevScript(true);
    setDevSyncMessage(null);

    try {
      console.log('🔧 Creating dev environment...');
      const result = await (window.electron as any).appsScriptTools.cloneForDev(selectedCopy.id);

      if (result.success) {
        const devInfo = result.data;
        let message = 'Dev environment created!';
        if (devInfo?.devSpreadsheetId) {
          message += ` Spreadsheet: ${devInfo.devSpreadsheetId}`;
        }
        if (devInfo?.devScriptId) {
          message += ` Script: ${devInfo.devScriptId}`;
        }
        setDevSyncMessage(message);
        setHasDevScript(true);
        // Reload to get updated template copy with dev info
        await loadTemplateCopies();
        setTimeout(() => setDevSyncMessage(null), 5000);
      } else {
        setDevSyncStatus('error');
        setDevSyncMessage(result.error || 'Failed to create dev environment');
      }
    } catch (error) {
      console.error('Error creating dev environment:', error);
      setDevSyncStatus('error');
      setDevSyncMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsCreatingDevScript(false);
    }
  };

  // Dev Pull: Pull FROM Dev script TO Local
  const handleDevPull = async () => {
    if (!selectedCopy?.id || !hasDevScript) {
      alert('No dev script configured. Please create a dev script first.');
      return;
    }

    if (!confirm('Pull from DEV script to local?\n\nThis will overwrite your local changes with the dev script content.')) {
      return;
    }

    setIsDevPulling(true);
    setDevSyncStatus('idle');
    setDevSyncMessage(null);

    try {
      console.log('📥 Dev Pull: Pulling from dev script to local...');
      const result = await (window.electron as any).appsScriptTools.pullFromDev(selectedCopy.id);

      if (result.success) {
        setDevSyncStatus('dev-pulled');
        setDevSyncMessage(`Pulled ${result.data?.fileCount || 0} files from dev`);
        await loadTemplateCopies();
        setTimeout(() => {
          setDevSyncStatus('idle');
          setDevSyncMessage(null);
        }, 4000);
      } else {
        setDevSyncStatus('error');
        setDevSyncMessage(result.error || 'Pull failed');
      }
    } catch (error) {
      console.error('Error pulling from dev:', error);
      setDevSyncStatus('error');
      setDevSyncMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsDevPulling(false);
    }
  };

  // Dev Push: Push Local TO Dev script
  const handleDevPush = async () => {
    if (!selectedCopy?.id || !hasDevScript) {
      alert('No dev script configured. Please create a dev script first.');
      return;
    }

    if (!confirm('Push local changes to DEV script?\n\nThis will update the dev script with your local changes.')) {
      return;
    }

    setIsDevPushing(true);
    setDevSyncStatus('idle');
    setDevSyncMessage(null);

    try {
      console.log('📤 Dev Push: Pushing local to dev script...');
      const result = await (window.electron as any).appsScriptTools.pushToDev(selectedCopy.id, true, `Dev push at ${new Date().toLocaleString()}`);

      if (result.success) {
        setDevSyncStatus('dev-pushed');
        setDevSyncMessage(result.data?.message || 'Pushed to dev');
        setTimeout(() => {
          setDevSyncStatus('idle');
          setDevSyncMessage(null);
        }, 4000);
      } else {
        setDevSyncStatus('error');
        setDevSyncMessage(result.error || 'Push failed');
      }
    } catch (error) {
      console.error('Error pushing to dev:', error);
      setDevSyncStatus('error');
      setDevSyncMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsDevPushing(false);
    }
  };

  // Prod Pull: Pull FROM Prod script TO Dev script (and local)
  const handleProdPull = async () => {
    if (!selectedCopy?.id || !hasDevScript) {
      alert('No dev script configured. Please create a dev script first.');
      return;
    }

    if (!confirm('Pull from PRODUCTION to DEV?\n\nThis will update your dev script with the latest production code.')) {
      return;
    }

    setIsProdPulling(true);
    setDevSyncStatus('idle');
    setDevSyncMessage(null);

    try {
      console.log('📥 Prod Pull: Pulling from production to dev...');
      const result = await (window.electron as any).appsScriptTools.pullProdToDev(selectedCopy.id);

      if (result.success) {
        setDevSyncStatus('prod-pulled');
        setDevSyncMessage(`Pulled ${result.data?.fileCount || 0} files from prod`);
        await loadTemplateCopies();
        setTimeout(() => {
          setDevSyncStatus('idle');
          setDevSyncMessage(null);
        }, 4000);
      } else {
        setDevSyncStatus('error');
        setDevSyncMessage(result.error || 'Pull failed');
      }
    } catch (error) {
      console.error('Error pulling from prod:', error);
      setDevSyncStatus('error');
      setDevSyncMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsProdPulling(false);
    }
  };

  // Prod Push: Push Dev TO Production (DANGEROUS)
  const handleProdPush = async () => {
    if (!selectedCopy?.id || !hasDevScript) {
      alert('No dev script configured. Please create a dev script first.');
      return;
    }

    // First confirmation
    const confirmed = confirm(
      '⚠️ WARNING: Push DEV to PRODUCTION?\n\n' +
      'This will OVERWRITE the production script with your dev code.\n\n' +
      'Are you sure you want to proceed?'
    );
    if (!confirmed) return;

    // Double confirmation for safety
    const doubleConfirm = confirm(
      '⚠️ FINAL CONFIRMATION\n\n' +
      'You are about to overwrite PRODUCTION code.\n' +
      'A version will be created.\n\n' +
      'Click OK to confirm:'
    );
    if (!doubleConfirm) return;

    setIsProdPushing(true);
    setDevSyncStatus('idle');
    setDevSyncMessage(null);

    try {
      console.log('📤 Prod Push: Pushing dev to production...');
      const result = await (window.electron as any).appsScriptTools.pushDevToProd(
        selectedCopy.id, 
        true, 
        `Production release at ${new Date().toLocaleString()}`
      );

      if (result.success) {
        setDevSyncStatus('prod-pushed');
        setDevSyncMessage(result.data?.message || 'Pushed to production');
        setTimeout(() => {
          setDevSyncStatus('idle');
          setDevSyncMessage(null);
        }, 4000);
      } else {
        setDevSyncStatus('error');
        setDevSyncMessage(result.error || 'Push failed');
      }
    } catch (error) {
      console.error('Error pushing to prod:', error);
      setDevSyncStatus('error');
      setDevSyncMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsProdPushing(false);
    }
  };

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
  }, [handleScroll, selectedCopy, selectedDevVersion, selectedProdVersion]);

  useEffect(() => {
    scrollChatToBottom();
  }, [chatMessages]);

  // Build system prompt with code context
  const buildSystemPrompt = useCallback(() => {
    const fileContent = getSelectedFileContent();
    const fileName = selectedFile || 'No file selected';
    const fileType = selectedCopy?.scriptContent?.files?.find(f => f.name === fileName)?.type || 'unknown';
    const allFiles = selectedCopy?.scriptContent?.files || [];
    
    // Get both dev and prod script IDs
    const prodScriptId = selectedCopy?.scriptId;
    const devScriptId = selectedCopy?.devScriptId;
    const prodSpreadsheetId = selectedCopy?.spreadsheetId;
    const devSpreadsheetId = selectedCopy?.devSpreadsheetId;
    
    // Determine which script to use - default to DEV if available, otherwise PROD
    const activeScriptId = devScriptId || prodScriptId;
    const activeEnvironment = devScriptId ? 'DEV' : 'PROD';
    
    // DEBUG: Log what we're using for scriptId
    console.log('🔍 buildSystemPrompt - selectedCopy:', {
      id: selectedCopy?.id,
      prodScriptId,
      devScriptId,
      activeScriptId,
      activeEnvironment,
      prodSpreadsheetId,
      devSpreadsheetId
    });

    let codeContext = '';
    if (fileContent && fileContent.trim().length > 0) {
      codeContext = `\n📂 CURRENT FILE: ${fileName} (${fileType})
\`\`\`${fileType === 'server_js' ? 'javascript' : fileType === 'html' ? 'html' : 'javascript'}
${fileContent.slice(0, 5000)}${fileContent.length > 5000 ? '\n... (truncated)' : ''}
\`\`\`
`;
    }

    // Build environment info section
    let envInfo = '';
    if (devScriptId && prodScriptId) {
      envInfo = `
🌍 ENVIRONMENT SETUP (Local → Dev → Prod flow):
┌─────────────────────────────────────────────────────────────────┐
│ 🔧 DEV ENVIRONMENT (for testing/development):                  │
│    Script ID: "${devScriptId}"                                  │
│    Spreadsheet: ${devSpreadsheetId || 'Not set'}               │
├─────────────────────────────────────────────────────────────────┤
│ 📋 PROD ENVIRONMENT (live/production):                          │
│    Script ID: "${prodScriptId}"                                 │
│    Spreadsheet: ${prodSpreadsheetId || 'Not set'}              │
└─────────────────────────────────────────────────────────────────┘

⚡ ACTIVE ENVIRONMENT: ${activeEnvironment}
🔑 USE THIS SCRIPT ID: "${activeScriptId}"

💡 Development Workflow:
1. All code changes should go to DEV script first
2. Test thoroughly in DEV environment
3. Once verified, user will push DEV → PROD via UI buttons
`;
    } else {
      envInfo = `
🔑 PROJECT ID: "${activeScriptId}"
📊 Spreadsheet: ${prodSpreadsheetId || 'Not set'}
${!devScriptId ? '⚠️ DEV environment not set up - changes go directly to PROD' : ''}
`;
    }

    return `You are an expert Google Apps Script developer. Your job is to TAKE ACTION IMMEDIATELY using tools.
${envInfo}
📂 Files: ${allFiles.map(f => f.name).join(', ') || 'None'}
${codeContext}

⚡ CRITICAL RULES:
1. When user asks to CREATE, MODIFY, or FIX code → USE TOOLS IMMEDIATELY
2. DO NOT explain what you would do → JUST DO IT with tools
3. DO NOT write example code in chat → WRITE IT TO FILES with apps_script_write_file
4. ALWAYS use scriptId="${activeScriptId}" in ALL tool calls

🛠️ AVAILABLE TOOLS (USE THESE - don't just talk about them):

📁 FILE OPERATIONS (edit LOCAL copy):
• apps_script_list_files - List all files in a script project
• apps_script_read_file - Read a file's contents
• apps_script_write_file - Create/replace entire file (use for new files or complete rewrites)
• apps_script_partial_edit - Edit existing code (search/replace)
• apps_script_rename_file - Rename a file
• apps_script_delete_file - Delete a file

🔄 PUSH/PULL OPERATIONS (sync with Google):
• apps_script_push_to_dev - Push local changes to DEV (makes changes LIVE in DEV spreadsheet)
• apps_script_pull_from_dev - Pull DEV code to local
• apps_script_push_dev_to_prod - ⚠️ DANGEROUS: Deploy DEV to PRODUCTION (only when user explicitly asks!)
• apps_script_pull_prod_to_dev - Sync DEV with PRODUCTION code

💡 WORKFLOW:
1. Edit code using file operations (apps_script_write_file, apps_script_partial_edit)
2. Push to DEV using apps_script_push_to_dev to make changes live
3. NEVER push to PROD unless user explicitly requests deployment

📝 APPS SCRIPT BEST PRACTICES:
• Use PropertiesService for IDs/keys (NEVER hardcode)
• Create setupEnvironment() for one-click initialization
• Generate complete appsscript.json with all oauthScopes
• Use Logger.log() for debugging, console.log() for V8
• For automation, use ScriptApp.newTrigger()
• .gs = server JS, .html = client HTML with scriptlets

🎯 BEHAVIOR:
- User says "create contact sync" → IMMEDIATELY call apps_script_write_file with complete code
- User says "add error handling" → IMMEDIATELY call apps_script_partial_edit to add it
- User says "fix the bug" → READ the file first, then FIX it with tools
- NEVER say "Here's the code you need..." → WRITE IT TO THE FILE
- NEVER use placeholders like "// your code here" → WRITE COMPLETE CODE
- Be concise: Explain in 1-2 sentences, then USE TOOLS

Remember: You have tools. USE THEM. Don't just describe what to do - DO IT.`;
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

  // Unify chat send using AIService
  const handleChatSend = useCallback(async () => {
    if (!chatInput.trim() || isChatLoading || !aiReady) {
      if (!aiReady) {
        setOllamaError(`AI model ${selectedModel} is not ready. Check your settings.`);
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
      // Ensure AI Service is configured with current model
      await AIService.configure({
        model: selectedModel,
        temperature: 0.7,
        maxOutputTokens: 8192,
        apiKey: '' // Uses stored key
      });

      // Track accumulated response for streaming
      let fullResponse = '';

      // DEBUG: Log what scriptId we're passing to AI
      console.log('🤖 Starting AI conversation with context:', {
        selectedCopy_id: selectedCopy?.id,
        selectedCopy_scriptId: selectedCopy?.scriptId,
        selectedCopy_spreadsheetId: selectedCopy?.spreadsheetId,
        selectedCopy_templateScriptId: selectedCopy?.templateScriptId,
        currentFile: selectedFile
      });

      // Start autonomous conversation with streaming
      const { conversationId } = await AIService.startAutonomousConversation(
        prompt,
        {
          toolContext: 'apps-script', // ✅ Only expose Apps Script tools to AI
          maxTurns: 10, // Increased turn limit for better task completion
          autoExecuteTools: true, // Let backend handle tool execution loop
          context: {
            scriptId: selectedCopy?.devScriptId || selectedCopy?.scriptId, // Prefer dev script
            devScriptId: selectedCopy?.devScriptId,
            prodScriptId: selectedCopy?.scriptId,
            devSpreadsheetId: selectedCopy?.devSpreadsheetId,
            prodSpreadsheetId: selectedCopy?.spreadsheetId,
            currentFile: selectedFile,
            projectContext: 'apps-script-editor',
            hasDevEnvironment: !!(selectedCopy?.devScriptId && selectedCopy?.devSpreadsheetId),
            systemPrompt: buildSystemPrompt()
          }
        },
        (event: AIStreamEvent) => {
          // Handle streaming events
          switch (event.type) {
            case 'content':
              fullResponse += (event as any).content || '';
              // Update the last assistant message or create new one
              setChatMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                // Only update if it's an assistant message and NOT a tool status message
                if (lastMsg?.role === 'assistant' && !lastMsg.content.startsWith('⚙️') && !lastMsg.content.startsWith('✅') && !lastMsg.content.startsWith('❌')) {
                  return [...prev.slice(0, -1), { ...lastMsg, content: fullResponse }];
                }
                return [...prev, {
                  role: 'assistant',
                  content: fullResponse,
                  timestamp: new Date()
                }];
              });
              break;

            case 'tool_call_request':
              const toolCall = (event as any).toolCall;
              setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: `⚙️ Executing: ${toolCall?.name || 'tool'}...`,
                timestamp: new Date()
              }]);
              break;

            case 'tool_call_response':
              const toolResponse = (event as any).response;
              // If it was a file modification tool, reload the copies to reflect changes in UI
              if (['apps_script_write_file', 'apps_script_partial_edit', 'apps_script_delete_file', 'apps_script_rename_file'].includes(toolResponse?.name)) {
                void loadTemplateCopies();
              }
              
              const resultMsg = toolResponse?.success 
                ? `✅ ${typeof toolResponse.result === 'string' ? toolResponse.result : JSON.stringify(toolResponse.result).substring(0, 200)}`
                : `❌ ${toolResponse?.error || 'Tool execution failed'}`;
              
              setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: resultMsg,
                timestamp: new Date()
              }]);
              break;

            case 'finished':
              setIsChatLoading(false);
              // Save the final response
              if (fullResponse) {
                void saveMessageToDB('assistant', fullResponse);
              }
              // Clean up listener
              if (aiConversationIdRef.current) {
                AIService.unregisterStreamEventListener(aiConversationIdRef.current);
                aiConversationIdRef.current = null;
              }
              break;

            case 'error':
              const errorMsg = (event as any).error?.message || 'Unknown error';
              console.error('AI error:', errorMsg);
              setOllamaError(errorMsg);
              setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error: ${errorMsg}`,
                timestamp: new Date()
              }]);
              setIsChatLoading(false);
              break;
          }
        }
      );

      aiConversationIdRef.current = conversationId;
      console.log('Started autonomous conversation:', conversationId);

    } catch (error) {
      console.error('AI chat error:', error);
      setOllamaError(error instanceof Error ? error.message : 'AI chat failed');
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}.`,
        timestamp: new Date()
      }]);
      setIsChatLoading(false);
    }
  }, [chatInput, isChatLoading, aiReady, selectedModel, selectedCopy, selectedFile, buildSystemPrompt, saveMessageToDB, loadTemplateCopies]);

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
      <div className="cloud-mcp-editor-header">
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
          {/* Open Spreadsheet Buttons */}
          {selectedCopy && (
            <>
              <button
                className="open-spreadsheet-button"
                onClick={() => {
                  if (selectedCopy.spreadsheetUrl) {
                    window.open(selectedCopy.spreadsheetUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
                title="Open production spreadsheet in browser"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
                Prod
              </button>
              {selectedCopy.devSpreadsheetUrl && (
                <button
                  className="open-spreadsheet-button dev-spreadsheet-button"
                  onClick={() => {
                    if (selectedCopy.devSpreadsheetUrl) {
                      window.open(selectedCopy.devSpreadsheetUrl, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  title="Open dev spreadsheet in browser"
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                  Dev
                </button>
              )}
            </>
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
          
          {/* Dev Script Sync Buttons - Local ↔ Dev ↔ Prod flow */}
          {selectedCopy?.scriptId && (
            <>
              {!hasDevScript ? (
                /* No dev environment yet - show setup button */
                <button
                  className="setup-dev-button"
                  onClick={handleCreateDevScript}
                  disabled={isCreatingDevScript}
                  title="Create Dev Environment (spreadsheet + script)"
                >
                  {isCreatingDevScript ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    <FontAwesomeIcon icon={faPlus} />
                  )}
                  Setup Dev
                </button>
              ) : (
                /* Dev script exists - show full flow */
                <>
                  {/* Dev Pull: Dev → Local */}
                  <button
                    className="dev-pull-button"
                    onClick={handleDevPull}
                    disabled={isDevPulling || isDevPushing || isProdPulling || isProdPushing}
                    title="Pull from DEV script to Local"
                  >
                    {isDevPulling ? (
                      <FontAwesomeIcon icon={faSpinner} spin />
                    ) : (
                      <FontAwesomeIcon icon={faCloudDownload} />
                    )}
                    Dev Pull
                  </button>

                  {/* Dev Push: Local → Dev */}
                  <button
                    className="dev-push-button"
                    onClick={handleDevPush}
                    disabled={isDevPulling || isDevPushing || isProdPulling || isProdPushing}
                    title="Push Local changes to DEV script"
                  >
                    {isDevPushing ? (
                      <FontAwesomeIcon icon={faSpinner} spin />
                    ) : (
                      <FontAwesomeIcon icon={faCloudUpload} />
                    )}
                    Dev Push
                  </button>

                  <div className="dev-sync-divider" />

                  {/* Prod Pull: Prod → Dev */}
                  <button
                    className="pull-button"
                    onClick={handleProdPull}
                    disabled={isDevPulling || isDevPushing || isProdPulling || isProdPushing}
                    title="Pull from PRODUCTION to DEV script"
                  >
                    {isProdPulling ? (
                      <FontAwesomeIcon icon={faSpinner} spin />
                    ) : (
                      <FontAwesomeIcon icon={faCloudDownload} />
                    )}
                    Prod Pull
                  </button>

                  {/* Prod Push: Dev → Prod (DANGEROUS) */}
                  <button
                    className="prod-push-button"
                    onClick={handleProdPush}
                    disabled={isDevPulling || isDevPushing || isProdPulling || isProdPushing}
                    title="⚠️ Push DEV to PRODUCTION (Dangerous!)"
                  >
                    {isProdPushing ? (
                      <FontAwesomeIcon icon={faSpinner} spin />
                    ) : (
                      <FontAwesomeIcon icon={faCloudUpload} />
                    )}
                    Prod Push ⚠️
                  </button>
                </>
              )}

              {/* Status messages */}
              {devSyncStatus === 'dev-pulled' && (
                <span className="sync-status sync-status-pulled">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  {devSyncMessage || 'Dev Pulled!'}
                </span>
              )}
              {devSyncStatus === 'dev-pushed' && (
                <span className="sync-status sync-status-pushed">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  {devSyncMessage || 'Dev Pushed!'}
                </span>
              )}
              {devSyncStatus === 'prod-pulled' && (
                <span className="sync-status sync-status-pulled">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  {devSyncMessage || 'Prod Pulled!'}
                </span>
              )}
              {devSyncStatus === 'prod-pushed' && (
                <span className="sync-status sync-status-pushed">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  {devSyncMessage || 'Prod Pushed!'}
                </span>
              )}
              {devSyncStatus === 'error' && (
                <span className="sync-status sync-status-error">
                  ❌ {devSyncMessage || 'Error'}
                </span>
              )}
              {devSyncMessage && devSyncStatus === 'idle' && (
                <span className="sync-status sync-status-pushed">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  {devSyncMessage}
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
        <div className="cloud-mcp-editor-layout">
          {/* Left sidebar - Template copies list */}
          <div className="cloud-mcp-editor-sidebar">
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
            
            {/* Version History - DEV */}
            {selectedCopy?.devScriptId && (
              <div className="version-dropdown-container version-dev">
                <div className="sidebar-header version-header">
                  <FontAwesomeIcon icon={faCodeBranch} />
                  <span className="version-env-label dev">🔧 DEV Versions {loadingDevVersions && <FontAwesomeIcon icon={faSpinner} spin className="loading-spinner-small" />}</span>
                </div>
                <button 
                  className="version-dropdown-toggle dev"
                  onClick={() => setShowDevVersionDropdown(!showDevVersionDropdown)}
                  disabled={loadingDevVersions}
                >
                  <span className="version-toggle-label">
                    {loadingVersionContent && activeVersionEnv === 'dev' ? 'Loading...' : selectedDevVersion ? `v${selectedDevVersion}` : 'Current (HEAD)'}
                  </span>
                  <FontAwesomeIcon 
                    icon={showDevVersionDropdown ? faChevronUp : faChevronDown} 
                    className="dropdown-chevron"
                  />
                </button>
                
                {showDevVersionDropdown && (
                  <div className="version-dropdown-list">
                    <div 
                      className={`version-dropdown-item ${selectedDevVersion === null && activeVersionEnv !== 'prod' ? 'active' : ''}`}
                      onClick={() => handleDevVersionSelect(null)}
                    >
                      <div className="version-item-header">
                        <span className="version-number">Current (HEAD)</span>
                      </div>
                      <span className="version-description">Local working copy</span>
                    </div>
                    
                    {devVersions.length === 0 && !loadingDevVersions && (
                      <div className="version-dropdown-item version-empty">
                        <span className="version-description">No DEV versions yet. Push to DEV to create one.</span>
                      </div>
                    )}
                    
                    {devVersions.map((version) => (
                      <div 
                        key={version.versionNumber}
                        className={`version-dropdown-item ${selectedDevVersion === version.versionNumber ? 'active' : ''}`}
                        onClick={() => handleDevVersionSelect(version.versionNumber)}
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
              </div>
            )}

            {/* Version History - PROD */}
            {selectedCopy?.scriptId && (
              <div className="version-dropdown-container version-prod">
                <div className="sidebar-header version-header">
                  <FontAwesomeIcon icon={faCodeBranch} />
                  <span className="version-env-label prod">📋 PROD Versions {loadingProdVersions && <FontAwesomeIcon icon={faSpinner} spin className="loading-spinner-small" />}</span>
                </div>
                <button 
                  className="version-dropdown-toggle prod"
                  onClick={() => setShowProdVersionDropdown(!showProdVersionDropdown)}
                  disabled={loadingProdVersions}
                >
                  <span className="version-toggle-label">
                    {loadingVersionContent && activeVersionEnv === 'prod' ? 'Loading...' : selectedProdVersion ? `v${selectedProdVersion}` : 'Current (HEAD)'}
                  </span>
                  <FontAwesomeIcon 
                    icon={showProdVersionDropdown ? faChevronUp : faChevronDown} 
                    className="dropdown-chevron"
                  />
                </button>
                
                {showProdVersionDropdown && (
                  <div className="version-dropdown-list">
                    <div 
                      className={`version-dropdown-item ${selectedProdVersion === null && activeVersionEnv !== 'dev' ? 'active' : ''}`}
                      onClick={() => handleProdVersionSelect(null)}
                    >
                      <div className="version-item-header">
                        <span className="version-number">Current (HEAD)</span>
                      </div>
                      <span className="version-description">Production working copy</span>
                    </div>
                    
                    {prodVersions.length === 0 && !loadingProdVersions && (
                      <div className="version-dropdown-item version-empty">
                        <span className="version-description">No PROD versions yet. Push to PROD to create one.</span>
                      </div>
                    )}
                    
                    {prodVersions.map((version) => (
                      <div 
                        key={version.versionNumber}
                        className={`version-dropdown-item ${selectedProdVersion === version.versionNumber ? 'active' : ''}`}
                        onClick={() => handleProdVersionSelect(version.versionNumber)}
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
              </div>
            )}
            
            {/* Restore button when viewing a version */}
            {(selectedDevVersion !== null || selectedProdVersion !== null) && versionContent && (
              <button 
                className={`restore-version-button ${activeVersionEnv}`}
                onClick={handleRestoreVersion}
                title={`Restore this ${activeVersionEnv?.toUpperCase()} version to local`}
              >
                <FontAwesomeIcon icon={faUndo} />
                Restore {activeVersionEnv === 'dev' ? '🔧' : '📋'} v{selectedDevVersion ?? selectedProdVersion} to Local
              </button>
            )}
          </div>

          {/* Middle panel - Script content */}
          <div className="cloud-mcp-editor-content">
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
                    <strong>📋 Production Spreadsheet:</strong>{' '}
                    <a 
                      href={selectedCopy.spreadsheetUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {selectedCopy.spreadsheetId}
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </a>
                  </div>
                  {selectedCopy.scriptId && (
                    <div className="info-item">
                      <strong>📋 Production Script:</strong> {selectedCopy.scriptId}
                    </div>
                  )}
                  {selectedCopy.devSpreadsheetUrl && (
                    <div className="info-item">
                      <strong>🔧 Dev Spreadsheet:</strong>{' '}
                      <a 
                        href={selectedCopy.devSpreadsheetUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        {selectedCopy.devSpreadsheetId}
                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                      </a>
                    </div>
                  )}
                  {selectedCopy.devScriptId && (
                    <div className="info-item">
                      <strong>🔧 Dev Script:</strong> {selectedCopy.devScriptId}
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
                    {(selectedDevVersion !== null || selectedProdVersion !== null) && versionContent ? (
                      versionContent.map((file, index) => (
                        <div
                          key={index}
                          className={`file-item ${viewingVersionFile === file.name ? 'active' : ''} ${activeVersionEnv === 'dev' ? 'dev-version' : 'prod-version'}`}
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
                    {(selectedDevVersion !== null || selectedProdVersion !== null) ? (
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
          <div className="cloud-mcp-editor-chat">
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
                {/* Unified Model Selector */}
                <div className="cloud-mcp-model-selector">
                  <button 
                    className={`cloud-mcp-model-dropdown-toggle ${aiReady ? 'ready' : ''}`}
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    title="Select AI Model"
                  >
                    <span className="cloud-mcp-model-status-dot"></span>
                    <span className="cloud-mcp-model-name">
                      {selectedModel.startsWith('ollama:') 
                        ? `🖥️ ${selectedModel.replace('ollama:', '')}` 
                        : `☁️ ${selectedModel.replace('gemini-', '').replace('-latest', '')}`}
                    </span>
                    <FontAwesomeIcon icon={showModelDropdown ? faChevronUp : faChevronDown} />
                  </button>
                  
                  {showModelDropdown && (
                    <div className="cloud-mcp-model-dropdown">
                      {/* Cloud Models Section */}
                      <div className="cloud-mcp-model-group-label">Cloud Models (Gemini)</div>
                      {availableModels.filter(m => !m.startsWith('ollama:')).map(model => (
                        <button
                          key={model}
                          className={`cloud-mcp-model-option ${selectedModel === model ? 'active' : ''}`}
                          onClick={() => handleModelChange(model)}
                        >
                          ☁️ {model}
                        </button>
                      ))}
                      
                      {/* Local Models Section */}
                      <div className="cloud-mcp-model-group-label">Local Models (Ollama)</div>
                      {availableModels.filter(m => m.startsWith('ollama:')).map(model => (
                        <button
                          key={model}
                          className={`cloud-mcp-model-option ${selectedModel === model ? 'active' : ''}`}
                          onClick={() => handleModelChange(model)}
                        >
                          🖥️ {model.replace('ollama:', '')}
                        </button>
                      ))}
                      
                      {availableModels.filter(m => m.startsWith('ollama:')).length === 0 && (
                        <div className="cloud-mcp-model-option-hint">No local models found. Install Ollama to use offline AI.</div>
                      )}
                    </div>
                  )}
                </div>

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

            {!aiReady ? (
              <div className="chat-setup">
                {/* Local Model Setup */}
                {isOllamaSelected ? (
                  <div className="chat-setup-card">
                    <h3>🖥️ Local AI Setup</h3>
                    {ollamaLoading ? (
                      <div className="chat-setup-status">
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <span>Checking Ollama status...</span>
                      </div>
                    ) : ollamaError ? (
                      <div className="chat-setup-error">
                        <p>⚠️ {ollamaError}</p>
                        <button type="button" onClick={refreshAIStatus}>
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
                    ) : !ollamaReady ? (
                      <div className="chat-setup-model">
                        <p>Model <strong>{selectedModel.replace('ollama:', '')}</strong> is not installed.</p>
                        <button
                          type="button"
                          className="chat-setup-action"
                          onClick={() => handlePullModel(selectedModel)}
                          disabled={isPullingModel}
                        >
                          {isPullingModel ? `Pulling ${selectedModel}...` : `Pull ${selectedModel}`}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  /* Cloud Model Setup */
                  <div className="chat-setup-card">
                    <h3>☁️ Gemini Cloud AI</h3>
                    {aiLoading ? (
                      <div className="chat-setup-status">
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <span>Connecting to Gemini...</span>
                      </div>
                    ) : ollamaError ? (
                      <div className="chat-setup-error">
                        <p>⚠️ {ollamaError}</p>
                        <button type="button" onClick={refreshAIStatus}>
                          Retry
                        </button>
                      </div>
                    ) : (
                      <div className="chat-setup-install">
                        <p>Gemini API key not configured.</p>
                        <p className="chat-setup-hint">
                          Add your Google API key in the AI Keys Manager to use cloud models.
                        </p>
                        <div className="chat-setup-buttons">
                          <button
                            type="button"
                            className="chat-setup-action"
                            onClick={refreshAIStatus}
                            disabled={aiLoading}
                          >
                            Check Again
                          </button>
                          <button
                            type="button"
                            className="chat-setup-secondary"
                            onClick={() => {
                              const localModel = availableModels.find(m => m.startsWith('ollama:'));
                              if (localModel) setSelectedModel(localModel);
                            }}
                            disabled={!availableModels.some(m => m.startsWith('ollama:'))}
                          >
                            Use Local AI Instead
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                    disabled={isChatLoading || !aiReady}
                  />
                  <button
                    className="chat-send-button"
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || isChatLoading || !aiReady}
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

