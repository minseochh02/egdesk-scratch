import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import { faGoogle } from '@fortawesome/free-brands-svg-icons'; // Corrected import for faGoogle
import './CompanyResearchTab.css';
import type { CrawlResult } from '../../../main/company-research-stage1';
import type { WebsiteSummary } from '../../../main/company-research-stage2';
import type { AgenticResearchData } from '../../../main/company-research-stage3';
import type { DetailedReport } from '../../../main/company-research-stage3b1';
import type { ExecutiveSummary } from '../../../main/company-research-stage3b2';
import type { WorkflowProgress } from '../../../main/company-research-workflow';
import type { CompanyResearchRecord } from '../../../main/sqlite/company-research';

interface CompanyResearchTabProps {
  initialDomain?: string;
  onResearchComplete?: (record: CompanyResearchRecord) => void;
}

type View = 'search' | 'history' | 'result';
type ResultTab = 'executive' | 'detailed' | 'profile';

const STAGES = [
  { key: 'crawl', label: 'Crawl', progress: 20 },
  { key: 'summary', label: 'Analyze', progress: 40 },
  { key: 'research', label: 'Research', progress: 60 },
  { key: 'report-detailed', label: 'Report', progress: 80 },
  { key: 'report-exec', label: 'Summary', progress: 95 },
  { key: 'complete', label: 'Done', progress: 100 },
];

const CompanyResearchTab: React.FC<CompanyResearchTabProps> = ({
  initialDomain = '',
  onResearchComplete,
}) => {
  const [view, setView] = useState<View>('search');
  const [companyUrl, setCompanyUrl] = useState(initialDomain);
  const [isResearching, setIsResearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<CompanyResearchRecord[]>([]);
  
  // Research results
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [summaryResult, setSummaryResult] = useState<WebsiteSummary | null>(null);
  const [agenticResearchResult, setAgenticResearchResult] = useState<AgenticResearchData | null>(null);
  const [detailedReport, setDetailedReport] = useState<DetailedReport | null>(null);
  const [execSummary, setExecSummary] = useState<ExecutiveSummary | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowProgress | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>('executive');

  // Existing research prompt
  const [existingRecord, setExistingRecord] = useState<CompanyResearchRecord | null>(null);
  const [showExistingPrompt, setShowExistingPrompt] = useState(false);
  
  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailType, setEmailType] = useState<'executive' | 'detailed'>('executive');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  // Google OAuth State
  const [hasValidOAuthToken, setHasValidOAuthToken] = useState<boolean | null>(null);
  const [tokenNeedsRefresh, setTokenNeedsRefresh] = useState<boolean>(false);

  useEffect(() => {
    fetchHistory();
    checkAuthStatus();
    
    let removeProgressListener: (() => void) | undefined;
    
    if (window.electron?.ipcRenderer?.on) {
      removeProgressListener = window.electron.ipcRenderer.on(
        'company-research-progress',
        (progress: any) => {
          setWorkflowStatus(progress);
          if (progress.stage === 'error') {
            setErrorMessage(progress.message);
          }
        }
      );
    }
    
    // Listen for auth state changes
    let unsubscribeAuth: (() => void) | undefined;
    
    if (window.electron?.auth) {
      const authService = window.electron.auth;
      if (authService.onAuthStateChanged && typeof authService.onAuthStateChanged === 'function') {
        try {
          const onAuthStateChanged = authService.onAuthStateChanged;
          unsubscribeAuth = onAuthStateChanged((data: any) => {
            console.log('🔄 CompanyResearchTab: Auth state changed, re-checking token...');
            setTimeout(() => {
              checkAuthStatus();
            }, 1000);
          });
        } catch (error) {
          console.warn('Failed to setup auth state listener:', error);
        }
      }
    }
    
    return () => {
      if (typeof removeProgressListener === 'function') {
        removeProgressListener();
      }
      if (typeof unsubscribeAuth === 'function') {
        unsubscribeAuth();
      }
    };
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await window.electron.web.db.getAll();
      if (response.success) {
        setHistory(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  // Required OAuth scopes for Gmail sending
  const REQUIRED_GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
  ];

  const checkAuthStatus = async () => {
    try {
      console.log('🔍 CompanyResearchTab: Checking Gmail auth status...');
      
      // Check Supabase session first
      const sessionResult = await window.electron.auth.getSession();
      
      if (sessionResult.success && sessionResult.session && sessionResult.user) {
        const user = sessionResult.user;
        const isGoogleAuth = 
          user.app_metadata?.provider === 'google' ||
          user.identities?.some((id: any) => id.provider === 'google');
        
        if (isGoogleAuth) {
          // Check if we have a valid token with access_token
          const tokenResult = await window.electron.auth.getGoogleWorkspaceToken();
          
          if (tokenResult.success && tokenResult.token?.access_token) {
            console.log('✅ CompanyResearchTab: Valid Gmail OAuth token found');
            setHasValidOAuthToken(true);
            return;
          }
        }
      }
      
      // Fallback: Check electron-store token directly
      const tokenResult = await window.electron.auth.getGoogleWorkspaceToken();
      
      if (tokenResult.success && tokenResult.token?.access_token) {
        console.log('✅ CompanyResearchTab: Gmail OAuth token found in electron-store');
        setHasValidOAuthToken(true);
        return;
      }
      
      console.log('❌ CompanyResearchTab: No valid Gmail OAuth token');
      setHasValidOAuthToken(false);
    } catch (error) {
      console.error('Failed to check Gmail auth status:', error);
      setHasValidOAuthToken(false);
    }
  };

  const handleSignIn = async () => {
    try {
      console.log('🚀 CompanyResearchTab: Starting Gmail OAuth sign-in...');
      
      // Sign in with required Gmail scopes
      const scopes = REQUIRED_GMAIL_SCOPES.join(' ');
      const result = await window.electron.auth.signInWithGoogle(scopes);
      
      if (!result.success) {
        console.error('❌ CompanyResearchTab: OAuth sign-in failed:', result.error);
        alert(`Google authentication failed: ${result.error || 'Unknown error'}\n\nPlease try again.`);
        setHasValidOAuthToken(false);
        return;
      }
      
      console.log('✅ CompanyResearchTab: OAuth sign-in successful, checking token...');
      
      // Wait a moment for the OAuth flow to complete and token to be saved
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify token was saved and is valid
      await checkAuthStatus();
      
      if (hasValidOAuthToken !== false) {
        console.log('✅ CompanyResearchTab: Token verified, authentication complete');
        alert('Successfully signed in with Google!');
      } else {
        console.warn('⚠️ CompanyResearchTab: Sign-in completed but token validation failed');
        // Still check again in case state hasn't updated yet
        setTimeout(checkAuthStatus, 1000);
      }
    } catch (error) {
      console.error('❌ CompanyResearchTab: Failed to authenticate with Google:', error);
      alert(`Failed to authenticate with Google: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again.`);
      setHasValidOAuthToken(false);
    }
  };

  const resetResults = () => {
    setErrorMessage(null);
    setCrawlResult(null);
    setSummaryResult(null);
    setAgenticResearchResult(null);
    setDetailedReport(null);
    setExecSummary(null);
    setWorkflowStatus(null);
  };

  const checkExistingResearch = async (): Promise<CompanyResearchRecord | null> => {
    try {
      const response = await window.electron.web.db.getLatestCompleted(companyUrl.trim());
      if (response.success && response.data) {
        return response.data;
      }
    } catch (error) {
      console.error('Failed to check existing research:', error);
    }
    return null;
  };

  const handleResearchClick = async () => {
    if (!companyUrl.trim() || isResearching) return;
    
    const existing = await checkExistingResearch();
    if (existing) {
      setExistingRecord(existing);
      setShowExistingPrompt(true);
    } else {
      handleResearch(false);
    }
  };

  const handleExistingChoice = (choice: 'view' | 'redo') => {
    setShowExistingPrompt(false);
    if (choice === 'view' && existingRecord) {
      loadFromHistory(existingRecord);
    } else {
      handleResearch(true);
    }
    setExistingRecord(null);
  };

  const handleResearch = async (bypassCache: boolean = false) => {
    if (!companyUrl.trim() || isResearching) return;

    setIsResearching(true);
    resetResults();
    setView('search');

    try {
      const response = await window.electron.web.fullResearch(
        companyUrl,
        {},
        { bypassCache, createGoogleDoc: false }
      );

      if (response.success && response.data) {
        const data = response.data;
        setCrawlResult(data.crawl || null);
        setSummaryResult(data.summary || null);
        setAgenticResearchResult(data.research || null);
        setDetailedReport(data.detailedReport || null);
        setExecSummary(data.execSummary || null);
        setView('result');
        fetchHistory();
        onResearchComplete?.(data);
      } else {
        setErrorMessage(response.error || 'Research failed');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsResearching(false);
    }
  };

  const loadFromHistory = (record: CompanyResearchRecord) => {
    setCompanyUrl(record.domain);
    setCrawlResult(record.crawlData);
    setSummaryResult(record.summaryData);
    setAgenticResearchResult(record.researchData);
    setDetailedReport(record.detailedReport);
    setExecSummary(record.executiveSummary);
    setErrorMessage(null);
    setView('result');
  };

  const deleteFromHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this research?')) return;
    try {
      await window.electron.web.db.delete(id);
      fetchHistory();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleExport = async (type: 'detailed' | 'executive') => {
    const content = type === 'detailed' ? detailedReport?.content : execSummary?.content;
    if (!content) return;
    const fileName = `${companyUrl.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${type}_report`;
    try {
      const response = await window.electron.invoke('company-research-export', fileName, content);
      if (response.success) {
        alert(`Exported to: ${response.filePath}`);
      }
    } catch (error) {
      alert('Export failed');
    }
  };

  const openEmailModal = (type: 'executive' | 'detailed') => {
    setEmailType(type);
    setEmailAddress('');
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!emailAddress.trim()) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress.trim())) {
      alert('Please enter a valid email address');
      return;
    }

    setIsSendingEmail(true);
    
    try {
      // Check if Gmail OAuth is authenticated (using auth service, not legacy gmail-service)
      const tokenResult = await window.electron.auth.getGoogleWorkspaceToken();
      
      if (!tokenResult.success || !tokenResult.token?.access_token) {
        console.log('⚠️ CompanyResearchTab: No valid OAuth token, initiating sign-in...');
        
        // Initiate OAuth sign-in
        const scopes = REQUIRED_GMAIL_SCOPES.join(' ');
        const authResult = await window.electron.auth.signInWithGoogle(scopes);
        
        if (!authResult.success) {
          alert(`Gmail authentication failed: ${authResult.error || 'Unknown error'}\n\nPlease try again.`);
          setIsSendingEmail(false);
          return;
        }
        
        // Wait for token to be saved
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify token was saved
        const verifyResult = await window.electron.auth.getGoogleWorkspaceToken();
        if (!verifyResult.success || !verifyResult.token?.access_token) {
          alert('Gmail authentication completed but token is not available. Please try again.');
          setIsSendingEmail(false);
          return;
        }
      }

      const companyName = summaryResult?.companyName || companyUrl;
      
      // Export reports as DOCX
      const exportResult = await window.electron.invoke(
        'company-research-export-docx',
        companyUrl,
        execSummary?.content || null,
        detailedReport?.content || null
      );
      
      if (!exportResult.success || exportResult.files.length === 0) {
        alert('Failed to export reports');
        setIsSendingEmail(false);
        return;
      }

      // Prepare attachments
      const attachments = exportResult.files.map((file: { type: string; filePath: string }) => ({
        filename: file.filePath.split('/').pop() || file.filePath.split('\\').pop(),
        path: file.filePath,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }));

      const subject = `Company Research Report: ${companyName}`;
      const body = `Hello,

Please find attached the company research reports for ${companyName}.

${execSummary ? '• Executive Summary\n' : ''}${detailedReport ? '• Detailed Report\n' : ''}
---
Generated by EGDesk Company Research`;

      // Send via Gmail API (using the legacy gmail-send handler which accesses the token internally)
      const result = await window.electron.invoke('gmail-send', {
        to: emailAddress.trim(),
        subject,
        body,
        attachments,
      });

      if (result.success) {
        alert('Email sent successfully!');
        setShowEmailModal(false);
        setEmailAddress('');
      } else {
        alert(`Failed to send: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      alert(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again.`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const getProgress = () => {
    if (!workflowStatus) return 0;
    const stage = STAGES.find(s => s.key === workflowStatus.stage);
    return stage?.progress || 5;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const hasResults = execSummary || detailedReport || summaryResult;

  return (
    <div className="crt">
      {/* Header Bar */}
      <div className="crt-header">
        <div className="crt-search-row">
          <div className="crt-input-wrap">
            <span className="crt-input-icon">🌐</span>
            <input
              type="text"
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleResearchClick()}
              placeholder="Enter company domain..."
              className="crt-input"
              disabled={isResearching}
            />
          </div>
          <button
            onClick={handleResearchClick}
            disabled={isResearching || !companyUrl.trim()}
            className="crt-btn crt-btn-primary"
          >
            {isResearching ? <span className="crt-spinner" /> : '🔍'} 
            <span>{isResearching ? 'Researching...' : 'Research'}</span>
          </button>
          <button
            onClick={handleSignIn}
            className="crt-btn crt-btn-secondary crt-btn-google"
            title={hasValidOAuthToken ? 'Google Account Connected' : 'Sign in with Google'}
            disabled={isSendingEmail}
          >
            <FontAwesomeIcon icon={faGoogle} />
            {hasValidOAuthToken ? 'Google Connected' : 'Connect Google'}
          </button>
          {hasResults && !isResearching && (
            <>
            <button
              onClick={() => handleResearch(true)}
              className="crt-btn crt-btn-ghost"
              title="Re-run research"
            >
              🔄
            </button>
              <button
                onClick={() => openEmailModal(execSummary ? 'executive' : 'detailed')}
                className="crt-btn crt-btn-ghost"
                title="Send via email"
              >
                ✉️
              </button>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {isResearching && workflowStatus && (
          <div className="crt-progress">
            <div className="crt-progress-bar">
              <div 
                className="crt-progress-fill" 
                style={{ width: `${getProgress()}%` }}
              />
            </div>
            <span className="crt-progress-text">{workflowStatus.message}</span>
          </div>
        )}

        {/* Error */}
        {errorMessage && (
          <div className="crt-error">
            <span>⚠️ {errorMessage}</span>
            <button onClick={() => setErrorMessage(null)}>×</button>
          </div>
        )}

        {/* View Toggle */}
        <div className="crt-view-toggle">
          <button 
            className={view === 'search' || view === 'result' ? 'active' : ''}
            onClick={() => setView(hasResults ? 'result' : 'search')}
          >
            {hasResults ? 'Results' : 'Research'}
          </button>
          <button 
            className={view === 'history' ? 'active' : ''}
            onClick={() => setView('history')}
          >
            History ({history.length})
          </button>
        </div>
      </div>

      {/* Existing Research Prompt */}
      {showExistingPrompt && existingRecord && (
        <div className="crt-overlay">
          <div className="crt-prompt">
            <div className="crt-prompt-icon">📋</div>
            <h3>Existing Research Found</h3>
            <p>
              Research for <strong>{existingRecord.companyName || existingRecord.domain}</strong> was 
              completed {formatDate(existingRecord.createdAt).toLowerCase()}.
            </p>
            <div className="crt-prompt-actions">
              <button 
                className="crt-btn crt-btn-primary"
                onClick={() => handleExistingChoice('view')}
              >
                👁️ View Existing
              </button>
              <button 
                className="crt-btn crt-btn-secondary"
                onClick={() => handleExistingChoice('redo')}
              >
                🔄 Research Again
              </button>
            </div>
            <button 
              className="crt-prompt-close"
              onClick={() => {
                setShowExistingPrompt(false);
                setExistingRecord(null);
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="crt-overlay">
          <div className="crt-prompt crt-email-modal">
            <div className="crt-prompt-icon">✉️</div>
            <h3>Send Reports via Email</h3>
            <p>
              Export and send research reports for{' '}
              <strong>{summaryResult?.companyName || companyUrl}</strong>
            </p>
            <div className="crt-export-info">
              <div className="crt-export-files">
                {execSummary && <span className="crt-file-badge">📋 Executive Summary</span>}
                {detailedReport && <span className="crt-file-badge">📝 Detailed Report</span>}
              </div>
              <p className="crt-export-format">Will be exported as DOCX files</p>
            </div>
            <div className="crt-email-input-wrap">
              <input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendEmail()}
                placeholder="Enter recipient email..."
                className="crt-email-input"
                autoFocus
              />
            </div>
            <p className="crt-email-note">
              Files will be exported and the reports folder will open for easy attachment.
            </p>
            <div className="crt-prompt-actions">
              <button 
                className="crt-btn crt-btn-primary"
                onClick={handleSendEmail}
                disabled={isSendingEmail || !emailAddress.trim()}
              >
                {isSendingEmail ? <span className="crt-spinner" /> : '📤'} Export & Email
              </button>
              <button 
                className="crt-btn crt-btn-secondary"
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailAddress('');
                }}
              >
                Cancel
              </button>
            </div>
            <button 
              className="crt-prompt-close"
              onClick={() => {
                setShowEmailModal(false);
                setEmailAddress('');
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="crt-content">
        {/* Search/Empty State */}
        {view === 'search' && !isResearching && !hasResults && (
          <div className="crt-empty">
            <div className="crt-empty-icon">🔬</div>
            <h3>Research a Company</h3>
            <p>Enter a company domain above to get AI-powered analysis and insights.</p>
            {history.length > 0 && (
              <button 
                className="crt-btn crt-btn-secondary"
                onClick={() => setView('history')}
              >
                Or view past research →
              </button>
            )}
          </div>
        )}

        {/* History View */}
        {view === 'history' && (
          <div className="crt-history">
            {history.length === 0 ? (
              <div className="crt-empty">
                <div className="crt-empty-icon">📋</div>
                <p>No research history yet</p>
              </div>
            ) : (
              <div className="crt-history-list">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="crt-history-item"
                    onClick={() => loadFromHistory(item)}
                  >
                    <div className="crt-history-avatar">
                      {(item.companyName || item.domain).charAt(0).toUpperCase()}
                    </div>
                    <div className="crt-history-info">
                      <span className="crt-history-name">
                        {item.companyName || item.domain}
                      </span>
                      <span className="crt-history-domain">{item.domain}</span>
                    </div>
                    <div className="crt-history-meta">
                      <span className={`crt-status crt-status-${item.status}`}>
                        {item.status === 'completed' ? '✓' : '•'}
                      </span>
                      <span className="crt-history-date">{formatDate(item.createdAt)}</span>
                    </div>
                    <button
                      className="crt-history-delete"
                      onClick={(e) => deleteFromHistory(item.id, e)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Results View */}
        {view === 'result' && hasResults && (
          <div className="crt-results">
            {/* Company Header */}
            {summaryResult && (
              <div className="crt-company">
                <div className="crt-company-avatar">
                  {summaryResult.companyName?.charAt(0) || '?'}
                </div>
                <div className="crt-company-info">
                  <h2>{summaryResult.companyName || companyUrl}</h2>
                  <div className="crt-company-meta">
                    {summaryResult.headquarters && <span>📍 {summaryResult.headquarters}</span>}
                    {summaryResult.establishedYear && <span>📅 Est. {summaryResult.establishedYear}</span>}
                  </div>
                  {summaryResult.businessFields?.length > 0 && (
                    <div className="crt-tags">
                      {summaryResult.businessFields.slice(0, 3).map((f: string, i: number) => (
                        <span key={i} className="crt-tag">{f}</span>
                      ))}                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Result Tabs */}
            {(execSummary || detailedReport) && (
              <>
                <div className="crt-tabs">
                  {execSummary && (
                    <button
                      className={resultTab === 'executive' ? 'active' : ''}
                      onClick={() => setResultTab('executive')}
                    >
                      📋 Executive Summary
                    </button>
                  )}
                  {detailedReport && (
                    <button
                      className={resultTab === 'detailed' ? 'active' : ''}
                      onClick={() => setResultTab('detailed')}
                    >
                      📝 Full Report
                    </button>
                  )}
                  {summaryResult && (
                    <button
                      className={resultTab === 'profile' ? 'active' : ''}
                      onClick={() => setResultTab('profile')}
                    >
                      📊 Profile
                    </button>
                  )}
                </div>

                <div className="crt-tab-content">
                  {resultTab === 'executive' && execSummary && (
                    <div className="crt-report">
                      <div className="crt-report-actions">
                        <button onClick={() => handleExport('executive')}>⬇️ Export</button>
                        <button onClick={() => openEmailModal('executive')} className="crt-btn-email">✉️ Email</button>
                      </div>
                      <div className="crt-markdown">
                        <ReactMarkdown>{execSummary.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {resultTab === 'detailed' && detailedReport && (
                    <div className="crt-report">
                      <div className="crt-report-actions">
                        <button onClick={() => handleExport('detailed')}>⬇️ Export</button>
                        <button onClick={() => openEmailModal('detailed')} className="crt-btn-email">✉️ Email</button>
                      </div>
                      <div className="crt-markdown">
                        <ReactMarkdown>{detailedReport.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {resultTab === 'profile' && summaryResult && (
                    <div className="crt-profile">
                      {summaryResult.productsServices?.length > 0 && (
                        <div className="crt-profile-section">
                          <h4>Products & Services</h4>
                          <ul>
                            {summaryResult.productsServices.map((p: string, i: number) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {summaryResult.majorProjects?.length > 0 && (
                        <div className="crt-profile-section">
                          <h4>Major Projects</h4>
                          <ul>
                            {summaryResult.majorProjects.map((p: string, i: number) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {summaryResult.contactInfo && (
                        <div className="crt-profile-section">
                          <h4>Contact</h4>
                          <div className="crt-contact">
                            {summaryResult.contactInfo.email && <p>📧 {summaryResult.contactInfo.email}</p>}
                            {summaryResult.contactInfo.phone && <p>📞 {summaryResult.contactInfo.phone}</p>}
                            {summaryResult.contactInfo.address && <p>📍 {summaryResult.contactInfo.address}</p>}
                          </div>
                        </div>
                      )}
                      {summaryResult.rawSummary && (
                        <div className="crt-profile-section">
                          <h4>Overview</h4>
                          <p className="crt-overview">{summaryResult.rawSummary}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyResearchTab;