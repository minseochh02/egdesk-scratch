/**
 * SSL Analysis Display Component
 * Displays SSL security analysis results
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldAlt } from '../../utils/fontAwesomeIcons';
import type { SSLAnalysisResult } from './analysisHelpers';
import type { SecurityGrade } from '../../services/sslAnalysisService';
import './EGBusinessIdentityResultDemo.css';

interface SSLAnalysisDisplayProps {
  sslAnalysis: SSLAnalysisResult | null;
}

const getGradeClass = (grade: string): string => {
  const normalized = grade.toUpperCase();
  if (normalized.includes('A+')) return 'grade-a-plus';
  if (normalized.includes('A')) return 'grade-a';
  if (normalized.includes('B')) return 'grade-b';
  if (normalized.includes('C')) return 'grade-c';
  if (normalized.includes('D')) return 'grade-d';
  if (normalized.includes('F')) return 'grade-f';
  return 'grade-f';
};

const getGradeColor = (grade: string): string => {
  const normalized = grade.toUpperCase();
  if (normalized.includes('A+')) return '#28a745';
  if (normalized.includes('A')) return '#5cb85c';
  if (normalized.includes('B')) return '#ffa400';
  if (normalized.includes('C')) return '#ff9800';
  if (normalized.includes('D')) return '#ff6b6b';
  if (normalized.includes('F')) return '#e74c3c';
  return '#95a5a6';
};

export const SSLAnalysisDisplay: React.FC<SSLAnalysisDisplayProps> = ({ sslAnalysis }) => {
  if (!sslAnalysis || !sslAnalysis.success || !sslAnalysis.result) {
    return null;
  }

  const { result } = sslAnalysis;
  const grade = result.grade as SecurityGrade;
  const certificate = result.certificate;
  const securityHeaders = result.securityHeaders;

  return (
    <section className="egbusiness-identity-result__panel egbusiness-identity-result__panel--analysis">
      <div className="egbusiness-identity-result__panel-header">
        <span className="egbusiness-identity-result__icon">
          <FontAwesomeIcon icon={faShieldAlt} />
        </span>
        <div>
          <h2>SSL Security Analysis</h2>
          <p>Website security and certificate status</p>
        </div>
      </div>

      {/* Security Grade */}
      {grade && (
        <div className="egbusiness-identity-result__ssl-grade">
          <div className={`egbusiness-identity-result__grade-display ${getGradeClass(grade.grade)}`}>
            <div className="egbusiness-identity-result__grade-letter" style={{ color: getGradeColor(grade.grade) }}>
              {grade.grade}
            </div>
            <div className="egbusiness-identity-result__grade-info">
              <div className="egbusiness-identity-result__grade-score">{grade.score}/100</div>
              <div className="egbusiness-identity-result__grade-description">{grade.description}</div>
            </div>
          </div>

          {(grade.criticalIssues.length > 0 || grade.highIssues.length > 0) && (
            <div className="egbusiness-identity-result__ssl-issues">
              {grade.criticalIssues.length > 0 && (
                <div className="egbusiness-identity-result__issue-category critical">
                  <h5>🚨 Critical Issues ({grade.criticalIssues.length})</h5>
                  <ul>
                    {grade.criticalIssues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {grade.highIssues.length > 0 && (
                <div className="egbusiness-identity-result__issue-category high">
                  <h5>⚠️ High Priority Issues ({grade.highIssues.length})</h5>
                  <ul>
                    {grade.highIssues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Certificate Status */}
      {certificate && certificate.certificateInfo && (
        <div className="egbusiness-identity-result__ssl-details">
          <h4>Certificate Status</h4>
          <div className="egbusiness-identity-result__detail-grid">
            <div>
              <strong>Status:</strong>
              <span className={`egbusiness-identity-result__status-badge ${certificate.certificateStatus}`}>
                {certificate.certificateStatus === 'valid' ? '✅ Valid' : 
                 certificate.certificateStatus === 'expired' ? '❌ Expired' :
                 certificate.certificateStatus === 'self-signed' ? '⚠️ Self-Signed' :
                 '❌ Invalid'}
              </span>
            </div>
            {certificate.certificateInfo.subject && (
              <div>
                <strong>Subject:</strong>
                <span>{certificate.certificateInfo.subject}</span>
              </div>
            )}
            {certificate.certificateInfo.issuer && (
              <div>
                <strong>Issuer:</strong>
                <span>{certificate.certificateInfo.issuer}</span>
              </div>
            )}
            {certificate.certificateInfo.validFrom && (
              <div>
                <strong>Valid From:</strong>
                <span>{new Date(certificate.certificateInfo.validFrom).toLocaleDateString()}</span>
              </div>
            )}
            {certificate.certificateInfo.validTo && (
              <div>
                <strong>Valid To:</strong>
                <span>{new Date(certificate.certificateInfo.validTo).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Security Headers Summary */}
      {securityHeaders && securityHeaders.headers && (
        <div className="egbusiness-identity-result__ssl-headers">
          <h4>Security Headers</h4>
          <div className="egbusiness-identity-result__headers-summary">
            <div>
              <strong>Present:</strong> {securityHeaders.headers.present?.length || 0}
            </div>
            <div>
              <strong>Missing:</strong> {securityHeaders.headers.missing?.length || 0}
            </div>
            <div>
              <strong>Score:</strong> {securityHeaders.score}/100
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

