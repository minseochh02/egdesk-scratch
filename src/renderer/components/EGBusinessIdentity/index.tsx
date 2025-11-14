import React, { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faGlobe, faMagic, faSync } from '../../utils/fontAwesomeIcons';
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
  const [profileRoot, setProfileRoot] = useState('');
  const [profiles, setProfiles] = useState<
    Array<{ name: string; directoryName: string; path: string }>
  >([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [selectedProfileDir, setSelectedProfileDir] = useState('');
  const [selectedProfilePath, setSelectedProfilePath] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('https://www.instagram.com/');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [instagramPassword, setInstagramPassword] = useState('');
  const [openingInstagram, setOpeningInstagram] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    if (!window.electron?.debug?.listChromeProfiles) {
      setProfilesError('Chrome 프로필 목록을 불러올 수 없습니다. 앱을 다시 빌드해주세요.');
      setProfiles([]);
      return;
    }

    setProfilesLoading(true);
    setProfilesError(null);

    try {
      const result = await window.electron.debug.listChromeProfiles();

      if (!result?.success) {
        setProfiles([]);
        setProfileRoot(result?.root || '');
        setProfilesError(result?.error || 'Chrome 프로필 목록을 불러오지 못했습니다.');
        return;
      }

      const profileList = Array.isArray(result.profiles) ? result.profiles : [];
      setProfileRoot(result.root || '');
      setProfiles(profileList);
      setSelectedProfileDir((prev) => {
        if (prev && profileList.some((profile) => profile.directoryName === prev)) {
          return prev;
        }
        return profileList[0]?.directoryName || '';
      });
    } catch (err) {
      setProfiles([]);
      setProfileRoot('');
      setProfilesError(
        err instanceof Error
          ? err.message || 'Chrome 프로필 목록을 불러오지 못했습니다.'
          : 'Chrome 프로필 목록을 불러오지 못했습니다.',
      );
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    if (!profiles || profiles.length === 0) {
      if (selectedProfileDir !== '') {
        setSelectedProfileDir('');
      }
      setSelectedProfilePath('');
      return;
    }

    if (!profiles.some((profile) => profile.directoryName === selectedProfileDir)) {
      const first = profiles[0];
      setSelectedProfileDir(first?.directoryName || '');
      setSelectedProfilePath(first?.path || '');
      return;
    }

    const matched = profiles.find((profile) => profile.directoryName === selectedProfileDir);
    setSelectedProfilePath(matched?.path || '');
  }, [profiles, selectedProfileDir]);

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

  const handleOpenInstagram = useCallback(async () => {
    const trimmedProfilePath = selectedProfilePath.trim();
    if (!trimmedProfilePath || !selectedProfileDir) {
      setError('Chrome 프로필을 먼저 선택해주세요.');
      return;
    }

    const cleanedUrl = (() => {
      const value = (instagramUrl || '').trim();
      if (!value) {
        return 'https://www.instagram.com/';
      }
      if (/^https?:\/\//i.test(value)) {
        return value;
      }
      return `https://${value}`;
    })();

    try {
      setError(null);
      setOpeningInstagram(true);

      if (!window.electron?.debug?.openInstagramWithProfile) {
        setError('Instagram 자동화를 사용할 수 없습니다. 앱을 다시 빌드해주세요.');
        return;
      }

      const result = await window.electron.debug.openInstagramWithProfile({
        profilePath: selectedProfilePath,
        profileDirectory: selectedProfileDir,
        profileRoot: profileRoot || undefined,
        targetUrl: cleanedUrl,
        username: instagramUsername.trim() || undefined,
        password: instagramPassword || undefined,
      });
      if (!result?.success) {
        setError(result?.error || 'Instagram을 여는 데 실패했습니다.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message || 'Instagram을 여는 중 문제가 발생했습니다.'
          : 'Instagram을 여는 중 문제가 발생했습니다.',
      );
    } finally {
      setOpeningInstagram(false);
    }
  }, [instagramPassword, instagramUrl, instagramUsername, profileRoot, selectedProfileDir, selectedProfilePath]);

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
        <div className="egbusiness-identity__profile-section">
          <div className="egbusiness-identity__profile-header">
            <div>
              <h3>Choose a Chrome profile</h3>
              {profileRoot && (
                <p className="egbusiness-identity__hint egbusiness-identity__profile-root">
                  Searching in {profileRoot}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={fetchProfiles}
              disabled={profilesLoading || openingInstagram}
            >
              <FontAwesomeIcon icon={faSync} />
              {profilesLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {profilesError && (
            <p className="egbusiness-identity__error">{profilesError}</p>
          )}

          {profilesLoading && !profilesError && (
            <p className="egbusiness-identity__status">
              Chrome 프로필을 불러오고 있습니다…
            </p>
          )}

          {!profilesLoading && !profilesError && profiles.length === 0 && (
            <p className="egbusiness-identity__hint">
              Chrome 프로필을 찾을 수 없습니다. Chrome이 설치되어 있고 최소 한 번 이상 실행되었는지 확인해주세요.
            </p>
          )}

          {!profilesLoading && !profilesError && profiles.length > 0 && (
            <div className="egbusiness-identity__profile-grid">
              {profiles.map((profile) => {
                const isSelected = selectedProfileDir === profile.directoryName;
                return (
                  <button
                    type="button"
                    key={profile.path}
                    className={`egbusiness-identity__profile-card${
                      isSelected ? ' is-selected' : ''
                    }`}
                    onClick={() => {
                      setSelectedProfileDir(profile.directoryName);
                      setSelectedProfilePath(profile.path);
                    }}
                    disabled={openingInstagram}
                  >
                    <span className="egbusiness-identity__profile-name">
                      {profile.name}
                    </span>
                    <span className="egbusiness-identity__profile-path">
                      {profile.path}
                    </span>
                    {isSelected && (
                      <span className="egbusiness-identity__profile-badge">
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectedProfilePath && (
            <p className="egbusiness-identity__status egbusiness-identity__selected-profile">
              Selected profile path: {selectedProfilePath}
            </p>
          )}
        </div>

        <div className="egbusiness-identity__input-block">
          <label htmlFor="instagram-target-url">Instagram URL</label>
          <div className="egbusiness-identity__control">
            <input
              id="instagram-target-url"
              type="url"
              placeholder="https://www.instagram.com/"
              value={instagramUrl}
              onChange={(event) => setInstagramUrl(event.target.value)}
            />
          </div>
          <p className="egbusiness-identity__hint">
            Leave as default unless you need a specific Instagram route (e.g. https://www.instagram.com/explore/).
          </p>
        </div>

        <div className="egbusiness-identity__input-block">
          <label htmlFor="instagram-username">Instagram Username</label>
          <div className="egbusiness-identity__control">
            <input
              id="instagram-username"
              type="text"
              placeholder="@handle or email"
              value={instagramUsername}
              onChange={(event) => setInstagramUsername(event.target.value)}
              autoComplete="username"
            />
          </div>
        </div>

        <div className="egbusiness-identity__input-block">
          <label htmlFor="instagram-password">Instagram Password</label>
          <div className="egbusiness-identity__control">
            <input
              id="instagram-password"
              type="password"
              placeholder="Enter Instagram password"
              value={instagramPassword}
              onChange={(event) => setInstagramPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
          <p className="egbusiness-identity__hint">
            Credentials stay on this device and are sent directly to the automation handler when you launch Instagram.
          </p>
        </div>

        <div className="egbusiness-identity__control egbusiness-identity__control--standalone">
          <button
            type="button"
            onClick={handleOpenInstagram}
            disabled={openingInstagram || !selectedProfileDir.trim()}
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} />
            {openingInstagram ? 'Opening Instagram…' : 'Open Instagram (Chrome profile)'}
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

