# Codespace Vector Analysis

This module provides advanced codespace analysis capabilities using vector embeddings and AI-powered search.

## Components

### CodespaceVectorAnalysis
The main component that provides:
- Codespace analysis and statistics
- Semantic search capabilities
- AI-powered search with depth analysis
- Project context integration

### SemanticKeywordGenerator
A new AI-powered service that generates semantic keywords for better codespace search:

#### Features
- **AI-Powered Keyword Generation**: Uses various AI providers (OpenAI, Anthropic, Google, Azure) to generate contextually relevant keywords
- **Smart Categorization**: Keywords are automatically categorized as primary, secondary, technical, or synonym
- **Relevance Scoring**: Each keyword comes with relevance and confidence scores
- **Related Terms**: Suggests related terms and synonyms
- **Integration**: Seamlessly integrates with the existing search functionality

#### Usage
```typescript
import { AISemanticKeywordService } from '../services/aiSemanticKeywordService';

const keywordService = AISemanticKeywordService.getInstance();

const request = {
  userRequest: "Find authentication and user management code",
  context: "WordPress plugin development",
  targetLanguage: "PHP",
  maxKeywords: 10,
  includeSynonyms: true,
  includeTechnicalTerms: true
};

const response = await keywordService.generateKeywords(aiKey, model, request);
```

#### Supported AI Providers
- OpenAI (GPT models)
- Anthropic (Claude models)
- Google (Gemini models)
- Azure OpenAI

#### Keyword Categories
- **Primary**: Most relevant and important keywords
- **Secondary**: Supporting and related keywords
- **Technical**: Programming-specific terms and concepts
- **Synonym**: Alternative terms and variations



## Services

### CodespaceVectorService
Handles vector embeddings and semantic search operations.

### EnhancedAIEditorService
Provides AI-powered code editing and search capabilities.

### AISemanticKeywordService
Generates semantic keywords for improved search accuracy.

## Integration

The semantic keyword generator is integrated into the main codespace analysis component:

1. **Toggle Interface**: Users can show/hide the keyword generator
2. **AI Provider Selection**: Choose from available AI providers and models
3. **Request Input**: Natural language description of what to search for
4. **Advanced Options**: Context, target language, keyword count, etc.
5. **Generated Keywords**: Visual display with categorization and scores
6. **Search Integration**: One-click search using generated keywords

## Example Workflow

1. User describes what they're looking for: "Find user authentication code"
2. AI generates relevant keywords: "authentication", "login", "user management", "security", etc.
3. Keywords are categorized and scored for relevance
4. User can select specific keywords or use all for search
5. Search is automatically executed with the generated keywords
6. Results are displayed with depth analysis for landing page queries

## Benefits

- **Improved Search Accuracy**: AI-generated keywords are more contextually relevant than manual input
- **Time Savings**: No need to manually think of search terms
- **Better Coverage**: Includes synonyms and related terms automatically
- **Technical Precision**: Understands programming concepts and terminology
- **Seamless Integration**: Works with existing search and analysis features

## Configuration

The service automatically loads AI keys from localStorage and supports:
- Multiple AI providers
- Model selection
- Temperature and token limits
- Fallback parsing for malformed responses
- Common keyword suggestions as backup
