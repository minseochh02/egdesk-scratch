import { AIKey } from '../../AIKeysManager/types';

// Gemini 2.0 Model Constants
export const GEMINI_2_0_MODELS = {
  FLASH: 'gemini-2.0-flash',
  FLASH_LITE: 'gemini-2.0-flash-lite',
  FLASH_LITE_PREVIEW: 'gemini-2.0-flash-lite-preview-02-05',
  PRO_EXP: 'gemini-2.0-pro-exp-02-05',
  FLASH_EXP: 'gemini-2.0-flash-exp'
} as const;

export type Gemini2Model = typeof GEMINI_2_0_MODELS[keyof typeof GEMINI_2_0_MODELS];

// Model-specific configurations for Gemini 2.0
export const GEMINI_2_0_CONFIGS = {
  [GEMINI_2_0_MODELS.FLASH]: {
    maxTokens: 1000000,
    contextWindow: 1048576,
    supportsReasoning: false,
    cost: { input: 0.10, output: 0.40 }
  },
  [GEMINI_2_0_MODELS.FLASH_LITE]: {
    maxTokens: 1000000,
    contextWindow: 1048576,
    supportsReasoning: false,
    cost: { input: 0, output: 0 }
  },
  [GEMINI_2_0_MODELS.FLASH_LITE_PREVIEW]: {
    maxTokens: 1000000,
    contextWindow: 1048576,
    supportsReasoning: false,
    cost: { input: 0.075, output: 0.30 }
  },
  [GEMINI_2_0_MODELS.PRO_EXP]: {
    maxTokens: 1000000,
    contextWindow: 1048576,
    supportsReasoning: false,
    cost: { input: 0, output: 0 }
  },
  [GEMINI_2_0_MODELS.FLASH_EXP]: {
    maxTokens: 1000000,
    contextWindow: 1048576,
    supportsReasoning: false,
    cost: { input: 0.07, output: 0.16 }
  }
} as const;

export interface SemanticKeywordRequest {
  userRequest: string;
  context?: string;
  projectStructure?: string;
  targetLanguage?: string;
  maxKeywords?: number;
  includeSynonyms?: boolean;
  includeTechnicalTerms?: boolean;
  includeFilePatterns?: boolean;
}

export interface SemanticKeywordResponse {
  success: boolean;
  keywords: SemanticKeyword[];
  error?: string;
  metadata?: {
    model: string;
    timestamp: string;
    processingTime: number;
  };
}

export interface SemanticKeyword {
  keyword: string;
  relevance: number; // 0-1 score
  category: 'primary' | 'secondary' | 'technical' | 'synonym';
  description?: string;
  relatedTerms?: string[];
  confidence: number; // 0-1 score
}

/**
 * AI Semantic Keyword Service with enhanced Gemini 2.0 support
 * 
 * This service provides semantic keyword generation using various AI providers,
 * with special optimizations for Google's Gemini 2.0 models including:
 * - gemini-2.0-flash: Fast and efficient model for most tasks
 * - gemini-2.0-flash-lite: Free tier model with good performance
 * - gemini-2.0-flash-lite-preview: Preview version with reduced pricing
 * - gemini-2.0-pro-exp: Experimental pro model (free during preview)
 * - gemini-2.0-flash-exp: Experimental flash model with reduced pricing
 */
export class AISemanticKeywordService {
  private static instance: AISemanticKeywordService;

  private constructor() {}

  static getInstance(): AISemanticKeywordService {
    if (!AISemanticKeywordService.instance) {
      AISemanticKeywordService.instance = new AISemanticKeywordService();
    }
    return AISemanticKeywordService.instance;
  }

  /**
   * Generate semantic keywords from user request
   */
  async generateKeywords(
    aiKey: AIKey,
    model: string,
    request: SemanticKeywordRequest
  ): Promise<SemanticKeywordResponse> {
    const startTime = Date.now();
    
    try {
      console.log('🔑 Generating semantic keywords for request:', request.userRequest);
      
      // Build the prompt for keyword generation
      const prompt = this.buildKeywordPrompt(request);
      
      // Send to AI provider
      const response = await this.sendToProvider(aiKey, model, prompt, {
        temperature: 0.3, // Lower temperature for more consistent keyword generation
        maxTokens: 1000
      });
      
      if (!response.success) {
        return {
          success: false,
          keywords: [],
          error: response.error || 'Failed to generate keywords'
        };
      }
      
      // Debug: Log raw AI response
      console.log('🔍 Raw AI Response for Keywords:', {
        provider: aiKey.providerId,
        model: model,
        rawContent: response.content,
        prompt: prompt
      });
      
      // Parse the AI response to extract keywords
      const keywords = this.parseKeywordResponse(response.content || '');
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        keywords,
        metadata: {
          model,
          timestamp: new Date().toISOString(),
          processingTime
        }
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Error generating semantic keywords:', error);
      
      return {
        success: false,
        keywords: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          model,
          timestamp: new Date().toISOString(),
          processingTime
        }
      };
    }
  }

  /**
   * Build prompt for keyword generation
   */
  private buildKeywordPrompt(request: SemanticKeywordRequest): string {
    let prompt = `
## USER REQUEST:
${request.userRequest}

## CONTEXT:
${request.context || 'General code analysis and search context'}

## KEYWORD EXAMPLES:
When generating keywords, think of them as file paths users might navigate to:
- For "contact page": contact/index.php, contact/contact.php, src/pages/Contact.tsx
- For "user authentication": auth/login.php, src/components/Auth.tsx, src/services/auth.ts
- For "database connection": src/database/connection.php, src/config/db.ts, database/config.php
- For "API endpoints": src/api/users.php, src/routes/api.ts, api/endpoints/users.php

## PROJECT STRUCTURE:
${request.projectStructure ? `This project has the following directory structure:

${request.projectStructure}

Use this project structure to generate keywords that represent potential file paths and directory structures. Focus on:
- Directory names and nested folder structures
- Common file naming patterns (e.g., index.php, contact.php, about.html)
- File extensions based on the languages used in this project
- Path patterns that would help locate specific functionality

Generate keywords that look like file paths users might navigate to.` : 'No specific project structure provided.'}

## TARGET LANGUAGE:
${request.targetLanguage || 'Any programming language'}

## OUTPUT FORMAT:
Return ONLY a JSON array of keywords in this exact format:
[
  {
    "keyword": "file path or directory pattern (e.g., contact/index.php, src/components/Contact.tsx)",
    "relevance": 0.95,
    "category": "primary|secondary|technical|synonym",
    "description": "brief explanation of what this file path represents or contains",
    "relatedTerms": ["term1", "term2"],
    "confidence": 0.9
  }
]

## IMPORTANT:
- Return ONLY valid JSON, no other text
- Use double quotes for strings
- Relevance and confidence scores should be between 0.0 and 1.0
- Categories must be exactly: primary, secondary, technical, or synonym
- Make keywords specific and actionable for code search
- Focus on practical file paths that developers would actually search for

## GEMINI 2.0 OPTIMIZATION:
- Generate concise but comprehensive keywords
- Prioritize relevance over quantity
- Ensure each keyword represents a distinct searchable concept
- Use consistent naming conventions throughout

Generate keywords now:`;

    return prompt;
  }

  /**
   * Get Gemini 2.0 model configuration
   */
  private getGemini2Config(model: string) {
    if (Object.values(GEMINI_2_0_MODELS).includes(model as Gemini2Model)) {
      return GEMINI_2_0_CONFIGS[model as Gemini2Model];
    }
    return null;
  }

  /**
   * Check if the model is a Gemini 2.0 model
   */
  private isGemini2Model(model: string): boolean {
    return Object.values(GEMINI_2_0_MODELS).includes(model as Gemini2Model);
  }

  /**
   * Validate if a model name is a valid Gemini 2.0 model
   */
  validateGemini2Model(model: string): { isValid: boolean; suggestions?: string[] } {
    if (this.isGemini2Model(model)) {
      return { isValid: true };
    }

    // Check if it's a similar model name and provide suggestions
    const lowerModel = model.toLowerCase();
    const suggestions: string[] = [];

    if (lowerModel.includes('gemini') && lowerModel.includes('2')) {
      if (lowerModel.includes('flash')) {
        suggestions.push(GEMINI_2_0_MODELS.FLASH, GEMINI_2_0_MODELS.FLASH_LITE);
      } else if (lowerModel.includes('pro')) {
        suggestions.push(GEMINI_2_0_MODELS.PRO_EXP);
      } else {
        suggestions.push(...Object.values(GEMINI_2_0_MODELS));
      }
    } else if (lowerModel.includes('gemini')) {
      suggestions.push(...Object.values(GEMINI_2_0_MODELS));
    }

    return {
      isValid: false,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }

  /**
   * Send request to AI provider
   */
  private async sendToProvider(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number }
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    const provider = aiKey.providerId;
    
    try {
      switch (provider) {
        case 'openai':
          return await this.sendOpenAIRequest(aiKey, model, prompt, config);
        case 'anthropic':
          return await this.sendAnthropicRequest(aiKey, model, prompt, config);
        case 'google':
          return await this.sendGoogleRequest(aiKey, model, prompt, config);
        case 'azure':
          return await this.sendAzureRequest(aiKey, model, prompt, config);
        default:
          return {
            success: false,
            error: `Unsupported provider: ${provider}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Provider request failed'
      };
    }
  }

  /**
   * Send request to OpenAI
   */
  private async sendOpenAIRequest(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number }
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiKey.fields.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a semantic keyword generator. Generate only valid JSON output.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      return { success: true, content };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OpenAI request failed'
      };
    }
  }

  /**
   * Send request to Anthropic
   */
  private async sendAnthropicRequest(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number }
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiKey.fields.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;
      
      if (!content) {
        throw new Error('No content received from Anthropic');
      }

      return { success: true, content };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Anthropic request failed'
      };
    }
  }

  /**
   * Send request to Google
   */
  private async sendGoogleRequest(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number }
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      // Get Gemini 2.0 specific configuration if available
      const gemini2Config = this.getGemini2Config(model);
      const isGemini2 = this.isGemini2Model(model);
      
      // Use model-specific max tokens if available, otherwise fall back to config
      const maxTokens = gemini2Config?.maxTokens || config.maxTokens;
      
      console.log('🔍 Sending request to Google/Gemini:', {
        model,
        isGemini2,
        gemini2Config,
        maxTokens,
        temperature: config.temperature
      });

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiKey.fields.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: config.temperature,
            maxOutputTokens: maxTokens,
            // Add Gemini 2.0 specific optimizations
            ...(isGemini2 && {
              topP: 0.8,
              topK: 40,
              candidateCount: 1
            })
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;
        
        // Enhanced error handling for Gemini 2.0 specific errors
        if (isGemini2) {
          console.error('❌ Gemini 2.0 API error:', {
            status: response.status,
            model,
            error: errorMessage,
            details: errorData
          });
        }
        
        throw new Error(`Google API error: ${response.status} - ${errorMessage}`);
      }

      const data = await response.json();
      
      // Debug: Log raw Google/Gemini API response
      console.log('🔍 Raw Google/Gemini API Response:', {
        status: response.status,
        statusText: response.statusText,
        model,
        isGemini2,
        fullResponse: data,
        candidates: data.candidates,
        usageMetadata: data.usageMetadata,
        modelVersion: data.modelVersion,
        responseId: data.responseId
      });
      
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) {
        console.error('❌ No content in Google response:', data);
        throw new Error('No content received from Google');
      }
      
      // Debug: Log extracted content
      console.log('🔍 Extracted Content from Google:', content);

      return { success: true, content };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google request failed'
      };
    }
  }

  /**
   * Send request to Azure OpenAI
   */
  private async sendAzureRequest(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number }
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const endpoint = aiKey.fields.endpoint || 'https://api.openai.com';
      const response = await fetch(`${endpoint}/openai/deployments/${model}/chat/completions?api-version=2023-05-15`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiKey.fields.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a semantic keyword generator. Generate only valid JSON output.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Azure OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from Azure OpenAI');
      }

      return { success: true, content };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Azure OpenAI request failed'
      };
    }
  }

  /**
   * Parse AI response to extract keywords
   */
  private parseKeywordResponse(response: string): SemanticKeyword[] {
    console.log('🔍 Parsing Keyword Response:', {
      responseLength: response.length,
      responsePreview: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
      fullResponse: response
    });
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('❌ No JSON array found in response');
        throw new Error('No JSON array found in response');
      }

      const jsonStr = jsonMatch[0];
      console.log('🔍 Extracted JSON string:', jsonStr);
      
      const keywords = JSON.parse(jsonStr);
      console.log('🔍 Parsed keywords:', keywords);

      if (!Array.isArray(keywords)) {
        throw new Error('Response is not an array');
      }

      // Validate and normalize keywords
      return keywords.map((keyword, index) => ({
        keyword: keyword.keyword || `keyword_${index}`,
        relevance: Math.max(0, Math.min(1, keyword.relevance || 0.5)),
        category: this.validateCategory(keyword.category),
        description: keyword.description || '',
        relatedTerms: Array.isArray(keyword.relatedTerms) ? keyword.relatedTerms : [],
        confidence: Math.max(0, Math.min(1, keyword.confidence || 0.5))
      }));

    } catch (error) {
      console.error('❌ Error parsing keyword response:', error);
      console.error('Raw response:', response);
      
      // Fallback: try to extract keywords using regex
      return this.fallbackKeywordExtraction(response);
    }
  }

  /**
   * Validate keyword category
   */
  private validateCategory(category: any): 'primary' | 'secondary' | 'technical' | 'synonym' {
    const validCategories = ['primary', 'secondary', 'technical', 'synonym'];
    return validCategories.includes(category) ? category : 'secondary';
  }

  /**
   * Fallback keyword extraction using regex
   */
  private fallbackKeywordExtraction(response: string): SemanticKeyword[] {
    console.log('🔍 Using fallback keyword extraction');
    
    const keywords: SemanticKeyword[] = [];
    
    // Extract potential keywords (words in quotes or after "keyword:")
    const keywordMatches = response.match(/"([^"]+)"/g) || [];
    const colonMatches = response.match(/keyword:\s*([^\n,]+)/gi) || [];
    
    console.log('🔍 Fallback extraction results:', {
      keywordMatches,
      colonMatches
    });
    
    const extracted = [
      ...keywordMatches.map(match => match.replace(/"/g, '')),
      ...colonMatches.map(match => match.replace(/keyword:\s*/i, '').trim())
    ];

    // Remove duplicates and create keyword objects
    const uniqueKeywords = [...new Set(extracted)].filter(k => k.length > 2);
    
    console.log('🔍 Unique extracted keywords:', uniqueKeywords);
    
    uniqueKeywords.slice(0, 10).forEach((keyword, index) => {
      keywords.push({
        keyword,
        relevance: 0.8 - (index * 0.05),
        category: index === 0 ? 'primary' : 'secondary',
        description: 'Extracted from AI response',
        relatedTerms: [],
        confidence: 0.7
      });
    });

    console.log('🔍 Generated fallback keywords:', keywords);
    return keywords;
  }

  /**
   * Get available Gemini 2.0 models
   */
  getAvailableGemini2Models(): Array<{ id: string; name: string; description: string; cost: { input: number; output: number } }> {
    return [
      {
        id: GEMINI_2_0_MODELS.FLASH,
        name: 'Gemini 2.0 Flash',
        description: 'Fast and efficient model for most tasks',
        cost: GEMINI_2_0_CONFIGS[GEMINI_2_0_MODELS.FLASH].cost
      },
      {
        id: GEMINI_2_0_MODELS.FLASH_LITE,
        name: 'Gemini 2.0 Flash Lite',
        description: 'Free tier model with good performance',
        cost: GEMINI_2_0_CONFIGS[GEMINI_2_0_MODELS.FLASH_LITE].cost
      },
      {
        id: GEMINI_2_0_MODELS.FLASH_LITE_PREVIEW,
        name: 'Gemini 2.0 Flash Lite Preview',
        description: 'Preview version with reduced pricing',
        cost: GEMINI_2_0_CONFIGS[GEMINI_2_0_MODELS.FLASH_LITE_PREVIEW].cost
      },
      {
        id: GEMINI_2_0_MODELS.PRO_EXP,
        name: 'Gemini 2.0 Pro Experimental',
        description: 'Experimental pro model (free during preview)',
        cost: GEMINI_2_0_CONFIGS[GEMINI_2_0_MODELS.PRO_EXP].cost
      },
      {
        id: GEMINI_2_0_MODELS.FLASH_EXP,
        name: 'Gemini 2.0 Flash Experimental',
        description: 'Experimental flash model with reduced pricing',
        cost: GEMINI_2_0_CONFIGS[GEMINI_2_0_MODELS.FLASH_EXP].cost
      }
    ];
  }

  /**
   * Get recommended Gemini 2.0 model for keyword generation
   */
  getRecommendedGemini2ModelForKeywords(): string {
    // For keyword generation, Flash Lite is usually the best choice (free, fast, sufficient quality)
    return GEMINI_2_0_MODELS.FLASH_LITE;
  }

  /**
   * Get keyword suggestions based on common programming patterns
   */
  getCommonKeywordSuggestions(): SemanticKeyword[] {
    return [
      {
        keyword: 'authentication',
        relevance: 0.9,
        category: 'primary',
        description: 'User login and security systems',
        relatedTerms: ['login', 'auth', 'security', 'jwt', 'oauth'],
        confidence: 0.95
      },
      {
        keyword: 'database',
        relevance: 0.9,
        category: 'primary',
        description: 'Data storage and management',
        relatedTerms: ['sql', 'mongodb', 'redis', 'query', 'schema'],
        confidence: 0.95
      },
      {
        keyword: 'api',
        relevance: 0.9,
        category: 'primary',
        description: 'Application programming interfaces',
        relatedTerms: ['rest', 'graphql', 'endpoint', 'http', 'json'],
        confidence: 0.95
      },
      {
        keyword: 'frontend',
        relevance: 0.8,
        category: 'secondary',
        description: 'User interface components',
        relatedTerms: ['ui', 'ux', 'react', 'vue', 'angular'],
        confidence: 0.9
      },
      {
        keyword: 'backend',
        relevance: 0.8,
        category: 'secondary',
        description: 'Server-side logic and services',
        relatedTerms: ['server', 'node', 'python', 'java', 'php'],
        confidence: 0.9
      }
    ];
  }
}
