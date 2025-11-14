import React, { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCalendarAlt, faMagic, faRocket } from '../../utils/fontAwesomeIcons';
import './EGBusinessIdentityResultDemo.css';
import type { WebsiteContentSummary } from '../../main/preload';
import BusinessIdentityScheduledDemo, { BusinessIdentityScheduledTask } from './BusinessIdentityScheduledDemo';
import { buildInstagramStructuredPrompt } from './instagramPrompt';

interface IdentityBlock {
  title: string;
  description: string;
}

interface RecommendedAction {
  label: string;
  detail: string;
}

interface SourceMeta {
  title: string;
  url: string;
  status: number;
  language?: string | null;
  wordCount: number;
  keywords: string[];
  description?: string | null;
  preview?: string;
}

interface IdentityInsights {
  identityBlocks: IdentityBlock[];
  actions: RecommendedAction[];
  sourceMeta?: SourceMeta;
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

const FALLBACK_IDENTITY: IdentityInsights = {
  identityBlocks: [
    {
      title: 'Core identity',
      description:
        'Cursor is the AI-native coding workspace that merges your editor with a collaborative agent so teams can ship faster together.',
    },
    {
      title: 'Brand category',
      description:
        'AI pair-programming IDE and autonomous code execution environment for modern development teams.',
    },
    {
      title: 'Target audience',
      description:
        'Product engineers, startup founders, and high-velocity teams that want an always-on coding collaborator.',
    },
    {
      title: 'Signature proof',
      description:
        'Teams report 3× faster feature delivery by pairing Cursor’s sprint mode with their existing repository.',
    },
    {
      title: 'Tone & voice',
      description:
        'Crisp, optimistic, and technical—sound like a senior engineer explaining breakthroughs to the squad.',
    },
  ],
  actions: [
    {
      label: 'Weekly build journal',
      detail:
        'Publish a Wednesday 9 AM devlog recapping shipped Cursor features and workflows for the community to try.',
    },
    {
      label: 'SEO pulse check',
      detail:
        'Audit cursor.sh every Friday for ranking shifts, schema gaps, and quick technical fixes; send a one-page summary.',
    },
    {
      label: 'Daily social heartbeat',
      detail:
        'Push daily 2 PM social posts alternating pair-programming tips, release GIFs, and user win threads.',
    },
    {
      label: 'Monthly community loop',
      detail:
        'Host a “Ship with Cursor” session on the first Monday each month and fold live questions back into agent prompts.',
    },
  ],
  sourceMeta: {
    title: 'Cursor – The AI code editor',
    url: 'https://cursor.sh',
    status: 200,
    language: 'en',
    wordCount: 260,
    keywords: ['cursor', 'editor', 'code', 'ai', 'pair-programming'],
    description:
      'Cursor is the code editor that combines AI agents with your repo, so product teams can ship faster together.',
    preview:
      'The fastest way to ship software. Cursor brings AI into your coding environment, transforming the way teams plan, code, and deliver features.',
  },
};

interface IdentityData {
  source?: {
    url: string;
    title: string;
    status: number;
    language?: string | null;
    description?: string | null;
    wordCount: number;
    keywords: string[];
    excerpt?: string | null;
  };
  identity?: {
    coreIdentity: string;
    brandCategory: string;
    targetAudience: string;
    signatureProof: string;
    toneVoice: string;
  };
  recommendedActions?: Array<{
    label: string;
    detail: string;
  }>;
}

function buildInsightsFromIdentityData(
  identityData: IdentityData,
  source?: WebsiteContentSummary
): IdentityInsights {
  const identity = identityData.identity;
  const sourceMeta = identityData.source;
  const actions = identityData.recommendedActions || [];

  const identityBlocks: IdentityBlock[] = identity
    ? [
        { title: 'Core identity', description: identity.coreIdentity },
        { title: 'Brand category', description: identity.brandCategory },
        { title: 'Target audience', description: identity.targetAudience },
        { title: 'Signature proof', description: identity.signatureProof },
        { title: 'Tone & voice', description: identity.toneVoice },
      ]
    : [];

  const sourceMetaData: SourceMeta | undefined = sourceMeta
    ? {
        title: sourceMeta.title,
        url: sourceMeta.url,
        status: sourceMeta.status,
        language: sourceMeta.language,
        wordCount: sourceMeta.wordCount,
        keywords: sourceMeta.keywords,
        description: sourceMeta.description || null,
        preview: sourceMeta.excerpt || undefined,
      }
    : source
      ? {
          title: source.title || safeGetHost(source.finalUrl || source.url),
          url: source.finalUrl || source.url,
          status: source.status,
          language: source.language,
          wordCount: source.wordCount,
          keywords: extractKeywords(source.text, 5),
          description: source.description || null,
          preview: source.textPreview,
        }
      : undefined;

  return {
    identityBlocks: identityBlocks.length > 0 ? identityBlocks : FALLBACK_IDENTITY.identityBlocks,
    actions: actions.length > 0 ? actions : FALLBACK_IDENTITY.actions,
    sourceMeta: sourceMetaData || FALLBACK_IDENTITY.sourceMeta,
  };
}

const ResultDemo: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'identity' | 'scheduled'>('identity');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [instagramPassword, setInstagramPassword] = useState('');
  const source = useMemo<WebsiteContentSummary | undefined>(() => {
    const maybeState = location.state as { source?: WebsiteContentSummary } | undefined;
    if (maybeState && maybeState.source && typeof maybeState.source === 'object') {
      return maybeState.source;
    }
    return undefined;
  }, [location.state]);

  const { identityData, rawAiResponse, snsPlan } = useMemo<{
    identityData?: IdentityData;
    rawAiResponse?: string;
    snsPlan?: SnsPlanEntry[];
  }>(() => {
    const maybeState = location.state as {
      identityData?: IdentityData;
      rawAiResponse?: string;
      snsPlan?: SnsPlanEntry[];
    } | undefined;
    if (!maybeState) {
      return {};
    }
    const parsedIdentity =
      maybeState.identityData && typeof maybeState.identityData === 'object'
        ? maybeState.identityData
        : undefined;
    const raw = typeof maybeState.rawAiResponse === 'string' ? maybeState.rawAiResponse : undefined;
    const plan =
      Array.isArray(maybeState.snsPlan) && maybeState.snsPlan.length > 0 ? maybeState.snsPlan : undefined;
    return { identityData: parsedIdentity, rawAiResponse: raw, snsPlan: plan };
  }, [location.state]);

  const displayMode = useMemo<'ai' | 'demo'>(() => {
    const maybeState = location.state as { mode?: string } | undefined;
    if (maybeState?.mode === 'ai' || maybeState?.mode === 'demo') {
      return maybeState.mode;
    }
    return identityData ? 'ai' : 'demo';
  }, [identityData, location.state]);

  const insights = useMemo<IdentityInsights>(() => {
    if (identityData) {
      return buildInsightsFromIdentityData(identityData, source);
    }
    return buildInsightsFromSource(source);
  }, [identityData, source]);

  const handleTestScheduledPost = useCallback(
    async (task: BusinessIdentityScheduledTask) => {
      if (task.channel !== 'Instagram') {
        window.alert('Test posts currently support Instagram channel tasks.');
        return;
      }
      if (!instagramUsername.trim() || !instagramPassword.trim()) {
        window.alert('Instagram username and password are required.');
        return;
      }
      if (!window.electron?.debug?.openInstagramWithProfile) {
        window.alert('Instagram automation bridge is unavailable in this build.');
        return;
      }
      try {
        const structuredPrompt = buildInstagramStructuredPrompt(task, identityData);
        const result = await window.electron.debug.openInstagramWithProfile({
          username: instagramUsername.trim(),
          password: instagramPassword,
          structuredPrompt,
        });
        if (!result?.success) {
          window.alert(result?.error || 'Instagram test post failed. Check automation logs.');
          return;
        }
        window.alert('Instagram automation launched. Check the Playwright window to review the draft.');
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message || 'Instagram test post failed.' : 'Instagram test post failed.'
        );
      }
    },
    [identityData, instagramPassword, instagramUsername]
  );

  return (
    <div className="egbusiness-identity-result">
      <header className="egbusiness-identity-result__header">
        <button
          type="button"
          onClick={() => navigate(-1)}
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          Back
        </button>
        <div className="egbusiness-identity-result__headline">
          <div>
            <h1>Identity Brief Preview</h1>
            <p>
              {insights.sourceMeta ? (
                <>
                  Based on <strong>{insights.sourceMeta.url}</strong>. This view shows what the AI has available
                  after reading your flagship page.
                </>
              ) : (
                <>
                  Based on <strong>https://cursor.sh</strong>. This demo shows how the AI summarises Cursor’s
                  positioning, voice, and go-to-market focus before you approve anything.
                </>
              )}
            </p>
          </div>
          <span
            className={`egbusiness-identity-result__tag ${
              displayMode === 'ai'
                ? 'egbusiness-identity-result__tag--ai'
                : 'egbusiness-identity-result__tag--demo'
            }`}
          >
            {displayMode === 'ai' ? 'AI generated' : 'Demo sample'}
          </span>
        </div>
      </header>
      <div className="egbusiness-identity-result__tabs">
        <button
          type="button"
          className={`egbusiness-identity-result__tab${activeTab === 'identity' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('identity')}
        >
          Identity Preview
        </button>
        <button
          type="button"
          className={`egbusiness-identity-result__tab${activeTab === 'scheduled' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('scheduled')}
        >
          Scheduled Posts
        </button>
      </div>

      {activeTab === 'identity' ? (
        <>
          {insights.sourceMeta && (
            <section className="egbusiness-identity-result__panel egbusiness-identity-result__panel--meta">
              <div className="egbusiness-identity-result__panel-header">
                <span className="egbusiness-identity-result__icon">
                  <FontAwesomeIcon icon={faMagic} />
                </span>
                <div>
                  <h2>Source snapshot</h2>
                  <p>The text below is what the AI will use as grounding context.</p>
                </div>
              </div>
              <div className="egbusiness-identity-result__meta-grid">
                <div>
                  <strong>Title</strong>
                  <p>{insights.sourceMeta.title}</p>
                </div>
                <div>
                  <strong>Status</strong>
                  <p>{insights.sourceMeta.status}</p>
                </div>
                <div>
                  <strong>Language</strong>
                  <p>{insights.sourceMeta.language || 'unknown'}</p>
                </div>
                <div>
                  <strong>Word count</strong>
                  <p>{insights.sourceMeta.wordCount.toLocaleString()}</p>
                </div>
                <div>
                  <strong>Top keywords</strong>
                  <p>
                    {insights.sourceMeta.keywords.length > 0
                      ? insights.sourceMeta.keywords.join(', ')
                      : 'Pending AI classification'}
                  </p>
                </div>
                {insights.sourceMeta.description && (
                  <div className="egbusiness-identity-result__meta-span">
                    <strong>Meta description</strong>
                    <p>{insights.sourceMeta.description}</p>
                  </div>
                )}
              </div>
              {insights.sourceMeta.preview && (
                <div className="egbusiness-identity-result__meta-preview">
                  <strong>Page excerpt</strong>
                  <p>{insights.sourceMeta.preview}</p>
                </div>
              )}
            </section>
          )}

          <section className="egbusiness-identity-result__panel egbusiness-identity-result__panel--summary">
            <div className="egbusiness-identity-result__panel-header">
              <span className="egbusiness-identity-result__icon">
                <FontAwesomeIcon icon={faMagic} />
              </span>
              <div>
                <h2>Identity Foundations</h2>
                <p>Snapshot of what the AI extracted from your flagship page.</p>
              </div>
            </div>
            <div className="egbusiness-identity-result__summary-grid">
              {insights.identityBlocks.map((block) => (
                <article key={block.title} className="egbusiness-identity-result__block">
                  <h3>{block.title}</h3>
                  <p>{block.description}</p>
                </article>
              ))}
            </div>
          </section>

          {rawAiResponse && (
            <section className="egbusiness-identity-result__panel">
              <div className="egbusiness-identity-result__panel-header">
                <span className="egbusiness-identity-result__icon">
                  <FontAwesomeIcon icon={faMagic} />
                </span>
                <div>
                  <h2>Debug · AI raw response</h2>
                  <p>Inspect the exact JSON the assistant returned.</p>
                </div>
              </div>
              <pre className="egbusiness-identity-result__raw">
                {rawAiResponse}
              </pre>
            </section>
          )}

          <section className="egbusiness-identity-result__panel">
            <div className="egbusiness-identity-result__panel-header">
              <span className="egbusiness-identity-result__icon">
                <FontAwesomeIcon icon={faRocket} />
              </span>
              <div>
                <h2>Recommended actions</h2>
                <p>Starter automations tailored to this identity. Approve to put them on your calendar.</p>
              </div>
            </div>

            <ul className="egbusiness-identity-result__actions-list">
              {insights.actions.map((action) => (
                <li key={action.label}>
                  <span className="egbusiness-identity-result__actions-list-label">{action.label}</span>
                  <p>{action.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          {snsPlan && (
            <section className="egbusiness-identity-result__panel egbusiness-identity-result__panel--sns-plan">
              <div className="egbusiness-identity-result__panel-header">
                <span className="egbusiness-identity-result__icon">
                  <FontAwesomeIcon icon={faCalendarAlt} />
                </span>
                <div>
                  <h2>SNS plan</h2>
                  <p>Channel-ready cadences generated from this identity.</p>
                </div>
              </div>
              <div className="egbusiness-identity-result__sns-plan-grid">
                {snsPlan.map((plan) => (
                  <article key={`${plan.channel}-${plan.title}`} className="egbusiness-identity-result__sns-plan-card">
                    <header>
                      <span>{plan.channel}</span>
                      <strong>{plan.title}</strong>
                    </header>
                    <p>{plan.summary}</p>
                    <div className="egbusiness-identity-result__sns-plan-meta">
                      <span>Cadence: {plan.cadence?.type || 'custom'}</span>
                      {plan.cadence?.dayOfWeek !== null && plan.cadence?.dayOfWeek !== undefined && (
                        <span>Day: {plan.cadence.dayOfWeek}</span>
                      )}
                      {plan.cadence?.time && <span>Time: {plan.cadence.time}</span>}
                    </div>
                    {plan.topics?.length > 0 && (
                      <div className="egbusiness-identity-result__sns-plan-topics">
                        {plan.topics.map((topic) => (
                          <span key={topic}>{topic}</span>
                        ))}
                      </div>
                    )}
                    {plan.assets?.cta && (
                      <div className="egbusiness-identity-result__sns-plan-assets">
                        <strong>CTA</strong>
                        <p>{plan.assets.cta}</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="egbusiness-identity-result__panel egbusiness-identity-result__panel--scheduled">
          <div className="egbusiness-identity-result__panel-header">
            <span className="egbusiness-identity-result__icon">
              <FontAwesomeIcon icon={faCalendarAlt} />
            </span>
            <div>
              <h2>Scheduled Identity Deliverables</h2>
              <p>Review cadence ideas and prototype automations tied to this identity.</p>
            </div>
          </div>
          <p className="egbusiness-identity-result__hint">
            These Cursor-themed demos will soon sync with the SNS plan cards above so you can approve, edit, and
            publish in one view.
          </p>
          <div className="egbusiness-identity__credentials">
            <div>
              <label htmlFor="result-instagram-username">Instagram Username</label>
              <input
                id="result-instagram-username"
                type="text"
                autoComplete="username"
                placeholder="username"
                value={instagramUsername}
                onChange={(event) => setInstagramUsername(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="result-instagram-password">Instagram Password</label>
              <input
                id="result-instagram-password"
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

export default ResultDemo;

// ========================================================================
// Helper functions
// ========================================================================

const STOP_WORDS = new Set(
  [
    'the',
    'and',
    'that',
    'with',
    'from',
    'into',
    'your',
    'about',
    'this',
    'have',
    'will',
    'what',
    'when',
    'were',
    'there',
    'their',
    'which',
    'while',
    'where',
    'those',
    'these',
    'each',
    'also',
    'through',
    'over',
    'under',
    'just',
    'more',
    'than',
    'some',
    'only',
    'being',
    'such',
    'make',
    'made',
    'most',
    'very',
    'much',
    'like',
    'them',
    'they',
    'been',
    'case',
    'into',
    'upon',
    'because',
    'could',
    'should',
    'would',
    'might',
    'many',
    'every',
    'where',
    'each',
    'other',
    'always',
    'often',
  ].map((word) => word.toLowerCase()),
);

function buildInsightsFromSource(source?: WebsiteContentSummary): IdentityInsights {
  if (!source) {
    return FALLBACK_IDENTITY;
  }

  const host = safeGetHost(source.finalUrl || source.url);
  const keywords = extractKeywords(source.text, 5);
  const coreIdentity = source.description || getFirstSentence(source.text) || host;
  const brandCategory =
    keywords.length > 0
      ? `Keyword signals: ${keywords.join(', ')}`
      : 'Keyword signals pending — refine with AI co-pilot.';
  const targetAudience =
    detectAudience(source.text) ||
    'Audience hints were not explicit — collaborate with the AI brief to tighten this.';
  const signatureProof =
    getFirstParagraph(source.text) ||
    'No clear proof statement found yet — highlight flagship wins for the AI to amplify.';
  const tone = detectTone(source.text);

  const actions: RecommendedAction[] = [
    {
      label: 'Weekly story cadence',
      detail: `Publish a Wednesday 9 AM post on ${host} covering new value unlocks drawn from the site narrative.`,
    },
    {
      label: 'SEO pulse check',
      detail: `Run an SEO audit for ${host} every Friday; let the AI summarize ranking shifts and schema gaps.`,
    },
    {
      label: 'Daily social heartbeat',
      detail:
        'Schedule daily 2 PM social posts rotating between education, proof, and behind-the-scenes glimpses sourced from site copy.',
    },
    {
      label: 'Monthly community loop',
      detail: `Host a monthly “Ask ${host}” live session and feed the collected questions back into the identity brief.`,
    },
  ];

  const identityBlocks: IdentityBlock[] = [
    { title: 'Core identity', description: coreIdentity },
    { title: 'Brand category', description: brandCategory },
    { title: 'Target audience', description: targetAudience },
    { title: 'Signature proof', description: signatureProof },
    { title: 'Tone & voice', description: tone },
  ];

  const sourceMeta: SourceMeta = {
    title: source.title || host,
    url: source.finalUrl || source.url,
    status: source.status,
    language: source.language,
    wordCount: source.wordCount,
    keywords,
    description: source.description,
    preview: source.textPreview,
  };

  return {
    identityBlocks,
    actions,
    sourceMeta,
  };
}

function safeGetHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function extractKeywords(text: string, max = 5): string[] {
  if (!text) return [];
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));

  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([word]) => word);
}

function getFirstSentence(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(.+?[.!?])(\s|$)/);
  if (match) {
    return match[1].trim();
  }
  return null;
}

function getFirstParagraph(text: string): string | null {
  if (!text) return null;
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim());
  const first = paragraphs.find((paragraph) => paragraph.length > 60);
  return first ? first.slice(0, 240).trim() : null;
}

function detectAudience(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\bfor\s+([^.]{12,120})\./i);
  if (match && match[1]) {
    const candidate = capitalize(match[1].trim());
    return candidate.endsWith('.') ? candidate : `${candidate}.`;
  }
  return null;
}

function detectTone(text: string): string {
  if (!text) return 'Tone indicators pending — brief the AI on how you want to sound.';

  const technicalTerms = ['developer', 'engineering', 'platform', 'data', 'api', 'model', 'automation', 'stack'];
  const energeticTerms = ['delight', 'momentum', 'unlock', 'transform', 'ignite', 'accelerate'];
  const trustTerms = ['secure', 'privacy', 'compliance', 'trusted', 'reliable', 'confidence'];

  const score = (terms: string[]) =>
    terms.reduce((acc, term) => acc + (text.toLowerCase().includes(term) ? 1 : 0), 0);

  const techScore = score(technicalTerms);
  const energeticScore = score(energeticTerms);
  const trustScore = score(trustTerms);

  if (techScore >= energeticScore && techScore >= trustScore) {
    return 'Tone signals: technical and product-led — lean into precision with confident detail.';
  }
  if (energeticScore >= techScore && energeticScore >= trustScore) {
    return 'Tone signals: energetic and momentum-focused — harness this enthusiasm in launches.';
  }
  if (trustScore >= techScore && trustScore >= energeticScore) {
    return 'Tone signals: trust and assurance — reinforce reliability with testimonials and proof.';
  }
  return 'Tone indicators pending — brief the AI on how you want to sound.';
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

