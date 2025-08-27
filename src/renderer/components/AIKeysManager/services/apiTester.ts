import { AIKey, AIProvider } from '../types';

export interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

export class APITester {
  /**
   * Test an AI key by making a real API call
   */
  static async testKey(key: AIKey, provider: AIProvider): Promise<TestResult> {
    try {
      switch (provider.id) {
        case 'openai':
          return await this.testOpenAI(key);
        case 'anthropic':
          return await this.testAnthropic(key);
        case 'google':
          return await this.testGoogleAI(key);
        case 'azure':
          return await this.testAzureOpenAI(key);
        case 'custom':
          return await this.testCustomProvider(key);
        default:
          return {
            success: false,
            message: `Unknown provider: ${provider.id}`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      };
    }
  }

  /**
   * Test OpenAI API key
   */
  private static async testOpenAI(key: AIKey): Promise<TestResult> {
    try {
      const apiKey = key.fields.apiKey;
      const organization = key.fields.organization;

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };

      if (organization) {
        headers['OpenAI-Organization'] = organization;
      }

      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `OpenAI API key is valid. Available models: ${data.data?.length || 0}`,
          details: {
            models: data.data?.slice(0, 5)?.map((m: any) => m.id) || [],
            totalModels: data.data?.length || 0
          }
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `OpenAI API test failed: ${errorData.error?.message || `HTTP ${response.status}`}`,
          details: errorData
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `OpenAI API test failed: ${error instanceof Error ? error.message : 'Network error'}`,
        details: error
      };
    }
  }

  /**
   * Test Anthropic API key
   */
  private static async testAnthropic(key: AIKey): Promise<TestResult> {
    try {
      const apiKey = key.fields.apiKey;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [
            {
              role: 'user',
              content: 'Hello'
            }
          ]
        })
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Anthropic API key is valid. Claude API is accessible.',
          details: {
            model: 'claude-3-haiku-20240307',
            status: response.status
          }
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `Anthropic API test failed: ${errorData.error?.message || `HTTP ${response.status}`}`,
          details: errorData
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Anthropic API test failed: ${error instanceof Error ? error.message : 'Network error'}`,
        details: error
      };
    }
  }

  /**
   * Test Google AI API key
   */
  private static async testGoogleAI(key: AIKey): Promise<TestResult> {
    try {
      const apiKey = key.fields.apiKey;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `Google AI API key is valid. Available models: ${data.models?.length || 0}`,
          details: {
            models: data.models?.slice(0, 5)?.map((m: any) => m.name) || [],
            totalModels: data.models?.length || 0
          }
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `Google AI API test failed: ${errorData.error?.message || `HTTP ${response.status}`}`,
          details: errorData
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Google AI API test failed: ${error instanceof Error ? error.message : 'Network error'}`,
        details: error
      };
    }
  }

  /**
   * Test Azure OpenAI API key
   */
  private static async testAzureOpenAI(key: AIKey): Promise<TestResult> {
    try {
      const apiKey = key.fields.apiKey;
      const endpoint = key.fields.endpoint;
      const deploymentName = key.fields.deploymentName;

      if (!endpoint || !deploymentName) {
        return {
          success: false,
          message: 'Azure OpenAI configuration incomplete. Missing endpoint or deployment name.'
        };
      }

      // Clean up endpoint URL
      const cleanEndpoint = endpoint.replace(/\/$/, '');
      const testUrl = `${cleanEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`;

      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'Hello'
            }
          ],
          max_tokens: 10
        })
      });

      if (response.ok) {
        return {
          success: true,
          message: `Azure OpenAI API key is valid. Deployment '${deploymentName}' is accessible.`,
          details: {
            endpoint: cleanEndpoint,
            deployment: deploymentName,
            status: response.status
          }
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: `Azure OpenAI API test failed: ${errorData.error?.message || `HTTP ${response.status}`}`,
          details: errorData
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Azure OpenAI API test failed: ${error instanceof Error ? error.message : 'Network error'}`,
        details: error
      };
    }
  }

  /**
   * Test custom provider API key
   */
  private static async testCustomProvider(key: AIKey): Promise<TestResult> {
    try {
      const apiKey = key.fields.apiKey;
      const endpoint = key.fields.endpoint;

      if (!endpoint) {
        return {
          success: false,
          message: 'Custom provider configuration incomplete. Missing endpoint.'
        };
      }

      // Try a simple GET request to test connectivity
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Custom provider API key is valid. Endpoint is accessible.',
          details: {
            endpoint,
            status: response.status,
            statusText: response.statusText
          }
        };
      } else {
        return {
          success: false,
          message: `Custom provider API test failed: HTTP ${response.status} ${response.statusText}`,
          details: {
            endpoint,
            status: response.status,
            statusText: response.statusText
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Custom provider API test failed: ${error instanceof Error ? error.message : 'Network error'}`,
        details: error
      };
    }
  }
}
