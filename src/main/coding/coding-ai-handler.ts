/**
 * Coding AI IPC Handler
 *
 * Handles IPC communication for the Coding AI system.
 * Manages client instances and streams events to the renderer process.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { CodingAIClient, CodingAIConfig } from './coding-ai-client';
import { getGoogleApiKey } from '../gemini/index';
import type { AIStreamEvent } from '../types/ai-types';

interface ActiveClient {
  client: CodingAIClient;
  conversationId: string;
  sender: Electron.WebContents;
}

class CodingAIHandler {
  private activeClients = new Map<string, ActiveClient>();

  constructor() {
    this.registerIPCHandlers();
  }

  /**
   * Register IPC handlers
   */
  private registerIPCHandlers(): void {
    // Handle new conversation request
    ipcMain.handle('coding-ai:send-message', async (event, data: {
      message: string;
      projectPath: string;
      apiKey?: string;
      conversationId?: string;
      model?: string;
      provider?: 'gemini' | 'anthropic';
      maxTurns?: number;
      timeoutMs?: number;
    }) => {
      try {
        console.log('🤖 Coding AI: Processing message:', data.message.substring(0, 50) + '...');

        const { message, projectPath, conversationId } = data;
        const sender = event.sender;

        // Get API key
        let apiKey = data.apiKey;
        if (!apiKey) {
          // Try to get from store
          const storedKey = await getGoogleApiKey();
          if (!storedKey) {
            return {
              success: false,
              error: 'No API key provided and no key found in store'
            };
          }
          apiKey = storedKey;
        }

        // Check if we have an existing client for this conversation
        let activeClient = conversationId ? this.activeClients.get(conversationId) : undefined;

        if (!activeClient) {
          // Create new client
          const config: CodingAIConfig = {
            apiKey,
            projectPath,
            provider: data.provider || 'anthropic',
            model: data.model || (data.provider === 'gemini' ? 'gemini-2.5-flash' : 'claude-sonnet-4-5-20250929'),
            maxTurns: data.maxTurns || 20,
            timeoutMs: data.timeoutMs || 300000
          };

          const client = new CodingAIClient(config);
          const newConversationId = conversationId || this.generateConversationId();

          activeClient = {
            client,
            conversationId: newConversationId,
            sender
          };

          this.activeClients.set(newConversationId, activeClient);

          console.log(`🆕 Created new Coding AI client for conversation: ${newConversationId}`);
        }

        // Process message and stream events
        this.streamResponse(activeClient, message);

        return {
          success: true,
          conversationId: activeClient.conversationId
        };

      } catch (error) {
        console.error('❌ Coding AI error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Handle conversation cleanup
    ipcMain.handle('coding-ai:clear-conversation', async (event, conversationId: string) => {
      const activeClient = this.activeClients.get(conversationId);
      if (activeClient) {
        activeClient.client.destroy();
        this.activeClients.delete(conversationId);
        console.log(`🧹 Cleared conversation: ${conversationId}`);
        return { success: true };
      }
      return { success: false, error: 'Conversation not found' };
    });

    // Handle abort request
    ipcMain.handle('coding-ai:abort', async (event, conversationId: string) => {
      const activeClient = this.activeClients.get(conversationId);
      if (activeClient) {
        activeClient.client.abort();
        console.log(`⏹️ Aborted conversation: ${conversationId}`);
        return { success: true };
      }
      return { success: false, error: 'Conversation not found' };
    });

    console.log('✅ Coding AI IPC handlers registered');
  }

  /**
   * Stream response from AI to renderer
   */
  private async streamResponse(activeClient: ActiveClient, message: string): Promise<void> {
    const { client, conversationId, sender } = activeClient;

    try {
      // Process message and stream events
      for await (const event of client.processMessage(message, { conversationId })) {
        // Send event to renderer
        if (!sender.isDestroyed()) {
          sender.send('coding-ai:stream-event', event);
        }
      }
    } catch (error) {
      console.error('❌ Error streaming response:', error);

      // Send error event
      if (!sender.isDestroyed()) {
        const errorEvent: AIStreamEvent = {
          type: 'error' as any,
          conversationId,
          data: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: new Date()
        };
        sender.send('coding-ai:stream-event', errorEvent);
      }
    }
  }

  /**
   * Generate unique conversation ID
   */
  private generateConversationId(): string {
    return `coding-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

// Export singleton instance
export const codingAIHandler = new CodingAIHandler();
