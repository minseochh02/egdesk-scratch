import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './CompanyResearchPage.css';
import type { CrawlResult } from '../../main/company-research-stage1';
import type { WebsiteSummary } from '../../main/company-research-stage2';
import type { AgenticResearchData } from '../../main/company-research-stage3';
import type { DetailedReport } from '../../main/company-research-stage3b1';
import type { ExecutiveSummary } from '../../main/company-research-stage3b2';
import type { WorkflowProgress } from '../../main/company-research-workflow';
import ResearchedCompanyPage from './ResearchedCompanyPage';
import type { CompanyResearchRecord } from '../../main/sqlite/company-research';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        sendMessage(channel: string, ...args: any[]): void;
        on(channel: string, listener: (...args: any[]) => void): () => void;
        once(channel: string, listener: (...args: any[]) => void): void;
      };
      invoke(channel: string, ...args: any[]): Promise<any>;
      web: {
        fetchContent: (url: string) => Promise<any>;
        crawlHomepage: (url: string) => Promise<any>;
        crawlMultiplePages: (url: string, options?: any) => Promise<any>;
        generateBusinessIdentity: (text: string, rootUrl?: string, lang?: string) => Promise<any>;
        generateSnsPlan: (identity: any) => Promise<any>;
        fullResearch: (domain: string, inquiryData?: any, options?: any) => Promise<any>;
        db: {
          save: (record: any) => Promise<any>;
          getAll: () => Promise<any>;
          getById: (id: string) => Promise<any>;
          update: (id: string, updates: any) => Promise<any>;
          delete: (id: string) => Promise<any>;
          findByDomain: (domain: string) => Promise<any>;
          hasRecent: (domain: string, hoursAgo?: number) => Promise<any>;
          getLatestCompleted: (domain: string) => Promise<any>;
        };
      };
    };
  }
}

type ViewMode = 'research' | 'history';
type ResultTab = 'summary' | 'detailed' | 'executive';

const STAGES = [
  { key: 'crawl', label: 'Crawling', icon: '🔍' },
  { key: 'summary', label: 'Analyzing', icon: '📊' },
  { key: 'research', label: 'Researching', icon: '🔬' },
  { key: 'report-detailed', label: 'Detailed Report', icon: '📝' },
  { key: 'report-exec', label: 'Executive Summary', icon: '📋' },
];

const CompanyResearchPage: React.FC = () => {
  const [companyUrl, setCompanyUrl] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [summaryResult, setSummaryResult] = useState<WebsiteSummary | null>(null);
  const [agenticResearchResult, setAgenticResearchResult] = useState<AgenticResearchData | null>(null);
  const [detailedReport, setDetailedReport] = useState<DetailedReport | null>(null);
  const [execSummary, setExecSummary] = useState<ExecutiveSummary | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowProgress | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('research');
  const [resultTab, setResultTab] = useState<ResultTab>('executive');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    const removeListener = window.electron.ipcRenderer.on(
      'company-research-progress',
      (progress: any) => {
        setWorkflowStatus(progress);
        if (progress.stage === 'error') {
          setErrorMessage(progress.message);
        }
      }
    );
    return () => removeListener();
  }, []);

  const resetState = () => {
    setErrorMessage(null);
    setCrawlResult(null);
    setSummaryResult(null);
    setAgenticResearchResult(null);
    setDetailedReport(null);
    setExecSummary(null);
    setWorkflowStatus(null);
  };

  const handleFullResearch = async (bypassCache: boolean = false) => {
    if (!companyUrl.trim()) return;

    setIsResearching(true);
    resetState();

    try {
      const response = await window.electron.web.fullResearch(
        companyUrl,
        {},
        { bypassCache, createGoogleDoc: false }
      );

      if (response.success && response.data) {
        const full = response.data;
        setCrawlResult(full.crawl || null);
        setSummaryResult(full.summary || null);
        setAgenticResearchResult(full.research || null);
        setDetailedReport(full.detailedReport || null);
        setExecSummary(full.execSummary || null);
      } else {
        setErrorMessage(response.error || 'Unknown error occurred');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsResearching(false);
    }
  };

  const loadResearch = (record: CompanyResearchRecord) => {
    setCompanyUrl(record.domain);
    setCrawlResult(record.crawlData);
    setSummaryResult(record.summaryData);
    setAgenticResearchResult(record.researchData);
    setDetailedReport(record.detailedReport);
    setExecSummary(record.executiveSummary);
    setViewMode('research');
    setErrorMessage(null);
  };

  // Advanced phase handlers
  const handlePhase1Test = async (bypassCache: boolean = false) => {
    if (!companyUrl.trim()) return;
    setIsResearching(true);
    resetState();
    try {
      const response = await window.electron.invoke('company-research-crawl-intelligent', companyUrl, bypassCache);
      if (response.success) {
        setCrawlResult(response.data);
      } else {
        setErrorMessage(response.error || 'Phase 1 failed');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error during Phase 1');
    } finally {
      setIsResearching(false);
    }
  };

  const handlePhase2Test = async (bypassCache: boolean = false) => {
    if (!crawlResult) return;
    setIsResearching(true);
    try {
      const response = await window.electron.invoke('company-research-summarize', crawlResult, bypassCache);
      if (response.success) {
        setSummaryResult(response.data);
      } else {
        setErrorMessage(response.error || 'Phase 2 failed');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error during Phase 2');
    } finally {
      setIsResearching(false);
    }
  };

  const handlePhase3Test = async (bypassCache: boolean = false) => {
    if (!summaryResult) return;
    setIsResearching(true);
    try {
      const response = await window.electron.invoke('company-research-agentic-research', companyUrl, summaryResult, bypassCache);
      if (response.success) {
        setAgenticResearchResult(response.data);
      } else {
        setErrorMessage(response.error || 'Phase 3 failed');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error during Phase 3');
    } finally {
      setIsResearching(false);
    }
  };

  const handlePhase3B1Test = async (bypassCache: boolean = false) => {
    if (!summaryResult || !agenticResearchResult) return;
    setIsResearching(true);
    try {
      const response = await window.electron.invoke('company-research-generate-3b1', companyUrl, summaryResult, agenticResearchResult, {}, bypassCache);
      if (response.success) {
        setDetailedReport(response.data);
      } else {
        setErrorMessage(response.error || 'Phase 3B-1 failed');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error during Phase 3B-1');
    } finally {
      setIsResearching(false);
    }
  };

  const handlePhase3B2Test = async (bypassCache: boolean = false) => {
    if (!detailedReport || !summaryResult || !agenticResearchResult) return;
    setIsResearching(true);
    try {
      const response = await window.electron.invoke('company-research-generate-3b2', companyUrl, detailedReport.content, {}, summaryResult, agenticResearchResult, bypassCache);
      if (response.success) {
        setExecSummary(response.data);
      } else {
        setErrorMessage(response.error || 'Phase 3B-2 failed');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Error during Phase 3B-2');
    } finally {
      setIsResearching(false);
    }
  };

  const handleExport = async (reportType: 'detailed' | 'executive') => {
    const content = reportType === 'detailed' ? detailedReport?.content : execSummary?.content;
    if (!content) return;
    const fileName = `${companyUrl.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${reportType}_report`;
    try {
      const response = await window.electron.invoke('company-research-export', fileName, content);
      if (response.success) {
        alert(`Report exported successfully to: ${response.filePath}`);
      } else if (response.error !== 'User canceled export') {
        alert(`Export failed: ${response.error}`);
      }
    } catch (error) {
      alert(`Export error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getCurrentStageIndex = () => {
    if (!workflowStatus) return -1;
    return STAGES.findIndex(s => s.key === workflowStatus.stage);
  };

  const hasResults = crawlResult || summaryResult || agenticResearchResult || detailedReport || execSummary;

  return (
    <div className="cr-container">
      <div className="cr-scroll">
        {/* Navigation */}
        <nav className="cr-nav">
          <button 
            className={`cr-nav-btn ${viewMode === 'research' ? 'active' : ''}`}
            onClick={() => setViewMode('research')}
          >
            <span className="cr-nav-icon">🔬</span>
            New Research
          </button>
          <button 
            className={`cr-nav-btn ${viewMode === 'history' ? 'active' : ''}`}
            onClick={() => setViewMode('history')}
          >
            <span className="cr-nav-icon">📚</span>
            Past Research
          </button>
        </nav>

        {viewMode === 'history' && (
          <ResearchedCompanyPage onLoadResearch={loadResearch} />
        )}

        {viewMode === 'research' && (
          <div className="cr-main">
            {/* Hero Section */}
            <header className="cr-hero">
              <h1 className="cr-title">Company Research</h1>
              <p className="cr-subtitle">AI-powered company intelligence and analysis</p>
            </header>

            {/* Search Section */}
            <section className="cr-search-section">
              <div className="cr-search-box">
                <div className="cr-input-wrapper">
                  <span className="cr-input-icon">🌐</span>
                  <input
                    type="text"
                    value={companyUrl}
                    onChange={(e) => setCompanyUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isResearching && handleFullResearch()}
                    placeholder="Enter company website (e.g., company.com)"
                    className="cr-input"
                    disabled={isResearching}
                  />
                </div>
                
                <div className="cr-action-buttons">
                  <button
                    onClick={() => handleFullResearch(false)}
                    disabled={isResearching || !companyUrl.trim()}
                    className="cr-btn cr-btn-primary"
                  >
                    {isResearching ? (
                      <>
                        <span className="cr-spinner"></span>
                        Researching...
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        Start Research
                      </>
                    )}
                  </button>
                  
                  {hasResults && !isResearching && (
                    <button
                      onClick={() => handleFullResearch(true)}
                      className="cr-btn cr-btn-secondary"
                    >
                      <span>🔄</span>
                      Re-run
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Indicator */}
              {isResearching && workflowStatus && (
                <div className="cr-progress">
                  <div className="cr-progress-stages">
                    {STAGES.map((stage, idx) => {
                      const currentIdx = getCurrentStageIndex();
                      const isCompleted = currentIdx > idx;
                      const isCurrent = currentIdx === idx;
                      return (
                        <div 
                          key={stage.key} 
                          className={`cr-stage ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                        >
                          <div className="cr-stage-dot">
                            {isCompleted ? '✓' : stage.icon}
                          </div>
                          <span className="cr-stage-label">{stage.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="cr-progress-message">{workflowStatus.message}</p>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="cr-error">
                  <span className="cr-error-icon">⚠️</span>
                  <span>{errorMessage}</span>
                  <button onClick={() => setErrorMessage(null)} className="cr-error-close">×</button>
                </div>
              )}

              {/* Advanced Options Toggle */}
              <button 
                className="cr-advanced-toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>{showAdvanced ? '▼' : '▶'}</span>
                Developer Options
              </button>

              {showAdvanced && (
                <div className="cr-advanced-panel">
                  <p className="cr-advanced-desc">Run individual research phases for testing or debugging.</p>
                  <div className="cr-advanced-grid">
                    <div className="cr-phase-group">
                      <span className="cr-phase-label">Phase 1: Crawl</span>
                      <div className="cr-phase-btns">
                        <button 
                          onClick={() => handlePhase1Test(false)} 
                          disabled={isResearching || !companyUrl.trim()}
                          className="cr-btn-sm"
                        >
                          Run
                        </button>
                        <button 
                          onClick={() => handlePhase1Test(true)} 
                          disabled={isResearching || !companyUrl.trim()}
                          className="cr-btn-sm cr-btn-redo"
                        >
                          Redo
                        </button>
                      </div>
                    </div>
                    
                    <div className="cr-phase-group">
                      <span className="cr-phase-label">Phase 2: Summarize</span>
                      <div className="cr-phase-btns">
                        <button 
                          onClick={() => handlePhase2Test(false)} 
                          disabled={isResearching || !crawlResult}
                          className="cr-btn-sm"
                        >
                          Run
                        </button>
                        <button 
                          onClick={() => handlePhase2Test(true)} 
                          disabled={isResearching || !crawlResult}
                          className="cr-btn-sm cr-btn-redo"
                        >
                          Redo
                        </button>
                      </div>
                    </div>

                    <div className="cr-phase-group">
                      <span className="cr-phase-label">Phase 3: Research</span>
                      <div className="cr-phase-btns">
                        <button 
                          onClick={() => handlePhase3Test(false)} 
                          disabled={isResearching || !summaryResult}
                          className="cr-btn-sm"
                        >
                          Run
                        </button>
                        <button 
                          onClick={() => handlePhase3Test(true)} 
                          disabled={isResearching || !summaryResult}
                          className="cr-btn-sm cr-btn-redo"
                        >
                          Redo
                        </button>
                      </div>
                    </div>

                    <div className="cr-phase-group">
                      <span className="cr-phase-label">Phase 3B-1: Detailed</span>
                      <div className="cr-phase-btns">
                        <button 
                          onClick={() => handlePhase3B1Test(false)} 
                          disabled={isResearching || !agenticResearchResult}
                          className="cr-btn-sm"
                        >
                          Run
                        </button>
                        <button 
                          onClick={() => handlePhase3B1Test(true)} 
                          disabled={isResearching || !agenticResearchResult}
                          className="cr-btn-sm cr-btn-redo"
                        >
                          Redo
                        </button>
                      </div>
                    </div>

                    <div className="cr-phase-group">
                      <span className="cr-phase-label">Phase 3B-2: Executive</span>
                      <div className="cr-phase-btns">
                        <button 
                          onClick={() => handlePhase3B2Test(false)} 
                          disabled={isResearching || !detailedReport}
                          className="cr-btn-sm"
                        >
                          Run
                        </button>
                        <button 
                          onClick={() => handlePhase3B2Test(true)} 
                          disabled={isResearching || !detailedReport}
                          className="cr-btn-sm cr-btn-redo"
                        >
                          Redo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Results Section */}
            {hasResults && !isResearching && (
              <section className="cr-results">
                {/* Company Info Card */}
                {summaryResult && (
                  <div className="cr-company-card">
                    <div className="cr-company-header">
                      <div className="cr-company-avatar">
                        {summaryResult.companyName?.charAt(0) || '?'}
                      </div>
                      <div className="cr-company-info">
                        <h2 className="cr-company-name">{summaryResult.companyName || companyUrl}</h2>
                        <p className="cr-company-meta">
                          {summaryResult.headquarters && <span>📍 {summaryResult.headquarters}</span>}
                          {summaryResult.establishedYear && <span>📅 Est. {summaryResult.establishedYear}</span>}
                        </p>
                      </div>
                    </div>
                    
                    <div className="cr-company-tags">
                      {summaryResult.businessFields?.slice(0, 4).map((field, idx) => (
                        <span key={idx} className="cr-tag">{field}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Report Tabs */}
                {(execSummary || detailedReport || agenticResearchResult) && (
                  <div className="cr-report-section">
                    <div className="cr-tabs">
                      {execSummary && (
                        <button 
                          className={`cr-tab ${resultTab === 'executive' ? 'active' : ''}`}
                          onClick={() => setResultTab('executive')}
                        >
                          📋 Executive Summary
                        </button>
                      )}
                      {detailedReport && (
                        <button 
                          className={`cr-tab ${resultTab === 'detailed' ? 'active' : ''}`}
                          onClick={() => setResultTab('detailed')}
                        >
                          📝 Detailed Report
                        </button>
                      )}
                      {summaryResult && (
                        <button 
                          className={`cr-tab ${resultTab === 'summary' ? 'active' : ''}`}
                          onClick={() => setResultTab('summary')}
                        >
                          📊 Company Profile
                        </button>
                      )}
                    </div>

                    <div className="cr-tab-content">
                      {/* Executive Summary Tab */}
                      {resultTab === 'executive' && execSummary && (
                        <div className="cr-report">
                          <div className="cr-report-header">
                            <h3>Executive Summary</h3>
                            <button onClick={() => handleExport('executive')} className="cr-btn-export">
                              ⬇️ Export
                            </button>
                          </div>
                          <div className="cr-markdown">
                            <ReactMarkdown>{execSummary.content}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {/* Detailed Report Tab */}
                      {resultTab === 'detailed' && detailedReport && (
                        <div className="cr-report">
                          <div className="cr-report-header">
                            <h3>Detailed Analysis Report</h3>
                            <button onClick={() => handleExport('detailed')} className="cr-btn-export">
                              ⬇️ Export
                            </button>
                          </div>
                          <div className="cr-markdown">
                            <ReactMarkdown>{detailedReport.content}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {/* Company Profile Tab */}
                      {resultTab === 'summary' && summaryResult && (
                        <div className="cr-profile">
                          <div className="cr-profile-section">
                            <h4>Products & Services</h4>
                            <ul className="cr-list">
                              {summaryResult.productsServices?.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="cr-profile-section">
                            <h4>Major Projects</h4>
                            <ul className="cr-list">
                              {summaryResult.majorProjects?.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>

                          {summaryResult.contactInfo && (
                            <div className="cr-profile-section">
                              <h4>Contact Information</h4>
                              <div className="cr-contact">
                                {summaryResult.contactInfo.email && (
                                  <p><span className="cr-contact-label">Email:</span> {summaryResult.contactInfo.email}</p>
                                )}
                                {summaryResult.contactInfo.phone && (
                                  <p><span className="cr-contact-label">Phone:</span> {summaryResult.contactInfo.phone}</p>
                                )}
                                {summaryResult.contactInfo.address && (
                                  <p><span className="cr-contact-label">Address:</span> {summaryResult.contactInfo.address}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {summaryResult.rawSummary && (
                            <div className="cr-profile-section">
                              <h4>Overview</h4>
                              <p className="cr-overview">{summaryResult.rawSummary}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Research Findings (when no reports yet) */}
                {agenticResearchResult && !detailedReport && !execSummary && (
                  <div className="cr-findings">
                    <h3>Research Findings</h3>
                    {agenticResearchResult.validatedFindings?.map((finding, idx) => (
                      <div key={idx} className="cr-finding-card">
                        <div className="cr-finding-header">
                          <span className="cr-finding-num">Finding #{idx + 1}</span>
                          <span className={`cr-confidence cr-confidence-${finding.confidenceLevel}`}>
                            {finding.confidenceLevel?.toUpperCase()}
                          </span>
                        </div>
                        <p className="cr-finding-text">{finding.validatedFinancials}</p>
                        {finding.validatedURLs?.length > 0 && (
                          <div className="cr-sources">
                            <span className="cr-sources-label">Sources:</span>
                            {finding.validatedURLs.map((source, sIdx) => (
                              <a key={sIdx} href={source.url} target="_blank" rel="noopener noreferrer">
                                {source.title || 'Link'}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Crawl Results Only */}
                {crawlResult && !summaryResult && (
                  <div className="cr-crawl-info">
                    <h3>Crawl Complete</h3>
                    <p>{crawlResult.pageCount} pages crawled from {crawlResult.domain}</p>
                    <p className="cr-hint">Run Phase 2 to analyze the content.</p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyResearchPage;