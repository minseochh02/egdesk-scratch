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
  faUndo
} from '../../utils/fontAwesomeIcons';
import { chatWithGemma, OllamaChatMessage, GemmaToolCall } from '../../lib/gemmaClient';
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
- apps_script_write_file: Write/update file content (args: fileName, content)
- apps_script_partial_edit: Make targeted edits to files (args: fileName, oldString, newString)
- apps_script_rename_file: Rename files (args: oldFileName, newFileName)
- apps_script_delete_file: Delete files (args: fileName)

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

The script content is stored in the EGDesk app's SQLite database (cloudmcp.db).
` : '';

    return `You are an AI assistant helping a developer work with Google Apps Script code.

Your role:
- Help understand, modify, debug, and improve Apps Script code
- Provide clear explanations of code functionality
- Suggest improvements and best practices
- Help identify and fix bugs
- Generate code snippets when requested
- Answer questions about Apps Script APIs and features
- Use AppsScript tools to read, write, and modify files when needed

${codeContext}

${toolsInfo}

IMPORTANT:
- When the user asks about code, refer to the current file context above
- If they ask to modify code, use the AppsScript tools to make changes directly
- Always explain what changes you're making and why
- Be concise but thorough in your explanations
- If the file content is truncated, mention that you're working with a partial view
- You have access to all files in the AppsScript project via tools
- NEVER pretend to execute a tool. Send the JSON request and wait for the system result.
- RESPOND WITH JSON ONLY WHEN USING TOOLS.

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
          <FontAwesomeIcon icon={faCode} className="header-icon" />
          <div>
            <h2>Cloud MCP Server Editor</h2>
            <p>View and manage Apps Script content from template copies</p>
          </div>
        </div>
        <button 
          className="refresh-button"
          onClick={loadTemplateCopies}
          disabled={loading}
        >
          <FontAwesomeIcon icon={faSpinner} spin={loading} />
          Refresh
        </button>
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
                    <div className="copy-item-meta">
                      <div className="meta-item">
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        <span>{formatDate(copy.createdAt)}</span>
                      </div>
                      {copy.scriptContent?.files && (
                        <div className="meta-item">
                          <span>{copy.scriptContent.files.length} file(s)</span>
                        </div>
                      )}
                    </div>
                    {copy.scriptId && (
                      <div className="copy-item-script-id">
                        Script ID: {copy.scriptId.substring(0, 30)}...
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
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
                {/* File selector */}
                <div className="file-selector">
                  <div className="file-selector-header">
                    <FontAwesomeIcon icon={faFileCode} />
                    <span>Script Files</span>
                  </div>
                  <div className="files-list">
                    {selectedCopy.scriptContent.files.map((file, index) => (
                      <div
                        key={index}
                        className={`file-item ${selectedFile === file.name ? 'active' : ''}`}
                        onClick={() => setSelectedFile(file.name)}
                      >
                        <FontAwesomeIcon icon={faFileCode} />
                        <span>{file.name}</span>
                        <span className="file-type">{file.type}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Code viewer */}
                <div className="code-viewer">
                  <div className="code-viewer-header">
                    <div className="code-header-left">
                      <FontAwesomeIcon icon={faCode} />
                      <span>{selectedFile || 'Select a file'}</span>
                    </div>
                    <div className="code-header-actions">
                      {selectedCopy && (
                        <button
                          className="open-spreadsheet-button"
                          onClick={() => {
                            if (selectedCopy.spreadsheetUrl) {
                              // Open in default browser
                              window.open(selectedCopy.spreadsheetUrl, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          title="Open spreadsheet in browser"
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} />
                          <span>Open Spreadsheet</span>
                        </button>
                      )}
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
                    </div>
                  </div>
                  <div className="code-content">
                    {selectedFile ? (
                      <pre className="code-block">
                        <code>{getSelectedFileContent() || 'No content available'}</code>
                      </pre>
                    ) : (
                      <div className="code-placeholder">
                        <p>Select a file from the list above to view its content</p>
                      </div>
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
                      ? '🟢 Ready'
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
    </div>
  );
};

export default CloudMCPServerEditor;

