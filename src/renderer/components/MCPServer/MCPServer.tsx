import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faCheck, faArrowRight, faList, faServer } from '../../utils/fontAwesomeIcons';
import GmailConnectorForm from './GmailConnectorForm';
import RunningServers from './RunningServers';
import './MCPServer.css';

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

interface GmailConnection {
  id: string;
  name: string;
  email: string;
  serviceAccountKey: any;
  createdAt: string;
  updatedAt: string;
  type: 'gmail';
}

const MCPServer: React.FC<MCPServerProps> = () => {
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [showGmailTool, setShowGmailTool] = useState<boolean>(false);
  const [showRunningServers, setShowRunningServers] = useState<boolean>(false);
  const [gmailConnections, setGmailConnections] = useState<GmailConnection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState<boolean>(true);

  // Load Gmail connections from store on component mount
  useEffect(() => {
    loadGmailConnections();
  }, []);

  const loadGmailConnections = async () => {
    try {
      setIsLoadingConnections(true);
      const result = await window.electron.mcpConfig.connections.get();
      if (result.success && result.connections) {
        // Filter only Gmail connections
        const gmailConnections = result.connections.filter((conn: any) => conn.type === 'gmail');
        setGmailConnections(gmailConnections);
      }
    } catch (error) {
      console.error('Error loading Gmail connections:', error);
    } finally {
      setIsLoadingConnections(false);
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
    
    // Refresh connections list
    await loadGmailConnections();
    
    setShowGmailTool(false);
    setSelectedTool('');
  };

  const handleBackFromTool = () => {
    setShowGmailTool(false);
    setSelectedTool('');
  };

  const handleBackFromRunningServers = () => {
    setShowRunningServers(false);
  };

  const handleViewRunningServers = () => {
    setShowRunningServers(true);
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

  // Show Running Servers if selected
  if (showRunningServers) {
    return (
      <RunningServers
        onBack={handleBackFromRunningServers}
        onViewDetails={(server) => {
          console.log('View server details:', server);
          // Could implement server details view here
        }}
        onRestart={(serverId) => {
          console.log('Restart server:', serverId);
          // Implement restart logic here
        }}
        onStop={(serverId) => {
          console.log('Stop server:', serverId);
          // Implement stop logic here
        }}
        onStart={(serverId) => {
          console.log('Start server:', serverId);
          // Implement start logic here
        }}
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
          <h1>MCP Server Tools</h1>
          <p>Connect to external services through Model Context Protocol for enhanced AI-powered blogging workflows</p>
          <div className="hero-actions">
            <button 
              className="hero-action-btn"
              onClick={handleViewRunningServers}
            >
              <FontAwesomeIcon icon={faServer} />
              <span>Manage MCP Servers</span>
            </button>
          </div>
        </div>
        
        <div className="hero-visual">
          <div className="floating-cards">
            <div className="floating-card card-1">
              <FontAwesomeIcon icon={faEnvelope} />
            </div>
            <div className="floating-card card-2">
              <FontAwesomeIcon icon={faEnvelope} />
            </div>
            <div className="floating-card card-3">
              <FontAwesomeIcon icon={faEnvelope} />
            </div>
          </div>
        </div>
      </div>

      {/* Platform Selection */}
      <div className="platforms-section">
        <div className="section-header">
          <h2>Available MCP Tools</h2>
          <p>Select a tool to integrate with your EG Blogging workflow</p>
        </div>
        
        <div className="platforms-grid">
          {mcpTools.map((tool) => (
            <div
              key={tool.id}
              className={`platform-card ${selectedTool === tool.id ? 'selected' : ''} ${
                !tool.isAvailable ? 'disabled' : ''
              }`}
              onClick={() => tool.isAvailable && handleToolSelect(tool.id)}
            >
              <div className="card-header">
                <div className="platform-status">
                  {tool.status === 'available' && (
                    <span className="status-badge available">
                      <FontAwesomeIcon icon={faCheck} />
                      Available
                    </span>
                  )}
                  {tool.status === 'beta' && (
                    <span className="status-badge beta">Beta</span>
                  )}
                  {tool.status === 'coming-soon' && (
                    <span className="status-badge coming-soon">Coming Soon</span>
                  )}
                </div>
              </div>
              
              <div className="platform-info">
                <div className="platform-icon" style={{ background: tool.gradient }}>
                  <FontAwesomeIcon icon={tool.icon} />
                </div>
                <h3>{tool.name}</h3>
                {tool.description && <p>{tool.description}</p>}
                
                {tool.features.length > 0 && (
                  <div className="platform-features">
                    {tool.features.map((feature, index) => (
                      <div key={index} className="feature-item">
                        <FontAwesomeIcon icon={faCheck} />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Show existing Gmail connections */}
                {tool.id === 'gmail' && gmailConnections.length > 0 && (
                  <div className="existing-connections">
                    <h4>Connected Accounts ({gmailConnections.length})</h4>
                    <div className="connections-list">
                      {gmailConnections.map((connection) => (
                        <div key={connection.id} className="connection-item">
                          <div className="connection-info">
                            <div className="connection-email">{connection.email}</div>
                            <div className="connection-name">{connection.name}</div>
                            <div className="connection-date">
                              Connected {new Date(connection.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedTool === tool.id && (
                <div className="selected-indicator">
                  <FontAwesomeIcon icon={faCheck} />
                </div>
              )}

            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MCPServer;