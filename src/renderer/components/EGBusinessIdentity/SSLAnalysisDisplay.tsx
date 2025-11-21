/**
 * SSL Analysis Display Component
 * Displays SSL security analysis results
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldAlt, faExternalLinkAlt, faSync } from '../../utils/fontAwesomeIcons';
import type { SSLAnalysisResult } from './analysisHelpers';
import type { SecurityGrade } from '../../services/sslAnalysisService';
import { HTMLReportService } from '../../services/htmlReportService';
import './EGBusinessIdentityResultDemo.css';

interface SSLAnalysisDisplayProps {
  sslAnalysis: SSLAnalysisResult | null;
  onRetry?: () => void;
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

export const SSLAnalysisDisplay: React.FC<SSLAnalysisDisplayProps> = ({ sslAnalysis, onRetry }) => {
  if (!sslAnalysis) {
    return null;
  }

  // Show error state with retry button
  // Check both success flag and whether result exists
  const hasError = !sslAnalysis.success || !sslAnalysis.result;
  
  if (hasError) {
    console.log('[SSLAnalysisDisplay] Showing error state:', {
      success: sslAnalysis.success,
      hasResult: !!sslAnalysis.result,
      error: sslAnalysis.error,
      hasRetryHandler: !!onRetry
    });
    const isTimeout = sslAnalysis.error?.toLowerCase().includes('timeout') || 
                     sslAnalysis.error?.toLowerCase().includes('connect timeout') ||
                     sslAnalysis.error?.toLowerCase().includes('connection timeout');
    
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

        <div className="egbusiness-identity-result__error-state">
          <div className="egbusiness-identity-result__error-icon">❌</div>
          <div className="egbusiness-identity-result__error-message">
            <h4>Analysis Failed</h4>
            <p>{sslAnalysis.error || 'Unknown error occurred during SSL analysis'}</p>
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
            >
              <FontAwesomeIcon icon={faSync} />
              <span>Retry Analysis</span>
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

      {/* Report Button and Retry */}
      {result && (
        <div className="egbusiness-identity-result__analysis-footer">
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {onRetry && (
              <button
                type="button"
                className="egbusiness-identity-result__retry-button"
                onClick={onRetry}
                style={{ marginTop: 0 }}
              >
                <FontAwesomeIcon icon={faSync} />
                <span>Retry Analysis</span>
              </button>
            )}
          <button
            type="button"
            className="egbusiness-identity-result__report-button"
            onClick={async () => {
              try {
                if (!result) {
                  console.error('[SSLAnalysisDisplay] No analysis result available');
                  return;
                }

                // Generate HTML report content
                const htmlContent = HTMLReportService.generateHTMLReport(result, sslAnalysis.url);
                
                // Save to a temporary file in the output directory
                const timestamp = Date.now();
                const sanitizedUrl = sslAnalysis.url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
                const fileName = `ssl-security-report-${sanitizedUrl}-${timestamp}.html`;
                
                // Use the same output directory as Lighthouse reports (output/ relative to cwd)
                const outputPath = `output/${fileName}`;
                
                if (window.electron?.fileSystem?.writeFile && window.electron?.invoke) {
                  // Get absolute path first
                  const absolutePath = await window.electron.invoke('get-absolute-output-path', outputPath).catch(() => null);
                  
                  if (absolutePath) {
                    const writeResult = await window.electron.fileSystem.writeFile(absolutePath, htmlContent);
                    
                    if (writeResult.success) {
                      // Open the file
                      if (window.electron?.shell?.openPath) {
                        const openResult = await window.electron.shell.openPath(absolutePath);
                        if (!openResult.success) {
                          console.error('[SSLAnalysisDisplay] Failed to open report:', openResult.error);
                          // Fallback: open in modal
                          HTMLReportService.openHTMLReport(result, sslAnalysis.url);
                        }
                      } else {
                        // Fallback: open in browser
                        window.open(`file://${absolutePath}`, '_blank');
                      }
                    } else {
                      console.error('[SSLAnalysisDisplay] Failed to save report:', writeResult.error);
                      // Fallback: open in modal
                      HTMLReportService.openHTMLReport(result, sslAnalysis.url);
                    }
                  } else {
                    // Fallback: open in modal if we can't get absolute path
                    HTMLReportService.openHTMLReport(result, sslAnalysis.url);
                  }
                } else {
                  // Fallback: open in modal if we can't save to file
                  HTMLReportService.openHTMLReport(result, sslAnalysis.url);
                }
              } catch (error) {
                console.error('[SSLAnalysisDisplay] Error opening report:', error);
                // Fallback: open in modal
                if (result) {
                  HTMLReportService.openHTMLReport(result, sslAnalysis.url);
                } else {
                  alert(`Error opening report: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }
            }}
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} />
            <span>Open Full Security Report</span>
          </button>
          </div>
        </div>
      )}
    </section>
  );
};

