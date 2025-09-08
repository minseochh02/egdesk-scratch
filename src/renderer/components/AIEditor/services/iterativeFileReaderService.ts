export interface FileDiscoveryRequest {
  userPrompt: string;
  projectRoot: string;
  availableFiles: string[]; // Just file names/paths, no content
}

export interface FileDiscoveryResponse {
  success: boolean;
  filesToExamine: string[];
  reasoning: string;
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
        cachedFiles,
        readRanges: [],
        totalContentRead: 0,
        maxContentLimit,
      };

      // Add user prompt to conversation history
      this.addToConversationHistory('user', userPrompt);

      // Phase 1: File Discovery
      const discoveryResponse = await this.performFileDiscovery(
        userPrompt,
        projectRoot,
        availableFiles,
        aiKey,
        model,
      );

      if (!discoveryResponse.success) {
        return {
          success: false,
          nextAction: {
            action: 'analyze_and_respond',
            reasoning: 'Failed to discover relevant files',
            confidence: 0,
          },
          error: discoveryResponse.error,
        };
      }

      // Add AI reasoning to conversation history
      this.addToConversationHistory('assistant', discoveryResponse.reasoning);

      // Determine next action based on discovery
      const nextAction: AIReadingDecision = {
        action:
          discoveryResponse.filesToExamine.length > 0
            ? 'read_file'
            : 'analyze_and_respond',
        filePath: discoveryResponse.filesToExamine[0],
        reasoning: `Discovered ${discoveryResponse.filesToExamine.length} relevant files. Starting with: ${discoveryResponse.filesToExamine[0] || 'none'}`,
        confidence: 0.9,
      };

      return {
        success: true,
        nextAction,
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
      switch (aiDecision.action) {
        case 'read_file':
          return await this.handleReadFile(aiDecision, aiKey, model);

        case 'read_range':
          return await this.handleReadRange(aiDecision, aiKey, model);

        case 'continue_reading':
          return await this.handleContinueReading(aiDecision, aiKey, model);

        case 'analyze_and_respond':
          return await this.handleAnalyzeAndRespond(aiDecision, aiKey, model);

        case 'need_more_context':
          return await this.handleNeedMoreContext(aiDecision, aiKey, model);

        default:
          return {
            success: false,
            nextAction: {
              action: 'analyze_and_respond',
              reasoning: 'Unknown action type',
              confidence: 0,
            },
            error: 'Unknown action type',
          };
      }
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
  "filesToExamine": ["path/to/file1.ext", "path/to/file2.ext"],
  "reasoning": "Brief explanation of why these files need to be modified for the user's request"
}
\`\`\`

Remember: You will be making actual code changes to these files. Select files that need modification, not just files that are related to the topic.`;

    try {
      const response = await this.sendToAI(aiKey, model, prompt, {
        temperature: 0.3,
        maxTokens: 4096,
      });

      if (!response.success) {
        return {
          success: false,
          filesToExamine: [],
          reasoning: '',
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
          reasoning: 'Failed to parse AI response',
          error: 'Invalid response format',
        };
      }

      const decision = JSON.parse(jsonMatch[1]);

      return {
        success: true,
        filesToExamine: decision.filesToExamine || [],
        reasoning: decision.reasoning || 'No reasoning provided',
      };
    } catch (error) {
      return {
        success: false,
        filesToExamine: [],
        reasoning: '',
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
   * Handle reading an entire file
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

    try {
      // First, try to get content from cache
      const cachedContent = this.getCachedFileContent(aiDecision.filePath);

      if (cachedContent) {
        console.log('🔍 DEBUG: handleReadFile - Using cached content', {
          originalPath: aiDecision.filePath,
          contentLength: cachedContent.length,
        });

        const content = cachedContent;
        const lineCount = content.split('\n').length;

        // Add to read ranges
        this.currentState!.readRanges.push({
          filePath: aiDecision.filePath,
          startLine: 1,
          endLine: lineCount,
          content,
        });

        this.currentState!.totalContentRead += content.length;

        // Add content to conversation history
        this.addToConversationHistory(
          'assistant',
          `Read file ${aiDecision.filePath} from cache (${lineCount} lines, ${content.length} chars)`,
        );

        // Determine next action
        const nextAction = await this.determineNextAction(
          aiKey,
          model,
          content,
        );

        return {
          success: true,
          nextAction,
          content,
        };
      }

      // If not in cache, try file system with path resolution
      const fullFilePath =
        aiDecision.filePath.startsWith('/') ||
        aiDecision.filePath.startsWith('C:\\')
          ? aiDecision.filePath
          : `${this.currentState!.projectRoot}/${aiDecision.filePath}`;

      console.log(
        '🔍 DEBUG: handleReadFile - Not in cache, attempting to read from file system',
        {
          originalPath: aiDecision.filePath,
          fullPath: fullFilePath,
          projectRoot: this.currentState!.projectRoot,
        },
      );

      // Read the entire file
      let result = await window.electron.fileSystem.readFile(fullFilePath);

      // If the file path doesn't work, try some common variations
      if (!result.success) {
        console.log('handleReadFile: Original path failed, trying variations');
        const pathVariations = [
          `${this.currentState!.projectRoot}/egdesk-scratch/${aiDecision.filePath}`,
          `${this.currentState!.projectRoot}/egdesk-scratch/wordpress/${aiDecision.filePath}`,
          `${this.currentState!.projectRoot}/wordpress/${aiDecision.filePath}`,
          `${this.currentState!.projectRoot}/${aiDecision.filePath.replace('www/', 'egdesk-scratch/wordpress/')}`,
          `${this.currentState!.projectRoot}/${aiDecision.filePath.replace('www/', 'wordpress/')}`,
        ];

        for (const path of pathVariations) {
          console.log('handleReadFile: Trying path:', path);
          result = await window.electron.fileSystem.readFile(path);
          if (result.success) {
            console.log('handleReadFile: Found file at:', path);
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

      const content = result.content || '';
      const lineCount = content.split('\n').length;

      // Add to read ranges
      this.currentState!.readRanges.push({
        filePath: aiDecision.filePath,
        startLine: 1,
        endLine: lineCount,
        content,
      });

      this.currentState!.totalContentRead += content.length;

      // Add content to conversation history
      this.addToConversationHistory(
        'assistant',
        `Read file ${aiDecision.filePath} (${lineCount} lines, ${content.length} chars)`,
      );

      // Determine next action
      const nextAction = await this.determineNextAction(aiKey, model, content);

      return {
        success: true,
        nextAction,
        content,
      };
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

        return {
          success: true,
          nextAction,
          content,
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

      return {
        success: true,
        nextAction,
        content: rangeContent,
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

    // For now, move to analysis after reading content
    // In a more sophisticated implementation, this would ask AI what to do next
    return {
      action: 'analyze_and_respond',
      reasoning: 'Sufficient content read, proceeding to analysis',
      confidence: 0.8,
    };
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
        return `\n--- ${relativePath} (lines ${range.startLine}-${range.endLine}) ---\n${range.content}`;
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
