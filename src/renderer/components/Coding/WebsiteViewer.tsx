import React, { useEffect, useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faSpinner } from '@fortawesome/free-solid-svg-icons';
import './WebsiteViewer.css';

const WebsiteViewer: React.FC = () => {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Check for dev server URL in localStorage
    const checkForServer = () => {
      const url = localStorage.getItem('dev-server-url');
      if (url) {
        console.log('Found dev server URL:', url);
        setServerUrl(url);
        setLoading(false);
      } else {
        // Keep checking every second
        setTimeout(checkForServer, 1000);
      }
    };

    checkForServer();
  }, []);

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      console.log('🔄 WebsiteViewer: Received refresh event');
      // Force iframe reload by updating key
      setRefreshKey(prev => prev + 1);
    };

    const electron = (window as any).electron;
    if (electron?.ipcRenderer) {
      // Listen for refresh events
      const unsubscribe = electron.ipcRenderer.on('website-viewer:refresh', handleRefresh);
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, []);

  if (loading && !serverUrl) {
    return (
      <div className="website-viewer-container">
        <div className="website-viewer-empty-state">
          <FontAwesomeIcon icon={faSpinner} className="website-viewer-empty-icon spinning" />
          <h2>Waiting for Dev Server</h2>
          <p className="website-viewer-empty-message">Starting your development server...</p>
        </div>
      </div>
    );
  }

  if (!serverUrl) {
    return (
      <div className="website-viewer-container">
        <div className="website-viewer-empty-state">
          <FontAwesomeIcon icon={faGlobe} className="website-viewer-empty-icon" />
          <h2>Website Preview</h2>
          <p className="website-viewer-empty-message">Your website will appear here</p>
          <p className="website-viewer-empty-hint">Select a project folder to see live preview</p>
        </div>
      </div>
    );
  }

  return (
    <div className="website-viewer-container">
      <iframe
        key={refreshKey}
        ref={iframeRef}
        src={serverUrl}
        className="website-viewer-iframe"
        title="Website Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
};

export default WebsiteViewer;
