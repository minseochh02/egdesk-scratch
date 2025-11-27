import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEnvelope, 
  faCheck, 
  faArrowRight, 
  faList, 
  faServer,
  faGlobe, 
  faCircleCheck, 
  faCircleXmark, 
  faSpinner, 
  faTriangleExclamation,
  faRefresh,
  faPlay,
  faStop,
  faCog,
  faChartBar,
  faClock,
  faTerminal,
  faUser,
  faCalendarAlt,
  faLock,
  faWifi,
  faGlobe as faPublic,
  faShieldAlt,
  faExclamationTriangle as faExclamationCircleIcon,
  faTimes,
  faCopy,
  faPlus,
  faTrash,
  faEdit
} from '../../utils/fontAwesomeIcons';
import GmailConnectorForm from './GmailConnectorForm';
import GmailDashboard from './GmailDashboard';
import RunningServersTabs from './RunningServersTabs';
import TunnelAndServerConfig from './TunnelAndServerConfig';

// Import GmailConnection type from GmailDashboard
interface GmailConnection {
  id: string;
  name: string;
  email: string;
  adminEmail: string;
  serviceAccountKey: any;
  createdAt: string;
  updatedAt: string;
  type: 'gmail';
  status: 'online' | 'offline' | 'error' | 'checking';
}
import './MCPServer.css';
import './RunningServers.css';

interface MCPTool {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  gradient: string;
  isAvailable: boolean;
  features: string[];
  status: 'available' | 'coming-soon' | 'beta';
}

interface MCPServerProps {}

// Access level types
export type AccessLevel = 'claude-desktop' | 'local-network' | 'public';

interface AccessLevelConfig {
  level: AccessLevel;
  port?: number;
  bindAddress?: string;
  requiresAuth?: boolean;
  allowedIPs?: string[];
  networkInterface?: string;
}

interface RunningMCPServer {
  id: string;
  name: string;
  type: 'gmail' | 'custom' | 'builtin';
  email?: string;
  adminEmail?: string;
  address: string;
  port: number;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping';
  uptime: number; // in seconds
  memoryUsage: number; // in MB
  cpuUsage: number; // percentage
  lastActivity: string;
  version: string;
  description?: string;
  accessLevel?: AccessLevelConfig;
  createdAt: string;
  updatedAt: string;
  healthCheck: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    lastCheck: string;
    responseTime: number; // in ms
  };
  tools: Array<{
    name: string;
    description: string;
    enabled: boolean;
  }>;
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
  }>;
}

interface GmailConnection {
  id: string;
  name: string;
  email: string;
  serviceAccountKey: any;
  createdAt: string;
  updatedAt: string;
  type: 'gmail';
  accessLevel?: {
    level: 'claude-desktop' | 'local-network' | 'public';
    port: number;
    bindAddress: string;
    requiresAuth: boolean;
    allowedIPs?: string[];
  };
}

const MCPServer: React.FC<MCPServerProps> = () => {
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [showGmailTool, setShowGmailTool] = useState<boolean>(false);
  
  // Running servers state
  const [servers, setServers] = useState<RunningMCPServer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cloud servers state
  const [cloudServers, setCloudServers] = useState<RunningMCPServer[]>([]);
  const [cloudLoading, setCloudLoading] = useState<boolean>(true);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<RunningMCPServer | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [showDashboard, setShowDashboard] = useState<boolean>(false);
  const [showAccessLevelModal, setShowAccessLevelModal] = useState<boolean>(false);
  const [editingServer, setEditingServer] = useState<RunningMCPServer | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Tunnel registration modal state
  const [showTunnelRegistrationModal, setShowTunnelRegistrationModal] = useState<boolean>(false);
  const [tunnelServerName, setTunnelServerName] = useState<string>('');
  const [tunnelRegistrationStatus, setTunnelRegistrationStatus] = useState<{
    status: 'idle' | 'registering' | 'success' | 'error' | 'name_taken';
    message?: string;
    publicUrl?: string;
  }>({ status: 'idle' });
  
  // Server name editing state
  const [editingServerName, setEditingServerName] = useState<string | null>(null);
  const [editingServerNameValue, setEditingServerNameValue] = useState<string>('');
  
  // Claude Desktop configuration state
  const [claudeDesktopStatus, setClaudeDesktopStatus] = useState<{
    isConfigured: boolean;
    isLoading: boolean;
    error: string | null;
  }>({
    isConfigured: false,
    isLoading: true,
    error: null
  });

  // HTTP Server state
  const [httpServerStatus, setHttpServerStatus] = useState<{
    isRunning: boolean;
    port: number | null;
    isLoading: boolean;
  }>({
    isRunning: false,
    port: null,
    isLoading: true
  });

  // MCP Servers state
  const [mcpServers, setMcpServers] = useState<Array<{
    name: string;
    enabled: boolean;
    description: string;
  }>>([]);

  // Supabase configuration state
  const [supabaseConfig, setSupabaseConfig] = useState<{
    hasSupabaseKey: boolean;
    supabaseAnonKey: string | null;
    supabaseUrl: string | null;
    isLoading: boolean;
  }>({
    hasSupabaseKey: false,
    supabaseAnonKey: null,
    supabaseUrl: null,
    isLoading: true
  });

  // State for showing/hiding anon key
  const [showAnonKey, setShowAnonKey] = useState<boolean>(false);

  // Tunnel configurations state
  const [tunnelConfigs, setTunnelConfigs] = useState<Array<{
    name: string;
    tunnelUrl: string;
    registeredAt: string;
    id?: string;
    ip?: string;
    createdAt?: string;
    updatedAt?: string;
  }>>([]);

  // MCP Server name state
  const [mcpServerName, setMcpServerName] = useState<string>('my-mcp-server');
  const [isEditingMcpServerName, setIsEditingMcpServerName] = useState<boolean>(false);
  const [editingMcpServerNameValue, setEditingMcpServerNameValue] = useState<string>('');

  // Active tunnel configuration state
  const [activeTunnelConfig, setActiveTunnelConfig] = useState<{
    registered: boolean;
    registrationId: string;
    serverName: string;
    publicUrl: string;
    registeredAt: string;
    lastConnectedAt: string;
    // Health status fields
    isConnected: boolean;        // Is there an active WebSocket tunnel connection?
    isServiceAvailable: boolean; // Is the tunneling service reachable?
    lastHealthCheck: string;
    healthError?: string;
    // Auto-reconnection tracking
    wasAutoDisconnected: boolean;
    autoReconnectAttempts: number;
  }>({
    registered: false,
    registrationId: '',
    serverName: '',
    publicUrl: '',
    registeredAt: '',
    lastConnectedAt: '',
    isConnected: false,
    isServiceAvailable: false,
    lastHealthCheck: '',
    healthError: undefined,
    wasAutoDisconnected: false,
    autoReconnectAttempts: 0,
  });

  // Load running servers
  const loadRunningServers = useCallback(async (isManualRefresh = false) => {
    if (isRefreshing && !isManualRefresh) return;
    
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await window.electron.mcpConfig.connections.get();
      
      if (result.success && result.connections) {
        // Convert connections to running servers format
        const runningServers: RunningMCPServer[] = result.connections.map((conn: any) => ({
          id: conn.id,
          name: conn.name,
          type: conn.type,
          email: conn.email,
          adminEmail: conn.adminEmail,
          address: conn.accessLevel?.bindAddress || '127.0.0.1',
          port: conn.accessLevel?.port || 8080,
          protocol: 'http' as const,
          status: 'running' as const,
          uptime: Math.floor((Date.now() - new Date(conn.createdAt).getTime()) / 1000),
          memoryUsage: Math.floor(Math.random() * 100) + 20, // Mock data
          cpuUsage: Math.floor(Math.random() * 30) + 5, // Mock data
          lastActivity: new Date().toISOString(),
          version: '1.0.0',
          description: `MCP server for ${conn.type}`,
          accessLevel: conn.accessLevel,
          createdAt: conn.createdAt,
          updatedAt: conn.updatedAt,
          healthCheck: {
            status: 'healthy' as const,
            lastCheck: new Date().toISOString(),
            responseTime: Math.floor(Math.random() * 50) + 10
          },
          tools: [
            { name: 'gmail', description: 'Gmail integration', enabled: true },
            { name: 'search', description: 'Search functionality', enabled: true }
          ],
          logs: [
            {
              timestamp: new Date().toISOString(),
              level: 'info' as const,
              message: 'Server started successfully'
            }
          ]
        }));

        setServers(runningServers);
      } else {
        // Create demo servers if no connections exist
        const demoServers: RunningMCPServer[] = [
          {
            id: 'demo-gmail-1',
            name: 'Gmail MCP Server',
            type: 'gmail',
            email: 'demo@example.com',
            adminEmail: 'admin@example.com',
            address: '127.0.0.1',
            port: 8080,
            protocol: 'http',
            status: 'running',
            uptime: 3600,
            memoryUsage: 45,
            cpuUsage: 12,
            lastActivity: new Date().toISOString(),
            version: '1.0.0',
            description: 'Gmail integration server',
            accessLevel: {
              level: 'claude-desktop',
              port: 8080,
              bindAddress: '127.0.0.1',
              requiresAuth: false,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            healthCheck: {
              status: 'healthy',
              lastCheck: new Date().toISOString(),
              responseTime: 25
            },
            tools: [
              { name: 'gmail', description: 'Gmail integration', enabled: true },
              { name: 'search', description: 'Search functionality', enabled: true }
            ],
            logs: [
              {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: 'Server started successfully'
              }
            ]
          },
          {
            id: 'demo-custom-1',
            name: 'Custom Blog Server',
            type: 'custom',
            address: '0.0.0.0',
            port: 8080,
            protocol: 'http',
            status: 'running',
            uptime: 7200,
            memoryUsage: 32,
            cpuUsage: 8,
            lastActivity: new Date().toISOString(),
            version: '1.0.0',
            description: 'Custom blog automation server',
            accessLevel: {
              level: 'local-network',
              port: 8080,
              bindAddress: '0.0.0.0',
              requiresAuth: true,
              allowedIPs: ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12']
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            healthCheck: {
              status: 'healthy',
              lastCheck: new Date().toISOString(),
              responseTime: 18
            },
            tools: [
              { name: 'blog', description: 'Blog management', enabled: true },
              { name: 'content', description: 'Content generation', enabled: true }
            ],
            logs: [
              {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: 'Server started successfully'
              }
            ]
          },
          {
            id: 'demo-public-1',
            name: 'Public API Server',
            type: 'custom',
            address: '0.0.0.0',
            port: 8082,
            protocol: 'http',
            status: 'running',
            uptime: 1800,
            memoryUsage: 28,
            cpuUsage: 15,
            lastActivity: new Date().toISOString(),
            version: '1.0.0',
            description: 'Public API server',
            accessLevel: {
              level: 'public',
              port: 8082,
              bindAddress: '0.0.0.0',
              requiresAuth: true,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            healthCheck: {
              status: 'healthy',
              lastCheck: new Date().toISOString(),
              responseTime: 35
            },
            tools: [
              { name: 'api', description: 'API endpoints', enabled: true },
              { name: 'webhook', description: 'Webhook handling', enabled: true }
            ],
            logs: [
              {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: 'Server started successfully'
              }
            ]
          }
        ];
        setServers(demoServers);
      }
    } catch (err) {
      console.error('Error loading running servers:', err);
      setError(err instanceof Error ? err.message : 'Failed to load servers');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Load cloud servers from Google Sheets
  const loadCloudServers = useCallback(async (isManualRefresh = false) => {
    try {
      if (!isManualRefresh) {
        setCloudLoading(true);
      }
      setCloudError(null);

      // Google Sheets spreadsheet ID
      const SPREADSHEET_ID = '1JPlm17KCvZmvQQ3J68He_xJxDVB_schN6TEP7W6dP0A';
      // Use the CSV export format which is simpler and more reliable
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=0`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch Google Sheets: ${response.statusText}`);
      }

      const csvText = await response.text();
      
      // Parse CSV (simple parser for name,description,url format)
      const lines = csvText.split('\n').filter(line => line.trim());
      
      // Skip header row and parse data
      const cloudServersList: RunningMCPServer[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Simple CSV parsing (handles quoted fields)
        const fields: string[] = [];
        let currentField = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            fields.push(currentField.trim());
            currentField = '';
          } else {
            currentField += char;
          }
        }
        fields.push(currentField.trim()); // Add last field
        
        const name = fields[0] || '';
        const description = fields[1] || '';
        const url = fields[2] || '';

        // Only include rows with a name
        if (!name) continue;

        // Extract protocol and clean URL
        const cleanUrl = url.trim();
        const protocol = cleanUrl.startsWith('https') ? 'https' as const : 'http' as const;
        
        cloudServersList.push({
          id: `cloud-${i}-${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
          name: name,
          type: 'custom' as const,
          address: cleanUrl,
          port: 0,
          protocol: protocol,
          status: 'running' as const,
          uptime: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          lastActivity: new Date().toISOString(),
          version: '1.0.0',
          description: description || 'Cloud MCP Server',
          accessLevel: {
            level: 'public' as const,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          healthCheck: {
            status: 'unknown' as const,
            lastCheck: new Date().toISOString(),
            responseTime: 0
          },
          tools: [],
          logs: []
        });
      }

      setCloudServers(cloudServersList);
      setCloudError(null);
    } catch (err) {
      console.error('Error loading cloud servers:', err);
      setCloudError(err instanceof Error ? err.message : 'Failed to load cloud servers');
      setCloudServers([]);
    } finally {
      setCloudLoading(false);
    }
  }, []);

  // Load servers on mount
  useEffect(() => {
    loadRunningServers();
    loadCloudServers();
  }, [loadRunningServers, loadCloudServers]);

  const checkClaudeDesktopStatus = async () => {
    try {
      setClaudeDesktopStatus(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Check if Claude Desktop is configured
      const result = await window.electron.mcpServer.getStatus();
      
      if (result.success) {
        setClaudeDesktopStatus({
          isConfigured: result.status?.isConfigured || false,
          isLoading: false,
          error: null
        });
      } else {
        setClaudeDesktopStatus({
          isConfigured: false,
          isLoading: false,
          error: result.error || 'Failed to check Claude Desktop status'
        });
      }
    } catch (err) {
      console.error('Error checking Claude Desktop status:', err);
      setClaudeDesktopStatus({
        isConfigured: false,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  };

  // Load Supabase configuration
  const loadSupabaseConfig = async () => {
    try {
      const result = await window.electron.env.checkConfig();
      if (result.success) {
        setSupabaseConfig({
          hasSupabaseKey: result.hasSupabaseKey || false,
          supabaseAnonKey: result.supabaseAnonKey || null,
          supabaseUrl: result.supabaseUrl || null,
          isLoading: false
        });
      } else {
        setSupabaseConfig({
          hasSupabaseKey: false,
          supabaseAnonKey: null,
          supabaseUrl: null,
          isLoading: false
        });
      }
    } catch (err) {
      console.error('Error loading Supabase config:', err);
      setSupabaseConfig({
        hasSupabaseKey: false,
        supabaseAnonKey: null,
        supabaseUrl: null,
        isLoading: false
      });
    }
  };

  // Load tunnel configurations
  const loadTunnelConfigs = async () => {
    try {
      const result = await window.electron.invoke('get-tunnel-configs');
      if (result.success && result.configs) {
        setTunnelConfigs(result.configs);
      }
    } catch (err) {
      console.error('Error loading tunnel configs:', err);
    }
  };

  // Load MCP server name
  const loadMcpServerName = async () => {
    try {
      const result = await window.electron.invoke('get-mcp-server-name');
      if (result.success && result.serverName) {
        setMcpServerName(result.serverName);
      }
    } catch (err) {
      console.error('Error loading MCP server name:', err);
    }
  };

  // Check tunnel service availability (is tunneling-service.onrender.com reachable?)
  const checkTunnelServiceAvailability = async () => {
    try {
      // Ping the tunneling service root endpoint with a short timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch('https://tunneling-service.onrender.com/', {
        method: 'GET',
        signal: controller.signal,
        mode: 'no-cors', // Avoid CORS issues since we just want to check reachability
      });

      clearTimeout(timeoutId);
      
      // With no-cors mode, we can't check response.ok, but if fetch completes without error,
      // the service is reachable
      console.log('✅ Tunneling service is reachable');
      return true;
      
    } catch (err) {
      // Check if it's a timeout or network error
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          console.log('🔴 Tunneling service timeout (took longer than 5 seconds)');
        } else {
          console.log('🔴 Tunneling service not reachable:', err.message);
        }
      }
      return false;
    }
  };

  // Check tunnel health status (separated: service availability + connection status)
  const checkTunnelHealth = async (serverName: string) => {
    try {
      // First check if local HTTP server is running
      const localServerStatus = await window.electron.httpsServer.status();
      
      if (!localServerStatus.isRunning) {
        // Local server is down - tunnel should be considered disconnected
        console.log('🔴 Local HTTP server is down, tunnel cannot function');
        
        // Still check service availability for accurate status
        const isServiceAvailable = await checkTunnelServiceAvailability();
        
        return {
          isConnected: false,
          isServiceAvailable,
          lastHealthCheck: new Date().toISOString(),
          healthError: `Local HTTP server is not running (port ${localServerStatus.port || 'unknown'})`,
        };
      }

      // Check 1: Is the tunneling service reachable?
      const isServiceAvailable = await checkTunnelServiceAvailability();
      
      if (!isServiceAvailable) {
        console.log('🔴 Tunneling service is not reachable');
        return {
          isConnected: false,
          isServiceAvailable: false,
          lastHealthCheck: new Date().toISOString(),
          healthError: 'Tunneling service is not reachable (tunneling-service.onrender.com may be down)',
        };
      }

      // Check 2: Do we have an active WebSocket tunnel connection?
      const connectionResult = await window.electron.invoke('mcp-tunnel-info', serverName);
      
      if (connectionResult.success) {
        // connectionResult structure: { success: true, isActive: boolean, isConnected: boolean, ... }
        const isActive = connectionResult.isActive || false;
        const isConnected = connectionResult.isConnected || false;
        
        if (isActive && isConnected) {
          console.log('✅ Tunnel health check: Service reachable and WebSocket connected');
          return {
            isConnected: true,
            isServiceAvailable: true,
            lastHealthCheck: new Date().toISOString(),
            healthError: undefined,
          };
        } else if (isActive && !isConnected) {
          console.log('⚠️ Tunnel is active but WebSocket connection is lost');
          return {
            isConnected: false,
            isServiceAvailable: true,
            lastHealthCheck: new Date().toISOString(),
            healthError: 'Tunnel active but WebSocket connection lost',
          };
        } else {
          console.log('ℹ️ No active tunnel found for this server');
          return {
            isConnected: false,
            isServiceAvailable: true,
            lastHealthCheck: new Date().toISOString(),
            healthError: 'No active tunnel connection found',
          };
        }
      } else {
        console.log('⚠️ Failed to get tunnel connection status from local manager');
        return {
          isConnected: false,
          isServiceAvailable: true,
          lastHealthCheck: new Date().toISOString(),
          healthError: connectionResult.error || 'Failed to check local tunnel status',
        };
      }
    } catch (err) {
      console.error('Error checking tunnel health:', err);
      return {
        isConnected: false,
        isServiceAvailable: false,
        lastHealthCheck: new Date().toISOString(),
        healthError: err instanceof Error ? err.message : 'Health check failed',
      };
    }
  };

  // Load active tunnel configuration
  const loadActiveTunnelConfig = async () => {
    try {
      const result = await window.electron.invoke('get-mcp-tunnel-config');
      if (result.success && result.tunnel) {
        // Get health status for the configured tunnel
        const healthStatus = await checkTunnelHealth(result.tunnel.serverName);
        
        setActiveTunnelConfig({
          // Start with defaults for new fields
          wasAutoDisconnected: false,
          autoReconnectAttempts: 0,
          // Then merge stored tunnel config
          ...result.tunnel,
          // Finally merge health status (which might override defaults)
          ...healthStatus,
        });
      } else {
        // Clear state when no tunnel is active (important for UI sync)
        setActiveTunnelConfig({
          registered: false,
          registrationId: '',
          serverName: '',
          publicUrl: '',
          registeredAt: '',
          lastConnectedAt: '',
          isConnected: false,
          isServiceAvailable: false,
          lastHealthCheck: '',
          healthError: undefined,
          wasAutoDisconnected: false,
          autoReconnectAttempts: 0,
        });
      }
    } catch (err) {
      console.error('Error loading tunnel configuration:', err);
      // Also clear state on error to prevent stuck UI
      setActiveTunnelConfig({
        registered: false,
        registrationId: '',
        serverName: '',
        publicUrl: '',
        registeredAt: '',
        lastConnectedAt: '',
        isConnected: false,
        isServiceAvailable: false,
        lastHealthCheck: '',
        healthError: err instanceof Error ? err.message : 'Unknown error',
        wasAutoDisconnected: false,
        autoReconnectAttempts: 0,
      });
    }
  };

  // Save MCP server name
  const handleSaveMcpServerName = async () => {
    if (!editingMcpServerNameValue.trim()) {
      alert('Server name cannot be empty');
      return;
    }

    // Validate server name format (lowercase, alphanumeric, hyphens only)
    const normalizedName = editingMcpServerNameValue.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    try {
      const result = await window.electron.invoke('set-mcp-server-name', normalizedName);
      if (result.success) {
        setMcpServerName(normalizedName);
        setIsEditingMcpServerName(false);
        setEditingMcpServerNameValue('');
        alert('MCP server name updated successfully!');
      } else {
        alert(`Failed to update server name: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error saving MCP server name:', err);
      alert(`Error saving server name: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleEditMcpServerName = () => {
    setIsEditingMcpServerName(true);
    setEditingMcpServerNameValue(mcpServerName);
  };

  const handleCancelEditMcpServerName = () => {
    setIsEditingMcpServerName(false);
    setEditingMcpServerNameValue('');
  };

  // Check Claude Desktop status on mount
  useEffect(() => {
    checkClaudeDesktopStatus();
    loadHttpServerStatus();
    loadMCPServers();
    loadSupabaseConfig();
    loadTunnelConfigs();
    loadMcpServerName();
    loadActiveTunnelConfig();
  }, []);

  // Periodic tunnel health checking with auto-disconnect
  useEffect(() => {
    // Only start health checking if tunnel is registered
    if (!activeTunnelConfig.registered || !activeTunnelConfig.serverName) {
      return;
    }

    console.log(`🔍 Starting periodic health checks for tunnel: ${activeTunnelConfig.serverName}`);

    const healthCheckInterval = setInterval(async () => {
      try {
        const healthStatus = await checkTunnelHealth(activeTunnelConfig.serverName);
        
        // Auto-disconnect: If local server is down and tunnel was previously connected,
        // automatically stop the tunnel to clean up the connection
        if (!healthStatus.isConnected && 
            activeTunnelConfig.isConnected && 
            healthStatus.healthError?.includes('Local HTTP server is not running')) {
          
          console.log('🛑 Local server went down, automatically stopping tunnel...');
          
          try {
            const stopResult = await window.electron.invoke('mcp-tunnel-stop', activeTunnelConfig.serverName);
            if (stopResult.success) {
              console.log('✅ Tunnel automatically stopped due to local server being down');
              
              // Mark as auto-disconnected for future auto-reconnection
              setActiveTunnelConfig(prev => ({
                ...prev,
                isConnected: false,
                wasAutoDisconnected: true,
                autoReconnectAttempts: 0,
                lastHealthCheck: new Date().toISOString(),
                healthError: 'Local HTTP server is not running - tunnel auto-disconnected',
              }));
              
              return; // Skip the normal health status update
            } else {
              console.warn('⚠️ Failed to automatically stop tunnel:', stopResult.error);
            }
          } catch (stopErr) {
            console.error('❌ Error automatically stopping tunnel:', stopErr);
          }
        }

        // Auto-reconnect 1: WebSocket connection lost (service available, local server running, but WebSocket disconnected)
        const shouldAutoReconnect = healthStatus.isConnected === false && 
            healthStatus.isServiceAvailable && 
            !healthStatus.healthError?.includes('Local HTTP server is not running') &&
            !healthStatus.healthError?.includes('Tunneling service is not reachable') &&
            activeTunnelConfig.registered && 
            activeTunnelConfig.publicUrl &&
            !activeTunnelConfig.wasAutoDisconnected && // This is for normal WebSocket drops, not local server issues
            activeTunnelConfig.autoReconnectAttempts < 3; // Limit attempts to prevent infinite loops

        // Debug logging to see why auto-reconnection might not trigger
        console.log('🔍 Auto-reconnect check:', {
          isConnected: healthStatus.isConnected,
          isServiceAvailable: healthStatus.isServiceAvailable,
          healthError: healthStatus.healthError,
          hasLocalServerError: healthStatus.healthError?.includes('Local HTTP server is not running'),
          hasServiceError: healthStatus.healthError?.includes('Tunneling service is not reachable'),
          registered: activeTunnelConfig.registered,
          hasPublicUrl: !!activeTunnelConfig.publicUrl,
          wasAutoDisconnected: activeTunnelConfig.wasAutoDisconnected,
          autoReconnectAttempts: activeTunnelConfig.autoReconnectAttempts,
          shouldAutoReconnect
        });

        if (shouldAutoReconnect) {
          
          console.log('🔄 WebSocket connection lost, attempting auto-reconnection...');
          
          try {
            const reconnectResult = await window.electron.invoke('mcp-tunnel-start', 
              activeTunnelConfig.serverName, 
              `http://localhost:${httpServerStatus.port || 8080}`);
              
            if (reconnectResult.success) {
              console.log('🎉 WebSocket tunnel automatically reconnected!');
              
              // Update state to reflect successful reconnection
              setActiveTunnelConfig(prev => ({
                ...prev,
                isConnected: true,
                autoReconnectAttempts: 0,   // Reset attempts counter
                lastHealthCheck: new Date().toISOString(),
                healthError: undefined,
                lastConnectedAt: new Date().toISOString(),
              }));
              
              // Show user notification
              const notificationMessage = `✅ Tunnel automatically reconnected!\n\nServer: ${activeTunnelConfig.serverName}\nWebSocket connection restored after network interruption.`;
              setTimeout(() => alert(notificationMessage), 500);
              
              return; // Skip the normal health status update
            } else {
              console.warn('⚠️ WebSocket auto-reconnection attempt failed:', reconnectResult.error);
              
              // Increment attempt counter
              setActiveTunnelConfig(prev => ({
                ...prev,
                autoReconnectAttempts: prev.autoReconnectAttempts + 1,
                lastHealthCheck: new Date().toISOString(),
                healthError: `WebSocket auto-reconnection failed (attempt ${prev.autoReconnectAttempts + 1}/3): ${reconnectResult.error}`,
              }));
              
              return;
            }
          } catch (reconnectErr) {
            console.error('❌ Error during WebSocket auto-reconnection:', reconnectErr);
            
            // Increment attempt counter
            setActiveTunnelConfig(prev => ({
              ...prev,
              autoReconnectAttempts: prev.autoReconnectAttempts + 1,
              lastHealthCheck: new Date().toISOString(),
              healthError: `WebSocket auto-reconnection error (attempt ${prev.autoReconnectAttempts + 1}/3): ${reconnectErr instanceof Error ? reconnectErr.message : 'Unknown error'}`,
            }));
            
            return;
          }
        }

        // Auto-reconnect 2: If local server comes back online and tunnel was auto-disconnected,
        // attempt to restart the tunnel automatically (only if service is available)
        if (healthStatus.isConnected === false && 
            healthStatus.isServiceAvailable && 
            !healthStatus.healthError?.includes('Local HTTP server is not running') &&
            !healthStatus.healthError?.includes('Tunneling service is not reachable') &&
            activeTunnelConfig.wasAutoDisconnected &&
            activeTunnelConfig.autoReconnectAttempts < 3) { // Limit attempts to prevent infinite loops
          
          console.log('🔄 Local server is back online, attempting tunnel auto-reconnection...');
          
          try {
            const reconnectResult = await window.electron.invoke('mcp-tunnel-start', 
              activeTunnelConfig.serverName, 
              `http://localhost:${httpServerStatus.port || 8080}`);
              
            if (reconnectResult.success) {
              console.log('🎉 Tunnel automatically reconnected after local server recovery!');
              
              // Update state to reflect successful reconnection
              setActiveTunnelConfig(prev => ({
                ...prev,
                isConnected: true,
                wasAutoDisconnected: false, // Clear the auto-disconnect flag
                autoReconnectAttempts: 0,   // Reset attempts counter
                lastHealthCheck: new Date().toISOString(),
                healthError: undefined,
                lastConnectedAt: new Date().toISOString(),
              }));
              
              // Show user notification
              const notificationMessage = `✅ Tunnel automatically reconnected!\n\nServer: ${activeTunnelConfig.serverName}\nLocal server came back online and tunnel was restored.`;
              // Using alert for now, could be replaced with a toast notification
              setTimeout(() => alert(notificationMessage), 500);
              
              return; // Skip the normal health status update
            } else {
              console.warn('⚠️ Auto-reconnection attempt failed:', reconnectResult.error);
              
              // Increment attempt counter
              setActiveTunnelConfig(prev => ({
                ...prev,
                autoReconnectAttempts: prev.autoReconnectAttempts + 1,
                lastHealthCheck: new Date().toISOString(),
                healthError: `Auto-reconnection failed (attempt ${prev.autoReconnectAttempts + 1}/3): ${reconnectResult.error}`,
              }));
              
              return;
            }
          } catch (reconnectErr) {
            console.error('❌ Error during auto-reconnection:', reconnectErr);
            
            // Increment attempt counter
            setActiveTunnelConfig(prev => ({
              ...prev,
              autoReconnectAttempts: prev.autoReconnectAttempts + 1,
              lastHealthCheck: new Date().toISOString(),
              healthError: `Auto-reconnection error (attempt ${prev.autoReconnectAttempts + 1}/3): ${reconnectErr instanceof Error ? reconnectErr.message : 'Unknown error'}`,
            }));
            
            return;
          }
        }
        
        // Update tunnel config with new health status
        setActiveTunnelConfig(prev => ({
          ...prev,
          ...healthStatus,
        }));

        // Log health status changes
        if (healthStatus.isConnected !== activeTunnelConfig.isConnected) {
          console.log(`🔄 Tunnel connection status changed: ${healthStatus.isConnected ? 'Connected' : 'Disconnected'}`);
          
          // If tunnel disconnected unexpectedly, provide helpful context
          if (!healthStatus.isConnected && activeTunnelConfig.isConnected) {
            if (healthStatus.healthError) {
              console.log(`📋 Disconnection reason: ${healthStatus.healthError}`);
            }
          }
        }
        if (healthStatus.isServiceAvailable !== activeTunnelConfig.isServiceAvailable) {
          console.log(`🔄 Tunnel service availability changed: ${healthStatus.isServiceAvailable ? 'Available' : 'Unavailable'}`);
        }
      } catch (err) {
        console.error('Error in periodic tunnel health check:', err);
      }
    }, 10000); // Check every 10 seconds (more frequent to catch server downs faster)

    // Cleanup interval on unmount or when tunnel changes
    return () => {
      console.log(`🛑 Stopping periodic health checks for tunnel: ${activeTunnelConfig.serverName}`);
      clearInterval(healthCheckInterval);
    };
  }, [activeTunnelConfig.registered, activeTunnelConfig.serverName, activeTunnelConfig.isConnected]); // Include isConnected to react to connection state changes

  // Load HTTP server status
  const loadHttpServerStatus = async () => {
    try {
      const result = await window.electron.httpsServer.status();
      setHttpServerStatus({
        isRunning: result.isRunning || false,
        port: result.port || null,
        isLoading: false
      });
    } catch (err) {
      console.error('Error loading HTTP server status:', err);
      setHttpServerStatus({
        isRunning: false,
        port: null,
        isLoading: false
      });
    }
  };

  // Load MCP servers configuration
  const loadMCPServers = async () => {
    try {
      const result = await window.electron.invoke('mcp-server-list');
      if (result.success && result.servers) {
        setMcpServers(result.servers);
      }
    } catch (err) {
      console.error('Error loading MCP servers:', err);
    }
  };

  // Start HTTP server
  const handleStartHttpServer = async () => {
    try {
      setHttpServerStatus(prev => ({ ...prev, isLoading: true }));
      
      const result = await window.electron.httpsServer.start({
        port: 8080,
        useHTTPS: false
      });

      if (result.success) {
        const networkInfo = await window.electron.httpsServer.getNetworkInfo();
        const localIP = networkInfo.localIP || 'localhost';
        
        alert(`✅ HTTP Server started successfully!\n\nLocal: http://localhost:${result.port}\nNetwork: http://${localIP}:${result.port}\n\n📡 MCP endpoints are now accessible!`);
        
        await loadHttpServerStatus();
      } else {
        alert(`Failed to start server: ${result.error || 'Unknown error'}`);
        setHttpServerStatus(prev => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      console.error('Error starting HTTP server:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setHttpServerStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Stop HTTP server
  const handleStopHttpServer = async () => {
    try {
      setHttpServerStatus(prev => ({ ...prev, isLoading: true }));
      
      const result = await window.electron.httpsServer.stop();

      if (result.success) {
        alert('✅ HTTP Server stopped successfully!');
        await loadHttpServerStatus();
      } else {
        alert(`Failed to stop server: ${result.error || 'Unknown error'}`);
        setHttpServerStatus(prev => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      console.error('Error stopping HTTP server:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setHttpServerStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Enable MCP server
  const handleEnableMCPServer = async (serverName: string) => {
    try {
      const result = await window.electron.invoke('mcp-server-enable', serverName);
      
      if (result.success) {
        alert(`✅ ${serverName} MCP server enabled!\n\nDocumentation is now available at: /${serverName}/tools`);
        await loadMCPServers();
      } else {
        alert(`Failed to enable ${serverName}: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(`Error enabling ${serverName}:`, err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Disable MCP server
  const handleDisableMCPServer = async (serverName: string) => {
    try {
      const result = await window.electron.invoke('mcp-server-disable', serverName);
      
      if (result.success) {
        alert(`🔴 ${serverName} MCP server disabled!\n\nDocumentation is no longer available.`);
        await loadMCPServers();
      } else {
        alert(`Failed to disable ${serverName}: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(`Error disabling ${serverName}:`, err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const mcpTools: MCPTool[] = [
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Connect to Gmail with AI-powered automation for EG Blogging',
      icon: faEnvelope,
      color: '#ea4335',
      gradient: 'linear-gradient(135deg, #ea4335 0%, #d33b2c 100%)',
      isAvailable: true,
      features: ['Email Integration', 'AI Content Generation', 'Automated Workflows', 'Message Management'],
      status: 'available'
    }
  ];

  const handleToolSelect = (toolId: string) => {
    setSelectedTool(toolId);
    if (toolId === 'gmail') {
      setShowGmailTool(true);
    }
  };

  const handleGmailConnect = async (connectionData: any) => {
    // Gmail connection logic here
    console.log('Gmail MCP tool connected:', connectionData);
    alert(`Successfully connected to Gmail: ${connectionData.name}`);
    
    // Refresh servers list
    await loadRunningServers(true);
    
    setShowGmailTool(false);
    setSelectedTool('');
  };

  const handleBackFromTool = () => {
    setShowGmailTool(false);
    setSelectedTool('');
  };


  // Helper functions for running servers
  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return faCircleCheck;
      case 'stopped': return faCircleXmark;
      case 'error': return faTriangleExclamation;
      case 'starting': return faSpinner;
      case 'stopping': return faSpinner;
      default: return faCircleXmark;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#10b981';
      case 'stopped': return '#6b7280';
      case 'error': return '#ef4444';
      case 'starting': return '#f59e0b';
      case 'stopping': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getAccessLevelIcon = (level: string) => {
    switch (level) {
      case 'claude-desktop': return faShieldAlt;
      case 'local-network': return faWifi;
      case 'public': return faPublic;
      default: return faShieldAlt;
    }
  };

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case 'claude-desktop': return '#3b82f6';
      case 'local-network': return '#f59e0b';
      case 'public': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getAccessLevelDisplayName = (level: string) => {
    switch (level) {
      case 'claude-desktop': return 'Claude Desktop Only';
      case 'local-network': return 'Local Network';
      case 'public': return 'Public Access';
      default: return 'Unknown';
    }
  };

  const generateMCPSchema = (server: RunningMCPServer): string => {
    // Generate server name from the actual server name
    const serverKey = server.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Determine the server path based on server type
    let serverPath: string;
    if (server.type === 'gmail') {
      // For Gmail servers, use the built server path
      serverPath = `./dist-mcp/server.js`;
    } else {
      // For custom servers, use a generic path
      serverPath = `./mcp-servers/${serverKey}.js`;
    }

    // Generate the actual Claude Desktop MCP configuration
    const mcpConfig = {
      mcpServers: {
        [serverKey]: {
          command: 'node',
          args: [serverPath]
        }
      }
    };

    return JSON.stringify(mcpConfig, null, 2);
  };

  const generateNetworkMCPSchema = (server: RunningMCPServer): string => {
    // Generate server name from the actual server name
    const serverKey = server.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Get the local IP address for network access
    const localIP = server.address === '0.0.0.0' ? 'localhost' : server.address;
    const port = server.port;
    const protocol = server.protocol || 'http';
    
    // Generate the network MCP configuration with HTTP endpoint
    const networkMCPConfig = {
      mcpServers: {
        [serverKey]: {
          command: 'npx',
          args: ['@modelcontextprotocol/server-fetch'],
          env: {
            MCP_SERVER_URL: `${protocol}://${localIP}:${port}/mcp/${serverKey}`
          }
        }
      }
    };

    return JSON.stringify(networkMCPConfig, null, 2);
  };

  const generatePublicMCPSchema = (server: RunningMCPServer): string => {
    // Use server type (gmail, custom, etc.) as the MCP server name
    const serverKey = server.type === 'gmail' ? 'gmail' : server.type;
    
    // Generate the actual server name for the tunnel URL
    const tunnelServerName = server.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    // Use actual Supabase URL or placeholder (using /tunnel endpoint for WebSocket-based tunneling)
    const tunnelUrl = supabaseConfig.supabaseUrl 
      ? `${supabaseConfig.supabaseUrl}/functions/v1/tunnel?name=${tunnelServerName}`
      : `https://your-supabase-project.supabase.co/functions/v1/tunnel?name=${tunnelServerName}`;
    
    // Generate the public MCP configuration with Supabase tunnel URL
    const publicMCPConfig: any = {
      mcpServers: {
        [serverKey]: {
          command: 'npx',
          args: ['@modelcontextprotocol/server-fetch'],
          env: {
            MCP_SERVER_URL: tunnelUrl
          }
        }
      }
    };

    // Add anon key if configured
    if (supabaseConfig.hasSupabaseKey) {
      publicMCPConfig.mcpServers[serverKey].env.SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';
    }

    return JSON.stringify(publicMCPConfig, null, 2);
  };

  const handleCopySchema = (server: RunningMCPServer) => {
    const schema = generateMCPSchema(server);
    navigator.clipboard.writeText(schema).then(() => {
      alert('MCP schema copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy schema:', err);
      alert('Failed to copy schema to clipboard');
    });
  };

  const handleCopyNetworkSchema = (server: RunningMCPServer) => {
    const schema = generateNetworkMCPSchema(server);
    navigator.clipboard.writeText(schema).then(() => {
      alert('Network MCP configuration copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy network schema:', err);
      alert('Failed to copy network configuration to clipboard');
    });
  };

  const handleCopyPublicSchema = (server: RunningMCPServer) => {
    const schema = generatePublicMCPSchema(server);
    const serverKey = server.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    let message = '✅ Public MCP configuration copied to clipboard!';
    
    if (supabaseConfig.supabaseUrl) {
      message += `\n\nTunnel URL: ${supabaseConfig.supabaseUrl}/functions/v1/r?name=${serverKey}`;
      
      if (supabaseConfig.hasSupabaseKey) {
        message += '\n\n⚠️ Note: Set your SUPABASE_ANON_KEY environment variable before using this configuration.';
      }
    } else {
      message += '\n\n⚠️ Note: Configure SUPABASE_URL in your .env file to use the actual tunnel endpoint.';
    }
    
    navigator.clipboard.writeText(schema).then(() => {
      alert(message);
    }).catch(err => {
      console.error('Failed to copy public schema:', err);
      alert('Failed to copy public configuration to clipboard');
    });
  };

  const handleServerAction = (serverId: string, action: string) => {
    console.log(`Server action: ${action} for server ${serverId}`);
    // Implement server actions here
  };

  const handleViewLogs = (server: RunningMCPServer) => {
    setSelectedServer(server);
    setShowLogs(true);
  };

  const handleViewDashboard = (server: RunningMCPServer) => {
    setSelectedServer(server);
    setShowDashboard(true);
  };

  const handleEditAccessLevel = (server: RunningMCPServer) => {
    setEditingServer(server);
    setShowAccessLevelModal(true);
  };

  const handleAccessLevelChange = async (newLevel: AccessLevel) => {
    if (!editingServer) return;

    try {
      let serverWasStarted = false;
      let servicesWereEnabled = false;
      let servicesWereDisabled = false;
      
      // If switching to claude-desktop, only disable the documentation service
      if (newLevel === 'claude-desktop') {
        // Disable MCP documentation service (leave HTTP server running for other services)
        const serverType = editingServer.type;
        const matchingService = mcpServers.find(s => s.name.toLowerCase() === serverType.toLowerCase());
        
        if (matchingService && matchingService.enabled) {
          console.log(`Disabling ${serverType} MCP documentation service...`);
          const disableResult = await window.electron.invoke('mcp-server-disable', matchingService.name);
          
          if (disableResult.success) {
            console.log('MCP documentation service disabled successfully');
            servicesWereDisabled = true;
            await loadMCPServers();
          } else {
            console.warn(`Failed to disable MCP documentation service: ${disableResult.error}`);
          }
        }
      } else {
        // For local-network or public access, ensure HTTP server and documentation are enabled
        
        // Check if HTTP server is running, and start it if not
        if (!httpServerStatus.isRunning) {
          console.log('HTTP server not running, starting it...');
          
          const serverResult = await window.electron.httpsServer.start({
            port: 8080,
            useHTTPS: false
          });

          if (serverResult.success) {
            console.log('HTTP server started successfully');
            serverWasStarted = true;
            // Update HTTP server status
            await loadHttpServerStatus();
          } else {
            alert(`Failed to start HTTP server: ${serverResult.error || 'Unknown error'}\n\nAccess level change aborted.`);
            return;
          }
        }

        // Enable MCP documentation service for the server type if not already enabled
        const serverType = editingServer.type;
        const matchingService = mcpServers.find(s => s.name.toLowerCase() === serverType.toLowerCase());
        
        if (matchingService && !matchingService.enabled) {
          console.log(`Enabling ${serverType} MCP documentation service...`);
          const enableResult = await window.electron.invoke('mcp-server-enable', matchingService.name);
          
          if (enableResult.success) {
            console.log('MCP documentation service enabled successfully');
            servicesWereEnabled = true;
            // Refresh MCP servers list
            await loadMCPServers();
          } else {
            console.warn(`Failed to enable MCP documentation service: ${enableResult.error}`);
          }
        }
      }

      const updates = {
        accessLevel: {
          level: newLevel,
          port: getDefaultPortForAccessLevel(newLevel),
          bindAddress: getDefaultBindAddressForAccessLevel(newLevel),
          requiresAuth: newLevel !== 'claude-desktop',
          allowedIPs: newLevel === 'local-network' ? ['192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'] : undefined
        }
      };

      const result = await window.electron.mcpConfig.connections.update(editingServer.id, updates);
      
      if (result.success) {
        // Update the local state
        setServers(prev => prev.map(server => 
          server.id === editingServer.id 
            ? { ...server, ...updates }
            : server
        ));
        
        setShowAccessLevelModal(false);
        setEditingServer(null);
        
        // Build success message based on what was done
        let message = `Access level changed to ${getAccessLevelDisplayName(newLevel)}`;
        
        if (serverWasStarted || servicesWereEnabled || servicesWereDisabled) {
          message = '✅ ';
          const actions = [];
          
          if (servicesWereDisabled) actions.push('MCP documentation disabled');
          if (serverWasStarted) actions.push('HTTP Server started');
          if (servicesWereEnabled) actions.push('MCP documentation enabled');
          
          message += actions.join(' and ');
          message += `, and access level changed to ${getAccessLevelDisplayName(newLevel)}`;
          
          if ((httpServerStatus.port || serverWasStarted) && newLevel !== 'claude-desktop') {
            const port = httpServerStatus.port || 8080;
            message += `\n\n📚 Documentation available at: http://localhost:${port}/`;
          }
        }
        
        alert(message);
      } else {
        alert(`Failed to update access level: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error updating access level:', err);
      alert(`Error updating access level: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const getDefaultPortForAccessLevel = (level: AccessLevel): number => {
    switch (level) {
      case 'claude-desktop': return 8080;
      case 'local-network': return 8081;
      case 'public': return 8082;
      default: return 8080;
    }
  };

  const getDefaultBindAddressForAccessLevel = (level: AccessLevel): string => {
    switch (level) {
      case 'claude-desktop': return '127.0.0.1';
      case 'local-network': return '0.0.0.0';
      case 'public': return '0.0.0.0';
      default: return '127.0.0.1';
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!window.confirm('Are you sure you want to delete this MCP server connection?')) {
      return;
    }

    try {
      const result = await window.electron.mcpConfig.connections.remove(serverId);
      
      if (result.success) {
        setServers(prev => prev.filter(s => s.id !== serverId));
        alert('Server deleted successfully');
      } else {
        alert(`Failed to delete server: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error deleting server: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleEditServerName = (server: RunningMCPServer) => {
    setEditingServerName(server.id);
    setEditingServerNameValue(server.name);
  };

  const handleSaveServerName = async (serverId: string) => {
    if (!editingServerNameValue.trim()) {
      alert('Server name cannot be empty');
      return;
    }

    try {
      const result = await window.electron.mcpConfig.connections.update(serverId, {
        name: editingServerNameValue.trim()
      });
      
      if (result.success) {
        setServers(prev => prev.map(server => 
          server.id === serverId 
            ? { ...server, name: editingServerNameValue.trim() }
            : server
        ));
        setEditingServerName(null);
        setEditingServerNameValue('');
        alert('Server name updated successfully');
      } else {
        alert(`Failed to update server name: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error updating server name: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCancelEditServerName = () => {
    setEditingServerName(null);
    setEditingServerNameValue('');
  };

  const handleConfigureClaudeDesktop = async (server: RunningMCPServer) => {
    try {
      // Call the automatic Claude Desktop configuration
      const result = await window.electron.mcpServer.configureClaude();
      
      if (result.success) {
        alert('Successfully configured Claude Desktop! The MCP server is now available in Claude Desktop.');
        // Refresh status after successful configuration
        await checkClaudeDesktopStatus();
      } else {
        alert(`Failed to configure Claude Desktop: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error configuring Claude Desktop:', err);
      alert(`Error configuring Claude Desktop: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleUnconfigureClaudeDesktop = async (server: RunningMCPServer) => {
    try {
      // Call the automatic Claude Desktop unconfiguration
      const result = await window.electron.mcpServer.unconfigureClaude();
      
      if (result.success) {
        alert('Successfully removed from Claude Desktop! The MCP server is no longer available in Claude Desktop.');
        // Refresh status after successful unconfiguration
        await checkClaudeDesktopStatus();
      } else {
        alert(`Failed to remove from Claude Desktop: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error removing from Claude Desktop:', err);
      alert(`Error removing from Claude Desktop: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleStartTunnel = async (server: RunningMCPServer) => {
    try {
      console.log(`🚀 Starting tunnel for: ${server.name}`);
      
      // Use the global MCP server name instead of per-server name
      const localServerUrl = `http://localhost:${server.port}`;
      
      // Start tunnel (auto-registers and connects)
      const result = await window.electron.invoke('mcp-tunnel-start', mcpServerName, localServerUrl) as {
        success: boolean;
        message?: string;
        error?: string;
        publicUrl?: string;
        registrationId?: string;
        tunnelId?: string;
      };
      
      if (result.success) {
        // Reset auto-reconnection state on manual start
        setActiveTunnelConfig(prev => ({
          ...prev,
          autoReconnectAttempts: 0,
          wasAutoDisconnected: false,
          healthError: undefined,
        }));
        
        // Reload the saved tunnel configuration
        await loadActiveTunnelConfig();
        
        const publicUrlMessage = result.publicUrl 
          ? `\n\nPublic URL: ${result.publicUrl}`
          : '';
        
        alert(`✅ Tunnel started successfully!\n\nServer: ${server.name}\nTunnel Name: ${mcpServerName}\nLocal Port: ${server.port}${publicUrlMessage}\n\nYour server is now accessible through the public URL.`);
        
        // Refresh server list to update tunnel status
        await loadRunningServers(true);
      } else {
        alert(`❌ Failed to start tunnel: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('Error starting tunnel:', error);
      alert(`❌ Error starting tunnel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStopTunnel = async (server: RunningMCPServer) => {
    try {
      console.log(`🛑 Stopping tunnel for: ${server.name}`);
      
      // Use the global MCP server name
      const result = await window.electron.invoke('mcp-tunnel-stop', mcpServerName);
      
      if (result.success) {
        // Reset auto-reconnection state on manual stop
        setActiveTunnelConfig(prev => ({
          ...prev,
          autoReconnectAttempts: 0,
          wasAutoDisconnected: false,
          healthError: undefined,
        }));
        
        // Reload the saved tunnel configuration
        await loadActiveTunnelConfig();
        
        alert(`✅ Tunnel stopped successfully!\n\nServer: ${server.name}\nTunnel Name: ${mcpServerName}`);
        
        // Refresh server list to update tunnel status
        await loadRunningServers(true);
      } else {
        alert(`❌ Failed to stop tunnel: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('Error stopping tunnel:', error);
      alert(`❌ Error stopping tunnel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Tunnel handlers for TunnelAndServerConfig (uses HTTP server port 8080)
  const handleStartTunnelForConfig = async () => {
    try {
      if (!httpServerStatus.isRunning || !httpServerStatus.port) {
        alert('❌ HTTP server must be running to start tunnel');
        return;
      }
      
      console.log(`🚀 Starting tunnel for MCP server: ${mcpServerName}`);
      
      const localServerUrl = `http://localhost:${httpServerStatus.port}`;
      
      // Start tunnel (auto-registers and connects)
      const result = await window.electron.invoke('mcp-tunnel-start', mcpServerName, localServerUrl) as {
        success: boolean;
        message?: string;
        error?: string;
        publicUrl?: string;
        registrationId?: string;
        tunnelId?: string;
      };
      
      if (result.success) {
        // Reset auto-reconnection state on manual start
        setActiveTunnelConfig(prev => ({
          ...prev,
          autoReconnectAttempts: 0,
          wasAutoDisconnected: false,
          healthError: undefined,
        }));
        
        // Reload the saved tunnel configuration
        await loadActiveTunnelConfig();
        
        const publicUrlMessage = result.publicUrl 
          ? `\n\n🌐 Public URL: ${result.publicUrl}`
          : '';
        
        alert(`✅ Tunnel started successfully!\n\nTunnel Name: ${mcpServerName}\nLocal Port: ${httpServerStatus.port}${publicUrlMessage}`);
      } else {
        alert(`❌ Failed to start tunnel: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('Error starting tunnel:', error);
      alert(`❌ Error starting tunnel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStopTunnelForConfig = async () => {
    try {
      console.log(`🛑 Stopping tunnel for: ${mcpServerName}`);
      
      const result = await window.electron.invoke('mcp-tunnel-stop', mcpServerName);
      
      // Reset auto-reconnection state on manual stop attempt
      setActiveTunnelConfig(prev => ({
        ...prev,
        autoReconnectAttempts: 0,
        wasAutoDisconnected: false,
        healthError: undefined,
      }));
      
      // Always reload tunnel config to sync state, even if stop fails
      await loadActiveTunnelConfig();
      
      if (result.success) {
        alert(`✅ Tunnel stopped successfully!\n\nTunnel Name: ${mcpServerName}`);
      } else {
        const errorMsg = result.error || result.message || 'Unknown error';
        // If tunnel not found, the state is already cleared by reload above
        if (errorMsg.includes('No active tunnel') || errorMsg.includes('not found')) {
          alert(`ℹ️ Tunnel state cleared.\n\nThe tunnel was already disconnected (possibly from app restart).\nYou can now start a new tunnel.`);
        } else {
          alert(`❌ Failed to stop tunnel: ${errorMsg}`);
        }
      }
    } catch (error) {
      console.error('Error stopping tunnel:', error);
      // Still reload to ensure state is synced
      await loadActiveTunnelConfig();
      alert(`❌ Error stopping tunnel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleOpenTunnelRegistration = () => {
    setShowTunnelRegistrationModal(true);
    setTunnelServerName('');
    setTunnelRegistrationStatus({ status: 'idle' });
  };

  const handleRegisterTunnel = async () => {
    if (!tunnelServerName.trim()) {
      setTunnelRegistrationStatus({
        status: 'error',
        message: 'Please enter a server name'
      });
      return;
    }

    // Validate server name format (lowercase, alphanumeric, hyphens only)
    const normalizedName = tunnelServerName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    if (normalizedName !== tunnelServerName.toLowerCase()) {
      setTunnelServerName(normalizedName);
    }

    try {
      setTunnelRegistrationStatus({ status: 'registering', message: 'Registering with tunnel service...' });

      // Register with tunnel service
      const result = await window.electron.invoke('mcp-tunnel-register', normalizedName) as {
        success: boolean;
        status?: 'registered' | 'name_taken' | 'error';
        message?: string;
        name?: string;
        ip?: string;
        id?: string;
        created_at?: string;
      };

      if (result.success && result.status === 'registered') {
        // Generate tunnel URL based on Supabase configuration
        const tunnelUrl = supabaseConfig.supabaseUrl 
          ? `${supabaseConfig.supabaseUrl}/functions/v1/tunnel?name=${normalizedName}`
          : `https://your-supabase-project.supabase.co/functions/v1/tunnel?name=${normalizedName}`;

        // Save tunnel configuration to electron store
        const saveResult = await window.electron.invoke('save-tunnel-config', {
          name: normalizedName,
          tunnelUrl: tunnelUrl,
          registeredAt: result.created_at || new Date().toISOString(),
          id: result.id,
          ip: result.ip
        });

        if (saveResult.success) {
          setTunnelRegistrationStatus({
            status: 'success',
            message: `Successfully registered "${normalizedName}"!`,
            publicUrl: tunnelUrl
          });
          // Reload tunnel configs to show the new registration
          await loadTunnelConfigs();
        } else {
          setTunnelRegistrationStatus({
            status: 'error',
            message: `Registration successful but failed to save configuration: ${saveResult.error}`
          });
        }
      } else if (result.status === 'name_taken') {
        setTunnelRegistrationStatus({
          status: 'name_taken',
          message: `The name "${normalizedName}" is already taken. Please choose a different name.`
        });
      } else {
        setTunnelRegistrationStatus({
          status: 'error',
          message: result.message || 'Registration failed'
        });
      }
    } catch (error) {
      console.error('Error registering tunnel:', error);
      setTunnelRegistrationStatus({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  const handleCloseTunnelRegistration = () => {
    setShowTunnelRegistrationModal(false);
    setTunnelServerName('');
    setTunnelRegistrationStatus({ status: 'idle' });
  };

  // Show Gmail tool if selected
  if (showGmailTool) {
    return (
      <GmailConnectorForm
        onBack={handleBackFromTool}
        onConnect={handleGmailConnect}
      />
    );
  }

  const convertServerToConnection = (server: RunningMCPServer): GmailConnection => {
    return {
      id: server.id,
      name: server.name,
      email: server.email || '',
      adminEmail: server.adminEmail || '',
      serviceAccountKey: {}, // We'll need to get this from storage
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
      type: 'gmail' as const,
      status: server.status === 'running' ? 'online' : 'offline'
    };
  };

  // Show Gmail dashboard if selected
  if (showDashboard && selectedServer) {
    return (
      <GmailDashboard
        connection={convertServerToConnection(selectedServer)}
        onBack={() => setShowDashboard(false)}
      />
    );
  }


  return (
    <div className="mcp-server">
      {/* Hero Section */}
      <div className="connector-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <FontAwesomeIcon icon={faEnvelope} />
            <span>EG Blogging Integration</span>
          </div>
          <h1>MCP Server Management</h1>
          <p>Manage your Model Context Protocol servers and create new connections for enhanced AI-powered blogging workflows</p>
          <div className="hero-actions">
            <button 
              className="hero-action-btn"
              onClick={() => handleToolSelect('gmail')}
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>Add MCP Server</span>
            </button>
          </div>
        </div>
        
        <div className="hero-visual">
          <div className="floating-cards">
            <div className="floating-card card-1">
              <FontAwesomeIcon icon={faEnvelope} />
            </div>
            <div className="floating-card card-2">
              <FontAwesomeIcon icon={faServer} />
            </div>
            <div className="floating-card card-3">
              <FontAwesomeIcon icon={faGlobe} />
            </div>
          </div>
        </div>
      </div>

      {/* Tunnel and Server Configuration */}
      <TunnelAndServerConfig
        mcpServerName={mcpServerName}
        isEditingMcpServerName={isEditingMcpServerName}
        editingMcpServerNameValue={editingMcpServerNameValue}
        setEditingMcpServerNameValue={setEditingMcpServerNameValue}
        handleEditMcpServerName={handleEditMcpServerName}
        handleSaveMcpServerName={handleSaveMcpServerName}
        handleCancelEditMcpServerName={handleCancelEditMcpServerName}
        activeTunnelConfig={activeTunnelConfig}
        tunnelConfigs={tunnelConfigs}
        httpServerStatus={httpServerStatus}
        mcpServers={mcpServers}
        handleStartHttpServer={handleStartHttpServer}
        handleStopHttpServer={handleStopHttpServer}
        loadHttpServerStatus={loadHttpServerStatus}
        handleEnableMCPServer={handleEnableMCPServer}
        handleDisableMCPServer={handleDisableMCPServer}
        handleStartTunnel={handleStartTunnelForConfig}
        handleStopTunnel={handleStopTunnelForConfig}
        loadActiveTunnelConfig={loadActiveTunnelConfig}
        checkTunnelHealth={checkTunnelHealth}
      />

      {/* Running Servers Tabs */}
      <RunningServersTabs
        servers={servers}
        loading={loading}
        error={error}
        editingServerName={editingServerName}
        editingServerNameValue={editingServerNameValue}
        claudeDesktopStatus={claudeDesktopStatus}
        supabaseConfig={supabaseConfig}
        loadRunningServers={loadRunningServers}
        setEditingServerNameValue={setEditingServerNameValue}
        handleSaveServerName={handleSaveServerName}
        handleCancelEditServerName={handleCancelEditServerName}
        handleEditServerName={handleEditServerName}
        formatUptime={formatUptime}
        getStatusIcon={getStatusIcon}
        getStatusColor={getStatusColor}
        getAccessLevelIcon={getAccessLevelIcon}
        getAccessLevelColor={getAccessLevelColor}
        getAccessLevelDisplayName={getAccessLevelDisplayName}
        generateMCPSchema={generateMCPSchema}
        generateNetworkMCPSchema={generateNetworkMCPSchema}
        generatePublicMCPSchema={generatePublicMCPSchema}
        handleCopySchema={handleCopySchema}
        handleCopyNetworkSchema={handleCopyNetworkSchema}
        handleCopyPublicSchema={handleCopyPublicSchema}
        handleConfigureClaudeDesktop={handleConfigureClaudeDesktop}
        handleUnconfigureClaudeDesktop={handleUnconfigureClaudeDesktop}
        handleEditAccessLevel={handleEditAccessLevel}
        handleViewDashboard={handleViewDashboard}
        cloudServers={cloudServers}
        cloudLoading={cloudLoading}
        cloudError={cloudError}
        loadCloudServers={loadCloudServers}
      />


      {/* Tunnel Registration Modal */}
      {showTunnelRegistrationModal && (
        <div className="access-level-modal-overlay">
          <div className="access-level-modal">
            <div className="access-level-modal-header">
              <h3>Register MCP Server Tunnel</h3>
              <button
                className="access-level-modal-close"
                onClick={handleCloseTunnelRegistration}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="access-level-modal-content">
              <div style={{ marginBottom: '24px' }}>
                <p style={{ marginBottom: '16px', opacity: 0.9 }}>
                  Register a unique name for your MCP server to enable public tunnel access. 
                  This name will be used to route requests to your server.
                </p>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    MCP Server Name
                  </label>
                  <input
                    type="text"
                    value={tunnelServerName}
                    onChange={(e) => setTunnelServerName(e.target.value)}
                    placeholder="my-mcp-server"
                    disabled={tunnelRegistrationStatus.status === 'registering' || tunnelRegistrationStatus.status === 'success'}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: 'white',
                      fontSize: '14px',
                      fontFamily: 'monospace'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tunnelRegistrationStatus.status !== 'registering' && tunnelRegistrationStatus.status !== 'success') {
                        handleRegisterTunnel();
                      }
                    }}
                  />
                  <div style={{ 
                    marginTop: '6px', 
                    fontSize: '12px', 
                    opacity: 0.6 
                  }}>
                    Use lowercase letters, numbers, and hyphens only
                  </div>
                </div>

                {/* Status Messages */}
                {tunnelRegistrationStatus.status === 'registering' && (
                  <div style={{
                    padding: '12px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#f59e0b'
                  }}>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    <span>{tunnelRegistrationStatus.message}</span>
                  </div>
                )}

                {tunnelRegistrationStatus.status === 'success' && (
                  <div style={{
                    padding: '16px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '8px',
                    color: '#10b981'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: '20px' }} />
                      <strong>{tunnelRegistrationStatus.message}</strong>
                    </div>
                    <div style={{ 
                      marginTop: '12px',
                      padding: '12px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '6px'
                    }}>
                      <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '6px' }}>
                        Tunnel URL:
                      </div>
                      <div style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '13px',
                        wordBreak: 'break-all',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ flex: 1 }}>{tunnelRegistrationStatus.publicUrl}</span>
                        <button
                          onClick={() => {
                            if (tunnelRegistrationStatus.publicUrl) {
                              navigator.clipboard.writeText(tunnelRegistrationStatus.publicUrl);
                              alert('Tunnel URL copied to clipboard!');
                            }
                          }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '4px',
                            padding: '6px 10px',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          <FontAwesomeIcon icon={faCopy} />
                        </button>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '13px', opacity: 0.9 }}>
                      ✓ Configuration saved to electron store
                    </div>
                  </div>
                )}

                {tunnelRegistrationStatus.status === 'name_taken' && (
                  <div style={{
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    color: '#ef4444'
                  }}>
                    <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginTop: '2px' }} />
                    <span>{tunnelRegistrationStatus.message}</span>
                  </div>
                )}

                {tunnelRegistrationStatus.status === 'error' && (
                  <div style={{
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    color: '#ef4444'
                  }}>
                    <FontAwesomeIcon icon={faCircleXmark} style={{ marginTop: '2px' }} />
                    <span>{tunnelRegistrationStatus.message}</span>
                  </div>
                )}
              </div>

              {/* Info Box */}
              {tunnelRegistrationStatus.status !== 'success' && (
                <div style={{
                  padding: '12px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  color: '#3b82f6'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <FontAwesomeIcon icon={faGlobe} />
                    <strong>How it works</strong>
                  </div>
                  <ul style={{ marginLeft: '20px', marginTop: '8px', opacity: 0.9 }}>
                    <li>Your server name is registered in the tunnel service</li>
                    <li>A unique tunnel URL is generated for your server</li>
                    <li>Configuration is saved locally for easy access</li>
                    <li>You can start the tunnel anytime from the server actions</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="access-level-modal-footer">
              {tunnelRegistrationStatus.status === 'success' ? (
                <button
                  className="access-level-modal-cancel"
                  onClick={handleCloseTunnelRegistration}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none'
                  }}
                >
                  Done
                </button>
              ) : (
                <>
                  <button
                    className="access-level-modal-cancel"
                    onClick={handleCloseTunnelRegistration}
                    disabled={tunnelRegistrationStatus.status === 'registering'}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRegisterTunnel}
                    disabled={!tunnelServerName.trim() || tunnelRegistrationStatus.status === 'registering'}
                    style={{
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      cursor: (!tunnelServerName.trim() || tunnelRegistrationStatus.status === 'registering') ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: (!tunnelServerName.trim() || tunnelRegistrationStatus.status === 'registering') ? 0.5 : 1
                    }}
                  >
                    {tunnelRegistrationStatus.status === 'registering' ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        Registering...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faGlobe} />
                        Register
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Access Level Modal */}
      {showAccessLevelModal && editingServer && (
        <div className="access-level-modal-overlay">
          <div className="access-level-modal">
            <div className="access-level-modal-header">
              <h3>Change Access Level</h3>
              <button
                className="access-level-modal-close"
                onClick={() => {
                  setShowAccessLevelModal(false);
                  setEditingServer(null);
                }}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            
            <div className="access-level-modal-content">
              <div className="access-level-current">
                <h4>Current Access Level</h4>
                <div className="access-level-current-info">
                  <FontAwesomeIcon 
                    icon={getAccessLevelIcon(editingServer.accessLevel?.level || 'claude-desktop')} 
                    style={{ color: getAccessLevelColor(editingServer.accessLevel?.level || 'claude-desktop') }}
                  />
                  <span>{getAccessLevelDisplayName(editingServer.accessLevel?.level || 'claude-desktop')}</span>
                </div>
              </div>

              <div className="access-level-options">
                <h4>Select New Access Level</h4>
                <div className="access-level-options-list">
                  <div 
                    className="access-level-option"
                    onClick={() => handleAccessLevelChange('claude-desktop')}
                  >
                    <div className="access-level-option-header">
                      <FontAwesomeIcon icon={faShieldAlt} style={{ color: '#3b82f6' }} />
                      <span className="access-level-option-name">Claude Desktop Only</span>
                      <FontAwesomeIcon icon={faCheck} className="access-level-selected-icon" />
                    </div>
                    <p className="access-level-option-description">
                      Only accessible from Claude Desktop application. Most secure option.
                    </p>
                    <div className="access-level-option-details">
                      <span>Port: 8080</span>
                      <span>Bind: 127.0.0.1</span>
                      <span>Auth: Not required</span>
                    </div>
                  </div>

                  <div 
                    className="access-level-option"
                    onClick={() => handleAccessLevelChange('local-network')}
                  >
                    <div className="access-level-option-header">
                      <FontAwesomeIcon icon={faWifi} style={{ color: '#f59e0b' }} />
                      <span className="access-level-option-name">Local Network</span>
                      <FontAwesomeIcon icon={faCheck} className="access-level-selected-icon" />
                    </div>
                    <p className="access-level-option-description">
                      Accessible from devices on the same WiFi network. Requires authentication.
                    </p>
                    <div className="access-level-option-details">
                      <span>Port: 8081</span>
                      <span>Bind: 0.0.0.0</span>
                      <span>Auth: Required</span>
                    </div>
                  </div>

                  <div 
                    className="access-level-option"
                    onClick={() => handleAccessLevelChange('public')}
                  >
                    <div className="access-level-option-header">
                      <FontAwesomeIcon icon={faPublic} style={{ color: '#ef4444' }} />
                      <span className="access-level-option-name">Public Access</span>
                      <FontAwesomeIcon icon={faCheck} className="access-level-selected-icon" />
                    </div>
                    <p className="access-level-option-description">
                      Accessible from anywhere on the internet. Requires authentication.
                    </p>
                    <div className="access-level-option-details">
                      <span>Port: 8082</span>
                      <span>Bind: 0.0.0.0</span>
                      <span>Auth: Required</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="access-level-warning">
                <FontAwesomeIcon icon={faExclamationCircleIcon} />
                <span>Changing access level will restart the server and may affect active connections.</span>
              </div>
            </div>

            <div className="access-level-modal-footer">
              <button
                className="access-level-modal-cancel"
                onClick={() => {
                  setShowAccessLevelModal(false);
                  setEditingServer(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPServer;