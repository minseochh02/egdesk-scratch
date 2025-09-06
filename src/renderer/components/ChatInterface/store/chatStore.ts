import { ChatSession, ChatMessage, ChatConfig, ChatState, CHAT_PROVIDERS } from '../types';
import { ChatService } from '../services/chatService';
import { AIKey } from '../../AIKeysManager/types';
import { CodespaceChatService, EnhancedChatMessage } from '../services/codespaceChatService';

class ChatStore {
  private state: ChatState = {
    sessions: [],
    currentSessionId: null,
    isLoading: false,
    error: null,
    config: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: 'You are a helpful AI assistant.'
    }
  };

  private listeners: Set<(state: ChatState) => void> = new Set();
  private codespaceService: CodespaceChatService;

  constructor() {
    this.codespaceService = CodespaceChatService.getInstance();
    this.loadSavedSessions();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: ChatState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Update state and notify listeners
   */
  private setState(updates: Partial<ChatState>) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  /**
   * Load saved sessions from storage
   */
  private async loadSavedSessions() {
    try {
      const savedSessions = await window.electron.store.get('chat-sessions');
      if (savedSessions && Array.isArray(savedSessions)) {
        // Convert date strings back to Date objects
        const sessions = savedSessions.map(session => ({
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        this.setState({ sessions });
      }
    } catch (error) {
      console.error('Failed to load saved chat sessions:', error);
    }
  }

  /**
   * Save sessions to storage
   */
  private async saveSessions(sessions: ChatSession[]) {
    try {
      await window.electron.store.set('chat-sessions', sessions);
    } catch (error) {
      console.error('Failed to save chat sessions:', error);
      throw new Error('Failed to save chat sessions');
    }
  }

  /**
   * Create a new chat session
   */
  async createSession(name: string, provider: string, model: string): Promise<ChatSession> {
    const newSession: ChatSession = {
      id: this.generateUUID(),
      name,
      provider,
      model,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    const updatedSessions = [...this.state.sessions, newSession];
    await this.saveSessions(updatedSessions);
    
    this.setState({ 
      sessions: updatedSessions,
      currentSessionId: newSession.id
    });

    return newSession;
  }

  /**
   * Delete a chat session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const updatedSessions = this.state.sessions.filter(s => s.id !== sessionId);
    await this.saveSessions(updatedSessions);
    
    this.setState({ 
      sessions: updatedSessions,
      currentSessionId: this.state.currentSessionId === sessionId ? null : this.state.currentSessionId
    });
  }

  /**
   * Set current session
   */
  setCurrentSession(sessionId: string | null): void {
    this.setState({ currentSessionId: sessionId });
  }

  /**
   * Get current session
   */
  getCurrentSession(): ChatSession | null {
    if (!this.state.currentSessionId) return null;
    return this.state.sessions.find(s => s.id === this.state.currentSessionId) || null;
  }

  /**
   * Set workspace path for codespace context
   */
  async setWorkspacePath(workspacePath: string): Promise<void> {
    await this.codespaceService.setWorkspacePath(workspacePath);
  }

  /**
   * Get codespace context information
   */
  getCodespaceInfo() {
    return {
      isAvailable: this.codespaceService.isCodespaceAvailable(),
      workspacePath: this.codespaceService.getCurrentWorkspacePath(),
      cacheStatus: this.codespaceService.getCacheStatus()
    };
  }

  /**
   * Refresh codespace analysis
   */
  async refreshCodespace(): Promise<void> {
    await this.codespaceService.refreshCodespace();
  }

  /**
   * Add message to current session
   */
  async addMessage(content: string, role: 'user' | 'assistant' | 'system' = 'user'): Promise<void> {
    const currentSession = this.getCurrentSession();
    if (!currentSession) return;

    const newMessage: ChatMessage = {
      id: this.generateUUID(),
      role,
      content,
      timestamp: new Date(),
      provider: currentSession.provider,
      model: currentSession.model
    };

    const updatedMessages = [...currentSession.messages, newMessage];
    const updatedSession = {
      ...currentSession,
      messages: updatedMessages,
      updatedAt: new Date()
    };

    const updatedSessions = this.state.sessions.map(s => 
      s.id === currentSession.id ? updatedSession : s
    );

    await this.saveSessions(updatedSessions);
    this.setState({ sessions: updatedSessions });
  }

  /**
   * Send message to AI and get response
   */
  async sendMessage(
    content: string,
    aiKey: AIKey,
    model: string
  ): Promise<void> {
    const currentSession = this.getCurrentSession();
    if (!currentSession) return;

    try {
      this.setState({ isLoading: true, error: null });

      // Enhance message with codespace context, using keyword-driven pre-search when possible
      const enhancedMessage = await this.codespaceService.enhanceMessageWithContext(
        content,
        aiKey,
        model
      );
      
      // Add enhanced user message
      await this.addMessage(enhancedMessage.content, 'user');

      // Get updated session
      const updatedSession = this.getCurrentSession();
      if (!updatedSession) return;

      // Create contextual system prompt
      const contextualSystemPrompt = this.codespaceService.createContextualSystemPrompt(
        this.state.config.systemPrompt,
        enhancedMessage.codespaceContext
      );

      // Send to AI service
      const response = await ChatService.sendMessage(
        aiKey,
        model,
        updatedSession.messages,
        {
          temperature: this.state.config.temperature,
          maxTokens: this.state.config.maxTokens,
          systemPrompt: contextualSystemPrompt
        }
      );

      if (response.success) {
        // Add AI response
        const aiMessage: ChatMessage = {
          id: this.generateUUID(),
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
          provider: currentSession.provider,
          model: currentSession.model,
          tokens: response.usage?.totalTokens,
          cost: response.cost
        };

        const finalMessages = [...updatedSession.messages, aiMessage];
        const finalSession = {
          ...updatedSession,
          messages: finalMessages,
          updatedAt: new Date()
        };

        const finalSessions = this.state.sessions.map(s => 
          s.id === currentSession.id ? finalSession : s
        );

        // Save last context reads for UI hint (Read [path] [lines])
        const reads = enhancedMessage.codespaceContext?.reads || [];
        await this.saveSessions(finalSessions);
        this.setState({ sessions: finalSessions, lastContextReads: reads });
      } else {
        throw new Error(response.error || 'Failed to get AI response');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      this.setState({ error: errorMessage });
    } finally {
      this.setState({ isLoading: false });
    }
  }

  /**
   * Update chat configuration
   */
  async updateConfig(config: Partial<ChatConfig>): Promise<void> {
    const updatedConfig = { ...this.state.config, ...config };
    this.setState({ config: updatedConfig });
    
    // Save config to storage
    try {
      await window.electron.store.set('chat-config', updatedConfig);
    } catch (error) {
      console.error('Failed to save chat config:', error);
    }
  }

  /**
   * Get available models for a provider
   */
  getModelsForProvider(providerId: string) {
    const provider = CHAT_PROVIDERS.find(p => p.id === providerId);
    return provider?.models || [];
  }

  /**
   * Get provider info
   */
  getProviderInfo(providerId: string) {
    return CHAT_PROVIDERS.find(p => p.id === providerId);
  }

  /**
   * Get current state
   */
  getState(): ChatState {
    return this.state;
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.setState({ error: null });
  }

  /**
   * Generate UUID for new items
   */
  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// Export singleton instance
export const chatStore = new ChatStore();
export default chatStore;
