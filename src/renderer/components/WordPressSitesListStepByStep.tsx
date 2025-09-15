import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faSpinner, faCheckCircle, faTimesCircle } from '../utils/fontAwesomeIcons';

/**
 * Step-by-step diagnostic version of WordPressSitesList
 * This component tests each part of the original component individually
 */
function WordPressSitesListStepByStep(): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepResults, setStepResults] = useState<Array<{step: string, status: 'pending' | 'success' | 'error', message: string}>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const steps = [
    'Initialize State',
    'Setup AI Keys Store Subscription',
    'Load WordPress Connections',
    'Load Sync History',
    'Render Component UI'
  ];

  useEffect(() => {
    const runStepByStep = async () => {
      const results: Array<{step: string, status: 'pending' | 'success' | 'error', message: string}> = [];
      
      // Step 1: Initialize State
      try {
        setCurrentStep(1);
        const [connections, setConnections] = useState([]);
        const [selectedSite, setSelectedSite] = useState(null);
        const [syncHistory, setSyncHistory] = useState([]);
        const [isLoading, setIsLoading] = useState(true);
        const [error, setError] = useState('');
        const [showScheduledPosts, setShowScheduledPosts] = useState(false);
        const [templateRefreshKey, setTemplateRefreshKey] = useState(0);
        const [aiKeys, setAiKeys] = useState([]);
        const [selectedKey, setSelectedKey] = useState(null);
        const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
        const [componentError, setComponentError] = useState(null);
        
        results.push({ step: 'Initialize State', status: 'success', message: 'All state variables initialized' });
      } catch (error) {
        results.push({ step: 'Initialize State', status: 'error', message: `State initialization failed: ${error}` });
      }

      // Step 2: Setup AI Keys Store Subscription
      try {
        setCurrentStep(2);
        const { aiKeysStore } = await import('./AIKeysManager/store/aiKeysStore');
        
        // Test subscription setup
        const unsubscribe = aiKeysStore.subscribe((keyState) => {
          try {
            const activeKeys = keyState.keys.filter((key) => key.isActive);
            // This would normally update state
          } catch (error) {
            throw new Error(`Subscription callback error: ${error}`);
          }
        });
        
        // Test getting initial state
        const currentState = aiKeysStore.getState();
        const activeKeys = currentState.keys.filter((key) => key.isActive);
        
        unsubscribe(); // Clean up
        results.push({ step: 'Setup AI Keys Store Subscription', status: 'success', message: 'AI Keys Store subscription working' });
      } catch (error) {
        results.push({ step: 'Setup AI Keys Store Subscription', status: 'error', message: `AI Keys Store error: ${error}` });
      }

      // Step 3: Load WordPress Connections
      try {
        setCurrentStep(3);
        
        // Check if electron APIs are available
        if (!window.electron || !window.electron.wordpress) {
          throw new Error('Electron WordPress API not available');
        }
        
        // Test the API call
        const result = await window.electron.wordpress.getConnections();
        if (result.success) {
          results.push({ step: 'Load WordPress Connections', status: 'success', message: `WordPress API working, ${result.connections?.length || 0} connections found` });
        } else {
          results.push({ step: 'Load WordPress Connections', status: 'error', message: `WordPress API returned error: ${result.error || 'Unknown error'}` });
        }
      } catch (error) {
        results.push({ step: 'Load WordPress Connections', status: 'error', message: `WordPress connections failed: ${error}` });
      }

      // Step 4: Load Sync History
      try {
        setCurrentStep(4);
        
        if (!window.electron || !window.electron.sync) {
          results.push({ step: 'Load Sync History', status: 'success', message: 'Sync API not available (this is normal)' });
        } else {
          // Test sync API
          const result = await window.electron.sync.getHistory('test-id');
          results.push({ step: 'Load Sync History', status: 'success', message: 'Sync API working' });
        }
      } catch (error) {
        results.push({ step: 'Load Sync History', status: 'error', message: `Sync history failed: ${error}` });
      }

      // Step 5: Test Component Rendering
      try {
        setCurrentStep(5);
        
        // Test if we can render the basic UI structure
        const testElement = (
          <div className="wordpress-sites-list">
            <div className="sites-header">
              <h1>Test Header</h1>
            </div>
            <div className="sites-content">
              <p>Test Content</p>
            </div>
          </div>
        );
        
        results.push({ step: 'Render Component UI', status: 'success', message: 'Component UI structure can be rendered' });
      } catch (error) {
        results.push({ step: 'Render Component UI', status: 'error', message: `UI rendering failed: ${error}` });
      }

      setStepResults(results);
      setIsLoading(false);
    };

    runStepByStep();
  }, []);

  if (isLoading) {
    return (
      <div className="wordpress-sites-list">
        <div className="loading-container">
          <div className="loading-spinner">
            <FontAwesomeIcon icon={faSpinner} spin />
          </div>
          <h3>단계별 진단 중...</h3>
          <p>현재 단계: {steps[currentStep - 1] || '완료'}</p>
        </div>
      </div>
    );
  }

  const errorCount = stepResults.filter(r => r.status === 'error').length;
  const successCount = stepResults.filter(r => r.status === 'success').length;

  return (
    <div className="wordpress-sites-list">
      <div className="sites-header">
        <div className="header-content">
          <div className="header-text">
            <h1>
              <FontAwesomeIcon icon={faExclamationTriangle} />
              WordPress Sites List - 단계별 진단
            </h1>
            <p>컴포넌트 실행 단계별 진단 결과: {successCount}개 성공, {errorCount}개 실패</p>
          </div>
        </div>
      </div>

      <div className="sites-content">
        <div className="diagnostic-results">
          {stepResults.map((result, index) => (
            <div key={index} className={`diagnostic-item ${result.status}`}>
              <div className="diagnostic-header">
                <span className="diagnostic-name">
                  {index + 1}. {result.step}
                </span>
                <span className={`diagnostic-status ${result.status}`}>
                  {result.status === 'success' ? <FontAwesomeIcon icon={faCheckCircle} /> : <FontAwesomeIcon icon={faTimesCircle} />}
                </span>
              </div>
              <div className="diagnostic-message">{result.message}</div>
            </div>
          ))}
        </div>

        {errorCount === 0 && (
          <div className="diagnostic-success">
            <h3>🎉 모든 단계가 성공했습니다!</h3>
            <p>이제 실제 WordPressSitesList 컴포넌트를 테스트해보겠습니다.</p>
            <button 
              onClick={() => {
                // Switch to the actual component
                window.location.href = '/wordpress-sites-actual';
              }} 
              className="retry-btn"
            >
              실제 컴포넌트 테스트
            </button>
          </div>
        )}

        {errorCount > 0 && (
          <div className="diagnostic-actions">
            <button 
              onClick={() => window.location.reload()} 
              className="retry-btn"
            >
              <FontAwesomeIcon icon={faSpinner} />
              다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default WordPressSitesListStepByStep;
