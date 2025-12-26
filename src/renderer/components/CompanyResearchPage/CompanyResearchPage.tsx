import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './CompanyResearchPage.css';
import type { CrawlResult } from '../../main/company-research-stage1';
import type { WebsiteSummary } from '../../main/company-research-stage2';
import type { AgenticResearchData } from '../../main/company-research-stage3';
import type { DetailedReport } from '../../main/company-research-stage3b1';
import type { ExecutiveSummary } from '../../main/company-research-stage3b2';
import type { WorkflowProgress } from '../../main/company-research-workflow';
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

interface CompanyResearchPageProps {}

const CompanyResearchPage: React.FC<CompanyResearchPageProps> = () => {
  const [companyUrl, setCompanyUrl] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [researchResult, setResearchResult] = useState<string | null>(null);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [summaryResult, setSummaryResult] = useState<WebsiteSummary | null>(null);
  const [agenticResearchResult, setAgenticResearchResult] = useState<AgenticResearchData | null>(null);
  const [detailedReport, setDetailedReport] = useState<DetailedReport | null>(null);
  const [execSummary, setExecSummary] = useState<ExecutiveSummary | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowProgress | null>(null);
  const [history, setHistory] = useState<CompanyResearchRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchHistory = async () => {
    try {
      const response = await window.electron.web.db.getAll();
      if (response.success) {
        setHistory(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch research history:', error);
    }
  };

  useEffect(() => {
    fetchHistory();
    // Listen for progress updates from the main process workflow
    const removeListener = window.electron.ipcRenderer.on(
      'company-research-progress',
      (progress: any) => {
        setWorkflowStatus(progress);
        if (progress.stage === 'error') {
          setResearchResult(`Workflow Error: ${progress.message}`);
        } else {
          setResearchResult(`Current Stage: ${progress.stage.toUpperCase()} - ${progress.message}`);
        }
      }
    );

    return () => {
      removeListener();
    };
  }, []);

  const handleFullResearch = async (bypassCache: boolean = false) => {
    if (!companyUrl.trim()) {
      alert('Please enter a company URL or name');
      return;
    }

    setIsResearching(true);
    setResearchResult(null);
    setCrawlResult(null);
    setSummaryResult(null);
    setAgenticResearchResult(null);
    setDetailedReport(null);
    setExecSummary(null);
    setWorkflowStatus(null);

    try {
      const response = await window.electron.web.fullResearch(
        companyUrl,
        {}, // inquiryData
        { bypassCache, createGoogleDoc: false } // options
      );

      if (response.success && response.data) {
        const full = response.data;
        setCrawlResult(full.crawl || null);
        setSummaryResult(full.summary || null);
        setAgenticResearchResult(full.research || null);
        setDetailedReport(full.detailedReport || null);
        setExecSummary(full.execSummary || null);
        setResearchResult('Full research completed successfully.');
      } else {
        setResearchResult(`Full Research Failed: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setResearchResult(`Error during Full Research: ${errorMessage}`);
    } finally {
      setIsResearching(false);
      fetchHistory(); // Refresh history after research completes
    }
  };

  const loadResearch = (record: CompanyResearchRecord) => {
    setCompanyUrl(record.domain);
    setCrawlResult(record.crawlData);
    setSummaryResult(record.summaryData);
    setAgenticResearchResult(record.researchData);
    setDetailedReport(record.detailedReport);
    setExecSummary(record.executiveSummary);
    setResearchResult(`Loaded saved research for ${record.domain} (${record.companyName}) from ${new Date(record.createdAt).toLocaleString()}`);
    setShowHistory(false);
  };

  const deleteResearch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this research record?')) return;
    
    try {
      const response = await window.electron.web.db.delete(id);
      if (response.success) {
        fetchHistory();
      }
    } catch (error) {
      console.error('Failed to delete research:', error);
    }
  };

  const handleResearch = handleFullResearch; // Redirect "Start Research" to full research

  const handlePhase1Test = async (bypassCache: boolean = false) => {
    if (!companyUrl.trim()) {
      alert('Please enter a company URL for Phase 1 Test');
      return;
    }

    setIsResearching(true);
    setResearchResult(null);
    setCrawlResult(null);
    setSummaryResult(null);
    setAgenticResearchResult(null);
    setDetailedReport(null);
    setExecSummary(null);

    try {
      const response = await window.electron.invoke(
        'company-research-crawl-intelligent',
        companyUrl,
        bypassCache,
      );
      if (response.success) {
        setCrawlResult(response.data);
        const statusMsg = response.data.cached ? '(Loaded from Cache) ' : '(Fresh Crawl) ';
        setResearchResult(`${statusMsg}Phase 1 Test Completed for ${companyUrl}. Pages crawled: ${response.data.pageCount}`);
      } else {
        setResearchResult(`Phase 1 Test Failed: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setResearchResult(`Error during Phase 1 Test: ${errorMessage}`);
    } finally {
      setIsResearching(false);
    }
  };

  const handlePhase2Test = async (bypassCache: boolean = false) => {
    if (!crawlResult) {
      alert('Please run Phase 1 Test first to get crawl results');
      return;
    }

    setIsResearching(true);
    setSummaryResult(null);
    setAgenticResearchResult(null);
    setDetailedReport(null);
    setExecSummary(null);

    try {
      const response = await window.electron.invoke(
        'company-research-summarize',
        crawlResult,
        bypassCache,
      );
      if (response.success) {
        setSummaryResult(response.data);
        const statusMsg = response.data.cached ? '(Loaded from Cache) ' : '(Fresh Analysis) ';
        setResearchResult(`${statusMsg}Phase 2 Test Completed for ${crawlResult.domain}`);
      } else {
        setResearchResult(`Phase 2 Test Failed: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setResearchResult(`Error during Phase 2 Test: ${errorMessage}`);
    } finally {
      setIsResearching(false);
    }
  };

  const handlePhase3Test = async (bypassCache: boolean = false) => {
    if (!summaryResult) {
      alert('Please run Phase 2 Test first to get company summary');
      return;
    }

    setIsResearching(true);
    setAgenticResearchResult(null);
    setDetailedReport(null);
    setExecSummary(null);

    try {
      const response = await window.electron.invoke(
        'company-research-agentic-research',
        companyUrl,
        summaryResult,
        bypassCache
      );
      if (response.success) {
        setAgenticResearchResult(response.data);
        const statusMsg = response.data.cached ? '(Loaded from Cache) ' : '(Fresh Research) ';
        setResearchResult(`${statusMsg}Phase 3 Test Completed for ${companyUrl}`);
      } else {
        setResearchResult(`Phase 3 Test Failed: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setResearchResult(`Error during Phase 3 Test: ${errorMessage}`);
    } finally {
      setIsResearching(false);
    }
  };

  const handlePhase3B1Test = async (bypassCache: boolean = false) => {
    if (!summaryResult || !agenticResearchResult) {
      alert('Please run Phase 3 Test first to get research findings');
      return;
    }

    setIsResearching(true);
    setDetailedReport(null);

    try {
      const response = await window.electron.invoke(
        'company-research-generate-3b1',
        companyUrl,
        summaryResult,
        agenticResearchResult,
        {}, // Placeholder for inquiryData
        bypassCache
      );
      if (response.success) {
        setDetailedReport(response.data);
        const statusMsg = response.data.cached ? '(Loaded from Cache) ' : '(Fresh Generation) ';
        setResearchResult(`${statusMsg}Phase 3B-1: Detailed Report Generated for ${companyUrl}`);
      } else {
        setResearchResult(`Phase 3B-1 Failed: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setResearchResult(`Error during Phase 3B-1: ${errorMessage}`);
    } finally {
      setIsResearching(false);
    }
  };

  const handlePhase3B2Test = async (bypassCache: boolean = false) => {
    if (!summaryResult || !agenticResearchResult) {
      alert('Please run Phase 3 Test first to get research findings');
      return;
    }

    setIsResearching(true);
    setExecSummary(null);

    try {
      if (!detailedReport) {
        alert('Please run Phase 3B-1 first to get the detailed report content');
        setIsResearching(false);
        return;
      }
      
      const response = await window.electron.invoke(
        'company-research-generate-3b2',
        companyUrl,
        detailedReport.content,
        {}, // Placeholder for inquiryData
        summaryResult,
        agenticResearchResult,
        bypassCache
      );
      if (response.success) {
        setExecSummary(response.data);
        const statusMsg = response.data.cached ? '(Loaded from Cache) ' : '(Fresh Generation) ';
        setResearchResult(`${statusMsg}Phase 3B-2: Executive Summary Generated for ${companyUrl}`);
      } else {
        setResearchResult(`Phase 3B-2 Failed: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setResearchResult(`Error during Phase 3B-2: ${errorMessage}`);
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

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCompanyUrl(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleResearch();
    }
  };

  return (
    <div className="company-research-container">
      <div className="company-research-scroll">
        <div className="company-research">
          <div className="company-research-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>Company Research</h1>
                <p>Conduct in-depth analysis of companies with AI assistance</p>
              </div>
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="analyze-button history-toggle-button"
                style={{ backgroundColor: '#6c757d' }}
              >
                {showHistory ? 'Close History' : 'View History'}
              </button>
            </div>
          </div>

          {showHistory && (
            <div className="history-section" style={{ marginBottom: '30px', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '12px', border: '1px solid #dee2e6' }}>
              <h2 style={{ marginTop: 0, marginBottom: '15px' }}>Research History</h2>
              {history.length === 0 ? (
                <p>No research history found.</p>
              ) : (
                <div className="history-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                  {history.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => loadResearch(item)}
                      style={{ 
                        padding: '15px', 
                        backgroundColor: '#fff', 
                        borderRadius: '8px', 
                        border: '1px solid #e1e5e9', 
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'box-shadow 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'}
                      onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <button 
                        onClick={(e) => deleteResearch(item.id, e)}
                        style={{ 
                          position: 'absolute', 
                          top: '10px', 
                          right: '10px', 
                          border: 'none', 
                          background: 'none', 
                          color: '#dc3545', 
                          cursor: 'pointer',
                          fontSize: '18px'
                        }}
                      >
                        &times;
                      </button>
                      <h3 style={{ margin: '0 0 5px 0', color: '#4361EE', fontSize: '16px', paddingRight: '20px' }}>
                        {item.companyName || item.domain}
                      </h3>
                      <p style={{ margin: '0', fontSize: '13px', color: '#6e6e73' }}>{item.domain}</p>
                      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '2px 8px', 
                          borderRadius: '10px', 
                          backgroundColor: item.status === 'completed' ? '#d4edda' : '#f8d7da',
                          color: item.status === 'completed' ? '#155724' : '#721c24'
                        }}>
                          {item.status.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '11px', color: '#adb5bd' }}>
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="company-research-input-section">
            <div className="input-group">
              <input
                type="text"
                value={companyUrl}
                onChange={handleUrlChange}
                onKeyPress={handleKeyPress}
                placeholder="Enter company URL or name (e.g., Google, https://www.google.com)"
                className="url-input"
                disabled={isResearching}
              />
              
              {isResearching && workflowStatus && (
                <div className="workflow-progress-container" style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0f4f8', borderRadius: '8px', border: '1px solid #d1d9e6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold', color: '#1a365d' }}>
                      Stage: {workflowStatus.stage.toUpperCase()}
                    </span>
                    <span style={{ color: '#4a5568', fontSize: '14px' }}>
                      {workflowStatus.message}
                    </span>
                  </div>
                  <div className="progress-bar-bg" style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      className="progress-bar-fill" 
                      style={{ 
                        height: '100%', 
                        backgroundColor: '#4299e1', 
                        width: workflowStatus.stage === 'crawl' ? '20%' :
                               workflowStatus.stage === 'summary' ? '40%' :
                               workflowStatus.stage === 'research' ? '60%' :
                               workflowStatus.stage === 'report-detailed' ? '80%' :
                               workflowStatus.stage === 'report-exec' ? '90%' :
                               workflowStatus.stage === 'complete' ? '100%' : '5%'
                      }} 
                    />
                  </div>
                </div>
              )}

              <div className="button-group" style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleFullResearch(false)}
                  disabled={isResearching || !companyUrl.trim()}
                  className="analyze-button"
                  style={{ backgroundColor: '#4361EE', fontWeight: 'bold' }}
                >
                  {isResearching ? 'Researching...' : 'Run Full Research (S1-S4)'}
                </button>
                {companyUrl.trim() && (
                  <button
                    onClick={() => handleFullResearch(true)}
                    disabled={isResearching}
                    className="analyze-button"
                    style={{ backgroundColor: '#FF9F1C' }}
                  >
                    {isResearching ? 'Redoing...' : 'Redo Full Research'}
                  </button>
                )}
                <button
                  onClick={() => handlePhase1Test(false)}
                  disabled={isResearching || !companyUrl.trim()}
                  className="analyze-button phase1-test-button"
                >
                  {isResearching ? 'Running Phase 1...' : 'Phase 1 Test'}
                </button>
                {companyUrl.trim() && (
                  <button
                    onClick={() => handlePhase1Test(true)}
                    disabled={isResearching}
                    className="analyze-button phase1-redo-button"
                    style={{ backgroundColor: '#FF9F1C' }}
                  >
                    {isResearching ? 'Redoing...' : 'Redo Phase 1'}
                  </button>
                )}
                <button
                  onClick={handlePhase2Test}
                  disabled={isResearching || !crawlResult}
                  className="analyze-button phase2-test-button"
                >
                  {isResearching ? 'Running Phase 2...' : 'Phase 2 Test'}
                </button>
                {crawlResult && (
                  <button
                    onClick={() => handlePhase2Test(true)}
                    disabled={isResearching}
                    className="analyze-button phase2-redo-button"
                    style={{ backgroundColor: '#FF9F1C' }}
                  >
                    {isResearching ? 'Redoing...' : 'Redo Phase 2'}
                  </button>
                )}
                <button
                  onClick={() => handlePhase3Test(false)}
                  disabled={isResearching || !summaryResult}
                  className="analyze-button phase3-test-button"
                >
                  {isResearching ? 'Running Phase 3...' : 'Phase 3 Test'}
                </button>
                <button
                  onClick={() => handlePhase3B1Test(false)}
                  disabled={isResearching || !agenticResearchResult}
                  className="analyze-button phase3b1-test-button"
                  style={{ backgroundColor: '#4CC9F0', color: '#fff' }}
                >
                  {isResearching ? 'Generating 3B-1...' : 'Phase 3B-1: Detailed'}
                </button>
                {(summaryResult && agenticResearchResult) && (
                  <button
                    onClick={() => handlePhase3B1Test(true)}
                    disabled={isResearching}
                    className="analyze-button phase3b1-redo-button"
                    style={{ backgroundColor: '#FF9F1C' }}
                  >
                    {isResearching ? 'Redoing...' : 'Redo 3B-1'}
                  </button>
                )}
                <button
                  onClick={() => handlePhase3B2Test(false)}
                  disabled={isResearching || !agenticResearchResult}
                  className="analyze-button phase3b2-test-button"
                  style={{ backgroundColor: '#4895EF', color: '#fff' }}
                >
                  {isResearching ? 'Generating 3B-2...' : 'Phase 3B-2: Executive'}
                </button>
                {detailedReport && (
                  <button
                    onClick={() => handlePhase3B2Test(true)}
                    disabled={isResearching}
                    className="analyze-button phase3b2-redo-button"
                    style={{ backgroundColor: '#FF9F1C' }}
                  >
                    {isResearching ? 'Redoing...' : 'Redo 3B-2'}
                  </button>
                )}
                {summaryResult && (
                  <button
                    onClick={() => handlePhase3Test(true)}
                    disabled={isResearching}
                    className="analyze-button phase3-redo-button"
                    style={{ backgroundColor: '#FF9F1C' }}
                  >
                    {isResearching ? 'Redoing...' : 'Redo Phase 3'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {(researchResult || crawlResult || summaryResult || agenticResearchResult || detailedReport || execSummary) && (
            <div className="company-research-result">
              <div className="result-content">
                {researchResult && <pre style={{ backgroundColor: '#ffffff', color: '#000000', border: '1px solid #e1e5e9', padding: '15px', borderRadius: '8px' }}>{researchResult}</pre>}
                
                {detailedReport && (
                  <div className="detailed-report-card" style={{ marginTop: '20px', backgroundColor: '#ffffff', color: '#000000', border: '1px solid #e1e5e9', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #4CC9F0', paddingBottom: '10px', marginBottom: '20px' }}>
                      <h2 style={{ color: '#1d1d1f', margin: 0 }}>Phase 3B-1: Detailed Analysis Report</h2>
                      <button 
                        onClick={() => handleExport('detailed')}
                        className="analyze-button"
                        style={{ padding: '8px 15px', fontSize: '14px', backgroundColor: '#4CC9F0' }}
                      >
                        Export to Markdown
                      </button>
                    </div>
                    <div className="report-content" style={{ lineHeight: '1.6' }}>
                      <ReactMarkdown>{detailedReport.content}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {execSummary && (
                  <div className="exec-summary-card" style={{ marginTop: '20px', backgroundColor: '#ffffff', color: '#000000', border: '1px solid #e1e5e9', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #4895EF', paddingBottom: '10px', marginBottom: '20px' }}>
                      <h2 style={{ color: '#1d1d1f', margin: 0 }}>Phase 3B-2: Executive Summary</h2>
                      <button 
                        onClick={() => handleExport('executive')}
                        className="analyze-button"
                        style={{ padding: '8px 15px', fontSize: '14px', backgroundColor: '#4895EF' }}
                      >
                        Export to Markdown
                      </button>
                    </div>
                    <div className="report-content" style={{ lineHeight: '1.6' }}>
                      <ReactMarkdown>{execSummary.content}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {agenticResearchResult && !detailedReport && !execSummary && (
                  <div className="agentic-research-card" style={{ marginTop: '20px', backgroundColor: '#ffffff', color: '#000000', border: '1px solid #e1e5e9', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h2 style={{ borderBottom: '2px solid #4361EE', paddingBottom: '10px', color: '#1d1d1f' }}>Phase 3: Agentic Research Findings</h2>
                    
                    {agenticResearchResult.validatedFindings.map((res, idx) => (
                      <div key={idx} style={{ marginTop: '25px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <h3 style={{ color: '#4361EE', margin: 0 }}>Finding #{idx + 1}</h3>
                          <span style={{ 
                            padding: '4px 10px', 
                            borderRadius: '12px', 
                            fontSize: '12px', 
                            fontWeight: 'bold',
                            backgroundColor: res.confidenceLevel === 'high' ? '#4CAF50' : res.confidenceLevel === 'medium' ? '#FFC107' : '#F44336',
                            color: 'white'
                          }}>
                            Confidence: {res.confidenceLevel.toUpperCase()}
                          </span>
                        </div>
                        <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{res.validatedFinancials}</p>
                        
                        {res.validatedURLs.length > 0 && (
                          <div style={{ marginTop: '15px' }}>
                            <h4 style={{ fontSize: '14px', color: '#6e6e73', margin: '0 0 5px 0' }}>Validated Sources:</h4>
                            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                              {res.validatedURLs.map((source, sIdx) => (
                                <li key={sIdx}>
                                  <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4361EE' }}>{source.title}</a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {summaryResult && !agenticResearchResult && !detailedReport && !execSummary && (
                  <div className="summary-result-card" style={{ marginTop: '20px', backgroundColor: '#ffffff', color: '#000000', border: '1px solid #e1e5e9', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h2 style={{ borderBottom: '2px solid #7209B7', paddingBottom: '10px', color: '#1d1d1f' }}>Phase 2: Company Summary ({summaryResult.companyName})</h2>
                    <p><strong>Headquarters:</strong> {summaryResult.headquarters}</p>
                    <p><strong>Established:</strong> {summaryResult.establishedYear}</p>
                    
                    <div style={{ marginTop: '20px' }}>
                      <h3 style={{ color: '#3a0ca3' }}>Business Fields</h3>
                      <ul style={{ paddingLeft: '20px' }}>
                        {summaryResult.businessFields.map((field, idx) => <li key={idx} style={{ marginBottom: '5px' }}>{field}</li>)}
                      </ul>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <h3 style={{ color: '#3a0ca3' }}>Products & Services</h3>
                      <ul style={{ paddingLeft: '20px' }}>
                        {summaryResult.productsServices.map((product, idx) => <li key={idx} style={{ marginBottom: '5px' }}>{product}</li>)}
                      </ul>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <h3 style={{ color: '#3a0ca3' }}>Major Projects</h3>
                      <ul style={{ paddingLeft: '20px' }}>
                        {summaryResult.majorProjects.map((project, idx) => <li key={idx} style={{ marginBottom: '5px' }}>{project}</li>)}
                      </ul>
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <h3 style={{ color: '#3a0ca3' }}>Contact Information</h3>
                      <div style={{ paddingLeft: '10px', borderLeft: '3px solid #f0f0f0' }}>
                        {summaryResult.contactInfo.email && <p style={{ margin: '5px 0' }}><strong>Email:</strong> {summaryResult.contactInfo.email}</p>}
                        {summaryResult.contactInfo.phone && <p style={{ margin: '5px 0' }}><strong>Phone:</strong> {summaryResult.contactInfo.phone}</p>}
                        {summaryResult.contactInfo.address && <p style={{ margin: '5px 0' }}><strong>Address:</strong> {summaryResult.contactInfo.address}</p>}
                      </div>
                    </div>

                    <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                      <h3 style={{ color: '#3a0ca3' }}>Comprehensive Summary</h3>
                      <p style={{ lineHeight: '1.6', fontSize: '15px' }}>{summaryResult.rawSummary}</p>
                    </div>
                  </div>
                )}

                {crawlResult && !summaryResult && !agenticResearchResult && !detailedReport && !execSummary && (
                  <div style={{ marginTop: '20px' }}>
                    <h2>Phase 1: Crawl Results for {crawlResult.domain}</h2>
                    <p>Total Pages Crawled: {crawlResult.pageCount}</p>
                    {crawlResult.error && <p className="error">Error: {crawlResult.error}</p>}
                    {crawlResult.pages.length > 0 && (
                      <div>
                        <h3>Sample Pages:</h3>
                        <ul>
                          {crawlResult.pages.slice(0, 5).map((page, index) => (
                            <li key={index}>
                              <a href={page.url} target="_blank" rel="noopener noreferrer">{page.title || page.url}</a> (Depth: {page.depth})
                            </li>
                          ))}
                          {crawlResult.pages.length > 5 && <li>... and {crawlResult.pages.length - 5} more.</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyResearchPage;
