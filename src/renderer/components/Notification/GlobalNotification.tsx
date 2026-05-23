import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faTimes, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import './GlobalNotification.css';

interface NotificationPayload {
  recipientRole: string;
  title: string;
  body: string;
  runId?: string;
}

interface Toast extends NotificationPayload {
  id: number;
  at: string;
}

export function GlobalNotification() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!(window as any).electron?.onNotificationPush) return;

    const unsub = (window as any).electron.onNotificationPush((data: NotificationPayload) => {
      const id = ++toastId.current;
      const now = new Date().toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      
      const newToast = { id, at: now, ...data };
      setToasts(prev => [newToast, ...prev].slice(0, 5));

      // Auto-remove after 10 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 10000);
    });

    return unsub;
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleToastClick = (toast: Toast) => {
    removeToast(toast.id);
    navigate('/ai-center');
  };

  if (toasts.length === 0) return null;

  return (
    <div className="global-notification-container">
      {toasts.map(toast => (
        <div key={toast.id} className="global-notification-toast animate-in">
          <div className="global-notification-header" onClick={() => handleToastClick(toast)}>
            <div className="global-notification-icon">
              <FontAwesomeIcon icon={faBell} />
            </div>
            <div className="global-notification-title">
              <span className="global-notification-role">{toast.recipientRole}</span>
              <span className="global-notification-title-text">{toast.title}</span>
            </div>
            <button 
              className="global-notification-close" 
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          <div className="global-notification-body" onClick={() => handleToastClick(toast)}>
            <p>{toast.body}</p>
            <div className="global-notification-footer">
              <span className="global-notification-time">{toast.at}</span>
              <span className="global-notification-link">
                AI Center로 이동 <FontAwesomeIcon icon={faChevronRight} size="xs" />
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
