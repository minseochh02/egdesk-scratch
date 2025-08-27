import { AIKey, AIKeysState, AI_PROVIDERS, AIKeyFormData, TestResult } from '../types';
import { APITester } from '../services/apiTester';

class AIKeysStore {
  private state: AIKeysState = {
    keys: [],
    providers: AI_PROVIDERS,
    isLoading: false,
    error: null,
    selectedKeyId: null,
  };

  private listeners: Set<(state: AIKeysState) => void> = new Set();

  constructor() {
    this.loadSavedKeys();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: AIKeysState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state); // Initial call

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
  private setState(updates: Partial<AIKeysState>) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  /**
   * Load saved keys from storage
   */
  private async loadSavedKeys() {
    try {
      this.setState({ isLoading: true });
      
      // Use electron-store to load saved keys
      const savedKeys = await window.electron.store.get('ai-keys');
      if (savedKeys && Array.isArray(savedKeys)) {
        // Convert date strings back to Date objects
        const keys = savedKeys.map(key => ({
          ...key,
          createdAt: new Date(key.createdAt),
          lastUsed: key.lastUsed ? new Date(key.lastUsed) : undefined,
        }));
        this.setState({ keys, isLoading: false });
      } else {
        this.setState({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load saved AI keys:', error);
      this.setState({ 
        error: 'Failed to load saved AI keys', 
        isLoading: false 
      });
    }
  }

  /**
   * Save keys to storage
   */
  private async saveKeys(keys: AIKey[]) {
    try {
      await window.electron.store.set('ai-keys', keys);
    } catch (error) {
      console.error('Failed to save AI keys:', error);
      throw new Error('Failed to save AI keys');
    }
  }

  /**
   * Add a new AI key
   */
  async addKey(keyData: AIKeyFormData): Promise<AIKey> {
    try {
      this.setState({ isLoading: true, error: null });

      const newKey: AIKey = {
        id: this.generateUUID(),
        providerId: keyData.providerId,
        name: keyData.name,
        isActive: true,
        createdAt: new Date(),
        fields: keyData.fields,
      };

      const updatedKeys = [...this.state.keys, newKey];
      await this.saveKeys(updatedKeys);
      
      this.setState({ 
        keys: updatedKeys, 
        isLoading: false,
        selectedKeyId: newKey.id 
      });

      return newKey;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add AI key';
      this.setState({ 
        error: errorMessage, 
        isLoading: false 
      });
      throw error;
    }
  }

  /**
   * Update an existing AI key
   */
  async updateKey(id: string, updates: Partial<AIKey>): Promise<AIKey> {
    try {
      this.setState({ isLoading: true, error: null });

      const updatedKeys = this.state.keys.map(key => 
        key.id === id ? { ...key, ...updates } : key
      );

      await this.saveKeys(updatedKeys);
      
      this.setState({ 
        keys: updatedKeys, 
        isLoading: false 
      });

      const updatedKey = updatedKeys.find(key => key.id === id);
      if (!updatedKey) {
        throw new Error('Key not found');
      }

      return updatedKey;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update AI key';
      this.setState({ 
        error: errorMessage, 
        isLoading: false 
      });
      throw error;
    }
  }

  /**
   * Delete an AI key
   */
  async deleteKey(id: string): Promise<void> {
    try {
      this.setState({ isLoading: true, error: null });

      const updatedKeys = this.state.keys.filter(key => key.id !== id);
      await this.saveKeys(updatedKeys);
      
      this.setState({ 
        keys: updatedKeys, 
        isLoading: false,
        selectedKeyId: this.state.selectedKeyId === id ? null : this.state.selectedKeyId
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete AI key';
      this.setState({ 
        error: errorMessage, 
        isLoading: false 
      });
      throw error;
    }
  }

  /**
   * Toggle key active status
   */
  async toggleKeyActive(id: string): Promise<void> {
    const key = this.state.keys.find(k => k.id === id);
    if (key) {
      await this.updateKey(id, { isActive: !key.isActive });
    }
  }

  /**
   * Set selected key
   */
  setSelectedKey(id: string | null): void {
    this.setState({ selectedKeyId: id });
  }

  /**
   * Get key by ID
   */
  getKey(id: string): AIKey | undefined {
    return this.state.keys.find(key => key.id === id);
  }

  /**
   * Get active keys
   */
  getActiveKeys(): AIKey[] {
    return this.state.keys.filter(key => key.isActive);
  }

  /**
   * Get keys by provider
   */
  getKeysByProvider(providerId: string): AIKey[] {
    return this.state.keys.filter(key => key.providerId === providerId);
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string) {
    return this.state.providers.find(provider => provider.id === id);
  }

  /**
   * Get current state
   */
  getState(): AIKeysState {
    return this.state;
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.setState({ error: null });
  }

  /**
   * Generate a UUID for new keys
   */
  private generateUUID(): string {
    // Use crypto.randomUUID if available, otherwise fallback to a simple implementation
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Test API key connection
   */
  async testKey(id: string): Promise<TestResult> {
    try {
      const key = this.getKey(id);
      if (!key) {
        throw new Error('Key not found');
      }

      const provider = this.getProvider(key.providerId);
      if (!provider) {
        throw new Error('Provider not found');
      }

      // Perform actual API test
      const testResult = await APITester.testKey(key, provider);

      if (testResult.success) {
        // Update last used timestamp on successful test
        await this.updateKey(id, { lastUsed: new Date() });
      }

      return testResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to test API key';
      this.setState({ error: errorMessage });
      return {
        success: false,
        message: errorMessage,
        details: error
      };
    }
  }
}

// Export singleton instance
export const aiKeysStore = new AIKeysStore();
export default aiKeysStore;
