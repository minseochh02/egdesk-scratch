/**
 * Gemini AI Client Service
 * Simple implementation for EGDesk based on Gemini CLI patterns
 */

import { GoogleGenerativeAI, GenerateContentConfig, GenerateContentRequest, Tool, Content, Part } from '@google/generative-ai';
import { ipcMain } from 'electron';
import { toolRegistry } from './tool-registry';
import { projectContextBridge } from './project-context-bridge';
import type { 
  AIClientConfig, 
  ConversationMessage, 
  AIResponse, 
  AIClientService,
  ToolCallRequest,
  ToolCallResponse
} from '../types/ai-types';

export class GeminiClientService implements AIClientService {
  private genAI?: GoogleGenerativeAI;
  private model?: any;
  private config?: AIClientConfig;
  private conversationHistory: ConversationMessage[] = [];
  private isInitialized = false;

  constructor() {
    this.registerIPCHandlers();
  }

  /**
   * Configure the Gemini client with API key and settings
   */
  async configure(config: AIClientConfig): Promise<boolean> {
    try {
      this.config = {
        model: 'gemini-1.5-flash',
        temperature: 0.7,
        topP: 1,
        maxOutputTokens: 8192,
        ...config
      };

      // Initialize Google Generative AI
      this.genAI = new GoogleGenerativeAI(config.apiKey);
      
      // Get the model
      this.model = this.genAI.getGenerativeModel({ 
        model: this.config.model!,
        generationConfig: {
          temperature: this.config.temperature,
          topP: this.config.topP,
          maxOutputTokens: this.config.maxOutputTokens,
        }
      });

      this.isInitialized = true;
      console.log('✅ Gemini client configured successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to configure Gemini client:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Check if client is properly configured
   */
  isConfigured(): boolean {
    return this.isInitialized && !!this.genAI && !!this.model;
  }

  /**
   * Send a message with tools automatically available
   */
  async sendMessage(message: string): Promise<AIResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Gemini client not configured. Please provide API key.'
      };
    }

    try {
      // Get project context and enhance the message
      const projectContext = toolRegistry.getProjectContext();
      const enhancedMessage = `${projectContext}\n\nUser Request: ${message}`;

      // Add user message to history (original message)
      const userMessage: ConversationMessage = {
        role: 'user',
        parts: [{ text: message }],
        timestamp: new Date()
      };
      this.addToHistory(userMessage);

      // Get available tools
      const tools = toolRegistry.getGeminiTools();

      // Create model with tools
      const modelWithTools = this.genAI!.getGenerativeModel({
        model: this.config!.model!,
        tools: tools,
        generationConfig: {
          temperature: this.config!.temperature,
          topP: this.config!.topP,
          maxOutputTokens: this.config!.maxOutputTokens,
        }
      });

      // Generate response with tools using enhanced message with project context
      const result = await modelWithTools.generateContent(enhancedMessage);

      const response = result.response;
      let responseText = '';
      let functionCalls: any[] = [];

      // Get function calls if any
      try {
        functionCalls = response.functionCalls() || [];
      } catch (e) {
        // No function calls
        functionCalls = [];
      }

      // Get response text
      try {
        responseText = response.text();
      } catch (e) {
        // Sometimes response.text() fails if there are only function calls
        responseText = '';
      }

      // Execute function calls if any
      if (functionCalls.length > 0) {
        console.log(`🔧 Executing ${functionCalls.length} function call(s)`);
        
        for (const functionCall of functionCalls) {
          try {
            const toolResult = await toolRegistry.executeTool(
              functionCall.name, 
              functionCall.args
            );
            
            // Add function result to response text
            responseText += `\n\n✅ **${functionCall.name}** executed successfully:\n`;
            if (toolResult.success) {
              if (functionCall.name === 'write_file') {
                responseText += `📄 Created file: \`${toolResult.relative_path || toolResult.file_path}\`\n`;
                responseText += `📊 Size: ${toolResult.file_size} bytes (${toolResult.lines_written} lines)\n`;
                if (toolResult.description) {
                  responseText += `📝 Description: ${toolResult.description}\n`;
                }
              } else if (functionCall.name === 'read_file') {
                responseText += `📖 Read file: \`${toolResult.file_path}\`\n`;
                responseText += `📊 Content length: ${toolResult.content?.length || 0} characters\n`;
              }
            } else {
              responseText += `❌ Error: ${toolResult.error}\n`;
            }
          } catch (error) {
            responseText += `\n❌ **${functionCall.name}** failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
          }
        }
      }

      // If no response text, provide default
      if (!responseText.trim()) {
        responseText = 'Task completed successfully.';
      }

      // Add model response to history
      const modelParts: Part[] = [];
      if (responseText) {
        modelParts.push({ text: responseText });
      }
      if (functionCalls.length > 0) {
        functionCalls.forEach(fc => {
          modelParts.push({ functionCall: fc });
        });
      }

      const modelMessage: ConversationMessage = {
        role: 'model',
        parts: modelParts,
        timestamp: new Date()
      };
      this.addToHistory(modelMessage);

      return {
        success: true,
        content: responseText,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined
        // Note: fullResponse removed to prevent IPC cloning errors
      };
    } catch (error) {
      console.error('❌ Error sending message to Gemini:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Send a message with tools available for function calling
   */
  async sendMessageWithTools(message: string, tools: Tool[]): Promise<AIResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Gemini client not configured. Please provide API key.'
      };
    }

    try {
      // Add user message to history
      const userMessage: ConversationMessage = {
        role: 'user',
        parts: [{ text: message }],
        timestamp: new Date()
      };
      this.addToHistory(userMessage);

      // Create model with tools
      const modelWithTools = this.genAI!.getGenerativeModel({
        model: this.config!.model!,
        tools: tools,
        generationConfig: {
          temperature: this.config!.temperature,
          topP: this.config!.topP,
          maxOutputTokens: this.config!.maxOutputTokens,
        }
      });

      // Convert history to Content format for Gemini
      const history: Content[] = this.conversationHistory.slice(0, -1).map(msg => ({
        role: msg.role,
        parts: msg.parts
      }));

      // Start chat with history
      const chat = modelWithTools.startChat({
        history: history
      });

      // Send message
      const result = await chat.sendMessage(message);
      const response = result.response;

      // Check for function calls
      const functionCalls = response.functionCalls();

      let responseText = '';
      try {
        responseText = response.text();
      } catch (e) {
        // Sometimes response.text() fails if there are only function calls
        responseText = '';
      }

      // Add model response to history
      const modelParts: Part[] = [];
      if (responseText) {
        modelParts.push({ text: responseText });
      }
      if (functionCalls && functionCalls.length > 0) {
        functionCalls.forEach(fc => {
          modelParts.push({ functionCall: fc });
        });
      }

      const modelMessage: ConversationMessage = {
        role: 'model',
        parts: modelParts,
        timestamp: new Date()
      };
      this.addToHistory(modelMessage);

      return {
        success: true,
        content: responseText,
        functionCalls: functionCalls || undefined
        // Note: fullResponse removed to prevent IPC cloning errors
      };
    } catch (error) {
      console.error('❌ Error sending message with tools to Gemini:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Add message to conversation history
   */
  addToHistory(message: ConversationMessage): void {
    this.conversationHistory.push(message);
    
    // Keep history manageable (last 50 messages)
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50);
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationMessage[] {
    // Convert Date objects to ISO strings for IPC serialization
    return this.conversationHistory.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp) // Ensure it's properly serializable
    }));
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    console.log('🧹 Conversation history cleared');
  }

  /**
   * Get available Gemini models
   */
  getAvailableModels(): string[] {
    return [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.0-pro'
    ];
  }

  /**
   * Register IPC handlers for renderer process communication
   */
  private registerIPCHandlers(): void {
    // Configure Gemini client
    ipcMain.handle('ai-configure', async (event, config: AIClientConfig) => {
      return await this.configure(config);
    });

    // Check if configured
    ipcMain.handle('ai-is-configured', async () => {
      return this.isConfigured();
    });

    // Send simple message
    ipcMain.handle('ai-send-message', async (event, message: string) => {
      return await this.sendMessage(message);
    });

    // Send message with tools
    ipcMain.handle('ai-send-message-with-tools', async (event, message: string, tools: Tool[]) => {
      return await this.sendMessageWithTools(message, tools);
    });

    // Get conversation history
    ipcMain.handle('ai-get-history', async () => {
      return this.getHistory();
    });

    // Clear conversation history
    ipcMain.handle('ai-clear-history', async () => {
      this.clearHistory();
      return true;
    });

    // Get available models
    ipcMain.handle('ai-get-models', async () => {
      return this.getAvailableModels();
    });

    console.log('✅ Gemini AI IPC handlers registered');
  }

  /**
   * Unregister IPC handlers
   */
  unregisterHandlers(): void {
    ipcMain.removeHandler('ai-configure');
    ipcMain.removeHandler('ai-is-configured');
    ipcMain.removeHandler('ai-send-message');
    ipcMain.removeHandler('ai-send-message-with-tools');
    ipcMain.removeHandler('ai-get-history');
    ipcMain.removeHandler('ai-clear-history');
    ipcMain.removeHandler('ai-get-models');
    console.log('✅ Gemini AI IPC handlers unregistered');
  }
}

// Export singleton instance
export const geminiClient = new GeminiClientService();
