import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faSync, faCheck, faTimes, faSpinner, faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import './SchedulerSettings.css';

interface EntitySchedule {
  enabled: boolean;
  time: string;
}

interface ScheduleSettings {
  enabled: boolean;
  retryCount: number;
  retryDelayMinutes: number;
  spreadsheetSyncEnabled?: boolean;

  cards: {
    bc?: EntitySchedule;
    hana?: EntitySchedule;
    hyundai?: EntitySchedule;
    kb?: EntitySchedule;
    lotte?: EntitySchedule;
    nh?: EntitySchedule;
    samsung?: EntitySchedule;
    shinhan?: EntitySchedule;
  };

  banks: {
    kookmin?: EntitySchedule;
    nh?: EntitySchedule;
    nhBusiness?: EntitySchedule;
    shinhan?: EntitySchedule;
  };

  tax: {
    [businessNumber: string]: EntitySchedule;
  };

  lastSyncTime?: string;
  lastSyncStatus?: 'success' | 'failed' | 'running';
}

const CARD_LABELS: Record<string, string> = {
  bc: 'BC카드',
  hana: '하나카드',
  hyundai: '현대카드',
  kb: 'KB국민카드',
  lotte: '롯데카드',
  nh: 'NH농협카드',
  samsung: '삼성카드',
  shinhan: '신한카드',
};

const BANK_LABELS: Record<string, string> = {
  kookmin: 'KB국민은행',
  nh: 'NH농협은행',
  nhBusiness: 'NH농협기업은행',
  shinhan: '신한은행',
};

export const SchedulerSettings: React.FC = () => {
  const [settings, setSettings] = useState<ScheduleSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState<any>(null);

  // Collapse state for sections
  const [cardsExpanded, setCardsExpanded] = useState(true);
  const [banksExpanded, setBanksExpanded] = useState(true);
  const [taxExpanded, setTaxExpanded] = useState(true);

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
        alert(`✅ ${data.entityType} 동기화 완료: ${data.entityId}`);
      }),
      window.electron.financeHubScheduler.onSyncFailed((data) => {
        setSyncing(false);
        loadLastSyncInfo();
        alert(`❌ ${data.entityType} 동기화 실패: ${data.entityId} - ${data.error}`);
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

  const handleEntityToggle = async (entityType: 'cards' | 'banks' | 'tax', entityId: string) => {
    if (!settings) return;

    const currentSchedule = settings[entityType][entityId as keyof typeof settings[typeof entityType]];
    if (!currentSchedule) return;

    const newSchedule = { ...currentSchedule, enabled: !currentSchedule.enabled };

    setSaving(true);
    try {
      const result = await window.electron.financeHubScheduler.updateSettings({
        [entityType]: {
          ...settings[entityType],
          [entityId]: newSchedule,
        },
      });
      if (result.success) {
        setSettings(result.settings);
      }
    } catch (error) {
      console.error('Failed to update entity schedule:', error);
      alert('설정 변경 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleEntityTimeChange = async (entityType: 'cards' | 'banks' | 'tax', entityId: string, newTime: string) => {
    if (!settings) return;

    const currentSchedule = settings[entityType][entityId as keyof typeof settings[typeof entityType]];
    if (!currentSchedule) return;

    const newSchedule = { ...currentSchedule, time: newTime };

    setSaving(true);
    try {
      const result = await window.electron.financeHubScheduler.updateSettings({
        [entityType]: {
          ...settings[entityType],
          [entityId]: newSchedule,
        },
      });
      if (result.success) {
        setSettings(result.settings);
      }
    } catch (error) {
      console.error('Failed to update entity time:', error);
      alert('시간 변경 실패');
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

  const handleClearRetries = async () => {
    if (!confirm('모든 재시도 타이머를 초기화하시겠습니까?\n\n진행 중인 재시도가 모두 취소되고, 막힌 상태가 해제됩니다.')) {
      return;
    }

    setSaving(true);
    try {
      const result = await window.electron.financeHubScheduler.clearRetries();
      if (result.success) {
        console.log('Cleared retries:', result);
        alert(`✅ 재시도 초기화 완료\n\n${result.cleared}개의 재시도 타이머가 제거되었습니다.${result.entities.length > 0 ? '\n\n제거된 항목:\n' + result.entities.join('\n') : ''}`);
      } else {
        alert(`❌ 재시도 초기화 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to clear retries:', error);
      alert('재시도 초기화 실패');
    } finally {
      setSaving(false);
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

  const renderEntitySchedule = (entityType: 'cards' | 'banks' | 'tax', entityId: string, label: string, schedule?: EntitySchedule) => {
    if (!schedule) return null;

    return (
      <div key={entityId} className="scheduler-settings__entity">
        <label className="scheduler-settings__entity-label">{label}</label>
        <div className="scheduler-settings__entity-controls">
          <label className="scheduler-settings__switch scheduler-settings__switch--small">
            <input
              type="checkbox"
              checked={schedule.enabled}
              onChange={() => handleEntityToggle(entityType, entityId)}
              disabled={!settings.enabled || saving}
            />
            <span className="scheduler-settings__slider"></span>
          </label>
          <input
            type="time"
            value={schedule.time}
            onChange={(e) => handleEntityTimeChange(entityType, entityId, e.target.value)}
            disabled={!settings.enabled || !schedule.enabled || saving}
            className="scheduler-settings__time-input scheduler-settings__time-input--small"
          />
        </div>
      </div>
    );
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

        {/* Cards Section */}
        <div className="scheduler-settings__section">
          <div className="scheduler-settings__section-header" onClick={() => setCardsExpanded(!cardsExpanded)}>
            <FontAwesomeIcon icon={cardsExpanded ? faChevronDown : faChevronRight} />
            <h3>카드 ({Object.values(settings.cards).filter(s => s?.enabled).length}/{Object.keys(settings.cards).length})</h3>
          </div>
          {cardsExpanded && (
            <div className="scheduler-settings__section-content">
              {Object.entries(settings.cards).map(([cardId, schedule]) =>
                renderEntitySchedule('cards', cardId, CARD_LABELS[cardId] || cardId, schedule)
              )}
            </div>
          )}
        </div>

        {/* Banks Section */}
        <div className="scheduler-settings__section">
          <div className="scheduler-settings__section-header" onClick={() => setBanksExpanded(!banksExpanded)}>
            <FontAwesomeIcon icon={banksExpanded ? faChevronDown : faChevronRight} />
            <h3>은행 ({Object.values(settings.banks).filter(s => s?.enabled).length}/{Object.keys(settings.banks).length})</h3>
          </div>
          {banksExpanded && (
            <div className="scheduler-settings__section-content">
              {Object.entries(settings.banks).map(([bankId, schedule]) =>
                renderEntitySchedule('banks', bankId, BANK_LABELS[bankId] || bankId, schedule)
              )}
            </div>
          )}
        </div>

        {/* Tax Section */}
        <div className="scheduler-settings__section">
          <div className="scheduler-settings__section-header" onClick={() => setTaxExpanded(!taxExpanded)}>
            <FontAwesomeIcon icon={taxExpanded ? faChevronDown : faChevronRight} />
            <h3>세금계산서 ({Object.values(settings.tax).filter(s => s?.enabled).length}/{Object.keys(settings.tax).length})</h3>
          </div>
          {taxExpanded && (
            <div className="scheduler-settings__section-content">
              {Object.entries(settings.tax).map(([businessNumber, schedule]) =>
                renderEntitySchedule('tax', businessNumber, businessNumber, schedule)
              )}
              {Object.keys(settings.tax).length === 0 && (
                <div className="scheduler-settings__empty">
                  저장된 사업자가 없습니다. Hometax 탭에서 사업자를 추가하세요.
                </div>
              )}
            </div>
          )}
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
            {syncing ? '동기화 중...' : '지금 전체 동기화'}
          </button>
          <button
            className="scheduler-settings__clear-retries"
            onClick={handleClearRetries}
            disabled={syncing || saving}
            title="막힌 재시도 타이머를 모두 제거하고 스케줄러 상태를 초기화합니다"
          >
            🧹 재시도 초기화
          </button>
        </div>

        <div className="scheduler-settings__info">
          <p>
            <strong>재시도 설정:</strong> 실패 시 {settings.retryCount}회 재시도
            (각 {settings.retryDelayMinutes}분 간격)
          </p>
          <p>
            <strong>참고:</strong> 각 카드, 은행, 세금계산서는 개별적으로 설정된 시간에 자동 동기화됩니다.
            브라우저 충돌을 방지하기 위해 각 항목은 10분 간격으로 실행되도록 기본 설정되어 있습니다.
            {(settings.spreadsheetSyncEnabled ?? true) && ' 동기화 후 자동으로 Google 스프레드시트에 데이터를 내보냅니다.'}
          </p>
        </div>
      </div>
    </div>
  );
};
