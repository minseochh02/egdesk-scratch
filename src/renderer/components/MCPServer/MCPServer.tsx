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
  const [selectedServer, setSelectedServer] = useState<RunningMCPServer | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [showDashboard, setShowDashboard] = useState<boolean>(false);
  const [showAccessLevelModal, setShowAccessLevelModal] = useState<boolean>(false);
  const [editingServer, setEditingServer] = useState<RunningMCPServer | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
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
            port: 8081,
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
              port: 8081,
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

  // Load servers on mount
  useEffect(() => {
    loadRunningServers();
  }, [loadRunningServers]);

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

  // Check Claude Desktop status on mount
  useEffect(() => {
    checkClaudeDesktopStatus();
    loadHttpServerStatus();
    loadMCPServers();
    loadSupabaseConfig();
  }, []);

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

  const handleStartLocalhost = async () => {
    try {
      console.log('🚀 Starting local network server...');
      
      // Start HTTP server (no SSL needed for local network!)
      console.log('🌐 Starting HTTP server on local network...');
      const serverResult = await window.electron.httpsServer.start({
        port: 8080,
        useHTTPS: false  // Use HTTP for local network
      });

      if (serverResult.success) {
        // Get the local IP address for network access from main process
        const networkInfo = await window.electron.httpsServer.getNetworkInfo();
        const localIP = networkInfo.localIP || 'localhost';
        const protocol = serverResult.protocol || 'http';

        alert(`✅ ${protocol.toUpperCase()} server started successfully!\n\nLocal URL: ${protocol}://localhost:${serverResult.port}\nNetwork URL: ${protocol}://${localIP}:${serverResult.port}\n\n✨ No SSL certificate needed!\n📱 Works perfectly with mobile apps and API calls\n🌐 All devices on your network can connect without any warnings`);
        console.log(`🌐 ${protocol.toUpperCase()} Server running on:`, `${protocol}://localhost:${serverResult.port}`);
        console.log('🌐 Network accessible at:', `${protocol}://${localIP}:${serverResult.port}`);
        
        // Refresh the servers list to show the new server
        await loadRunningServers(true);
      } else {
        alert(`Failed to start server: ${serverResult.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error starting localhost server:', err);
      alert(`Error starting localhost server: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDebugTunnelRegistration = async () => {
    try {
      // Generate a test server name
      const testServerName = `test-server-${Date.now()}`;
      const testPassword = 'test123';
      
      console.log(`🧪 [DEBUG] Testing tunnel registration...`);
      console.log(`🧪 [DEBUG] Server name: ${testServerName}`);
      console.log(`🧪 [DEBUG] Password: ${testPassword}`);
      
      const result = await window.electron.invoke('mcp-tunnel-register', testServerName, testPassword) as {
        success: boolean;
        status?: 'registered' | 'name_taken' | 'error';
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
      };
      
      console.log(`🧪 [DEBUG] Registration result:`, result);
      
      if (result.success && result.status === 'registered') {
        alert(`✅ DEBUG: Tunnel registered successfully!\n\nServer Name: ${result.name}\nIP Address: ${result.ip}\nTimestamp: ${result.timestamp}\nID: ${result.id}\n\nCheck console for full details.`);
      } else if (result.status === 'name_taken') {
        alert(`⚠️ DEBUG: Name already taken!\n\nExisting Registration:\nName: ${result.existing_record?.name}\nIP: ${result.existing_record?.ip}\nRegistered: ${result.existing_record?.registered_at}\n\nCheck console for full details.`);
      } else {
        alert(`❌ DEBUG: Registration failed!\n\nStatus: ${result.status}\nMessage: ${result.message || 'Unknown error'}\n\nCheck console for full details.`);
      }
    } catch (error) {
      console.error('🧪 [DEBUG] Tunnel registration error:', error);
      alert(`❌ DEBUG: Exception occurred!\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck console for full details.`);
    }
  };

  const handleStartTunnel = async (server: RunningMCPServer) => {
    try {
      console.log(`🚀 Starting tunnel for: ${server.name}`);
      
      // Generate tunnel server name (lowercase, no spaces)
      const tunnelServerName = server.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      // Register server name first
      const registerResult = await window.electron.mcp.registerTunnel(tunnelServerName);
      
      if (!registerResult.success && registerResult.status !== 'name_taken') {
        alert(`❌ Failed to register tunnel: ${registerResult.message}`);
        return;
      }
      
      // Start the WebSocket tunnel
      const result = await window.electron.tunnel.start(tunnelServerName, `http://localhost:${server.port}`);
      
      if (result.success) {
        alert(`✅ Tunnel started successfully!\n\nServer: ${server.name}\nTunnel Name: ${tunnelServerName}\nLocal Port: ${server.port}\n\nYour server is now accessible through the public URL.`);
        
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
      
      // Generate tunnel server name (lowercase, no spaces)
      const tunnelServerName = server.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      // Stop the WebSocket tunnel
      const result = await window.electron.tunnel.stop(tunnelServerName);
      
      if (result.success) {
        alert(`✅ Tunnel stopped successfully!\n\nServer: ${server.name}\nTunnel Name: ${tunnelServerName}`);
        
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
            <button 
              className="hero-action-btn"
              onClick={() => loadRunningServers(true)}
            >
              <FontAwesomeIcon icon={faRefresh} />
              <span>Refresh Servers</span>
            </button>
            <button 
              className="hero-action-btn"
              onClick={handleStartLocalhost}
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              title="Start HTTPS server accessible from your local network (same WiFi)"
            >
              <FontAwesomeIcon icon={faServer} />
              <span>Start Local Network Server</span>
            </button>
            <button 
              className="hero-action-btn"
              onClick={handleDebugTunnelRegistration}
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
              title="Test tunnel registration with Supabase"
            >
              <FontAwesomeIcon icon={faTerminal} />
              <span>🧪 Debug Tunnel</span>
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

      {/* Supabase Configuration Section */}
      <div className="supabase-config-section" style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
        borderRadius: '16px',
        padding: '24px',
        margin: '24px 0',
        border: '1px solid rgba(16, 185, 129, 0.2)'
      }}>
        <div className="section-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FontAwesomeIcon icon={faGlobe} />
            Supabase Tunnel Configuration
          </h2>
          <p>Configuration for public MCP server tunneling via Supabase</p>
        </div>

        <div style={{ marginTop: '24px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {supabaseConfig.isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#f59e0b' }}>
                <FontAwesomeIcon icon={faSpinner} spin />
                <span>Loading Supabase configuration...</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Supabase URL */}
                  <div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      marginBottom: '8px',
                      opacity: 0.7
                    }}>
                      Supabase URL
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px',
                      padding: '12px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '14px'
                    }}>
                      {supabaseConfig.supabaseUrl ? (
                        <>
                          <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10b981' }} />
                          <span style={{ flex: 1, wordBreak: 'break-all' }}>
                            {supabaseConfig.supabaseUrl}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(supabaseConfig.supabaseUrl || '');
                              alert('Supabase URL copied to clipboard!');
                            }}
                            style={{
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                          </button>
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faCircleXmark} style={{ color: '#ef4444' }} />
                          <span style={{ opacity: 0.5 }}>Not configured</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Anon Key */}
                  <div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      marginBottom: '8px',
                      opacity: 0.7
                    }}>
                      Supabase Anon Key
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '12px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {supabaseConfig.hasSupabaseKey ? (
                          <>
                            <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10b981', fontSize: '20px' }} />
                            <span style={{ fontWeight: '600' }}>Configured</span>
                            <span style={{ 
                              marginLeft: 'auto',
                              padding: '4px 12px',
                              background: 'rgba(16, 185, 129, 0.2)',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#10b981'
                            }}>
                              ✓ Ready
                            </span>
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faCircleXmark} style={{ color: '#ef4444', fontSize: '20px' }} />
                            <span style={{ fontWeight: '600' }}>Not configured</span>
                            <span style={{ 
                              marginLeft: 'auto',
                              padding: '4px 12px',
                              background: 'rgba(239, 68, 68, 0.2)',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#ef4444'
                            }}>
                              ⚠ Optional
                            </span>
                          </>
                        )}
                      </div>
                      
                      {/* Show anon key value if configured */}
                      {supabaseConfig.supabaseAnonKey && (
                        <div style={{ 
                          marginTop: '8px',
                          padding: '10px 12px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          wordBreak: 'break-all',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <FontAwesomeIcon 
                            icon={faLock} 
                            style={{ color: '#10b981', flexShrink: 0 }} 
                          />
                          <span style={{ flex: 1, userSelect: 'all' }}>
                            {showAnonKey 
                              ? supabaseConfig.supabaseAnonKey 
                              : '•'.repeat(Math.min(supabaseConfig.supabaseAnonKey.length, 50))
                            }
                          </span>
                          <button
                            onClick={() => setShowAnonKey(!showAnonKey)}
                            style={{
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '11px',
                              flexShrink: 0
                            }}
                            title={showAnonKey ? 'Hide key' : 'Show key'}
                          >
                            {showAnonKey ? '👁️ Hide' : '👁️ Show'}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(supabaseConfig.supabaseAnonKey || '');
                              alert('Anon key copied to clipboard!');
                            }}
                            style={{
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '11px',
                              flexShrink: 0
                            }}
                            title="Copy to clipboard"
                          >
                            <FontAwesomeIcon icon={faCopy} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tunnel Endpoints */}
                  {supabaseConfig.supabaseUrl && (
                    <div>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600', 
                        marginBottom: '8px',
                        opacity: 0.7
                      }}>
                        Tunnel Endpoints
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        {/* Register Endpoint */}
                        <div style={{ 
                          padding: '10px 12px',
                          background: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: '8px',
                          fontSize: '13px'
                        }}>
                          <div style={{ opacity: 0.6, marginBottom: '4px', fontSize: '11px' }}>
                            Registration Endpoint:
                          </div>
                          <div style={{ 
                            fontFamily: 'monospace',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span style={{ flex: 1, wordBreak: 'break-all' }}>
                              {supabaseConfig.supabaseUrl}/functions/v1/register?name=YOUR_NAME
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${supabaseConfig.supabaseUrl}/functions/v1/register?name=YOUR_NAME`);
                                alert('Registration endpoint copied to clipboard!');
                              }}
                              style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '11px'
                              }}
                            >
                              <FontAwesomeIcon icon={faCopy} />
                            </button>
                          </div>
                        </div>

                        {/* Lookup Endpoint */}
                        <div style={{ 
                          padding: '10px 12px',
                          background: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: '8px',
                          fontSize: '13px'
                        }}>
                          <div style={{ opacity: 0.6, marginBottom: '4px', fontSize: '11px' }}>
                            Lookup Endpoint:
                          </div>
                          <div style={{ 
                            fontFamily: 'monospace',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span style={{ flex: 1, wordBreak: 'break-all' }}>
                              {supabaseConfig.supabaseUrl}/functions/v1/r?name=YOUR_NAME
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${supabaseConfig.supabaseUrl}/functions/v1/r?name=YOUR_NAME`);
                                alert('Lookup endpoint copied to clipboard!');
                              }}
                              style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '11px'
                              }}
                            >
                              <FontAwesomeIcon icon={faCopy} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {!supabaseConfig.supabaseUrl && (
                  <div style={{ 
                    marginTop: '16px',
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '13px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: '#ef4444' }} />
                      <strong>Supabase Not Configured</strong>
                    </div>
                    <div style={{ opacity: 0.9 }}>
                      Add SUPABASE_URL to your .env file to enable tunnel registration.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* HTTP Server Control Section */}
      <div className="http-server-control-section" style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
        borderRadius: '16px',
        padding: '24px',
        margin: '24px 0',
        border: '1px solid rgba(59, 130, 246, 0.2)'
      }}>
        <div className="section-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FontAwesomeIcon icon={faServer} />
            HTTP Server Control
          </h2>
          <p>Manage your MCP HTTP server and enabled services</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
          {/* HTTP Server Status */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FontAwesomeIcon icon={faGlobe} />
              Server Status
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <FontAwesomeIcon 
                  icon={httpServerStatus.isRunning ? faCircleCheck : faCircleXmark}
                  style={{ color: httpServerStatus.isRunning ? '#10b981' : '#6b7280', fontSize: '20px' }}
                />
                <span style={{ fontSize: '18px', fontWeight: '600' }}>
                  {httpServerStatus.isLoading ? 'Checking...' : httpServerStatus.isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
              {httpServerStatus.isRunning && httpServerStatus.port && (
                <div style={{ marginLeft: '32px', opacity: 0.8 }}>
                  <div>Port: {httpServerStatus.port}</div>
                  <div>Local: http://localhost:{httpServerStatus.port}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {httpServerStatus.isRunning ? (
                <button
                  onClick={handleStopHttpServer}
                  disabled={httpServerStatus.isLoading}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    cursor: httpServerStatus.isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: httpServerStatus.isLoading ? 0.5 : 1
                  }}
                >
                  <FontAwesomeIcon icon={faStop} />
                  Stop Server
                </button>
              ) : (
                <button
                  onClick={handleStartHttpServer}
                  disabled={httpServerStatus.isLoading}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    cursor: httpServerStatus.isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: httpServerStatus.isLoading ? 0.5 : 1
                  }}
                >
                  <FontAwesomeIcon icon={faPlay} />
                  Start Server
                </button>
              )}
              <button
                onClick={loadHttpServerStatus}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FontAwesomeIcon icon={faRefresh} />
              </button>
            </div>
          </div>

          {/* MCP Servers Configuration */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FontAwesomeIcon icon={faCog} />
              MCP Services
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mcpServers.map(server => (
                <div key={server.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>{server.name}</div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>{server.description}</div>
                  </div>
                  <button
                    onClick={() => server.enabled ? handleDisableMCPServer(server.name) : handleEnableMCPServer(server.name)}
                    style={{
                      background: server.enabled 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      border: server.enabled ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      minWidth: '100px',
                      justifyContent: 'center'
                    }}
                  >
                    <FontAwesomeIcon icon={server.enabled ? faCheck : faPlay} />
                    {server.enabled ? 'Enabled' : 'Enable'}
                  </button>
                </div>
              ))}
              {mcpServers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>
                  No MCP services configured
                </div>
              )}
            </div>
          </div>
        </div>

        {httpServerStatus.isRunning && mcpServers.some(s => s.enabled) && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ color: '#10b981' }} />
              <strong>MCP Server Ready!</strong>
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Enabled services: {mcpServers.filter(s => s.enabled).map(s => s.name).join(', ')}
              <br />
              View documentation at: http://localhost:{httpServerStatus.port}/
            </div>
          </div>
        )}
      </div>

      {/* Running Servers Section */}
      <div className="running-servers-section">
        <div className="section-header">
          <h2>Running MCP Servers</h2>
          <p>Monitor and manage your active MCP server connections</p>
        </div>

        {loading && (
          <div className="loading-state">
            <FontAwesomeIcon icon={faSpinner} spin />
            <span>Loading servers...</span>
          </div>
        )}

        {error && (
          <div className="error-state">
            <FontAwesomeIcon icon={faTriangleExclamation} />
            <span>{error}</span>
            <button onClick={() => loadRunningServers(true)}>Retry</button>
          </div>
        )}

        {!loading && !error && (
          <div className="running-servers-grid">
            {servers.filter(server => server && server.id).map((server) => (
              <div key={server.id} className="running-servers-card">
                <div className="running-servers-card-header">
                  <div className="mcp-server-info-container">
                    <div className={`mcp-server-icon-box ${server.type === 'gmail' ? 'gmail-icon-box' : ''}`}>
                      <FontAwesomeIcon icon={server.type === 'gmail' ? faEnvelope : faServer} />
                    </div>
                    <div className="mcp-server-text-details">
                      <div className="mcp-server-name-container">
                        {editingServerName === server.id ? (
                          <div className="mcp-server-name-edit">
                            <input
                              type="text"
                              value={editingServerNameValue}
                              onChange={(e) => setEditingServerNameValue(e.target.value)}
                              className="mcp-server-name-input"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveServerName(server.id);
                                } else if (e.key === 'Escape') {
                                  handleCancelEditServerName();
                                }
                              }}
                            />
                            <div className="mcp-server-name-edit-buttons">
                              <button
                                className="mcp-server-name-save-btn"
                                onClick={() => handleSaveServerName(server.id)}
                                title="Save"
                              >
                                <FontAwesomeIcon icon={faCheck} />
                              </button>
                              <button
                                className="mcp-server-name-cancel-btn"
                                onClick={handleCancelEditServerName}
                                title="Cancel"
                              >
                                <FontAwesomeIcon icon={faTimes} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mcp-server-name-display">
                            <h3 className="mcp-server-name">{server.name}</h3>
                            <button
                              className="mcp-server-name-edit-btn"
                              onClick={() => handleEditServerName(server)}
                              title="Edit server name"
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="mcp-server-description">{server.description}</p>
                      <div className="mcp-server-meta">
                        <span className="mcp-server-type">{server.type}</span>
                        <span className="mcp-server-version">v{server.version}</span>
                      </div>
                    </div>
                  </div>
                  <div className="running-servers-status">
                    <FontAwesomeIcon 
                      icon={getStatusIcon(server.status)} 
                      style={{ color: getStatusColor(server.status) }}
                    />
                    <span style={{ color: getStatusColor(server.status) }}>
                      {server.status.charAt(0).toUpperCase() + server.status.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="running-servers-card-metrics">
                  <div className="running-servers-metric">
                    <FontAwesomeIcon icon={faClock} />
                    <span className="running-servers-metric-label">Uptime:</span>
                    <span className="running-servers-metric-value">{formatUptime(server.uptime)}</span>
                  </div>
                  <div className="running-servers-metric running-servers-access-metric">
                    <div className="running-servers-access-info">
                      <FontAwesomeIcon 
                        icon={getAccessLevelIcon(server.accessLevel?.level || 'claude-desktop')} 
                        style={{ color: getAccessLevelColor(server.accessLevel?.level || 'claude-desktop') }}
                      />
                      <span className="running-servers-metric-label">Access:</span>
                      <span 
                        className="running-servers-metric-value"
                        style={{ color: getAccessLevelColor(server.accessLevel?.level || 'claude-desktop') }}
                      >
                        {getAccessLevelDisplayName(server.accessLevel?.level || 'claude-desktop')}
                      </span>
                    </div>
                    <button
                      className="running-servers-access-edit-btn"
                      onClick={() => handleEditAccessLevel(server)}
                      title="Change Access Level"
                    >
                      <FontAwesomeIcon icon={faShieldAlt} />
                    </button>
                  </div>
                </div>

                {/* Show MCP configuration for claude-desktop and local-network modes */}
                {(server.accessLevel?.level === 'claude-desktop' || server.accessLevel?.level === 'local-network') && (
                  <div className="running-servers-card-schema">
                    <div className="running-servers-schema-header">
                      <span className="running-servers-schema-label">MCP Schema:</span>
                      <div className="running-servers-schema-status">
                        {claudeDesktopStatus.isLoading ? (
                          <span className="running-servers-status-loading">
                            <FontAwesomeIcon icon={faSpinner} spin />
                            Checking...
                          </span>
                        ) : claudeDesktopStatus.error ? (
                          <span className="running-servers-status-error">
                            <FontAwesomeIcon icon={faTriangleExclamation} />
                            Error
                          </span>
                        ) : claudeDesktopStatus.isConfigured ? (
                          <span className="running-servers-status-configured">
                            <FontAwesomeIcon icon={faCircleCheck} />
                            In Claude Desktop
                          </span>
                        ) : (
                          <span className="running-servers-status-not-configured">
                            <FontAwesomeIcon icon={faCircleXmark} />
                            Not in Claude Desktop
                          </span>
                        )}
                      </div>
                      <div className="running-servers-schema-buttons">
                        <button 
                          className="running-servers-schema-copy-btn"
                          onClick={() => handleCopySchema(server)}
                          title="Copy MCP schema to clipboard"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                          Copy
                        </button>
                        {claudeDesktopStatus.isConfigured ? (
                          <button 
                            className="running-servers-schema-remove-btn"
                            onClick={() => handleUnconfigureClaudeDesktop(server)}
                            title="Remove from Claude Desktop app"
                          >
                            <FontAwesomeIcon icon={faTimes} />
                            Remove from Claude Desktop
                          </button>
                        ) : (
                          <button 
                            className="running-servers-schema-configure-btn"
                            onClick={() => handleConfigureClaudeDesktop(server)}
                            title="Add to Claude Desktop app"
                          >
                            <FontAwesomeIcon icon={faServer} />
                            Add to Claude Desktop
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="running-servers-schema-code">
                      <code>{generateMCPSchema(server)}</code>
                    </div>
                  </div>
                )}

                {/* Show additional network MCP configuration for local-network mode */}
                {server.accessLevel?.level === 'local-network' && (
                  <div className="running-servers-card-schema">
                    <div className="running-servers-schema-header">
                      <span className="running-servers-schema-label">Network MCP Configuration:</span>
                      <div className="running-servers-schema-status">
                        <span className="running-servers-status-configured">
                          <FontAwesomeIcon icon={faWifi} />
                          Network Access
                        </span>
                      </div>
                      <div className="running-servers-schema-buttons">
                        <button 
                          className="running-servers-schema-copy-btn"
                          onClick={() => handleCopyNetworkSchema(server)}
                          title="Copy network MCP configuration to clipboard"
                        >
                          <FontAwesomeIcon icon={faCopy} />
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="running-servers-schema-code">
                      <code>{generateNetworkMCPSchema(server)}</code>
                    </div>
                  </div>
                )}

                {/* Show all three MCP configurations for public mode */}
                {server.accessLevel?.level === 'public' && (
                  <>
                    {/* 1. Claude Desktop MCP Configuration */}
                    <div className="running-servers-card-schema">
                      <div className="running-servers-schema-header">
                        <span className="running-servers-schema-label">Claude Desktop MCP:</span>
                        <div className="running-servers-schema-status">
                          {claudeDesktopStatus.isLoading ? (
                            <span className="running-servers-status-loading">
                              <FontAwesomeIcon icon={faSpinner} spin />
                              Checking...
                            </span>
                          ) : claudeDesktopStatus.error ? (
                            <span className="running-servers-status-error">
                              <FontAwesomeIcon icon={faTriangleExclamation} />
                              Error
                            </span>
                          ) : claudeDesktopStatus.isConfigured ? (
                            <span className="running-servers-status-configured">
                              <FontAwesomeIcon icon={faCircleCheck} />
                              In Claude Desktop
                            </span>
                          ) : (
                            <span className="running-servers-status-not-configured">
                              <FontAwesomeIcon icon={faCircleXmark} />
                              Not in Claude Desktop
                            </span>
                          )}
                        </div>
                        <div className="running-servers-schema-buttons">
                          <button 
                            className="running-servers-schema-copy-btn"
                            onClick={() => handleCopySchema(server)}
                            title="Copy MCP schema to clipboard"
                          >
                            <FontAwesomeIcon icon={faCopy} />
                            Copy
                          </button>
                          {claudeDesktopStatus.isConfigured ? (
                            <button 
                              className="running-servers-schema-remove-btn"
                              onClick={() => handleUnconfigureClaudeDesktop(server)}
                              title="Remove from Claude Desktop app"
                            >
                              <FontAwesomeIcon icon={faTimes} />
                              Remove from Claude Desktop
                            </button>
                          ) : (
                            <button 
                              className="running-servers-schema-configure-btn"
                              onClick={() => handleConfigureClaudeDesktop(server)}
                              title="Add to Claude Desktop app"
                            >
                              <FontAwesomeIcon icon={faServer} />
                              Add to Claude Desktop
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="running-servers-schema-code">
                        <code>{generateMCPSchema(server)}</code>
                      </div>
                    </div>

                    {/* 2. Local Network MCP Configuration */}
                    <div className="running-servers-card-schema">
                      <div className="running-servers-schema-header">
                        <span className="running-servers-schema-label">Local Network MCP:</span>
                        <div className="running-servers-schema-status">
                          <span className="running-servers-status-configured">
                            <FontAwesomeIcon icon={faWifi} />
                            Network Access
                          </span>
                        </div>
                        <div className="running-servers-schema-buttons">
                          <button 
                            className="running-servers-schema-copy-btn"
                            onClick={() => handleCopyNetworkSchema(server)}
                            title="Copy network MCP configuration to clipboard"
                          >
                            <FontAwesomeIcon icon={faCopy} />
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className="running-servers-schema-code">
                        <code>{generateNetworkMCPSchema(server)}</code>
                      </div>
                    </div>

                    {/* 3. Public Tunnel MCP Configuration */}
                    <div className="running-servers-card-schema">
                      <div className="running-servers-schema-header">
                        <span className="running-servers-schema-label">Public Tunnel MCP:</span>
                        <div className="running-servers-schema-status">
                          <span className="running-servers-status-configured" style={{ color: '#f59e0b' }}>
                            <FontAwesomeIcon icon={faPublic} />
                            Tunnel Required
                          </span>
                        </div>
                        <div className="running-servers-schema-buttons">
                          <button 
                            className="running-servers-schema-copy-btn"
                            onClick={() => handleCopyPublicSchema(server)}
                            title="Copy public MCP configuration to clipboard"
                          >
                            <FontAwesomeIcon icon={faCopy} />
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className="running-servers-schema-code">
                        <code>{generatePublicMCPSchema(server)}</code>
                      </div>
                      {supabaseConfig.supabaseUrl ? (
                        <div style={{ 
                          marginTop: '8px', 
                          padding: '8px 12px', 
                          background: 'rgba(16, 185, 129, 0.1)', 
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#10b981'
                        }}>
                          <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: '6px' }} />
                          Tunnel URL configured: {supabaseConfig.supabaseUrl}/functions/v1/r?name={server.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}
                          {supabaseConfig.hasSupabaseKey && (
                            <div style={{ marginTop: '4px', fontSize: '11px', opacity: 0.8 }}>
                              ⚠️ Remember to set SUPABASE_ANON_KEY environment variable
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ 
                          marginTop: '8px', 
                          padding: '8px 12px', 
                          background: 'rgba(245, 158, 11, 0.1)', 
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: '#f59e0b'
                        }}>
                          <FontAwesomeIcon icon={faExclamationCircleIcon} style={{ marginRight: '6px' }} />
                          Configure SUPABASE_URL in your .env file to enable tunnel routing
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div className="running-servers-card-actions">
                  {server.type === 'gmail' && (
                    <button
                      className="running-servers-action-btn running-servers-dashboard-btn"
                      onClick={() => handleViewDashboard(server)}
                      title="View Gmail dashboard"
                    >
                      <FontAwesomeIcon icon={faChartBar} />
                      Dashboard
                    </button>
                  )}
                  <button
                    className="running-servers-action-btn"
                    onClick={() => handleStartTunnel(server)}
                    title="Start WebSocket tunnel for public access"
                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                  >
                    <FontAwesomeIcon icon={faPublic} />
                    Start Tunnel
                  </button>
                  <button
                    className="running-servers-action-btn"
                    onClick={() => handleStopTunnel(server)}
                    title="Stop WebSocket tunnel"
                    style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
                  >
                    <FontAwesomeIcon icon={faStop} />
                    Stop Tunnel
                  </button>
                  <button
                    className="running-servers-action-btn running-servers-logs-btn"
                    onClick={() => handleViewLogs(server)}
                    title="View logs"
                  >
                    <FontAwesomeIcon icon={faTerminal} />
                    Logs
                  </button>
                  {server.status === 'running' ? (
                    <>
                      <button
                        className="running-servers-action-btn running-servers-restart-btn"
                        onClick={() => handleServerAction(server.id, 'restart')}
                        title="Restart server"
                      >
                        <FontAwesomeIcon icon={faRefresh} />
                        Restart
                      </button>
                      <button
                        className="running-servers-action-btn running-servers-stop-btn"
                        onClick={() => handleServerAction(server.id, 'stop')}
                        title="Stop server"
                      >
                        <FontAwesomeIcon icon={faStop} />
                        Stop
                      </button>
                    </>
                  ) : (
                    <button
                      className="running-servers-action-btn running-servers-start-btn"
                      onClick={() => handleServerAction(server.id, 'start')}
                      title="Start server"
                    >
                      <FontAwesomeIcon icon={faPlay} />
                      Start
                    </button>
                  )}
                  <button
                    className="running-servers-action-btn running-servers-delete-btn"
                    onClick={() => handleDeleteServer(server.id)}
                    title="Delete server"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


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