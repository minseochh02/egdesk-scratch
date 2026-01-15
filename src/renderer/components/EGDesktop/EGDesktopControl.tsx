import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDesktop, faPowerOff, faCog, faCoffee, faMoon } from '../../utils/fontAwesomeIcons';
import './EGDesktopControl.css';

const EGDesktopControl: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [autoStartLoading, setAutoStartLoading] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [keepAwakeActive, setKeepAwakeActive] = useState(false);
  const [keepAwakeLoading, setKeepAwakeLoading] = useState(false);

  useEffect(() => {
    checkKeepAwakeStatus();
    checkAutoStartStatus();
  }, []);

  const checkKeepAwakeStatus = async () => {
    try {
      const result = await window.electron.keepAwake.status();
      if (result.success) {
        setKeepAwakeActive(result.isActive);
      }
    } catch (error) {
      console.error('Failed to check keep awake status:', error);
    }
  };

  const checkAutoStartStatus = async () => {
    try {
      const result = await window.electron.autoStart.getStatus();
      if (result.success) {
        setAutoStart(result.enabled);
      }
    } catch (error) {
      console.error('Failed to check auto-start status:', error);
    }
  };

  const handleKeepAwakeToggle = async () => {
    setKeepAwakeLoading(true);
    try {
      const result = await window.electron.keepAwake.toggle();
      if (result.success) {
        setKeepAwakeActive(result.isActive);
      }
    } catch (error) {
      console.error('Failed to toggle keep awake:', error);
    } finally {
      setKeepAwakeLoading(false);
    }
  };

  const handleAutoStartToggle = async () => {
    setAutoStartLoading(true);
    try {
      const result = await window.electron.autoStart.toggle();
      if (result.success) {
        setAutoStart(result.enabled);
      }
    } catch (error) {
      console.error('Failed to toggle auto-start:', error);
    } finally {
      setAutoStartLoading(false);
    }
  };

  const handleToggle = () => {
    setIsEnabled(!isEnabled);
  };

  return (
    <div className="egdesktop-control">
      <div className="egdesktop-control-wrapper">
        <div className="egdesktop-control-header">
          <div className="egdesktop-header-icon">
            <FontAwesomeIcon icon={faDesktop} />
          </div>
          <div className="egdesktop-header-content">
            <h2 className="egdesktop-control-title">EGDesktop Control Panel</h2>
            <p className="egdesktop-control-subtitle">Desktop environment settings and management</p>
          </div>
        </div>

        <div className="egdesktop-control-panel">
        {/* Main Power Toggle */}
        <div className="egdesktop-control-section egdesktop-main-toggle-section">
          <div className="egdesktop-section-header">
            <div className="egdesktop-section-icon">
              <FontAwesomeIcon icon={faPowerOff} />
            </div>
            <div className="egdesktop-section-info">
              <h3 className="egdesktop-section-title">Desktop Activation</h3>
              <p className="egdesktop-section-description">
                {isEnabled
                  ? 'EGDesktop is currently running'
                  : 'EGDesktop is currently disabled'}
              </p>
            </div>
          </div>
          <div className="egdesktop-toggle-container">
            <label className="egdesktop-toggle-switch">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={handleToggle}
              />
              <span className="egdesktop-toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Additional Settings */}
        <div className="egdesktop-control-section">
          <div className="egdesktop-section-header">
            <div className="egdesktop-section-icon secondary">
              <FontAwesomeIcon icon={faCog} />
            </div>
            <div className="egdesktop-section-info">
              <h3 className="egdesktop-section-title">Additional Settings</h3>
            </div>
          </div>

          {/* Auto Start Toggle */}
          <div className="egdesktop-setting-item">
            <div className="egdesktop-setting-info">
              <h4 className="egdesktop-setting-title">Auto Start</h4>
              <p className="egdesktop-setting-description">
                Launch app automatically when you log in to your computer
              </p>
            </div>
            <label className="egdesktop-toggle-switch small">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={handleAutoStartToggle}
                disabled={autoStartLoading}
              />
              <span className="egdesktop-toggle-slider"></span>
            </label>
          </div>

          {/* Notifications Toggle */}
          <div className="egdesktop-setting-item">
            <div className="egdesktop-setting-info">
              <h4 className="egdesktop-setting-title">Notifications</h4>
              <p className="egdesktop-setting-description">
                Receive notifications for desktop events and updates
              </p>
            </div>
            <label className="egdesktop-toggle-switch small">
              <input
                type="checkbox"
                checked={notifications}
                onChange={() => setNotifications(!notifications)}
                disabled={!isEnabled}
              />
              <span className="egdesktop-toggle-slider"></span>
            </label>
          </div>

          {/* Keep Awake Toggle */}
          <div className="egdesktop-setting-item">
            <div className="egdesktop-setting-info">
              <div className="egdesktop-setting-title-with-icon">
                <FontAwesomeIcon
                  icon={keepAwakeActive ? faCoffee : faMoon}
                  className={keepAwakeLoading ? 'spinning' : ''}
                  style={{ marginRight: '8px', color: keepAwakeActive ? '#007bff' : '#6c757d' }}
                />
                <h4 className="egdesktop-setting-title">Keep Awake</h4>
              </div>
              <p className="egdesktop-setting-description">
                Prevent display sleep and system from sleeping during tasks
              </p>
            </div>
            <label className="egdesktop-toggle-switch small">
              <input
                type="checkbox"
                checked={keepAwakeActive}
                onChange={handleKeepAwakeToggle}
                disabled={keepAwakeLoading}
              />
              <span className="egdesktop-toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Status Information */}
        <div className="egdesktop-status-info">
          <div className="egdesktop-status-item">
            <span className="egdesktop-status-label">Status:</span>
            <span className={`egdesktop-status-value ${isEnabled ? 'active' : 'inactive'}`}>
              {isEnabled ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="egdesktop-status-item">
            <span className="egdesktop-status-label">Version:</span>
            <span className="egdesktop-status-value">1.0.0</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default EGDesktopControl;

