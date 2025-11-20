import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt } from '../../utils/fontAwesomeIcons';
import { useLocation, useNavigate } from 'react-router-dom';
import { AIService } from '../../services/ai-service';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import type { AIKey } from '../AIKeysManager/types';
import { BusinessIdentityScheduledTask } from './BusinessIdentityScheduledDemo';
import { buildInstagramStructuredPrompt } from './instagramPrompt';
import './EGBusinessIdentity.css';

// Components
import { IdentityKickoff } from './IdentityKickoff';
import { ScheduledPosts } from './ScheduledPosts';
import { AIKeySelector } from './AIKeySelector';

// Types and utilities
import type { IdentitySnapshot, SnsPlanEntry, StoredSnsPlan, IdentityLocationState } from './types';
import { getBrandKeyFromValue, mapSnsPlanEntriesToStorage, handleBlogScheduleToggle, isBlogChannel } from './utils';
import { mapStoredPlanToEntry } from './snsPlanHelpers';
import { runSEOAnalysis, runSSLAnalysis } from './analysisHelpers';

const BUSINESS_IDENTITY_URL_KEY = 'businessIdentityUrl';

const EGBusinessIdentity: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state as IdentityLocationState | null) ?? null;
  const bypassPreviewAutoRedirect = Boolean(locationState?.bypassPreviewAutoRedirect);
  const [activeTab, setActiveTab] = useState<'kickoff' | 'scheduled'>('kickoff');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identitySnapshot, setIdentitySnapshot] = useState<IdentitySnapshot | null>(null);
  const [snsPlan, setSnsPlan] = useState<SnsPlanEntry[] | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [storedPlanLoaded, setStoredPlanLoaded] = useState(false);
  const [instagramUsername, setInstagramUsername] = useState('');
  const [instagramPassword, setInstagramPassword] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  // AI Key selection state
  const [aiKeysState, setAiKeysState] = useState(aiKeysStore.getState());
  const [selectedGoogleKey, setSelectedGoogleKey] = useState<AIKey | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [showKeyDropdown, setShowKeyDropdown] = useState(false);

  const googleKeys = useMemo(
    () => aiKeysState.keys.filter((key) => key.providerId === 'google' && key.isActive),
    [aiKeysState.keys]
  );

  // Configure AI with selected key
  const configureAI = useCallback(
    async (key?: AIKey | null) => {
      const apiKey = key?.fields?.apiKey || '';
      const defaultModel = 'gemini-2.5-flash';

      if (!apiKey) {
        console.warn('Cannot configure Gemini API without an active Google AI key.');
        setIsConfigured(false);
        setConnectionStatus('disconnected');
        return false;
      }

      setConnectionStatus('checking');

      try {
        const success = await AIService.configure({
          apiKey,
          model: defaultModel,
        });

        if (success) {
          setIsConfigured(true);
          setConnectionStatus('connected');
        } else {
          setIsConfigured(false);
          setConnectionStatus('error');
        }

        return success;
      } catch (error) {
        console.error('Error configuring AI client:', error);
        setIsConfigured(false);
        setConnectionStatus('error');
        return false;
      }
    },
    []
  );

  const parsedIdentity = useMemo(() => {
    if (!identitySnapshot?.identityJson) return null;
    try {
      return JSON.parse(identitySnapshot.identityJson);
    } catch {
      return null;
    }
  }, [identitySnapshot]);

  const fetchStoredSnsPlans = useCallback(async (snapshotId: string): Promise<SnsPlanEntry[] | null> => {
    try {
      if (!window.electron?.businessIdentity?.listSnsPlans) {
        return null;
      }
      const result = await window.electron.businessIdentity.listSnsPlans(snapshotId);
      if (result.success && Array.isArray(result.data)) {
        return (result.data as StoredSnsPlan[]).map(mapStoredPlanToEntry);
      }
      return null;
    } catch (err) {
      console.warn('[EGBusinessIdentity] Failed to load stored SNS plans:', err);
      return null;
    }
  }, []);

  const fetchLatestSnapshot = useCallback(
    async (value: string) => {
      setStoredPlanLoaded(false);
      try {
        if (!window.electron?.businessIdentity?.listSnapshots) {
          return;
        }
        const brandKey = getBrandKeyFromValue(value);
        if (!brandKey) {
          setIdentitySnapshot(null);
          setSnsPlan(null);
          setStoredPlanLoaded(true);
          return;
        }
        const response = await window.electron.businessIdentity.listSnapshots(brandKey);
        if (response.success && Array.isArray(response.data) && response.data.length > 0) {
          const latestSnapshot = response.data[0];
          setIdentitySnapshot(latestSnapshot);
          if (latestSnapshot?.id) {
            const storedPlans = await fetchStoredSnsPlans(latestSnapshot.id);
            setSnsPlan(storedPlans);
          } else {
            setSnsPlan(null);
          }
        } else {
          setIdentitySnapshot(null);
          setSnsPlan(null);
        }
        setStoredPlanLoaded(true);
      } catch (err) {
        console.warn('[EGBusinessIdentity] Failed to fetch snapshots:', err);
        setIdentitySnapshot(null);
        setSnsPlan(null);
        setStoredPlanLoaded(true);
      }
    },
    [fetchStoredSnsPlans]
  );

  useEffect(() => {
    const loadStoredUrl = async () => {
      try {
        if (!window.electron?.store?.get) return;
        const stored = await window.electron.store.get(BUSINESS_IDENTITY_URL_KEY);
        if (typeof stored === 'string' && stored.trim().length > 0) {
          setUrl(stored);
          await fetchLatestSnapshot(stored);
        } else {
          setIdentitySnapshot(null);
          setSnsPlan(null);
        }
      } catch (err) {
        console.warn('[EGBusinessIdentity] Failed to load stored URL:', err);
      }
    };
    loadStoredUrl();
  }, [fetchLatestSnapshot]);

  const persistUrl = useCallback(async (value: string) => {
    try {
      if (!window.electron?.store?.set) return;
      await window.electron.store.set(BUSINESS_IDENTITY_URL_KEY, value);
    } catch (err) {
      console.warn('[EGBusinessIdentity] Failed to persist URL:', err);
    }
  }, []);

  const generateSnsPlan = useCallback(async (identityData: any): Promise<SnsPlanEntry[] | null> => {
    try {
      if (!isConfigured) {
        throw new Error('AI is not configured. Please select a Google AI key.');
      }

      const result = await window.electron.web.generateSnsPlan(identityData);

      if (!result.success || !result.content) {
        throw new Error(result.error || 'SNS plan generation failed.');
      }

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('SNS plan response missing JSON.');
      }
      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed?.snsPlan)) {
        throw new Error('snsPlan array missing in response.');
      }
      return parsed.snsPlan as SnsPlanEntry[];
    } catch (err) {
      console.error('[EGBusinessIdentity] SNS plan generation failed:', err);
      setPlanError(
        err instanceof Error ? err.message || 'Failed to generate SNS plan.' : 'Failed to generate SNS plan.',
      );
      return null;
    }
  }, [isConfigured]);

  const persistSnsPlans = useCallback(async (snapshotId: string, plans: SnsPlanEntry[]) => {
    if (!window.electron?.businessIdentity?.saveSnsPlans) {
      console.warn('[EGBusinessIdentity] saveSnsPlans API is unavailable.');
      return;
    }
    if (!plans.length) {
      return;
    }
    const payload = mapSnsPlanEntriesToStorage(snapshotId, plans);
    await window.electron.businessIdentity.saveSnsPlans(snapshotId, payload);
  }, []);

  const handleTestScheduledPost = useCallback(
    async (task: BusinessIdentityScheduledTask) => {
      if (task.channel !== 'Instagram') {
        setPlanError('Test posts currently support Instagram channel tasks.');
        return;
      }
      if (!instagramUsername.trim() || !instagramPassword.trim()) {
        setPlanError('Instagram username and password are required for test posts.');
        return;
      }
      if (!window.electron?.debug?.openInstagramWithProfile) {
        setPlanError('Instagram automation bridge is unavailable.');
        return;
      }
      try {
        const structuredPrompt = buildInstagramStructuredPrompt(task, parsedIdentity);
        const result = await window.electron.debug.openInstagramWithProfile({
          planId: task.planId, // Pass SQLite plan ID for execution tracking
          username: instagramUsername.trim(),
          password: instagramPassword,
          structuredPrompt,
        } as Parameters<typeof window.electron.debug.openInstagramWithProfile>[0]);
        if (!result?.success) {
          setPlanError(result?.error || 'Instagram test post failed. Check automation logs.');
          return;
        }
        setPlanError(null);
        console.info('[EGBusinessIdentity] Instagram test post triggered for task:', task.id);
      } catch (err) {
        setPlanError(
          err instanceof Error ? err.message || 'Instagram test post failed.' : 'Instagram test post failed.'
        );
      }
    },
    [parsedIdentity, instagramUsername, instagramPassword]
  );

  useEffect(() => {
    if (url.trim().length === 0) {
      setIdentitySnapshot(null);
      return;
    }
    fetchLatestSnapshot(url);
  }, [fetchLatestSnapshot, url]);

  const handleGenerate = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter a website URL first.');
      return;
    }

    try {
      setPlanError(null);
      setSnsPlan(null);
      // Validate URL format early to give fast feedback
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      await persistUrl(parsed.toString());
      setLoading(true);
      setError(null);

      // Crawl multiple pages for comprehensive business identity analysis
      console.log('[EGBusinessIdentity] Starting multi-page crawl for business identity...');
      const crawlResult = await window.electron.web.crawlMultiplePages(parsed.toString(), { maxPages: 5 });
      if (!crawlResult?.success || !crawlResult.combinedContent) {
        setError(crawlResult?.error || 'Failed to crawl the website.');
        setLoading(false);
        return;
      }

      console.log('[EGBusinessIdentity] Multi-page crawl completed:', {
        pagesCrawled: crawlResult.combinedContent.pagesCrawled,
        totalWords: crawlResult.combinedContent.totalWordCount,
        domain: crawlResult.domain,
      });

      // Build website context text for AI using combined content from multiple pages
      const websiteText = [
        `Domain: ${crawlResult.domain}`,
        `Pages Crawled: ${crawlResult.combinedContent.pagesCrawled}`,
        `Total Word Count: ${crawlResult.combinedContent.totalWordCount}`,
        crawlResult.siteStructure?.commonPages
          ? `Discovered Pages: ${Object.entries(crawlResult.siteStructure.commonPages)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ')}`
          : '',
        '',
        'Combined Content from Multiple Pages:',
        crawlResult.combinedContent.text || '',
      ]
        .filter(Boolean)
        .join('\n\n');

      // Call AI to generate identity data
      if (!isConfigured) {
        setError('AI is not configured. Please select a Google AI key.');
        setLoading(false);
        return;
      }

      console.log('[EGBusinessIdentity] Generating business identity from crawled content...');
      // Pass the root URL to ensure source.url uses the homepage, not subpages
      const aiResult = await window.electron.web.generateBusinessIdentity(websiteText, parsed.toString());
      if (!aiResult.success || !aiResult.content) {
        setError(aiResult.error || 'Failed to generate AI response.');
        setLoading(false);
        return;
      }
      const aiResultContent = aiResult.content;

      // Parse JSON response
      let identityData;
      try {
        const jsonMatch = aiResultContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          identityData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in AI response');
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError, aiResultContent);
        setError('Failed to parse AI response. Please try again.');
        return;
      }

      console.info('[EGBusinessIdentity] AI raw response:', aiResultContent);
      console.info('[EGBusinessIdentity] Parsed identity data:', identityData);

      let snapshotId: string | undefined;
      let snsPlanData: SnsPlanEntry[] | null = null;
      console.info('[EGBusinessIdentity] Step 3: Persisting snapshot & generating SNS plan');
      try {
        if (!window.electron?.businessIdentity?.createSnapshot) {
          throw new Error('Business identity storage API unavailable.');
        }
        const brandKey = getBrandKeyFromValue(parsed.toString());
        const snapshotResult = await window.electron.businessIdentity.createSnapshot({
          brandKey,
          sourceUrl: parsed.toString(),
          rawInput: websiteText,
          identityJson: JSON.stringify(identityData),
          aiProvider: 'gemini',
          aiModel: 'gemini-2.5-flash',
        });
        if (!snapshotResult.success || !snapshotResult.data?.id) {
          throw new Error(snapshotResult.error || 'Failed to save business identity snapshot.');
        }
        snapshotId = snapshotResult.data.id;
        setIdentitySnapshot(snapshotResult.data);
        setIsEditMode(false); // Exit edit mode after successful generation
        console.info('[EGBusinessIdentity] Snapshot saved:', snapshotResult.data?.id ?? 'unknown');
        console.info('[EGBusinessIdentity] Generating SNS plan with identity data:', identityData);
        snsPlanData = await generateSnsPlan(identityData);
        if (!snsPlanData || snsPlanData.length === 0) {
          console.warn('[EGBusinessIdentity] SNS plan generation returned empty result.');
        } else {
          console.info('[EGBusinessIdentity] SNS plan generation succeeded. Entries:', snsPlanData.length);
          if (snapshotId) {
            try {
              await persistSnsPlans(snapshotId, snsPlanData);
              console.info('[EGBusinessIdentity] SNS plan saved to SQLite:', snsPlanData.length);
            } catch (planSaveError) {
              console.error('[EGBusinessIdentity] Failed to save SNS plan:', planSaveError);
            }
          }
        }
        setSnsPlan(snsPlanData);
        setStoredPlanLoaded(true);
      } catch (storageError) {
        console.error('[EGBusinessIdentity] Failed to persist snapshot:', storageError);
        setError(
          storageError instanceof Error
            ? storageError.message || 'Failed to save business identity.'
            : 'Failed to save business identity.',
        );
        return;
      }

      // Run SEO and SSL checks after SNS plan generation
      console.info('[EGBusinessIdentity] Starting SEO and SSL analysis...');
      let seoAnalysis = null;
      let sslAnalysis = null;
      try {
        const [seoResult, sslResult] = await Promise.allSettled([
          runSEOAnalysis(parsed.toString()),
          runSSLAnalysis(parsed.toString()),
        ]);

        seoAnalysis = seoResult.status === 'fulfilled' ? seoResult.value : null;
        sslAnalysis = sslResult.status === 'fulfilled' ? sslResult.value : null;

        if (seoAnalysis?.success) {
          console.info('[EGBusinessIdentity] SEO analysis completed:', seoAnalysis.scores);
        } else {
          console.warn('[EGBusinessIdentity] SEO analysis failed:', seoAnalysis?.error);
        }

        if (sslAnalysis?.success) {
          console.info('[EGBusinessIdentity] SSL analysis completed:', sslAnalysis.result?.grade);
        } else {
          console.warn('[EGBusinessIdentity] SSL analysis failed:', sslAnalysis?.error);
        }

        // Store analysis results in snapshot
        if (snapshotId && (seoAnalysis || sslAnalysis)) {
          try {
            console.info('[EGBusinessIdentity] Saving analysis results to database...');
            const saveResult = await window.electron.businessIdentity.updateAnalysisResults(
              snapshotId,
              seoAnalysis,
              sslAnalysis
            );
            if (saveResult.success) {
              console.info('[EGBusinessIdentity] Analysis results saved successfully');
            } else {
              console.warn('[EGBusinessIdentity] Failed to save analysis results:', saveResult.error);
            }
          } catch (analysisSaveError) {
            console.error('[EGBusinessIdentity] Failed to save analysis results:', analysisSaveError);
            // Don't fail the entire flow if analysis storage fails
          }
        }
      } catch (analysisError) {
        console.error('[EGBusinessIdentity] Analysis error:', analysisError);
        // Don't fail the entire flow if analysis fails
      }

      // Create a compatible source object from the crawl result
      // Use the homepage page if available, otherwise create a summary
      const homepagePage = crawlResult.pages?.find((p) => p.pageType === 'homepage');
      const source = homepagePage
        ? {
            url: homepagePage.url,
            finalUrl: homepagePage.url,
            status: homepagePage.metadata.status,
            contentType: 'text/html',
            language: homepagePage.metadata.language || null,
            title: homepagePage.title,
            description: homepagePage.description,
            html: '', // Not needed for preview
            text: homepagePage.content.text,
            textPreview: homepagePage.content.text.slice(0, 800),
            wordCount: homepagePage.content.wordCount,
            fetchedAt: homepagePage.metadata.fetchedAt,
          }
        : {
            url: crawlResult.baseUrl,
            finalUrl: crawlResult.baseUrl,
            status: 200,
            contentType: 'text/html',
            language: null,
            title: null,
            description: null,
            html: '',
            text: crawlResult.combinedContent.text,
            textPreview: crawlResult.combinedContent.text.slice(0, 800),
            wordCount: crawlResult.combinedContent.totalWordCount,
            fetchedAt: new Date().toISOString(),
          };

      // Navigate to preview with the data
      navigate('/egbusiness-identity/preview', {
        state: {
          source,
          identityData,
          rawAiResponse: aiResultContent,
          mode: 'ai',
          snapshotId,
          snsPlan: snsPlanData,
          crawlMetadata: {
            pagesCrawled: crawlResult.combinedContent.pagesCrawled,
            totalWords: crawlResult.combinedContent.totalWordCount,
            domain: crawlResult.domain,
            siteStructure: crawlResult.siteStructure,
          },
          analysisResults: {
            seo: seoAnalysis,
            ssl: sslAnalysis,
          },
        },
      });
    } catch (err) {
      if (err instanceof TypeError) {
        setError('Please enter a valid website address (e.g., https://example.com).');
      } else {
        setError(
          err instanceof Error
            ? err.message || 'An error occurred while loading the website.'
            : 'An error occurred while loading the website.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [generateSnsPlan, isConfigured, navigate, persistSnsPlans, persistUrl, url]);

  // Subscribe to AI keys store and configure on mount
  useEffect(() => {
    const unsubscribe = aiKeysStore.subscribe(setAiKeysState);
    checkConfiguration();
    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-select first Google key if available
  useEffect(() => {
    if (googleKeys.length === 0) {
      if (selectedGoogleKey !== null) {
        setSelectedGoogleKey(null);
      }
      setIsConfigured(false);
      setConnectionStatus('disconnected');
      return;
    }

    if (!selectedGoogleKey || !googleKeys.some((key) => key.id === selectedGoogleKey.id)) {
      const nextKey = googleKeys[0];
      setSelectedGoogleKey(nextKey);
      configureAI(nextKey);
    }
  }, [googleKeys, selectedGoogleKey, configureAI]);

  const checkConfiguration = async () => {
    setConnectionStatus('checking');
    const configured = await AIService.isConfigured();
    setIsConfigured(configured);
    setConnectionStatus(configured ? 'connected' : 'disconnected');
  };

  const handleKeySelection = (key: AIKey) => {
    setSelectedGoogleKey(key);
    configureAI(key);
    setShowKeyDropdown(false);
  };

  const toggleKeyDropdown = () => {
    setShowKeyDropdown(!showKeyDropdown);
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'checking': return '🔄';
      case 'connected': return '🟢';
      case 'disconnected': return '🔴';
      case 'error': return '❌';
      default: return '🔴';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'checking':
        return 'Checking connection...';
      case 'connected':
        return `Connected with ${selectedGoogleKey?.name || 'Google AI'}`;
      case 'disconnected':
        return 'No Google AI key available';
      case 'error':
        return 'Connection error';
      default:
        return 'Disconnected';
    }
  };

  // Set edit mode when navigating from preview with bypassPreviewAutoRedirect
  useEffect(() => {
    if (bypassPreviewAutoRedirect) {
      setIsEditMode(true);
    }
  }, [bypassPreviewAutoRedirect]);

  useEffect(() => {
    if (location.pathname === '/egbusiness-identity/preview') {
      return;
    }
    if (bypassPreviewAutoRedirect) {
      return;
    }
    if (!storedPlanLoaded) {
      return;
    }
    if (!identitySnapshot || !parsedIdentity) {
      return;
    }

    // Parse analysis results from snapshot if available
    let analysisResults: { seo?: any; ssl?: any } | undefined;
    if (identitySnapshot.seoAnalysisJson || identitySnapshot.sslAnalysisJson) {
      analysisResults = {};
      if (identitySnapshot.seoAnalysisJson) {
        try {
          analysisResults.seo = JSON.parse(identitySnapshot.seoAnalysisJson);
        } catch (e) {
          console.warn('[EGBusinessIdentity] Failed to parse SEO analysis:', e);
        }
      }
      if (identitySnapshot.sslAnalysisJson) {
        try {
          analysisResults.ssl = JSON.parse(identitySnapshot.sslAnalysisJson);
        } catch (e) {
          console.warn('[EGBusinessIdentity] Failed to parse SSL analysis:', e);
        }
      }
    }

    navigate('/egbusiness-identity/preview', {
      state: {
        source: parsedIdentity.source,
        identityData: parsedIdentity,
        rawAiResponse: identitySnapshot.identityJson,
        mode: 'ai',
        snapshotId: identitySnapshot.id,
        snsPlan,
        analysisResults,
      },
    });
  }, [
    identitySnapshot,
    navigate,
    parsedIdentity,
    snsPlan,
    storedPlanLoaded,
    location.pathname,
    bypassPreviewAutoRedirect,
  ]);

  const handleGenerateNew = () => {
    setIdentitySnapshot(null);
    setSnsPlan(null);
    setStoredPlanLoaded(false);
    setIsEditMode(true);
  };

  const handleGoBack = useCallback(() => {
    if (!identitySnapshot || !parsedIdentity) {
      return;
    }
    navigate('/egbusiness-identity/preview', {
      state: {
        source: parsedIdentity.source,
        identityData: parsedIdentity,
        rawAiResponse: identitySnapshot.identityJson,
        mode: 'ai',
        snapshotId: identitySnapshot.id,
        snsPlan,
      },
    });
  }, [identitySnapshot, parsedIdentity, snsPlan, navigate]);

  return (
    <div className="egbusiness-identity demo">
      <header className="egbusiness-identity__header">
        <div>
          <h1>Business Identity Kickoff</h1>
          <p className="egbusiness-identity__intro">
            Share a single URL that best represents your brand today. We&apos;ll fetch the narrative and
            start shaping your identity brief instantly.
          </p>
        </div>
        <AIKeySelector
          googleKeys={googleKeys}
          selectedGoogleKey={selectedGoogleKey}
          connectionStatus={connectionStatus}
          showKeyDropdown={showKeyDropdown}
          onToggleDropdown={toggleKeyDropdown}
          onKeySelection={handleKeySelection}
          getConnectionStatusIcon={getConnectionStatusIcon}
          getConnectionStatusText={getConnectionStatusText}
        />
      </header>

      {!isEditMode && (
        <div className="egbusiness-identity__tabs">
          <button
            type="button"
            className={`egbusiness-identity__tab${activeTab === 'kickoff' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('kickoff')}
          >
            Identity Kickoff
          </button>
          <button
            type="button"
            className={`egbusiness-identity__tab${activeTab === 'scheduled' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('scheduled')}
          >
            Scheduled Posts
          </button>
        </div>
      )}

      {isEditMode || activeTab === 'kickoff' ? (
        <IdentityKickoff
          url={url}
          onUrlChange={setUrl}
          onGenerate={handleGenerate}
          loading={loading}
          error={error}
          planError={planError}
          isConfigured={isConfigured}
          identitySnapshot={isEditMode ? null : identitySnapshot}
          parsedIdentity={isEditMode ? null : parsedIdentity}
          snsPlan={snsPlan}
          onGenerateNew={handleGenerateNew}
          isEditMode={isEditMode}
          onGoBack={isEditMode && identitySnapshot && parsedIdentity ? handleGoBack : undefined}
        />
      ) : (
        <ScheduledPosts
          instagramUsername={instagramUsername}
          instagramPassword={instagramPassword}
          onInstagramUsernameChange={setInstagramUsername}
          onInstagramPasswordChange={setInstagramPassword}
          onTestPost={handleTestScheduledPost}
          onToggleSchedule={async (task, isActive) => {
            console.log(`[EGBusinessIdentity] Toggle schedule for ${task.id}: ${isActive ? 'active' : 'paused'}`);
            
            // Handle blog channels (WordPress, Naver, Tistory)
            if (isBlogChannel(task.channel)) {
              const result = await handleBlogScheduleToggle(task, isActive, snsPlan ?? undefined);
              if (result.success) {
                console.log(`[EGBusinessIdentity] Schedule ${isActive ? 'activated' : 'deactivated'} successfully`);
                // Optionally show a success message to the user
              } else {
                console.error(`[EGBusinessIdentity] Failed to toggle schedule:`, result.error);
                alert(`Failed to ${isActive ? 'activate' : 'deactivate'} schedule: ${result.error || 'Unknown error'}`);
              }
            } else {
              // For non-blog channels (Instagram, etc.), just log for now
              console.log(`[EGBusinessIdentity] Schedule toggle for ${task.channel} not yet implemented`);
            }
          }}
          hasAccountForChannel={(channel) => {
            // For Instagram, check if credentials are stored
            if (channel.toLowerCase() === 'instagram') {
              return instagramUsername.trim().length > 0 && instagramPassword.trim().length > 0;
            }
            // For other channels, check SQLite accounts (if API available)
            // TODO: Implement check for other channels via SQLite accounts table
            return false;
          }}
        />
      )}
    </div>
  );
};

export default EGBusinessIdentity;
