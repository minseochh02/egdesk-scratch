import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GmailConnectorForm from '../MCPServer/GmailConnectorForm';
import GmailDashboard from '../MCPServer/GmailDashboard';

interface GmailConnection {
  id: string;
  name: string;
  email: string;
  mode?: 'workspace' | 'personal';
  adminEmail?: string;
  serviceAccountKey?: any;
  createdAt: string;
  updatedAt: string;
  type: 'gmail';
  status: 'online' | 'offline' | 'error' | 'checking';
}

const GmailPage: React.FC = () => {
  const navigate = useNavigate();
  const [connection, setConnection] = useState<GmailConnection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedConnection();
  }, []);

  const loadSavedConnection = async () => {
    try {
      const result = await window.electron.mcpConfig.connections.get();
      if (result.success && result.connections) {
        const gmailConn = result.connections.find((c: any) => c.type === 'gmail');
        if (gmailConn) {
          setConnection({ ...gmailConn, status: 'online' });
        }
      }
    } catch (err) {
      console.error('Failed to load Gmail connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (connectionData: any) => {
    setConnection({ ...connectionData, status: 'online' });
  };

  const handleDisconnect = () => {
    setConnection(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#ccc' }}>
        Loading...
      </div>
    );
  }

  if (connection) {
    return (
      <GmailDashboard
        connection={connection}
        onBack={handleDisconnect}
      />
    );
  }

  return (
    <GmailConnectorForm
      onBack={() => navigate('/')}
      onConnect={handleConnect}
    />
  );
};

export default GmailPage;
