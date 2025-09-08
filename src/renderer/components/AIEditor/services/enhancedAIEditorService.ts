import { AIKey } from '../../AIKeysManager/types';
import {
  AIEditRequest,
  AIEditResponse,
  AIEditStreamResponse,
  AIEdit,
  FileContext,
  AIEditorConfig,
} from '../types';
import { CodespaceVectorService } from './codespaceVectorService';

export class EnhancedAIEditorService {
  private static codespaceService = CodespaceVectorService.getInstance();

  /**
   * Simple edit request - just send the file content and instruction to AI
   */
  static async requestEdit(
    aiKey: AIKey,
    model: string,
    request: AIEditRequest,
    config: {
      temperature: number;
      maxTokens: number;
      systemPrompt?: string;
    },
  ): Promise<AIEditResponse> {
    try {
      console.log('🚀 Simple AI request to model:', model);

      // Build a simple prompt with just the file content and instruction
      const prompt = this.buildSimplePrompt(request, config.systemPrompt);

      // Send to AI provider
      return await this.sendToProvider(aiKey, model, prompt, config);
    } catch (error) {
      return {
        success: false,
        edits: [],
        error: error instanceof Error ? error.message : 'Request failed',
      };
    }
  }

  /**
   * Simple streaming request
   */
  static async requestEditStream(
    aiKey: AIKey,
    model: string,
    request: AIEditRequest,
    config: {
      temperature: number;
      maxTokens: number;
      systemPrompt?: string;
    },
    onChunk: (chunk: AIEditStreamResponse) => void,
  ): Promise<void> {
    try {
      const prompt = this.buildSimplePrompt(request, config.systemPrompt);
      await this.streamToProvider(aiKey, model, prompt, config, onChunk);
    } catch (error) {
      onChunk({
        type: 'error',
        error: error instanceof Error ? error.message : 'Streaming failed',
        isComplete: true,
      });
    }
  }

  /**
   * Build a simple prompt with file content
   */
  private static buildSimplePrompt(
    request: AIEditRequest,
    systemPrompt?: string,
  ): string {
    const basePrompt =
      systemPrompt ||
      `You are an expert coding assistant. Help the user with their code.`;

    let prompt = `${basePrompt}\n\n`;
    prompt += `## FILE: ${request.filePath}\n`;
    prompt += `## LANGUAGE: ${request.language || 'text'}\n`;
    prompt += `## INSTRUCTION: ${request.userInstruction}\n\n`;
    prompt += `## FILE CONTENT:\n`;
    prompt += `\`\`\`${request.language || 'text'}\n${request.fileContent}\n\`\`\`\n\n`;
    prompt += `Please help with the above instruction.`;

    return prompt;
  }

  /**
   * Send request to AI provider
   */
  private static async sendToProvider(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
  ): Promise<AIEditResponse> {
    const provider = aiKey.providerId;

    switch (provider) {
      case 'openai':
        return await this.sendOpenAIRequest(aiKey, model, prompt, config);
      case 'anthropic':
        return await this.sendAnthropicRequest(aiKey, model, prompt, config);
      case 'google':
        return await this.sendGoogleRequest(aiKey, model, prompt, config);
      case 'azure':
        return await this.sendAzureRequest(aiKey, model, prompt, config);
      case 'custom':
        return await this.sendCustomRequest(aiKey, model, prompt, config);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * Stream request to AI provider
   */
  private static async streamToProvider(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
    onChunk: (chunk: AIEditStreamResponse) => void,
  ): Promise<void> {
    const provider = aiKey.providerId;

    switch (provider) {
      case 'openai':
        await this.streamOpenAIRequest(aiKey, model, prompt, config, onChunk);
        break;
      case 'anthropic':
        await this.streamAnthropicRequest(
          aiKey,
          model,
          prompt,
          config,
          onChunk,
        );
        break;
      default:
        onChunk({
          type: 'error',
          error: `Streaming not supported for ${provider}`,
          isComplete: true,
        });
    }
  }

  // OpenAI implementation
  private static async sendOpenAIRequest(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
  ): Promise<AIEditResponse> {
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
        },
      );

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || 'No response';

      return {
        success: true,
        edits: [],
        explanation: content,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        cost: 0.001,
      };
    } catch (error) {
      return {
        success: false,
        edits: [],
        error: error instanceof Error ? error.message : 'OpenAI request failed',
      };
    }
  }

  // Anthropic implementation
  private static async sendAnthropicRequest(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
  ): Promise<AIEditResponse> {
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
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.content[0]?.text || 'No response';

      return {
        success: true,
        edits: [],
        explanation: content,
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens:
            (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
        cost: 0.001,
      };
    } catch (error) {
      return {
        success: false,
        edits: [],
        error:
          error instanceof Error ? error.message : 'Anthropic request failed',
      };
    }
  }

  // Google implementation
  private static async sendGoogleRequest(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
  ): Promise<AIEditResponse> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiKey.fields.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: config.temperature,
              maxOutputTokens: config.maxTokens,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`);
      }

      const data = await response.json();
      const content =
        data.candidates[0]?.content?.parts[0]?.text || 'No response';

      return {
        success: true,
        edits: [],
        explanation: content,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        cost: 0,
      };
    } catch (error) {
      return {
        success: false,
        edits: [],
        error: error instanceof Error ? error.message : 'Google request failed',
      };
    }
  }

  // Azure implementation
  private static async sendAzureRequest(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
  ): Promise<AIEditResponse> {
    try {
      const endpoint =
        aiKey.fields.endpoint || 'https://your-resource.openai.azure.com';
      const deployment = aiKey.fields.deployment || model;

      const response = await fetch(
        `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': aiKey.fields.apiKey,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            stream: false,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Azure API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || 'No response';

      return {
        success: true,
        edits: [],
        explanation: content,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        cost: 0.001,
      };
    } catch (error) {
      return {
        success: false,
        edits: [],
        error: error instanceof Error ? error.message : 'Azure request failed',
      };
    }
  }

  // Custom implementation
  private static async sendCustomRequest(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
  ): Promise<AIEditResponse> {
    try {
      const endpoint =
        aiKey.fields.endpoint || 'https://api.custom.com/v1/chat/completions';

      const response = await fetch(endpoint, {
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
      });

      if (!response.ok) {
        throw new Error(`Custom API error: ${response.status}`);
      }

      const data = await response.json();
      const content =
        data.choices?.[0]?.message?.content || data.content || 'No response';

      return {
        success: true,
        edits: [],
        explanation: content,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        cost: 0,
      };
    } catch (error) {
      return {
        success: false,
        edits: [],
        error: error instanceof Error ? error.message : 'Custom request failed',
      };
    }
  }

  // Streaming implementations
  private static async streamOpenAIRequest(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
    onChunk: (chunk: AIEditStreamResponse) => void,
  ): Promise<void> {
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
            stream: true,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`OpenAI streaming error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body reader');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onChunk({ type: 'done', isComplete: true });
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                onChunk({ type: 'content', content, isComplete: false });
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }

      onChunk({ type: 'content', content: '', isComplete: true });
    } catch (error) {
      onChunk({
        type: 'error',
        error:
          error instanceof Error ? error.message : 'OpenAI streaming failed',
        isComplete: true,
      });
    }
  }

  private static async streamAnthropicRequest(
    aiKey: AIKey,
    model: string,
    prompt: string,
    config: { temperature: number; maxTokens: number },
    onChunk: (chunk: AIEditStreamResponse) => void,
  ): Promise<void> {
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
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic streaming error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body reader');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onChunk({ type: 'done', isComplete: true });
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.delta?.text || '';
              if (content) {
                onChunk({ type: 'content', content, isComplete: false });
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }

      onChunk({ type: 'content', content: '', isComplete: true });
    } catch (error) {
      onChunk({
        type: 'error',
        error:
          error instanceof Error ? error.message : 'Anthropic streaming failed',
        isComplete: true,
      });
    }
  }

  // Utility methods
  static async getCacheStatus(): Promise<{
    hasCache: boolean;
    cacheAge?: number;
    workspacePath?: string;
    totalFiles?: number;
  }> {
    try {
      const status = await this.codespaceService.getCacheStatus();
      return status;
    } catch (error) {
      return { hasCache: false };
    }
  }

  static async forceRefresh(workspacePath: string): Promise<void> {
    try {
      await this.codespaceService.forceRefresh(workspacePath);
    } catch (error) {
      console.error('Failed to force refresh:', error);
    }
  }

  static async searchCodespace(
    query: string,
    limit: number = 8,
  ): Promise<any[]> {
    try {
      const results = await this.codespaceService.searchCodespace(query, limit);
      return results;
    } catch (error) {
      return [];
    }
  }

  static getLanguageFromExtension(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'php':
        return 'php';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'cpp':
      case 'cc':
      case 'cxx':
        return 'cpp';
      case 'c':
        return 'c';
      case 'json':
        return 'json';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'md':
      case 'markdown':
        return 'markdown';
      case 'sql':
        return 'sql';
      case 'sh':
      case 'bash':
      case 'zsh':
      case 'fish':
        return 'shell';
      case 'dockerfile':
      case 'docker':
        return 'dockerfile';
      case 'xml':
        return 'xml';
      case 'csv':
      case 'tsv':
        return 'csv';
      case 'log':
        return 'log';
      case 'txt':
        return 'text';
      default:
        return 'plaintext';
    }
  }

  static async analyzeFile(
    filePath: string,
    content: string,
  ): Promise<Partial<FileContext>> {
    const language = this.getLanguageFromExtension(filePath);
    return {
      imports: [],
      classes: [],
      functions: [],
      variables: [],
      language,
    };
  }

  /**
   * Apply edits to content using the comprehensive FileWriterService
   */
  static applyEdits(originalContent: string, edits: AIEdit[]): string {
    try {
      // Import and use the FileWriterService for proper edit application
      const {
        FileWriterService,
      } = require('../../../services/fileWriterService');
      const fileWriter = FileWriterService.getInstance();

      console.log('🔍 DEBUG: Applying edits to content', {
        originalContentLength: originalContent.length,
        editsLength: edits.length,
        edits: edits.map((e) => ({
          type: e.type,
          filePath: e.filePath,
          oldText: e.oldText,
          newText: e.newText,
        })),
      });

      const result = fileWriter.applyEditsToContent(originalContent, edits);

      console.log('🔍 DEBUG: Result of applying edits to content', {
        success: result.success,
        contentLength: result.content.length,
        errors: result.errors,
      });

      if (result.success) {
        console.log(`✅ Successfully applied ${edits.length} edits to content`);
        return result.content;
      }
      console.error(`❌ Failed to apply edits:`, result.errors);
      return originalContent; // Return original content on failure
    } catch (error) {
      console.error('❌ Error in applyEdits:', error);
      return originalContent; // Return original content on error
    }
  }

  /**
   * Apply edits directly to files (enhanced version)
   */
  static async applyEditsToFiles(
    edits: AIEdit[],
    projectRoot?: string,
  ): Promise<{
    success: boolean;
    modifiedFiles: string[];
    errors: string[];
    backupPaths?: string[];
  }> {
    try {
      const {
        FileWriterService,
      } = require('../../../services/fileWriterService');
      const fileWriter = FileWriterService.getInstance();

      console.log(`🔍 DEBUG: Applying edits with project root: ${projectRoot}`);
      return await fileWriter.applyChangesToFiles(edits, projectRoot);
    } catch (error) {
      console.error('❌ Error applying edits to files:', error);
      return {
        success: false,
        modifiedFiles: [],
        errors: [
          `Failed to apply edits: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }
}
