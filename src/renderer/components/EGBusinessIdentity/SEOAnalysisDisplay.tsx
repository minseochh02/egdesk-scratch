/**
 * SEO Analysis Display Component
 * Displays Lighthouse SEO analysis results
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine } from '../../utils/fontAwesomeIcons';
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
          <p className="egbusiness-identity-result__hint">
            Full Lighthouse report available at: {seoAnalysis.reportPath}
          </p>
        </div>
      )}
    </section>
  );
};

