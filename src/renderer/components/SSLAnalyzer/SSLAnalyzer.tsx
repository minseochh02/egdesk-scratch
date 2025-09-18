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
    case 'valid': return '유효함';
    case 'expired': return '만료됨';
    case 'self-signed': return '자체 서명';
    case 'invalid': return '유효하지 않음';
    case 'error': return '오류';
    default: return '알 수 없음';
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
      alert('웹사이트 URL을 입력해주세요');
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
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
      setAnalysisResult(`${websiteUrl} 분석 중 오류: ${errorMessage}`);
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
      alert('먼저 웹사이트를 분석해주세요');
      return;
    }

    try {
      HTMLReportService.openHTMLReport(completeAnalysis, websiteUrl);
    } catch (error) {
      console.error('HTML 보고서 생성 중 오류:', error);
      alert('HTML 보고서 생성 중 오류가 발생했습니다');
    }
  };

  const handleSaveHTMLReport = () => {
    if (!completeAnalysis) {
      alert('먼저 웹사이트를 분석해주세요');
      return;
    }

    try {
      HTMLReportService.saveHTMLReport(completeAnalysis, websiteUrl);
    } catch (error) {
      console.error('HTML 보고서 저장 중 오류:', error);
      alert('HTML 보고서 저장 중 오류가 발생했습니다');
    }
  };

  const handleDownloadText = () => {
    if (!completeAnalysis) {
      alert('먼저 웹사이트를 분석해주세요');
      return;
    }

    const textReport = completeAnalysis.combinedReport;
    const blob = new Blob([textReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SSL_보안분석_${websiteUrl.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
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
    if (confirm('이 분석을 삭제하시겠습니까?')) {
      try {
        await SSLAnalysisStorageService.deleteAnalysis(analysisId);
        await loadAnalysisHistory();
        await loadAnalysisStats();
        if (selectedAnalysis?.id === analysisId) {
          setSelectedAnalysis(null);
        }
      } catch (error) {
        console.error('Error deleting analysis:', error);
        alert('분석 삭제 중 오류가 발생했습니다');
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
      link.download = `SSL_분석_내역_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting analyses:', error);
      alert('분석 내역 내보내기 중 오류가 발생했습니다');
    }
  };

  return (
    <div className="ssl-analyzer">
      <div className="ssl-analyzer-header">
        <h1>사이트 보안 분석</h1>
        <p>웹사이트의 SSL 인증서와 보안 설정을 분석합니다</p>
      </div>

      <div className="ssl-analyzer-input-section">
        <div className="input-group">
          <input
            type="url"
            value={websiteUrl}
            onChange={handleUrlChange}
            onKeyPress={handleKeyPress}
            placeholder="웹사이트 URL을 입력하세요 (예: https://example.com)"
            className="url-input"
            disabled={isAnalyzing}
          />
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !websiteUrl.trim()}
            className="analyze-button"
          >
            {isAnalyzing ? '분석 중...' : '이 웹사이트 분석하기'}
          </button>
        </div>
        
        <div className="analyzer-actions">
          <button
            onClick={handleShowHistory}
            className="history-button"
            title="분석 내역 보기"
          >
            📊 분석 내역 ({analysisHistory.length})
          </button>
          {analysisStats && (
            <div className="stats-summary">
              <span>평균 점수: {analysisStats.averageScore}/100</span>
              <span>총 분석: {analysisStats.totalAnalyses}개</span>
            </div>
          )}
        </div>
      </div>

      {analysisResult && (
        <div className="ssl-analyzer-result">
          <div className="result-header">
            <h3>분석 결과</h3>
             <div className="download-buttons">
               <button
                 onClick={handleOpenHTMLReport}
                 className="download-button html-button"
                 title="HTML 보고서 미리보기"
               >
                 👁️ 미리보기
               </button>
               <button
                 onClick={handleSaveHTMLReport}
                 className="download-button html-save-button"
                 title="HTML 보고서 저장"
               >
                 💾 HTML 저장
               </button>
               <button
                 onClick={handleDownloadText}
                 className="download-button text-button"
                 title="텍스트 보고서 다운로드"
               >
                 📝 텍스트 다운로드
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
                    <h4>🚨 치명적 문제점 ({securityGrade.criticalIssues.length})</h4>
                    <ul>
                      {securityGrade.criticalIssues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {securityGrade.highIssues.length > 0 && (
                  <div className="issue-category high">
                    <h4>⚠️ 높은 우선순위 ({securityGrade.highIssues.length})</h4>
                    <ul>
                      {securityGrade.highIssues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {securityGrade.mediumIssues.length > 0 && (
                  <div className="issue-category medium">
                    <h4>🔶 중간 우선순위 ({securityGrade.mediumIssues.length})</h4>
                    <ul>
                      {securityGrade.mediumIssues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {securityGrade.lowIssues.length > 0 && (
                  <div className="issue-category low">
                    <h4>🔸 낮은 우선순위 ({securityGrade.lowIssues.length})</h4>
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
              <h4>웹사이트 접근성</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">웹사이트 상태:</span>
                  <span className={`detail-value ${accessibilityData.accessible ? 'success' : 'error'}`}>
                    {accessibilityData.accessible ? '✅ 접근 가능' : '❌ 접근 불가'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">SSL 상태:</span>
                  <span className={`detail-value ${accessibilityData.hasSSL ? 'success' : 'error'}`}>
                    {accessibilityData.hasSSL ? '🔒 SSL 사용 가능' : '❌ SSL 없음'}
                  </span>
                </div>
                {accessibilityData.connectionDetails && (
                  <>
                    <div className="detail-item">
                      <span className="detail-label">연결 시간:</span>
                      <span className="detail-value">{accessibilityData.connectionDetails.connectionTime}ms</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">호스트명:</span>
                      <span className="detail-value">{accessibilityData.connectionDetails.hostname}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">포트:</span>
                      <span className="detail-value">{accessibilityData.connectionDetails.port}</span>
                    </div>
                  </>
                )}
                {accessibilityData.error && (
                  <div className="detail-item error-item">
                    <span className="detail-label">오류:</span>
                    <span className="detail-value error-text">{accessibilityData.error}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {certificateData && certificateData.certificateInfo && (
            <div className="analysis-details">
              <h4>SSL 인증서 상세 정보</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">인증서 상태:</span>
                  <span className={`detail-value ${getCertificateStatusClass(certificateData.certificateStatus)}`}>
                    {getCertificateStatusIcon(certificateData.certificateStatus)} {getCertificateStatusKorean(certificateData.certificateStatus)}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">주체:</span>
                  <span className="detail-value">{certificateData.certificateInfo.subject}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">발급자:</span>
                  <span className="detail-value">{certificateData.certificateInfo.issuer}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">유효 시작일:</span>
                  <span className="detail-value">{new Date(certificateData.certificateInfo.validFrom).toLocaleDateString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">유효 종료일:</span>
                  <span className="detail-value">{new Date(certificateData.certificateInfo.validTo).toLocaleDateString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">만료까지 남은 일수:</span>
                  <span className={`detail-value ${certificateData.certificateInfo.daysUntilExpiry < 30 ? 'warning' : 'success'}`}>
                    {certificateData.certificateInfo.daysUntilExpiry}일
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">일련번호:</span>
                  <span className="detail-value">{certificateData.certificateInfo.serialNumber}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">지문:</span>
                  <span className="detail-value">{certificateData.certificateInfo.fingerprint}</span>
                </div>
              </div>
            </div>
          )}

          {securityGrade && (
            <div className="analysis-details security-grade-section">
              <h4>보안 등급</h4>
              <div className="security-grade">
                <div className={`grade-display ${getGradeClass(securityGrade.grade)}`}>
                  <div className="grade-letter">{securityGrade.grade}</div>
                  <div className="grade-score">{securityGrade.score}/100점</div>
                  <div className="grade-description">{securityGrade.description}</div>
                </div>
                
                <div className="issues-summary">
                  {securityGrade.criticalIssues.length > 0 && (
                    <div className="issue-category critical">
                      <h5>🚨 심각한 문제 ({securityGrade.criticalIssues.length}개)</h5>
                      <ul>
                        {securityGrade.criticalIssues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {securityGrade.highIssues.length > 0 && (
                    <div className="issue-category high">
                      <h5>⚠️ 높은 위험 ({securityGrade.highIssues.length}개)</h5>
                      <ul>
                        {securityGrade.highIssues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {securityGrade.mediumIssues.length > 0 && (
                    <div className="issue-category medium">
                      <h5>🟡 중간 위험 ({securityGrade.mediumIssues.length}개)</h5>
                      <ul>
                        {securityGrade.mediumIssues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {securityGrade.lowIssues.length > 0 && (
                    <div className="issue-category low">
                      <h5>🔵 낮은 위험 ({securityGrade.lowIssues.length}개)</h5>
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
              <h4>비즈니스 영향 분석</h4>
              <div className="business-impact">
                <div className="impact-summary">
                  <div className="impact-item">
                    <span className="impact-label">연간 예상 손실:</span>
                    <span className="impact-value loss">{businessImpact.annualLoss.toLocaleString()}원</span>
                  </div>
                  <div className="impact-item">
                    <span className="impact-label">보안 손실률:</span>
                    <span className="impact-value">{businessImpact.securityLossRate * 100}%</span>
                  </div>
                  <div className="impact-item">
                    <span className="impact-label">SEO 순위 하락:</span>
                    <span className="impact-value">{businessImpact.seoRankingLoss}%</span>
                  </div>
                  <div className="impact-item">
                    <span className="impact-label">고객 신뢰도 손상:</span>
                    <span className="impact-value">{businessImpact.customerTrustLoss}%</span>
                  </div>
                  <div className="impact-item">
                    <span className="impact-label">브랜드 이미지:</span>
                    <span className="impact-value">{businessImpact.brandImageImpact}</span>
                  </div>
                </div>
                
                <div className="investment-analysis">
                  <h5>투자 분석</h5>
                  <div className="investment-grid">
                    <div className="investment-item">
                      <span className="investment-label">권장 투자비용:</span>
                      <span className="investment-value">{businessImpact.investmentCost.toLocaleString()}원</span>
                    </div>
                    <div className="investment-item">
                      <span className="investment-label">연간 순이익:</span>
                      <span className={`investment-value ${businessImpact.netBenefit > 0 ? 'positive' : 'negative'}`}>
                        {businessImpact.netBenefit.toLocaleString()}원
                      </span>
                    </div>
                    <div className="investment-item">
                      <span className="investment-label">투자 대비 효과:</span>
                      <span className={`investment-value roi ${businessImpact.roi > 10 ? 'high' : businessImpact.roi > 5 ? 'medium' : 'low'}`}>
                        {businessImpact.roi.toFixed(1)}배 ROI
                      </span>
                    </div>
                  </div>
                  
                  <div className="roi-conclusion">
                    {businessImpact.roi > 10 ? (
                      <div className="conclusion high">✅ 즉시 투자 권장 (높은 ROI)</div>
                    ) : businessImpact.roi > 5 ? (
                      <div className="conclusion medium">✅ 투자 권장 (양호한 ROI)</div>
                    ) : businessImpact.roi > 0 ? (
                      <div className="conclusion low">⚠️ 신중한 검토 필요</div>
                    ) : (
                      <div className="conclusion none">❌ 투자 효과 미미</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {securityHeadersData && (
            <div className="analysis-details">
              <h4>보안 헤더 분석</h4>
              <div className="security-score">
                <span className="detail-label">보안 점수:</span>
                <span className={`detail-value ${getSecurityScoreClass(securityHeadersData.securityScore)}`}>
                  {securityHeadersData.securityScore}/100
                </span>
              </div>
              
              <div className="headers-grid">
                {securityHeadersData.headers.map((header, index) => (
                  <div key={index} className={`header-item ${header.present ? 'present' : 'missing'}`}>
                    <div className="header-name">
                      {header.present ? '✅' : '❌'} {header.name}
                      {header.recommended && <span className="recommended-tag">권장</span>}
                    </div>
                    <div className="header-description">{header.description}</div>
                    {header.present && header.value && (
                      <div className="header-value">값: {header.value}</div>
                    )}
                  </div>
                ))}
              </div>

              {securityHeadersData.missingHeaders.length > 0 && (
                <div className="missing-headers">
                  <h5>누락된 권장 헤더:</h5>
                  <ul>
                    {securityHeadersData.missingHeaders.map((header, index) => (
                      <li key={index}>{header}</li>
                    ))}
                  </ul>
                </div>
              )}

              {securityHeadersData.recommendations.length > 0 && (
                <div className="recommendations">
                  <h5>권장사항:</h5>
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
              <h2>SSL 분석 내역</h2>
              <div className="history-actions">
                <div className="search-group">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="검색..."
                    className="search-input"
                  />
                  <button onClick={handleSearchAnalyses} className="search-button">
                    🔍
                  </button>
                </div>
                <button onClick={handleExportAnalyses} className="export-button">
                  📤 내보내기
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
                    <span className="stat-label">총 분석 수:</span>
                    <span className="stat-value">{analysisStats.totalAnalyses}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">평균 점수:</span>
                    <span className="stat-value">{analysisStats.averageScore}/100</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">등급 분포:</span>
                    <div className="grade-distribution">
                      {Object.entries(analysisStats.gradeDistribution).map(([grade, count]) => (
                        <span key={grade} className="grade-stat">
                          {grade}: {count}개
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="analysis-list">
                {analysisHistory.length === 0 ? (
                  <div className="no-analyses">
                    <p>분석 내역이 없습니다.</p>
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
                                ⚠️ {summary.criticalIssues}개 문제
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
                            title="이 분석 보기"
                          >
                            👁️ 보기
                          </button>
                          <button
                            onClick={() => handleDeleteAnalysis(analysis.id)}
                            className="delete-button"
                            title="이 분석 삭제"
                          >
                            🗑️ 삭제
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
  );
};

export default SSLAnalyzer;
