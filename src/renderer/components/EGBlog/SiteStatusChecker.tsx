import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCheckCircle, 
  faExclamationTriangle, 
  faTimesCircle, 
  faSpinner,
  faRefresh,
  faGlobe,
  faClock,
  faServer
} from '../../utils/fontAwesomeIcons';
import './SiteStatusChecker.css';

interface SiteStatusCheckerProps {
  url: string;
  onStatusChange?: (status: 'checking' | 'online' | 'offline' | 'error') => void;
  className?: string;
}

interface SiteStatus {
  status: 'checking' | 'online' | 'offline' | 'error';
  responseTime?: number;
  lastChecked?: string;
  error?: string;
}

const SiteStatusChecker: React.FC<SiteStatusCheckerProps> = ({
  url,
  onStatusChange,
  className = ''
}) => {
  const [siteStatus, setSiteStatus] = useState<SiteStatus>({
    status: 'checking',
    lastChecked: new Date().toISOString()
  });

  const checkSiteStatus = async () => {
    try {
      console.log('🔍 Starting site status check for URL:', url);
      setSiteStatus(prev => ({ ...prev, status: 'checking' }));
      onStatusChange?.('checking');

      const startTime = Date.now();
      
      // Use main process proxy to bypass CORS
      console.log('📡 Calling main process to check site...');
      const result = await window.electron.wordpress.checkSite(url);
      
      const responseTime = Date.now() - startTime;
      console.log('✅ Main process check completed. Response time:', responseTime + 'ms');
      console.log('📊 Main process result:', result);

      if (result.success) {
        const newStatus: SiteStatus = {
          status: result.status as 'online' | 'offline',
          responseTime,
          lastChecked: new Date().toISOString(),
          error: result.error
        };

        console.log('📊 Final status:', newStatus);
        setSiteStatus(newStatus);
        onStatusChange?.(result.status as 'online' | 'offline');
      } else {
        throw new Error(result.error || 'Unknown error from main process');
      }

    } catch (error) {
      console.log('❌ Error occurred during site check:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log('❌ Error message:', errorMessage);
      
      const newStatus: SiteStatus = {
        status: 'offline',
        lastChecked: new Date().toISOString(),
        error: errorMessage
      };

      console.log('📊 Error status:', newStatus);
      setSiteStatus(newStatus);
      onStatusChange?.('offline');
    }
  };


  useEffect(() => {
    checkSiteStatus();
    
    // Set up periodic checking every 30 seconds
    const interval = setInterval(checkSiteStatus, 30000);
    
    return () => clearInterval(interval);
  }, [url]);

  const getStatusIcon = () => {
    switch (siteStatus.status) {
      case 'checking':
        return faSpinner;
      case 'online':
        return faCheckCircle;
      case 'offline':
        return faTimesCircle;
      case 'error':
        return faExclamationTriangle;
      default:
        return faGlobe;
    }
  };

  const getStatusColor = () => {
    switch (siteStatus.status) {
      case 'checking':
        return 'warning';
      case 'online':
        return 'success';
      case 'offline':
        return 'error';
      case 'error':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const getStatusText = () => {
    switch (siteStatus.status) {
      case 'checking':
        return 'Checking...';
      case 'online':
        return '200 - Site healthy';
      case 'offline':
        return siteStatus.error === 'Hosting service period has expired' 
          ? 'Hosting Expired' 
          : 'Offline';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const formatResponseTime = (time: number) => {
    return `${time}ms`;
  };

  const formatLastChecked = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ago`;
    } else {
      return date.toLocaleTimeString();
    }
  };

  return (
    <div className={`eg-blog-site-status-checker ${className}`}>
      <div className="eg-blog-site-status-checker-main">
        <div className={`eg-blog-site-status-checker-indicator eg-blog-site-status-checker-indicator-${getStatusColor()}`}>
          <FontAwesomeIcon 
            icon={getStatusIcon()} 
            className={siteStatus.status === 'checking' ? 'eg-blog-site-status-checker-spinning' : ''}
          />
          <span className="eg-blog-site-status-checker-text">{getStatusText()}</span>
        </div>
        
        <button 
          className="eg-blog-site-status-checker-refresh-btn"
          onClick={checkSiteStatus}
          disabled={siteStatus.status === 'checking'}
          title="Check site status"
        >
          <FontAwesomeIcon icon={faRefresh} className={siteStatus.status === 'checking' ? 'eg-blog-site-status-checker-spinning' : ''} />
        </button>
      </div>
      
      {siteStatus.error && (
        <div className="eg-blog-site-status-checker-error">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span>{siteStatus.error}</span>
        </div>
      )}
    </div>
  );
};

export default SiteStatusChecker;
