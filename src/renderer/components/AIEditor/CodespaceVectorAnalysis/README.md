# Codespace Vector Analysis

This module provides advanced codespace analysis capabilities using vector embeddings and AI-powered search, now with enhanced **Gemini 2.0 model support**.

## Components

### CodespaceVectorAnalysis
The main component that provides:
- Codespace analysis and statistics
- **AI-powered semantic search using Gemini 2.0 models**
- Project context integration
- **Cost optimization and performance metrics**

### SemanticKeywordGenerator
A new AI-powered service that generates semantic keywords for better codespace search:

#### Features
- **AI-Powered Keyword Generation**: Uses various AI providers (OpenAI, Anthropic, **Google Gemini 2.0**, Azure) to generate contextually relevant keywords
- **Smart Categorization**: Keywords are automatically categorized as primary, secondary, technical, or synonym
- **Relevance Scoring**: Each keyword comes with relevance and confidence scores
- **Related Terms**: Suggests related terms and synonyms
- **Integration**: Seamlessly integrates with the existing search functionality

#### **Gemini 2.0 Model Support**
The service now includes comprehensive support for Google's latest Gemini 2.0 models:

- **`gemini-2.0-flash`** - Fast production model ($0.10/$0.40 per 1M tokens)
- **`gemini-2.0-flash-lite`** - **FREE tier model** (0 cost)
- **`gemini-2.0-flash-lite-preview`** - Preview version ($0.075/$0.30 per 1M tokens)
- **`gemini-2.0-pro-exp`** - Experimental pro model (**FREE during preview**)
- **`gemini-2.0-flash-exp`** - Experimental flash model ($0.07/$0.16 per 1M tokens)

#### Usage
```typescript
import { AISemanticKeywordService, GEMINI_2_0_MODELS } from '../services/aiSemanticKeywordService';

const keywordService = AISemanticKeywordService.getInstance();

const request = {
  userRequest: "Find authentication and user management code",
  context: "WordPress plugin development",
  targetLanguage: "PHP",
  maxKeywords: 10,
  includeSynonyms: true,
  includeTechnicalTerms: true
};

// Use the free Gemini 2.0 Flash Lite model
const response = await keywordService.generateKeywords(aiKey, GEMINI_2_0_MODELS.FLASH_LITE, request);
```

#### Supported AI Providers
- OpenAI (GPT models)
- Anthropic (Claude models)
- **Google (Gemini 2.0 models) ⭐ NEW**
- Azure OpenAI

#### Keyword Categories
- **Primary**: Most relevant and important keywords
- **Secondary**: Supporting and related keywords
- **Technical**: Programming-specific terms and concepts
- **Synonym**: Alternative terms and variations

## **Enhanced CodespaceVectorService with Gemini 2.0**

### **New AI-Powered Features**
- **Intelligent Query Enhancement**: Uses Gemini 2.0 to understand natural language queries and generate relevant search terms
- **Project Structure Analysis**: Automatically builds project context for better AI understanding
- **Language Detection**: Automatically detects primary programming language
- **Cost Optimization**: Built-in cost analysis and recommendations for different models
- **Performance Metrics**: Real-time performance tracking and optimization suggestions

### **AI Configuration Methods**
```typescript
import { CodespaceVectorService, GEMINI_2_0_MODELS } from '../services/codespaceVectorService';

const service = CodespaceVectorService.getInstance();

// Configure AI with Gemini 2.0 Flash Lite (free tier)
service.configureAI(aiKey, GEMINI_2_0_MODELS.FLASH_LITE);

// Get available models
const models = service.getAvailableGemini2Models();

// Get performance metrics
const metrics = service.getGemini2PerformanceMetrics();

// Enable/disable AI search
service.setAISearchEnabled(true);
```

### **AI-Powered Search**
```typescript
// Natural language search with Gemini 2.0
const results = await service.searchCodespace('Find authentication and user management files', 10);

// Get AI-powered insights about the codespace
const insights = await service.getCodespaceInsights('Analyze this project structure and identify key components');
```

### **Cost Optimization Features**
- **Automatic Cost Analysis**: Estimates token usage and costs per search
- **Smart Model Selection**: Recommends optimal models based on use case
- **Free Tier Support**: Gemini 2.0 Flash Lite provides free searches
- **Performance Monitoring**: Tracks costs and provides optimization recommendations

### **Cache Status with AI Info**
The enhanced cache status now includes:
- AI configuration details
- Gemini 2.0 model information
- Cost analysis and recommendations
- Performance metrics

## Services

### CodespaceVectorService
Handles vector embeddings and semantic search operations with **Gemini 2.0 AI integration**.

### EnhancedAIEditorService
Provides AI-powered code editing and search capabilities.

### AISemanticKeywordService
Generates semantic keywords for improved search accuracy using **Gemini 2.0 models**.

## **Performance Benefits**

### **Free Tier Usage**
- **Gemini 2.0 Flash Lite**: 0 cost for unlimited searches
- Perfect for development and testing
- 1M token context window for large projects

### **Cost Optimization**
- Automatic fallback to free models when costs are high
- Token usage optimization
- Smart caching to reduce API calls

### **Enhanced Search Quality**
- Better understanding of natural language queries
- Project-specific context awareness
- Improved relevance scoring

## **Migration Guide**

### **From Basic Search**
```typescript
// Old: Basic token search
const results = service.searchCodespaceBasic(query, limit);

// New: AI-powered search with Gemini 2.0
service.configureAI(aiKey, GEMINI_2_0_MODELS.FLASH_LITE);
const results = await service.searchCodespace(query, limit);
```

### **From Other AI Models**
```typescript
// Old: OpenAI or other providers
const results = await service.searchCodespaceWithAI(query, limit);

// New: Gemini 2.0 specific
service.configureAI(aiKey, GEMINI_2_0_MODELS.FLASH_LITE);
const results = await service.searchCodespace(query, limit);
```

## **Examples**

See the following example files for complete usage:
- `codespaceVectorGemini2Example.ts` - Codespace analysis with Gemini 2.0
- `gemini2Example.ts` - Semantic keyword generation with Gemini 2.0

## **Best Practices**

1. **Start with Free Tier**: Use `gemini-2.0-flash-lite` for development
2. **Monitor Costs**: Use `getGemini2PerformanceMetrics()` to track usage
3. **Cache Results**: Enable caching to reduce API calls
4. **Optimize Queries**: Use natural language for better AI understanding
5. **Fallback Strategy**: Always have fallback to basic search when AI fails
