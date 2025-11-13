import React, { useCallback, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faGlobe, faMagic } from '../../utils/fontAwesomeIcons';
import { useNavigate } from 'react-router-dom';
import { chatWithGemma } from '../../lib/gemmaClient';
import './EGBusinessIdentity.css';

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

const EGBusinessIdentity: React.FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [openingTwitter, setOpeningTwitter] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('먼저 웹사이트 URL을 입력해주세요.');
      return;
    }

    try {
      // Validate URL format early to give fast feedback
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
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

      // Navigate to preview with the data
      navigate('/egbusiness-identity/preview', {
        state: {
          source: fetchResult.content,
          identityData,
          rawAiResponse: aiResult.content,
          mode: 'ai',
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
  }, [navigate, url]);

  const handleOpenTwitter = useCallback(async () => {
    const profilePath = '/Users/minseocha/Library/Application Support/Google/Chrome/Default';
    try {
      setError(null);
      setOpeningTwitter(true);

      if (!window.electron?.debug?.openTwitterWithProfile) {
        setError('Twitter 자동화를 사용할 수 없습니다. 앱을 다시 빌드해주세요.');
        return;
      }

      const result = await window.electron.debug.openTwitterWithProfile(profilePath);
      if (!result?.success) {
        setError(result?.error || 'Twitter를 여는 데 실패했습니다.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message || 'Twitter를 여는 중 문제가 발생했습니다.'
          : 'Twitter를 여는 중 문제가 발생했습니다.',
      );
    } finally {
      setOpeningTwitter(false);
    }
  }, []);

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
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
            >
              <FontAwesomeIcon icon={faMagic} />
              {loading ? 'Analyzing…' : 'Generate'}
            </button>
          </div>
          <p className="egbusiness-identity__hint">
            Tip: choose the page that best explains your mission (landing page, manifesto, or investor letter).
          </p>
          {error && <p className="egbusiness-identity__error">{error}</p>}
          {loading && !error && (
            <p className="egbusiness-identity__status">
              웹사이트를 불러오고 있습니다. 잠시만 기다려주세요…
            </p>
          )}
        </div>
        <div className="egbusiness-identity__control">
          <button
            type="button"
            onClick={handleOpenTwitter}
            disabled={openingTwitter}
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} />
            {openingTwitter ? 'Opening Twitter…' : 'Open Twitter (Chrome profile)'}
          </button>
        </div>
      </section>

      <section className="egbusiness-identity__panel egbusiness-identity__panel--secondary">
        <h3>What happens next?</h3>
        <ol>
          <li>We capture keywords, tone, and structure from the page.</li>
          <li>The AI drafts your positioning, voice principles, and content pillars.</li>
          <li>You review, tweak, and launch automated social goals from one place.</li>
        </ol>
      </section>
    </div>
  );
};

export default EGBusinessIdentity;

