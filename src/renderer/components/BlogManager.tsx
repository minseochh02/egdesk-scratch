import React, { useState } from 'react';
import WordPressConnector from './WordPressConnector';
import WordPressSitesList from './WordPressSitesList';
import './BlogManager.css';

const BlogManager: React.FC = () => {
  const [activeComponent, setActiveComponent] = useState<'sites' | 'connector'>('sites');

  const handleComponentSwitch = (component: 'sites' | 'connector') => {
    setActiveComponent(component);
  };

  return (
    <div className="blog-manager">
      {activeComponent === 'sites' && (
        <div className="blog-manager-sites-container">
          <WordPressSitesList onSwitchToConnector={() => handleComponentSwitch('connector')} />
        </div>
      )}
      {activeComponent === 'connector' && (
        <WordPressConnector onSwitchToSites={() => handleComponentSwitch('sites')} />
      )}
    </div>
  );
};

export default BlogManager;
