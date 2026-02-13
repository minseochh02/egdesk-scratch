import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faExclamationTriangle, 
  faRefresh, 
  faTimes,
  faSignInAlt 
} from '../../utils/fontAwesomeIcons';

interface ReauthData {
  reason: string;
  message: string;
  action: string;
}

interface ReauthRequiredNotificationProps {}

const ReauthRequiredNotification: React.FC<ReauthRequiredNotificationProps> = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [reauthData, setReauthData] = useState<ReauthData | null>(null);
  const [isReauthenticating, setIsReauthenticating] = useState(false);

  useEffect(() => {
    // Listen for re-authentication required events
    const handleReauthRequired = (event: any, data: ReauthData) => {
      console.log('🔐 Re-authentication required:', data);
      setReauthData(data);
      setIsVisible(true);
    };

    // Listen for successful authentication to hide notification
    const handleAuthSuccess = () => {
      setIsVisible(false);
      setReauthData(null);
      setIsReauthenticating(false);
    };

    window.electron.ipcRenderer.on('auth:reauth-required', handleReauthRequired);
    window.electron.ipcRenderer.on('auth:success', handleAuthSuccess);

    return () => {
      window.electron.ipcRenderer.removeAllListeners('auth:reauth-required');
      window.electron.ipcRenderer.removeAllListeners('auth:success');
    };
  }, []);

  const handleReauthenticate = async () => {
    if (isReauthenticating) return;

    try {
      setIsReauthenticating(true);
      console.log('🔐 Starting re-authentication...');

      // Sign in with Google and request all necessary scopes
      const scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/script.projects',
      ].join(' ');

      const result = await window.electron.auth.signInWithGoogle(scopes);

      if (result.success) {
        console.log('✅ Re-authentication successful');
        setIsVisible(false);
        setReauthData(null);
      } else {
        console.error('❌ Re-authentication failed:', result.error);
        // Keep notification visible so user can try again
      }
    } catch (error) {
      console.error('❌ Re-authentication error:', error);
      // Keep notification visible so user can try again
    } finally {
      setIsReauthenticating(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setReauthData(null);
  };

  if (!isVisible || !reauthData) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <FontAwesomeIcon 
            icon={faExclamationTriangle} 
            className="text-yellow-600 text-lg"
          />
        </div>
        
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Re-authentication Required
          </h3>
          
          <div className="mt-2 text-sm text-yellow-700">
            <p className="mb-2">{reauthData.message}</p>
            <p className="text-xs text-yellow-600">{reauthData.action}</p>
          </div>
          
          <div className="mt-4 flex space-x-2">
            <button
              onClick={handleReauthenticate}
              disabled={isReauthenticating}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReauthenticating ? (
                <>
                  <FontAwesomeIcon icon={faRefresh} className="animate-spin -ml-1 mr-1 h-3 w-3" />
                  Signing In...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faSignInAlt} className="-ml-1 mr-1 h-3 w-3" />
                  Sign In Again
                </>
              )}
            </button>
            
            <button
              onClick={handleDismiss}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              Dismiss
            </button>
          </div>
        </div>
        
        <div className="flex-shrink-0 ml-4">
          <button
            onClick={handleDismiss}
            className="inline-flex text-yellow-400 hover:text-yellow-500 focus:outline-none focus:text-yellow-500"
          >
            <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReauthRequiredNotification;