// /**
//  * Simple AI Client for Testing
//  * Simplified version to test basic functionality
//  */

// import { GoogleGenerativeAI } from '@google/generative-ai';
// import { ipcMain } from 'electron';
// import type { AIClientConfig, AIResponse } from '../types/ai-types';

// export class SimpleAIClient {
//   private genAI?: GoogleGenerativeAI;
//   private model?: any;
//   private config?: AIClientConfig;

//   constructor() {
//     this.registerIPCHandlers();
//   }

//   async configure(config: AIClientConfig): Promise<boolean> {
//     try {
//       console.log('🔧 Configuring Simple AI Client with API key');
//       this.genAI = new GoogleGenerativeAI(config.apiKey);
//       this.model = this.genAI.getGenerativeModel({
//         model: config.model || 'gemini-1.5-flash-latest',
//         generationConfig: {
//           temperature: config.temperature || 0.7,
//           topP: config.topP || 0.8,
//           maxOutputTokens: config.maxOutputTokens || 4096,
//         }
//       });

//       this.config = config;
//       console.log('✅ Simple AI Client configured successfully');
//       return true;
//     } catch (error) {
//       console.error('❌ Failed to configure Simple AI Client:', error);
//       return false;
//     }
//   }

//   isConfigured(): boolean {
//     return !!(this.genAI && this.model && this.config);
//   }

//   async sendMessage(message: string): Promise<AIResponse> {
//     if (!this.isConfigured()) {
//       return { success: false, error: 'AI client not configured' };
//     }

//     try {
//       console.log('📤 Sending message to Gemini:', message);
//       const result = await this.model!.generateContent(message);
//       const response = await result.response;
//       const text = response.text();

//       console.log('📥 Received response from Gemini:', text.substring(0, 100) + '...');

//       return {
//         success: true,
//         content: text,
//         fullResponse: response
//       };
//     } catch (error) {
//       console.error('❌ Error in sendMessage:', error);
//       return {
//         success: false,
//         error: error instanceof Error ? error.message : 'Unknown error'
//       };
//     }
//   }

//   private registerIPCHandlers(): void {
//     ipcMain.handle('simple-ai-configure', async (event, config: AIClientConfig) => {
//       return await this.configure(config);
//     });

//     ipcMain.handle('simple-ai-is-configured', async () => {
//       return this.isConfigured();
//     });

//     ipcMain.handle('simple-ai-send-message', async (event, message: string) => {
//       return await this.sendMessage(message);
//     });

//     console.log('✅ Simple AI IPC handlers registered');
//   }
// }

// export const simpleAIClient = new SimpleAIClient();
