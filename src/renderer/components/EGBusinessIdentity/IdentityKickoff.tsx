/**
 * Identity Kickoff Component
 * Main component for generating business identity from URL
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faMagic, faArrowLeft } from '../../utils/fontAwesomeIcons';
import { IdentitySummary } from './IdentitySummary';
import type { IdentitySnapshot, SnsPlanEntry } from './types';

interface IdentityKickoffProps {
  url: string;
  onUrlChange: (url: string) => void;
  onGenerate: () => void;
  loading: boolean;
  error: string | null;
  planError: string | null;
  isConfigured: boolean;
  identitySnapshot: IdentitySnapshot | null;
  parsedIdentity: any;
  snsPlan: SnsPlanEntry[] | null;
  onGenerateNew: () => void;
  isEditMode?: boolean;
  onGoBack?: () => void;
}

export const IdentityKickoff: React.FC<IdentityKickoffProps> = ({
  url,
  onUrlChange,
  onGenerate,
  loading,
  error,
  planError,
  isConfigured,
  identitySnapshot,
  parsedIdentity,
  snsPlan,
  onGenerateNew,
  isEditMode = false,
  onGoBack,
}) => {
  return (
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
          <IdentitySummary
            identitySnapshot={identitySnapshot}
            parsedIdentity={parsedIdentity}
            snsPlan={snsPlan}
            onGenerateNew={onGenerateNew}
          />
        ) : (
          <div className="egbusiness-identity__input-block">
            {isEditMode && onGoBack && (
              <div className="egbusiness-identity__edit-mode-header">
                <button
                  type="button"
                  className="egbusiness-identity__go-back-button"
                  onClick={onGoBack}
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                  Go Back
                </button>
              </div>
            )}
            <label htmlFor="brand-url">Website URL</label>
            <div className="egbusiness-identity__control">
              <input
                id="brand-url"
                type="url"
                placeholder="https://your-company.com"
                inputMode="url"
                autoComplete="off"
                value={url}
                onChange={(event) => onUrlChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !loading) {
                    onGenerate();
                  }
                }}
              />
              <button type="button" onClick={onGenerate} disabled={loading || !isConfigured}>
                <FontAwesomeIcon icon={faMagic} />
                {loading ? 'Analyzing…' : 'Generate'}
              </button>
            </div>
            <p className="egbusiness-identity__hint">
              Tip: choose the page that best explains your mission (landing page, manifesto, or investor letter).
            </p>
            {!isConfigured && (
              <p className="egbusiness-identity__error">
                ⚠️ Please select a Google AI key to generate business identity.
              </p>
            )}
            {error && <p className="egbusiness-identity__error">{error}</p>}
            {planError && <p className="egbusiness-identity__error">{planError}</p>}
            {loading && !error && (
              <p className="egbusiness-identity__status">
                Loading website. Please wait...
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
  );
};

