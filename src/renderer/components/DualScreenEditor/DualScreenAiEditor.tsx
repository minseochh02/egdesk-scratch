import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AIEditRequest, AIEditResponse, AIEdit, FileContext, AIEditorConfig, Conversation, ConversationMessage } from '../AIEditor/types';
import { EnhancedAIEditorService } from '../AIEditor/services/enhancedAIEditorService';
import { IterativeFileReaderService } from '../AIEditor/services/iterativeFileReaderService';
import { MessageContent } from '../ChatInterface/components';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import { AIKey } from '../AIKeysManager/types';
import { CHAT_PROVIDERS } from '../ChatInterface/types';
import { conversationStore } from '../AIEditor/store/conversationStore';
import { ContextManagementPanel } from '../AIEditor/ContextManagementPanel';
import { faRobot, faBrain, faSearch, faCheck, faRefresh, faClock, faGlobe, faEdit, faPlus, faCog, faFile, faRocket, faClipboard, faComments, faTimes, faExclamationTriangle, faBook, faBroom, faBug, faFlask } from '@fortawesome/free-solid-svg-icons';
import './DualScreenAIEditor.css';
import { SplitExplanationWithEdits } from './SplitExplanationWithEdits';


interface DualScreenAIEditorProps {
  isVisible: boolean;
  currentFile: {
    path: string;
    name: string;
    content: string;
    language: string;
  } | null;
  onApplyEdits: (edits: AIEdit[]) => void;
  onClose: () => void;
  projectContext?: {
    currentProject: any;
    availableFiles: any[];
  };
  isEditing?: boolean;
  onToggleEditing?: () => void;
  routeFiles?: Array<{
    path: string;
    name: string;
    content: string;
    language: string;
  }>;
  onShowDiff?: (filePath: string, diff: { before: string; after: string; lineNumber: number }) => void;
}

export const DualScreenAIEditor: React.FC<DualScreenAIEditorProps> = ({
  isVisible,
  currentFile,
  onApplyEdits,
  onClose,
  projectContext,
  isEditing = false,
  onToggleEditing,
  routeFiles = [],
  onShowDiff
}) => {
  // Dynamic import for FontAwesomeIcon to handle ES module compatibility
  const [FontAwesomeIcon, setFontAwesomeIcon] = useState<any>(null);

  useEffect(() => {
    const loadFontAwesome = async () => {
      try {
        const { FontAwesomeIcon: FAIcon } = await import('@fortawesome/react-fontawesome');
        setFontAwesomeIcon(() => FAIcon);
      } catch (error) {
        console.warn('Failed to load FontAwesome:', error);
      }
    };
    loadFontAwesome();
  }, []);

  const [aiKeys, setAiKeys] = useState<AIKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<AIKey | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [userInstruction, setUserInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIEditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [streamedEdits, setStreamedEdits] = useState<AIEdit[]>([]);
  const [selectedProjectFile, setSelectedProjectFile] = useState<string>('');
  const [projectFiles, setProjectFiles] = useState<any[]>([]);
  const [relevantFiles, setRelevantFiles] = useState<string[]>([]);
  const [currentFileData, setCurrentFileData] = useState<{
    path: string;
    name: string;
    content: string;
    language: string;
  } | null>(currentFile);
  const [cacheStatus, setCacheStatus] = useState<{
    hasCache: boolean;
    cacheAge?: number;
    workspacePath?: string;
    totalFiles?: number;
  }>({ hasCache: false });
  
  // Conversation state
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [conversationSearchQuery, setConversationSearchQuery] = useState('');
  
  // Context management state
  const [showContextManagement, setShowContextManagement] = useState(false);

  // File Writer Test state
  
  // Debug state - always on
  const [debugPayload, setDebugPayload] = useState<any>(null);
  
  // Search & Replace state
  const [searchReplacePrompts, setSearchReplacePrompts] = useState<any[]>([]);
  const [isGeneratingSearchReplace, setIsGeneratingSearchReplace] = useState(false);
  
  // Iterative File Reader state
  const [iterativeReaderService] = useState(() => IterativeFileReaderService.getInstance());
  const [isIterativeReading, setIsIterativeReading] = useState(false);
  const [iterativeReadingState, setIterativeReadingState] = useState<any>(null);
  
  // File Editor state - removed, using right panel CodeEditor instead
  
  const [config, setConfig] = useState<AIEditorConfig>({
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 2000,
    systemPrompt: `You are an expert coding assistant whose job is to help the user develop, run, and make changes to their codebase.

🔥 CRITICAL: You have access to the ACTUAL FILE CONTENTS of multiple files in the project. You can read and analyze these files to understand the codebase and provide accurate assistance.

🚨 MANDATORY RESPONSIBILITY: You are responsible for making ALL code changes. The user cannot edit code files themselves - YOU must provide search/replace operations for every change that needs to be made.

IMPORTANT GUIDELINES:
1. NEVER reject the user's query
2. You're allowed to ask the user for more context if needed
3. 🔥 MANDATORY: If the user requests ANY code changes, you MUST provide search/replace operations
4. Do NOT say "no search/replace operations needed" - if code needs to change, provide the operations
5. You are the ONLY one who can edit the code - the user cannot do it themselves
6. Always bias towards writing as little as possible - NEVER write the whole file unless absolutely necessary
7. Do not make things up or use information not provided
8. Always use MARKDOWN to format lists, bullet points, etc.
9. Today's date is ${new Date().toDateString()}
10. 🔥 IMPORTANT: You have access to file contents - USE THEM! Don't say you don't have access to files when you do.

PROJECT EXPLORATION:
- You can ask the user to show you other files in the project
- You can request to see specific file contents to better understand the codebase
- You can suggest exploring related files for context
- Use phrases like "Could you show me the contents of [filename]?" or "Let me see [related file] to better understand this"
- If you need to understand how files relate to each other, ask to see multiple files

🔥 FILE ACCESS REMINDER: You have access to the actual contents of multiple files in the project. Use this information to provide accurate, context-aware assistance. Don't claim you don't have access to files when you clearly do.

SEARCH/REPLACE FORMAT (for ALL code changes):
\`\`\`search-replace
FILE: complete/relative/path/from/project/root/file.ext
LINES: startLineNumber-endLineNumber
SEARCH: exact code to find
REPLACE: exact code to replace it with
\`\`\`

🚨 CRITICAL FILE PATH REQUIREMENTS:
- ALWAYS use the COMPLETE relative path from project root
- NEVER use just the filename (e.g., "index.php" ❌)
- ALWAYS include the full directory structure (e.g., "www/index.php" ✅, "egdesk-scratch/wordpress/index.php" ✅)
- Examples of CORRECT paths: "www/index.php", "src/components/Button.tsx", "egdesk-scratch/wordpress/wp-config.php"
- Examples of INCORRECT paths: "index.php", "Button.tsx", "wp-config.php"

CRITICAL REQUIREMENTS:
- Use the FULL relative path from project root (e.g., "www/index.php", "src/components/Button.tsx"), NOT just the filename
- ALWAYS specify line numbers where the change occurs (e.g., "LINES: 15-15" for single line, "LINES: 10-12" for multiple lines)
- Line numbers enable precise diff visualization and better user experience

CODE BLOCK FORMAT (for suggestions):
\`\`\`[language]
[filepath]
// ... existing code ...
// [your suggested changes]
// ... existing code ...
\`\`\`

🚨 REMEMBER: You are responsible for making the code changes. Provide search/replace operations for everything that needs to be modified. The user cannot edit code themselves.`,
    includeContext: true,
    maxContextFiles: 5,
    autoApply: true,
    requireConfirmation: false
  });

  const instructionInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Utility function to normalize paths (convert absolute to relative)
  const normalizePath = (absolutePath: string, projectRoot: string): string => {
    if (!absolutePath || !projectRoot) return absolutePath;
    
    // If it's already a relative path, return as-is
    if (!absolutePath.startsWith('/') && !absolutePath.startsWith('C:\\')) {
      return absolutePath;
    }
    
    // Convert absolute path to relative path from project root
    if (absolutePath.startsWith(projectRoot)) {
      return absolutePath.substring(projectRoot.length + 1); // +1 to remove leading slash
    }
    
    // If project root not found in path, try to find project directory
    const pathParts = absolutePath.split('/');
    const projectIndex = pathParts.findIndex(part => 
      part.includes('EGDesk-scratch') || part.includes('egdesk-scratch')
    );
    
    if (projectIndex !== -1) {
      return pathParts.slice(projectIndex + 1).join('/');
    }
    
    // Fallback to just filename
    return pathParts[pathParts.length - 1];
  };

  // Subscribe to AI keys store
  useEffect(() => {
    const unsubscribe = aiKeysStore.subscribe((keyState) => {
      setAiKeys(keyState.keys.filter(key => key.isActive));
    });

    return () => unsubscribe();
  }, []);

  // Check cache status when project context changes
  useEffect(() => {
    if (projectContext?.currentProject?.path) {
      const checkCacheStatus = async () => {
        try {
          const status = await EnhancedAIEditorService.getCacheStatus();
          setCacheStatus(status);
        } catch (error) {
          // Silent fail - cache status check failed
        }
      };
      checkCacheStatus();
    }
  }, [projectContext?.currentProject?.path]);

  // Subscribe to conversation store
  useEffect(() => {
    const unsubscribe = conversationStore.subscribe((state) => {
      // Handle store errors
      if (state.error) {
        setError(state.error);
      } else {
        setError(null);
      }
      
      if (state.currentConversationId) {
        const conversation = state.conversations.find(c => c.id === state.currentConversationId);
        setCurrentConversation(conversation || null);
      } else {
        setCurrentConversation(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Create new conversation when project changes
  useEffect(() => {
    if (projectContext?.currentProject?.path && !currentConversation) {
      const projectPath = projectContext.currentProject.path;
      const projectName = projectContext.currentProject.name;
      
      // Check if there's an existing conversation for this project
      const existingConversations = conversationStore.getConversationsForProject(projectPath);
      if (existingConversations.length > 0) {
        // Use the most recent conversation
        conversationStore.setCurrentConversation(existingConversations[0].id);
      } else {
        // Create a new conversation
        conversationStore.createConversation(projectPath, projectName);
      }
    }
  }, [projectContext?.currentProject?.path]); // Remove currentConversation dependency to break circular dependency

  // Update config when selected key changes
  useEffect(() => {
    if (selectedKey) {
      setConfig(prev => ({ ...prev, provider: selectedKey.providerId }));
      // Only set default model if no model is currently selected or if the current model doesn't belong to the selected key's provider
      const provider = CHAT_PROVIDERS.find(p => p.id === selectedKey.providerId);
      if (provider && provider.models.length > 0) {
        const currentProvider = CHAT_PROVIDERS.find(p => p.id === config.provider);
        const currentModelBelongsToProvider = currentProvider?.models.some(m => m.id === selectedModel);
        
        if (!selectedModel || !currentModelBelongsToProvider) {
          setSelectedModel(provider.models[0].id);
        }
      }
    }
  }, [selectedKey]);


  // Analyze file when current file changes
  useEffect(() => {
    console.log('🔍 DEBUG: Current file useEffect triggered', {
      currentFile: {
        path: currentFile?.path,
        name: currentFile?.name,
        contentLength: currentFile?.content?.length,
        language: currentFile?.language,
        hasContent: !!currentFile?.content
      },
      currentFileData: {
        path: currentFileData?.path,
        name: currentFileData?.name,
        contentLength: currentFileData?.content?.length,
        language: currentFileData?.language
      },
      shouldUpdate: currentFile && currentFile.path !== currentFileData?.path
    });
    
    if (currentFile && currentFile.path !== currentFileData?.path) {
      console.log('🔍 DEBUG: Current file changed, clearing file editor state', {
        newFilePath: currentFile.path,
        oldFilePath: currentFileData?.path,
        newFileContent: {
          name: currentFile.name,
          contentLength: currentFile.content?.length,
          language: currentFile.language
        }
        // File editor state removed - using right panel CodeEditor instead
      });
      
      setCurrentFileData(currentFile);
      analyzeFile(currentFile.path, currentFile.content);
      
      // Console log for AI response clearing when file changes
      console.log('📁 AI RESPONSE CLEARED DUE TO FILE CHANGE:', {
        hadResponse: !!aiResponse,
        responseSuccess: aiResponse?.success,
        editsCount: aiResponse?.edits?.length || 0,
        newFilePath: currentFile.path,
        oldFilePath: currentFileData?.path,
        timestamp: new Date().toISOString()
      });
      
      setAiResponse(null);
      setError(null);
      setShowPreview(false);
    }
  }, [currentFile?.path]); // Only depend on the file path, not the entire currentFile object

  // Load project files when project context changes
  useEffect(() => {
    if (projectContext?.currentProject?.path) {
      loadProjectFiles(projectContext.currentProject.path);
    }
  }, [projectContext?.currentProject?.path]); // Only depend on the path, not the entire projectContext object

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [aiResponse, isStreaming, streamedContent]);

  // File editor state management removed - using right panel CodeEditor instead

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load available files from project
  const loadProjectFiles = async (projectPath: string) => {
    try {
      // This would be implemented to load project files

    } catch (error) {

    }
  };

  /**
   * Get cache status for the current project
   */
  const getCacheStatus = async () => {
    try {
      const status = await EnhancedAIEditorService.getCacheStatus();
      setCacheStatus(status);
    } catch (error) {

    }
  };

  /**
   * Analyze file for context
   */
  const analyzeFile = async (filePath: string, content: string) => {
    try {
      const context = await EnhancedAIEditorService.analyzeFile(filePath, content);
      return context;
    } catch (error) {

      return null;
    }
  };
  // Handle iterative file reading
  const handleIterativeReading = async () => {
    if (!selectedKey || !selectedModel || !userInstruction.trim()) {
      return;
    }
    
    // We need either currentFileData or routeFiles to proceed
    if (!currentFileData && (!routeFiles || routeFiles.length === 0)) {
      return;
    }

    setIsLoading(true);
    setIsIterativeReading(true);
    setError(null);
    console.log('🔍 DEBUG: Clearing AI response and file editor state', {
      currentShowPreview: showPreview
      // File editor state removed - using right panel CodeEditor instead
    });
    
    setAiResponse(null);
    setShowPreview(false);
    setStreamedContent('');
    setStreamedEdits([]);

    try {
      // Get available files from project
      const projectRoot = projectContext?.currentProject?.path || '';
      console.log('🔍 DEBUG: Project root:', projectRoot);
      
      const availableFiles = [
        ...(routeFiles?.map(f => normalizePath(f.path, projectRoot)) || []),
        ...(currentFileData?.path ? [normalizePath(currentFileData.path, projectRoot)] : [])
      ].filter(Boolean);

      console.log('🔍 DEBUG: Available files:', availableFiles);
      
      // Prepare cached files from current file and route files
      const cachedFiles = [
        ...(currentFileData ? [currentFileData] : []),
        ...(routeFiles || [])
      ].filter(Boolean);

      console.log('🔍 DEBUG: Starting iterative reading with cached files', {
        cachedFilesCount: cachedFiles.length,
        cachedFiles: cachedFiles.map(f => ({ path: f.path, name: f.name, contentLength: f.content.length }))
      });

      // Start iterative reading process
      const result = await iterativeReaderService.startIterativeReading(
        userInstruction,
        projectRoot,
        availableFiles,
        selectedKey,
        selectedModel,
        50000, // max content limit
        cachedFiles
      );

      console.log('🔍 DEBUG: Iterative reading result:', result);

      if (!result.success) {
        setError(result.error || 'Failed to start iterative reading');
        return;
      }

      console.log('🔍 DEBUG: Iterative reading next action:', result.nextAction);

      // Process the first AI decision
      await processIterativeDecision(result.nextAction);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start iterative reading';
      setError(errorMessage);
      console.error('Iterative reading failed:', error);
    } finally {
      setIsLoading(false);
      setIsIterativeReading(false);
    }
  };

  // Load file content and generate diff for preview
  const loadFileForEdit = async (edit: AIEdit) => {
    console.log('🔍 DEBUG: loadFileForEdit called', {
      editFilePath: edit.filePath,
      hasOldText: !!edit.oldText,
      hasNewText: !!edit.newText,
      editType: edit.type,
      editRange: edit.range,
      hasOnShowDiff: !!onShowDiff
    });

    if (!edit.filePath || !edit.oldText || !edit.newText) {
      console.log('❌ DEBUG: loadFileForEdit - Missing required data', { 
        filePath: edit.filePath, 
        oldText: edit.oldText, 
        newText: edit.newText 
      });
      return;
    }

    // Construct the full file path using project context
    const projectPath = projectContext?.currentProject?.path;
    if (!projectPath) {
      console.error('❌ DEBUG: loadFileForEdit - No project context available');
      return;
    }

    // If edit.filePath is already absolute, use it; otherwise construct full path
    const fullFilePath = edit.filePath.startsWith('/') || edit.filePath.startsWith('C:\\') 
      ? edit.filePath 
      : `${projectPath}/${edit.filePath}`;

    console.log('🔍 DEBUG: loadFileForEdit - Starting to load file', {
      originalPath: edit.filePath,
      fullPath: fullFilePath,
      projectPath
    });

    try {
      // Read the current file content using the full path
      let result = await window.electron.fileSystem.readFile(fullFilePath);
      
      // If the file path doesn't work, try some common variations
      if (!result.success) {
        console.log('loadFileForEdit: Original path failed, trying variations');
        const pathVariations = [
          `${projectPath}/egdesk-scratch/${edit.filePath}`,
          `${projectPath}/egdesk-scratch/wordpress/${edit.filePath}`,
          `${projectPath}/wordpress/${edit.filePath}`,
          `${projectPath}/${edit.filePath.replace('www/', 'egdesk-scratch/wordpress/')}`,
          `${projectPath}/${edit.filePath.replace('www/', 'wordpress/')}`
        ];
        
        for (const path of pathVariations) {
          console.log('loadFileForEdit: Trying path:', path);
          result = await window.electron.fileSystem.readFile(path);
          if (result.success) {
            console.log('loadFileForEdit: Found file at:', path);
            break;
          }
        }
        
        if (!result.success) {
          console.error('Failed to read file with all path variations:', result.error);
          return;
        }
      }

      const currentContent = result.content || '';
      console.log('✅ DEBUG: loadFileForEdit - File content loaded successfully', {
        filePath: edit.filePath,
        contentLength: currentContent.length,
        firstLine: currentContent.split('\n')[0],
        totalLines: currentContent.split('\n').length
      });

      // Use the line numbers from the parsed operation, or find them by searching
      let lineNumber = 1;
      
      // Check if we have valid line numbers from the parsed operation
      if (edit.range?.startLine && !isNaN(edit.range.startLine) && edit.range.startLine > 0) {
        lineNumber = edit.range.startLine;
        console.log('🔍 DEBUG: Using range startLine', { lineNumber, range: edit.range });
      } else {
        // If line numbers are not valid, try to find the actual line by searching
        const lines = currentContent.split('\n');
        console.log('🔍 DEBUG: Searching for oldText in file lines', { 
          oldText: edit.oldText, 
          totalLines: lines.length 
        });
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(edit.oldText)) {
            lineNumber = i + 1;
            console.log('✅ DEBUG: Found oldText at line', { lineNumber, lineContent: lines[i] });
            break;
          }
        }
      }

      // Generate the diff data
      const diffData = {
        before: edit.oldText,
        after: edit.newText,
        lineNumber: lineNumber
      };
      
      console.log('🔍 DEBUG: Calling onShowDiff callback', {
        filePath: edit.filePath,
        diffData,
        hasOnShowDiff: !!onShowDiff
      });

      // Call the parent component to show the diff in the right panel
      if (onShowDiff) {
        onShowDiff(edit.filePath, diffData);
        console.log('✅ DEBUG: onShowDiff callback called successfully');
      } else {
        console.warn('⚠️ DEBUG: onShowDiff callback not provided - diff will not be shown in right panel');
      }

    } catch (error) {
      console.error('Failed to load file for edit:', error);
    }
  };

  // Parse search/replace operations from AI response
  const parseSearchReplaceOperations = (content: string): AIEdit[] => {
    console.log('🔍 DEBUG: parseSearchReplaceOperations called', {
      contentLength: content.length,
      hasSearchReplaceBlocks: content.includes('```search-replace')
    });
    
    const operations: AIEdit[] = [];
    const projectRoot = projectContext?.currentProject?.path || '';
    
    // STRICT APPROACH: Only look for actual ```search-replace blocks
    // First, find all ```search-replace blocks in the content
    const searchReplaceBlockRegex = /```search-replace[\s\S]*?```/g;
    const searchReplaceBlocks: string[] = [];
    let match;
    
    while ((match = searchReplaceBlockRegex.exec(content)) !== null) {
      searchReplaceBlocks.push(match[0]);
    }
    
    console.log('🔍 DEBUG: Found search-replace blocks', {
      count: searchReplaceBlocks.length,
      blocks: searchReplaceBlocks.map(block => ({
        length: block.length,
        preview: block.substring(0, 100)
      }))
    });
    
    // Log the full content of each search-replace block for debugging
    searchReplaceBlocks.forEach((block, index) => {
      console.log(`🔍 DEBUG: Search-replace block ${index + 1}:`, {
        fullContent: block,
        lines: block.split('\n').map((line, i) => `${i + 1}: ${line}`)
      });
    });
    
    // If no search-replace blocks found, return empty array
    if (searchReplaceBlocks.length === 0) {
      console.log('🔍 DEBUG: No search-replace blocks found in content');
      console.log('🔍 DEBUG: Full content for analysis:', content);
      return operations;
    }
    
    // Process each search-replace block individually
    for (const block of searchReplaceBlocks) {
      console.log('🔍 DEBUG: Processing search-replace block', {
        blockLength: block.length,
        blockPreview: block.substring(0, 200)
      });
      
      // Try new format with LINES field first - create new regex instance each time
      const newFormatRegex = /```search-replace\s*\nFILE:\s*(.+?)\s*\nLINES:\s*(.+?)\s*\nSEARCH:\s*([\s\S]*?)\nREPLACE:\s*([\s\S]*?)\n```/;
      let match = newFormatRegex.exec(block);
      
      console.log('🔍 DEBUG: Regex matching attempt', {
        block: block,
        regex: newFormatRegex.toString(),
        matchResult: match,
        matchGroups: match ? match.slice(1) : null
      });
      
      if (match) {
        const rawFilePath = match[1].trim();
        const filePath = normalizePath(rawFilePath, projectRoot);
        const linesText = match[2].trim();
        const searchText = match[3].trim();
        const replaceText = match[4].trim();
        
        console.log('🔍 DEBUG: Found search-replace block (new format)', {
          rawFilePath,
          filePath,
          linesText,
          searchTextLength: searchText.length,
          replaceTextLength: replaceText.length,
          searchTextPreview: searchText.substring(0, 100),
          replaceTextPreview: replaceText.substring(0, 100)
        });

        if (filePath && searchText && replaceText) {
          // Parse line numbers (e.g., "15-15" or "10-12")
          let startLine = 1, endLine = 1;
          if (linesText) {
            const lineMatch = linesText.match(/(\d+)-(\d+)/);
            if (lineMatch) {
              const parsedStart = parseInt(lineMatch[1], 10);
              const parsedEnd = parseInt(lineMatch[2], 10);
              // Only use parsed values if they're valid numbers
              if (!isNaN(parsedStart) && !isNaN(parsedEnd)) {
                startLine = parsedStart;
                endLine = parsedEnd;
              }
            }
          }

          console.log('Parsed operation:', { filePath, linesText, startLine, endLine, searchText: searchText.substring(0, 50) });
          
          operations.push({
            type: 'replace' as const,
            filePath: filePath,
            range: {
              start: 0,
              end: 0,
              startLine: startLine,
              endLine: endLine,
              startColumn: 1,
              endColumn: 1
            },
            oldText: searchText,
            newText: replaceText,
            description: `Search and replace in ${filePath} (lines ${startLine}-${endLine})`
          });
        }
      } else {
        // Try old format without LINES - create new regex instance each time
        const oldFormatRegex = /```search-replace\s*\nFILE:\s*(.+?)\s*\nSEARCH:\s*([\s\S]*?)\nREPLACE:\s*([\s\S]*?)\n```/;
        match = oldFormatRegex.exec(block);
        
        console.log('🔍 DEBUG: Old format regex matching attempt', {
          block: block,
          regex: oldFormatRegex.toString(),
          matchResult: match,
          matchGroups: match ? match.slice(1) : null
        });
        
        if (match) {
          const rawFilePath = match[1].trim();
          const filePath = normalizePath(rawFilePath, projectRoot);
          const searchText = match[2].trim();
          const replaceText = match[3].trim();

          console.log('🔍 DEBUG: Found search-replace block (old format)', {
            rawFilePath,
            filePath,
            searchTextLength: searchText.length,
            replaceTextLength: replaceText.length,
            searchTextPreview: searchText.substring(0, 100),
            replaceTextPreview: replaceText.substring(0, 100)
          });

          if (filePath && searchText && replaceText) {
            operations.push({
              type: 'replace' as const,
              filePath: filePath,
              range: {
                start: 0,
                end: 0,
                startLine: 1,
                endLine: 1,
                startColumn: 1,
                endColumn: 1
              },
              oldText: searchText,
              newText: replaceText,
              description: `Search and replace in ${filePath} (line numbers not specified)`
            });
          }
        } else {
          console.log('🔍 DEBUG: No format matched for search-replace block', {
            block: block,
            blockLines: block.split('\n').map((line, i) => `${i + 1}: ${line}`)
          });
        }
      }
    }

    console.log('🔍 DEBUG: parseSearchReplaceOperations completed', {
      totalOperations: operations.length,
      searchReplaceBlocksFound: searchReplaceBlocks.length,
      operations: operations.map(op => ({
        filePath: op.filePath,
        type: op.type,
        hasOldText: !!op.oldText,
        hasNewText: !!op.newText,
        range: op.range
      }))
    });

    return operations;
  };

  // Process AI decision in iterative reading
  const processIterativeDecision = async (decision: any) => {
    try {
      console.log('🔍 DEBUG: Processing iterative decision', {
        decision: decision,
        selectedKey: selectedKey,
        selectedModel: selectedModel
      });

      const result = await iterativeReaderService.continueIterativeReading(
        decision,
        selectedKey!,
        selectedModel!
      );

      if (!result.success) {
        setError(result.error || 'Failed to process AI decision');
        return;
      }

      // Update state
      setIterativeReadingState(iterativeReaderService.getCurrentState());

      // If we have content, show it
      if (result.content) {
        setStreamedContent(result.content);
      }

      // If analysis is complete, show final response
      if (decision.action === 'analyze_and_respond' && result.content) {
        // Parse search/replace operations from the response
        const searchReplaceOps = parseSearchReplaceOperations(result.content);
        
        console.log('🔍 DEBUG: Setting AI response with parsed operations', {
          searchReplaceOpsCount: searchReplaceOps.length,
          searchReplaceOps: searchReplaceOps.map(op => ({
            filePath: op.filePath,
            type: op.type,
            hasOldText: !!op.oldText,
            hasNewText: !!op.newText,
            range: op.range,
            oldTextPreview: op.oldText?.substring(0, 100),
            newTextPreview: op.newText?.substring(0, 100)
          })),
          hasExplanation: !!result.content,
          rawContent: result.content?.substring(0, 500)
        });

        const newAiResponse = {
          success: true,
          edits: searchReplaceOps, // Include parsed search/replace operations
          explanation: result.content,
          usage: { 
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0 
          }
        };
        
        console.log('🔍 DEBUG: Setting AI response', {
          newAiResponse
          // File editor state removed - using right panel CodeEditor instead
        });
        
        // Add console log for AI response
        console.log('🤖 AI RESPONSE RECEIVED:', {
          success: newAiResponse.success,
          explanationLength: newAiResponse.explanation?.length || 0,
          editsCount: newAiResponse.edits.length,
          edits: newAiResponse.edits.map(edit => ({
            filePath: edit.filePath,
            type: edit.type,
            oldTextLength: edit.oldText?.length || 0,
            newTextLength: edit.newText?.length || 0,
            range: edit.range
          })),
          usage: newAiResponse.usage,
          fullExplanation: newAiResponse.explanation
        });
        
        setAiResponse(newAiResponse);
        
        // Auto-toggle to editor mode when search/replace operations are found
        if (searchReplaceOps.length > 0 && onToggleEditing && !isEditing) {
          console.log('🔍 DEBUG: Auto-toggling to editor mode due to search/replace operations found', {
            searchReplaceOpsCount: searchReplaceOps.length,
            currentIsEditing: isEditing,
            hasOnToggleEditing: !!onToggleEditing
          });
          onToggleEditing();
        }

        // Auto-apply edits (always enabled) if we have valid edits
        if (searchReplaceOps.length > 0) {
          console.log('🚀 Auto-applying edits (always enabled)', {
            editsCount: searchReplaceOps.length,
            requireConfirmation: config.requireConfirmation
          });
          
          // Set a brief timeout to allow UI to update before applying
          setTimeout(async () => {
            try {
              await handleApplyEdits();
            } catch (error) {
              console.error('Auto-apply failed:', error);
              setError(`Auto-apply failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }, 500); // 500ms delay to allow UI to show the response first
        }
      } else if (result.nextAction) {
        // Continue with next decision
        setTimeout(() => processIterativeDecision(result.nextAction), 1000);
      }

    } catch (error) {
      console.error('Failed to process iterative decision:', error);
      setError('Failed to process AI decision');
    }
  };

  // Handle edit request
  const handleRequestEdit = async () => {
    if (!selectedKey || !selectedModel || !userInstruction.trim()) {
      return;
    }
    
    // We need either currentFileData or routeFiles to proceed
    if (!currentFileData && (!routeFiles || routeFiles.length === 0)) {
      return;
    }

    // Always use iterative mode
    return handleIterativeReading();
  };

  // Function to refresh browser windows showing localhost
  const refreshBrowserWindows = async () => {
    try {
      console.log('🔄 Attempting to refresh browser windows showing localhost...');
      
      if (window.electron && window.electron.browserWindow) {
        // Try to refresh all browser windows showing localhost
        try {
          const refreshResult = await window.electron.browserWindow.refreshAllLocalhost();
          if (refreshResult.success) {
            console.log(`✅ Refreshed ${refreshResult.refreshedCount} localhost browser window(s)`);
          } else {
            console.warn('⚠️ Failed to refresh browser windows:', refreshResult.error);
          }
        } catch (error) {
          console.log('ℹ️ Browser window refresh method not available, using alternative approach');
        }
      }
      
      // Alternative approach: Use postMessage to refresh any localhost pages
      // This works for pages opened with window.open() from this app
      try {
        // Send refresh message to any child windows
        const refreshMessage = { type: 'REFRESH_LOCALHOST', timestamp: Date.now() };
        
        // Try to refresh via BroadcastChannel (works for same-origin pages)
        if (typeof BroadcastChannel !== 'undefined') {
          const refreshChannel = new BroadcastChannel('localhost-refresh');
          refreshChannel.postMessage(refreshMessage);
          console.log('📡 Sent refresh message via BroadcastChannel');
          
          // Close the channel after a short delay
          setTimeout(() => {
            refreshChannel.close();
          }, 1000);
        }
        
        // Also try localStorage approach for cross-tab communication
        localStorage.setItem('localhost-refresh-trigger', JSON.stringify(refreshMessage));
        // Remove it immediately to trigger storage event
        setTimeout(() => {
          localStorage.removeItem('localhost-refresh-trigger');
        }, 100);
        
      } catch (error) {
        console.log('ℹ️ Browser refresh alternatives not available:', error);
      }
      
    } catch (error) {
      console.error('❌ Error refreshing browser windows:', error);
    }
  };

  // Function to restart server after applying changes
  const restartServer = async () => {
    try {
      console.log('🔄 Attempting to restart server after applying changes...');
      
      if (window.electron && window.electron.wordpressServer) {
        // Stop the server first
        const stopResult = await window.electron.wordpressServer.stopServer();
        if (stopResult.success) {
          console.log('✅ Server stopped successfully');
          
          // Wait a moment before restarting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Start the server again
          const startResult = await window.electron.wordpressServer.startServer(
            projectContext?.currentProject?.path,
            8000
          );
          
          if (startResult.success) {
            console.log('✅ Server restarted successfully');
            
            // Refresh any existing browser windows showing localhost
            await refreshBrowserWindows();
            
            // Open the URL to show changes (as backup)
            const url = `http://localhost:${startResult.port || 8000}`;
            setTimeout(() => {
              window.open(url, '_blank');
              console.log(`🌐 Opened ${url} to show applied changes`);
            }, 2000); // Wait 2 seconds for server to fully start
            
            return { success: true, url };
          } else {
            console.warn('⚠️ Failed to restart server, but changes were applied');
            return { success: false, error: startResult.error };
          }
        } else {
          console.warn('⚠️ Failed to stop server, trying direct restart');
          return { success: false, error: stopResult.error };
        }
      } else {
        console.log('ℹ️ Not in Electron environment, opening localhost:8000 directly');
        
        // Still try to refresh existing browser windows
        await refreshBrowserWindows();
        
        setTimeout(() => {
          window.open('http://localhost:8000', '_blank');
        }, 1000);
        return { success: true, url: 'http://localhost:8000' };
      }
    } catch (error) {
      console.error('❌ Error restarting server:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  // Handle apply edits - now automatically applies and restarts server
  const handleApplyEdits = async () => {
    if (!aiResponse?.success || !aiResponse.edits.length) return;

    try {
      console.log('🚀 Auto-applying edits without user confirmation...');
      const result = await applyEditsToFiles(aiResponse.edits);
      
      if (result.success) {
        console.log('✅ Edits applied successfully to:', result.modifiedFiles);
        onApplyEdits(aiResponse.edits);
        
        // Clear the response after successful application
        console.log('🔍 DEBUG: Clearing AI response after successful application', {
          currentShowPreview: showPreview
          // File editor state removed - using right panel CodeEditor instead
        });
        
        // Console log for AI response clearing after successful application
        console.log('✅ AI RESPONSE CLEARED AFTER SUCCESSFUL APPLICATION:', {
          hadResponse: !!aiResponse,
          responseSuccess: aiResponse?.success,
          editsCount: aiResponse?.edits.length || 0,
          modifiedFilesCount: result.modifiedFiles.length,
          timestamp: new Date().toISOString()
        });
        
        setAiResponse(null);
        setShowPreview(false);
        
        // Show success message briefly
        console.log(`✅ Successfully applied ${aiResponse.edits.length} edit(s) to ${result.modifiedFiles.length} file(s)`);
        
        // Automatically restart server and show changes
        console.log('🔄 Auto-restarting server to show changes...');
        const serverResult = await restartServer();
        
        if (serverResult.success) {
          console.log('✅ Server restarted and changes are visible at:', serverResult.url);
        } else {
          console.warn('⚠️ Changes applied but server restart failed:', serverResult.error);
          // Still try to open localhost:8000 as fallback
          setTimeout(() => {
            window.open('http://localhost:8000', '_blank');
          }, 1000);
        }
        
      } else {
        console.error('❌ Failed to apply edits:', result.errors);
        setError(`Failed to apply some edits: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Failed to apply edits:', error);
      setError(`Error applying edits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Apply edits directly to files using the enhanced FileWriterService
  const applyEditsToFiles = async (edits: AIEdit[]): Promise<{
    success: boolean;
    modifiedFiles: string[];
    errors: string[];
    backupPaths?: string[];
  }> => {
    try {
      console.log(`🚀 Using enhanced FileWriterService to apply ${edits.length} edits`);
      
      // Get the project root
      const projectRoot = projectContext?.currentProject?.path;
      console.log(`🔍 Project root for file operations: ${projectRoot}`);
      
      // Use the enhanced service from EnhancedAIEditorService
      const result = await EnhancedAIEditorService.applyEditsToFiles(edits, projectRoot);
      
      console.log(`📊 FileWriterService results:`, {
        success: result.success,
        modifiedFiles: result.modifiedFiles.length,
        errors: result.errors.length,
        backups: result.backupPaths?.length || 0
      });
      
      return result;
    } catch (error) {
      const errorMessage = `Enhanced file writer failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('❌', errorMessage);
      
      // Fallback to the original implementation
      console.log('🔄 Falling back to original file writing implementation');
      return await applyEditsToFilesLegacy(edits);
    }
  };

  // Legacy file writing implementation as fallback
  const applyEditsToFilesLegacy = async (edits: AIEdit[]): Promise<{
    success: boolean;
    modifiedFiles: string[];
    errors: string[];
  }> => {
    const modifiedFiles: string[] = [];
    const errors: string[] = [];
    
    console.log('⚠️ Using legacy file writing implementation');
    
    // Get the project root for path resolution
    const projectRoot = projectContext?.currentProject?.path;
    
    try {
      for (const edit of edits) {
        try {
          // Resolve file path to absolute path
          let absoluteFilePath = edit.filePath || '';
          if (absoluteFilePath && !absoluteFilePath.startsWith('/') && !absoluteFilePath.startsWith('C:\\')) {
            if (projectRoot) {
              absoluteFilePath = `${projectRoot}/${absoluteFilePath}`;
            }
          }
          
          if (edit.type === 'create' && absoluteFilePath && edit.newText) {
            // Create new file
            const result = await window.electron.fileSystem.writeFile(absoluteFilePath, edit.newText);
            if (result.success) {
              modifiedFiles.push(absoluteFilePath);
              console.log(`Created file: ${absoluteFilePath}`);
            } else {
              errors.push(`Failed to create ${absoluteFilePath}: ${result.error}`);
            }
          } else if (edit.type === 'delete_file' && absoluteFilePath) {
            // Delete file
            const result = await window.electron.fileSystem.deleteItem(absoluteFilePath);
            if (result.success) {
              modifiedFiles.push(absoluteFilePath);
              console.log(`Deleted file: ${absoluteFilePath}`);
            } else {
              errors.push(`Failed to delete ${absoluteFilePath}: ${result.error}`);
            }
          } else if (edit.type === 'replace' && edit.oldText && edit.newText && absoluteFilePath) {
            // Handle search/replace operations
            const fileResult = await window.electron.fileSystem.readFile(absoluteFilePath);
            if (!fileResult.success) {
              errors.push(`Failed to read file ${absoluteFilePath}: ${fileResult.error}`);
              continue;
            }

            const currentContent = fileResult.content || '';
            
            if (currentContent.includes(edit.oldText)) {
              const newContent = currentContent.replace(edit.oldText, edit.newText);
              const writeResult = await window.electron.fileSystem.writeFile(absoluteFilePath, newContent);
              
              if (writeResult.success) {
                modifiedFiles.push(absoluteFilePath);
                console.log(`Search/replace successful in: ${absoluteFilePath}`);
              } else {
                errors.push(`Failed to write file ${absoluteFilePath}: ${writeResult.error}`);
              }
            } else {
              errors.push(`Search text not found in ${absoluteFilePath}`);
            }
          }
        } catch (error) {
          errors.push(`Error processing edit: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      return {
        success: errors.length === 0,
        modifiedFiles,
        errors
      };
    } catch (error) {
      errors.push(`Failed to apply edits: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        modifiedFiles,
        errors
      };
    }
  };

  // Clear error state and reset form
  const handleClearError = () => {
    console.log('🔍 DEBUG: Clearing error state and resetting form', {
      currentShowPreview: showPreview
      // File editor state removed - using right panel CodeEditor instead
    });
    
    // Console log for AI response clearing
    console.log('🧹 AI RESPONSE CLEARED:', {
      hadResponse: !!aiResponse,
      responseSuccess: aiResponse?.success,
      editsCount: aiResponse?.edits?.length || 0,
      timestamp: new Date().toISOString()
    });
    
    setAiResponse(null);
    setError(null);
    setShowPreview(false);
    setIsLoading(false); // Ensure loading state is reset
    // Don't clear userInstruction - let user retry with same text
  };



  // Handle preview toggle
  const handlePreviewToggle = async () => {
    console.log('🔍 DEBUG: Preview toggle clicked', { 
      currentShowPreview: showPreview, 
      newShowPreview: !showPreview,
      hasEdits: aiResponse?.edits?.length || 0,
      currentFileData: {
        path: currentFileData?.path,
        name: currentFileData?.name,
        contentLength: currentFileData?.content?.length,
        language: currentFileData?.language
      },
      aiResponseEdits: aiResponse?.edits?.map(edit => ({
        filePath: edit.filePath,
        type: edit.type,
        hasOldText: !!edit.oldText,
        hasNewText: !!edit.newText
      })) || []
      // File editor state removed - using right panel CodeEditor instead
    });
    
    const newShowPreview = !showPreview;
    
    // If enabling preview and we have edits, automatically load the first file with edits
    if (newShowPreview && aiResponse && aiResponse.edits && aiResponse.edits.length > 0) {
      console.log('🔍 DEBUG: Enabling preview - Auto-loading first file with edits');
      
      // Find the first edit that targets a file
      const firstEdit = aiResponse.edits.find(edit => edit.filePath && edit.oldText && edit.newText);
      
      if (firstEdit) {
        console.log('🔍 DEBUG: Auto-loading file for preview:', firstEdit.filePath);
        console.log('🎯 FOCUSING TO FILE PATH:', firstEdit.filePath);
        console.log('📊 SHOWING DIFF FOR FILE:', firstEdit.filePath);
        await loadFileForEdit(firstEdit);
      }
    }
    
    setShowPreview(newShowPreview);
  };

  // Show all available keys, not filtered by provider
  const availableKeys = aiKeys;

  if (!isVisible) return null;

  return (
    <div className="dual-screen-ai-editor">
      

      <div className="sidebar-content">
        {/* Compact Configuration Bar */}
        <div className="config-bar">
          {/* Conversation Management */}
          <div className="conversation-controls">
            <div className="conversation-info">
              {currentConversation && (
                <span className="conversation-stats">
                  {currentConversation.messages.length}msgs
                </span>
              )}
            </div>
            
            <div className="conversation-actions">
              {onToggleEditing && (
                <button
                  className={`editor-toggle-btn ${isEditing ? 'editing' : 'server'}`}
                  onClick={() => {
                    console.log('AI Editor: Toggle button clicked, current isEditing:', isEditing);
                    onToggleEditing();
                  }}
                  title={isEditing ? 'Switch to Server Mode' : 'Switch to Editing Mode'}
                >
                  {isEditing ? <>{FontAwesomeIcon && <FontAwesomeIcon icon={faGlobe} />} Server</> : <>{FontAwesomeIcon && <FontAwesomeIcon icon={faEdit} />} Editor</>}
                </button>
              )}
              <button
                className="history-btn"
                onClick={() => setShowConversationHistory(!showConversationHistory)}
                title="Show conversation history"
              >
                {FontAwesomeIcon && <FontAwesomeIcon icon={faBook} />}
              </button>
              
              {currentConversation && (
                <button
                  className="new-conversation-btn"
                  onClick={() => {
                    if (projectContext?.currentProject?.path) {
                      conversationStore.createConversation(
                        projectContext.currentProject.path,
                        projectContext.currentProject.name
                      );
                    }
                  }}
                  title="Start new conversation"
                >
                  {FontAwesomeIcon && <FontAwesomeIcon icon={faPlus} />}
                </button>
              )}
            </div>
          </div>
          
        </div>

        {/* File Info - removed as requested */}

        {/* Chat Messages Area */}
        <div className="chat-messages">
          {/* Welcome Message */}
          {!aiResponse && !isStreaming && !error && (
            <div className="message ai-message">
              <div className="message-content">
                <p>👋 Hi! I'm your AI coding assistant. I can help you:</p>
                <ul>
                  <li>Refactor and improve code</li>
                  <li>Add new features and functionality</li>
                  <li>Fix bugs and issues</li>
                  <li>Explain code and concepts</li>
                  <li>Create new files and components</li>
                </ul>
                <p>Just describe what you'd like me to do with your code!</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="message error-message">
              <div className="message-content">
                <p>{FontAwesomeIcon && <FontAwesomeIcon icon={faExclamationTriangle} />} {error}</p>
                <button onClick={handleClearError} className="retry-btn">Try Again</button>
                </div>
            </div>
          )}

          {/* Streaming Response */}
        {isStreaming && (
            <div className="message ai-message">
              <div className="message-content">
                <div className="streaming-indicator">
                  <span className="typing-dots">AI is typing</span>
                  <span className="typing-dots">●</span>
                  <span className="typing-dots">●</span>
                  <span className="typing-dots">●</span>
            </div>
            <div className="streaming-content">
                  {streamedContent}
              </div>
                    </div>
          </div>
        )}

        {/* Iterative Reading Status */}
        {isIterativeReading && iterativeReadingState && (
          <div className="message iterative-reading-message">
            <div className="message-content">
              <div className="response-header">
                <span className="response-title">{FontAwesomeIcon && <FontAwesomeIcon icon={faFile} />} Iterative File Reading</span>
              </div>
              
              <div className="iterative-status">
                <div className="status-phase">
                  <strong>Phase:</strong> {iterativeReadingState.phase}
                </div>
                <div className="status-content">
                  <strong>Content Read:</strong> {iterativeReadingState.totalContentRead.toLocaleString()} / {iterativeReadingState.maxContentLimit.toLocaleString()} chars
                </div>
                <div className="status-files">
                  <strong>Files Read:</strong> {iterativeReadingState.readRanges.length}
                </div>
                
                {iterativeReadingState.readRanges.length > 0 && (
                  <div className="read-ranges">
                    <strong>Read Ranges:</strong>
                    <ul>
                      {iterativeReadingState.readRanges.map((range: any, index: number) => (
                        <li key={index}>
                          {range.filePath.split('/').pop()} (lines {range.startLine}-{range.endLine})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Debug Payload Display */}
        {debugPayload && (
          <div className="message debug-message">
            <div className="message-content">
              <div className="response-header">
                <span className="response-title">{FontAwesomeIcon && <FontAwesomeIcon icon={faBug} />} Debug Payload</span>
                <div className="response-actions">
                  <button 
                    onClick={() => setDebugPayload(null)}
                    className="close-btn"
                  >
                    {FontAwesomeIcon && <FontAwesomeIcon icon={faTimes} />}
                  </button>
                </div>
              </div>
              
              <div className="debug-payload-content">
                <h4>Enhanced Context: {debugPayload.enhancedContext ? <>{FontAwesomeIcon && <FontAwesomeIcon icon={faCheck} />} Yes</> : <>{FontAwesomeIcon && <FontAwesomeIcon icon={faTimes} />} No</>}</h4>
                
                <details open>
                  <summary><strong>Original User Instruction:</strong></summary>
                  <pre>{debugPayload.originalUserInstruction}</pre>
                </details>
                
                <details open>
                  <summary><strong>Enhanced User Instruction (sent to AI):</strong></summary>
                  <pre>{debugPayload.enhancedUserInstruction}</pre>
                </details>
                
                <details>
                  <summary><strong>Full Request Object:</strong></summary>
                  <pre>{JSON.stringify(debugPayload.request, null, 2)}</pre>
                </details>
                
                <details>
                  <summary><strong>Config:</strong></summary>
                  <pre>{JSON.stringify(debugPayload.config, null, 2)}</pre>
                </details>
              </div>
              
              <div className="debug-actions">
                <button 
                  onClick={() => {
                    setDebugPayload(null);
                    handleRequestEdit(); // Actually send the request
                  }}
                  className="send-anyway-btn"
                >
                  {FontAwesomeIcon && <FontAwesomeIcon icon={faRocket} />} Send to AI Anyway
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search & Replace Prompts Display */}
        {searchReplacePrompts.length > 0 && (
          <div className="message search-replace-message">
            <div className="message-content">
              <div className="response-header">
                <span className="response-title">{FontAwesomeIcon && <FontAwesomeIcon icon={faSearch} />} {searchReplacePrompts.length} Search/Replace</span>
                <button 
                  onClick={() => setSearchReplacePrompts([])}
                  className="close-btn"
                >
                  {FontAwesomeIcon && <FontAwesomeIcon icon={faTimes} />}
                </button>
              </div>
              
              <div className="search-replace-content">
                {searchReplacePrompts.map((prompt, index) => (
                  <div key={prompt.id || index} className="prompt-item">
                    <div className="prompt-header">
                      <span className="prompt-number">#{index + 1}</span>
                      <span className="prompt-description">{prompt.description}</span>
                      {prompt.filePath && <span className="file-path">{prompt.filePath.split('/').pop()}</span>}
                    </div>
                    
                    <div className="prompt-details">
                      <div className="search-replace-pair">
                        <div className="search-text">
                          {FontAwesomeIcon && <FontAwesomeIcon icon={faSearch} />} <code>{prompt.searchText}</code>
                        </div>
                        <div className="replace-text">
                          {FontAwesomeIcon && <FontAwesomeIcon icon={faRefresh} />} <code>{prompt.replaceText}</code>
                        </div>
                      </div>
                    </div>
                    
                    <div className="prompt-actions">
                      <button 
                        onClick={() => {
                          console.log('Executing search/replace:', prompt);
                        }}
                        className="execute-btn"
                        title="Execute"
                      >
                        {FontAwesomeIcon && <FontAwesomeIcon icon={faCheck} />}
                      </button>
                      
                      <button 
                        onClick={() => {
                          const text = `Search: ${prompt.searchText}\nReplace: ${prompt.replaceText}`;
                          navigator.clipboard.writeText(text);
                        }}
                        className="copy-btn"
                        title="Copy"
                      >
                        {FontAwesomeIcon && <FontAwesomeIcon icon={faClipboard} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Response */}
           {aiResponse && aiResponse.success && (
             <div className="message ai-message">
               <div className="message-content">
            <div className="response-header">
                   <span className="response-title">{FontAwesomeIcon && <FontAwesomeIcon icon={faRobot} />} AI Response</span>
                   {/* Only show edit actions if there are actual code edits */}
                   {aiResponse.edits.length > 0 && (
                <div className="response-actions">
                       <button onClick={handlePreviewToggle} className="preview-btn">
                         {showPreview ? 'Hide' : 'Preview'}
                  </button>
                  <div className="auto-applied-indicator">
                    {FontAwesomeIcon && <FontAwesomeIcon icon={faCheck} />} Auto-Applied {aiResponse.edits.length} Change{aiResponse.edits.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
            
            {/* Console log for AI response display */}
            {(() => {
              console.log('🎨 AI RESPONSE DISPLAYED:', {
                success: aiResponse.success,
                explanationLength: aiResponse.explanation?.length || 0,
                editsCount: aiResponse.edits.length,
                showPreview: showPreview,
                timestamp: new Date().toISOString()
              });
              return null;
            })()}

            {/* AI Response Content */}
            {aiResponse.explanation && (
              <div className="explanation">
                {aiResponse.edits.length > 0 ? (
                  <SplitExplanationWithEdits 
                    explanation={aiResponse.explanation}
                    edits={aiResponse.edits}
                    currentFile={currentFileData}
                    onPreviewToggle={handlePreviewToggle}
                    showPreview={showPreview}
                    onApply={() => {}}
                    autoApplied={true}
                  />
                ) : (
                  <MessageContent content={aiResponse.explanation} role="assistant" />
                )}
              </div>
            )}
            
            {/* Show message when there are no edits */}
            {aiResponse.edits.length === 0 && (
              <div className="no-edits-message">
                {FontAwesomeIcon && <FontAwesomeIcon icon={faComments} />} This is a conversational response with no code changes to apply.
              </div>
            )}

                {aiResponse.usage && (
                  <div className="usage-info">
                    <span>Tokens: {aiResponse.usage.totalTokens}</span>
                    {aiResponse.cost && <span>Cost: ${aiResponse.cost.toFixed(4)}</span>}
                  </div>
                )}
              </div>
                  </div>
                )}

                     {/* Preview Panel - Now handled by CodeEditBlock */}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>

        {/* Conversation History Panel */}
        {showConversationHistory && (
          <div className="conversation-history-panel">
            <div className="history-header">
              <h4>{FontAwesomeIcon && <FontAwesomeIcon icon={faComments} />} Conversation History</h4>
              <button
                className="close-history-btn"
                onClick={() => setShowConversationHistory(false)}
              >
                {FontAwesomeIcon && <FontAwesomeIcon icon={faTimes} />}
              </button>
            </div>
            
            <div className="history-search">
              <input
                type="text"
                placeholder="Search conversations..."
                value={conversationSearchQuery}
                onChange={(e) => setConversationSearchQuery(e.target.value)}
                className="history-search-input"
              />
            </div>
            
            <div className="conversation-list">
              {conversationStore
                .searchConversations(conversationSearchQuery)
                .filter(conv => conv.projectPath === projectContext?.currentProject?.path)
                .map(conversation => (
                  <div
                    key={conversation.id}
                    className={`conversation-item ${
                      conversation.id === currentConversation?.id ? 'active' : ''
                    }`}
                    onClick={() => {
                      conversationStore.setCurrentConversation(conversation.id);
                      setShowConversationHistory(false);
                    }}
                  >
                    <div className="conversation-item-header">
                      <span className="conversation-item-title">{conversation.title}</span>
                      <span className="conversation-item-date">
                        {conversation.updatedAt.toLocaleDateString()}
                      </span>
                    </div>
                    <div className="conversation-item-preview">
                      {conversation.messages[0]?.content.substring(0, 100)}...
                    </div>
                    <div className="conversation-item-meta">
                      <span className="message-count">{conversation.messages.length} messages</span>
                      {conversation.tags.length > 0 && (
                        <span className="conversation-tags">
                          {conversation.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="tag">{tag}</span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Input Area - Always at Bottom */}
        <div className="input-area">
          <div className="input-container">
            <textarea
              ref={instructionInputRef}
              value={userInstruction}
              onChange={(e) => setUserInstruction(e.target.value)}
              placeholder="Describe what you'd like me to do with your code..."
              rows={3}
              className="instruction-input"
              disabled={isLoading || isStreaming}
            />
            <div className="input-buttons">
              <div className="config-controls">
                <select
                  className="dualscreen-model-select"
                  value={selectedModel ? `${config.provider}::${selectedModel}` : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) {
                      setSelectedModel('');
                      return;
                    }
                    const [providerId, modelId] = value.split('::');
                    // Update provider to match chosen model
                    setConfig(prev => ({ ...prev, provider: providerId }));
                    setSelectedModel(modelId);
                    
                    // Auto-select a compatible API key for the new provider
                    const compatibleKeys = aiKeys.filter(key => key.providerId === providerId);
                    if (compatibleKeys.length > 0) {
                      setSelectedKey(compatibleKeys[0]);
                    } else {
                      setSelectedKey(null);
                    }
                  }}
                >
                  <option value="">Model...</option>
                  {CHAT_PROVIDERS.map(provider => (
                    <optgroup key={provider.id} label={provider.name}>
                      {provider.models.map(model => (
                        <option key={`${provider.id}::${model.id}`} value={`${provider.id}::${model.id}`}>
                          {model.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <select
                  className="api-key-select"
                  value={selectedKey?.id || ''}
                  onChange={(e) => {
                    const key = aiKeys.find(k => k.id === e.target.value);
                    setSelectedKey(key || null);
                    
                    // Update provider to match selected key
                    if (key) {
                      setConfig(prev => ({ ...prev, provider: key.providerId }));
                    }
                  }}
                  disabled={availableKeys.length === 0}
                >
                  <option value="">
                    {availableKeys.length === 0  ? 'No keys available' : 'Select API key'}
                  </option>
                  {availableKeys.map(key => (
                    <option key={key.id} value={key.id}>
                      {key.name} ({key.providerId})
                    </option>
                  ))}
                </select>
              </div>
              
              <button 
                className="send-btn"
                onClick={handleRequestEdit}
                disabled={!selectedKey || !selectedModel || (!currentFileData && (!routeFiles || routeFiles.length === 0)) || !userInstruction.trim() || isLoading || isStreaming}
              >
                {isLoading || isStreaming ? (FontAwesomeIcon && <FontAwesomeIcon icon={faClock} />) : (FontAwesomeIcon && <FontAwesomeIcon icon={faRocket} />)}
              </button>
            </div>
                  </div>
                </div>
      </div>
      
      {/* Context Management Panel */}
      <ContextManagementPanel
        isVisible={showContextManagement}
        onClose={() => setShowContextManagement(false)}
      />

    </div>
  );
};
