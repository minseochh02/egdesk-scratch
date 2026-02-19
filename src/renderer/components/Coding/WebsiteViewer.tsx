import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faSpinner } from '@fortawesome/free-solid-svg-icons';
import './WebsiteViewer.css';

const WebsiteViewer: React.FC = () => {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        src={serverUrl}
        className="website-viewer-iframe"
        title="Website Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
};

export default WebsiteViewer;
