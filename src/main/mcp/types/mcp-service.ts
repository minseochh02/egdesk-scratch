/**
 * Generic MCP Service Interface
 * 
 * This interface defines the contract that any MCP service must implement
 * to work with the generic HTTP Stream and SSE handlers.
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPServerInfo {
  name: string;
  version: string;
}

export interface MCPCapabilities {
  tools?: Record<string, any>;
  resources?: Record<string, any>;
  prompts?: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
}

/**
 * Generic MCP Service interface
 * Any service (Gmail, File System, etc.) must implement this interface
 */
export interface IMCPService {
  /**
   * Get server information
   */
  getServerInfo(): MCPServerInfo;

  /**
   * Get server capabilities
   */
  getCapabilities(): MCPCapabilities;

  /**
   * List available tools
   */
  listTools(): MCPTool[];

  /**
   * Execute a tool with given arguments
   */
  executeTool(name: string, args: Record<string, any>): Promise<MCPToolResult>;

  /**
   * Initialize the service (if needed)
   */
  initialize?(): Promise<void>;

  /**
   * Cleanup the service (if needed)
   */
  cleanup?(): void;
}

