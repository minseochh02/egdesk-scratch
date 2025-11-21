/**
 * SEO Analysis Display Component
 * Displays Lighthouse SEO analysis results
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faExternalLinkAlt, faSync, faSpinner } from '../../utils/fontAwesomeIcons';
import type { SEOAnalysisResult } from './analysisHelpers';
import './EGBusinessIdentityResultDemo.css';

interface SEOAnalysisDisplayProps {
  seoAnalysis: SEOAnalysisResult | null;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const SEOAnalysisDisplay: React.FC<SEOAnalysisDisplayProps> = ({ seoAnalysis, onRetry, isRetrying = false }) => {
  if (!seoAnalysis) {
    return null;
  }

  // Show error state with retry button
  // Check both success flag and whether scores exist
  const hasError = !seoAnalysis.success || !seoAnalysis.scores;
  
  if (hasError) {
    console.log('[SEOAnalysisDisplay] Showing error state:', {
      success: seoAnalysis.success,
      hasScores: !!seoAnalysis.scores,
      error: seoAnalysis.error,
      hasRetryHandler: !!onRetry
    });
    const isTimeout = seoAnalysis.error?.toLowerCase().includes('timeout') || 
                     seoAnalysis.error?.toLowerCase().includes('connect timeout') ||
                     seoAnalysis.error?.toLowerCase().includes('connection timeout');
    
    return (
      <section className="egbusiness-identity-result__panel egbusiness-identity-result__panel--analysis">
        <div className="egbusiness-identity-result__panel-header">
          <span className="egbusiness-identity-result__icon">
            <FontAwesomeIcon icon={faChartLine} />
          </span>
          <div>
            <h2>SEO Analysis</h2>
            <p>Lighthouse performance metrics for your website</p>
          </div>
        </div>

        <div className="egbusiness-identity-result__error-state">
          <div className="egbusiness-identity-result__error-icon">❌</div>
          <div className="egbusiness-identity-result__error-message">
            <h4>Analysis Failed</h4>
            <p>{seoAnalysis.error || 'Unknown error occurred during SEO analysis'}</p>
            {isTimeout && (
              <p className="egbusiness-identity-result__error-hint">
                The analysis timed out. This may be due to slow network or server response. Please try again.
              </p>
            )}
          </div>
          {onRetry ? (
            <button
              type="button"
              className="egbusiness-identity-result__retry-button"
              onClick={onRetry}
              disabled={isRetrying}
            >
              <FontAwesomeIcon icon={isRetrying ? faSpinner : faSync} spin={isRetrying} />
              <span>{isRetrying ? 'Retrying...' : 'Retry Analysis'}</span>
            </button>
          ) : (
            <p className="egbusiness-identity-result__error-hint" style={{ marginTop: '8px', fontSize: '12px', opacity: 0.7 }}>
              Retry functionality not available
            </p>
          )}
        </div>
      </section>
    );
  }

  const { scores } = seoAnalysis;

  const getScoreColor = (score: number): string => {
    if (score >= 90) return '#0cce6b';
    if (score >= 50) return '#ffa400';
    return '#ff4e42';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Good';
    if (score >= 50) return 'Needs Improvement';
    return 'Poor';
  };

  return (
    <section className="egbusiness-identity-result__panel egbusiness-identity-result__panel--analysis">
      <div className="egbusiness-identity-result__panel-header">
        <span className="egbusiness-identity-result__icon">
          <FontAwesomeIcon icon={faChartLine} />
        </span>
        <div>
          <h2>SEO Analysis</h2>
          <p>Lighthouse performance metrics for your website</p>
        </div>
      </div>

      <div className="egbusiness-identity-result__analysis-grid">
        <div className="egbusiness-identity-result__analysis-card overall">
          <div className="egbusiness-identity-result__analysis-score" style={{ color: getScoreColor(scores.average) }}>
            {scores.average}
          </div>
          <div className="egbusiness-identity-result__analysis-label">Overall Score</div>
          <div className="egbusiness-identity-result__analysis-status">{getScoreLabel(scores.average)}</div>
        </div>

        <div className="egbusiness-identity-result__analysis-card">
          <div className="egbusiness-identity-result__analysis-score" style={{ color: getScoreColor(scores.performance) }}>
            {scores.performance}
          </div>
          <div className="egbusiness-identity-result__analysis-label">Performance</div>
          <div className="egbusiness-identity-result__analysis-status">{getScoreLabel(scores.performance)}</div>
        </div>

        <div className="egbusiness-identity-result__analysis-card">
          <div className="egbusiness-identity-result__analysis-score" style={{ color: getScoreColor(scores.accessibility) }}>
            {scores.accessibility}
          </div>
          <div className="egbusiness-identity-result__analysis-label">Accessibility</div>
          <div className="egbusiness-identity-result__analysis-status">{getScoreLabel(scores.accessibility)}</div>
        </div>

        <div className="egbusiness-identity-result__analysis-card">
          <div className="egbusiness-identity-result__analysis-score" style={{ color: getScoreColor(scores.bestPractices) }}>
            {scores.bestPractices}
          </div>
          <div className="egbusiness-identity-result__analysis-label">Best Practices</div>
          <div className="egbusiness-identity-result__analysis-status">{getScoreLabel(scores.bestPractices)}</div>
        </div>

        <div className="egbusiness-identity-result__analysis-card">
          <div className="egbusiness-identity-result__analysis-score" style={{ color: getScoreColor(scores.seo) }}>
            {scores.seo}
          </div>
          <div className="egbusiness-identity-result__analysis-label">SEO</div>
          <div className="egbusiness-identity-result__analysis-status">{getScoreLabel(scores.seo)}</div>
        </div>

        <div className="egbusiness-identity-result__analysis-card">
          <div className="egbusiness-identity-result__analysis-score" style={{ color: getScoreColor(scores.pwa) }}>
            {scores.pwa}
          </div>
          <div className="egbusiness-identity-result__analysis-label">PWA</div>
          <div className="egbusiness-identity-result__analysis-status">{getScoreLabel(scores.pwa)}</div>
        </div>
      </div>

      <div className="egbusiness-identity-result__analysis-footer">
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {onRetry && (
            <button
              type="button"
              className="egbusiness-identity-result__retry-button"
              onClick={onRetry}
              disabled={isRetrying}
              style={{ marginTop: 0 }}
            >
              <FontAwesomeIcon icon={isRetrying ? faSpinner : faSync} spin={isRetrying} />
              <span>{isRetrying ? 'Retrying...' : 'Retry Analysis'}</span>
            </button>
          )}
      {seoAnalysis.reportPath && (
          <button
            type="button"
            className="egbusiness-identity-result__report-button"
            onClick={async () => {
              try {
                if (window.electron?.shell?.openPath) {
                  const result = await window.electron.shell.openPath(seoAnalysis.reportPath!);
                  if (!result.success) {
                    console.error('[SEOAnalysisDisplay] Failed to open report:', result.error);
                    alert(`Failed to open report: ${result.error || 'Unknown error'}`);
                  }
                } else {
                  // Fallback: try to open in default browser
                  window.open(`file://${seoAnalysis.reportPath}`, '_blank');
                }
              } catch (error) {
                console.error('[SEOAnalysisDisplay] Error opening report:', error);
                alert(`Error opening report: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }}
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} />
            <span>Open Full Lighthouse Report</span>
          </button>
          )}
        </div>
      </div>
    </section>
  );
};

