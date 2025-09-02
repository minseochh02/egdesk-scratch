export interface SearchReplacePromptRequest {
  userRequest: string;
  targetFile?: string;
  context?: string;
  exampleBefore?: string;
  exampleAfter?: string;
}

export interface SearchReplacePromptResponse {
  success: boolean;
  searchReplacePrompts: SearchReplacePrompt[];
  error?: string;
}

export interface SearchReplacePrompt {
  id: string;
  description: string;
  searchText: string;
  replaceText: string;
  filePath?: string;
  confidence: number;
  notes?: string;
}

export class SearchReplacePromptService {
  private static instance: SearchReplacePromptService;

  private constructor() {}

  static getInstance(): SearchReplacePromptService {
    if (!SearchReplacePromptService.instance) {
      SearchReplacePromptService.instance = new SearchReplacePromptService();
    }
    return SearchReplacePromptService.instance;
  }

  /**
   * Generate search and replace prompts based on user request
   */
  async generateSearchReplacePrompts(
    aiKey: any,
    model: string,
    request: SearchReplacePromptRequest
  ): Promise<SearchReplacePromptResponse> {
    try {
      console.log('🔍 Generating search and replace prompts for:', request.userRequest);
      
      // Build the prompt for search/replace generation
      const prompt = this.buildSearchReplacePrompt(request);
      
      // Send to AI provider
      const response = await this.sendToProvider(aiKey, model, prompt, {
        temperature: 0.1, // Very low temperature for precise text matching
        maxTokens: 2000
      });
      
      if (!response.success) {
        return {
          success: false,
          searchReplacePrompts: [],
          error: response.error || 'Failed to generate search/replace prompts'
        };
      }
      
      // Debug: Log raw AI response
      console.log('🔍 Raw AI Response for Search/Replace:', {
        provider: aiKey.providerId,
        model: model,
        rawContent: response.content,
        prompt: prompt
      });
      
      // Parse the AI response to extract search/replace prompts
      const searchReplacePrompts = this.parseSearchReplaceResponse(response.content || '');
      
      return {
        success: true,
        searchReplacePrompts
      };
      
    } catch (error) {
      console.error('Failed to generate search/replace prompts:', error);
      return {
        success: false,
        searchReplacePrompts: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convenient method to generate search/replace prompts with minimal parameters
   */
  async generatePrompts(
    aiKey: any,
    model: string,
    userRequest: string,
    targetFile?: string,
    context?: string
  ): Promise<SearchReplacePromptResponse> {
    const request: SearchReplacePromptRequest = {
      userRequest,
      targetFile,
      context
    };
    
    return this.generateSearchReplacePrompts(aiKey, model, request);
  }

  /**
   * Generate prompts for a specific file with content analysis
   */
  async generatePromptsForFile(
    aiKey: any,
    model: string,
    userRequest: string,
    filePath: string,
    fileContent?: string
  ): Promise<SearchReplacePromptResponse> {
    let context = `Target file: ${filePath}`;
    
    if (fileContent) {
      // Add file content context for better AI understanding
      const contentPreview = fileContent.length > 1000 
        ? fileContent.substring(0, 1000) + '... (truncated)'
        : fileContent;
      
      context += `\n\nFile content preview:\n\`\`\`\n${contentPreview}\n\`\`\``;
    }
    
    const request: SearchReplacePromptRequest = {
      userRequest,
      targetFile: filePath,
      context
    };
    
    return this.generateSearchReplacePrompts(aiKey, model, request);
  }

  /**
   * Build the prompt for search/replace generation
   */
  private buildSearchReplacePrompt(request: SearchReplacePromptRequest): string {
    let prompt = `## Search and Replace Prompt Generation

You are an expert at creating precise search and replace operations for code files. Your job is to generate EXACT text patterns that can be used to find and replace specific code sections.

## User Request:
${request.userRequest}

## Context:
${request.context || 'No additional context provided'}

## Target File:
${request.targetFile || 'Not specified'}

## Instructions:

1. **EXACT TEXT MATCHING**: The search text must be an EXACT match of what exists in the file
2. **UNIQUE CONTEXT**: Include enough surrounding context to make the search unique
3. **PRECISE REPLACEMENT**: The replace text should be exactly what you want to achieve
4. **FORMAT**: Use the exact format below with proper escaping

## OUTPUT FORMAT:
Return ONLY a JSON array in this exact format:

\`\`\`json
[
  {
    "id": "unique_id_1",
    "description": "Brief description of what this change does",
    "searchText": "EXACT text to find (include surrounding context)",
    "replaceText": "EXACT text to replace it with",
    "filePath": "path/to/file.ext",
    "confidence": 0.95,
    "notes": "Any important notes about this change"
  }
]
\`\`\`

## CRITICAL REQUIREMENTS:

1. **Search Text**: Must be an EXACT match of existing code, including:
   - Exact whitespace and indentation
   - Exact quotes and special characters
   - Enough context to be unique in the file
   - Line breaks and formatting

2. **Replace Text**: Must be exactly what you want the result to look like

3. **Escaping**: Properly escape special characters:
   - Use \`\\n\` for line breaks
   - Use \`\\t\` for tabs
   - Use \`\\"\\" for quotes inside strings
   - Use \`\\\\\` for backslashes

4. **Context Examples**:
   - For HTML: Include surrounding tags and attributes
   - For PHP: Include surrounding PHP tags and context
   - For CSS: Include surrounding selectors and rules
   - For JS: Include surrounding function/object context

## Example:
If you want to add a new option to a select dropdown, the search text should include the entire select element or at least the option before/after where you want to insert.

Generate the search and replace prompts now.`;

    // Add example if provided
    if (request.exampleBefore && request.exampleAfter) {
      prompt += `\n\n## Example Before/After:
**Before (search for this exact text):**
\`\`\`
${request.exampleBefore}
\`\`\`

**After (replace with this exact text):**
\`\`\`
${request.exampleAfter}
\`\`\``;
    }

    return prompt;
  }

  /**
   * Parse the AI response to extract search/replace prompts
   */
  private parseSearchReplaceResponse(content: string): SearchReplacePrompt[] {
    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/```json\s*(\[[\s\S]*?\])\s*```/);
      if (!jsonMatch) {
        console.warn('No JSON found in AI response');
        return [];
      }

      const jsonStr = jsonMatch[1];
      const prompts = JSON.parse(jsonStr) as SearchReplacePrompt[];

      // Validate and clean up the prompts
      return prompts
        .filter(prompt => 
          prompt.searchText && 
          prompt.replaceText && 
          prompt.description
        )
        .map(prompt => ({
          ...prompt,
          id: prompt.id || this.generateId(),
          confidence: Math.max(0, Math.min(1, prompt.confidence || 0.8))
        }));

    } catch (error) {
      console.error('Failed to parse search/replace response:', error);
      return [];
    }
  }

  /**
   * Send request to AI provider
   */
  private async sendToProvider(
    aiKey: any,
    model: string,
    prompt: string,
    options: { temperature: number; maxTokens: number }
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      // This would integrate with your existing AI provider system
      // For now, return a mock response
      console.log('🔍 Would send to AI provider:', {
        provider: aiKey.providerId,
        model,
        promptLength: prompt.length,
        options
      });

      // TODO: Integrate with actual AI provider
      return {
        success: false,
        error: 'AI provider integration not implemented yet'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate a unique ID for prompts
   */
  private generateId(): string {
    return `sr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate a search/replace prompt
   */
  validatePrompt(prompt: SearchReplacePrompt): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!prompt.searchText || prompt.searchText.trim().length === 0) {
      errors.push('Search text is required');
    }

    if (!prompt.replaceText || prompt.replaceText.trim().length === 0) {
      errors.push('Replace text is required');
    }

    if (!prompt.description || prompt.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (prompt.confidence < 0 || prompt.confidence > 1) {
      errors.push('Confidence must be between 0 and 1');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Format a search/replace prompt for display
   */
  formatPromptForDisplay(prompt: SearchReplacePrompt): string {
    return `## ${prompt.description}

**Search for:**
\`\`\`
${prompt.searchText}
\`\`\`

**Replace with:**
\`\`\`
${prompt.replaceText}
\`\`\`

**File:** ${prompt.filePath || 'Not specified'}
**Confidence:** ${Math.round(prompt.confidence * 100)}%
${prompt.notes ? `**Notes:** ${prompt.notes}` : ''}`;
  }
}
