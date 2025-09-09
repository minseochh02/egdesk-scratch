export interface FileDiscoveryRequest {
  userPrompt: string;
  projectRoot: string;
  availableFiles: string[]; // Just file names/paths, no content
}

export interface FileDiscoveryResponse {
  success: boolean;
  filesToExamine: string[];
  conversationId: string;
  error?: string;
}

export interface LineRangeRequest {
  filePath: string;
  startLine: number;
  endLine: number;
  context?: string; // Why this range is needed
}

export interface LineRangeResponse {
  success: boolean;
  content: string;
  lineCount: number;
  error?: string;
}

export interface IterativeReadingState {
  phase: 'discovery' | 'reading' | 'analysis' | 'complete';
  currentFile?: string;
  projectRoot: string;
  currentUrlPath: string; // Track the current URL path the user is viewing
  filesToExamine: string[]; // List of files discovered to examine
  currentFileIndex: number; // Index of current file being read
  conversationId: string; // Unique ID for this discovery session
  cachedFiles: Array<{
    path: string;
    name: string;
    content: string;
    language: string;
  }>;
  readRanges: Array<{
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
  }>;
  totalContentRead: number;
  maxContentLimit: number;
}

export interface AIReadingDecision {
  action:
    | 'read_file'
    | 'read_range'
    | 'continue_reading'
    | 'analyze_and_respond'
    | 'need_more_context';
  filePath?: string;
  startLine?: number;
  endLine?: number;
  lineCount?: number;  // Number of lines to read at once
  reasoning: string;
  confidence: number;
}

export class IterativeFileReaderService {
  private static instance: IterativeFileReaderService;

  private currentState: IterativeReadingState | null = null;

  private conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }> = [];

  private currentAbortController: AbortController | null = null;

  private constructor() {}

  static getInstance(): IterativeFileReaderService {
    if (!IterativeFileReaderService.instance) {
      IterativeFileReaderService.instance = new IterativeFileReaderService();
    }
    return IterativeFileReaderService.instance;
  }

  /**
   * Start the iterative file reading process
   */
  async startIterativeReading(
    userPrompt: string,
    projectRoot: string,
    availableFiles: string[],
    aiKey: any,
    model: string,
    maxContentLimit: number = 50000,
    cachedFiles: Array<{
      path: string;
      name: string;
      content: string;
      language: string;
    }> = [],
    currentUrlPath: string = '/',
    abortController?: AbortController,
  ): Promise<{
    success: boolean;
    nextAction: AIReadingDecision;
    conversationId?: string;
    error?: string;
  }> {
    try {
      // Use provided abort controller or create a new one
      if (abortController) {
        this.currentAbortController = abortController;
      } else {
        this.currentAbortController = new AbortController();
      }

      // Initialize state
      this.currentState = {
        phase: 'discovery',
        projectRoot,
        currentUrlPath,
        filesToExamine: [],
        currentFileIndex: 0,
        conversationId: '',
        cachedFiles,
        readRanges: [],
        totalContentRead: 0,
        maxContentLimit,
      };

      // Add user prompt to conversation history
      this.addToConversationHistory('user', userPrompt);

      // Generate conversation ID
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.currentState.conversationId = conversationId;

      // Phase 1: AI determines which lines to read
      const aiDecisionResponse = await this.performAILineDecision(
        userPrompt,
        projectRoot,
        availableFiles,
        aiKey,
        model,
      );

      if (!aiDecisionResponse.success) {
        return {
          success: false,
          nextAction: {
            action: 'analyze_and_respond',
            reasoning: 'Failed to get AI decision on what to read',
            confidence: 0,
          },
          error: aiDecisionResponse.error,
        };
      }

      // Store the AI's decision as the next action
      const nextAction = aiDecisionResponse.nextAction;

      // DEBUG: Log the initial AI decision
      console.log('🔍 DEBUG: Initial AI Line Decision:', {
        userPrompt,
        currentUrlPath,
        availableFilesCount: availableFiles.length,
        aiDecision: {
          action: nextAction.action,
          filePath: nextAction.filePath,
          startLine: nextAction.startLine,
          endLine: nextAction.endLine,
          lineCount: nextAction.lineCount,
          reasoning: nextAction.reasoning,
          confidence: nextAction.confidence
        },
        conversationId: this.currentState.conversationId,
        state: {
          phase: this.currentState.phase,
          filesToExamine: this.currentState.filesToExamine,
          currentFileIndex: this.currentState.currentFileIndex
        }
      });

      return {
        success: true,
        nextAction,
        conversationId: this.currentState.conversationId,
      };
    } catch (error) {
      console.error('Failed to start iterative reading:', error);
      return {
        success: false,
        nextAction: {
          action: 'analyze_and_respond',
          reasoning: 'Error during initialization',
          confidence: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Continue the iterative reading process based on AI decision
   */
  async continueIterativeReading(
    aiDecision: AIReadingDecision,
    aiKey: any,
    model: string,
    conversationId: string,
    abortController?: AbortController,
  ): Promise<{
    success: boolean;
    nextAction: AIReadingDecision;
    content?: string;
    error?: string;
  }> {
    if (!this.currentState) {
      return {
        success: false,
        nextAction: {
          action: 'analyze_and_respond',
          reasoning: 'No active reading session',
          confidence: 0,
        },
        error: 'No active reading session',
      };
    }

    // Validate conversation ID matches current session
    if (this.currentState.conversationId !== conversationId) {
      return {
        success: false,
        nextAction: {
          action: 'analyze_and_respond',
          reasoning: 'Conversation ID mismatch',
          confidence: 0,
        },
        error: 'Conversation ID does not match current session',
      };
    }

    // Check if request was cancelled
    if (this.currentAbortController?.signal.aborted) {
      return {
        success: false,
        nextAction: {
          action: 'analyze_and_respond',
          reasoning: 'Request was cancelled',
          confidence: 0,
        },
        error: 'Request was cancelled',
      };
    }

    try {
      let result: {
        success: boolean;
        nextAction: AIReadingDecision;
        content?: string;
        error?: string;
      };

      switch (aiDecision.action) {
        case 'read_file':
          result = await this.handleReadFile(aiDecision, aiKey, model);
          break;

        case 'read_range':
          result = await this.handleReadRange(aiDecision, aiKey, model);
          break;

        case 'continue_reading':
          result = await this.handleContinueReading(aiDecision, aiKey, model);
          break;

        case 'analyze_and_respond':
          result = await this.handleAnalyzeAndRespond(aiDecision, aiKey, model);
          break;

        case 'need_more_context':
          result = await this.handleNeedMoreContext(aiDecision, aiKey, model);
          break;

        default:
          result = {
            success: false,
            nextAction: {
              action: 'analyze_and_respond',
              reasoning: 'Unknown action type',
              confidence: 0,
            },
            error: 'Unknown action type',
          };
      }

      // DEBUG: Log the result for debugging purposes
      console.log('🔍 DEBUG: Iterative Reading Result:', {
        action: aiDecision.action,
        filePath: aiDecision.filePath,
        startLine: aiDecision.startLine,
        endLine: aiDecision.endLine,
        lineCount: aiDecision.lineCount,
        reasoning: aiDecision.reasoning,
        confidence: aiDecision.confidence,
        result: {
          success: result.success,
          nextAction: result.nextAction,
          contentLength: result.content?.length || 0,
          contentPreview: result.content?.substring(0, 200) + (result.content && result.content.length > 200 ? '...' : ''),
          error: result.error
        },
        state: {
          phase: this.currentState?.phase,
          filesToExamine: this.currentState?.filesToExamine,
          currentFileIndex: this.currentState?.currentFileIndex,
          totalContentRead: this.currentState?.totalContentRead,
          readRanges: this.currentState?.readRanges.map(range => ({
            filePath: range.filePath,
            startLine: range.startLine,
            endLine: range.endLine,
            contentLength: range.content.length
          }))
        }
      });

      return result;
    } catch (error) {
      console.error('Failed to continue iterative reading:', error);
      return {
        success: false,
        nextAction: {
          action: 'analyze_and_respond',
          reasoning: 'Error during processing',
          confidence: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Phase 1: File Discovery - Send only file names to AI
   */
  private async performFileDiscovery(
    userPrompt: string,
    projectRoot: string,
    availableFiles: string[],
    aiKey: any,
    model: string,
  ): Promise<FileDiscoveryResponse> {
    const prompt = `## File Discovery Phase

You are a coding assistant that will be making direct changes to code files. The user cannot edit code themselves - YOU are responsible for all code modifications.

## Current Location Context:
The user is currently viewing: ${this.currentState?.currentUrlPath || 'Not specified'}

## User Request:
${userPrompt}

## Available Files in Project:
${availableFiles.map((file, index) => `${index + 1}. ${file}`).join('\n')}

## Your Task:
1. Analyze the user request to understand what code changes are needed
2. Consider the current URL path the user is viewing to understand the context
3. Select the files that will need to be modified to fulfill the request (max 5 files)
4. Focus on files that contain code that needs to be changed, not just referenced
5. Consider file types, naming patterns, and the specific changes required
6. Prioritize files that are most relevant to the current URL path the user is viewing

## Response Format:
Return a JSON object with this exact structure:
\`\`\`json
{
  "filesToExamine": ["path/to/file1.ext", "path/to/file2.ext", "path/to/component.css"]
}
\`\`\`

Remember: You will be making actual code changes to these files. Select files that need modification, not just files that are related to the topic. ALWAYS include CSS files when working with UI components.`;

    try {
      const response = await this.sendToAI(aiKey, model, prompt, {
        temperature: 0.3,
        maxTokens: 4096,
      });

      if (!response.success) {
        return {
          success: false,
          filesToExamine: [],
          conversationId: '',
          error: response.error,
        };
      }

      // Parse AI response
      const jsonMatch = response.content?.match(
        /```json\s*(\{[\s\S]*?\})\s*```/,
      );
      if (!jsonMatch) {
        return {
          success: false,
          filesToExamine: [],
          conversationId: '',
          error: 'Invalid response format',
        };
      }

      const decision = JSON.parse(jsonMatch[1]);
      
      // Generate a unique conversation ID
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        filesToExamine: decision.filesToExamine || [],
        conversationId,
      };
    } catch (error) {
      return {
        success: false,
        filesToExamine: [],
        conversationId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * AI determines which lines to read based on user request
   */
  private async performAILineDecision(
    userPrompt: string,
    projectRoot: string,
    availableFiles: string[],
    aiKey: any,
    model: string,
  ): Promise<{
    success: boolean;
    nextAction: AIReadingDecision;
    error?: string;
  }> {
    const prompt = `## AI Line Reading Decision Phase

You are a coding assistant that will be making direct changes to code files. The user cannot edit code themselves - YOU are responsible for all code modifications.

## Current Location Context:
The user is currently viewing: ${this.currentState?.currentUrlPath || 'Not specified'}

## User Request:
${userPrompt}

## Available Files in Project:
${availableFiles.map((file, index) => `${index + 1}. ${file}`).join('\n')}

## Your Task:
Based on the user's request, determine what specific lines from which files you need to read to understand the code and make the necessary changes.

## Response Format:
Return a JSON object with this exact structure:
\`\`\`json
{
  "action": "read_file" | "read_range" | "analyze_and_respond",
  "filePath": "path/to/file.ext",
  "startLine": 1,
  "endLine": 50,
  "lineCount": 50,
  "reasoning": "Explanation of why you need to read these specific lines",
  "confidence": 0.9
}
\`\`\`

## Action Types:
- **read_file**: Read a specific file (will read from startLine to endLine, or first lineCount lines if startLine/endLine not specified)
- **read_range**: Read a specific range of lines from a file
- **analyze_and_respond**: You have enough information to proceed with analysis

## Guidelines:
1. Start with the most relevant file for the user's request
2. Consider the current URL path context
3. Be specific about which lines you need to read
4. Focus on files that contain code that needs to be modified
5. If you need to read multiple files, start with the most important one first
6. Set confidence based on how certain you are about this decision

Remember: You will be making actual code changes to these files. Select the most relevant file and lines to start with.`;

    try {
      const response = await this.sendToAI(aiKey, model, prompt, {
        temperature: 0.3,
        maxTokens: 4096,
      });

      if (!response.success) {
        return {
          success: false,
          nextAction: {
            action: 'analyze_and_respond',
            reasoning: 'Failed to get AI response',
            confidence: 0,
          },
          error: response.error,
        };
      }

      // Parse AI response
      const jsonMatch = response.content?.match(
        /```json\s*(\{[\s\S]*?\})\s*```/,
      );
      if (!jsonMatch) {
        return {
          success: false,
          nextAction: {
            action: 'analyze_and_respond',
            reasoning: 'Failed to parse AI response',
            confidence: 0,
          },
          error: 'Invalid response format',
        };
      }

      const decision = JSON.parse(jsonMatch[1]);

      // DEBUG: Log the raw AI response
      console.log('🔍 DEBUG: Raw AI Response:', {
        rawResponse: response.content,
        parsedDecision: decision
      });

      // Validate the decision structure
      if (!decision.action || !decision.filePath) {
        console.log('🔍 DEBUG: Invalid AI decision structure:', decision);
        return {
          success: false,
          nextAction: {
            action: 'analyze_and_respond',
            reasoning: 'Invalid decision structure',
            confidence: 0,
          },
          error: 'AI decision missing required fields',
        };
      }

      // Add the file to filesToExamine if it's a read action
      if (decision.action === 'read_file' || decision.action === 'read_range') {
        if (!this.currentState!.filesToExamine.includes(decision.filePath)) {
          this.currentState!.filesToExamine.push(decision.filePath);
        }
      }

      return {
        success: true,
        nextAction: {
          action: decision.action,
          filePath: decision.filePath,
          startLine: decision.startLine || 1,
          endLine: decision.endLine,
          lineCount: decision.lineCount || 50,
          reasoning: decision.reasoning || 'No reasoning provided',
          confidence: decision.confidence || 0.8,
        },
      };
    } catch (error) {
      return {
        success: false,
        nextAction: {
          action: 'analyze_and_respond',
          reasoning: 'Error during AI decision',
          confidence: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if file content is available in cache
   */
  private getCachedFileContent(filePath: string): string | null {
    if (!this.currentState?.cachedFiles) return null;

    // Try exact match first
    let cachedFile = this.currentState.cachedFiles.find(
      (f) => f.path === filePath,
    );

    // Try relative path matching
    if (!cachedFile) {
      const relativePath = filePath.replace(
        `${this.currentState.projectRoot}/`,
        '',
      );
      cachedFile = this.currentState.cachedFiles.find(
        (f) =>
          f.path === relativePath ||
          f.path.endsWith(relativePath) ||
          relativePath.endsWith(f.path),
      );
    }

    // Try www/ to wordpress/ path conversion
    if (!cachedFile && filePath.includes('www/')) {
      const wordpressPath = filePath.replace('www/', 'wordpress/');
      cachedFile = this.currentState.cachedFiles.find(
        (f) =>
          f.path === wordpressPath ||
          f.path.endsWith(wordpressPath) ||
          wordpressPath.endsWith(f.path),
      );
    }

    console.log('🔍 DEBUG: getCachedFileContent', {
      requestedPath: filePath,
      foundCached: !!cachedFile,
      cachedPath: cachedFile?.path,
      contentLength: cachedFile?.content?.length,
    });

    return cachedFile?.content || null;
  }

  /**
   * Get the next file to read from the filesToExamine list
   */
  private getNextFileToRead(): string | null {
    if (!this.currentState) return null;
    
    const nextIndex = this.currentState.currentFileIndex + 1;
    if (nextIndex < this.currentState.filesToExamine.length) {
      return this.currentState.filesToExamine[nextIndex];
    }
    
    return null;
  }

  /**
   * Read file by lines from cached content
   */
  private async readFileByLinesFromCache(
    aiDecision: AIReadingDecision,
    aiKey: any,
    model: string,
    fullContent: string,
  ): Promise<{
    success: boolean;
    nextAction: AIReadingDecision;
    content?: string;
    error?: string;
  }> {
    const lines = fullContent.split('\n');
    const totalLines = lines.length;
    
    let startLine: number;
    let endLine: number;
    const linesToRead = aiDecision.lineCount || 50; // Default lines to read
    
    // If AI provided specific line ranges, use them
    if (aiDecision.startLine && aiDecision.endLine) {
      startLine = Math.max(1, aiDecision.startLine);
      endLine = Math.min(totalLines, aiDecision.endLine);
    } else {
      // Determine starting line (continue from where we left off)
      const lastReadRange = this.currentState!.readRanges
        .filter(range => range.filePath === aiDecision.filePath)
        .sort((a, b) => b.endLine - a.endLine)[0];
      
      startLine = lastReadRange ? lastReadRange.endLine + 1 : 1;
      endLine = Math.min(startLine + linesToRead - 1, totalLines);
    }
    
    // Extract the lines
    const content = lines.slice(startLine - 1, endLine).join('\n');
    
    // Add to read ranges
    this.currentState!.readRanges.push({
      filePath: aiDecision.filePath!,
      startLine,
      endLine,
      content,
    });

    this.currentState!.totalContentRead += content.length;

    // Add content to conversation history
    this.addToConversationHistory(
      'assistant',
      `Read file ${aiDecision.filePath} lines ${startLine}-${endLine} (${content.length} chars)`,
    );

    // Determine next action based on whether we've read the entire file
    let nextAction: AIReadingDecision;
    
    if (endLine >= totalLines) {
      // We've read the entire file, move to next file
      const nextFile = this.getNextFileToRead();
      
      if (nextFile) {
        // Move to next file
        this.currentState!.currentFileIndex += 1;
        
        nextAction = {
          action: 'read_file',
          filePath: nextFile,
          lineCount: linesToRead,
          reasoning: `Finished reading ${aiDecision.filePath}. Moving to next file: ${nextFile}`,
          confidence: 0.9,
        };
      } else {
        // No more files to read
        nextAction = {
          action: 'analyze_and_respond',
          reasoning: `Finished reading all ${this.currentState!.filesToExamine.length} files. Proceeding to analysis.`,
          confidence: 0.9,
        };
      }
    } else {
      // Continue reading more lines from current file
      nextAction = {
        action: 'read_file',
        filePath: aiDecision.filePath,
        startLine: endLine + 1,
        endLine: Math.min(endLine + linesToRead, totalLines),
        lineCount: linesToRead,
        reasoning: `Continuing to read ${aiDecision.filePath} from line ${endLine + 1}`,
        confidence: 0.8,
      };
    }

    // Format content with line numbers for display
    const numberedContent = this.formatContentWithLineNumbers(content, startLine);

    return {
      success: true,
      nextAction,
      content: numberedContent,
    };
  }

  /**
   * Handle reading a file by lines (chunked reading)
   */
  private async handleReadFile(
    aiDecision: AIReadingDecision,
    aiKey: any,
    model: string,
  ): Promise<{
    success: boolean;
    nextAction: AIReadingDecision;
    content?: string;
    error?: string;
  }> {
    if (!aiDecision.filePath) {
      return {
        success: false,
        nextAction: {
          action: 'analyze_and_respond',
          reasoning: 'No file path specified',
          confidence: 0,
        },
        error: 'No file path specified',
      };
    }

    // If this is a read_range action, delegate to handleReadRange
    if (aiDecision.action === 'read_range') {
      return await this.handleReadRange(aiDecision, aiKey, model);
    }

    try {
      // First, try to get content from cache
      const cachedContent = this.getCachedFileContent(aiDecision.filePath);

      if (cachedContent) {
        return await this.readFileByLinesFromCache(aiDecision, aiKey, model, cachedContent);
      }

      // If not in cache, read from file system
      const fullFilePath =
        aiDecision.filePath.startsWith('/') ||
        aiDecision.filePath.startsWith('C:\\')
          ? aiDecision.filePath
          : `${this.currentState!.projectRoot}/${aiDecision.filePath}`;

      console.log('🔍 DEBUG: Reading file by lines from file system', {
        originalPath: aiDecision.filePath,
        fullPath: fullFilePath,
      });

      // Read the entire file first to get line count
      let result = await window.electron.fileSystem.readFile(fullFilePath);

      if (!result.success) {
        // Try path variations
        const pathVariations = [
          `${this.currentState!.projectRoot}/egdesk-scratch/${aiDecision.filePath}`,
          `${this.currentState!.projectRoot}/egdesk-scratch/wordpress/${aiDecision.filePath}`,
          `${this.currentState!.projectRoot}/wordpress/${aiDecision.filePath}`,
          `${this.currentState!.projectRoot}/${aiDecision.filePath.replace('www/', 'egdesk-scratch/wordpress/')}`,
          `${this.currentState!.projectRoot}/${aiDecision.filePath.replace('www/', 'wordpress/')}`,
        ];

        for (const path of pathVariations) {
          result = await window.electron.fileSystem.readFile(path);
          if (result.success) {
            break;
          }
        }
      }

      if (!result.success) {
        return {
          success: false,
          nextAction: {
            action: 'analyze_and_respond',
            reasoning: `Failed to read file: ${aiDecision.filePath}`,
            confidence: 0,
          },
          error: result.error,
        };
      }

      return await this.readFileByLinesFromCache(aiDecision, aiKey, model, result.content || '');

    } catch (error) {
      return {
        success: false,
        nextAction: {
          action: 'analyze_and_respond',
          reasoning: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          confidence: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle reading a specific line range
   */
  private async handleReadRange(
    aiDecision: AIReadingDecision,
    aiKey: any,
    model: string,
  ): Promise<{
    success: boolean;
    nextAction: AIReadingDecision;
    content?: string;
    error?: string;
  }> {
    if (!aiDecision.filePath || !aiDecision.startLine || !aiDecision.endLine) {
      return {
        success: false,
        nextAction: {
          action: 'analyze_and_respond',
          reasoning: 'Missing file path or line range',
          confidence: 0,
        },
        error: 'Missing file path or line range',
      };
    }

    try {
      // First, try to get content from cache
      const cachedContent = this.getCachedFileContent(aiDecision.filePath);

      if (cachedContent) {
        console.log('🔍 DEBUG: handleReadRange - Using cached content', {
          originalPath: aiDecision.filePath,
          contentLength: cachedContent.length,
          startLine: aiDecision.startLine,
          endLine: aiDecision.endLine,
        });

        const lines = cachedContent.split('\n');
        const startLine = Math.max(1, aiDecision.startLine);
        const endLine = Math.min(lines.length, aiDecision.endLine);
        const content = lines.slice(startLine - 1, endLine).join('\n');

        // Add to read ranges
        this.currentState!.readRanges.push({
          filePath: aiDecision.filePath,
          startLine,
          endLine,
          content,
        });

        this.currentState!.totalContentRead += content.length;

        // Add content to conversation history
        this.addToConversationHistory(
          'assistant',
          `Read file ${aiDecision.filePath} lines ${startLine}-${endLine} from cache (${content.length} chars)`,
        );

        // Determine next action
        const nextAction = await this.determineNextAction(
          aiKey,
          model,
          content,
        );

        // Format content with line numbers for display
        const numberedContent = this.formatContentWithLineNumbers(content, startLine);

        return {
          success: true,
          nextAction,
          content: numberedContent,
        };
      }

      // If not in cache, try file system with path resolution
      const fullFilePath =
        aiDecision.filePath.startsWith('/') ||
        aiDecision.filePath.startsWith('C:\\')
          ? aiDecision.filePath
          : `${this.currentState!.projectRoot}/${aiDecision.filePath}`;

      console.log(
        '🔍 DEBUG: handleReadRange - Not in cache, attempting to read from file system',
        {
          originalPath: aiDecision.filePath,
          fullPath: fullFilePath,
          projectRoot: this.currentState!.projectRoot,
          startLine: aiDecision.startLine,
          endLine: aiDecision.endLine,
        },
      );

      // Read the entire file first
      let result = await window.electron.fileSystem.readFile(fullFilePath);

      // If the file path doesn't work, try some common variations
      if (!result.success) {
        console.log('handleReadRange: Original path failed, trying variations');
        const pathVariations = [
          `${this.currentState!.projectRoot}/egdesk-scratch/${aiDecision.filePath}`,
          `${this.currentState!.projectRoot}/egdesk-scratch/wordpress/${aiDecision.filePath}`,
          `${this.currentState!.projectRoot}/wordpress/${aiDecision.filePath}`,
          `${this.currentState!.projectRoot}/${aiDecision.filePath.replace('www/', 'egdesk-scratch/wordpress/')}`,
          `${this.currentState!.projectRoot}/${aiDecision.filePath.replace('www/', 'wordpress/')}`,
        ];

        for (const path of pathVariations) {
          console.log('handleReadRange: Trying path:', path);
          result = await window.electron.fileSystem.readFile(path);
          if (result.success) {
            console.log('handleReadRange: Found file at:', path);
            break;
          }
        }
      }

      if (!result.success) {
        return {
          success: false,
          nextAction: {
            action: 'analyze_and_respond',
            reasoning: `Failed to read file: ${aiDecision.filePath} (tried cache and multiple path variations)`,
            confidence: 0,
          },
          error: result.error,
        };
      }

      const lines = result.content?.split('\n') || [];
      const startLine = Math.max(1, aiDecision.startLine);
      const endLine = Math.min(lines.length, aiDecision.endLine);

      const rangeContent = lines.slice(startLine - 1, endLine).join('\n');
      const lineCount = endLine - startLine + 1;

      // Add to read ranges
      this.currentState!.readRanges.push({
        filePath: aiDecision.filePath,
        startLine,
        endLine,
        content: rangeContent,
      });

      this.currentState!.totalContentRead += rangeContent.length;

      // Add content to conversation history
      this.addToConversationHistory(
        'assistant',
        `Read lines ${startLine}-${endLine} from ${aiDecision.filePath} (${lineCount} lines)`,
      );

      // Determine next action
      const nextAction = await this.determineNextAction(
        aiKey,
        model,
        rangeContent,
      );

      // Format content with line numbers for display
      const numberedContent = this.formatContentWithLineNumbers(rangeContent, startLine);

      return {
        success: true,
        nextAction,
        content: numberedContent,
      };
    } catch (error) {
      return {
        success: false,
        nextAction: {
          action: 'analyze_and_respond',
          reasoning: `Error reading line range: ${error instanceof Error ? error.message : 'Unknown error'}`,
          confidence: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle continue reading decision
   */
  private async handleContinueReading(
    aiDecision: AIReadingDecision,
    aiKey: any,
    model: string,
  ): Promise<{
    success: boolean;
    nextAction: AIReadingDecision;
    content?: string;
    error?: string;
  }> {
    // This would implement logic to continue reading based on AI's decision
    // For now, move to analysis phase
    return {
      success: true,
      nextAction: {
        action: 'analyze_and_respond',
        reasoning: 'Continuing to analysis phase',
        confidence: 0.8,
      },
    };
  }

  /**
   * Handle analyze and respond decision
   */
  private async handleAnalyzeAndRespond(
    aiDecision: AIReadingDecision,
    aiKey: any,
    model: string,
  ): Promise<{
    success: boolean;
    nextAction: AIReadingDecision;
    content?: string;
    error?: string;
  }> {
    this.currentState!.phase = 'analysis';

    // Build context from all read content
    const context = this.buildContextFromReadContent();

    const prompt = `## Analysis and Response Phase

Based on the files and content I've read, provide your analysis and response to the user's original request.

## Current Location Context:
The user is currently viewing: ${this.currentState?.currentUrlPath || 'Not specified'}

## Original User Request:
${this.conversationHistory.find((msg) => msg.role === 'user')?.content || ''}

## Content Read:
${context}

## Your Task:
You are a coding assistant with the ability to directly edit code files. The user cannot access or edit the code themselves - YOU are responsible for making all necessary code changes.

🎨 CSS COMPLIANCE MANDATORY:
- If you see CSS files in the content above, analyze the existing design system
- Use existing CSS classes, variables, and patterns from the design system
- Maintain visual consistency with the established design
- Follow the color schemes, spacing, and typography rules exactly
- If you must add new CSS, follow the existing naming conventions and structure
- NEVER create components that don't match the existing visual style

Provide a comprehensive response that includes:
1. Analysis of the current code
2. Specific changes that need to be made
3. **MANDATORY: Generate search/replace operations for ALL code changes**

## CRITICAL REQUIREMENTS:
- If the user requests ANY code changes, you MUST provide search/replace operations
- Do NOT say "no search/replace operations needed" - if code needs to change, provide the operations
- You are the ONLY one who can edit the code - the user cannot do it themselves
- Be specific and actionable - provide exact search/replace operations for every change

## Search/Replace Format:
For each change, provide the COMPLETE relative path and line numbers:
\`\`\`search-replace
FILE: complete/relative/path/from/project/root/file.ext
LINES: startLineNumber-endLineNumber
SEARCH: exact code to find
REPLACE: exact code to replace it with
\`\`\`

CRITICAL REQUIREMENTS:
- Use the FULL relative path from the project root (e.g., "www/index.php", "src/components/Button.tsx")
- Do NOT use just the filename (e.g., "index.php")
- Include the complete directory structure
- ALWAYS specify the line numbers where the change occurs (e.g., "LINES: 15-15" for single line, "LINES: 10-12" for multiple lines)
- Line numbers help with precise diff visualization

## CRITICAL: Complete HTML/JSX Block Requirements
- **MANDATORY**: When editing HTML/JSX elements, you MUST include the complete opening and closing tags
- If you start with a <div>, you MUST continue until you find the corresponding </div>
- If you start with a <span>, you MUST continue until you find the corresponding </span>
- If you start with a <button>, you MUST continue until you find the corresponding </button>
- This applies to ALL HTML/JSX elements: <p>, <section>, <article>, <header>, <footer>, <main>, <nav>, <aside>, etc.
- **NEVER** provide incomplete HTML/JSX blocks that are missing their closing tags
- **NEVER** cut off in the middle of an HTML/JSX element
- Always ensure your SEARCH and REPLACE blocks contain complete, valid HTML/JSX structures

Remember: You are responsible for making the code changes. Provide search/replace operations for everything that needs to be modified.`;

    try {
      const response = await this.sendToAI(aiKey, model, prompt, {
        temperature: 0.3,
        maxTokens: 4096,
      });

      if (!response.success) {
        return {
          success: false,
          nextAction: {
            action: 'analyze_and_respond',
            reasoning: 'Failed to generate analysis',
            confidence: 0,
          },
          error: response.error,
        };
      }

      this.currentState!.phase = 'complete';
      this.addToConversationHistory('assistant', response.content || '');

      return {
        success: true,
        nextAction: {
          action: 'analyze_and_respond',
          reasoning: 'Analysis complete',
          confidence: 1.0,
        },
        content: response.content,
      };
    } catch (error) {
      return {
        success: false,
        nextAction: {
          action: 'analyze_and_respond',
          reasoning: 'Error during analysis',
          confidence: 0,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle need more context decision
   */
  private async handleNeedMoreContext(
    aiDecision: AIReadingDecision,
    aiKey: any,
    model: string,
  ): Promise<{
    success: boolean;
    nextAction: AIReadingDecision;
    content?: string;
    error?: string;
  }> {
    // This would implement logic to gather more context
    // For now, move to analysis phase
    return {
      success: true,
      nextAction: {
        action: 'analyze_and_respond',
        reasoning: 'Moving to analysis with available context',
        confidence: 0.7,
      },
    };
  }

  /**
   * Determine next action based on current state and content
   */
  private async determineNextAction(
    aiKey: any,
    model: string,
    content: string,
  ): Promise<AIReadingDecision> {
    // Check if we've hit content limits
    if (
      this.currentState!.totalContentRead >= this.currentState!.maxContentLimit
    ) {
      return {
        action: 'analyze_and_respond',
        reasoning: 'Reached content limit, proceeding to analysis',
        confidence: 0.9,
      };
    }

    // Ask AI what to do next based on the content read so far
    const availableFiles = this.currentState!.filesToExamine;
    const currentFileIndex = this.currentState!.currentFileIndex;
    const currentFile = availableFiles[currentFileIndex];
    const remainingFiles = availableFiles.slice(currentFileIndex + 1);
    
    const prompt = `Based on the content I've read so far, what should I do next?

Current content:
${content}

Files to examine (${availableFiles.length} total):
${availableFiles.map((file, index) => 
  `${index + 1}. ${file}${index === currentFileIndex ? ' (CURRENT - reading by lines)' : ''}`
).join('\n')}

Remaining files to read:
${remainingFiles.length > 0 ? remainingFiles.map((file, index) => `${index + 1}. ${file}`).join('\n') : 'None - all files have been read'}

Available actions:
1. read_file - Continue reading the current file by lines OR move to next file
2. read_range - Read a specific range of lines from a file
3. analyze_and_respond - I have enough information to analyze and respond

Respond with JSON:
{
  "action": "read_file|read_range|analyze_and_respond",
  "filePath": "path/to/file" (if reading),
  "startLine": 1 (if reading range),
  "endLine": 50 (if reading range),
  "lineCount": 50 (if reading file by lines),
  "reasoning": "Why this action",
  "confidence": 0.8
}`;

    try {
      const response = await this.sendToAI(aiKey, model, prompt, {
        temperature: 0.1,
        maxTokens: 500,
      });

      if (response.success && response.content) {
        try {
          const decision = JSON.parse(response.content);
          return decision as AIReadingDecision;
        } catch (parseError) {
          console.error('Failed to parse AI decision:', parseError);
        }
      }
    } catch (error) {
      console.error('Failed to get AI decision:', error);
    }

    // Fallback: continue reading if we haven't read much yet
    const totalRead = this.currentState!.totalContentRead;
    if (totalRead < 1000) {
      return {
        action: 'read_file',
        reasoning: 'Need to read more content before analysis',
        confidence: 0.6,
      };
    }

    return {
      action: 'analyze_and_respond',
      reasoning: 'Sufficient content read, proceeding to analysis',
      confidence: 0.8,
    };
  }

  /**
   * Format content with line numbers
   */
  private formatContentWithLineNumbers(
    content: string,
    startLine: number,
  ): string {
    const lines = content.split('\n');
    return lines
      .map((line, index) => {
        const lineNumber = startLine + index;
        return `${lineNumber}|${line}`;
      })
      .join('\n');
  }

  /**
   * Build context string from all read content
   */
  private buildContextFromReadContent(): string {
    if (!this.currentState) return '';

    return this.currentState.readRanges
      .map((range) => {
        // Use the full relative path instead of just the filename
        const relativePath = range.filePath;
        
        // Add line numbers to the content using the helper function
        const numberedContent = this.formatContentWithLineNumbers(
          range.content,
          range.startLine,
        );
        
        return `\n--- ${relativePath} (lines ${range.startLine}-${range.endLine}) ---\n${numberedContent}`;
      })
      .join('\n');
  }

  /**
   * Add message to conversation history
   */
  private addToConversationHistory(
    role: 'user' | 'assistant',
    content: string,
  ): void {
    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date(),
    });
  }

  /**
   * Send request to AI provider
   */
  private async sendToAI(
    aiKey: any,
    model: string,
    prompt: string,
    options: { temperature: number; maxTokens: number },
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      // Only create a new abort controller if one doesn't exist
      if (!this.currentAbortController) {
        this.currentAbortController = new AbortController();
      }

      const provider = aiKey.providerId;

      switch (provider) {
        case 'openai':
          return await this.sendOpenAIRequest(aiKey, model, prompt, options);
        case 'anthropic':
          return await this.sendAnthropicRequest(aiKey, model, prompt, options);
        case 'google':
          return await this.sendGoogleRequest(aiKey, model, prompt, options);
        case 'azure':
          return await this.sendAzureRequest(aiKey, model, prompt, options);
        case 'custom':
          return await this.sendCustomRequest(aiKey, model, prompt, options);
        default:
          return {
            success: false,
            error: `Unsupported provider: ${provider}`,
          };
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request was cancelled',
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
    // Don't clear the abort controller here - keep it for the entire iterative process
  }

  /**
   * Send request to OpenAI
   */
  private async sendOpenAIRequest(
    aiKey: any,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aiKey.fields.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            stream: false,
          }),
          signal: this.currentAbortController?.signal,
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';

      return {
        success: true,
        content,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OpenAI request failed',
      };
    }
  }

  /**
   * Send request to Anthropic
   */
  private async sendAnthropicRequest(
    aiKey: any,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiKey.fields.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: this.currentAbortController?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.content[0]?.text || '';

      return {
        success: true,
        content,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Anthropic request failed',
      };
    }
  }

  /**
   * Send request to Google
   */
  private async sendGoogleRequest(
    aiKey: any,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiKey.fields.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: config.temperature,
              maxOutputTokens: config.maxTokens,
            },
          }),
          signal: this.currentAbortController?.signal,
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        success: true,
        content,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google request failed',
      };
    }
  }

  /**
   * Send request to Azure OpenAI
   */
  private async sendAzureRequest(
    aiKey: any,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const { endpoint } = aiKey.fields;
      const { apiKey } = aiKey.fields;

      if (!endpoint || !apiKey) {
        throw new Error('Azure OpenAI configuration incomplete');
      }

      const response = await fetch(
        `${endpoint}/openai/deployments/${model}/chat/completions?api-version=2023-12-01-preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            stream: false,
          }),
          signal: this.currentAbortController?.signal,
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';

      return {
        success: true,
        content,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Azure request failed',
      };
    }
  }

  /**
   * Send request to Custom provider
   */
  private async sendCustomRequest(
    aiKey: any,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const { apiKey } = aiKey.fields;
      const { endpoint } = aiKey.fields;

      if (!endpoint) {
        throw new Error('Custom provider configuration incomplete');
      }

      // Try to send in OpenAI-compatible format first
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          stream: false,
        }),
        signal: this.currentAbortController?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const content =
        data.choices?.[0]?.message?.content ||
        data.content ||
        data.message ||
        '';

      return {
        success: true,
        content,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Custom provider request failed',
      };
    }
  }

  /**
   * Get current reading state
   */
  getCurrentState(): IterativeReadingState | null {
    return this.currentState;
  }

  /**
   * Get current abort controller
   */
  getCurrentAbortController(): AbortController | null {
    return this.currentAbortController;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }> {
    return [...this.conversationHistory];
  }

  /**
   * Cancel the current AI request
   */
  cancel(): void {
    if (this.currentAbortController) {
      console.log('🛑 IterativeFileReaderService: Aborting current request...');
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }

  /**
   * Reset the service state
   */
  reset(): void {
    this.cancel(); // Cancel any ongoing requests
    this.currentState = null;
    this.conversationHistory = [];
    this.currentAbortController = null; // Clear the abort controller on full reset
  }
}
