/**
 * SEO Analysis Display Component
 * Displays Lighthouse SEO analysis results
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faExternalLinkAlt } from '../../utils/fontAwesomeIcons';
import type { SEOAnalysisResult } from './analysisHelpers';
import './EGBusinessIdentityResultDemo.css';

interface SEOAnalysisDisplayProps {
  seoAnalysis: SEOAnalysisResult | null;
}

export const SEOAnalysisDisplay: React.FC<SEOAnalysisDisplayProps> = ({ seoAnalysis }) => {
  if (!seoAnalysis || !seoAnalysis.success || !seoAnalysis.scores) {
    return null;
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

      {seoAnalysis.reportPath && (
        <div className="egbusiness-identity-result__analysis-footer">
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
        </div>
      )}
    </section>
  );
};

