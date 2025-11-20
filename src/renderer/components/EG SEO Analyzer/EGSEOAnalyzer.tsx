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
  const [pdfPath, setPdfPath] = useState<string | null>(null);

  const handleCrawl = async () => {
    if (!websiteUrl.trim()) {
      alert('Please enter a website URL');
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
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(`Error crawling ${websiteUrl}: ${message}`);
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
      setPdfPath(result.mergedPdfPath || null);
      
      alert(
        `✅ EGDesk SEO Analysis Report Generated!\n\n` +
        `📊 Overall Average Score: ${result.scores?.overall || 0}/100\n` +
        `Successful: ${result.summary.successful}\n` +
        `Failed: ${result.summary.failed}\n\n` +
        `📄 Merged PDF: ${result.mergedPdfPath ? 'Generated' : 'N/A'}\n` +
        `📄 Merged JSON: ${result.mergedJsonPath ? 'Generated' : 'N/A'}\n` +
        `📄 Final Report: ${result.finalReportPath ? 'Generated' : 'N/A'}\n\n` +
        `Reports are available in the output/ folder!`
      );

    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      alert(`Error generating EGDesk SEO Analysis Report: ${message}`);
      console.error('Lighthouse generation error:', err);
    } finally {
      setIsGeneratingLighthouse(false);
      setLighthouseProgress(null);
    }
  };

  const handleGenerateLighthouseReports = async () => {
    if (selectedUrls.size === 0) {
      alert('Please select URLs to generate Lighthouse reports');
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

  const handleDownloadPdf = async () => {
    if (!pdfPath) {
      alert('PDF file was not generated.');
      return;
    }

    try {
      // Use Electron's shell to open the file location or download
      await (window as any).electron.shell.openPath(pdfPath);
    } catch (err) {
      console.error('PDF download error:', err);
      alert('Cannot open PDF file. Please check the file path.');
    }
  };

  return (
    <div className="egseo-analyzer-container">
      <div className="egseo-analyzer-scroll">
        <div className="egseo-analyzer">
          <div className="egseo-analyzer-header">
            <h1>EG SEO Analyzer</h1>
            <p>Crawl websites and generate EGDesk SEO analysis reports for each page</p>
          </div>

          <div className="egseo-analyzer-input-section">
            <div className="input-group">
              <input
                type="url"
                value={websiteUrl}
                onChange={handleUrlChange}
                onKeyPress={handleKeyPress}
                placeholder="Enter website URL (e.g., https://example.com)"
                className="url-input"
                disabled={isAnalyzing}
              />
              <button
                onClick={handleCrawl}
                disabled={isAnalyzing || !websiteUrl.trim()}
                className="analyze-button"
              >
                {isAnalyzing ? 'Crawling...' : 'Start SEO Analysis'}
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
                <h3>Crawling Results</h3>
                <div className="stats-summary">
                  <div className="stat-card">
                    <span className="stat-value">{crawlerResults.stats.totalLinks}</span>
                    <span className="stat-label">Total Links</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{crawlerResults.stats.internalLinks}</span>
                    <span className="stat-label">Internal Links</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{crawlerResults.stats.externalLinks}</span>
                    <span className="stat-label">External Links</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{crawlerResults.stats.images}</span>
                    <span className="stat-label">Images</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{crawlerResults.stats.forms}</span>
                    <span className="stat-label">Forms</span>
                  </div>
                </div>
              </div>

              <div className="lighthouse-section">
                <div className="section-header">
                  <h4>Select URLs for EGDesk SEO Analysis</h4>
                  <button
                    onClick={handleGenerateLighthouseReports}
                    disabled={selectedUrls.size === 0 || isGeneratingLighthouse}
                    className="generate-lighthouse-button"
                  >
                    {isGeneratingLighthouse ? 'Analyzing...' : `Analyze Selected URLs (${selectedUrls.size})`}
                  </button>
                </div>

                {/* Progress Indicator */}
                {lighthouseProgress && (
                  <div className="lighthouse-progress">
                    <div className="progress-header">
                      <span>Progress: {lighthouseProgress.current}/{lighthouseProgress.total}</span>
                      <span className={`status-badge ${lighthouseProgress.status}`}>
                        {lighthouseProgress.status === 'processing' ? 'Processing' : 
                         lighthouseProgress.status === 'completed' ? 'Completed' : 'Failed'}
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
                      <div className="progress-error">Error: {lighthouseProgress.error}</div>
                    )}
                  </div>
                )}

                {/* Final Scores Summary (EGDesk SEO Analysis Report) */}
                {finalScores && (
                  <div className="final-scores">
                    <div className="final-scores-header">
                      <h5>EGDesk SEO Analysis Final Score Summary</h5>
                      {pdfPath && (
                        <button
                          onClick={handleDownloadPdf}
                          className="download-pdf-button"
                          title="Download PDF Report"
                        >
                          📄 Download PDF
                        </button>
                      )}
                    </div>
                    <div className="scores-grid">
                      <div className="score-card overall">
                        <div className="score-value">{finalScores.overall}</div>
                        <div className="score-label">Overall Average</div>
                      </div>
                      <div className="score-card">
                        <div className="score-value">{finalScores.performance}</div>
                        <div className="score-label">Performance</div>
                      </div>
                      <div className="score-card">
                        <div className="score-value">{finalScores.accessibility}</div>
                        <div className="score-label">Accessibility</div>
                      </div>
                      <div className="score-card">
                        <div className="score-value">{finalScores.bestPractices}</div>
                        <div className="score-label">Best Practices</div>
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
                    <h5>Generated Reports ({lighthouseResults.filter(r => r.success).length}/{lighthouseResults.length})</h5>
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
                              ❌ {result.error || 'Failed'}
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
                        <span className="url-badge main">Main Page</span>
                      </div>
                    </label>
                  </div>

                  {/* Internal Links */}
                  {crawlerResults.links.internal.length > 0 && (
                    <>
                      <h5 className="url-category">Internal Links ({crawlerResults.links.internal.length})</h5>
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
                          ... and {crawlerResults.links.internal.length - 20} more
                        </p>
                      )}
                    </>
                  )}

                  {/* Relative Links */}
                  {crawlerResults.links.relative.length > 0 && (
                    <>
                      <h5 className="url-category">Relative Path Links ({crawlerResults.links.relative.length})</h5>
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
                          ... and {crawlerResults.links.relative.length - 10} more
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EGSEOAnalyzer;
