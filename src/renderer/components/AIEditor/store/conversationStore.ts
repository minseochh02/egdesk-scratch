import { Conversation, ConversationMessage, ConversationStore } from '../types';

class ConversationStoreClass {
  private state: ConversationStore = {
    conversations: [],
    currentConversationId: null,
    isLoading: false,
    error: null,
  };

  private listeners: Set<(state: ConversationStore) => void> = new Set();

  private storageKey = 'ai_editor_conversations';

  constructor() {
    // Initialize with empty state, load conversations asynchronously
    this.loadConversations().catch(() => {
      // Silent fail - conversations will load on next access
    });
  }

  /**
   * Subscribe to conversation store changes
   */
  subscribe(listener: (state: ConversationStore) => void): () => void {
    this.listeners.add(listener);
    listener(this.state); // Initial call

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * Load conversations from persistent storage
   */
  private async loadConversations(): Promise<void> {
    try {
      this.state.isLoading = true;
      this.notifyListeners();

      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Validate parsed data
        if (!parsed.conversations || !Array.isArray(parsed.conversations)) {
          throw new Error('Invalid conversation data format');
        }

        // Convert date strings back to Date objects
        this.state.conversations = parsed.conversations.map((conv: any) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        }));
      }
    } catch (error) {
      this.state.error =
        error instanceof Error ? error.message : 'Failed to load conversations';

      // Reset to safe state
      this.state.conversations = [];
      this.state.currentConversationId = null;
    } finally {
      this.state.isLoading = false;
      this.notifyListeners();
    }
  }

  /**
   * Save conversations to persistent storage
   */
  private async saveConversations(): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch (error) {
      this.state.error = 'Failed to save conversations';
      this.notifyListeners();
    }
  }

  /**
   * Create a new conversation
   */
  createConversation(
    projectPath: string,
    projectName: string,
    title?: string,
  ): string {
    const conversation: Conversation = {
      id: this.generateId(),
      projectPath,
      projectName,
      title: title || `Conversation ${this.state.conversations.length + 1}`,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    };

    this.state.conversations.unshift(conversation); // Add to beginning
    this.state.currentConversationId = conversation.id;

    this.saveConversations();
    this.notifyListeners();

    return conversation.id;
  }

  /**
   * Add a message to the current conversation
   */
  addMessage(
    content: string,
    type: 'user' | 'ai',
    metadata?: ConversationMessage['metadata'],
  ): void {
    if (!this.state.currentConversationId) {
      return;
    }

    const conversation = this.state.conversations.find(
      (c) => c.id === this.state.currentConversationId,
    );
    if (!conversation) {
      return;
    }

    const message: ConversationMessage = {
      id: this.generateId(),
      type,
      content,
      timestamp: new Date(),
      metadata,
    };

    conversation.messages.push(message);
    conversation.updatedAt = new Date();

    // Auto-generate title from first user message if it's the first message
    if (conversation.messages.length === 1 && type === 'user') {
      conversation.title = this.generateTitle(content);
    }

    this.saveConversations();
    this.notifyListeners();
  }

  /**
   * Set the current conversation
   */
  setCurrentConversation(conversationId: string | null): void {
    this.state.currentConversationId = conversationId;
    this.notifyListeners();
  }

  /**
   * Get the current conversation
   */
  getCurrentConversation(): Conversation | null {
    if (!this.state.currentConversationId) return null;
    return (
      this.state.conversations.find(
        (c) => c.id === this.state.currentConversationId,
      ) || null
    );
  }

  /**
   * Get conversations for a specific project
   */
  getConversationsForProject(projectPath: string): Conversation[] {
    return this.state.conversations.filter(
      (c) => c.projectPath === projectPath,
    );
  }

  /**
   * Search conversations
   */
  searchConversations(query: string): Conversation[] {
    const lowerQuery = query.toLowerCase();
    return this.state.conversations.filter((conversation) => {
      // Search in title
      if (conversation.title.toLowerCase().includes(lowerQuery)) return true;

      // Search in messages
      return conversation.messages.some((message) =>
        message.content.toLowerCase().includes(lowerQuery),
      );
    });
  }

  /**
   * Delete a conversation
   */
  deleteConversation(conversationId: string): void {
    const index = this.state.conversations.findIndex(
      (c) => c.id === conversationId,
    );
    if (index !== -1) {
      this.state.conversations.splice(index, 1);

      // If we deleted the current conversation, clear it
      if (this.state.currentConversationId === conversationId) {
        this.state.currentConversationId = null;
      }

      this.saveConversations();
      this.notifyListeners();
    }
  }

  /**
   * Update conversation title
   */
  updateConversationTitle(conversationId: string, title: string): void {
    const conversation = this.state.conversations.find(
      (c) => c.id === conversationId,
    );
    if (conversation) {
      conversation.title = title;
      conversation.updatedAt = new Date();

      this.saveConversations();
      this.notifyListeners();
    }
  }

  /**
   * Add tags to conversation
   */
  addTags(conversationId: string, tags: string[]): void {
    const conversation = this.state.conversations.find(
      (c) => c.id === conversationId,
    );
    if (conversation) {
      const newTags = tags.filter((tag) => !conversation.tags.includes(tag));
      conversation.tags.push(...newTags);
      conversation.updatedAt = new Date();

      this.saveConversations();
      this.notifyListeners();
    }
  }

  /**
   * Remove tags from conversation
   */
  removeTags(conversationId: string, tags: string[]): void {
    const conversation = this.state.conversations.find(
      (c) => c.id === conversationId,
    );
    if (conversation) {
      conversation.tags = conversation.tags.filter(
        (tag) => !tags.includes(tag),
      );
      conversation.updatedAt = new Date();

      this.saveConversations();
      this.notifyListeners();
    }
  }

  /**
   * Export conversation to JSON
   */
  exportConversation(conversationId: string): string | null {
    const conversation = this.state.conversations.find(
      (c) => c.id === conversationId,
    );
    if (!conversation) return null;

    return JSON.stringify(conversation, null, 2);
  }

  /**
   * Import conversation from JSON
   */
  importConversation(jsonData: string): boolean {
    try {
      const conversation = JSON.parse(jsonData);

      // Validate conversation structure
      if (
        !conversation.id ||
        !conversation.messages ||
        !conversation.projectPath
      ) {
        throw new Error('Invalid conversation format');
      }

      // Check if conversation already exists
      const existingIndex = this.state.conversations.findIndex(
        (c) => c.id === conversation.id,
      );
      if (existingIndex !== -1) {
        // Update existing conversation
        this.state.conversations[existingIndex] = {
          ...conversation,
          createdAt: new Date(conversation.createdAt),
          updatedAt: new Date(conversation.updatedAt),
          messages: conversation.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        };
      } else {
        // Add new conversation
        this.state.conversations.unshift({
          ...conversation,
          createdAt: new Date(conversation.createdAt),
          updatedAt: new Date(conversation.updatedAt),
          messages: conversation.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        });
      }

      this.saveConversations();
      this.notifyListeners();

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all conversations
   */
  clearAllConversations(): void {
    this.state.conversations = [];
    this.state.currentConversationId = null;

    this.saveConversations();
    this.notifyListeners();
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    totalConversations: number;
    totalMessages: number;
    totalTokens: number;
    totalCost: number;
    projects: string[];
  } {
    const totalMessages = this.state.conversations.reduce(
      (sum, conv) => sum + conv.messages.length,
      0,
    );
    const totalTokens = this.state.conversations.reduce(
      (sum, conv) =>
        sum +
        conv.messages.reduce(
          (msgSum, msg) => msgSum + (msg.metadata?.usage?.totalTokens || 0),
          0,
        ),
      0,
    );
    const totalCost = this.state.conversations.reduce(
      (sum, conv) =>
        sum +
        conv.messages.reduce(
          (msgSum, msg) => msgSum + (msg.metadata?.cost || 0),
          0,
        ),
      0,
    );
    const projects = [
      ...new Set(this.state.conversations.map((c) => c.projectPath)),
    ];

    return {
      totalConversations: this.state.conversations.length,
      totalMessages,
      totalTokens,
      totalCost,
      projects,
    };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Generate a title from user message content
   */
  private generateTitle(content: string): string {
    // Take first 50 characters and clean up
    const title = content.substring(0, 50).trim();
    if (title.length < content.length) {
      return `${title}...`;
    }
    return title;
  }
}

// Export singleton instance
export const conversationStore = new ConversationStoreClass();
export default conversationStore;
