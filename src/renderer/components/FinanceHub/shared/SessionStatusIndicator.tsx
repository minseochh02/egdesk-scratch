// ============================================================================
// SessionStatusIndicator
// Visual indicator showing session health and auto-refresh countdown
// ============================================================================

import React, { useState, useEffect } from 'react';
import './SessionStatusIndicator.css';

// ============================================================================
// Types
// ============================================================================

interface SessionStatusIndicatorProps {
  bankId: string;
  status: 'active' | 'extending' | 'expired' | 'error' | 'disconnected' | 'none';
  isHealthy: boolean;
  lastExtendedAt?: number;
  nextExtendInMs?: number;
  extendCount?: number;
  onExtendClick?: () => void;
  onReconnectClick?: () => void;
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

const SessionStatusIndicator: React.FC<SessionStatusIndicatorProps> = ({
  bankId,
  status,
  isHealthy,
  lastExtendedAt,
  nextExtendInMs,
  extendCount,
  onExtendClick,
  onReconnectClick,
  compact = false,
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Calculate countdown until next auto-extend
  useEffect(() => {
    if (!nextExtendInMs || status !== 'active') {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const timeSinceExtend = lastExtendedAt ? now - lastExtendedAt : 0;
      const SESSION_EXTEND_INTERVAL = 4 * 60 * 1000; // 4 minutes
      const remaining = Math.max(0, SESSION_EXTEND_INTERVAL - timeSinceExtend);
      setCountdown(Math.ceil(remaining / 1000));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [lastExtendedAt, nextExtendInMs, status]);

  // Get status display info
  const getStatusInfo = () => {
    switch (status) {
      case 'active':
        return {
          icon: '✓',
          text: '연결됨',
          color: 'var(--session-active)',
          pulse: false,
        };
      case 'extending':
        return {
          icon: '⟳',
          text: '세션 연장 중...',
          color: 'var(--session-extending)',
          pulse: true,
        };
      case 'expired':
        return {
          icon: '⚠',
          text: '세션 만료',
          color: 'var(--session-expired)',
          pulse: false,
        };
      case 'error':
        return {
          icon: '✗',
          text: '오류',
          color: 'var(--session-error)',
          pulse: false,
        };
      case 'disconnected':
        return {
          icon: '○',
          text: '연결 끊김',
          color: 'var(--session-disconnected)',
          pulse: false,
        };
      default:
        return {
          icon: '○',
          text: '미연결',
          color: 'var(--session-none)',
          pulse: false,
        };
    }
  };

  const statusInfo = getStatusInfo();

  // Format countdown
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format last extended time
  const formatLastExtended = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    return `${hours}시간 전`;
  };

  if (compact) {
    return (
      <div 
        className={`session-indicator session-indicator--compact ${statusInfo.pulse ? 'session-indicator--pulse' : ''}`}
        style={{ '--status-color': statusInfo.color } as React.CSSProperties}
        title={`${statusInfo.text}${countdown ? ` (다음 연장: ${formatCountdown(countdown)})` : ''}`}
      >
        <span className="session-indicator__icon">{statusInfo.icon}</span>
        {status === 'active' && countdown && countdown < 60 && (
          <span className="session-indicator__countdown">{formatCountdown(countdown)}</span>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`session-indicator ${statusInfo.pulse ? 'session-indicator--pulse' : ''}`}
      style={{ '--status-color': statusInfo.color } as React.CSSProperties}
    >
      <div className="session-indicator__header" onClick={() => setShowDetails(!showDetails)}>
        <span className="session-indicator__icon">{statusInfo.icon}</span>
        <span className="session-indicator__text">{statusInfo.text}</span>
        {status === 'active' && countdown && (
          <span className="session-indicator__countdown">
            다음 연장: {formatCountdown(countdown)}
          </span>
        )}
        <span className="session-indicator__toggle">{showDetails ? '▲' : '▼'}</span>
      </div>

      {showDetails && (
        <div className="session-indicator__details">
          {lastExtendedAt && (
            <div className="session-indicator__detail-row">
              <span className="session-indicator__detail-label">마지막 연장:</span>
              <span className="session-indicator__detail-value">
                {formatLastExtended(lastExtendedAt)}
              </span>
            </div>
          )}
          {extendCount !== undefined && (
            <div className="session-indicator__detail-row">
              <span className="session-indicator__detail-label">연장 횟수:</span>
              <span className="session-indicator__detail-value">{extendCount}회</span>
            </div>
          )}
          
          <div className="session-indicator__actions">
            {status === 'active' && onExtendClick && (
              <button 
                className="session-indicator__btn session-indicator__btn--extend"
                onClick={onExtendClick}
              >
                🔄 수동 연장
              </button>
            )}
            {(status === 'expired' || status === 'error' || status === 'disconnected') && onReconnectClick && (
              <button 
                className="session-indicator__btn session-indicator__btn--reconnect"
                onClick={onReconnectClick}
              >
                🔗 재연결
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionStatusIndicator;
