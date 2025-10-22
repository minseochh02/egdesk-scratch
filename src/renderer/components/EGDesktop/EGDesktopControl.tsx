import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDesktop, faPowerOff, faCog } from '../../utils/fontAwesomeIcons';
import './EGDesktopControl.css';

const EGDesktopControl: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const handleToggle = () => {
    setIsEnabled(!isEnabled);
  };

  return (
    <div className="egdesktop-control">
      <div className="egdesktop-control-header">
        <div className="egdesktop-header-icon">
          <FontAwesomeIcon icon={faDesktop} />
        </div>
        <div className="egdesktop-header-content">
          <h2 className="egdesktop-control-title">EGDesktop 제어판</h2>
          <p className="egdesktop-control-subtitle">데스크톱 환경 설정 및 관리</p>
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
              <h3 className="egdesktop-section-title">데스크톱 활성화</h3>
              <p className="egdesktop-section-description">
                {isEnabled
                  ? 'EGDesktop이 현재 실행 중입니다'
                  : 'EGDesktop이 현재 비활성화되어 있습니다'}
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
              <h3 className="egdesktop-section-title">추가 설정</h3>
            </div>
          </div>

          {/* Auto Start Toggle */}
          <div className="egdesktop-setting-item">
            <div className="egdesktop-setting-info">
              <h4 className="egdesktop-setting-title">자동 시작</h4>
              <p className="egdesktop-setting-description">
                시스템 시작 시 EGDesktop 자동 실행
              </p>
            </div>
            <label className="egdesktop-toggle-switch small">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={() => setAutoStart(!autoStart)}
                disabled={!isEnabled}
              />
              <span className="egdesktop-toggle-slider"></span>
            </label>
          </div>

          {/* Notifications Toggle */}
          <div className="egdesktop-setting-item">
            <div className="egdesktop-setting-info">
              <h4 className="egdesktop-setting-title">알림</h4>
              <p className="egdesktop-setting-description">
                데스크톱 이벤트 및 업데이트 알림 받기
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
        </div>

        {/* Status Information */}
        <div className="egdesktop-status-info">
          <div className="egdesktop-status-item">
            <span className="egdesktop-status-label">상태:</span>
            <span className={`egdesktop-status-value ${isEnabled ? 'active' : 'inactive'}`}>
              {isEnabled ? '활성' : '비활성'}
            </span>
          </div>
          <div className="egdesktop-status-item">
            <span className="egdesktop-status-label">버전:</span>
            <span className="egdesktop-status-value">1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EGDesktopControl;

