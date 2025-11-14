import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faGlobe, faMagic } from '../../utils/fontAwesomeIcons';
import { useLocation, useNavigate } from 'react-router-dom';
import { chatWithGemma } from '../../lib/gemmaClient';
import BusinessIdentityScheduledDemo, { BusinessIdentityScheduledTask } from './BusinessIdentityScheduledDemo';
import './EGBusinessIdentity.css';
import { buildInstagramStructuredPrompt } from './instagramPrompt';

const BUSINESS_IDENTITY_SYSTEM_PROMPT = `You are a structured-data generator. Always answer by returning strictly valid JSON that matches this schema:

{
  "source": {
    "url": string,
    "title": string,
    "status": number,
    "language": string | null,
    "description": string | null,
    "wordCount": number,
    "keywords": string[],
    "excerpt": string | null
  },
  "identity": {
    "coreIdentity": string,
    "brandCategory": string,
    "targetAudience": string,
    "signatureProof": string,
    "toneVoice": string
  },
  "recommendedActions": [
    {
      "label": string,
      "detail": string
    }
  ]
}

Rules:
- Emit only JSON (no markdown, prose, or explanations).
- Populate null where data is unavailable.
- Keep strings concise (≤ 280 chars when possible).
- Limit keywords to the top 5 ranked terms.`;

const SNS_PLAN_SYSTEM_PROMPT = `You are an SNS marketing planner. Always respond with strictly valid JSON matching:

{
  "snsPlan": [
    {
      "channel": "Instagram" | "Twitter" | "LinkedIn" | "Blog" | string,
      "title": string,
      "summary": string,
      "cadence": {
        "type": "daily" | "weekly" | "monthly" | "custom",
        "dayOfWeek": number | null,
        "dayOfMonth": number | null,
        "customDays": number | null,
        "time": string
      },
      "topics": string[],
      "assets": {
        "mediaStyle": string,
        "copyGuidelines": string,
        "cta": string,
        "extraNotes": string | null
      }
    }
  ]
}

Rules:
- Emit only JSON (no prose).
- Provide at least 3 plan entries across multiple channels when possible.
- Keep strings concise (≤ 200 chars).`;

const BUSINESS_IDENTITY_URL_KEY = 'businessIdentityUrl';

interface IdentitySnapshot {
  id: string;
  brandKey: string;
  sourceUrl: string | null;
  identityJson: string;
  createdAt: string | Date;
}

interface SnsPlanEntry {
  channel: string;
  title: string;
  summary: string;
  cadence: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom' | string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    customDays: number | null;
    time: string;
  };
  topics: string[];
  assets: {
    mediaStyle?: string;
    copyGuidelines?: string;
    cta?: string;
    extraNotes?: string | null;
  };
}

interface SnsPlanEntry {
  channel: string;
  title: string;
  summary: string;
  cadence: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom' | string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    customDays: number | null;
    time: string;
  };
  topics: string[];
  assets: {
    mediaStyle?: string;
    copyGuidelines?: string;
    cta?: string;
    extraNotes?: string | null;
  };
}

interface StoredSnsPlan {
  id: string;
  snapshotId: string;
  channel: string;
  title: string;
  cadenceType: string;
  cadenceValue: number | null;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  scheduledTime: string;
  topicsJson: string;
  assetsJson: string | null;
}

const DEFAULT_SNS_PLAN_TIME = '09:00';

const normalizeCadenceType = (value?: string): 'daily' | 'weekly' | 'monthly' | 'custom' => {
  if (!value) return 'custom';
  const normalized = value.toLowerCase();
  if (normalized === 'daily' || normalized === 'weekly' || normalized === 'monthly' || normalized === 'custom') {
    return normalized;
  }
  return 'custom';
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const normalizeTimeString = (value?: string): string => {
  if (!value) return DEFAULT_SNS_PLAN_TIME;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return DEFAULT_SNS_PLAN_TIME;
  const hours = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minutes = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const buildAssetsPayload = (plan: SnsPlanEntry): Record<string, any> | null => {
  const assets: Record<string, any> = {
    mediaStyle: plan.assets?.mediaStyle,
    copyGuidelines: plan.assets?.copyGuidelines,
    cta: plan.assets?.cta,
    extraNotes: plan.assets?.extraNotes ?? null,
    summary: plan.summary,
  };

  const entries = Object.entries(assets).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );

  if (entries.length === 0) {
    return null;
  }

  return entries.reduce<Record<string, any>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
};

const mapSnsPlanEntriesToStorage = (
  snapshotId: string,
  plans: SnsPlanEntry[]
): BusinessIdentitySnsPlanInput[] =>
  plans.map((plan, index) => {
    const topics = Array.isArray(plan.topics)
      ? plan.topics.filter((topic) => typeof topic === 'string' && topic.trim().length > 0)
      : [];

    return {
      snapshotId,
      channel: plan.channel?.trim() || `Channel ${index + 1}`,
      title: plan.title?.trim() || `Plan ${index + 1}`,
      cadenceType: normalizeCadenceType(plan.cadence?.type),
      cadenceValue: isFiniteNumber(plan.cadence?.customDays) ? plan.cadence?.customDays ?? null : null,
      dayOfWeek: isFiniteNumber(plan.cadence?.dayOfWeek) ? plan.cadence?.dayOfWeek ?? null : null,
      dayOfMonth: isFiniteNumber(plan.cadence?.dayOfMonth) ? plan.cadence?.dayOfMonth ?? null : null,
      scheduledTime: normalizeTimeString(plan.cadence?.time),
      topics,
      assets: buildAssetsPayload(plan),
      enabled: true,
    };
  });

const EGBusinessIdentity: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
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

  const getBrandKeyFromValue = useCallback((value: string) => {
    try {
      const parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
      return parsed.hostname?.toLowerCase() || parsed.toString();
    } catch {
      return value.trim().toLowerCase();
    }
  }, []);

  const parsedIdentity = useMemo(() => {
    if (!identitySnapshot?.identityJson) return null;
    try {
      return JSON.parse(identitySnapshot.identityJson);
    } catch {
      return null;
    }
  }, [identitySnapshot]);

  const parseStoredTopics = (topicsJson: string): string[] => {
    try {
      const parsed = JSON.parse(topicsJson);
      if (Array.isArray(parsed)) {
        return parsed.filter((topic) => typeof topic === 'string' && topic.trim().length > 0);
      }
    } catch {
      // ignore
    }
    return [];
  };

  const parseStoredAssets = (assetsJson: string | null): {
    mediaStyle?: string;
    copyGuidelines?: string;
    cta?: string;
    extraNotes?: string | null;
    summary?: string;
  } => {
    if (!assetsJson) {
      return {};
    }
    try {
      const parsed = JSON.parse(assetsJson);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  };

  const mapStoredPlanToEntry = (plan: StoredSnsPlan): SnsPlanEntry => {
    const assets = parseStoredAssets(plan.assetsJson);
    return {
      channel: plan.channel,
      title: plan.title,
      summary: typeof assets.summary === 'string' ? assets.summary : '',
      cadence: {
        type: normalizeCadenceType(plan.cadenceType),
        dayOfWeek: isFiniteNumber(plan.dayOfWeek) ? plan.dayOfWeek : null,
        dayOfMonth: isFiniteNumber(plan.dayOfMonth) ? plan.dayOfMonth : null,
        customDays: isFiniteNumber(plan.cadenceValue) ? plan.cadenceValue : null,
        time: normalizeTimeString(plan.scheduledTime),
      },
      topics: parseStoredTopics(plan.topicsJson),
      assets: {
        mediaStyle: typeof assets.mediaStyle === 'string' ? assets.mediaStyle : undefined,
        copyGuidelines: typeof assets.copyGuidelines === 'string' ? assets.copyGuidelines : undefined,
        cta: typeof assets.cta === 'string' ? assets.cta : undefined,
        extraNotes: typeof assets.extraNotes === 'string' ? assets.extraNotes : null,
      },
    };
  };

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
    [fetchStoredSnsPlans, getBrandKeyFromValue]
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
      const planPrompt = [
        'Using the following business identity JSON, create a multi-channel SNS marketing plan.',
        'Identity JSON:',
        JSON.stringify(identityData, null, 2),
      ].join('\n');

      const snsPlanResult = await chatWithGemma(planPrompt, [], {
        stream: false,
        systemPrompt: SNS_PLAN_SYSTEM_PROMPT,
      });

      const jsonMatch = snsPlanResult.content.match(/\{[\s\S]*\}/);
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
        err instanceof Error ? err.message || 'SNS 계획 생성에 실패했습니다.' : 'SNS 계획 생성에 실패했습니다.',
      );
      return null;
    }
  }, []);

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
          username: instagramUsername.trim(),
          password: instagramPassword,
          structuredPrompt,
        });
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
    [parsedIdentity]
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
      setError('먼저 웹사이트 URL을 입력해주세요.');
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

      // Fetch website content
      const fetchResult = await window.electron.web.fetchContent(parsed.toString());
      if (!fetchResult?.success || !fetchResult.content) {
        setError(fetchResult?.error || '웹사이트를 읽어오는 데 실패했습니다.');
        return;
      }

      // Build website context text for AI
      const websiteText = [
        fetchResult.content.title ? `Title: ${fetchResult.content.title}` : '',
        fetchResult.content.description ? `Description: ${fetchResult.content.description}` : '',
        fetchResult.content.text ? `Content: ${fetchResult.content.text}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      // Call AI to generate identity data
      const aiResult = await chatWithGemma(
        'Analyze this website and generate the business identity data in the required JSON format.',
        [],
        {
          stream: false,
          websiteContext: websiteText,
          systemPrompt: BUSINESS_IDENTITY_SYSTEM_PROMPT,
        }
      );

      // Parse JSON response
      let identityData;
      try {
        const jsonMatch = aiResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          identityData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in AI response');
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError, aiResult.content);
        setError('AI 응답을 파싱하는 데 실패했습니다. 다시 시도해주세요.');
        return;
      }

      console.info('[EGBusinessIdentity] AI raw response:', aiResult.content);
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
          aiProvider: 'gemma',
          aiModel: 'gemma-client',
        });
        if (!snapshotResult.success || !snapshotResult.data?.id) {
          throw new Error(snapshotResult.error || 'Failed to save business identity snapshot.');
        }
        snapshotId = snapshotResult.data.id;
        setIdentitySnapshot(snapshotResult.data);
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
            ? storageError.message || '비즈니스 아이덴티티를 저장하지 못했습니다.'
            : '비즈니스 아이덴티티를 저장하지 못했습니다.',
        );
        return;
      }

      // Navigate to preview with the data
      navigate('/egbusiness-identity/preview', {
        state: {
          source: fetchResult.content,
          identityData,
          rawAiResponse: aiResult.content,
          mode: 'ai',
          snapshotId,
          snsPlan: snsPlanData,
        },
      });
    } catch (err) {
      if (err instanceof TypeError) {
        setError('유효한 웹사이트 주소를 입력해주세요 (예: https://example.com).');
      } else {
        setError(
          err instanceof Error
            ? err.message || '웹사이트를 불러오는 중 문제가 발생했습니다.'
            : '웹사이트를 불러오는 중 문제가 발생했습니다.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [generateSnsPlan, getBrandKeyFromValue, navigate, persistSnsPlans, persistUrl, url]);

  useEffect(() => {
    if (location.pathname === '/egbusiness-identity/preview') {
      return;
    }
    if (!storedPlanLoaded) {
      return;
    }
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
  }, [identitySnapshot, navigate, parsedIdentity, snsPlan, storedPlanLoaded, location.pathname]);

  const renderIdentitySummary = () => {
    if (!identitySnapshot || !parsedIdentity) return null;
    const identity = parsedIdentity.identity || {};
    const recommendedActions = Array.isArray(parsedIdentity.recommendedActions)
      ? parsedIdentity.recommendedActions
      : [];
    return (
      <div className="egbusiness-identity__summary-card">
        <div className="egbusiness-identity__summary-header">
          <div>
            <h2>Current Business Identity</h2>
            {identitySnapshot.sourceUrl && (
              <p className="egbusiness-identity__hint">Source: {identitySnapshot.sourceUrl}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setIdentitySnapshot(null);
              setSnsPlan(null);
              setStoredPlanLoaded(false);
            }}
          >
            Generate New Identity
          </button>
        </div>
        <div className="egbusiness-identity__summary-grid">
          <div>
            <h4>Core Identity</h4>
            <p>{identity.coreIdentity || '—'}</p>
          </div>
          <div>
            <h4>Brand Category</h4>
            <p>{identity.brandCategory || '—'}</p>
          </div>
          <div>
            <h4>Target Audience</h4>
            <p>{identity.targetAudience || '—'}</p>
          </div>
          <div>
            <h4>Tone & Voice</h4>
            <p>{identity.toneVoice || '—'}</p>
          </div>
        </div>
        {recommendedActions.length > 0 && (
          <div className="egbusiness-identity__summary-actions">
            <h4>Recommended Actions</h4>
            <ul>
              {recommendedActions.map((action: any, idx: number) => (
                <li key={`${action.label}-${idx}`}>
                  <strong>{action.label}</strong>
                  <span>{action.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {snsPlan && snsPlan.length > 0 && (
          <div className="egbusiness-identity__summary-plan">
            <h4>SNS Plan</h4>
            <div className="egbusiness-identity__summary-plan-grid">
              {snsPlan.map((plan, idx) => (
                <div key={`${plan.channel}-${idx}`} className="egbusiness-identity__summary-plan-card">
                  <div className="egbusiness-identity__summary-plan-header">
                    <span>{plan.channel}</span>
                    <strong>{plan.title}</strong>
                  </div>
                  <p>{plan.summary}</p>
                  <div className="egbusiness-identity__summary-plan-meta">
                    <span>Cadence: {plan.cadence?.type || 'custom'}</span>
                    {plan.cadence?.dayOfWeek !== null && plan.cadence?.dayOfWeek !== undefined && (
                      <span>Day: {plan.cadence.dayOfWeek}</span>
                    )}
                    {plan.cadence?.time && <span>Time: {plan.cadence.time}</span>}
                  </div>
                  {plan.topics?.length > 0 && (
                    <div className="egbusiness-identity__summary-plan-topics">
                      {plan.topics.map((topic) => (
                        <span key={topic}>{topic}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

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
      </header>

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

      {activeTab === 'kickoff' ? (
        <>
          <section className="egbusiness-identity__panel eg-business-identity__panel--primary">
        <div className="egbusiness-identity__panel-heading">
          <span className="egbusiness-identity__icon">
            <FontAwesomeIcon icon={faGlobe} />
          </span>
          <div>
            <h2>Paste your flagship URL</h2>
            <p>We&apos;ll scan the page, capture the tone, and suggest the first draft of your business identity.</p>
          </div>
        </div>

        {identitySnapshot && parsedIdentity ? (
          renderIdentitySummary()
        ) : (
          <div className="egbusiness-identity__input-block">
            <label htmlFor="brand-url">Website URL</label>
            <div className="egbusiness-identity__control">
              <input
                id="brand-url"
                type="url"
                placeholder="https://your-company.com"
                inputMode="url"
                autoComplete="off"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !loading) {
                    handleGenerate();
                  }
                }}
              />
              <button type="button" onClick={handleGenerate} disabled={loading}>
                <FontAwesomeIcon icon={faMagic} />
                {loading ? 'Analyzing…' : 'Generate'}
              </button>
            </div>
            <p className="egbusiness-identity__hint">
              Tip: choose the page that best explains your mission (landing page, manifesto, or investor letter).
            </p>
            {error && <p className="egbusiness-identity__error">{error}</p>}
            {planError && <p className="egbusiness-identity__error">{planError}</p>}
            {loading && !error && (
              <p className="egbusiness-identity__status">
                웹사이트를 불러오고 있습니다. 잠시만 기다려주세요…
              </p>
            )}
          </div>
        )}
      </section>

      <section className="egbusiness-identity__panel egbusiness-identity__panel--secondary">
        <h3>What happens next?</h3>
        <ol>
          <li>We capture keywords, tone, and structure from the page.</li>
          <li>The AI drafts your positioning, voice principles, and content pillars.</li>
          <li>You review, tweak, and launch automated social goals from one place.</li>
        </ol>
      </section>
        </>
      ) : (
        <section className="egbusiness-identity__panel egbusiness-identity__panel--scheduled">
          <div className="egbusiness-identity__panel-heading">
            <span className="egbusiness-identity__icon">
              <FontAwesomeIcon icon={faCalendarAlt} />
            </span>
            <div>
              <h2>Schedule Identity Deliverables</h2>
              <p>Plan recurring content tasks aligned with your business identity strategy.</p>
            </div>
          </div>
          <p className="egbusiness-identity__hint">
            Start from these Cursor-themed example cadences or replace them with your own. Automated scheduling is
            coming soon.
          </p>
          <div className="egbusiness-identity__credentials">
            <div>
              <label htmlFor="instagram-username">Instagram Username</label>
              <input
                id="instagram-username"
                type="text"
                autoComplete="username"
                placeholder="username"
                value={instagramUsername}
                onChange={(event) => setInstagramUsername(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="instagram-password">Instagram Password</label>
              <input
                id="instagram-password"
                type="password"
                autoComplete="current-password"
                placeholder="password"
                value={instagramPassword}
                onChange={(event) => setInstagramPassword(event.target.value)}
              />
            </div>
          </div>
          <BusinessIdentityScheduledDemo onTestPost={handleTestScheduledPost} />
        </section>
      )}
    </div>
  );
};

export default EGBusinessIdentity;

