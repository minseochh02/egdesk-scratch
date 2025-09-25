import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRocket, faArrowLeft, faArrowRight, faWordpress } from '../../utils/fontAwesomeIcons';
import BlogConnector from './BlogConnector';
import ConnectionList from './ConnectionList';
import ConnectionDashboard from './ConnectionDashboard';
import tistoryIcon from '../../../../assets/tistory.svg';
import naverblogIcon from '../../../../assets/naverblog.svg';
import './EGBlogging.css';

interface WordPressConnection {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
  type: 'wordpress';
}

interface NaverConnection {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
  type: 'naver';
}

interface TistoryConnection {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
  type: 'tistory';
}

type BlogConnection = WordPressConnection | NaverConnection | TistoryConnection;

type ViewMode = 'platform-selection' | 'connection-list' | 'connection-dashboard';

const EGBlogging: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('platform-selection');
  const [editingConnection, setEditingConnection] = useState<BlogConnection | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<BlogConnection | null>(null);

  const handleShowConnectionList = () => {
    setCurrentView('connection-list');
  };

  const handleBackFromConnectionList = () => {
    setCurrentView('platform-selection');
  };

  const handleViewConnection = (connection: BlogConnection) => {
    setSelectedConnection(connection);
    setCurrentView('connection-dashboard');
  };

  const handleBackFromDashboard = () => {
    setSelectedConnection(null);
    setCurrentView('connection-list');
  };

  const handleTestConnection = async (connection: BlogConnection) => {
    console.log('Testing connection:', connection.name);
    // TODO: Implement actual connection testing
    alert(`Testing connection to ${connection.name}...`);
  };

  const handleRefreshDashboard = () => {
    // TODO: Implement dashboard refresh logic
    console.log('Refreshing dashboard...');
  };

  const handleEditConnection = (connection: BlogConnection) => {
    setEditingConnection(connection);
    // This will be handled by BlogConnector
  };

  const handleDeleteConnection = (connectionId: string) => {
    console.log('Delete connection:', connectionId);
    // The ConnectionList component handles the actual deletion
  };


  // Render connection dashboard
  if (currentView === 'connection-dashboard' && selectedConnection) {
    return (
      <div className="eg-blogging connection-dashboard-view">
        <ConnectionDashboard
          connection={selectedConnection}
          onEdit={handleEditConnection}
          onDelete={handleDeleteConnection}
          onTestConnection={handleTestConnection}
          onRefresh={handleRefreshDashboard}
          onBack={handleBackFromDashboard}
        />
      </div>
    );
  }

  // Render connection list
  if (currentView === 'connection-list') {
    return (
      <div className="eg-blogging connection-list-view">
        <ConnectionList
          onEdit={() => {}}
          onDelete={() => {}}
          onConnect={handleViewConnection}
          onView={handleViewConnection}
          onBack={handleBackFromConnectionList}
        />
      </div>
    );
  }


  // Render platform selection (default view)
  return (
    <div className="eg-blogging">
      {/* Hero Section */}
      <div className="blogging-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <FontAwesomeIcon icon={faRocket} />
            <span>EG Blogging</span>
          </div>
          <h1>Connect Your Blog Platform</h1>
          <p>Seamlessly integrate with your favorite blogging platform and unlock powerful automation features</p>
          <div className="hero-actions">
            <button className="view-connections-btn" onClick={handleShowConnectionList}>
              <FontAwesomeIcon icon={faArrowRight} />
              <span>See my blogs</span>
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="floating-cards">
            <div className="floating-card card-1">
              <FontAwesomeIcon icon={faWordpress} />
            </div>
            <div className="floating-card card-2">
              <img src={naverblogIcon} alt="Naver Blog" style={{ width: '24px', height: '24px' }} />
            </div>
            <div className="floating-card card-3">
              <img src={tistoryIcon} alt="Tistory" style={{ width: '24px', height: '24px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Platform Selection - Use BlogConnector with navigation handlers */}
      <BlogConnector 
        onShowConnectionList={handleShowConnectionList}
      />
    </div>
  );
};

export default EGBlogging;
