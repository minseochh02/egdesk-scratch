/**
 * MCP Registration Service
 * Handles registration of MCP servers with Supabase Edge Function
 */

export interface MCPRegistrationResult {
  success: boolean;
  status: 'registered' | 'name_taken' | 'error';
  message?: string;
  name?: string;
  ip?: string;
  timestamp?: string;
  id?: string;
  existing_record?: {
    name: string;
    ip: string;
    registered_at: string;
  };
}

export interface MCPRegistrationOptions {
  name: string;
  password?: string;
  supabaseUrl: string;
  supabaseAnonKey?: string;
}

export class MCPRegistrationService {
  private supabaseUrl: string;
  private supabaseAnonKey?: string;

  constructor(options: MCPRegistrationOptions) {
    this.supabaseUrl = options.supabaseUrl;
    this.supabaseAnonKey = options.supabaseAnonKey;
  }

  /**
   * Register MCP server with Supabase Edge Function
   */
  async registerMCP(name: string, password?: string): Promise<MCPRegistrationResult> {
    try {
      console.log(`🔗 Registering MCP server: ${name}`);
      
      const url = `${this.supabaseUrl}/functions/v1/register?name=${encodeURIComponent(name)}${password ? `&password=${encodeURIComponent(password)}` : ''}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authorization header if anon key is provided
      if (this.supabaseAnonKey) {
        headers['Authorization'] = `Bearer ${this.supabaseAnonKey}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`❌ MCP registration failed:`, data);
        return {
          success: false,
          status: 'error',
          message: data.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Handle different response statuses
      if (data.status === 'registered') {
        console.log(`✅ MCP server registered successfully:`, {
          name: data.name,
          ip: data.ip,
          id: data.id,
        });
        
        return {
          success: true,
          status: 'registered',
          name: data.name,
          ip: data.ip,
          timestamp: data.timestamp,
          id: data.id,
        };
      } else if (data.status === 'name_taken') {
        console.log(`⚠️ MCP name already taken:`, data.existing_record);
        
        return {
          success: false,
          status: 'name_taken',
          message: data.message,
          existing_record: data.existing_record,
        };
      } else {
        console.error(`❌ Unknown response status:`, data);
        return {
          success: false,
          status: 'error',
          message: data.message || 'Unknown response status',
        };
      }
    } catch (error: any) {
      console.error(`❌ MCP registration error:`, error);
      return {
        success: false,
        status: 'error',
        message: error.message || 'Network error during registration',
      };
    }
  }

  /**
   * Test connection to Supabase Edge Function
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log(`🧪 Testing connection to Supabase Edge Function...`);
      
      const url = `${this.supabaseUrl}/functions/v1/register?name=test-connection`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.supabaseAnonKey) {
        headers['Authorization'] = `Bearer ${this.supabaseAnonKey}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      const data = await response.json();
      
      console.log(`📡 Test response:`, {
        status: response.status,
        data: data,
      });

      // Any response (even name_taken) means the function is working
      return response.ok || response.status === 409;
    } catch (error: any) {
      console.error(`❌ Connection test failed:`, error);
      return false;
    }
  }

  /**
   * Get local IP address for debugging
   */
  async getLocalIP(): Promise<string> {
    try {
      const os = require('os');
      const interfaces = os.networkInterfaces();
      
      for (let iface of Object.values(interfaces) as any[]) {
        for (let alias of iface) {
          if (alias.family === 'IPv4' && !alias.internal) {
            return alias.address;
          }
        }
      }
      return 'localhost';
    } catch (error) {
      console.error('❌ Failed to get local IP:', error);
      return 'localhost';
    }
  }
}

/**
 * Create MCP registration service with EGDesk project settings
 */
export function createMCPRegistrationService(): MCPRegistrationService {
  return new MCPRegistrationService({
    name: 'egdesk-mcp',
    supabaseUrl: process.env.SUPABASE_URL || 'https://cbptgzaubhcclkmvkiua.supabase.co',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
}

/**
 * Quick registration function for EGDesk
 */
export async function registerEGDeskMCP(name: string, password?: string): Promise<MCPRegistrationResult> {
  const service = createMCPRegistrationService();
  return await service.registerMCP(name, password);
}

/**
 * Test EGDesk MCP connection
 */
export async function testEGDeskMCPConnection(): Promise<boolean> {
  const service = createMCPRegistrationService();
  return await service.testConnection();
}

export default MCPRegistrationService;
