import { FileContext } from '../types';
import { AISemanticKeywordService, GEMINI_2_0_MODELS, GEMINI_2_0_CONFIGS } from './aiSemanticKeywordService';
import { AIKey } from '../../AIKeysManager/types';

// Import the electron API types
declare global {
  interface Window {
    electron: {
      fileSystem: {
        readDirectory(path: string): Promise<{ success: boolean; items?: any[]; error?: string }>;
        readFile(path: string): Promise<{ success: boolean; content?: string; error?: string }>;
      };
    };
  }
}

export interface CodespaceContext {
  workspacePath: string;
  files: FileContext[];
  dependencies: Map<string, string[]>;
  imports: Map<string, string[]>;
  classes: Map<string, string[]>;
  functions: Map<string, string[]>;
  variables: Map<string, string[]>;
  fileTypes: Map<string, number>;
  languages: Map<string, number>;
  totalFiles: number;
  totalLines: number;
  lastAnalyzed: Date;
}

export interface SearchResult {
  file: FileContext;
  relevance: number;
  matches: string[];
  context: string;
}

export class CodespaceVectorService {
  private static instance: CodespaceVectorService;
  private codespaceContext: CodespaceContext | null = null;
  private analysisCache: Map<string, FileContext> = new Map();
  private searchIndex: Map<string, string[]> = new Map();
  
  // Cache persistence
  private cacheKey = 'codespace_vector_cache';
  private cacheExpiryHours = 24; // Cache expires after 24 hours

  // VOID ALIGNMENT: Use Void's exact constants for context gathering
  private readonly VOID_NUM_LINES = 3; // Proximity: 3 lines above/below
  private readonly VOID_MAX_SNIPPET_LINES = 7; // Max snippet size: 7 lines
  private readonly VOID_MAX_DEPTH = 3; // Depth limiting: 3 levels

  // Gemini 2.0 AI integration
  private aiSemanticService: AISemanticKeywordService;
  private currentAIKey: AIKey | null = null;
  private currentModel: string = GEMINI_2_0_MODELS.FLASH_LITE; // Default to free tier
  private aiSearchEnabled: boolean = true;

  private constructor() {
    this.aiSemanticService = AISemanticKeywordService.getInstance();
  }

  static getInstance(): CodespaceVectorService {
    if (!CodespaceVectorService.instance) {
      CodespaceVectorService.instance = new CodespaceVectorService();
    }
    return CodespaceVectorService.instance;
  }

  /**
   * Configure AI settings for codespace analysis
   */
  configureAI(aiKey: AIKey, model: string = GEMINI_2_0_MODELS.FLASH_LITE): void {
    this.currentAIKey = aiKey;
    this.currentModel = model;
    this.aiSearchEnabled = true;
    
    console.log('🤖 AI configured for codespace analysis:', {
      provider: aiKey.providerId,
      model: model,
      isGemini2: this.isGemini2Model(model)
    });
  }

  /**
   * Get current AI configuration
   */
  getAIConfig(): { aiKey: AIKey | null; model: string; enabled: boolean } {
    return {
      aiKey: this.currentAIKey,
      model: this.currentModel,
      enabled: this.aiSearchEnabled
    };
  }

  /**
   * Check if the current model is a Gemini 2.0 model
   */
  private isGemini2Model(model: string): boolean {
    return Object.values(GEMINI_2_0_MODELS).includes(model as any);
  }

  /**
   * Get Gemini 2.0 model configuration
   */
  getGemini2Config(model: string) {
    if (this.isGemini2Model(model)) {
      return GEMINI_2_0_CONFIGS[model as keyof typeof GEMINI_2_0_CONFIGS];
    }
    return null;
  }

  /**
   * Get available Gemini 2.0 models for codespace analysis
   */
  getAvailableGemini2Models(): Array<{ id: string; name: string; description: string; cost: { input: number; output: number } }> {
    return this.aiSemanticService.getAvailableGemini2Models();
  }

  /**
   * Get recommended Gemini 2.0 model for codespace analysis
   */
  getRecommendedGemini2ModelForCodespace(): string {
    // For codespace analysis, Flash Lite is usually the best choice (free, fast, sufficient quality)
    return GEMINI_2_0_MODELS.FLASH_LITE;
  }

  /**
   * Enable or disable AI-powered search
   */
  setAISearchEnabled(enabled: boolean): void {
    this.aiSearchEnabled = enabled;
    console.log(`🤖 AI search ${enabled ? 'enabled' : 'disabled'} for codespace analysis`);
  }

  /**
   * Static method to fix corrupted cache - call this from console when you have cache issues
   */
  static async fixCache(workspacePath: string): Promise<void> {
    console.log('🔧 Static cache fix called for:', workspacePath);
    
    try {
      const instance = CodespaceVectorService.getInstance();
      await instance.fixCorruptedCache(workspacePath);
      console.log('✅ Cache fixed successfully!');
    } catch (error) {
      console.error('❌ Failed to fix cache:', error);
      console.log('💡 Try manually clearing localStorage and refreshing the page');
    }
  }

  /**
   * Analyze the entire codespace to build context
   */
  async analyzeCodespace(workspacePath: string): Promise<CodespaceContext> {
    try {
      console.log('Analyzing codespace:', workspacePath);
      
      // Check if we have a valid cached version
      let cachedContext: CodespaceContext | null = null;
      try {
        cachedContext = await this.loadCachedContext(workspacePath);
        if (cachedContext) {
          console.log('🔍 Using cached codespace context');
          this.codespaceContext = cachedContext;
          return cachedContext;
        }
      } catch (error) {
        console.warn('🔍 Failed to load cached context, will perform fresh analysis:', error);
        // Clear any corrupted cache
        this.clearPersistedCache();
      }
      
      console.log('🔍 No valid cache found, performing fresh analysis...');
      
      // Get all files in the workspace
      const files = await this.scanWorkspace(workspacePath);
      console.log(`🔍 scanWorkspace returned ${files.length} files`);
      
      // Check specifically for www folder files
      const wwwFiles = files.filter(file => file.path.includes('/www/'));
      console.log(`🔍 Found ${wwwFiles.length} files in www folder:`, wwwFiles.map(f => f.path));
      
      // Log the first few files to see their content
      if (files.length > 0) {
        console.log('🔍 First few files:');
        files.slice(0, 3).forEach((file, index) => {
          console.log(`  ${index + 1}. ${file.path} - Content length: ${file.content ? file.content.length : 'undefined'}`);
          if (file.content) {
            console.log(`     First 100 chars: "${file.content.substring(0, 100)}..."`);
          } else {
            console.log(`     ❌ NO CONTENT!`);
          }
        });
      } else {
        console.log('❌ scanWorkspace returned NO files!');
      }
      
      // Limit the number of files to prevent performance issues
      const maxFiles = 100;
      if (files.length > maxFiles) {
        console.log(`🔍 Limiting analysis to first ${maxFiles} files (out of ${files.length} total)`);
        files.splice(maxFiles);
      }
      
      // Analyze each file
      const fileContexts: FileContext[] = [];
      const dependencies = new Map<string, string[]>();
      const imports = new Map<string, string[]>();
      const classes = new Map<string, string[]>();
      const functions = new Map<string, string[]>();
      const variables = new Map<string, string[]>();
      const fileTypes = new Map<string, number>();
      const languages = new Map<string, number>();
      
      let totalLines = 0;

      console.log(`🔍 Starting analysis of ${files.length} files...`);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // Show progress every 10 files
          if (i % 10 === 0) {
            console.log(`🔍 Analyzing file ${i + 1}/${files.length}: ${file.path}`);
          }
          
          // Check if file has content
          if (!file.content || file.content.length === 0) {
            console.warn(`🔍 File ${file.path} has no content, skipping analysis`);
            continue;
          }
          
          const context = await this.analyzeFile(file.path, file.content);
          fileContexts.push(context);
          
          // Update statistics
          totalLines += context.content.split('\n').length;
          
          const ext = context.extension;
          fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1);
          languages.set(context.language, (languages.get(context.language) || 0) + 1);
          
          // Build dependency maps
          if (context.dependencies.length > 0) {
            dependencies.set(context.path, context.dependencies);
          }
          
          if (context.imports.length > 0) {
            imports.set(context.path, context.imports);
          }
          
          if (context.classes.length > 0) {
            classes.set(context.path, context.classes);
          }
          
          if (context.functions.length > 0) {
            functions.set(context.path, context.functions);
          }
          
          if (context.variables.length > 0) {
            variables.set(context.path, context.variables);
          }
          
          // Cache the analysis
          this.analysisCache.set(context.path, context);
          
        } catch (error) {
          console.error(`🔍 Failed to analyze file ${file.path}:`, error);
        }
      }
      
      console.log(`🔍 Successfully analyzed ${fileContexts.length} files out of ${files.length} total`);

      // Build search index
      this.buildSearchIndex(fileContexts);

      // Ensure all Maps are properly initialized
      const codespaceContext: CodespaceContext = {
        workspacePath,
        files: fileContexts,
        dependencies: dependencies || new Map(),
        imports: imports || new Map(),
        classes: classes || new Map(),
        functions: functions || new Map(),
        variables: variables || new Map(),
        fileTypes: fileTypes || new Map(),
        languages: languages || new Map(),
        totalFiles: fileContexts.length,
        totalLines,
        lastAnalyzed: new Date()
      };

      // Validate Maps are properly initialized
      if (!codespaceContext.imports || !codespaceContext.dependencies || 
          !codespaceContext.classes || !codespaceContext.functions || 
          !codespaceContext.variables) {
        throw new Error('Failed to initialize codespace context Maps');
      }

      this.codespaceContext = codespaceContext;

      console.log('Codespace analysis complete:', {
        totalFiles: this.codespaceContext.totalFiles,
        totalLines: this.codespaceContext.totalLines,
        languages: Object.fromEntries(this.codespaceContext.languages)
      });

      // Log Map initialization status
      console.log('🔍 Maps initialized:', {
        dependencies: !!this.codespaceContext.dependencies,
        imports: !!this.codespaceContext.imports,
        classes: !!this.codespaceContext.classes,
        functions: !!this.codespaceContext.functions,
        variables: !!this.codespaceContext.variables
      });

      // Save the context to cache
      await this.saveContextToCache(workspacePath, this.codespaceContext);

      return this.codespaceContext;
    } catch (error) {
      console.error('Failed to analyze codespace:', error);
      throw error;
    }
  }

  /**
   * Scan workspace for files
   */
  private async scanWorkspace(workspacePath: string): Promise<Array<{ path: string; content: string }>> {
    try {
      // Use the available file system service to scan the workspace recursively
      console.log('Scanning workspace using available file system methods:', workspacePath);
      
      // Add timeout to prevent scanning from taking too long
      const timeoutPromise = new Promise<Array<{ path: string; content: string }>>((_, reject) => {
        setTimeout(() => reject(new Error('Workspace scanning timeout')), 60000); // Increased to 60 seconds
      });
      
      const scanPromise = this.scanDirectoryRecursive(workspacePath);
      
      const result = await Promise.race([scanPromise, timeoutPromise]);
      console.log(`✅ Workspace scanning completed successfully. Found ${result.length} files.`);
      return result;
    } catch (error) {
      console.error('❌ Failed to scan workspace:', error);
      if (error instanceof Error && error.message.includes('timeout')) {
        console.warn('⚠️ Workspace scanning timed out. This might indicate a large project or slow file system.');
      }
      return [];
    }
  }

  /**
   * Recursively scan directory for code files
   */
  private async scanDirectoryRecursive(dirPath: string, depth: number = 0): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = [];
    
    try {
      console.log(`🔍 Scanning directory: ${dirPath} (depth: ${depth})`);
      const result = await window.electron.fileSystem.readDirectory(dirPath);
      
      if (result.success && result.items) {
        console.log(`🔍 Found ${result.items.length} items in ${dirPath}`);
        
        for (const item of result.items) {
          console.log(`[DEBUG] 🔍 Processing item: ${item.name} (isFile: ${item.isFile}, isDirectory: ${item.isDirectory})`);
          
          // Skip common directories that don't contain source code
          if (this.shouldSkipDirectory(item.name)) {
            console.log(`🔍 Skipping directory: ${item.name}`);
            continue;
          }
          
          if (item.isFile) {
            // Only process code files
            if (this.isCodeFile(item.name)) {
              console.log(`[DEBUG] 🔍 Processing code file: ${item.path}`);
              try {
                const fileResult = await window.electron.fileSystem.readFile(item.path);
                if (fileResult.success && fileResult.content) {
                  console.log(`[DEBUG] 🔍 Successfully read file: ${item.path} (${fileResult.content.length} chars)`);
                  files.push({
                    path: item.path,
                    content: fileResult.content
                  });
                } else {
                  console.warn(`🔍 Failed to read file content for ${item.path}:`, fileResult.error);
                }
              } catch (error) {
                console.error(`🔍 Error reading file ${item.path}:`, error);
              }
            } else {
              console.log(`🔍 Skipping non-code file: ${item.name}`);
            }
          } else if (item.isDirectory) {
            console.log(`🔍 Recursively scanning subdirectory: ${item.path}`);
            
            // Special debug for www directory
            if (item.name === 'www') {
              console.log(`[DEBUG] 🔍 Found www directory! Scanning contents...`);
            }
            
            // Recursively scan subdirectories (no depth limit for now)
            const subFiles = await this.scanDirectoryRecursive(item.path, depth + 1);
            console.log(`🔍 Found ${subFiles.length} files in subdirectory: ${item.path}`);
            files.push(...subFiles);
          }
        }
      } else {
        console.error(`🔍 Failed to read directory ${dirPath}:`, result.error);
      }
    } catch (error) {
      console.error(`🔍 Failed to scan directory ${dirPath}:`, error);
    }
    
    console.log(`🔍 Returning ${files.length} files from ${dirPath}`);
    return files;
  }

  /**
   * Check if a directory should be skipped during scanning
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'out',
      'coverage', '.nyc_output', 'tmp', 'temp', 'logs', 'cache',
      '.next', '.nuxt', '.output', '.svelte-kit', '.astro'
    ];
    
    const shouldSkip = skipDirs.includes(dirName);
    if (shouldSkip) {
      console.log(`🔍 Skipping directory: ${dirName} (in skip list)`);
    } else {
      console.log(`🔍 Including directory: ${dirName} (not in skip list)`);
    }
    
    return shouldSkip;
  }

  /**
   * Check if a file is a code file that should be analyzed
   */
  private isCodeFile(fileName: string): boolean {
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
      '.php', '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
      '.rs', '.go', '.rb', '.swift', '.kt', '.scala', '.clj', '.hs', '.ml',
      '.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.md', '.txt'
    ];
    return codeExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(filePath: string, content: string): Promise<FileContext> {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    const language = this.getLanguageFromExtension(extension);
    
    const context: FileContext = {
      path: filePath,
      name: filePath.split('/').pop() || filePath,
      extension,
      language,
      content,
      size: content.length,
      lastModified: new Date(),
      imports: [],
      classes: [],
      functions: [],
      variables: [],
      dependencies: []
    };

    // Extract language-specific context
    switch (language) {
      case 'typescript':
      case 'javascript':
        context.imports = this.extractJavaScriptImports(content);
        context.classes = this.extractJavaScriptClasses(content);
        context.functions = this.extractJavaScriptFunctions(content);
        context.variables = this.extractJavaScriptVariables(content);
        context.dependencies = this.extractJavaScriptDependencies(content);
        break;
      case 'python':
        context.imports = this.extractPythonImports(content);
        context.classes = this.extractPythonClasses(content);
        context.functions = this.extractPythonFunctions(content);
        context.variables = this.extractPythonVariables(content);
        context.dependencies = this.extractPythonDependencies(content);
        break;
      case 'java':
        context.imports = this.extractJavaImports(content);
        context.classes = this.extractJavaClasses(content);
        context.functions = this.extractJavaMethods(content);
        context.variables = this.extractJavaFields(content);
        context.dependencies = this.extractJavaDependencies(content);
        break;
      case 'cpp':
      case 'c':
        context.imports = this.extractCppImports(content);
        context.classes = this.extractCppClasses(content);
        context.functions = this.extractCppFunctions(content);
        context.variables = this.extractCppVariables(content);
        context.dependencies = this.extractCppDependencies(content);
        break;
    }

    return context;
  }

  /**
   * Build search index for semantic search
   */
  private buildSearchIndex(fileContexts: FileContext[]): void {
    this.searchIndex.clear();
    
    for (const context of fileContexts) {
      const tokens = this.tokenizeContent(context.content);
      const metadata = [
        context.name,
        context.language,
        ...context.imports,
        ...context.classes,
        ...context.functions,
        ...context.variables
      ];
      
      const allTokens = [...tokens, ...metadata];
      
      for (const token of allTokens) {
        if (!this.searchIndex.has(token)) {
          this.searchIndex.set(token, []);
        }
        this.searchIndex.get(token)!.push(context.path);
      }
    }
  }

  /**
   * Tokenize content for search indexing
   */
  private tokenizeContent(content: string): string[] {
    return content
      .split(/[\s\n\r\t.,;:(){}\[\]"'`~!@#$%^&*+=|\\<>/?]+/)
      .filter(token => token.length > 2)
      .map(token => token.toLowerCase())
      .filter((token, index, arr) => arr.indexOf(token) === index); // Remove duplicates
  }

  /**
   * AI-powered semantic search using Gemini 2.0 models
   * This replaces the basic token matching with intelligent semantic understanding
   */
  async searchCodespaceWithAI(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.codespaceContext) {
      throw new Error('Codespace not analyzed. Call analyzeCodespace() first.');
    }

    if (!this.aiSearchEnabled || !this.currentAIKey) {
      console.log('🤖 AI search disabled or no AI key configured, falling back to basic search');
      return this.searchCodespaceBasic(query, limit);
    }

    console.log('🤖 AI-powered semantic search for:', query, 'using model:', this.currentModel);
    
    try {
      // Step 1: Use Gemini 2.0 to understand the query and generate relevant search terms
      const enhancedQuery = await this.enhanceQueryWithGemini2(query);
      console.log('🤖 Gemini 2.0 enhanced query:', enhancedQuery);
      
      // Step 2: Perform semantic search using the enhanced query
      const results = await this.performSemanticSearch(enhancedQuery, query, limit);
      
      console.log('🤖 Gemini 2.0 search found', results.length, 'semantically relevant files');
      return results;
      
    } catch (error) {
      console.error('🤖 Gemini 2.0 search failed, falling back to basic search:', error);
      // Fallback to the original token-based search
      return this.searchCodespaceBasic(query, limit);
    }
  }

  /**
   * Use Gemini 2.0 to understand natural language queries and generate relevant search terms
   */
  private async enhanceQueryWithGemini2(query: string): Promise<string[]> {
    if (!this.currentAIKey) {
      throw new Error('No AI key configured for Gemini 2.0 search');
    }

    try {
      // Build project context for better keyword generation
      const projectStructure = this.buildProjectStructureForAI();
      
      const request = {
        userRequest: query,
        context: `Codespace search query: "${query}". Generate keywords that would help find relevant files in this project.`,
        projectStructure: projectStructure,
        targetLanguage: this.detectPrimaryLanguage(),
        maxKeywords: 15,
        includeSynonyms: true,
        includeTechnicalTerms: true,
        includeFilePatterns: true
      };

      console.log('🤖 Sending request to Gemini 2.0:', {
        model: this.currentModel,
        query: query,
        projectStructure: projectStructure ? 'Available' : 'Not available'
      });

      const response = await this.aiSemanticService.generateKeywords(
        this.currentAIKey,
        this.currentModel,
        request
      );

      if (response.success && response.keywords.length > 0) {
        // Extract keywords from the AI response
        const enhancedTerms = response.keywords.map(k => k.keyword);
        console.log('🤖 Gemini 2.0 generated terms:', enhancedTerms);
        return enhancedTerms;
      } else {
        console.warn('🤖 Gemini 2.0 failed to generate keywords, using fallback semantic mappings');
        return this.enhanceQueryWithFallback(query);
      }

    } catch (error) {
      console.error('🤖 Gemini 2.0 enhancement failed:', error);
      return this.enhanceQueryWithFallback(query);
    }
  }

  /**
   * Build project structure string for AI context
   */
  private buildProjectStructureForAI(): string {
    if (!this.codespaceContext || !this.codespaceContext.files) {
      return '';
    }

    try {
      const files = this.codespaceContext.files;
      const maxFiles = 50; // Limit to prevent overwhelming the AI
      const selectedFiles = files.slice(0, maxFiles);
      
      // Group files by directory
      const directoryStructure: Record<string, string[]> = {};
      
      selectedFiles.forEach(file => {
        const dir = file.path.split('/').slice(0, -1).join('/') || '.';
        if (!directoryStructure[dir]) {
          directoryStructure[dir] = [];
        }
        directoryStructure[dir].push(file.name);
      });

      // Build a readable structure
      let structure = 'Project Structure:\n';
      for (const [dir, files] of Object.entries(directoryStructure)) {
        structure += `${dir}/\n`;
        files.slice(0, 10).forEach(file => { // Limit files per directory
          structure += `  ${file}\n`;
        });
        if (files.length > 10) {
          structure += `  ... and ${files.length - 10} more files\n`;
        }
      }

      return structure;
    } catch (error) {
      console.warn('Failed to build project structure for AI:', error);
      return '';
    }
  }

  /**
   * Detect primary programming language from codespace
   */
  private detectPrimaryLanguage(): string {
    if (!this.codespaceContext || !this.codespaceContext.languages) {
      return 'Unknown';
    }

    try {
      const languages = this.codespaceContext.languages;
      let maxCount = 0;
      let primaryLanguage = 'Unknown';

      for (const [lang, count] of languages.entries()) {
        if (count > maxCount) {
          maxCount = count;
          primaryLanguage = lang;
        }
      }

      return primaryLanguage;
    } catch (error) {
      console.warn('Failed to detect primary language:', error);
      return 'Unknown';
    }
  }

  /**
   * Fallback semantic mappings when AI is not available
   */
  private enhanceQueryWithFallback(query: string): string[] {
    // Common semantic mappings for web development
    const semanticMappings: Record<string, string[]> = {
      // Homepage related
      'homepage': ['index.php', 'index.html', 'main.php', 'home.php', 'default.php'],
      'home page': ['index.php', 'index.html', 'main.php', 'home.php', 'default.php'],
      'main page': ['index.php', 'index.html', 'main.php', 'home.php', 'default.php'],
      'landing page': ['index.php', 'index.html', 'main.php', 'home.php', 'default.php'],
      'entry point': ['index.php', 'index.html', 'main.php', 'home.php', 'default.php'],
      'main entry': ['index.php', 'index.html', 'main.php', 'home.php', 'default.php'],
      
      // Website related
      'website': ['index.php', 'index.html', 'main.php', 'home.php', 'default.php', 'config.php'],
      'site': ['index.php', 'index.html', 'main.php', 'home.php', 'default.php', 'config.php'],
      'web app': ['index.php', 'index.html', 'main.php', 'home.php', 'default.php', 'app.php'],
      
      // WordPress specific
      'wordpress': ['index.php', 'wp-config.php', 'wp-load.php', 'wp-blog-header.php'],
      'wp': ['index.php', 'wp-config.php', 'wp-load.php', 'wp-blog-header.php'],
      
      // File types
      'php file': ['.php'],
      'html file': ['.html', '.htm'],
      'css file': ['.css', '.scss', '.sass'],
      'javascript file': ['.js', '.jsx', '.ts', '.tsx'],
      
      // Common web concepts
      'header': ['header.php', 'header.html', 'nav.php', 'navigation.php'],
      'footer': ['footer.php', 'footer.html'],
      'menu': ['menu.php', 'nav.php', 'navigation.php'],
      'navigation': ['nav.php', 'navigation.php', 'menu.php'],
      'sidebar': ['sidebar.php', 'sidebar.html'],
      
      // Error related
      'error': ['error.php', 'error.html', '404.php', '500.php'],
      'fix': ['index.php', 'main.php', 'config.php', 'error.php'],
      'broken': ['index.php', 'main.php', 'config.php', 'error.php'],
      'not working': ['index.php', 'main.php', 'config.php', 'error.php'],
      
      // Server related
      'server': ['index.php', 'config.php', '.htaccess', 'server.php'],
      'localhost': ['index.php', 'config.php', 'localhost.php'],
      'port': ['index.php', 'config.php', 'server.php'],
    };

    // Generate enhanced search terms
    const enhancedTerms: string[] = [];
    const queryLower = query.toLowerCase();
    
    // Add original query terms
    enhancedTerms.push(...this.tokenizeContent(query));
    
    // Add semantic mappings
    for (const [key, values] of Object.entries(semanticMappings)) {
      if (queryLower.includes(key)) {
        enhancedTerms.push(...values);
        console.log('🤖 Semantic mapping found:', key, '→', values);
      }
    }
    
    // Add common web development terms
    if (this.isWebRelatedQuery(query)) {
      enhancedTerms.push('index.php', 'index.html', 'main.php', 'home.php', 'config.php');
      console.log('🤖 Added web-related terms for query');
    }
    
    // Add file extensions based on context
    if (this.isPHPRelatedQuery(query)) {
      enhancedTerms.push('.php', 'php');
    }
    if (this.isHTMLRelatedQuery(query)) {
      enhancedTerms.push('.html', '.htm', 'html');
    }
    
    // Remove duplicates and filter
    const uniqueTerms = Array.from(new Set(enhancedTerms))
      .filter(term => term.length > 0)
      .slice(0, 20); // Limit to prevent overwhelming
    
    console.log('🤖 Enhanced search terms:', uniqueTerms);
    return uniqueTerms;
  }

  /**
   * Perform semantic search using enhanced terms
   */
  private async performSemanticSearch(enhancedTerms: string[], originalQuery: string, limit: number): Promise<SearchResult[]> {
    const workspacePath = this.codespaceContext?.workspacePath || '';
    const fileScores = new Map<string, { score: number; matches: string[]; semanticRelevance: number }>();
    
    // Calculate semantic relevance for each file
    for (const file of this.codespaceContext!.files) {
      let score = 0;
      let matches: string[] = [];
      let semanticRelevance = 0;
      
      // Check filename relevance
      const fileName = file.name.toLowerCase();
      const filePath = file.path.toLowerCase();
      
      for (const term of enhancedTerms) {
        const termLower = term.toLowerCase();
        
        // Exact filename match (highest priority)
        if (fileName === termLower || fileName === termLower.replace('.', '')) {
          score += 10;
          semanticRelevance += 5;
          if (!matches.includes(term)) matches.push(term);
        }
        // Filename contains term
        else if (fileName.includes(termLower) || termLower.includes(fileName)) {
          score += 8;
          semanticRelevance += 4;
          if (!matches.includes(term)) matches.push(term);
        }
        // Path contains term
        else if (filePath.includes(termLower)) {
          score += 6;
          semanticRelevance += 3;
          if (!matches.includes(term)) matches.push(term);
        }
        // Content contains term
        else if (file.content.toLowerCase().includes(termLower)) {
          score += 4;
          semanticRelevance += 2;
          if (!matches.includes(term)) matches.push(term);
        }
      }
      
      // Boost scores for common web files
      if (this.isCommonWebFile(file.name)) {
        score += 3;
        semanticRelevance += 2;
      }
      
      // Boost scores for files that match the original query intent
      if (this.matchesQueryIntent(file, originalQuery)) {
        score += 5;
        semanticRelevance += 3;
      }
      
      // VOID ALIGNMENT: Prioritize files by directory depth for landing page queries
      if (this.isLandingPageQuery(originalQuery)) {
        const depthScore = this.calculateDepthScore(file.path, workspacePath);
        score += depthScore;
        semanticRelevance += depthScore;
      }
      
      if (score > 0) {
        fileScores.set(file.path, { score, matches, semanticRelevance });
      }
    }
    
    // Convert to search results and sort by relevance
    const results: SearchResult[] = [];
    
    for (const [filePath, { score, matches, semanticRelevance }] of Array.from(fileScores.entries())) {
      const file = this.codespaceContext!.files.find(f => f.path === filePath);
      if (file) {
        results.push({
          file,
          relevance: score + semanticRelevance, // Combine both scores
          matches,
          context: this.extractSearchContext(file.content, matches)
        });
      }
    }
    
    // Sort by combined relevance score
    const sortedResults = results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
    
    return sortedResults;
  }

  /**
   * Check if query is web-related
   */
  private isWebRelatedQuery(query: string): boolean {
    const webTerms = ['website', 'web', 'homepage', 'page', 'site', 'server', 'localhost', 'php', 'html', 'wordpress'];
    return webTerms.some(term => query.toLowerCase().includes(term));
  }

  /**
   * Check if query is PHP-related
   */
  private isPHPRelatedQuery(query: string): boolean {
    const phpTerms = ['php', 'wordpress', 'server', 'backend', 'database'];
    return phpTerms.some(term => query.toLowerCase().includes(term));
  }

  /**
   * Check if query is HTML-related
   */
  private isHTMLRelatedQuery(query: string): boolean {
    const htmlTerms = ['html', 'webpage', 'frontend', 'css', 'javascript'];
    return htmlTerms.some(term => query.toLowerCase().includes(term));
  }

  /**
   * Check if file is a common web file
   */
  private isCommonWebFile(fileName: string): boolean {
    const commonWebFiles = ['index.php', 'index.html', 'main.php', 'home.php', 'config.php', 'wp-config.php'];
    return commonWebFiles.includes(fileName.toLowerCase());
  }

  /**
   * Check if file matches the original query intent
   */
  private matchesQueryIntent(file: FileContext, query: string): boolean {
    const queryLower = query.toLowerCase();
    
    // If asking about homepage/initial page, prioritize index files
    if (queryLower.includes('home') || queryLower.includes('initial') || queryLower.includes('main')) {
      return file.name.toLowerCase().includes('index') || file.name.toLowerCase().includes('main');
    }
    
    // If asking about fixing something, prioritize main entry points
    if (queryLower.includes('fix') || queryLower.includes('broken') || queryLower.includes('error')) {
      return file.name.toLowerCase().includes('index') || file.name.toLowerCase().includes('main') || file.name.toLowerCase().includes('config');
    }
    
    // If asking about website structure, prioritize configuration files
    if (queryLower.includes('website') || queryLower.includes('site')) {
      return file.name.toLowerCase().includes('index') || file.name.toLowerCase().includes('config');
    }
    
    return false;
  }

  /**
   * VOID ALIGNMENT: Check if query is about landing page/homepage
   */
  private isLandingPageQuery(query: string): boolean {
    const queryLower = query.toLowerCase();
    const landingPageTerms = [
      'landing page', 'homepage', 'home page', 'main page', 'entry point', 
      'main entry', 'start page', 'index page', 'root page'
    ];
    return landingPageTerms.some(term => queryLower.includes(term));
  }

  /**
   * VOID ALIGNMENT: Calculate depth-based score for file prioritization
   */
  private calculateDepthScore(filePath: string, workspacePath: string): number {
    // Remove workspace path from file path to get relative path
    let relativePath = filePath;
    if (workspacePath && filePath.startsWith(workspacePath)) {
      relativePath = filePath.substring(workspacePath.length);
    }
    
    // Clean up the relative path
    relativePath = relativePath.replace(/^\/+/, '').replace(/\/+$/, '');
    
    // Count directory separators to determine depth
    const depth = relativePath ? (relativePath.match(/\//g) || []).length : 0;
    
    // Root level files (depth 0) get highest score
    // Deeper files get progressively lower scores
    if (depth === 0) {
      return 15; // Highest priority for root files
    } else if (depth === 1) {
      return 10; // Good priority for first level
    } else if (depth === 2) {
      return 5;  // Medium priority for second level
    } else {
      return 0;  // Lower priority for deeper files
    }
  }

  /**
   * Enhanced search that tries AI first, falls back to basic search
   */
  async searchCodespace(query: string, limit: number = 10): Promise<SearchResult[]> {
    // Try AI-powered search first
    try {
      return await this.searchCodespaceWithAI(query, limit);
    } catch (error) {
      console.log('🤖 AI search failed, using basic token search as fallback');
      return this.searchCodespaceBasic(query, limit);
    }
  }

  /**
   * Get AI-powered insights about the codespace using Gemini 2.0
   */
  async getCodespaceInsights(query: string = 'Analyze this project structure and provide insights'): Promise<{
    success: boolean;
    insights?: string;
    error?: string;
    model: string;
    timestamp: string;
  }> {
    if (!this.currentAIKey || !this.aiSearchEnabled) {
      return {
        success: false,
        error: 'AI not configured or disabled',
        model: 'none',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const projectStructure = this.buildProjectStructureForAI();
      const primaryLanguage = this.detectPrimaryLanguage();
      
      const request = {
        userRequest: query,
        context: `Analyze this project structure and provide insights about architecture, patterns, and potential improvements.`,
        projectStructure: projectStructure,
        targetLanguage: primaryLanguage,
        maxKeywords: 20,
        includeSynonyms: true,
        includeTechnicalTerms: true,
        includeFilePatterns: true
      };

      console.log('🤖 Getting codespace insights with Gemini 2.0:', {
        model: this.currentModel,
        query: query,
        language: primaryLanguage
      });

      const response = await this.aiSemanticService.generateKeywords(
        this.currentAIKey,
        this.currentModel,
        request
      );

      if (response.success && response.keywords.length > 0) {
        // Convert keywords to insights
        const insights = this.convertKeywordsToInsights(response.keywords, projectStructure);
        
        return {
          success: true,
          insights,
          model: this.currentModel,
          timestamp: new Date().toISOString()
        };
      } else {
        return {
          success: false,
          error: response.error || 'Failed to generate insights',
          model: this.currentModel,
          timestamp: new Date().toISOString()
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get insights',
        model: this.currentModel,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Convert AI-generated keywords to readable insights
   */
  private convertKeywordsToInsights(keywords: any[], projectStructure: string): string {
    if (!keywords || keywords.length === 0) {
      return 'No insights available.';
    }

    let insights = '## Project Analysis Insights\n\n';
    
    // Group keywords by category
    const categories = {
      primary: keywords.filter(k => k.category === 'primary'),
      secondary: keywords.filter(k => k.category === 'secondary'),
      technical: keywords.filter(k => k.category === 'technical'),
      synonym: keywords.filter(k => k.category === 'synonym')
    };

    // Primary insights
    if (categories.primary.length > 0) {
      insights += '### 🎯 Key Components\n';
      categories.primary.forEach(keyword => {
        insights += `- **${keyword.keyword}**: ${keyword.description || 'Important project component'}\n`;
      });
      insights += '\n';
    }

    // Technical patterns
    if (categories.technical.length > 0) {
      insights += '### 🔧 Technical Patterns\n';
      categories.technical.forEach(keyword => {
        insights += `- **${keyword.keyword}**: ${keyword.description || 'Technical implementation pattern'}\n`;
      });
      insights += '\n';
    }

    // Related terms
    if (categories.synonym.length > 0) {
      insights += '### 🔗 Related Concepts\n';
      categories.synonym.forEach(keyword => {
        insights += `- **${keyword.keyword}**: ${keyword.description || 'Related project concept'}\n`;
      });
      insights += '\n';
    }

    // Project structure summary
    if (projectStructure) {
      insights += '### 📁 Project Structure\n';
      insights += 'The project follows a well-organized structure with clear separation of concerns.\n\n';
    }

    insights += '---\n*Insights generated using Gemini 2.0 AI analysis*';
    
    return insights;
  }

  /**
   * Original basic token-based search (renamed for clarity)
   */
  private async searchCodespaceBasic(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!this.codespaceContext) {
      throw new Error('Codespace not analyzed. Call analyzeCodespace() first.');
    }

    const queryTokens = this.tokenizeContent(query);
    const fileScores = new Map<string, { score: number; matches: string[] }>();

    // Calculate relevance scores for each file
    for (const [token, filePaths] of Array.from(this.searchIndex.entries())) {
      if (queryTokens.some(qt => token.includes(qt) || qt.includes(token))) {
        for (const filePath of filePaths) {
          if (!fileScores.has(filePath)) {
            fileScores.set(filePath, { score: 0, matches: [] });
          }
          
          const fileScore = fileScores.get(filePath)!;
          fileScore.score += 1;
          if (!fileScore.matches.includes(token)) {
            fileScore.matches.push(token);
          }
        }
      }
    }

    // Convert to search results and sort by relevance
    const results: SearchResult[] = [];
    
    for (const [filePath, { score, matches }] of Array.from(fileScores.entries())) {
      const file = this.codespaceContext!.files.find(f => f.path === filePath);
      if (file) {
        results.push({
          file,
          relevance: score,
          matches,
          context: this.extractSearchContext(file.content, matches)
        });
      }
    }

    // Sort by relevance and limit results
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * Extract context around search matches using Void's exact approach
   * - Proximity: 3 lines above/below (VOID_NUM_LINES)
   * - Max snippet size: 7 lines (VOID_MAX_SNIPPET_LINES)
   * - Depth limiting: 3 levels (VOID_MAX_DEPTH)
   */
  private extractSearchContext(content: string, matches: string[]): string {
    const lines = content.split('\n');
    const contextLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (matches.some(match => line.toLowerCase().includes(match.toLowerCase()))) {
        // VOID ALIGNMENT: Use Void's exact proximity approach (3 lines above/below)
        const start = Math.max(0, i - this.VOID_NUM_LINES);
        const end = Math.min(lines.length, i + this.VOID_NUM_LINES + 1);
        
        // VOID ALIGNMENT: Respect max snippet size (7 lines)
        const snippetLines = lines.slice(start, end);
        if (snippetLines.length > this.VOID_MAX_SNIPPET_LINES) {
          // Trim to Void's exact limit while keeping the match line centered
          const centerIndex = Math.floor((start + end) / 2);
          const halfSize = Math.floor(this.VOID_MAX_SNIPPET_LINES / 2);
          const adjustedStart = Math.max(0, centerIndex - halfSize);
          const adjustedEnd = Math.min(lines.length, adjustedStart + this.VOID_MAX_SNIPPET_LINES);
          
          for (let j = adjustedStart; j < adjustedEnd; j++) {
            if (!contextLines.includes(lines[j])) {
              contextLines.push(lines[j]);
            }
          }
        } else {
          // Add all lines within Void's proximity range
          for (let j = start; j < end; j++) {
            if (!contextLines.includes(lines[j])) {
              contextLines.push(lines[j]);
            }
          }
        }
      }
    }
    
    // VOID ALIGNMENT: Limit total context to prevent overwhelming
    const maxContextLines = this.VOID_MAX_SNIPPET_LINES * 2; // Allow up to 2 snippets
    return contextLines.slice(0, maxContextLines).join('\n');
  }

  /**
   * Get relevant context for AI editing
   */
  async getEditingContext(
    targetFile: string,
    instruction: string,
    includeRelated: boolean = true
  ): Promise<{
    targetFile: FileContext;
    relatedFiles: FileContext[];
    dependencies: string[];
    imports: string[];
    classes: string[];
    functions: string[];
    variables: string[];
  }> {
    if (!this.codespaceContext) {
      throw new Error('Codespace not analyzed. Call analyzeCodespace() first.');
    }

    // Ensure Maps are properly initialized
    if (!this.codespaceContext.imports || !this.codespaceContext.dependencies || 
        !this.codespaceContext.classes || !this.codespaceContext.functions || 
        !this.codespaceContext.variables) {
      console.warn('🔍 Codespace context Maps not properly initialized, re-analyzing...');
      await this.forceRefresh(this.codespaceContext.workspacePath);
      if (!this.codespaceContext.imports || !this.codespaceContext.dependencies) {
        throw new Error('Failed to initialize codespace context Maps');
      }
    }

    // Try to find the target file by different path formats
    let target = this.codespaceContext.files.find(f => f.path === targetFile);
    console.log(`🔍 Looking for target file: ${targetFile}`);
    console.log(`🔍 Available files in codespace: ${this.codespaceContext.files.length}`);
    
    // If not found by exact path, try to find by filename
    if (!target) {
      const fileName = targetFile.split('/').pop();
      console.log(`🔍 Not found by exact path, trying filename: ${fileName}`);
      target = this.codespaceContext.files.find(f => f.name === fileName);
    }
    
    // If still not found, try to find by partial path match
    if (!target) {
      console.log(`🔍 Not found by filename, trying partial path match`);
      target = this.codespaceContext.files.find(f => 
        f.path.includes(targetFile.split('/').pop() || '') ||
        targetFile.includes(f.name)
      );
    }
    
    if (!target) {
      console.warn(`🔍 File not found in codespace context: ${targetFile}`);
      console.log('🔍 Available files:', this.codespaceContext.files.map(f => `${f.path} (${f.content ? f.content.length : 0} chars)`));
      
      // Return a minimal context to prevent errors
      return {
        targetFile: {
          path: targetFile,
          name: targetFile.split('/').pop() || targetFile,
          extension: targetFile.split('.').pop() || '',
          language: 'unknown',
          content: '',
          size: 0,
          lastModified: new Date(),
          imports: [],
          classes: [],
          functions: [],
          variables: [],
          dependencies: []
        },
        relatedFiles: [],
        dependencies: [],
        imports: [],
        classes: [],
        functions: [],
        variables: []
      };
    }
    
    console.log(`🔍 Found target file: ${target.path} with ${target.content ? target.content.length : 0} chars of content`);

    let relatedFiles: FileContext[] = [];
    
    if (includeRelated) {
      // Find related files based on dependencies and imports
      const relatedPaths = new Set<string>();
      
      // Add files that import this file
      for (const [filePath, imports] of Array.from(this.codespaceContext.imports.entries())) {
        if (imports.some(imp => imp.includes(target.name) || imp.includes(target.path))) {
          relatedPaths.add(filePath);
        }
      }
      
      // Add files that this file imports
      for (const imp of target.imports) {
        const relatedFile = this.codespaceContext.files.find(f => 
          f.name.includes(imp) || f.path.includes(imp)
        );
        if (relatedFile) {
          relatedPaths.add(relatedFile.path);
        }
      }
      
      // Add files with similar patterns
      const searchResults = await this.searchCodespace(instruction, 5);
      for (const result of searchResults) {
        if (result.file.path !== targetFile) {
          relatedPaths.add(result.file.path);
        }
      }
      
      relatedFiles = this.codespaceContext.files.filter(f => relatedPaths.has(f.path));
      
      // 🔍 DEBUG: Log what related files were found and their content
      console.log(`🔍 Found ${relatedFiles.length} related files:`);
      relatedFiles.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.path}`);
        console.log(`     Content length: ${file.content ? file.content.length : 'undefined'}`);
        if (file.content) {
          console.log(`     First 100 chars: "${file.content.substring(0, 100)}..."`);
        } else {
          console.log(`     ❌ NO CONTENT!`);
        }
      });
    }

    return {
      targetFile: target,
      relatedFiles,
      dependencies: target.dependencies,
      imports: target.imports,
      classes: target.classes,
      functions: target.functions,
      variables: target.variables
    };
  }

  /**
   * VOID ALIGNMENT: Get Void-style context for a specific file and position
   * This method provides context that's compatible with Void's ContextGatheringService
   */
  async getVoidStyleContext(
    filePath: string,
    lineNumber: number,
    includeRelated: boolean = true
  ): Promise<{
    proximityContext: string;
    relatedFiles: string[];
    symbolContext: string[];
    totalSnippets: number;
  }> {
    if (!this.codespaceContext) {
      throw new Error('Codespace not analyzed. Call analyzeCodespace() first.');
    }

    const targetFile = this.codespaceContext.files.find(f => f.path === filePath);
    if (!targetFile || !targetFile.content) {
      return {
        proximityContext: '',
        relatedFiles: [],
        symbolContext: [],
        totalSnippets: 0
      };
    }

    // VOID ALIGNMENT: Extract proximity context (3 lines above/below)
    const lines = targetFile.content.split('\n');
    const startLine = Math.max(0, lineNumber - this.VOID_NUM_LINES);
    const endLine = Math.min(lines.length - 1, lineNumber + this.VOID_NUM_LINES);
    
    // VOID ALIGNMENT: Respect max snippet size (7 lines)
    let proximityContext = lines.slice(startLine, endLine + 1).join('\n');
    if (proximityContext.split('\n').length > this.VOID_MAX_SNIPPET_LINES) {
      const centerIndex = Math.floor((startLine + endLine) / 2);
      const halfSize = Math.floor(this.VOID_MAX_SNIPPET_LINES / 2);
      const adjustedStart = Math.max(0, centerIndex - halfSize);
      const adjustedEnd = Math.min(lines.length, adjustedStart + this.VOID_MAX_SNIPPET_LINES);
      proximityContext = lines.slice(adjustedStart, adjustedEnd).join('\n');
    }

    // Find related files (respecting Void's depth limiting)
    const relatedFiles: string[] = [];
    if (includeRelated) {
      const relatedPaths = new Set<string>();
      
      // Add files that import this file (depth 1)
      for (const [filePath, imports] of Array.from(this.codespaceContext.imports.entries())) {
        if (imports.some(imp => imp.includes(targetFile.name) || imp.includes(targetFile.path))) {
          relatedPaths.add(filePath);
        }
      }
      
      // Add files that this file imports (depth 1)
      if (targetFile.imports) {
        for (const imp of targetFile.imports) {
          const importingFiles = Array.from(this.codespaceContext.imports.entries())
            .filter(([_, imports]) => imports.some(i => i.includes(imp)))
            .map(([filePath, _]) => filePath);
          importingFiles.forEach(fp => relatedPaths.add(fp));
        }
      }
      
      // VOID ALIGNMENT: Limit to prevent overwhelming (max 5 related files)
      relatedFiles.push(...Array.from(relatedPaths).slice(0, 5));
    }

    // Extract symbol context (function/class definitions)
    const symbolContext: string[] = [];
    if (targetFile.functions && targetFile.functions.length > 0) {
      // Get function definitions (limited to Void's snippet size)
      for (const func of targetFile.functions.slice(0, 3)) { // Max 3 functions
        const funcLines = lines.filter(line => line.includes(func));
        if (funcLines.length > 0) {
          const funcContext = funcLines.slice(0, this.VOID_MAX_SNIPPET_LINES).join('\n');
          symbolContext.push(funcContext);
        }
      }
    }

    if (targetFile.classes && targetFile.classes.length > 0) {
      // Get class definitions (limited to Void's snippet size)
      for (const cls of targetFile.classes.slice(0, 2)) { // Max 2 classes
        const classLines = lines.filter(line => line.includes(cls));
        if (classLines.length > 0) {
          const classContext = classLines.slice(0, this.VOID_MAX_SNIPPET_LINES).join('\n');
          symbolContext.push(classContext);
        }
      }
    }

    const totalSnippets = 1 + relatedFiles.length + symbolContext.length; // proximity + related + symbols

    console.log(`🔍 Void-style context gathered: ${totalSnippets} total snippets`);
    console.log(`🔍 Proximity context: ${proximityContext.split('\n').length} lines`);
    console.log(`🔍 Related files: ${relatedFiles.length}`);
    console.log(`🔍 Symbol context: ${symbolContext.length} definitions`);

    return {
      proximityContext,
      relatedFiles,
      symbolContext,
      totalSnippets
    };
  }

  /**
   * VOID ALIGNMENT: Enhanced search that respects Void's context limits
   */
  async searchCodespaceVoidStyle(query: string, limit: number = 5): Promise<SearchResult[]> {
    // Use existing search but apply Void's context limits
    const results = await this.searchCodespace(query, limit);
    
    // Apply Void's context optimization to each result
    return results.map(result => ({
      ...result,
      context: this.optimizeContextForVoid(result.context)
    }));
  }

  /**
   * VOID ALIGNMENT: Optimize context to respect Void's limits
   */
  private optimizeContextForVoid(context: string): string {
    const lines = context.split('\n');
    
    // VOID ALIGNMENT: Respect max snippet size (7 lines)
    if (lines.length <= this.VOID_MAX_SNIPPET_LINES) {
      return context;
    }
    
    // Trim to Void's exact limit while preserving important content
    const optimizedLines = lines.slice(0, this.VOID_MAX_SNIPPET_LINES);
    return optimizedLines.join('\n') + '\n// ... (truncated following Void\'s context limits)';
  }

  /**
   * Get current codespace context
   */
  getCodespaceContext(): CodespaceContext | null {
    return this.codespaceContext;
  }

  /**
   * Get debug information about the current context
   */
  getDebugInfo(): {
    hasContext: boolean;
    contextType: string;
    mapsInitialized: boolean;
    fileCount: number;
    cacheStatus: any;
  } {
    if (!this.codespaceContext) {
      return {
        hasContext: false,
        contextType: 'none',
        mapsInitialized: false,
        fileCount: 0,
        cacheStatus: this.getCacheStatus()
      };
    }

    const mapsInitialized = !!(
      this.codespaceContext.imports &&
      this.codespaceContext.dependencies &&
      this.codespaceContext.classes &&
      this.codespaceContext.functions &&
      this.codespaceContext.variables
    );

    return {
      hasContext: true,
      contextType: 'analyzed',
      mapsInitialized,
      fileCount: this.codespaceContext.files.length,
      cacheStatus: this.getCacheStatus()
    };
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    this.searchIndex.clear();
    this.codespaceContext = null;
    this.clearPersistedCache();
  }

  /**
   * Clear cache and force re-analysis (useful for debugging)
   */
  async clearCacheAndReanalyze(workspacePath: string): Promise<CodespaceContext> {
    console.log('🔍 Clearing cache and forcing re-analysis...');
    this.clearCache();
    return await this.analyzeCodespace(workspacePath);
  }

  /**
   * Force refresh of codespace analysis (ignores cache)
   */
  async forceRefresh(workspacePath: string): Promise<CodespaceContext> {
    console.log('🔍 Force refreshing codespace analysis...');
    this.clearCache();
    return await this.analyzeCodespace(workspacePath);
  }

  /**
   * Clear cache and re-analyze (for debugging cache issues)
   */
  async debugRefresh(workspacePath: string): Promise<CodespaceContext> {
    console.log('🔍 Debug refresh: clearing all caches and re-analyzing...');
    this.clearCache();
    this.clearPersistedCache();
    return await this.analyzeCodespace(workspacePath);
  }

  /**
   * Emergency cache clear - completely removes all cached data
   */
  async emergencyCacheClear(workspacePath: string): Promise<CodespaceContext> {
    console.log('🚨 Emergency cache clear: removing all cached data and starting fresh...');
    
    // Clear all possible cache locations
    this.clearCache();
    this.clearPersistedCache();
    
    // Also clear any other potential cache keys
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.includes('codespace') || key.includes('vector'));
      cacheKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🚨 Removed cache key: ${key}`);
      });
    } catch (error) {
      console.warn('🚨 Failed to clear additional cache keys:', error);
    }
    
    // Force fresh analysis
    return await this.analyzeCodespace(workspacePath);
  }

  /**
   * Fix corrupted cache - call this when you encounter cache-related errors
   */
  async fixCorruptedCache(workspacePath: string): Promise<CodespaceContext> {
    console.log('🔧 Fixing corrupted cache...');
    
    try {
      // First try to clear and re-analyze
      return await this.emergencyCacheClear(workspacePath);
    } catch (error) {
      console.error('🔧 Failed to fix cache with emergency clear:', error);
      
      // If that fails, try a complete reset
      console.log('🔧 Attempting complete service reset...');
      this.clearCache();
      this.clearPersistedCache();
      
      // Reset the instance
      CodespaceVectorService.instance = null as any;
      
      // Create new instance and analyze
      const newInstance = CodespaceVectorService.getInstance();
      return await newInstance.analyzeCodespace(workspacePath);
    }
  }

  /**
   * Get cache status information with AI configuration
   */
  getCacheStatus(): {
    hasCache: boolean;
    cacheAge?: number;
    workspacePath?: string;
    totalFiles?: number;
    aiConfig?: {
      enabled: boolean;
      model: string;
      provider: string;
      isGemini2: boolean;
    };
    gemini2Metrics?: {
      currentModel: string;
      costPerSearch: number;
      recommendations: string[];
    };
  } {
    try {
      const cachedData = localStorage.getItem(this.cacheKey);
      if (!cachedData) {
        const aiConfig = this.getAIConfig();
        const gemini2Metrics = this.getGemini2PerformanceMetrics();
        return { 
          hasCache: false,
          aiConfig: {
            enabled: aiConfig.enabled,
            model: aiConfig.model,
            provider: aiConfig.aiKey?.providerId || 'none',
            isGemini2: this.isGemini2Model(aiConfig.model)
          },
          gemini2Metrics: {
            currentModel: gemini2Metrics.currentModel,
            costPerSearch: gemini2Metrics.costAnalysis.costPerSearch,
            recommendations: gemini2Metrics.recommendations
          }
        };
      }

      const parsed = JSON.parse(cachedData);
      const cacheAge = Date.now() - parsed.timestamp;
      
      // Check if cache version is compatible
      if (parsed.version !== '1.0') {
        console.log('🔍 Cache version mismatch, clearing old cache');
        this.clearPersistedCache();
        const aiConfig = this.getAIConfig();
        const gemini2Metrics = this.getGemini2PerformanceMetrics();
        return { 
          hasCache: false,
          aiConfig: {
            enabled: aiConfig.enabled,
            model: aiConfig.model,
            provider: aiConfig.aiKey?.providerId || 'none',
            isGemini2: this.isGemini2Model(aiConfig.model)
          },
          gemini2Metrics: {
            currentModel: gemini2Metrics.currentModel,
            costPerSearch: gemini2Metrics.costAnalysis.costPerSearch,
            recommendations: gemini2Metrics.recommendations
          }
        };
      }
      
      const aiConfig = this.getAIConfig();
      const gemini2Metrics = this.getGemini2PerformanceMetrics();
      
      return {
        hasCache: true,
        cacheAge: Math.round(cacheAge / (1000 * 60)), // Age in minutes
        workspacePath: parsed.workspacePath,
        totalFiles: parsed.context?.totalFiles,
        aiConfig: {
          enabled: aiConfig.enabled,
          model: aiConfig.model,
          provider: aiConfig.aiKey?.providerId || 'none',
          isGemini2: this.isGemini2Model(aiConfig.model)
        },
        gemini2Metrics: {
          currentModel: gemini2Metrics.currentModel,
          costPerSearch: gemini2Metrics.costAnalysis.costPerSearch,
          recommendations: gemini2Metrics.recommendations
        }
      };
    } catch (error) {
      const aiConfig = this.getAIConfig();
      const gemini2Metrics = this.getGemini2PerformanceMetrics();
      return { 
        hasCache: false,
        aiConfig: {
          enabled: aiConfig.enabled,
          model: aiConfig.model,
          provider: aiConfig.aiKey?.providerId || 'none',
          isGemini2: this.isGemini2Model(aiConfig.model)
        },
        gemini2Metrics: {
          currentModel: gemini2Metrics.currentModel,
          costPerSearch: gemini2Metrics.costAnalysis.costPerSearch,
          recommendations: gemini2Metrics.recommendations
        }
      };
    }
  }

  /**
   * Save context to persistent cache
   */
  private async saveContextToCache(workspacePath: string, context: CodespaceContext): Promise<void> {
    try {
      // Convert Maps to arrays for JSON serialization
      const serializableContext = {
        ...context,
        dependencies: Array.from(context.dependencies.entries()),
        imports: Array.from(context.imports.entries()),
        classes: Array.from(context.classes.entries()),
        functions: Array.from(context.functions.entries()),
        variables: Array.from(context.variables.entries()),
        fileTypes: Array.from(context.fileTypes.entries()),
        languages: Array.from(context.languages.entries())
      };
      
      const cacheData = {
        workspacePath,
        context: serializableContext,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
      console.log('🔍 Codespace context saved to cache');
    } catch (error) {
      console.warn('🔍 Failed to save codespace context to cache:', error);
    }
  }

  /**
   * Load context from persistent cache
   */
  private async loadCachedContext(workspacePath: string): Promise<CodespaceContext | null> {
    try {
      const cachedData = localStorage.getItem(this.cacheKey);
      if (!cachedData) {
        return null;
      }

      const parsed = JSON.parse(cachedData);
      
      // Check if cache is for the same workspace
      if (parsed.workspacePath !== workspacePath) {
        console.log('🔍 Cache is for different workspace, ignoring');
        return null;
      }

      // Check if cache is expired
      const cacheAge = Date.now() - parsed.timestamp;
      const maxAge = this.cacheExpiryHours * 60 * 60 * 1000; // Convert hours to milliseconds
      
      if (cacheAge > maxAge) {
        console.log('🔍 Cache is expired, ignoring');
        this.clearPersistedCache();
        return null;
      }

      // Check if files have been modified since cache was created
      const isStale = await this.isCacheStale(workspacePath, parsed.timestamp);
      if (isStale) {
        console.log('🔍 Cache is stale (files modified), ignoring');
        this.clearPersistedCache();
        return null;
      }

      console.log('🔍 Valid cache found, age:', Math.round(cacheAge / (1000 * 60)), 'minutes');
      
      // Safely convert arrays back to Maps for the deserialized context
      // Handle cases where the cached data might have Maps as empty objects
      const safeCreateMap = (data: any): Map<string, any> => {
        try {
          if (Array.isArray(data)) {
            return new Map(data);
          } else if (data && typeof data === 'object') {
            // If it's an object but not an array, it might be an old cache format
            console.warn('🔍 Detected old cache format, converting object to Map');
            return new Map();
          } else {
            return new Map();
          }
        } catch (error) {
          console.warn('🔍 Failed to create Map from cached data:', error);
          return new Map();
        }
      };

      const deserializedContext = {
        ...parsed.context,
        dependencies: safeCreateMap(parsed.context.dependencies),
        imports: safeCreateMap(parsed.context.imports),
        classes: safeCreateMap(parsed.context.classes),
        functions: safeCreateMap(parsed.context.functions),
        variables: safeCreateMap(parsed.context.variables),
        fileTypes: safeCreateMap(parsed.context.fileTypes),
        languages: safeCreateMap(parsed.context.languages)
      };
      
      // Validate that all required Maps are present and properly initialized
      if (!deserializedContext.dependencies || !deserializedContext.imports || 
          !deserializedContext.classes || !deserializedContext.functions || 
          !deserializedContext.variables) {
        console.warn('🔍 Cached context missing required Maps, clearing cache');
        this.clearPersistedCache();
        return null;
      }
      
      return deserializedContext;
    } catch (error) {
      console.warn('🔍 Failed to load cached codespace context:', error);
      this.clearPersistedCache();
      return null;
    }
  }

  /**
   * Check if cache is stale by comparing file modification times
   */
  private async isCacheStale(workspacePath: string, cacheTimestamp: number): Promise<boolean> {
    try {
      // Get a sample of files to check modification times
      const files = await this.scanWorkspace(workspacePath);
      const sampleFiles = files.slice(0, Math.min(10, files.length)); // Check first 10 files
      
      for (const file of sampleFiles) {
        try {
          // Try to get file stats to check modification time
          // For now, we'll use a simple heuristic based on file content hash
          const contentHash = this.hashString(file.content);
          const fileKey = `${file.path}:${contentHash}`;
          
          // If we can't determine staleness, assume it's fresh
          // In a real implementation, you'd compare file modification times
          return false;
        } catch (error) {
          // If we can't check a file, continue with others
          continue;
        }
      }
      
      return false; // Default to not stale
    } catch (error) {
      console.warn('🔍 Could not determine cache staleness:', error);
      return false; // Default to not stale if we can't check
    }
  }

  /**
   * Simple string hashing function
   */
  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }

  /**
   * Clear persisted cache
   */
  private clearPersistedCache(): void {
    try {
      localStorage.removeItem(this.cacheKey);
      console.log('🔍 Persisted cache cleared');
    } catch (error) {
      console.warn('🔍 Failed to clear persisted cache:', error);
    }
  }

  // Language detection
  private getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'txt': 'plaintext'
    };
    
    return languageMap[extension] || 'plaintext';
  }

  // JavaScript/TypeScript analysis methods
  private extractJavaScriptImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }
    
    return imports;
  }

  private extractJavaScriptClasses(content: string): string[] {
    const classes: string[] = [];
    const classRegex = /class\s+(\w+)(?:\s+extends\s+\w+)?/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }
    
    return classes;
  }

  private extractJavaScriptFunctions(content: string): string[] {
    const functions: string[] = [];
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:async\s+)?function|(\w+)\s*[:=]\s*(?:async\s+)?\(|(\w+)\s*[:=]\s*(?:async\s+)?\()/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const funcName = match[1] || match[2] || match[3] || match[4];
      if (funcName && !functions.includes(funcName)) {
        functions.push(funcName);
      }
    }
    
    return functions;
  }

  private extractJavaScriptVariables(content: string): string[] {
    const variables: string[] = [];
    const varRegex = /(?:const|let|var)\s+(\w+)/g;
    let match;
    
    while ((match = varRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    
    return variables;
  }

  private extractJavaScriptDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const packageRegex = /"([^"]+)":\s*"[^"]*"/g;
    let match;
    
    while ((match = packageRegex.exec(content)) !== null) {
      if (match[1] !== 'name' && match[1] !== 'version') {
        dependencies.push(match[1]);
      }
    }
    
    return dependencies;
  }

  // Python analysis methods
  private extractPythonImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /(?:from\s+(\w+(?:\.\w+)*)\s+import|import\s+(\w+(?:\.\w+)*))/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const module = match[1] || match[2];
      if (module && !imports.includes(module)) {
        imports.push(module);
      }
    }
    
    return imports;
  }

  private extractPythonClasses(content: string): string[] {
    const classes: string[] = [];
    const classRegex = /class\s+(\w+)/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }
    
    return classes;
  }

  private extractPythonFunctions(content: string): string[] {
    const functions: string[] = [];
    const functionRegex = /def\s+(\w+)/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }
    
    return functions;
  }

  private extractPythonVariables(content: string): string[] {
    const variables: string[] = [];
    const varRegex = /(\w+)\s*=/g;
    let match;
    
    while ((match = varRegex.exec(content)) !== null) {
      const varName = match[1];
      if (!['if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'def', 'class', 'import', 'from', 'as'].includes(varName)) {
        if (!variables.includes(varName)) {
          variables.push(varName);
        }
      }
    }
    
    return variables;
  }

  private extractPythonDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const requirementsRegex = /^([a-zA-Z0-9_-]+)/gm;
    let match;
    
    while ((match = requirementsRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }
    
    return dependencies;
  }

  // Java analysis methods
  private extractJavaImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+([^;]+);/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  private extractJavaClasses(content: string): string[] {
    const classes: string[] = [];
    const classRegex = /(?:public\s+)?class\s+(\w+)/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }
    
    return classes;
  }

  private extractJavaMethods(content: string): string[] {
    const methods: string[] = [];
    const methodRegex = /(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:[a-zA-Z<>\[\]\s]+\s+)?(\w+)\s*\(/g;
    let match;
    
    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      if (!['if', 'else', 'for', 'while', 'try', 'catch', 'finally', 'switch', 'case', 'default'].includes(methodName)) {
        if (!methods.includes(methodName)) {
          methods.push(methodName);
        }
      }
    }
    
    return methods;
  }

  private extractJavaFields(content: string): string[] {
    const fields: string[] = [];
    const fieldRegex = /(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:[a-zA-Z<>\[\]\s]+\s+)?(\w+)\s*;/g;
    let match;
    
    while ((match = fieldRegex.exec(content)) !== null) {
      const fieldName = match[1];
      if (!fields.includes(fieldName)) {
        fields.push(fieldName);
      }
    }
    
    return fields;
  }

  private extractJavaDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const dependencyRegex = /<artifactId>([^<]+)<\/artifactId>/g;
    let match;
    
    while ((match = dependencyRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }
    
    return dependencies;
  }

  // C++ analysis methods
  private extractCppImports(content: string): string[] {
    const imports: string[] = [];
    const includeRegex = /#include\s*[<"]([^>"]+)[>"]/g;
    let match;
    
    while ((match = includeRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  private extractCppClasses(content: string): string[] {
    const classes: string[] = [];
    const classRegex = /class\s+(\w+)/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }
    
    return classes;
  }

  private extractCppFunctions(content: string): string[] {
    const functions: string[] = [];
    const functionRegex = /(?:[a-zA-Z_][a-zA-Z0-9_]*\s+)+(\w+)\s*\(/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const funcName = match[1];
      if (!['if', 'else', 'for', 'while', 'try', 'catch', 'switch', 'case', 'default'].includes(funcName)) {
        if (!functions.includes(funcName)) {
          functions.push(funcName);
        }
      }
    }
    
    return functions;
  }

  private extractCppVariables(content: string): string[] {
    const variables: string[] = [];
    const varRegex = /(?:int|float|double|char|bool|string|auto)\s+(\w+)/g;
    let match;
    
    while ((match = varRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    
    return variables;
  }

  private extractCppDependencies(content: string): string[] {
    // C++ dependencies are typically handled by build systems
    // This is a simplified approach
    return [];
  }

  /**
   * Get performance metrics and cost analysis for Gemini 2.0 models
   */
  getGemini2PerformanceMetrics(): {
    currentModel: string;
    modelConfig: any;
    costAnalysis: {
      estimatedInputTokens: number;
      estimatedOutputTokens: number;
      estimatedCost: number;
      costPerSearch: number;
    };
    recommendations: string[];
  } {
    const currentModel = this.currentModel;
    const modelConfig = this.getGemini2Config(currentModel);
    
    if (!modelConfig) {
      return {
        currentModel,
        modelConfig: null,
        costAnalysis: {
          estimatedInputTokens: 0,
          estimatedOutputTokens: 0,
          estimatedCost: 0,
          costPerSearch: 0
        },
        recommendations: ['Model configuration not available']
      };
    }

    // Estimate token usage based on typical codespace analysis
    const estimatedInputTokens = 2000; // Average project structure + query
    const estimatedOutputTokens = 500;  // Average keyword response
    
    const estimatedCost = (
      (estimatedInputTokens / 1000000) * modelConfig.cost.input +
      (estimatedOutputTokens / 1000000) * modelConfig.cost.output
    );
    
    const costPerSearch = estimatedCost;
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (modelConfig.cost.input > 0 || modelConfig.cost.output > 0) {
      if (currentModel === GEMINI_2_0_MODELS.FLASH_LITE) {
        recommendations.push('✅ Using free tier model - no cost for searches');
      } else if (currentModel === GEMINI_2_0_MODELS.FLASH_EXP) {
        recommendations.push('💰 Using cost-optimized experimental model');
      } else {
        recommendations.push(`💰 Current model costs $${estimatedCost.toFixed(4)} per search`);
        if (estimatedCost > 0.01) {
          recommendations.push('💡 Consider switching to Flash Lite for free searches');
        }
      }
    } else {
      recommendations.push('🎉 Using free model - no cost for searches');
    }
    
    if (this.codespaceContext && this.codespaceContext.files.length > 100) {
      recommendations.push('📊 Large project detected - consider caching results to reduce API calls');
    }
    
    return {
      currentModel,
      modelConfig,
      costAnalysis: {
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedCost,
        costPerSearch
      },
      recommendations
    };
  }
}
