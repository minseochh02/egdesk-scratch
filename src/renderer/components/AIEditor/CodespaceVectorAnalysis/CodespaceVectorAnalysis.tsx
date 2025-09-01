import React, { useState, useEffect } from 'react';
import { CodespaceVectorService } from '../services/codespaceVectorService';
import { EnhancedAIEditorService } from '../services/enhancedAIEditorService';
import ProjectContextService from '../../../services/projectContextService';
import { AISemanticKeywordService, SemanticKeyword } from '../services/aiSemanticKeywordService';
import { CHAT_PROVIDERS } from '../../ChatInterface/types';
import { AIKey } from '../../AIKeysManager/types';
import { aiKeysStore } from '../../AIKeysManager/store/aiKeysStore';
import './CodespaceVectorAnalysis.css';

// Helper function to get full project directory structure (no compression)
const getFullProjectStructure = (files: any[], projectPath: string) => {
  if (!files || files.length === 0 || !projectPath) return '';



  // Group files by directory
  const directoryStructure: Record<string, string[]> = {};
  
  files.forEach((file: any) => {
    const absolutePath = file.path || '';
    const name = file.name || '';
    
    // Convert absolute path to relative path from project root
    let relativePath = absolutePath;
    if (absolutePath.startsWith(projectPath)) {
      relativePath = absolutePath.substring(projectPath.length).replace(/^\/+/, '');
    }
    
    // Get directory path (relative to project)
    const dirPath = relativePath.split('/').slice(0, -1).join('/');
    
    // Only log files that should be in www/ directory
    if (name === 'index.php' || name.includes('www')) {
      console.log(`🔍 www file: ${name} -> ${dirPath} (from ${absolutePath})`);
    }
    
    if (dirPath) {
      if (!directoryStructure[dirPath]) {
        directoryStructure[dirPath] = [];
      }
      directoryStructure[dirPath].push(name);
    } else {
      // Root level files
      if (!directoryStructure['.']) {
        directoryStructure['.'] = [];
      }
      directoryStructure['.'].push(name);
    }
  });

  // Only log the www directory structure
  if (directoryStructure['www']) {
    console.log('🔍 www directory files:', directoryStructure['www']);
  }
  
  // Build full directory tree
  let tree = '';
  
  // Sort directories
  const sortedDirs = Object.keys(directoryStructure).sort();
  
  sortedDirs.forEach(dir => {
    if (dir === '.') {
      tree += `Root files:\n`;
    } else {
      tree += `${dir}/\n`;
    }
    
    // List all files in this directory
    const files = directoryStructure[dir].sort();
    files.forEach(file => {
      const indent = dir === '.' ? '  ' : '  '.repeat(dir.split('/').length + 1);
      tree += `${indent}${file}\n`;
    });
    
    tree += '\n';
  });
  
  return tree.trim();
};



interface CodespaceAnalysisData {
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  fileTypes: Record<string, number>;
  files?: any[];
}

export const CodespaceVectorAnalysis: React.FC = () => {
  const [analysisData, setAnalysisData] = useState<CodespaceAnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState<'semantic' | 'ai' | 'basic' | null>(null);
  const [depthAnalysis, setDepthAnalysis] = useState<any[]>([]);
  const [showDepthAnalysis, setShowDepthAnalysis] = useState(false);
  const [currentProject, setCurrentProject] = useState<any>(null);
  const [generatedKeywords, setGeneratedKeywords] = useState<SemanticKeyword[]>([]);
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState<AIKey | null>(null);
  const [aiKeys, setAiKeys] = useState<AIKey[]>([]);
  const [generatedDirectoryTree, setGeneratedDirectoryTree] = useState<string>('');


  // Build full project directory tree directly from filesystem (bypass cache)
  const buildFullProjectDirectoryTree = async (rootPath: string): Promise<string> => {
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
  };

  // Helper functions for depth analysis
  const isLandingPageQuery = (query: string): boolean => {
    const queryLower = query.toLowerCase();
    const landingPageTerms = [
      'landing page', 'homepage', 'home page', 'main page', 'entry point',
      'main entry', 'start page', 'index page', 'root page'
    ];
    return landingPageTerms.some(term => queryLower.includes(term));
  };

  const calculateDepth = (filePath: string, workspacePath: string): number => {
    if (!workspacePath || !filePath.startsWith(workspacePath)) return 0;
    const relativePath = filePath.substring(workspacePath.length).replace(/^\/+/, '').replace(/\/+$/, '');
    return relativePath ? (relativePath.match(/\//g) || []).length : 0;
  };

  const calculateDepthScore = (filePath: string, workspacePath: string): number => {
    const depth = calculateDepth(filePath, workspacePath);
    if (depth === 0) return 15;
    if (depth === 1) return 10;
    if (depth === 2) return 5;
    return 0;
  };

  const getRelativePath = (filePath: string, workspacePath: string): string => {
    if (!workspacePath || !filePath.startsWith(workspacePath)) return filePath;
    return filePath.substring(workspacePath.length).replace(/^\/+/, '');
  };

  // Keyword generation handlers
  const handleGenerateKeywords = async () => {
    if (!searchQuery.trim()) return;
    
    // Check if AI is properly configured
    if (!selectedKey || !selectedModel) {
      alert('Please configure AI provider, model, and API key first.');
      return;
    }
    
    setIsGeneratingKeywords(true);
    setGeneratedKeywords([]);
    
    try {
      const keywordService = AISemanticKeywordService.getInstance();
      
      // Use the selected AI configuration
      const aiKey = selectedKey;
      const model = selectedModel;

      // Generate semantic keywords with full project structure context
      const projectStructure = getFullProjectStructure(analysisData?.files || [], currentProject?.path || '');
      
      // Debug: Log the generated directory tree
      console.log('🌳 Generated Directory Tree:', projectStructure);

      const projectContext = {
        name: currentProject?.name || 'Unknown Project',
        type: currentProject?.type || 'Unknown Type',
        totalFiles: analysisData?.totalFiles || 0,
        totalLines: analysisData?.totalLines || 0,
        searchQuery: searchQuery
      };

      const keywordRequest = {
        userRequest: searchQuery,
        context: `## Full Project Tree :\n${projectStructure}\n\n## User Request: \n${searchQuery}\n\nInstructions:\n1. Look at the actual files listed above\n2. Identify the most relevant files for the user's request\n\n## OUTPUT FORMAT:\nReturn ONLY a JSON array of keywords in this exact format:\n[\n  {\n    "keyword": "file path or directory pattern (e.g., contact/index.php, src/components/Contact.tsx)",\n    "relevance": 0.95,\n    "category": "primary|secondary|technical|synonym",\n    "description": "brief explanation of what this file path represents or contains",\n    "relatedTerms": ["term1", "term2"],\n    "confidence": 0.9\n  }\n]`,
        projectStructure: projectStructure,
        targetLanguage: 'Any',
        maxKeywords: 5,
        includeSynonyms: false,
        includeTechnicalTerms: false,
        includeFilePatterns: false
      };

      const keywordResponse = await keywordService.generateKeywords(aiKey, model, keywordRequest);
      
      if (keywordResponse.success && keywordResponse.keywords.length > 0) {
        setGeneratedKeywords(keywordResponse.keywords);
        console.log('🔑 Generated keywords:', keywordResponse.keywords);
      } else {
        console.error('❌ Keyword generation failed:', keywordResponse.error);
        alert('Failed to generate keywords. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error generating keywords:', error);
      alert('Error generating keywords. Please try again.');
    } finally {
      setIsGeneratingKeywords(false);
    }
  };

  const handleUseKeywordsForSearch = async () => {
    if (generatedKeywords.length === 0) return;
    
    console.log('🔍 Starting individual keyword search with context...');
    
    // Auto-trigger search with individual keywords
    if (currentProject) {
      setIsSearching(true);
      setSearchResults([]);
      setDepthAnalysis([]);
      
      try {
        let allResults: any[] = [];
        
        // Search each keyword individually with its context
        for (const keyword of generatedKeywords) {
          console.log(`🔍 Searching for keyword: "${keyword.keyword}" (${keyword.category}, relevance: ${Math.round(keyword.relevance * 100)}%)`);
          
          // Determine search type for this specific keyword
          const isFilePathQueryResult = isFilePathQuery(keyword.keyword);
          const searchType = isFilePathQueryResult ? 'basic' : 'semantic';
          
          let keywordResults: any[] = [];
          
          if (searchType === 'basic') {
            // Use basic search for file path queries - fall back to semantic search since basic is private
            console.log(`🔍 File path keyword detected, using semantic search as fallback`);
            keywordResults = await EnhancedAIEditorService.searchCodespace(keyword.keyword, 10);
          } else {
            // Use semantic search for content-based keywords
            keywordResults = await EnhancedAIEditorService.searchCodespace(keyword.keyword, 10);
          }
          
          // Enhance results with keyword context
          const enhancedResults = keywordResults.map(result => ({
            ...result,
            keywordSource: keyword.keyword,
            keywordCategory: keyword.category,
            keywordRelevance: keyword.relevance,
            keywordConfidence: keyword.confidence,
            // Boost relevance based on keyword importance
            enhancedRelevance: result.relevance * (keyword.relevance * 2 + 0.5)
          }));
          
          allResults.push(...enhancedResults);
        }
        
        // Remove duplicates and sort by enhanced relevance
        const uniqueResults = allResults.filter((result, index, self) => 
          index === self.findIndex(r => r.file.path === result.file.path)
        );
        
        // Sort by enhanced relevance (keyword importance + search relevance)
        const sortedResults = uniqueResults.sort((a, b) => b.enhancedRelevance - a.enhancedRelevance);
        
        // Take top results
        const finalResults = sortedResults.slice(0, 20);
        
        console.log(`🔍 Found ${finalResults.length} unique results from ${allResults.length} total keyword searches`);
        
        setSearchResults(finalResults);
        setSearchType('ai'); // Mark as AI-enhanced search
        
        // Calculate depth analysis for landing page queries
        // Use the primary keywords to determine if this is a landing page query
        const primaryKeywords = generatedKeywords.filter(k => k.category === 'primary').map(k => k.keyword);
        const isLandingPageQueryResult = primaryKeywords.some(keyword => isLandingPageQuery(keyword));
        
        if (isLandingPageQueryResult) {
          const analysis = finalResults.map(result => {
            const depthScore = calculateDepthScore(result.file.path, currentProject?.path || '');
            return {
              filePath: result.file.path,
              finalRelevance: result.enhancedRelevance,
              depthScore,
              baseScore: result.enhancedRelevance - depthScore,
              relativePath: getRelativePath(result.file.path, currentProject?.path || ''),
              depth: calculateDepth(result.file.path, currentProject?.path || ''),
              keywordSource: result.keywordSource,
              keywordCategory: result.keywordCategory
            };
          });
          setDepthAnalysis(analysis);
          setShowDepthAnalysis(true);
        }
        
        // Keep the original search query, don't change it
        // The enhanced search results are already displayed above
        
      } catch (error) {
        console.error('❌ Enhanced search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }
  };

  // Helper function to determine if query is file path based
  const isFilePathQuery = (query: string): boolean => {
    const filePathPatterns = [
      /\.(php|html|js|ts|css|py|java|cpp|h|hpp|rs|go|rb|swift|kt|scala|clj|hs|ml|json|yaml|yml|toml|ini|conf|md|txt)$/i,
      /\/(index|main|home|config|app|server|client|utils|helpers|components|pages|views|controllers|models|services|api|auth|user|admin|dashboard|login|register|profile|settings|config|database|db|sql|mongo|redis|cache|logs|temp|tmp|build|dist|out|coverage|node_modules|\.git|\.vscode|\.idea)$/i
    ];
    
    return filePathPatterns.some(pattern => pattern.test(query));
  };

  // Function to directly open files using AI-generated paths
  const handleOpenFileDirectly = async (filePath: string) => {
    if (!currentProject?.path) return;
    
    try {
      const fullPath = filePath.startsWith('/') ? filePath : `${currentProject.path}/${filePath}`;
      console.log(`🔍 Attempting to open file: ${fullPath}`);
      
      const result = await window.electron.fileSystem.readFile(fullPath);
      if (result.success && result.content) {
        // Show file content in a modal or expandable section
        alert(`✅ File opened successfully!\n\nPath: ${filePath}\nSize: ${result.content.length} characters\n\nFirst 200 characters:\n${result.content.substring(0, 200)}...`);
      } else {
        alert(`❌ Failed to open file: ${filePath}\nError: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error opening file ${filePath}:`, error);
      alert(`❌ Error opening file: ${error}`);
    }
  };

  // Utility functions for keyword display
  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'primary': return '#4CAF50';
      case 'secondary': return '#2196F3';
      case 'technical': return '#FF9800';
      case 'synonym': return '#9C27B0';
      default: return '#757575';
    }
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'primary': return '⭐';
      case 'secondary': return '🔹';
      case 'technical': return '⚙️';
      case 'synonym': return '🔄';
      default: return '📝';
    }
  };

  // Helper functions for AI configuration
  const getProviderInfo = (providerId: string) => {
    return CHAT_PROVIDERS.find(p => p.id === providerId);
  };

  const getModelsForProvider = (providerId: string) => {
    const provider = CHAT_PROVIDERS.find(p => p.id === providerId);
    return provider?.models || [];
  };

  // Get available keys for selected provider
  const availableKeys = aiKeys.filter((key: AIKey) => key.providerId === selectedProvider);



  const codespaceService = CodespaceVectorService.getInstance();
  const projectService = ProjectContextService.getInstance();

  const fetchContext = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get current project path from ProjectContextService
      const currentProject = projectService.getCurrentProject();
      if (!currentProject) {
        setError('No active project selected. Please select a project first.');
        setIsLoading(false);
        return;
      }
      
      const workspacePath = currentProject.path;
      setCurrentProject(currentProject);
      
      // Analyze codespace
      const result = await codespaceService.analyzeCodespace(workspacePath);
      
      // Process the data
      const processed: CodespaceAnalysisData = {
        totalFiles: result.totalFiles || 0,
        totalLines: result.totalLines || 0,
        languages: result.languages instanceof Map ? Object.fromEntries(result.languages) : {},
        fileTypes: result.fileTypes instanceof Map ? Object.fromEntries(result.fileTypes) : {},
        files: result.files || []
      };
      
      setAnalysisData(processed);
      
      // Get cache status
      const status = codespaceService.getCacheStatus();
      setCacheStatus(status);
      
    } catch (error) {
      setError(`Failed to fetch context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Subscribe to project context changes
    const unsubscribe = projectService.subscribe((context) => {
      if (context.currentProject && context.currentProject.path !== currentProject?.path) {
        setCurrentProject(context.currentProject);
        // Auto-fetch context when project changes
        fetchContext();
      }
    });

    // Initial fetch if we have a current project
    const initialProject = projectService.getCurrentProject();
    if (initialProject) {
      setCurrentProject(initialProject);
      fetchContext();
    }

    return unsubscribe;
  }, []);

  // Subscribe to AI keys store and set initial provider
  useEffect(() => {
    const unsubscribe = aiKeysStore.subscribe((keyState) => {
      const activeKeys = keyState.keys.filter(key => key.isActive);
      setAiKeys(activeKeys);
      
      // Set initial provider if we have keys and haven't set one yet
      if (activeKeys.length > 0 && !selectedProvider) {
        const firstKey = activeKeys[0];
        setSelectedProvider(firstKey.providerId);
        
        // Set initial model
        const provider = CHAT_PROVIDERS.find(p => p.id === firstKey.providerId);
        if (provider && provider.models.length > 0) {
          setSelectedModel(provider.models[0].id);
        }
        
        // Set initial key
        setSelectedKey(firstKey);
      }
    });

    return unsubscribe;
  }, [selectedProvider]);
  
  // Effect to generate directory tree directly from filesystem (always fresh)
  useEffect(() => {
    const run = async () => {
      if (!currentProject?.path) return;
      const tree = await buildFullProjectDirectoryTree(currentProject.path);
      setGeneratedDirectoryTree(tree);
    };
    run();
  }, [currentProject]);

  if (isLoading) {
    return (
      <div className="codespace-analysis">
        <h2>🔍 Codespace Analysis</h2>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="codespace-analysis">
        <h2>🔍 Codespace Analysis</h2>
        <div className="error">
          <p>❌ {error}</p>
          <button onClick={fetchContext} className="retry-btn">🔄 Retry</button>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="codespace-analysis">
        <h2>🔍 Codespace Analysis</h2>
        <div className="no-data">No data available</div>
      </div>
    );
  }

  return (
    <div className="codespace-analysis">
      {/* AI Model Configuration Panel */}
      <div className="ai-config-panel">
        <div className="config-header">
          <h3>🤖 AI Model Configuration</h3>
          <p>Configure AI settings for enhanced codespace analysis and keyword generation</p>
        </div>
        
        <div className="config-grid">
          <div className="config-group">
            <label>AI Provider:</label>
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setSelectedModel('');
                setSelectedKey(null);
              }}
              className="provider-select"
            >
              <option value="">Select provider...</option>
              {CHAT_PROVIDERS.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.icon} {provider.name}
                </option>
              ))}
            </select>
          </div>

          <div className="config-group">
            <label>AI Model:</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={!selectedProvider}
              className="model-select"
            >
              <option value="">Select model...</option>
              {selectedProvider && getModelsForProvider(selectedProvider).map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.maxTokens.toLocaleString()} tokens)
                </option>
              ))}
            </select>
          </div>

          <div className="config-group">
            <label>API Key:</label>
            <select
              value={selectedKey?.id || ''}
              onChange={(e) => {
                const key = aiKeys.find(k => k.id === e.target.value);
                setSelectedKey(key || null);
              }}
              disabled={!selectedProvider || availableKeys.length === 0}
              className="key-select"
            >
              <option value="">
                {availableKeys.length === 0 
                  ? 'No keys available for this provider' 
                  : 'Select an API key'
                }
              </option>
              {availableKeys.map(key => (
                <option key={key.id} value={key.id}>
                  {key.name} ({key.providerId})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="config-status">
          {selectedKey && selectedModel ? (
            <div className="status-success">
              ✅ Configured: {getProviderInfo(selectedProvider)?.icon} {selectedProvider} • {selectedModel}
            </div>
          ) : (
            <div className="status-warning">
              ⚠️ Please configure AI provider, model, and API key for enhanced features
            </div>
          )}
        </div>
      </div>

      {/* Project Directory Tree - Auto-generated on page load */}
      <div className="directory-tree-section">
        <h5>🌳 Full Project Directory Structure</h5>
        {generatedDirectoryTree ? (
          <>
            <div className="directory-tree-content">
              <pre className="directory-tree-pre">{generatedDirectoryTree}</pre>
            </div>
            <div className="directory-tree-info">
              <span className="info-badge">📁 Complete File Listing</span>
              <span className="info-text">Shows all files and directories for AI path generation</span>
            </div>
          </>
        ) : (
          <div className="directory-tree-loading">
            <span className="loading-spinner">⏳</span>
            Generating project structure...
          </div>
        )}
      </div>

      <h2>🔍 Codespace Analysis</h2>
      
      {/* Current Project Display */}
      {currentProject ? (
        <div className="current-project">
          <h3>📁 Current Project</h3>
          <div className="project-info">
            <div className="project-name">{currentProject.name}</div>
            <div className="project-path">{currentProject.path}</div>
            <div className="project-type">Type: {currentProject.type}</div>
          </div>
        </div>
      ) : (
        <div className="no-project">
          <p>⚠️ No active project selected. Please select a project from another tab first.</p>
        </div>
      )}
      
      <div className="summary-stats">
        <div className="stat-card">
          <h3>📁 Total Files</h3>
          <p className="stat-value">{analysisData.totalFiles}</p>
        </div>
        <div className="stat-card">
          <h3>📝 Total Lines</h3>
          <p className="stat-value">{analysisData.totalLines}</p>
        </div>
      </div>

      {/* Cache Status Display */}
      {cacheStatus && cacheStatus.hasCache && (
        <div className="cache-status">
          <span className="cache-indicator">💾</span>
          <span className="cache-info">
            Using cached analysis ({cacheStatus.cacheAge}min old, {cacheStatus.totalFiles} files)
          </span>
          <button 
            className="refresh-cache-btn"
            onClick={() => {
              if (currentProject) {
                EnhancedAIEditorService.forceRefresh(currentProject.path);
              }
            }}
            title="Force refresh codespace analysis"
          >
            🔄
          </button>
          <button 
            className="test-search-btn"
            onClick={async () => {
              if (searchQuery.trim()) {
                setIsSearching(true);
                setSearchType('semantic');
                setSearchResults([]);
                setDepthAnalysis([]);
                try {
                  // Use the original AI search method
                  const results = await EnhancedAIEditorService.searchCodespace(searchQuery, 20);
                  setSearchResults(results);
                  
                  // Calculate depth analysis for landing page queries
                  if (isLandingPageQuery(searchQuery)) {
                    const analysis = results.map(result => {
                      const depthScore = calculateDepthScore(result.file.path, currentProject?.path || '');
                      return {
                        filePath: result.file.path,
                        finalRelevance: result.relevance,
                        depthScore,
                        baseScore: result.relevance - depthScore,
                        relativePath: getRelativePath(result.file.path, currentProject?.path || ''),
                        depth: calculateDepth(result.file.path, currentProject?.path || '')
                      };
                    });
                    setDepthAnalysis(analysis);
                    setShowDepthAnalysis(true);
                  } else {
                    setShowDepthAnalysis(false);
                  }
                } catch (error) {
                  setSearchResults([]);
                } finally {
                  setIsSearching(false);
                }
              } else {
                alert('Please enter a search query first!');
              }
            }}
            title="Test AI search with current instruction"
          >
            🧪 Test AI Search
          </button>
          <button 
            className="test-ai-search-btn"
            disabled={!searchQuery.trim() || !selectedKey || !selectedModel}
            onClick={handleGenerateKeywords}
            title={!selectedKey || !selectedModel 
              ? "Configure AI provider, model, and API key first" 
              : "Generate AI-powered keywords for enhanced search - shows keywords in UI for review before searching"
            }
          >
            🤖 Generate Enhanced Keywords
          </button>
        </div>
      )}



      {/* Search Query Input */}
      <div className="search-section">
        <input
          type="text"
          placeholder="Enter search query to test semantic search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        
        {/* Generate Keywords Button */}
        <button
          onClick={handleGenerateKeywords}
          disabled={!searchQuery.trim() || isGeneratingKeywords || !selectedKey || !selectedModel}
          className="generate-keywords-btn"
          title={!selectedKey || !selectedModel 
            ? "Configure AI provider, model, and API key first" 
            : "Generate AI-powered file path keywords using project structure for better file discovery"
          }
        >
          {isGeneratingKeywords ? '🔄 Generating...' : '🔑 Generate File Path Keywords'}
        </button>
      </div>

      {/* Generated Keywords Display */}
      {generatedKeywords.length > 0 && (
        <div className="generated-keywords-section">
          <div className="keywords-header">
            <h4>🔑 AI-Generated File Path Keywords</h4>
            <div className="keywords-subtitle">
              <span className="project-context-badge">🏗️ Project Structure Aware</span>
              <span className="context-info">Generated using {currentProject?.name || 'project'} structure and {analysisData?.totalFiles || 0} files</span>
            </div>
            <button
              onClick={handleUseKeywordsForSearch}
              className="use-keywords-btn"
              title="Use these keywords for enhanced search and file access"
            >
              🔍 Use for Search
            </button>
          </div>
          

          
          <div className="keywords-grid">
            {generatedKeywords.map((keyword, index) => (
              <div key={index} className="keyword-card">
                <div className="keyword-header">
                  <span className="category-icon" style={{ color: getCategoryColor(keyword.category) }}>
                    {getCategoryIcon(keyword.category)}
                  </span>
                  <span className="keyword-text">{keyword.keyword}</span>
                  <span className="category-badge" style={{ backgroundColor: getCategoryColor(keyword.category) }}>
                    {keyword.category}
                  </span>
                </div>
                
                <div className="keyword-details">
                  {keyword.description && (
                    <p className="keyword-description">{keyword.description}</p>
                  )}
                  
                  <div className="keyword-metrics">
                    <span className="metric relevance">
                      Relevance: {Math.round(keyword.relevance * 100)}%
                    </span>
                    <span className="metric confidence">
                      Confidence: {Math.round(keyword.confidence * 100)}%
                    </span>
                  </div>
                  
                  {/* Direct file access button */}
                  <button
                    onClick={() => handleOpenFileDirectly(keyword.keyword)}
                    className="open-file-btn"
                    title={`Open file: ${keyword.keyword}`}
                  >
                    📂 Open File
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Results Display */}
      {isSearching && (
        <div className="search-loading">
          <span className="loading-spinner">⏳</span>
          Searching...
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="search-results">
          <h3>
            {searchType === 'semantic' ? '🧪 Semantic Search Results' : '🤖 AI Search Results (Enhanced)'}
            <span className="results-count"> ({searchResults.length} files)</span>
          </h3>
          
          {searchType === 'ai' && (
            <div className="search-info">
              <p>🔍 Searched {generatedKeywords.length} keywords individually and ranked by relevance</p>
            </div>
          )}

          <div className="results-list">
            {searchResults.map((result, index) => (
              <div key={index} className="result-item">
                <div className="result-header">
                  <span className="result-file-name">{result.file?.name || result.file?.path || `Result ${index + 1}`}</span>
                  <div className="result-metrics">
                    {result.enhancedRelevance && (
                      <span className="result-relevance">
                        Enhanced Score: {Math.round(result.enhancedRelevance * 100)}%
                      </span>
                    )}
                    {result.keywordSource && (
                      <span className="keyword-source">
                        Found by: {result.keywordSource} ({result.keywordCategory})
                      </span>
                    )}
                  </div>
                </div>
                {result.file?.path && (
                  <div className="result-file-path">{result.file.path}</div>
                )}
                {result.matches && result.matches.length > 0 && (
                  <div className="result-matches">
                    <strong>Matches:</strong>
                    <ul>
                      {result.matches.slice(0, 3).map((match: string, matchIndex: number) => (
                        <li key={matchIndex} className="match-item">
                          {match.length > 100 ? `${match.substring(0, 100)}...` : match}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.context && (
                  <div className="result-context">
                    <strong>Context:</strong>
                    <div className="context-text">
                      {result.context.length > 200 ? `${result.context.substring(0, 200)}...` : result.context}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {searchResults.length === 0 && !isSearching && searchType && (
        <div className="no-results">
          {searchType === 'ai' ? (
            <p>No results found for the AI-generated keywords. Try generating different keywords or adjusting your search query.</p>
          ) : (
            <p>No results found for "{searchQuery}". Try a different search query.</p>
          )}
        </div>
      )}

      {/* Depth Analysis Display */}
      {showDepthAnalysis && depthAnalysis.length > 0 && (
        <div className="depth-analysis">
          <h3>🔍 VOID Alignment: Depth Analysis</h3>
          <p className="analysis-description">
            This query was detected as a landing page query. Files are scored based on their directory depth:
            <br />
            <strong>Depth 0 (Root):</strong> +15 points | <strong>Depth 1:</strong> +10 points | <strong>Depth 2:</strong> +5 points
          </p>
          
          {/* Debug: Show all files in codespace */}
          <div className="debug-section">
            <h4>🔍 Debug: All Files in Codespace</h4>
            <p>Looking for main index.php files...</p>
            <div className="debug-files">
              {analysisData.files && analysisData.files
                .filter((file: any) => file.name && file.name.toLowerCase().includes('index.php'))
                .slice(0, 10)
                .map((file: any, index: number) => (
                  <div key={index} className="debug-file">
                    <strong>{file.name}</strong> - {file.path}
                  </div>
                ))}
            </div>
            
            <h4>🔍 Debug: All Files (First 20)</h4>
            <p>Total files analyzed: {analysisData.files?.length || 0}</p>
            <div className="debug-files">
              {analysisData.files && analysisData.files
                .slice(0, 20)
                .map((file: any, index: number) => (
                  <div key={index} className="debug-file">
                    <strong>{file.name}</strong> - {file.path}
                  </div>
                ))}
            </div>
            
            <h4>🔍 Debug: Workspace Path</h4>
            <p>Current Project Path: {currentProject?.path}</p>
            <p>Expected main index.php should be at: {currentProject?.path}/www/index.php</p>
            
            <h4>🔍 Debug: Manual File Check</h4>
            <button 
              className="debug-check-btn"
              onClick={async () => {
                if (currentProject?.path) {
                  try {
                    const mainIndexPath = `${currentProject.path}/www/index.php`;
                    const result = await window.electron.fileSystem.readFile(mainIndexPath);
                    if (result.success) {
                      alert(`✅ Main index.php FOUND!\nPath: ${mainIndexPath}\nSize: ${result.content?.length || 0} characters`);
                    } else {
                      alert(`❌ Main index.php NOT FOUND!\nPath: ${mainIndexPath}\nError: ${result.error}`);
                    }
                  } catch (error) {
                    alert(`❌ Error checking file: ${error}`);
                  }
                }
              }}
            >
              🔍 Check if main www/index.php exists
            </button>
            
            <button 
              className="debug-search-btn"
              onClick={async () => {
                try {
                  const vectorService = CodespaceVectorService.getInstance();
                  const results = await vectorService.searchCodespaceWithAI("describe landing page", 10);
                  console.log('🔍 Manual search results:', results);
                  
                  // Show results in alert for now
                  const resultText = results.map((r, i) => 
                    `${i+1}. ${r.file.path} (${Math.round(r.relevance * 100)}%)`
                  ).join('\n');
                  alert(`Manual search results:\n\n${resultText}`);
                } catch (error) {
                  alert(`Manual search failed: ${error}`);
                }
              }}
            >
              🔍 Test Manual Search
            </button>
            

          </div>
          
          <div className="depth-analysis-table">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>File Path</th>
                  <th>Relative Path</th>
                  <th>Depth</th>
                  <th>Base Score</th>
                  <th>Depth Bonus</th>
                  <th>Final Score</th>
                </tr>
              </thead>
              <tbody>
                {depthAnalysis.map((item, index) => (
                  <tr key={index} className={index === 0 ? 'top-result' : ''}>
                    <td className="rank">{index + 1}</td>
                    <td className="file-path">{item.filePath}</td>
                    <td className="relative-path">{item.relativePath}</td>
                    <td className="depth">{item.depth}</td>
                    <td className="base-score">{Math.round(item.baseScore * 100)}%</td>
                    <td className="depth-bonus">+{item.depthScore}</td>
                    <td className="final-score">{Math.round(item.finalRelevance * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {analysisData.files && analysisData.files.length > 0 && (
        <div className="files-section">
          <h3>📁 Files</h3>
          <div className="files-list">
            {analysisData.files.map((file: any, index: number) => (
              <div key={index} className="file-item">
                <div className="file-path">{file.path || file.name || `File ${index}`}</div>
                <div className="file-info">
                  {file.language && <span className="language">{file.language}</span>}
                  {file.extension && <span className="extension">{file.extension}</span>}
                  {file.size && <span className="size">{file.size} bytes</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="debug-section">
        <h4>🐛 Raw Data</h4>
        <details>
          <summary>Click to see raw data</summary>
          <pre className="debug-data">
            {JSON.stringify(analysisData, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};
