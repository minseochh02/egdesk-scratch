import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faSpinner } from '../utils/fontAwesomeIcons';

/**
 * Minimal version of WordPressSitesList for debugging
 * This component tests each dependency individually
 */
function WordPressSitesListMinimal(): React.JSX.Element {
  const [testResults, setTestResults] = useState<Array<{name: string, status: 'pending' | 'success' | 'error', message: string}>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const runTests = async () => {
      const results: Array<{name: string, status: 'pending' | 'success' | 'error', message: string}> = [];
      
      // Test 1: Basic React functionality
      try {
        results.push({ name: 'React', status: 'success', message: 'React is working' });
      } catch (error) {
        results.push({ name: 'React', status: 'error', message: `React error: ${error}` });
      }

      // Test 2: FontAwesome icons
      try {
        // This will throw if FontAwesome is not working
        const testIcon = <FontAwesomeIcon icon={faSpinner} />;
        results.push({ name: 'FontAwesome', status: 'success', message: 'FontAwesome icons working' });
      } catch (error) {
        results.push({ name: 'FontAwesome', status: 'error', message: `FontAwesome error: ${error}` });
      }

      // Test 3: Electron APIs
      try {
        if (typeof window !== 'undefined' && window.electron) {
          results.push({ name: 'Electron APIs', status: 'success', message: 'Electron APIs available' });
        } else {
          results.push({ name: 'Electron APIs', status: 'error', message: 'Electron APIs not available' });
        }
      } catch (error) {
        results.push({ name: 'Electron APIs', status: 'error', message: `Electron error: ${error}` });
      }

      // Test 4: AI Keys Store
      try {
        const { aiKeysStore } = await import('./AIKeysManager/store/aiKeysStore');
        const state = aiKeysStore.getState();
        results.push({ name: 'AI Keys Store', status: 'success', message: 'AI Keys Store loaded' });
      } catch (error) {
        results.push({ name: 'AI Keys Store', status: 'error', message: `AI Keys Store error: ${error}` });
      }

      // Test 5: Scheduler Service
      try {
        const { default: SchedulerService } = await import('../services/schedulerService');
        const service = SchedulerService.getInstance();
        results.push({ name: 'Scheduler Service', status: 'success', message: 'Scheduler Service loaded' });
      } catch (error) {
        results.push({ name: 'Scheduler Service', status: 'error', message: `Scheduler Service error: ${error}` });
      }

      // Test 6: Child Components
      try {
        await import('./ScheduledPosts');
        results.push({ name: 'ScheduledPosts', status: 'success', message: 'ScheduledPosts component loaded' });
      } catch (error) {
        results.push({ name: 'ScheduledPosts', status: 'error', message: `ScheduledPosts error: ${error}` });
      }

      try {
        await import('./WordPressSitesList/WordPressPostScheduler');
        results.push({ name: 'WordPressPostScheduler', status: 'success', message: 'WordPressPostScheduler component loaded' });
      } catch (error) {
        results.push({ name: 'WordPressPostScheduler', status: 'error', message: `WordPressPostScheduler error: ${error}` });
      }

      try {
        await import('./SchedulerManager/SchedulerManager');
        results.push({ name: 'SchedulerManager', status: 'success', message: 'SchedulerManager component loaded' });
      } catch (error) {
        results.push({ name: 'SchedulerManager', status: 'error', message: `SchedulerManager error: ${error}` });
      }

      try {
        await import('./DebugButton');
        results.push({ name: 'DebugButton', status: 'success', message: 'DebugButton component loaded' });
      } catch (error) {
        results.push({ name: 'DebugButton', status: 'error', message: `DebugButton error: ${error}` });
      }

      setTestResults(results);
      setIsLoading(false);
    };

    runTests();
  }, []);

  if (isLoading) {
    return (
      <div className="wordpress-sites-list">
        <div className="loading-container">
          <div className="loading-spinner">
            <FontAwesomeIcon icon={faSpinner} spin />
          </div>
          <h3>진단 중...</h3>
          <p>컴포넌트 의존성을 확인하고 있습니다</p>
        </div>
      </div>
    );
  }

  const errorCount = testResults.filter(r => r.status === 'error').length;
  const successCount = testResults.filter(r => r.status === 'success').length;

  return (
    <div className="wordpress-sites-list">
      <div className="sites-header">
        <div className="header-content">
          <div className="header-text">
            <h1>
              <FontAwesomeIcon icon={faExclamationTriangle} />
              WordPress Sites List - 진단 모드
            </h1>
            <p>컴포넌트 의존성 진단 결과: {successCount}개 성공, {errorCount}개 실패</p>
          </div>
        </div>
      </div>

      <div className="sites-content">
        <div className="diagnostic-results">
          {testResults.map((result, index) => (
            <div key={index} className={`diagnostic-item ${result.status}`}>
              <div className="diagnostic-header">
                <span className="diagnostic-name">{result.name}</span>
                <span className={`diagnostic-status ${result.status}`}>
                  {result.status === 'success' ? '✅' : '❌'}
                </span>
              </div>
              <div className="diagnostic-message">{result.message}</div>
            </div>
          ))}
        </div>

        {errorCount > 0 && (
          <div className="diagnostic-actions">
            <button 
              onClick={() => window.location.reload()} 
              className="retry-btn"
            >
              <FontAwesomeIcon icon={faSpinner} />
              페이지 새로고침
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default WordPressSitesListMinimal;
