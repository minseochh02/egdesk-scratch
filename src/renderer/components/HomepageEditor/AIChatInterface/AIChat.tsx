/**
 * AI Chat Component
 * Integrated with AI Keys Manager for automatic Gemini configuration
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faKey, 
  faClock, 
  faTrash, 
  faTimes, 
  faHistory, 
  faFolder, 
  faChevronDown,
  faArrowLeft,
  faUndo,
  faRobot,
  faRefresh,
  faRocket,
  faSpinner,
} from '../../../utils/fontAwesomeIcons';
import { AIService } from '../../../services/ai-service';
import { useNavigate } from 'react-router-dom';
import { aiKeysStore } from '../../AIKeysManager/store/aiKeysStore';
import ProjectContextService from '../../../services/projectContextService';
import { aiChatDataService } from '../../../services/ai-chat-data-service';
import type { 
  ConversationMessage, 
  AIResponse, 
  AIStreamEvent, 
  ConversationState,
  ToolDefinition,
  ToolCallRequestInfo,
  ToolCallResponseInfo
} from '../../../../main/types/ai-types';
import { AIEventType } from '../../../../main/types/ai-types';
import type { AIKey } from '../../AIKeysManager/types';
import { BackupManager } from '../BackupManager/BackupManager';
import './AIChat.css';
import { CODING_PORTS } from '../../../../shared/coding-ports';

interface AIChatProps {
  onBackToProjectSelection?: () => void;
}

type DevServerLoadPhase = 'idle' | 'starting-server' | 'compiling' | 'opening-ide' | 'error';

interface DevServerLoadStatus {
  phase: DevServerLoadPhase;
  message: string;
  port?: number;
}

/**
 * Generate natural language message for tool execution
 */
const getToolExecutionMessage = (toolName: string, toolArgs?: any): string => {
  const messages: { [key: string]: string } = {
    'read_file': 'Let me read the file',
    'write_file': 'Let me write to the file',
    'partial_edit': 'Let me edit the file',
    'list_directory': 'Let me check the directory contents',
    'shell_command': 'Let me run a command',
    'analyze_project': 'Let me analyze the project structure',
    'init_project': 'Let me initialize the project',
    'search_files': 'Let me search through the files',
    'create_file': 'Let me create a new file',
    'delete_file': 'Let me delete the file',
    'move_file': 'Let me move the file',
    'copy_file': 'Let me copy the file'
  };

  // Try to get a natural message, fallback to generic
  const naturalMessage = messages[toolName] || `Let me execute ${toolName}`;
  
  // Add context if available
  if (toolArgs) {
    if (toolArgs.path || toolArgs.file_path) {
      const filePath = toolArgs.path || toolArgs.file_path;
      if (toolName === 'partial_edit') {
        // For partial edit, show what's being changed
        const oldString = toolArgs.old_string || toolArgs.oldString;
        const newString = toolArgs.new_string || toolArgs.newString;
        if (oldString && newString) {
          const preview = oldString.length > 50 ? oldString.substring(0, 50) + '...' : oldString;
          return `${naturalMessage}: ${filePath} (replacing "${preview}")`;
        }
      }
      return `${naturalMessage}: ${filePath}`;
    }
    if (toolArgs.command) {
      return `${naturalMessage}: ${toolArgs.command}`;
    }
    if (toolArgs.directory || toolArgs.dir) {
      return `${naturalMessage}: ${toolArgs.directory || toolArgs.dir}`;
    }
  }
  
  return naturalMessage;
};

/**
 * Extract tool name from natural message for status updates
 */
const getToolNameFromMessage = (message: string): string => {
  // Extract the actual tool name from common patterns
  if (message.includes('read the file')) return 'read_file';
  if (message.includes('write to the file')) return 'write_file';
  if (message.includes('edit the file')) return 'partial_edit';
  if (message.includes('check the directory')) return 'list_directory';
  if (message.includes('run a command')) return 'shell_command';
  if (message.includes('analyze the project')) return 'analyze_project';
  if (message.includes('initialize the project')) return 'init_project';
  if (message.includes('search through')) return 'search_files';
  if (message.includes('create a new file')) return 'create_file';
  if (message.includes('delete the file')) return 'delete_file';
  if (message.includes('move the file')) return 'move_file';
  if (message.includes('copy the file')) return 'copy_file';
  
  // Fallback: try to extract from "execute X" pattern
  const executeMatch = message.match(/execute (\w+)/);
  if (executeMatch) {
    return executeMatch[1];
  }
  
  return 'tool';
};

export const AIChat: React.FC<AIChatProps> = ({ onBackToProjectSelection }) => {
  const navigate = useNavigate();
  // Track the preview browser window we open for localhost so we can switch its URL later
  const [previewWindowId, setPreviewWindowId] = useState<number | null>(null);
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [aiKeysState, setAiKeysState] = useState(aiKeysStore.getState());
  const [selectedGoogleKey, setSelectedGoogleKey] = useState<AIKey | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [devServerLoadStatus, setDevServerLoadStatus] = useState<DevServerLoadStatus>({
    phase: 'idle',
    message: '',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Conversation state
  const [conversationState, setConversationState] = useState<ConversationState | null>(null);
  const [streamingEvents, setStreamingEvents] = useState<AIStreamEvent[]>([]);
  const [toolCalls, setToolCalls] = useState<(ToolCallRequestInfo & { status: 'executing' | 'completed' | 'failed'; result?: ToolCallResponseInfo })[]>([]);
  const [isConversationActive, setIsConversationActive] = useState(false);
  
  // Live typing state
  const [isTyping, setIsTyping] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [lastEventType, setLastEventType] = useState<AIEventType | null>(null);
  const [currentTurnNumber, setCurrentTurnNumber] = useState<number | null>(null);
  const [hasCreatedInitialBubble, setHasCreatedInitialBubble] = useState(false);
  
  // Data fetching state
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showConversationList, setShowConversationList] = useState(false);
  const [overallStats, setOverallStats] = useState<any>(null);
  
  const defaultModelId = 'gemini-2.5-flash';
  const [availableModels, setAvailableModels] = useState<string[]>([defaultModelId]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>(defaultModelId);

  // Key and model selector dropdown state
  const [showKeyDropdown, setShowKeyDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const keySelectorRef = useRef<HTMLDivElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const lastConfigurationRef = useRef<{ keyId: string | null; modelId: string } | null>(null);

  // Backup manager state
  const [showBackupManager, setShowBackupManager] = useState(false);

  const googleKeys = useMemo(
    () => aiKeysState.keys.filter((key) => key.providerId === 'google' && key.isActive),
    [aiKeysState.keys]
  );

  // Recently inserted photo previews (keep preview URL and saved file path)
  const [uploadPreviews, setUploadPreviews] = useState<Array<{ previewUrl: string; filePath?: string }>>([]);

  const removeUploadPreview = async (index: number) => {
    const removed = uploadPreviews[index];
    try {
      if (removed?.filePath) {
        await (window as any).electron.photos.removeFromProject(removed.filePath);
      }
    } catch {}
    try { if (removed?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(removed.previewUrl); } catch {}
    setUploadPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Tool confirmation state
  const [pendingToolConfirmation, setPendingToolConfirmation] = useState<{
    requestId: string;
    toolName: string;
    description: string;
    risks: string[];
    parameters: any;
  } | null>(null);

  const configureAI = useCallback(
    async (modelId: string, key?: AIKey | null) => {
      const isLocalModel = modelId.startsWith('ollama:');
      const apiKey = key?.fields?.apiKey || '';

      if (!isLocalModel && !apiKey) {
        console.warn(`Cannot configure remote model "${modelId}" without an active Google AI key.`);
        setIsConfigured(false);
        setConnectionStatus('disconnected');
        lastConfigurationRef.current = null;
        return false;
      }

      setConnectionStatus('checking');

      try {
        const success = await AIService.configure({
          apiKey,
          model: modelId,
        });

        if (success) {
          setIsConfigured(true);
          setConnectionStatus('connected');
          lastConfigurationRef.current = { keyId: key?.id ?? null, modelId };
        } else {
          setIsConfigured(false);
          setConnectionStatus('error');
          lastConfigurationRef.current = null;
        }

        return success;
      } catch (error) {
        console.error('Error configuring AI client:', error);
        setIsConfigured(false);
        setConnectionStatus('error');
        lastConfigurationRef.current = null;
        return false;
      }
    },
    [setConnectionStatus, setIsConfigured],
  );

  const refreshModels = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setModelsLoading(true);
      try {
        const models = await AIService.getAvailableModels();
        const normalized =
          Array.isArray(models) && models.length > 0 ? models : [defaultModelId];
        setAvailableModels(normalized);

        if (!normalized.includes(selectedModelId)) {
          const fallback = normalized.includes(defaultModelId)
            ? defaultModelId
            : normalized[0];
          setSelectedModelId(fallback);

          if (fallback.startsWith('ollama:')) {
            await configureAI(fallback, selectedGoogleKey);
          } else if (selectedGoogleKey) {
            await configureAI(fallback, selectedGoogleKey);
          } else {
            setIsConfigured(false);
            setConnectionStatus('disconnected');
          }
        } else if (selectedModelId.startsWith('ollama:') && lastConfigurationRef.current?.modelId !== selectedModelId) {
          await configureAI(selectedModelId, selectedGoogleKey);
        }
      } catch (error) {
        console.error('Error fetching available models:', error);
      } finally {
        if (showSpinner) setModelsLoading(false);
      }
    },
    [configureAI, selectedGoogleKey, selectedModelId],
  );

  const formatModelName = useCallback((modelId: string) => {
    if (modelId.startsWith('ollama:')) {
      return `Local • ${modelId.replace('ollama:', '')}`;
    }
    const friendlyNames: Record<string, string> = {
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'gemini-1.5-flash-latest': 'Gemini 1.5 Flash (Latest)',
      'gemini-1.5-pro-latest': 'Gemini 1.5 Pro (Latest)',
      'gemini-1.0-pro': 'Gemini 1.0 Pro',
    };
    return friendlyNames[modelId] || modelId;
  }, []);

  const toggleModelDropdown = () => {
    setShowModelDropdown((prev) => !prev);
  };

  const handleModelSelection = (modelId: string) => {
    setSelectedModelId(modelId);
    setShowModelDropdown(false);
    configureAI(modelId, selectedGoogleKey);
  };

  const selectedModelIsLocal = useMemo(
    () => selectedModelId.startsWith('ollama:'),
    [selectedModelId],
  );

  const assistantDisplayName = useMemo(
    () => (selectedModelIsLocal ? '🤖 Gemma (Local)' : '🤖 Gemini'),
    [selectedModelIsLocal],
  );

  // Quick undo (Ctrl/Cmd+Z) to revert last backup for current conversation
  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      const isUndo = (e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey;
      if (!isUndo) return;
      try {
        e.preventDefault();
        let targetConversationId = currentConversationId;
        // Fallback to most recent conversation if no active one
        if (!targetConversationId) {
          // Prefer backup list to ensure we pick a conversation that has backups
          try {
            const backupsResult = await (window as any).electron.backup.getAvailableBackups();
            const backups = Array.isArray(backupsResult)
              ? backupsResult
              : (backupsResult?.backups || []);
            if (Array.isArray(backups) && backups.length > 0) {
              // Assume backups are returned newest-first; otherwise sort by timestamp desc
              const sorted = backups.slice().sort((a: any, b: any) => {
                const ta = new Date(a.timestamp || a.createdAt || 0).getTime();
                const tb = new Date(b.timestamp || b.createdAt || 0).getTime();
                return tb - ta;
              });
              targetConversationId = sorted[0].conversationId || sorted[0].id;
            }
          } catch {}
          // Fallback: use latest conversation if backups call yields nothing
          if (!targetConversationId) {
            targetConversationId = conversations?.[0]?.id || null as any;
            if (!targetConversationId) {
              try {
                const latest = await aiChatDataService.getConversations({ limit: 1, activeOnly: false });
                if (Array.isArray(latest) && latest.length > 0) {
                  targetConversationId = latest[0].id;
                }
              } catch {}
            }
          }
        }
        if (!targetConversationId) {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'No conversation history found to revert.' }], timestamp: new Date() }]);
          return;
        }
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `↩️ Reverting last change for conversation ${String(targetConversationId).slice(0,8)}...` }], timestamp: new Date() }]);
        const result = await (window as any).electron.backup.revertConversation(targetConversationId);
        if (result?.success) {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: `✅ Reverted last change for conversation ${String(targetConversationId).slice(0,8)}.` }], timestamp: new Date() }]);
          // Refresh localhost windows to reflect file changes
          await refreshBrowser();
          try {
            // Clear AI in-memory conversation context so it doesn't assume reverted changes still exist
            await (window as any).electron.ai.clearHistory();
            // Also clear UI message history to reflect reset
            setMessages([]);
          } catch {}
        } else {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: `❌ Revert failed: ${result?.error || 'Unknown error'}` }], timestamp: new Date() }]);
        }
      } catch (err) {
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `❌ Revert error: ${err instanceof Error ? err.message : String(err)}` }], timestamp: new Date() }]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentConversationId]);

  // Refresh localhost browser windows
  const refreshBrowser = async () => {
    try {
      const electronAny = (window as any).electron;
      const projectPath = currentProject?.path;
      if (!projectPath) return;

      const statusResult = await electronAny.ipcRenderer.invoke('dev-server:get-status', projectPath);
      const port = statusResult?.serverInfo?.port || CODING_PORTS.dev.preferred;
      const serverUrl = statusResult?.serverInfo?.url || `http://localhost:${port}`;

      if (statusResult?.serverInfo?.status === 'running') {
        try {
          await electronAny.ipcRenderer.invoke('dev-server:stop', projectPath);
        } catch (e) {
          console.warn('Failed to stop server before restart:', e);
        }
      }

      try {
        await electronAny.ipcRenderer.invoke('dev-server:start', projectPath, 'dev');
        // Give the server a brief moment to bind the port
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        console.warn('Failed to start server during refreshBrowser:', e);
      }

      // Switch preview window back to localhost site before refreshing, so URLFileViewer isn't refreshed
      try {
        if (serverUrl) {
          if (previewWindowId != null) {
            await electronAny.browserWindow.switchURL(serverUrl, previewWindowId);
          } else {
            await electronAny.browserWindow.switchURL(serverUrl);
          }
        }
      } catch (e) {
        console.warn('Failed to switch preview window back to localhost URL:', e);
      }

      // Refresh all localhost windows so the change is picked up
      try {
        await electronAny.browserWindow.refreshAllLocalhost();
      } catch (e) {
        console.warn('Failed to refresh localhost browser windows:', e);
      }
    } catch (error) {
      console.error('Failed to refresh browser after stream finished:', error);
    }
  };

  // Effect to update the last message with currentMessage content
  useEffect(() => {
    if (currentMessage && isTyping) {
      setMessages(prev => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage && lastMessage.role === 'model' && !lastMessage.toolCallId) {
          updated[updated.length - 1] = {
            ...lastMessage,
            parts: [{ text: currentMessage }]
          };
        }
        return updated;
      });
    }
  }, [currentMessage, isTyping]);

  useEffect(() => {
    // Subscribe to AI keys store changes
    const unsubscribe = aiKeysStore.subscribe(setAiKeysState);
    checkConfiguration();
    // Don't load history automatically - start with blank state
    // loadHistory();
    loadConversations();
    loadOverallStats();
    
    // Subscribe to project context changes
    const unsubscribeProject = ProjectContextService.getInstance().subscribe((context) => {
      setCurrentProject(context.currentProject);
      // Send project context to main process (always send, even if null)
      window.electron.projectContext.updateContext(context);
    });

    // Also send initial project context immediately on component mount
    const initialContext = ProjectContextService.getInstance().getContext();
    if (initialContext.currentProject) {
      window.electron.projectContext.updateContext(initialContext);
      setCurrentProject(initialContext.currentProject);
      // Note: initial preview opening is handled by the project change effect below
    }
    
    return () => {
      unsubscribe();
      unsubscribeProject();
    };
  }, []);

  // On mount, try to capture existing localhost window URL (if any)
  useEffect(() => {
    (async () => {
      try {
        const electronAny = (window as any).electron;
        const list = await electronAny.browserWindow.getAllLocalhostWindows();
        if (list?.success && Array.isArray(list.windows) && list.windows.length > 0) {
          const first = list.windows[0];
          if (previewWindowId == null) setPreviewWindowId(first.windowId);
          if (first.url) setCurrentPreviewUrl(first.url);
        }
      } catch {}
    })();
  }, []);

  // Listen for URL changes on the preview window to keep current URL/path
  useEffect(() => {
    try {
      const electronAny = (window as any).electron;
      if (previewWindowId != null && electronAny?.browserWindow?.onUrlChanged) {
        const off = electronAny.browserWindow.onUrlChanged(previewWindowId, (url: string) => {
          setCurrentPreviewUrl(url);
        });
        return () => {
          try { off && off(); } catch {}
        };
      }
    } catch {}
  }, [previewWindowId]);

  

  // Auto-start server and open preview window when project changes
  useEffect(() => {
    if (currentProject?.path) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let cancelled = false;

      setDevServerLoadStatus({ phase: 'starting-server', message: 'Preparing project…' });

      timer = setTimeout(() => {
        if (!cancelled) {
          openProjectInAntigravity();
        }
      }, 500);

      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }

    setDevServerLoadStatus({ phase: 'idle', message: '' });
  }, [currentProject?.path]);

  // (Viewer init moved out of AIChat; AIChat only deep-links the preview window)

  useEffect(() => {
    if (googleKeys.length === 0) {
      if (selectedGoogleKey !== null) {
        setSelectedGoogleKey(null);
      }
      if (selectedModelId.startsWith('ollama:')) {
        configureAI(selectedModelId, null);
      } else {
        setIsConfigured(false);
        setConnectionStatus('disconnected');
      }
      return;
    }

    if (!selectedGoogleKey || !googleKeys.some((key) => key.id === selectedGoogleKey.id)) {
      const nextKey = googleKeys[0];
      setSelectedGoogleKey(nextKey);
      configureAI(selectedModelId, nextKey);
    }
  }, [configureAI, googleKeys, selectedGoogleKey, selectedModelId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    refreshModels();
    const interval = setInterval(() => refreshModels(false), 60000);
    return () => clearInterval(interval);
  }, [refreshModels]);

  // Click outside handler for key dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (keySelectorRef.current && !keySelectorRef.current.contains(event.target as Node)) {
        setShowKeyDropdown(false);
      }
    };

    if (showKeyDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showKeyDropdown]);

  // Click outside handler for model dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };

    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModelDropdown]);

  const checkConfiguration = async () => {
    setConnectionStatus('checking');
    const configured = await AIService.isConfigured();
    setIsConfigured(configured);
    setConnectionStatus(configured ? 'connected' : 'disconnected');
  };

  const loadHistory = async () => {
    try {
      const history = await AIService.getHistory();
      setMessages(history);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const loadConversationsForProject = async (projectPath?: string) => {
    try {
      const convs = await aiChatDataService.getConversations({ 
        limit: 20, 
        activeOnly: false,
        projectContext: projectPath
      });
      setConversations(convs);

      // Don't auto-select conversations - let user choose
      // Just update the conversation list without loading messages
      setCurrentConversationId(null);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const convs = await aiChatDataService.getConversations({ limit: 20, activeOnly: true });
      setConversations(convs);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadOverallStats = async () => {
    try {
      const stats = await aiChatDataService.getOverallStats();
      setOverallStats(stats);
    } catch (error) {
      console.error('Error loading overall stats:', error);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const result = await aiChatDataService.getConversationWithMessages(conversationId);
      if (result) {
        const conversationMessages = result.messages.map(msg => 
          aiChatDataService.aiMessageToConversationMessage(msg)
        );
        setMessages(conversationMessages);
        setCurrentConversationId(conversationId);
      }
    } catch (error) {
      console.error('Error loading conversation messages:', error);
    }
  };

  const handleKeySelection = (key: AIKey) => {
    setSelectedGoogleKey(key);
    configureAI(selectedModelId, key);
    setShowKeyDropdown(false); // Close dropdown after selection
  };

  const toggleKeyDropdown = () => {
    setShowKeyDropdown(!showKeyDropdown);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Heuristic extractor for file paths from tool call responses/args
  const extractFilePathsFromToolArtifacts = (response: any, toolCallEvent?: any): string[] => {
    const collect = new Set<string>();

    const pushPath = (p: any) => {
      if (!p || typeof p !== 'string') return;
      const trimmed = p.trim();
      if (!trimmed) return;
      collect.add(trimmed);
    };

    const pushMany = (arr: any) => {
      if (!arr) return;
      if (Array.isArray(arr)) arr.forEach(pushPath);
      else if (typeof arr === 'string') arr.split('|').forEach(pushPath);
    };

    // Common shapes on response
    try {
      pushMany(response?.files);
      pushMany(response?.data?.files);
      pushMany(response?.result?.files);
      pushPath(response?.path);
      pushPath(response?.filePath);
      pushPath(response?.data?.path);
      pushPath(response?.result?.path);
    } catch {}

    // Also inspect tool call arguments if present
    try {
      const args = toolCallEvent?.toolCall?.arguments || toolCallEvent?.arguments;
      pushMany(args?.files);
      pushPath(args?.path);
      pushPath(args?.filePath);
    } catch {}

    return Array.from(collect);
  };

  const openProjectInAntigravity = async () => {
    const projectPath = currentProject?.path;
    if (!projectPath) return;

    try {
      const electronAny = (window as any).electron;

      setDevServerLoadStatus({ phase: 'starting-server', message: 'Waiting for dev server port…' });

      let port = CODING_PORTS.dev.preferred;
      let mode: 'dev' | 'production' = 'dev';
      let url = `http://localhost:${port}`;

      for (let attempt = 0; attempt < 20; attempt++) {
        const statusResult = await electronAny.ipcRenderer.invoke('dev-server:get-status', projectPath);
        const info = statusResult?.serverInfo;

        if (info?.port) {
          port = info.port;
          mode = info.mode === 'production' ? 'production' : 'dev';
          url = info.url || `http://localhost:${port}`;
          break;
        }

        await new Promise((r) => setTimeout(r, 500));
      }

      setDevServerLoadStatus({
        phase: 'opening-ide',
        message: `Opening Antigravity (dev port ${port})…`,
        port,
      });

      const openResult = await electronAny.ipcRenderer.invoke('coding:open-antigravity', {
        folderPath: projectPath,
        port,
        mode,
        url,
        projectName: currentProject?.name,
      });

      if (!openResult?.success) {
        if (openResult?.needsInstall) {
          await electronAny.ipcRenderer.invoke('coding:open-antigravity-install');
        }
        setDevServerLoadStatus({
          phase: 'error',
          message: openResult?.error || 'Failed to open Antigravity. Click the project name to retry.',
          port,
        });
        return;
      }

      setDevServerLoadStatus({
        phase: 'compiling',
        message: openResult?.egdeskChatActivated
          ? `Antigravity opened — select "egdesk-chat" under ${currentProject?.name ?? 'your project'} for dev context (port ${port})`
          : openResult?.egdeskChatNeedsActivation
            ? `Antigravity opened — under "${currentProject?.name ?? 'your project'}", click "egdesk-chat" and send any message (dev context is in AGENTS.md, port ${port})`
            : `Antigravity opened (port ${port})`,
        port,
      });

      for (let attempt = 0; attempt < 90; attempt++) {
        const statusResult = await electronAny.ipcRenderer.invoke('dev-server:get-status', projectPath);

        if (!statusResult.success) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        const info = statusResult.serverInfo;
        if (!info) {
          setDevServerLoadStatus({
            phase: 'compiling',
            message: `Starting dev server on port ${port}…`,
            port,
          });
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        if (info.status === 'running') {
          setDevServerLoadStatus({ phase: 'idle', message: '' });
          return;
        }

        if (info.status === 'starting') {
          setDevServerLoadStatus({
            phase: 'compiling',
            message: `Next.js compiling on port ${info.port ?? port}…`,
            port: info.port ?? port,
          });
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        if (info.status === 'error' || info.status === 'stopped') {
          setDevServerLoadStatus({
            phase: 'error',
            message: 'Dev server failed to start. Antigravity is open — fix errors there and retry.',
            port: info.port ?? port,
          });
          return;
        }

        await new Promise((r) => setTimeout(r, 1000));
      }

      setDevServerLoadStatus({
        phase: 'error',
        message: 'Dev server timed out. Antigravity is open — start the server manually if needed.',
        port,
      });
    } catch (err) {
      console.error('Failed to open project in Antigravity:', err);
      setDevServerLoadStatus({
        phase: 'error',
        message: 'Failed to open Antigravity. Click the project name to retry.',
      });
    }
  };


  const openHostedWebsiteFiles = async (filesToOpen?: string[]) => {
    try {
      if (!currentProject?.path) return;
      const base = currentProject.path as string;
      const fallbackCandidates = [
        `${base}/index.php`,
        `${base}/wp-config.php`,
        `${base}/index.html`,
        `${base}/readme.md`,
      ];
      const filesParam = (filesToOpen && filesToOpen.length > 0)
        ? filesToOpen
        : fallbackCandidates;
      // Deep-link preview window into URLFileViewer via query params (HashRouter-friendly)
      const filesEncoded = encodeURIComponent(filesParam.join('|'));
      const href = window.location.href;
      // Ensure we end up with file:///.../index.html#/viewer?... which works in packaged Windows builds
      let baseNoHash = href.split('#')[0];
      // If the base doesn't end with index.html, append it
      if (!/index\.html$/i.test(baseNoHash)) {
        if (!baseNoHash.endsWith('/')) baseNoHash += '/';
        baseNoHash += 'index.html';
      }
      const appViewerUrl = `${baseNoHash}#/viewer?viewer=url&files=${filesEncoded}`;
      const electronAny = (window as any).electron;
      setCurrentPreviewUrl(appViewerUrl);
      if (previewWindowId != null) {
        await electronAny.browserWindow.switchURL(appViewerUrl, previewWindowId);
      } else {
        await electronAny.browserWindow.switchURL(appViewerUrl);
      }
    } catch (err) {
      console.error('Failed to open hosted website files:', err);
    }
  };

  const getCurrentPathFromPreview = (): string => {
    try {
      if (!currentPreviewUrl) return '/';
      const isLocal = currentPreviewUrl.includes('localhost') || currentPreviewUrl.includes('127.0.0.1');
      if (!isLocal) return '/';
      const u = new URL(currentPreviewUrl);
      return u.pathname || '/';
    } catch {
      return '/';
    }
  };
  
  const handlePushToHosting = async () => {
    if (!currentProject?.path) return;
    
    const confirmPush = window.confirm(`Are you sure you want to push ${currentProject.name} to hosting? This will stop the dev server and start the production server.`);
    if (!confirmPush) return;

    try {
      const electronAny = (window as any).electron;
      
      // 1. Stop the dev server (4000-series)
      await electronAny.ipcRenderer.invoke('dev-server:stop', currentProject.path);
      
      // 2. Start in production mode (port 3000-series)
      const startResult = await electronAny.ipcRenderer.invoke('dev-server:start', currentProject.path, 'production');
      
      if (startResult.success) {
        // 3. Update hosting status in context
        ProjectContextService.getInstance().updateHostingStatus(currentProject.id, true);
        
        // 4. Navigate to hosting page
        navigate('/hosting');
      } else {
        alert(`Failed to start hosting: ${startResult.error}`);
      }
    } catch (error) {
      console.error('Error pushing to hosting:', error);
      alert('An error occurred while pushing to hosting.');
    }
  };

  /**
   * Handle sending message in autonomous mode
   */
  const handleSendAutonomous = async () => {
    if (!inputMessage.trim() || isLoading || !isConfigured) return;

    const userMessage: ConversationMessage = {
      role: 'user',
      parts: [{ text: inputMessage.trim() }],
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setIsConversationActive(true);

    await handleAutonomousConversation(messageToSend);
  };

  /**
   * NEW: Handle autonomous conversation with tool execution
   */
  const handleAutonomousConversation = async (message: string) => {
    try {
      console.log('🎯 Starting autonomous conversation with:', message);
      setStreamingEvents([]);
      setToolCalls([]);
      setHasCreatedInitialBubble(false); // Reset for new conversation

      // Add a loading indicator message immediately
      setMessages(prev => [...prev, {
        role: 'model' as const,
        parts: [{ text: '🔄 Starting autonomous conversation...' }],
        timestamp: new Date()
      }]);

      // Start autonomous conversation
      console.log('📞 Calling AIService.streamConversation...');
      
      // Build attached files context from uploaded images
      const attachedFiles = uploadPreviews.map(entry => ({
        filePath: entry.filePath
      }));
      
      console.log('🌐 Route debug (autonomous mode):', {
        currentUrl: currentPreviewUrl || null,
        currentPath: getCurrentPathFromPreview(),
        projectPath: currentProject?.path || null,
        attachedFiles: attachedFiles.length,
        attachedFilePaths: attachedFiles.map(f => f.filePath)
      });
      
      console.log('📎 Context with attached files:', {
        currentProject: currentProject?.name,
        projectPath: currentProject?.path,
        currentUrl: currentPreviewUrl || null,
        currentPath: getCurrentPathFromPreview(),
        attachedFiles: attachedFiles.map(f => f.filePath)
      });
      for await (const event of AIService.streamConversation(message, {
        autoExecuteTools: true,
        maxTurns: 10, // Increased from 5 to allow more complex conversations
        timeoutMs: 300000, // 5 minutes - increased from 1 minute
        context: {
          // Project context
          currentProject: currentProject?.name,
          projectPath: currentProject?.path,
          // Navigation context
          currentUrl: currentPreviewUrl || null,
          currentPath: getCurrentPathFromPreview(),
          // Attached files context - uploaded images with their file paths
          attachedFiles: attachedFiles // Array of { filePath: string }
        }
      })) {
        console.log('🎉 Received stream event in AIChat:', event.type, event);
        console.log('🎉 Event details:', JSON.stringify(event, null, 2));
        setStreamingEvents(prev => [...prev, event]);
        
        switch (event.type) {
          case AIEventType.Content:
            // Build the message by appending content
            const contentEvent = event as any;
            console.log('✍️ Processing content event:', contentEvent);
            
            const newContent = contentEvent.content || contentEvent.data || '';
            console.log('✍️ New content to append:', JSON.stringify(newContent), 'length:', newContent.length);
            
            if (newContent) {
              // Just append to currentMessage - bubble already created by TurnStarted
              setCurrentMessage(prev => {
                const updated = prev + newContent;
                return updated;
              });
            } else {
              console.log('✍️ No content to append');
            }
            break;

          case AIEventType.ToolCallRequest:
            const toolCallEvent = event as any;
            const toolCall = toolCallEvent.toolCall;
            
            // Add a natural message for tool execution
            const toolMessage = getToolExecutionMessage(toolCall.name, toolCall.arguments);
            setLastEventType(AIEventType.ToolCallRequest);
            setMessages(prev => {
              const filteredPrev = prev.filter(msg => 
                !(msg.role === 'model' && msg.parts[0]?.text?.includes('🔄 Starting autonomous conversation'))
              );
              return [...filteredPrev, {
                role: 'model' as const,
                parts: [{ text: toolMessage }],
                timestamp: new Date(),
                toolCallId: toolCall.id,
                toolStatus: 'executing'
              }];
            });
            
            setToolCalls(prev => [...prev, {
              ...toolCallEvent.toolCall,
              status: 'executing'
            }]);
            break;

          case AIEventType.ToolCallResponse:
            const toolResponseEvent = event as any;
            const response = toolResponseEvent.response;
            
            // Update the tool message with completion status
            setLastEventType(AIEventType.ToolCallResponse);
            setMessages(prev => prev.map(msg => {
              if (msg.toolCallId === response.id) {
                const statusText = response.success ? 'success!' : 'failed!';
                const statusIcon = response.success ? '✅' : '❌';
                const originalText = msg.parts[0]?.text || '';
                const toolName = getToolNameFromMessage(originalText);
                
                return {
                  ...msg,
                  parts: [{ text: `${originalText}\n${toolName}: ${statusIcon} ${statusText}` }],
                  toolStatus: response.success ? 'completed' : 'failed'
                };
              }
              return msg;
            }));
            
            setToolCalls(prev => prev.map(call => 
              call.id === toolResponseEvent.response.id 
                ? { ...call, status: toolResponseEvent.response.success ? 'completed' : 'failed', result: toolResponseEvent.response }
                : call
            ));

            // Auto-switch to URL File Viewer when tool call completes, pass files if available
            if (response.success && currentProject?.path) {
              const filesFromArtifacts = extractFilePathsFromToolArtifacts(response, toolResponseEvent);
              setTimeout(() => {
                openHostedWebsiteFiles(filesFromArtifacts);
              }, 500); // Small delay to let the UI update
            }
            break;

          case AIEventType.Thought:
            const thoughtEvent = event as any;
            setLastEventType(AIEventType.Thought);
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: `💭 **${thoughtEvent.thought.subject}**: ${thoughtEvent.thought.description}` }],
              timestamp: new Date()
            }]);
            break;

          case AIEventType.Error:
            const errorEvent = event as any;
            setLastEventType(AIEventType.Error);
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: `❌ Error: ${errorEvent.error.message}` }],
              timestamp: new Date()
            }]);
            break;

          case AIEventType.LoopDetected:
            const loopEvent = event as any;
            setLastEventType(AIEventType.LoopDetected);
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: `🔄 Loop detected: ${loopEvent.pattern}. Stopping conversation to prevent infinite loop.` }],
              timestamp: new Date()
            }]);
            break;

          case AIEventType.Finished:
            console.log('🏁 Autonomous conversation completed');
            
            // Ensure isTyping is false as final guarantee
            setIsTyping(false);
            
            // Final cleanup of entire session
            console.log('🏁 Final cleanup - conversation stream ended');
            // Restart server and refresh browser to pick up file changes
            await refreshBrowser();
            
            break;

          case AIEventType.TurnStarted:
            const turnEvent = event as any;
            console.log(`📬 Turn ${turnEvent.turnNumber} started`);
            
            // Remove any loading messages
            setMessages(prev => prev.filter(msg =>
              !(msg.role === 'model' && msg.parts[0]?.text?.includes('🔄 Starting autonomous conversation'))
            ));
            
            // Create a new, empty message bubble in UI
            setMessages(prev => [...prev, {
              role: 'model' as const,
              parts: [{ text: '' }],
              timestamp: new Date()
            }]);
            
            // Set isTyping to true to show user something is happening
            setIsTyping(true);
            
            // Clear currentMessage to start fresh
            setCurrentMessage('');
            
            // Reset bubble creation flag for this turn
            setHasCreatedInitialBubble(true);
            
            // Update turn state
            setCurrentTurnNumber(turnEvent.turnNumber);
            setLastEventType(AIEventType.TurnStarted);
            break;

          case AIEventType.TurnCompleted:
            const turnCompletedEvent = event as any;
            console.log(`✅ Turn ${turnCompletedEvent.turnNumber} completed`);
            
            // Set isTyping to false - typing indicator can now be hidden
            setIsTyping(false);
            
            // Final cleanup for this specific message bubble
            // The message is now fully delivered
            console.log('✅ Message fully delivered, final content:', currentMessage);
            
            setLastEventType(AIEventType.TurnCompleted);
            break;

          default:
            // Handle any unrecognized event types
            console.log('🔍 Unhandled event type:', (event as any).type, event);
            
            // Check if this might be a content event with a different structure
            const unknownEvent = event as any;
            if (unknownEvent.content || unknownEvent.data || unknownEvent.text) {
              console.log('📝 Treating unknown event as content:', unknownEvent);
              setMessages(prev => {
                // Remove any loading messages first
                const filteredPrev = prev.filter(msg => 
                  !(msg.role === 'model' && msg.parts[0]?.text?.includes('🔄 Starting autonomous conversation'))
                );
                
                return [...filteredPrev, {
                  role: 'model' as const,
                  parts: [{ text: unknownEvent.content || unknownEvent.data || unknownEvent.text || `Unknown event: ${JSON.stringify(unknownEvent)}` }],
                  timestamp: new Date()
                }];
              });
            }
            break;
        }
      }
    } catch (error) {
      console.error('Error in autonomous conversation:', error);
      setMessages(prev => [...prev, {
        role: 'model' as const,
        parts: [{ 
          text: `❌ **Autonomous Conversation Error**\n\n${error instanceof Error ? error.message : 'Unknown error in autonomous conversation'}\n\n💡 *Check your connection and try again.*` 
        }],
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      setIsConversationActive(false);
    }
  };


  const handleNewConversation = () => {
    setMessages([]);
    setStreamingEvents([]);
    setToolCalls([]);
    setCurrentConversationId(null);
    setShowConversationList(false);
  };

  const handleClearHistory = async () => {
    try {
      await AIService.clearHistory();
      setMessages([]);
      setStreamingEvents([]);
      setToolCalls([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const handleCancelConversation = async () => {
    try {
      await AIService.cancelConversation();
      setIsConversationActive(false);
      setIsLoading(false);
      
      // Stop any ongoing typing
      setIsTyping(false);
      setCurrentMessage('');
      
      setMessages(prev => [...prev, {
        role: 'model' as const,
        parts: [{ text: '⏹️ Conversation cancelled by user.' }],
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error cancelling conversation:', error);
    }
  };

  const handleToolConfirmation = async (approved: boolean) => {
    if (!pendingToolConfirmation) return;

    try {
      const result = await (window.electron.aiService as any).confirmTool(
        pendingToolConfirmation.requestId, 
        approved
      );
      
      if (result) {
        // Add result message to chat
        const statusText = result.success ? 'completed successfully' : 'failed';
        const statusIcon = result.success ? '✅' : '❌';
        
        setMessages(prev => [...prev, {
          role: 'model' as const,
          parts: [{ 
            text: `🔧 Tool ${pendingToolConfirmation.toolName}: ${statusIcon} ${statusText}${result.error ? `\nError: ${result.error}` : ''}` 
          }],
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error confirming tool:', error);
      setMessages(prev => [...prev, {
        role: 'model' as const,
        parts: [{ text: `❌ Error confirming tool: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        timestamp: new Date()
      }]);
    } finally {
      setPendingToolConfirmation(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendAutonomous();
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'checking': return '🔄';
      case 'connected': return '🟢';
      case 'disconnected': return '🔴';
      case 'error': return '❌';
      default: return '🔴';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'checking':
        return 'Checking connection...';
      case 'connected':
        return selectedModelId.startsWith('ollama:')
          ? `Local model ready: ${selectedModelId.replace('ollama:', '')}`
          : `Connected with ${selectedGoogleKey?.name || 'Google AI'} (${formatModelName(selectedModelId)})`;
      case 'disconnected':
        return selectedModelId.startsWith('ollama:')
          ? 'Local model available (no API key required)'
          : 'No Google AI key available';
      case 'error': return 'Connection error';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="ai-chat" onDragOver={(e) => { e.preventDefault(); }} onDrop={async (e) => {
      try {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length === 0) return;
        const file = files[0];
        if (!currentProject?.path) {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'No project selected. Cannot insert photo.' }], timestamp: new Date() }]);
          return;
        }
        // Prefer buffer-based insert to avoid sandboxed path issues
        const arrayBuffer = await file.arrayBuffer();
        // Use original filename
        const destinationFileName = file.name || 'image';
        const result = await (window as any).electron.photos.insertIntoProjectFromBuffer(arrayBuffer, currentProject.path, destinationFileName);
        // Create an object URL from the dropped file bytes for immediate preview
        const blob = new Blob([arrayBuffer], { type: (file as any).type || 'application/octet-stream' });
        const objectUrl = URL.createObjectURL(blob);
        if (result?.success) {
          const normalizedPath = String(result.destinationPath || '').replace(/\\\\/g, '/');
          setUploadPreviews((prev) => ([{ previewUrl: objectUrl, filePath: normalizedPath }, ...prev].slice(0, 6)));
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: `📷 Photo inserted: ${normalizedPath}`, imageUrl: objectUrl } as any], timestamp: new Date() }]);
        } else {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: `❌ Failed to insert photo: ${result?.error || 'Unknown error'}` }], timestamp: new Date() }]);
        }
      } catch (err) {
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `❌ Error inserting photo: ${err instanceof Error ? err.message : String(err)}` }], timestamp: new Date() }]);
      }
    }}>
      <div className="ai-chat-header">
        <div className="header-top">
          <div className="header-row-primary">
            {onBackToProjectSelection && (
              <button
                className="back-btn"
                onClick={onBackToProjectSelection}
                title="Back to project selection"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
              </button>
            )}
            <div className="project-selector">
              <div className="project-info">
                <FontAwesomeIcon icon={faFolder} className="homepage-editor-project-icon" />
                <span
                  className="homepage-editor-project-name"
                  onClick={openProjectInAntigravity}
                  title={currentProject ? 'Open in Antigravity' : undefined}
                  style={{ cursor: currentProject ? 'pointer' as const : 'default' as const }}
                >
                  {currentProject ? currentProject.name : 'No project'}
                </span>
              </div>
            </div>
          </div>

          <div className="header-row-toolbar">
            <div className="model-selector" ref={modelSelectorRef}>
              <div className="model-info" onClick={toggleModelDropdown} title={formatModelName(selectedModelId)}>
                <FontAwesomeIcon icon={faRobot} />
                <span className="model-name">
                  {formatModelName(selectedModelId)}
                </span>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`homepage-editor-dropdown-icon ${showModelDropdown ? 'open' : ''}`}
                />
              </div>
              {showModelDropdown && (
                <div className="model-dropdown">
                  <div className="model-dropdown-header">
                    <span>Models</span>
                    <button
                      type="button"
                      className="model-refresh-btn"
                      onClick={() => refreshModels()}
                      disabled={modelsLoading}
                    >
                      <FontAwesomeIcon icon={faRefresh} spin={modelsLoading} />
                    </button>
                  </div>
                  <div className="model-options">
                    {availableModels.map((model) => (
                      <div
                        key={model}
                        className={`model-option ${selectedModelId === model ? 'selected' : ''}`}
                        onClick={() => handleModelSelection(model)}
                      >
                        <span className="model-option-name">{formatModelName(model)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="header-actions">
              <button
                className="new-conversation-btn"
                onClick={handleNewConversation}
                title="New Chat"
              >
                <FontAwesomeIcon icon={faHistory} />
              </button>

              <button
                className="push-to-hosting-btn"
                onClick={handlePushToHosting}
                title="Push to Hosting"
              >
                <FontAwesomeIcon icon={faRocket} />
              </button>

              <button
                className="conversations-btn"
                onClick={() => setShowConversationList(!showConversationList)}
                title="History"
              >
                <FontAwesomeIcon icon={faClock} />
              </button>

              <button
                className="backup-btn"
                onClick={() => setShowBackupManager(true)}
                title="Backups"
              >
                <FontAwesomeIcon icon={faUndo} />
              </button>

              <button
                className="clear-btn"
                onClick={handleClearHistory}
                disabled={messages.length === 0 || isConversationActive}
                title="Clear"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>

              {isConversationActive && (
                <button
                  className="cancel-btn"
                  onClick={handleCancelConversation}
                  title="Stop generation"
                >
                  <FontAwesomeIcon icon={faStop} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Conversation List */}
      {showConversationList && (
        <div className="conversation-list">
          <div className="conversation-list-header">
            <h4>📚 Conversation History</h4>
            <button 
              className="close-btn" 
              onClick={() => setShowConversationList(false)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          <div className="conversation-stats">
            {overallStats && (
              <div className="stats-summary">
                <span>Total: {overallStats.totalConversations}</span>
                <span>Active: {overallStats.activeConversations}</span>
                <span>Messages: {overallStats.totalMessages}</span>
                <span>Size: {overallStats.databaseSize}MB</span>
              </div>
            )}
          </div>
          <div className="conversation-items">
            {conversations.length === 0 ? (
              <div className="no-conversations">
                <p>No conversations found</p>
                <button onClick={loadConversations}>Refresh</button>
              </div>
            ) : (
              conversations.map((conv) => (
                <div 
                  key={conv.id} 
                  className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
                  onClick={() => loadConversationMessages(conv.id)}
                >
                  <div className="conversation-title">{conv.title || 'Untitled Conversation'}</div>
                  <div className="conversation-meta">
                    <span className="conversation-date">
                      {new Date(conv.updated_at).toLocaleDateString()}
                    </span>
                    <span className={`conversation-status ${conv.is_active ? 'active' : 'archived'}`}>
                      {conv.is_active ? 'Active' : 'Archived'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}


      {/* Messages */}
      <div className="messages-container">
          {devServerLoadStatus.phase !== 'idle' && (
            <div className={`dev-server-loading dev-server-loading--${devServerLoadStatus.phase}`}>
              <div className="dev-server-loading-icon">
                {devServerLoadStatus.phase === 'error' ? (
                  <span aria-hidden>⚠️</span>
                ) : (
                  <FontAwesomeIcon icon={faSpinner} spin />
                )}
              </div>
              <div className="dev-server-loading-text">
                <strong>
                  {devServerLoadStatus.phase === 'starting-server' && 'Starting dev server'}
                  {devServerLoadStatus.phase === 'compiling' && 'Compiling project'}
                  {devServerLoadStatus.phase === 'opening-ide' && 'Opening Antigravity'}
                  {devServerLoadStatus.phase === 'error' && 'Setup issue'}
                </strong>
                <span>{devServerLoadStatus.message}</span>
                {devServerLoadStatus.port != null && devServerLoadStatus.phase !== 'error' && (
                  <span className="dev-server-loading-port">Port {devServerLoadStatus.port}</span>
                )}
              </div>
            </div>
          )}
          {messages.length === 0 && devServerLoadStatus.phase === 'idle' ? (
            <div className="welcome-message">
              <p>👋 Welcome to the AI Assistant!</p>
              <p>🤖 <strong>Start a new conversation</strong> by typing your message below.</p>
              <p>📚 Use the <strong>History</strong> button to view past conversations.</p>
              {!isConfigured && (
                <p className="config-hint">⚠️ Configure your Google AI key first to begin chatting.</p>
              )}
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                const isToolMessage = message.role === 'tool' || message.toolCallId;
                
                return (
                  <div key={index} className={`message ${message.role} ${isToolMessage ? 'tool-message' : ''} ${message.toolStatus ? `tool-${message.toolStatus}` : ''}`}>
                    <div className="message-header">
                      <span className="role">
                        {message.role === 'user' ? '👤 You' : 
                         message.role === 'tool' || isToolMessage ? '🔧 Tool' : assistantDisplayName}
                      </span>
                      <span className="timestamp">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                      {message.toolStatus && (
                        <span className={`tool-status-badge ${message.toolStatus}`}>
                          {message.toolStatus === 'executing' ? '⏳' : message.toolStatus === 'completed' ? '✅' : '❌'}
                        </span>
                      )}
                    </div>
                    <div className="message-content">
                      {message.parts.map((part, partIndex) => {
                        const anyPart: any = part as any;
                        return (
                          <div key={partIndex}>
                            {part.text && <pre className="message-text">{part.text}</pre>}
                            {anyPart.imageUrl && (
                              <img src={anyPart.imageUrl} alt="uploaded" className="chat-image-preview" />
                            )}
                          </div>
                        );
                      })}
                      {isTyping && message.role === 'model' && message === messages[messages.length - 1] && (
                        <span className="typing-indicator">▋</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="input-container">
        {uploadPreviews.length > 0 && (
          <div className="upload-previews">
            {uploadPreviews.map((entry, i) => (
              <div key={i} className="upload-thumb-wrap">
                <img src={entry.previewUrl} className="upload-thumb" alt="preview" />
                <button type="button" className="upload-thumb-remove" onClick={() => removeUploadPreview(i)} aria-label="Remove image">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="input-wrapper">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              !isConfigured 
                ? "Configure Google AI key first..." 
                : "Type your message..."
            }
            disabled={!isConfigured || isLoading}
            rows={1}
          />
          <button 
            onClick={handleSendAutonomous}
            disabled={!inputMessage.trim() || isLoading || !isConfigured}
            className="send-btn"
            title={isLoading ? 'Sending...' : 'Send message'}
          >
            <FontAwesomeIcon icon={isLoading ? faRefresh : faRocket} spin={isLoading} />
          </button>
        </div>
      </div>

      {/* Backup Manager */}
      <BackupManager
        isVisible={showBackupManager}
        onClose={() => setShowBackupManager(false)}
        onBackupReverted={async () => {
          // Clear AI in-memory conversation context after revert via Backup Manager
          try {
            await (window as any).electron.ai.clearHistory();
            setMessages([]);
          } catch {}
          // Refresh conversations list
          loadConversations();
        }}
      />

      {/* Tool Confirmation Modal */}
      {pendingToolConfirmation && (
        <div className="tool-confirmation-modal">
          <div className="tool-confirmation-content">
            <div className="tool-confirmation-header">
              <h3>🔧 Tool Confirmation Required</h3>
              <button 
                className="close-btn" 
                onClick={() => setPendingToolConfirmation(null)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="tool-confirmation-body">
              <div className="tool-info">
                <strong>Tool:</strong> {pendingToolConfirmation.toolName}
              </div>
              <div className="tool-description">
                <strong>Description:</strong> {pendingToolConfirmation.description}
              </div>
              {pendingToolConfirmation.risks.length > 0 && (
                <div className="tool-risks">
                  <strong>Risks:</strong>
                  <ul>
                    {pendingToolConfirmation.risks.map((risk, index) => (
                      <li key={index}>{risk}</li>
                    ))}
                  </ul>
                </div>
              )}
              {pendingToolConfirmation.toolName === 'partial_edit' && (
                <div className="tool-preview">
                  <strong>Preview:</strong>
                  <div className="edit-preview">
                    <div className="old-string">
                      <strong>Replace:</strong>
                      <pre>{pendingToolConfirmation.parameters.old_string || pendingToolConfirmation.parameters.oldString}</pre>
                    </div>
                    <div className="new-string">
                      <strong>With:</strong>
                      <pre>{pendingToolConfirmation.parameters.new_string || pendingToolConfirmation.parameters.newString}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="tool-confirmation-actions">
              <button 
                className="approve-btn"
                onClick={() => handleToolConfirmation(true)}
              >
                ✅ Approve & Execute
              </button>
              <button 
                className="deny-btn"
                onClick={() => handleToolConfirmation(false)}
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};