import { CodespaceVectorService, SearchResult } from '../../AIEditor/services/codespaceVectorService';
import { ChatMessage } from '../types';
import { AIKey } from '../../AIKeysManager/types';
import { AISemanticKeywordService, SemanticKeyword } from '../../AIEditor/services/aiSemanticKeywordService';

export interface CodespaceContext {
  relevantFiles: SearchResult[];
  workspacePath: string;
  hasContext: boolean;
  reads?: Array<{ path: string; start: number; end: number; }>; // For UI display like: Read [path] [lines]
  keywordOutputs?: SemanticKeyword[]; // Raw AI keyword outputs
  primaryFiles?: Array<{ path: string; content: string }>; // Full contents for primary paths
  secondaryTechMeta?: Array<{ path: string; category: string; description?: string; relatedTerms?: string[] }>; // Metadata only
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
  async enhanceMessageWithContext(message: string, aiKey?: AIKey, model?: string): Promise<EnhancedChatMessage> {
    if (!this.currentWorkspacePath) {
      return {
        id: this.generateUUID(),
        role: 'user',
        content: message,
        timestamp: new Date()
      };
    }

    try {
      // If AI key + model are provided, use keyword-driven, path-focused pre-search
      let relevantFiles: SearchResult[] = [];

      if (aiKey && model) {
        // Build full project tree using electron's file system calls (like CodespaceVectorAnalysis)
        let projectTree = '';
        
        try {
          projectTree = await this.buildFullProjectDirectoryTree(this.currentWorkspacePath);
        } catch (error) {
          console.warn('Failed to build full directory tree, falling back to cached files:', error);
          
          // Fallback: Build from analyzed files (if available)
          const context = this.codespaceService.getCodespaceContext();
          const files = context?.files || [];
          const workspacePath = context?.workspacePath || this.currentWorkspacePath;

          const dirMap: Record<string, string[]> = {};
          for (const f of files) {
            const abs = f.path || '';
            let rel = abs.startsWith(workspacePath) ? abs.substring(workspacePath.length).replace(/^\/+/, '') : abs;
            const parts = rel.split('/');
            const name = parts.pop() || rel;
            const dir = parts.join('/') || '.';
            if (!dirMap[dir]) dirMap[dir] = [];
            dirMap[dir].push(name);
          }
          
          const sortedDirs = Object.keys(dirMap).sort();
          for (const dir of sortedDirs) {
            projectTree += (dir === '.' ? 'Root files:\n' : `${dir}/\n`);
            const names = (dirMap[dir] || []).sort();
            for (const n of names) {
              const indent = dir === '.' ? '  ' : '  '.repeat(dir.split('/').length + 1);
              projectTree += `${indent}${n}\n`;
            }
            projectTree += '\n';
          }
          projectTree = projectTree.trim();
        }

        // Generate keywords using the new prompt style
        console.log('🔍 Building project tree for AI keyword generation...');
        console.log('🔍 Project tree length:', projectTree.length);
        console.log('🔍 AI Key provider:', aiKey.providerId);
        console.log('🔍 AI Model:', model);
        
        const keywordService = AISemanticKeywordService.getInstance();
        const keywordRequest = {
          userRequest: message,
          context: `Codespace chat pre-search. Provide ONLY paths that exist in the tree.`,
          projectStructure: projectTree,
          targetLanguage: 'Any',
          maxKeywords: 5,
          includeSynonyms: false,
          includeTechnicalTerms: false,
          includeFilePatterns: false
        };

        console.log('🔍 Keyword request:', keywordRequest);
        
        let keywordResponse;
        try {
          console.log('🔍 Calling AI keyword service...');
          keywordResponse = await keywordService.generateKeywords(aiKey, model, keywordRequest);
          console.log('🔍 AI keyword response:', keywordResponse);
        } catch (error) {
          console.error('🔍 AI keyword generation failed:', error);
          keywordResponse = { success: false, keywords: [] } as { success: boolean; keywords: SemanticKeyword[] };
        }

        if (keywordResponse?.success && keywordResponse.keywords.length > 0) {
          // Read full content for primary paths; for others, keep metadata
          const primaryPaths = keywordResponse.keywords
            .filter(k => k.category === 'primary')
            .map(k => k.keyword);

          const primaryFiles: Array<{ path: string; content: string }> = [];
          const secondaryTechMeta: Array<{ path: string; category: string; description?: string; relatedTerms?: string[] }> = [];

          // Try to read primary files directly via filesystem; fallback to search if needed
          for (const kw of keywordResponse.keywords) {
            if (kw.category === 'primary') {
              try {
                // Attempt direct file read
                const absPath = kw.keyword.startsWith('/')
                  ? kw.keyword
                  : `${this.currentWorkspacePath}/${kw.keyword}`;
                const res = await window.electron.fileSystem.readFile(absPath);
                if (res.success && typeof res.content === 'string') {
                  primaryFiles.push({ path: absPath, content: res.content });
                } else {
                  // Fallback: search and use snippet context
                  const results = await this.codespaceService.searchCodespace(kw.keyword, 1);
                  if (results.length > 0) {
                    primaryFiles.push({ path: results[0].file.path, content: results[0].file.content });
                  }
                }
              } catch (_) {
                // Fallback via search
                const results = await this.codespaceService.searchCodespace(kw.keyword, 1);
                if (results.length > 0) {
                  primaryFiles.push({ path: results[0].file.path, content: results[0].file.content });
                }
              }
            } else {
              secondaryTechMeta.push({ path: kw.keyword, category: kw.category, description: kw.description, relatedTerms: kw.relatedTerms });
            }
          }

          // Do NOT run additional semantic searches; rely on primary contents and metadata only
          relevantFiles = [];

          // Reads derived from primary file contents (first 20 lines)
          const reads = (primaryFiles || []).map(pf => {
            const lines = (pf.content || '').split('\n');
            const len = Math.min(20, lines.length);
            return { path: pf.path, start: 1, end: len };
          });

          console.log('🔍 Primary files loaded:', primaryFiles.length, primaryFiles.map(pf => `${pf.path} (${pf.content.length} chars)`));
          console.log('🔍 Secondary/tech metadata:', secondaryTechMeta.length, secondaryTechMeta.map(m => `${m.path} (${m.category})`));

          const codespaceContext: CodespaceContext = {
            relevantFiles,
            workspacePath: this.currentWorkspacePath,
            hasContext: primaryFiles.length > 0 || secondaryTechMeta.length > 0, // Fix: check primary files, not relevantFiles
            reads,
            keywordOutputs: keywordResponse.keywords,
            primaryFiles,
            secondaryTechMeta
          };

          return {
            id: this.generateUUID(),
            role: 'user',
            content: message,
            timestamp: new Date(),
            codespaceContext
          };
        } else {
          // Fallback to message-based search
          relevantFiles = await this.codespaceService.searchCodespace(message, 8);
        }
      } else {
        // Default behavior: message-based semantic search
        relevantFiles = await this.codespaceService.searchCodespace(message, 8);
      }
      
      // Create lightweight read ranges for display (first 20 lines of each context snippet)
      const reads = relevantFiles.map(r => {
        const lines = (r.context || '').split('\n');
        const len = Math.min(20, lines.length);
        return { path: r.file.path, start: 1, end: len };
      });
      
      const codespaceContext: CodespaceContext = {
        relevantFiles,
        workspacePath: this.currentWorkspacePath,
        hasContext: relevantFiles.length > 0,
        reads
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
    contextPrompt += 'You have access to the following relevant project context.\n\n';

    // Include full contents for primary files (if any)
    if (codespaceContext.primaryFiles && codespaceContext.primaryFiles.length > 0) {
      contextPrompt += 'PRIMARY FILES (full content):\n';
      for (const pf of codespaceContext.primaryFiles) {
        const lang = pf.path.split('.').pop() || 'txt';
        contextPrompt += `Path: ${pf.path}\n`;
        contextPrompt += `Content:\n\`\`\`${lang}\n${pf.content}\n\`\`\`\n\n`;
      }
    }

    // Include ranked search snippets
    if (codespaceContext.relevantFiles && codespaceContext.relevantFiles.length > 0) {
      contextPrompt += 'RANKED CONTEXT SNIPPETS:\n';
    for (const result of codespaceContext.relevantFiles) {
      contextPrompt += `File: ${result.file.name} (${result.file.language})\n`;
      contextPrompt += `Path: ${result.file.path}\n`;
      contextPrompt += `Relevance: ${result.relevance}\n`;
      contextPrompt += `Context:\n\`\`\`${result.file.language}\n${result.context}\n\`\`\`\n\n`;
      }
    }

    // Include metadata for secondary/technical
    if (codespaceContext.secondaryTechMeta && codespaceContext.secondaryTechMeta.length > 0) {
      contextPrompt += 'SECONDARY/TECHNICAL PATHS (metadata only):\n';
      for (const meta of codespaceContext.secondaryTechMeta) {
        contextPrompt += `- ${meta.category.toUpperCase()}: ${meta.path}`;
        if (meta.description) contextPrompt += ` — ${meta.description}`;
        if (meta.relatedTerms && meta.relatedTerms.length > 0) contextPrompt += ` (related: ${meta.relatedTerms.join(', ')})`;
        contextPrompt += '\n';
      }
      contextPrompt += '\n';
    }

    contextPrompt += 'Use the PRIMARY FILES as the main source of truth. Use SNIPPETS for supporting evidence, and consider SECONDARY/TECHNICAL paths as references. When referencing code, always mention the file path and provide specific, actionable suggestions.';

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

  /**
   * Build full project directory tree using electron's file system calls
   * Same logic as CodespaceVectorAnalysis.buildFullProjectDirectoryTree
   */
  private async buildFullProjectDirectoryTree(rootPath: string): Promise<string> {
    type DirMap = Record<string, string[]>;
    const directoryStructure: DirMap = {};

    const addFile = (absPath: string) => {
      let relativePath = absPath.startsWith(rootPath)
        ? absPath.substring(rootPath.length).replace(/^\/+/, '')
        : absPath;
      const parts = relativePath.split('/');
      const fileName = parts.pop() || relativePath;
      const dirPath = parts.join('/');
      const key = dirPath && dirPath.length > 0 ? dirPath : '.';
      if (!directoryStructure[key]) directoryStructure[key] = [];
      directoryStructure[key].push(fileName);
    };

    const walk = async (dir: string): Promise<void> => {
      try {
        const result = await window.electron.fileSystem.readDirectory(dir);
        if (!result.success || !result.items) return;
        for (const item of result.items) {
          if (item.isFile) {
            addFile(item.path);
          } else if (item.isDirectory) {
            await walk(item.path);
          }
        }
      } catch (_) {
        // ignore and continue
      }
    };

    await walk(rootPath);

    let tree = '';
    const sortedDirs = Object.keys(directoryStructure).sort();
    sortedDirs.forEach(dir => {
      tree += dir === '.' ? `Root files:\n` : `${dir}/\n`;
      const files = (directoryStructure[dir] || []).sort();
      files.forEach(name => {
        const indent = dir === '.' ? '  ' : '  '.repeat(dir.split('/').length + 1);
        tree += `${indent}${name}\n`;
      });
      tree += '\n';
    });

    return tree.trim();
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
