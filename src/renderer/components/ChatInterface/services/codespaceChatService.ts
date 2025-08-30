import { CodespaceVectorService, SearchResult } from '../../AIEditor/services/codespaceVectorService';
import { ChatMessage } from '../types';

export interface CodespaceContext {
  relevantFiles: SearchResult[];
  workspacePath: string;
  hasContext: boolean;
}

export interface EnhancedChatMessage extends ChatMessage {
  codespaceContext?: CodespaceContext;
}

export class CodespaceChatService {
  private static instance: CodespaceChatService;
  private codespaceService: CodespaceVectorService;
  private currentWorkspacePath: string | null = null;

  private constructor() {
    this.codespaceService = CodespaceVectorService.getInstance();
  }

  static getInstance(): CodespaceChatService {
    if (!CodespaceChatService.instance) {
      CodespaceChatService.instance = new CodespaceChatService();
    }
    return CodespaceChatService.instance;
  }

  /**
   * Set the current workspace path for context
   */
  async setWorkspacePath(workspacePath: string): Promise<void> {
    this.currentWorkspacePath = workspacePath;
    
    // Pre-analyze the codespace if it hasn't been analyzed yet
    try {
      await this.codespaceService.analyzeCodespace(workspacePath);
    } catch (error) {
      console.warn('Failed to analyze codespace for chat context:', error);
    }
  }

  /**
   * Get the current workspace path
   */
  getCurrentWorkspacePath(): string | null {
    return this.currentWorkspacePath;
  }

  /**
   * Enhance a user message with relevant codespace context
   */
  async enhanceMessageWithContext(message: string): Promise<EnhancedChatMessage> {
    if (!this.currentWorkspacePath) {
      return {
        id: this.generateUUID(),
        role: 'user',
        content: message,
        timestamp: new Date()
      };
    }

    try {
      // Search for relevant files based on the message content
      const relevantFiles = await this.codespaceService.searchCodespace(message, 5);
      
      const codespaceContext: CodespaceContext = {
        relevantFiles,
        workspacePath: this.currentWorkspacePath,
        hasContext: relevantFiles.length > 0
      };

      return {
        id: this.generateUUID(),
        role: 'user',
        content: message,
        timestamp: new Date(),
        codespaceContext
      };
    } catch (error) {
      console.warn('Failed to enhance message with codespace context:', error);
      return {
        id: this.generateUUID(),
        role: 'user',
        content: message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Create a system prompt that includes relevant codespace context
   */
  createContextualSystemPrompt(
    basePrompt: string,
    codespaceContext?: CodespaceContext
  ): string {
    if (!codespaceContext || !codespaceContext.hasContext) {
      return basePrompt;
    }

    let contextPrompt = basePrompt + '\n\n';
    contextPrompt += 'You have access to the following relevant code context from the current workspace:\n\n';

    for (const result of codespaceContext.relevantFiles) {
      contextPrompt += `File: ${result.file.name} (${result.file.language})\n`;
      contextPrompt += `Path: ${result.file.path}\n`;
      contextPrompt += `Relevance: ${result.relevance}\n`;
      contextPrompt += `Context:\n\`\`\`${result.file.language}\n${result.context}\n\`\`\`\n\n`;
    }

    contextPrompt += 'Use this context to provide more accurate and helpful responses. ';
    contextPrompt += 'When referencing code, always mention the file path and provide specific, actionable suggestions. ';
    contextPrompt += 'If the user asks about specific functionality, use the code context to give precise answers.';

    return contextPrompt;
  }

  /**
   * Get a summary of the current codespace for context
   */
  async getCodespaceSummary(): Promise<string | null> {
    if (!this.currentWorkspacePath) {
      return null;
    }

    try {
      const context = this.codespaceService.getCodespaceContext();
      if (!context) {
        return null;
      }

      return `Current workspace: ${context.workspacePath}\n` +
             `Total files: ${context.totalFiles}\n` +
             `Total lines: ${context.totalLines}\n` +
             `Languages: ${Array.from(context.languages.entries())
               .map(([lang, count]) => `${lang} (${count})`)
               .join(', ')}\n` +
             `Last analyzed: ${context.lastAnalyzed.toLocaleString()}`;
    } catch (error) {
      console.warn('Failed to get codespace summary:', error);
      return null;
    }
  }

  /**
   * Check if codespace context is available
   */
  isCodespaceAvailable(): boolean {
    return this.currentWorkspacePath !== null;
  }

  /**
   * Get relevant files for a specific query
   */
  async getRelevantFiles(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.currentWorkspacePath) {
      return [];
    }

    try {
      return await this.codespaceService.searchCodespace(query, limit);
    } catch (error) {
      console.warn('Failed to get relevant files:', error);
      return [];
    }
  }

  /**
   * Force refresh of codespace analysis
   */
  async refreshCodespace(): Promise<void> {
    if (!this.currentWorkspacePath) {
      return;
    }

    try {
      await this.codespaceService.forceRefresh(this.currentWorkspacePath);
    } catch (error) {
      console.warn('Failed to refresh codespace:', error);
    }
  }

  /**
   * Get cache status information
   */
  getCacheStatus() {
    return this.codespaceService.getCacheStatus();
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
