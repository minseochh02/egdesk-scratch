import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faSync, faCheck, faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
import './SchedulerSettings.css';

interface ScheduleSettings {
  enabled: boolean;
  time: string; // HH:MM format
  retryCount: number;
  retryDelayMinutes: number;
  includeTaxSync: boolean; // Include Hometax tax invoice sync
  spreadsheetSyncEnabled?: boolean; // Enable auto-export to spreadsheet
  lastSyncTime?: string;
  lastSyncStatus?: 'success' | 'failed' | 'running';
}

export const SchedulerSettings: React.FC = () => {
  const [settings, setSettings] = useState<ScheduleSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState<any>(null);

  useEffect(() => {
    loadSettings();
    loadLastSyncInfo();

    // Set up event listeners
    const unsubscribers = [
      window.electron.financeHubScheduler.onSyncStarted(() => {
        setSyncing(true);
        loadLastSyncInfo();
      }),
      window.electron.financeHubScheduler.onSyncCompleted((data) => {
        setSyncing(false);
        loadLastSyncInfo();

        const totalFailed = (data.bankFailedCount || 0) + (data.taxFailedCount || 0);

        if (totalFailed === 0) {
          const messages = [];
          if (data.bankSuccessCount > 0) {
            messages.push(`은행 계좌: ${data.bankSuccessCount}건`);
          }
          if (data.taxSuccessCount > 0) {
            messages.push(`세금계산서: ${data.taxSuccessCount}건`);
          }
          if (data.spreadsheetResult?.success) {
            messages.push(`📊 스프레드시트 동기화 완료`);
          }
          alert(`✅ 동기화 완료!\n${messages.join('\n')}`);
        } else {
          const messages = [];
          if (data.bankSuccessCount > 0 || data.bankFailedCount > 0) {
            messages.push(`은행 계좌: 성공 ${data.bankSuccessCount}건, 실패 ${data.bankFailedCount}건`);
          }
          if (data.taxSuccessCount > 0 || data.taxFailedCount > 0) {
            messages.push(`세금계산서: 성공 ${data.taxSuccessCount}건, 실패 ${data.taxFailedCount}건`);
          }
          if (data.spreadsheetResult?.success) {
            messages.push(`📊 스프레드시트 동기화 완료`);
          } else if (data.spreadsheetResult?.error) {
            messages.push(`⚠️ 스프레드시트 동기화 실패: ${data.spreadsheetResult.error}`);
          }
          alert(`⚠️ 동기화 부분 완료\n${messages.join('\n')}`);
        }
      }),
      window.electron.financeHubScheduler.onSyncFailed((data) => {
        setSyncing(false);
        loadLastSyncInfo();
        alert(`❌ 동기화 실패: ${data.error}`);
      }),
      window.electron.financeHubScheduler.onSettingsUpdated((newSettings) => {
        setSettings(newSettings);
      }),
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  const loadSettings = async () => {
    try {
      const result = await window.electron.financeHubScheduler.getSettings();
      if (result.success) {
        setSettings(result.settings);
      }
    } catch (error) {
      console.error('Failed to load scheduler settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLastSyncInfo = async () => {
    try {
      const result = await window.electron.financeHubScheduler.getLastSyncInfo();
      if (result.success) {
        setLastSyncInfo(result);
        setSyncing(result.isSyncing || false);
      }
    } catch (error) {
      console.error('Failed to load last sync info:', error);
    }
  };

  const handleToggleEnabled = async () => {
    if (!settings) return;
    
    const newEnabled = !settings.enabled;
    setSaving(true);
    
    try {
      const result = await window.electron.financeHubScheduler.updateSettings({ enabled: newEnabled });
      if (result.success) {
        setSettings(result.settings);
        
        // Start or stop the scheduler based on enabled state
        if (newEnabled) {
          await window.electron.financeHubScheduler.start();
        } else {
          await window.electron.financeHubScheduler.stop();
        }
      }
    } catch (error) {
      console.error('Failed to update scheduler enabled state:', error);
      alert('스케줄러 설정 변경 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleTimeChange = async (newTime: string) => {
    if (!settings) return;

    setSaving(true);
    try {
      const result = await window.electron.financeHubScheduler.updateSettings({ time: newTime });
      if (result.success) {
        setSettings(result.settings);
      }
    } catch (error) {
      console.error('Failed to update scheduler time:', error);
      alert('동기화 시간 변경 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTaxSync = async () => {
    if (!settings) return;

    const newIncludeTaxSync = !settings.includeTaxSync;
    setSaving(true);

    try {
      const result = await window.electron.financeHubScheduler.updateSettings({ includeTaxSync: newIncludeTaxSync });
      if (result.success) {
        setSettings(result.settings);
      }
    } catch (error) {
      console.error('Failed to update tax sync setting:', error);
      alert('세금계산서 동기화 설정 변경 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSpreadsheetSync = async () => {
    if (!settings) return;

    const newSpreadsheetSyncEnabled = !settings.spreadsheetSyncEnabled;
    setSaving(true);

    try {
      const result = await window.electron.financeHubScheduler.updateSettings({ spreadsheetSyncEnabled: newSpreadsheetSyncEnabled });
      if (result.success) {
        setSettings(result.settings);
      }
    } catch (error) {
      console.error('Failed to update spreadsheet sync setting:', error);
      alert('스프레드시트 동기화 설정 변경 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await window.electron.financeHubScheduler.syncNow();
    } catch (error) {
      console.error('Manual sync failed:', error);
      alert('수동 동기화 실패');
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="scheduler-settings scheduler-settings--loading">
        <FontAwesomeIcon icon={faSpinner} spin /> 설정 불러오는 중...
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="scheduler-settings scheduler-settings--error">
        스케줄러 설정을 불러올 수 없습니다.
      </div>
    );
  }

  const formatLastSyncTime = (isoString?: string) => {
    if (!isoString) return '동기화 기록 없음';
    const date = new Date(isoString);
    return date.toLocaleString('ko-KR');
  };

  const getStatusIcon = () => {
    if (syncing || lastSyncInfo?.status === 'running') {
      return <FontAwesomeIcon icon={faSpinner} spin className="scheduler-settings__status-icon scheduler-settings__status-icon--running" />;
    }
    if (lastSyncInfo?.status === 'success') {
      return <FontAwesomeIcon icon={faCheck} className="scheduler-settings__status-icon scheduler-settings__status-icon--success" />;
    }
    if (lastSyncInfo?.status === 'failed') {
      return <FontAwesomeIcon icon={faTimes} className="scheduler-settings__status-icon scheduler-settings__status-icon--failed" />;
    }
    return null;
  };

  return (
    <div className="scheduler-settings">
      <div className="scheduler-settings__content">
        <div className="scheduler-settings__row">
          <label className="scheduler-settings__label">
            자동 동기화
          </label>
          <div className="scheduler-settings__toggle">
            <label className="scheduler-settings__switch">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={handleToggleEnabled}
                disabled={saving}
              />
              <span className="scheduler-settings__slider"></span>
            </label>
            <span className="scheduler-settings__status">
              {settings.enabled ? '활성화' : '비활성화'}
            </span>
          </div>
        </div>

        <div className="scheduler-settings__row">
          <label className="scheduler-settings__label">
            동기화 시간
          </label>
          <div className="scheduler-settings__time">
            <input
              type="time"
              value={settings.time}
              onChange={(e) => handleTimeChange(e.target.value)}
              disabled={!settings.enabled || saving}
              className="scheduler-settings__time-input"
            />
            <span className="scheduler-settings__time-hint">
              매일 이 시간에 자동으로 동기화됩니다
            </span>
          </div>
        </div>

        <div className="scheduler-settings__row">
          <label className="scheduler-settings__label">
            세금계산서 동기화
          </label>
          <div className="scheduler-settings__toggle">
            <label className="scheduler-settings__switch">
              <input
                type="checkbox"
                checked={settings.includeTaxSync}
                onChange={handleToggleTaxSync}
                disabled={!settings.enabled || saving}
              />
              <span className="scheduler-settings__slider"></span>
            </label>
            <span className="scheduler-settings__status">
              {settings.includeTaxSync ? '포함' : '제외'}
            </span>
          </div>
        </div>

        <div className="scheduler-settings__row">
          <label className="scheduler-settings__label">
            스프레드시트 자동 동기화
          </label>
          <div className="scheduler-settings__toggle">
            <label className="scheduler-settings__switch">
              <input
                type="checkbox"
                checked={settings.spreadsheetSyncEnabled ?? true}
                onChange={handleToggleSpreadsheetSync}
                disabled={!settings.enabled || saving}
              />
              <span className="scheduler-settings__slider"></span>
            </label>
            <span className="scheduler-settings__status">
              {settings.spreadsheetSyncEnabled ?? true ? '활성화' : '비활성화'}
            </span>
          </div>
        </div>

        <div className="scheduler-settings__row">
          <label className="scheduler-settings__label">
            마지막 동기화
          </label>
          <div className="scheduler-settings__last-sync">
            {getStatusIcon()}
            <span className="scheduler-settings__last-sync-time">
              {formatLastSyncTime(lastSyncInfo?.time)}
            </span>
          </div>
        </div>

        <div className="scheduler-settings__action-row">
          <button
            className="scheduler-settings__sync-now"
            onClick={handleSyncNow}
            disabled={syncing || saving}
          >
            <FontAwesomeIcon icon={faSync} spin={syncing} />
            {syncing ? '동기화 중...' : '지금 동기화'}
          </button>
        </div>

        <div className="scheduler-settings__info">
          <p>
            <strong>재시도 설정:</strong> 실패 시 {settings.retryCount}회 재시도
            (각 {settings.retryDelayMinutes}분 간격)
          </p>
          <p>
            <strong>참고:</strong> 자동 동기화는 모든 활성 계좌의 최근 3개월 거래내역을 가져옵니다.
            {settings.includeTaxSync && ' 세금계산서 동기화가 활성화된 경우 저장된 모든 사업자의 당월 세금계산서도 함께 수집됩니다.'}
            {(settings.spreadsheetSyncEnabled ?? true) && ' 스프레드시트 자동 동기화가 활성화된 경우 동기화 후 자동으로 Google 스프레드시트에 데이터를 내보냅니다.'}
          </p>
        </div>
      </div>
    </div>
  );
};