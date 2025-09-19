// /**
//  * Gemini AI Client Service with Conversation Loop
//  * Enhanced implementation for EGDesk with autonomous tool chaining
//  */

// import { GoogleGenerativeAI, GenerateContentConfig, GenerateContentRequest, Tool, Content, Part } from '@google/generative-ai';
// import { ipcMain } from 'electron';
// import { toolRegistry } from './tool-registry';
// import { projectContextBridge } from './project-context-bridge';
// import type { 
//   AIClientConfig, 
//   ConversationMessage, 
//   AIResponse, 
//   AIClientService,
//   ToolCallRequest,
//   ToolCallResponse
// } from '../types/ai-types';

// export class GeminiClientServiceV2 implements AIClientService {
//   private genAI?: GoogleGenerativeAI;
//   private model?: any;
//   private config?: AIClientConfig;
//   private isInitialized = false;
//   private conversationHistory: ConversationMessage[] = [];

//   constructor() {
//     this.registerIPCHandlers();
//   }

//   /**
//    * Register IPC handlers for the AI client
//    */
//   private registerIPCHandlers(): void {
//     ipcMain.handle('ai-configure', async (event, config: AIClientConfig) => {
//       return this.configure(config);
//     });

//     ipcMain.handle('ai-is-configured', async () => {
//       return this.isConfigured();
//     });

//     ipcMain.handle('ai-send-message', async (event, message: string) => {
//       return this.sendMessage(message);
//     });

//     ipcMain.handle('ai-get-history', async () => {
//       return this.getHistory();
//     });

//     ipcMain.handle('ai-clear-history', async () => {
//       return this.clearHistory();
//     });
//   }

//   /**
//    * Configure the AI client with API key and settings
//    */
//   async configure(config: AIClientConfig): Promise<boolean> {
//     try {
//       this.config = config;
//       this.genAI = new GoogleGenerativeAI(config.apiKey);
//       this.model = this.genAI.getGenerativeModel({ 
//         model: config.model || 'gemini-1.5-flash-latest'
//       });
      
//       this.isInitialized = true;
//       console.log('✅ Gemini client configured successfully');
//       return true;
//     } catch (error) {
//       console.error('❌ Failed to configure Gemini client:', error);
//       this.isInitialized = false;
//       return false;
//     }
//   }

//   /**
//    * Check if client is properly configured
//    */
//   isConfigured(): boolean {
//     return this.isInitialized && !!this.genAI && !!this.model;
//   }

//   /**
//    * Send a message with autonomous tool chaining
//    */
//   async sendMessage(message: string): Promise<AIResponse> {
//     if (!this.isConfigured()) {
//       return {
//         success: false,
//         error: 'Gemini client not configured. Please provide API key.'
//       };
//     }

//     try {
//       // Get project context and enhance the message
//       const projectContext = toolRegistry.getProjectContext();
//       const enhancedMessage = `${projectContext}\n\nUser Request: ${message}\n\nIMPORTANT: Use the available tools to explore and understand the project before responding. Don't ask the user for information you can discover yourself using list_directory, read_file, etc.`;

//       // Add user message to history (original message)
//       const userMessage: ConversationMessage = {
//         role: 'user',
//         parts: [{ text: message }],
//         timestamp: new Date()
//       };
//       this.addToHistory(userMessage);

//       // Start conversation loop with tool chaining
//       const finalResponse = await this.conversationLoop(enhancedMessage);

//       // Add AI response to history
//       const aiMessage: ConversationMessage = {
//         role: 'model',
//         parts: [{ text: finalResponse }],
//         timestamp: new Date()
//       };
//       this.addToHistory(aiMessage);

//       return {
//         success: true,
//         content: finalResponse,
//         timestamp: new Date()
//       };

//     } catch (error) {
//       console.error('Gemini API error:', error);
//       return {
//         success: false,
//         error: error instanceof Error ? error.message : 'Unknown error occurred'
//       };
//     }
//   }

//   /**
//    * Conversation loop that allows AI to chain tool calls autonomously
//    */
//   private async conversationLoop(initialMessage: string, maxTurns: number = 5): Promise<string> {
//     const tools = toolRegistry.getGeminiTools();
//     let currentMessages: any[] = [{ role: 'user', parts: [{ text: initialMessage }] }];
//     let finalResponse = '';
//     let turnCount = 0;

//     while (turnCount < maxTurns) {
//       turnCount++;
//       console.log(`🔄 Conversation turn ${turnCount}/${maxTurns}`);

//       try {
//         // Create model with tools for this turn
//         const modelWithTools = this.genAI!.getGenerativeModel({
//           model: this.config!.model || 'gemini-1.5-flash-latest',
//           tools: tools,
//           generationConfig: {
//             temperature: this.config!.temperature || 0.7,
//             topP: this.config!.topP || 0.8,
//             maxOutputTokens: this.config!.maxOutputTokens || 8192,
//           }
//         });

//         // Create chat with current history
//         const chat = modelWithTools.startChat({
//           history: currentMessages.slice(0, -1), // All messages except the last one
//         });

//         // Send the latest message
//         const result = await chat.sendMessage(currentMessages[currentMessages.length - 1].parts);
//         const response = result.response;

//         // Get function calls and response text
//         let functionCalls: any[] = [];
//         let responseText = '';

//         try {
//           functionCalls = response.functionCalls() || [];
//         } catch (e) {
//           functionCalls = [];
//         }

//         try {
//           responseText = response.text();
//         } catch (e) {
//           responseText = '';
//         }

//         // Add model response to history
//         currentMessages.push({
//           role: 'model',
//           parts: response.candidates[0].content.parts
//         });

//         // If there are function calls, execute them
//         if (functionCalls.length > 0) {
//           console.log(`🔧 Turn ${turnCount}: Executing ${functionCalls.length} function call(s)`);
          
//           const toolResponseParts: any[] = [];
          
//           for (const functionCall of functionCalls) {
//             try {
//               console.log(`🔧 Executing tool: ${functionCall.name} with params:`, functionCall.args);
//               const toolResult = await toolRegistry.executeTool(
//                 functionCall.name, 
//                 functionCall.args
//               );
              
//               console.log(`✅ Tool '${functionCall.name}' completed:`, toolResult.success ? 'SUCCESS' : 'ERROR');
              
//               const functionResponse = {
//                 functionResponse: {
//                   name: functionCall.name,
//                   response: toolResult
//                 }
//               };
              
//               toolResponseParts.push(functionResponse);
//             } catch (error) {
//               console.error(`❌ Tool '${functionCall.name}' failed:`, error);
              
//               const errorResponse = {
//                 functionResponse: {
//                   name: functionCall.name,
//                   response: {
//                     success: false,
//                     error: error instanceof Error ? error.message : 'Unknown error'
//                   }
//                 }
//               };
              
//               toolResponseParts.push(errorResponse);
//             }
//           }

//           // Add tool results as next user message for the AI to process
//           // Note: Function responses need to be sent via sendMessage, not added to history
//           const chat = modelWithTools.startChat({
//             history: currentMessages
//           });

//           // Send function responses and get AI's next response
//           const followUpResult = await chat.sendMessage(toolResponseParts);
//           const followUpResponse = followUpResult.response;

//           // Get function calls and response text from follow-up
//           let newFunctionCalls: any[] = [];
//           let newResponseText = '';

//           try {
//             newFunctionCalls = followUpResponse.functionCalls() || [];
//           } catch (e) {
//             newFunctionCalls = [];
//           }

//           try {
//             newResponseText = followUpResponse.text();
//           } catch (e) {
//             newResponseText = '';
//           }

//           // Add the AI's follow-up response to history
//           currentMessages.push({
//             role: 'model',
//             parts: followUpResponse.candidates[0].content.parts
//           });

//           // If there are new function calls, continue the loop
//           if (newFunctionCalls.length > 0) {
//             functionCalls = newFunctionCalls;
//             // Reset for next iteration
//             continue;
//           } else {
//             // No more function calls - AI has finished
//             finalResponse = newResponseText || 'Task completed successfully.';
//             console.log(`✅ Conversation completed after ${turnCount} turns`);
//             break;
//           }

//         } else {
//           // No more function calls - AI has finished its task
//           finalResponse = responseText || 'Task completed successfully.';
//           console.log(`✅ Conversation completed after ${turnCount} turns`);
//           break;
//         }

//       } catch (error) {
//         console.error(`❌ Error in conversation turn ${turnCount}:`, error);
//         finalResponse = `Error in conversation: ${error instanceof Error ? error.message : 'Unknown error'}`;
//         break;
//       }
//     }

//     if (turnCount >= maxTurns) {
//       console.log(`⚠️ Conversation reached maximum turns (${maxTurns})`);
//       finalResponse = finalResponse || 'Task completed (reached maximum conversation turns).';
//     }

//     return finalResponse;
//   }

//   /**
//    * Get conversation history
//    */
//   async getHistory(): Promise<ConversationMessage[]> {
//     // Convert Date objects to strings for IPC serialization
//     return this.conversationHistory.map(msg => ({
//       ...msg,
//       timestamp: msg.timestamp.toISOString()
//     })) as any;
//   }

//   /**
//    * Clear conversation history
//    */
//   async clearHistory(): Promise<void> {
//     this.conversationHistory = [];
//     console.log('🧹 Conversation history cleared');
//   }

//   /**
//    * Add message to conversation history
//    */
//   private addToHistory(message: ConversationMessage): void {
//     this.conversationHistory.push(message);
    
//     // Keep only last 50 messages to prevent memory issues
//     if (this.conversationHistory.length > 50) {
//       this.conversationHistory = this.conversationHistory.slice(-50);
//     }
//   }

//   /**
//    * Legacy method - not used in conversation loop implementation
//    */
//   async sendMessageWithTools(message: string, tools: ToolCallRequest[]): Promise<AIResponse> {
//     // Redirect to main sendMessage method
//     return this.sendMessage(message);
//   }
// }
