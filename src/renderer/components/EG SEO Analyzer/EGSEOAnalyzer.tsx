import React, { useState, useEffect } from 'react';
import './EGSEOAnalyzer.css';

interface EGSEOAnalyzerProps {}

interface CrawlerStats {
  totalLinks: number;
  internalLinks: number;
  externalLinks: number;
  relativeLinks: number;
  forms: number;
  images: number;
}

interface LinkData {
  href: string;
  text: string;
  title: string;
  target?: string;
}

interface CrawlerResults {
  url: string;
  timestamp: string;
  stats: CrawlerStats;
  links: {
    all: LinkData[];
    internal: LinkData[];
    external: LinkData[];
    relative: LinkData[];
  };
  forms: any[];
  images: any[];
}

interface LighthouseProgress {
  current: number;
  total: number;
  url: string;
  status: 'processing' | 'completed' | 'failed';
  reportName?: string;
  error?: string;
}

interface LighthouseResult {
  url: string;
  success: boolean;
  reportName: string | null;
  error: string | null;
}

const EGSEOAnalyzer: React.FC<EGSEOAnalyzerProps> = () => {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [crawlerResults, setCrawlerResults] = useState<CrawlerResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  
  // Lighthouse generation state
  const [isGeneratingLighthouse, setIsGeneratingLighthouse] = useState(false);
  const [lighthouseProgress, setLighthouseProgress] = useState<LighthouseProgress | null>(null);
  const [lighthouseResults, setLighthouseResults] = useState<LighthouseResult[]>([]);
  const [finalScores, setFinalScores] = useState<any>(null);

  const handleCrawl = async () => {
    if (!websiteUrl.trim()) {
      alert('웹사이트 URL을 입력해주세요');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setCrawlerResults(null);
    setSelectedUrls(new Set());

    try {
      console.log('🕷️ Starting website crawl for:', websiteUrl);
      
      const result = await (window as any).electron.debug.crawlWebsite(
        websiteUrl.trim(),
        undefined, // proxy (optional)
        false // openDevTools
      );

      if (!result?.success) {
        throw new Error(result?.error || 'Crawler failed');
      }

      console.log('✅ Crawl completed:', result.data);
      setCrawlerResults(result.data);
      
      // Collect all unique URLs for lighthouse analysis
      const allUrls = new Set<string>();
      allUrls.add(websiteUrl.trim()); // Main URL
      
      // Add all internal links
      result.data.links.internal.forEach((link: LinkData) => {
        if (link.href) allUrls.add(link.href);
      });
      
      // Add all relative links (normalized)
      result.data.links.relative.forEach((link: LinkData) => {
        if (link.href) {
          const fullUrl = normalizeUrl(link.href, websiteUrl.trim());
          allUrls.add(fullUrl);
        }
      });
      
      setSelectedUrls(allUrls);
      
      // Automatically start Lighthouse analysis
      console.log(`🚀 Auto-starting Lighthouse analysis for ${allUrls.size} URLs...`);
      setTimeout(() => {
        handleGenerateLighthouseReportsAuto(Array.from(allUrls));
      }, 500);
      
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
      setError(`${websiteUrl} 크롤링 중 오류: ${message}`);
      console.error('Crawler error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWebsiteUrl(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCrawl();
    }
  };

  const toggleUrlSelection = (url: string) => {
    const newSelected = new Set(selectedUrls);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedUrls(newSelected);
  };

  // Setup IPC listener for lighthouse progress
  useEffect(() => {
    const handleProgress = (progress: LighthouseProgress) => {
      setLighthouseProgress(progress);
    };

    const unsubscribe = (window as any).electron.ipcRenderer.on('lighthouse-progress', handleProgress);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleGenerateLighthouseReportsAuto = async (urls: string[]) => {
    if (urls.length === 0) return;

    setIsGeneratingLighthouse(true);
    setLighthouseProgress(null);
    setLighthouseResults([]);

    try {
      console.log(`🔍 Starting Lighthouse generation for ${urls.length} URLs...`);

      const result = await (window as any).electron.debug.generateLighthouseReports(
        urls,
        undefined // proxy (optional)
      );

      if (!result?.success) {
        throw new Error(result?.error || 'Lighthouse generation failed');
      }

      console.log('✅ Lighthouse generation completed:', result);
      setLighthouseResults(result.results || []);
      setFinalScores(result.scores || null);
      
      alert(
        `✅ EGDesk SEO 분석 보고서 생성 완료!\n\n` +
        `📊 전체 평균 점수: ${result.scores?.overall || 0}/100\n` +
        `성공: ${result.summary.successful}개\n` +
        `실패: ${result.summary.failed}개\n\n` +
        `📄 통합 PDF: ${result.mergedPdfPath ? '생성됨' : 'N/A'}\n` +
        `📄 통합 JSON: ${result.mergedJsonPath ? '생성됨' : 'N/A'}\n` +
        `📄 최종 리포트: ${result.finalReportPath ? '생성됨' : 'N/A'}\n\n` +
        `보고서는 output/ 폴더에서 확인하세요!`
      );

    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
      alert(`EGDesk SEO 분석 보고서 생성 중 오류: ${message}`);
      console.error('Lighthouse generation error:', err);
    } finally {
      setIsGeneratingLighthouse(false);
      setLighthouseProgress(null);
    }
  };

  const handleGenerateLighthouseReports = async () => {
    if (selectedUrls.size === 0) {
      alert('Lighthouse 보고서를 생성할 URL을 선택해주세요');
      return;
    }

    const urlsArray = Array.from(selectedUrls);
    await handleGenerateLighthouseReportsAuto(urlsArray);
  };

  const normalizeUrl = (href: string, baseUrl: string): string => {
    try {
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return href;
      }
      const base = new URL(baseUrl);
      return new URL(href, base.origin).href;
    } catch {
      return href;
    }
  };

  return (
    <div className="egseo-analyzer">
      <div className="egseo-analyzer-header">
        <h1>EG SEO 분석기</h1>
        <p>웹사이트를 크롤링하고 각 페이지의 EGDesk SEO 분석 보고서를 생성합니다</p>
      </div>

      <div className="egseo-analyzer-input-section">
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
            onClick={handleCrawl}
            disabled={isAnalyzing || !websiteUrl.trim()}
            className="analyze-button"
          >
            {isAnalyzing ? '크롤링 중...' : 'SEO 분석 시작'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {crawlerResults && (
        <div className="crawler-results">
          <div className="results-header">
            <h3>크롤링 결과</h3>
            <div className="stats-summary">
              <div className="stat-card">
                <span className="stat-value">{crawlerResults.stats.totalLinks}</span>
                <span className="stat-label">총 링크</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{crawlerResults.stats.internalLinks}</span>
                <span className="stat-label">내부 링크</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{crawlerResults.stats.externalLinks}</span>
                <span className="stat-label">외부 링크</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{crawlerResults.stats.images}</span>
                <span className="stat-label">이미지</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{crawlerResults.stats.forms}</span>
                <span className="stat-label">폼</span>
              </div>
            </div>
          </div>

          <div className="lighthouse-section">
            <div className="section-header">
              <h4>EGDesk SEO 분석 대상 선택</h4>
              <button
                onClick={handleGenerateLighthouseReports}
                disabled={selectedUrls.size === 0 || isGeneratingLighthouse}
                className="generate-lighthouse-button"
              >
                {isGeneratingLighthouse ? '분석 중...' : `선택한 URL 분석 (${selectedUrls.size}개)`}
              </button>
            </div>

            {/* Progress Indicator */}
            {lighthouseProgress && (
              <div className="lighthouse-progress">
                <div className="progress-header">
                  <span>진행 상황: {lighthouseProgress.current}/{lighthouseProgress.total}</span>
                  <span className={`status-badge ${lighthouseProgress.status}`}>
                    {lighthouseProgress.status === 'processing' ? '처리 중' : 
                     lighthouseProgress.status === 'completed' ? '완료' : '실패'}
                  </span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(lighthouseProgress.current / lighthouseProgress.total) * 100}%` }}
                  />
                </div>
                <div className="progress-url">{lighthouseProgress.url}</div>
                {lighthouseProgress.error && (
                  <div className="progress-error">오류: {lighthouseProgress.error}</div>
                )}
              </div>
            )}

            {/* Final Scores Summary (EGDesk SEO 분석 보고서) */}
            {finalScores && (
              <div className="final-scores">
                <h5>EGDesk SEO 분석 최종 점수 요약</h5>
                <div className="scores-grid">
                  <div className="score-card overall">
                    <div className="score-value">{finalScores.overall}</div>
                    <div className="score-label">전체 평균</div>
                  </div>
                  <div className="score-card">
                    <div className="score-value">{finalScores.performance}</div>
                    <div className="score-label">성능</div>
                  </div>
                  <div className="score-card">
                    <div className="score-value">{finalScores.accessibility}</div>
                    <div className="score-label">접근성</div>
                  </div>
                  <div className="score-card">
                    <div className="score-value">{finalScores.bestPractices}</div>
                    <div className="score-label">모범 사례</div>
                  </div>
                  <div className="score-card">
                    <div className="score-value">{finalScores.seo}</div>
                    <div className="score-label">SEO</div>
                  </div>
                  <div className="score-card">
                    <div className="score-value">{finalScores.pwa}</div>
                    <div className="score-label">PWA</div>
                  </div>
                </div>
              </div>
            )}

            {/* Results Summary */}
            {lighthouseResults.length > 0 && (
              <div className="lighthouse-results">
                <h5>생성된 보고서 ({lighthouseResults.filter(r => r.success).length}/{lighthouseResults.length})</h5>
                <div className="results-list">
                  {lighthouseResults.map((result, index) => (
                    <div key={index} className={`result-item ${result.success ? 'success' : 'failed'}`}>
                      <div className="result-url">{result.url}</div>
                      {result.success ? (
                        <div className="result-status success">
                          ✅ {result.reportName}
                        </div>
                      ) : (
                        <div className="result-status failed">
                          ❌ {result.error || '실패'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="url-list">
              {/* Main URL */}
              <div className="url-item main-url">
                <label className="url-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedUrls.has(crawlerResults.url)}
                    onChange={() => toggleUrlSelection(crawlerResults.url)}
                  />
                  <div className="url-details">
                    <span className="url-href">{crawlerResults.url}</span>
                    <span className="url-badge main">메인 페이지</span>
                  </div>
                </label>
              </div>

              {/* Internal Links */}
              {crawlerResults.links.internal.length > 0 && (
                <>
                  <h5 className="url-category">내부 링크 ({crawlerResults.links.internal.length})</h5>
                  {crawlerResults.links.internal.slice(0, 20).map((link, index) => (
                    <div key={`internal-${index}`} className="url-item">
                      <label className="url-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedUrls.has(link.href)}
                          onChange={() => toggleUrlSelection(link.href)}
                        />
                        <div className="url-details">
                          <span className="url-href">{link.href}</span>
                          {link.text && <span className="url-text">{link.text}</span>}
                        </div>
                      </label>
                    </div>
                  ))}
                  {crawlerResults.links.internal.length > 20 && (
                    <p className="url-overflow">
                      ... 그리고 {crawlerResults.links.internal.length - 20}개 더
                    </p>
                  )}
                </>
              )}

              {/* Relative Links */}
              {crawlerResults.links.relative.length > 0 && (
                <>
                  <h5 className="url-category">상대 경로 링크 ({crawlerResults.links.relative.length})</h5>
                  {crawlerResults.links.relative.slice(0, 10).map((link, index) => {
                    const fullUrl = normalizeUrl(link.href, crawlerResults.url);
                    return (
                      <div key={`relative-${index}`} className="url-item">
                        <label className="url-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedUrls.has(fullUrl)}
                            onChange={() => toggleUrlSelection(fullUrl)}
                          />
                          <div className="url-details">
                            <span className="url-href">{fullUrl}</span>
                            {link.text && <span className="url-text">{link.text}</span>}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                  {crawlerResults.links.relative.length > 10 && (
                    <p className="url-overflow">
                      ... 그리고 {crawlerResults.links.relative.length - 10}개 더
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EGSEOAnalyzer;
