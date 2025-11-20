import React, { useState, useEffect } from 'react';
import { SSLAnalysisService, WebsiteAccessibilityResult, SSLCertificateResult, SecurityHeadersResult, SecurityGrade, BusinessImpactResult, OverallSecurityResult } from '../../services/sslAnalysisService';
import { HTMLReportService } from '../../services/htmlReportService';
import { SSLAnalysisStorageService, StoredSSLAnalysis, SSLAnalysisStats } from '../../services/sslAnalysisStorageService';
import './SSLAnalyzer.css';

interface SSLAnalyzerProps {}

// Helper functions for certificate status display
const getCertificateStatusIcon = (status: string): string => {
  switch (status) {
    case 'valid': return '✅';
    case 'expired': return '❌';
    case 'self-signed': return '⚠️';
    case 'invalid': return '❌';
    case 'error': return '❌';
    default: return '❓';
  }
};

const getCertificateStatusClass = (status: string): string => {
  switch (status) {
    case 'valid': return 'success';
    case 'expired': return 'error';
    case 'self-signed': return 'warning';
    case 'invalid': return 'error';
    case 'error': return 'error';
    default: return 'error';
  }
};

const getCertificateStatusKorean = (status: string): string => {
  switch (status) {
    case 'valid': return 'Valid';
    case 'expired': return 'Expired';
    case 'self-signed': return 'Self-signed';
    case 'invalid': return 'Invalid';
    case 'error': return 'Error';
    default: return 'Unknown';
  }
};

const getSecurityScoreClass = (score: number): string => {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'error';
};

const getGradeClass = (grade: string): string => {
  switch (grade) {
    case 'A+': return 'grade-a-plus';
    case 'A': return 'grade-a';
    case 'B': return 'grade-b';
    case 'C': return 'grade-c';
    case 'D': return 'grade-d';
    case 'F': return 'grade-f';
    default: return 'grade-f';
  }
};

const SSLAnalyzer: React.FC<SSLAnalyzerProps> = () => {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [accessibilityData, setAccessibilityData] = useState<WebsiteAccessibilityResult | null>(null);
  const [certificateData, setCertificateData] = useState<SSLCertificateResult | null>(null);
  const [securityHeadersData, setSecurityHeadersData] = useState<SecurityHeadersResult | null>(null);
  const [securityGrade, setSecurityGrade] = useState<SecurityGrade | null>(null);
  const [businessImpact, setBusinessImpact] = useState<BusinessImpactResult | null>(null);
  const [completeAnalysis, setCompleteAnalysis] = useState<OverallSecurityResult | null>(null);
  
  // Analysis history state
  const [analysisHistory, setAnalysisHistory] = useState<StoredSSLAnalysis[]>([]);
  const [analysisStats, setAnalysisStats] = useState<SSLAnalysisStats | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<StoredSSLAnalysis | null>(null);

  // Load analysis history on component mount
  useEffect(() => {
    loadAnalysisHistory();
    loadAnalysisStats();
  }, []);

  const loadAnalysisHistory = async () => {
    try {
      const analyses = await SSLAnalysisStorageService.getAnalyses();
      setAnalysisHistory(analyses);
    } catch (error) {
      console.error('Error loading analysis history:', error);
    }
  };

  const loadAnalysisStats = async () => {
    try {
      const stats = await SSLAnalysisStorageService.getAnalysisStats();
      setAnalysisStats(stats);
    } catch (error) {
      console.error('Error loading analysis stats:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!websiteUrl.trim()) {
      alert('Please enter a blog URL');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAccessibilityData(null);
    setCertificateData(null);
    setSecurityHeadersData(null);
    setSecurityGrade(null);
    setBusinessImpact(null);
    setCompleteAnalysis(null);

    try {
      // Perform complete SSL analysis (Steps 1, 2, 3 & 4)
      const completeAnalysis = await SSLAnalysisService.performCompleteAnalysis(websiteUrl);
      
      setAccessibilityData(completeAnalysis.accessibility);
      setCertificateData(completeAnalysis.certificate);
      setSecurityHeadersData(completeAnalysis.securityHeaders);
      setSecurityGrade(completeAnalysis.grade);
      setBusinessImpact(completeAnalysis.businessImpact);
      setCompleteAnalysis(completeAnalysis);
      setAnalysisResult(completeAnalysis.combinedReport);
      
      // Save analysis to storage
      try {
        await SSLAnalysisStorageService.saveAnalysis(websiteUrl, completeAnalysis);
        // Reload history and stats after saving
        await loadAnalysisHistory();
        await loadAnalysisStats();
      } catch (saveError) {
        console.error('Error saving analysis:', saveError);
        // Don't show error to user as analysis was successful
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setAnalysisResult(`Error analyzing ${websiteUrl}: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWebsiteUrl(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAnalyze();
    }
  };

  const handleOpenHTMLReport = () => {
    if (!completeAnalysis) {
      alert('Please analyze the blog first');
      return;
    }

    try {
      HTMLReportService.openHTMLReport(completeAnalysis, websiteUrl);
    } catch (error) {
      console.error('Error generating HTML report:', error);
      alert('An error occurred while generating the HTML report');
    }
  };

  const handleSaveHTMLReport = () => {
    if (!completeAnalysis) {
      alert('Please analyze the blog first');
      return;
    }

    try {
      HTMLReportService.saveHTMLReport(completeAnalysis, websiteUrl);
    } catch (error) {
      console.error('Error saving HTML report:', error);
      alert('An error occurred while saving the HTML report');
    }
  };

  const handleDownloadText = () => {
    if (!completeAnalysis) {
      alert('Please analyze the blog first');
      return;
    }

    const textReport = completeAnalysis.combinedReport;
    const blob = new Blob([textReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SSL_Security_Analysis_${websiteUrl.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Analysis history handlers
  const handleShowHistory = () => {
    setShowHistory(true);
    loadAnalysisHistory();
  };

  const handleHideHistory = () => {
    setShowHistory(false);
    setSelectedAnalysis(null);
  };

  const handleSelectAnalysis = (analysis: StoredSSLAnalysis) => {
    setSelectedAnalysis(analysis);
    setWebsiteUrl(analysis.websiteUrl);
    setAccessibilityData(analysis.analysis.accessibility);
    setCertificateData(analysis.analysis.certificate);
    setSecurityHeadersData(analysis.analysis.securityHeaders);
    setSecurityGrade(analysis.analysis.grade);
    setBusinessImpact(analysis.analysis.businessImpact);
    setCompleteAnalysis(analysis.analysis);
    setAnalysisResult(analysis.analysis.combinedReport);
    setShowHistory(false);
  };

  const handleDeleteAnalysis = async (analysisId: string) => {
    if (confirm('Do you want to delete this analysis?')) {
      try {
        await SSLAnalysisStorageService.deleteAnalysis(analysisId);
        await loadAnalysisHistory();
        await loadAnalysisStats();
        if (selectedAnalysis?.id === analysisId) {
          setSelectedAnalysis(null);
        }
      } catch (error) {
        console.error('Error deleting analysis:', error);
        alert('An error occurred while deleting the analysis');
      }
    }
  };

  const handleSearchAnalyses = async () => {
    try {
      if (searchQuery.trim()) {
        const analyses = await SSLAnalysisStorageService.searchAnalyses(searchQuery);
        setAnalysisHistory(analyses);
      } else {
        await loadAnalysisHistory();
      }
    } catch (error) {
      console.error('Error searching analyses:', error);
    }
  };

  const handleExportAnalyses = async () => {
    try {
      const exportData = await SSLAnalysisStorageService.exportAnalyses();
      const blob = new Blob([exportData], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SSL_Analysis_History_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting analyses:', error);
      alert('An error occurred while exporting the analysis history');
    }
  };

  return (
    <div className="ssl-analyzer-container">
      <div className="ssl-analyzer-scroll">
        <div className="ssl-analyzer">
          <div className="ssl-analyzer-header">
            <h1>Blog Security Analysis</h1>
            <p>Analyze SSL certificates and security settings of your blog</p>
          </div>

          <div className="ssl-analyzer-input-section">
            <div className="input-group">
              <input
                type="url"
                value={websiteUrl}
                onChange={handleUrlChange}
                onKeyPress={handleKeyPress}
                placeholder="Enter blog URL (e.g., https://example.com)"
                className="url-input"
                disabled={isAnalyzing}
              />
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !websiteUrl.trim()}
                className="analyze-button"
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze This Blog'}
              </button>
            </div>
            
            <div className="analyzer-actions">
              <button
                onClick={handleShowHistory}
                className="history-button"
                title="View Analysis History"
              >
                📊 Analysis History ({analysisHistory.length})
              </button>
              {analysisStats && (
                <div className="stats-summary">
                  <span>Average Score: {analysisStats.averageScore}/100</span>
                  <span>Total Analyses: {analysisStats.totalAnalyses}</span>
                </div>
              )}
            </div>
          </div>

          {analysisResult && (
            <div className="ssl-analyzer-result">
              <div className="result-header">
                <h3>Analysis Results</h3>
                 <div className="download-buttons">
                   <button
                     onClick={handleOpenHTMLReport}
                     className="download-button html-button"
                     title="Preview HTML Report"
                   >
                     👁️ Preview
                   </button>
                   <button
                     onClick={handleSaveHTMLReport}
                     className="download-button html-save-button"
                     title="Save HTML Report"
                   >
                     💾 Save HTML
                   </button>
                   <button
                     onClick={handleDownloadText}
                     className="download-button text-button"
                     title="Download Text Report"
                   >
                     📝 Download Text
                   </button>
                 </div>
              </div>
              
              {securityGrade && (
                <div className="security-grade-section">
                  <div className={`security-grade ${getGradeClass(securityGrade.grade)}`}>
                    <div className="grade-display">
                      <span className="grade-letter">{securityGrade.grade}</span>
                      <span className="grade-score">{securityGrade.score}/100</span>
                    </div>
                    <div className="grade-description">{securityGrade.description}</div>
                  </div>
                  
                  <div className="issues-summary">
                    {securityGrade.criticalIssues.length > 0 && (
                      <div className="issue-category critical">
                        <h4>🚨 Critical Issues ({securityGrade.criticalIssues.length})</h4>
                        <ul>
                          {securityGrade.criticalIssues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {securityGrade.highIssues.length > 0 && (
                      <div className="issue-category high">
                        <h4>⚠️ High Priority ({securityGrade.highIssues.length})</h4>
                        <ul>
                          {securityGrade.highIssues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {securityGrade.mediumIssues.length > 0 && (
                      <div className="issue-category medium">
                        <h4>🔶 Medium Priority ({securityGrade.mediumIssues.length})</h4>
                        <ul>
                          {securityGrade.mediumIssues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {securityGrade.lowIssues.length > 0 && (
                      <div className="issue-category low">
                        <h4>🔸 Low Priority ({securityGrade.lowIssues.length})</h4>
                        <ul>
                          {securityGrade.lowIssues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="result-content">
                <pre>{analysisResult}</pre>
              </div>
              
              {accessibilityData && (
                <div className="analysis-details">
                  <h4>Blog Accessibility</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Blog Status:</span>
                      <span className={`detail-value ${accessibilityData.accessible ? 'success' : 'error'}`}>
                        {accessibilityData.accessible ? '✅ Accessible' : '❌ Not Accessible'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">SSL Status:</span>
                      <span className={`detail-value ${accessibilityData.hasSSL ? 'success' : 'error'}`}>
                        {accessibilityData.hasSSL ? '🔒 SSL Available' : '❌ No SSL'}
                      </span>
                    </div>
                    {accessibilityData.connectionDetails && (
                      <>
                        <div className="detail-item">
                          <span className="detail-label">Connection Time:</span>
                          <span className="detail-value">{accessibilityData.connectionDetails.connectionTime}ms</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Hostname:</span>
                          <span className="detail-value">{accessibilityData.connectionDetails.hostname}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Port:</span>
                          <span className="detail-value">{accessibilityData.connectionDetails.port}</span>
                        </div>
                      </>
                    )}
                    {accessibilityData.error && (
                      <div className="detail-item error-item">
                        <span className="detail-label">Error:</span>
                        <span className="detail-value error-text">{accessibilityData.error}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {certificateData && certificateData.certificateInfo && (
                <div className="analysis-details">
                  <h4>SSL Certificate Details</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Certificate Status:</span>
                      <span className={`detail-value ${getCertificateStatusClass(certificateData.certificateStatus)}`}>
                        {getCertificateStatusIcon(certificateData.certificateStatus)} {getCertificateStatusKorean(certificateData.certificateStatus)}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Subject:</span>
                      <span className="detail-value">{certificateData.certificateInfo.subject}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Issuer:</span>
                      <span className="detail-value">{certificateData.certificateInfo.issuer}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Valid From:</span>
                      <span className="detail-value">{new Date(certificateData.certificateInfo.validFrom).toLocaleDateString()}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Valid Until:</span>
                      <span className="detail-value">{new Date(certificateData.certificateInfo.validTo).toLocaleDateString()}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Days Until Expiry:</span>
                      <span className={`detail-value ${certificateData.certificateInfo.daysUntilExpiry < 30 ? 'warning' : 'success'}`}>
                        {certificateData.certificateInfo.daysUntilExpiry} days
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Serial Number:</span>
                      <span className="detail-value">{certificateData.certificateInfo.serialNumber}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Fingerprint:</span>
                      <span className="detail-value">{certificateData.certificateInfo.fingerprint}</span>
                    </div>
                  </div>
                </div>
              )}

              {securityGrade && (
                <div className="analysis-details security-grade-section">
                  <h4>Security Grade</h4>
                  <div className="security-grade">
                    <div className={`grade-display ${getGradeClass(securityGrade.grade)}`}>
                      <div className="grade-letter">{securityGrade.grade}</div>
                      <div className="grade-score">{securityGrade.score}/100</div>
                      <div className="grade-description">{securityGrade.description}</div>
                    </div>
                    
                    <div className="issues-summary">
                      {securityGrade.criticalIssues.length > 0 && (
                        <div className="issue-category critical">
                          <h5>🚨 Critical Issues ({securityGrade.criticalIssues.length})</h5>
                          <ul>
                            {securityGrade.criticalIssues.map((issue, index) => (
                              <li key={index}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {securityGrade.highIssues.length > 0 && (
                        <div className="issue-category high">
                          <h5>⚠️ High Risk ({securityGrade.highIssues.length})</h5>
                          <ul>
                            {securityGrade.highIssues.map((issue, index) => (
                              <li key={index}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {securityGrade.mediumIssues.length > 0 && (
                        <div className="issue-category medium">
                          <h5>🟡 Medium Risk ({securityGrade.mediumIssues.length})</h5>
                          <ul>
                            {securityGrade.mediumIssues.map((issue, index) => (
                              <li key={index}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {securityGrade.lowIssues.length > 0 && (
                        <div className="issue-category low">
                          <h5>🔵 Low Risk ({securityGrade.lowIssues.length})</h5>
                          <ul>
                            {securityGrade.lowIssues.map((issue, index) => (
                              <li key={index}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {businessImpact && (
                <div className="analysis-details business-impact-section">
                  <h4>Business Impact Analysis</h4>
                  <div className="business-impact">
                    <div className="impact-summary">
                      <div className="impact-item">
                        <span className="impact-label">Annual Estimated Loss:</span>
                        <span className="impact-value loss">${businessImpact.annualLoss.toLocaleString()}</span>
                      </div>
                      <div className="impact-item">
                        <span className="impact-label">Security Loss Rate:</span>
                        <span className="impact-value">{businessImpact.securityLossRate * 100}%</span>
                      </div>
                      <div className="impact-item">
                        <span className="impact-label">SEO Ranking Drop:</span>
                        <span className="impact-value">{businessImpact.seoRankingLoss}%</span>
                      </div>
                      <div className="impact-item">
                        <span className="impact-label">Customer Trust Damage:</span>
                        <span className="impact-value">{businessImpact.customerTrustLoss}%</span>
                      </div>
                      <div className="impact-item">
                        <span className="impact-label">Brand Image:</span>
                        <span className="impact-value">{businessImpact.brandImageImpact}</span>
                      </div>
                    </div>
                    
                    <div className="investment-analysis">
                      <h5>Investment Analysis</h5>
                      <div className="investment-grid">
                        <div className="investment-item">
                          <span className="investment-label">Recommended Investment Cost:</span>
                          <span className="investment-value">${businessImpact.investmentCost.toLocaleString()}</span>
                        </div>
                        <div className="investment-item">
                          <span className="investment-label">Annual Net Profit:</span>
                          <span className={`investment-value ${businessImpact.netBenefit > 0 ? 'positive' : 'negative'}`}>
                            ${businessImpact.netBenefit.toLocaleString()}
                          </span>
                        </div>
                        <div className="investment-item">
                          <span className="investment-label">ROI:</span>
                          <span className={`investment-value roi ${businessImpact.roi > 10 ? 'high' : businessImpact.roi > 5 ? 'medium' : 'low'}`}>
                            {businessImpact.roi.toFixed(1)}x ROI
                          </span>
                        </div>
                      </div>
                      
                      <div className="roi-conclusion">
                        {businessImpact.roi > 10 ? (
                          <div className="conclusion high">✅ Immediate Investment Recommended (High ROI)</div>
                        ) : businessImpact.roi > 5 ? (
                          <div className="conclusion medium">✅ Investment Recommended (Good ROI)</div>
                        ) : businessImpact.roi > 0 ? (
                          <div className="conclusion low">⚠️ Careful Review Needed</div>
                        ) : (
                          <div className="conclusion none">❌ Minimal Investment Effect</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {securityHeadersData && (
                <div className="analysis-details">
                  <h4>Security Headers Analysis</h4>
                  <div className="security-score">
                    <span className="detail-label">Security Score:</span>
                    <span className={`detail-value ${getSecurityScoreClass(securityHeadersData.securityScore)}`}>
                      {securityHeadersData.securityScore}/100
                    </span>
                  </div>
                  
                  <div className="headers-grid">
                    {securityHeadersData.headers.map((header, index) => (
                      <div key={index} className={`header-item ${header.present ? 'present' : 'missing'}`}>
                        <div className="header-name">
                          {header.present ? '✅' : '❌'} {header.name}
                          {header.recommended && <span className="recommended-tag">Recommended</span>}
                        </div>
                        <div className="header-description">{header.description}</div>
                        {header.present && header.value && (
                          <div className="header-value">Value: {header.value}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {securityHeadersData.missingHeaders.length > 0 && (
                    <div className="missing-headers">
                      <h5>Missing Recommended Headers:</h5>
                      <ul>
                        {securityHeadersData.missingHeaders.map((header, index) => (
                          <li key={index}>{header}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {securityHeadersData.recommendations.length > 0 && (
                    <div className="recommendations">
                      <h5>Recommendations:</h5>
                      <ul>
                        {securityHeadersData.recommendations.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Analysis History Modal */}
          {showHistory && (
            <div className="history-modal-overlay">
              <div className="history-modal">
                <div className="history-modal-header">
                  <h2>SSL Analysis History</h2>
                  <div className="history-actions">
                    <div className="search-group">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="search-input"
                      />
                      <button onClick={handleSearchAnalyses} className="search-button">
                        🔍
                      </button>
                    </div>
                    <button onClick={handleExportAnalyses} className="export-button">
                      📤 Export
                    </button>
                    <button onClick={handleHideHistory} className="close-button">
                      ✕
                    </button>
                  </div>
                </div>
                
                <div className="history-content">
                  {analysisStats && (
                    <div className="history-stats">
                      <div className="stat-item">
                        <span className="stat-label">Total Analyses:</span>
                        <span className="stat-value">{analysisStats.totalAnalyses}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Average Score:</span>
                        <span className="stat-value">{analysisStats.averageScore}/100</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Grade Distribution:</span>
                        <div className="grade-distribution">
                          {Object.entries(analysisStats.gradeDistribution).map(([grade, count]) => (
                            <span key={grade} className="grade-stat">
                              {grade}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="analysis-list">
                    {analysisHistory.length === 0 ? (
                      <div className="no-analyses">
                        <p>No analysis history available.</p>
                      </div>
                    ) : (
                      analysisHistory.map((analysis) => {
                        const summary = SSLAnalysisStorageService.getAnalysisSummary(analysis);
                        return (
                          <div key={analysis.id} className="analysis-item">
                            <div className="analysis-info">
                              <div className="analysis-url">{summary.url}</div>
                              <div className="analysis-details">
                                <span className={`grade-badge ${getGradeClass(summary.grade)}`}>
                                  {summary.grade} ({summary.score}/100)
                                </span>
                                <span className="analysis-date">{summary.date}</span>
                                {summary.hasIssues && (
                                  <span className="issues-indicator">
                                    ⚠️ {summary.criticalIssues} issues
                                  </span>
                                )}
                              </div>
                              {analysis.tags && analysis.tags.length > 0 && (
                                <div className="analysis-tags">
                                  {analysis.tags.map((tag, index) => (
                                    <span key={index} className="tag">#{tag}</span>
                                  ))}
                                </div>
                              )}
                              {analysis.notes && (
                                <div className="analysis-notes">{analysis.notes}</div>
                              )}
                            </div>
                            <div className="analysis-actions">
                              <button
                                onClick={() => handleSelectAnalysis(analysis)}
                                className="select-button"
                                title="View this analysis"
                              >
                                👁️ View
                              </button>
                              <button
                                onClick={() => handleDeleteAnalysis(analysis.id)}
                                className="delete-button"
                                title="Delete this analysis"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SSLAnalyzer;
