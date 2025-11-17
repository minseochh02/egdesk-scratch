/**
 * Identity Summary Component
 * Displays the current business identity snapshot
 */

import React from 'react';
import type { IdentitySnapshot, SnsPlanEntry } from './types';

interface IdentitySummaryProps {
  identitySnapshot: IdentitySnapshot;
  parsedIdentity: any;
  snsPlan: SnsPlanEntry[] | null;
  onGenerateNew: () => void;
}

export const IdentitySummary: React.FC<IdentitySummaryProps> = ({
  identitySnapshot,
  parsedIdentity,
  snsPlan,
  onGenerateNew,
}) => {
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
        <button type="button" onClick={onGenerateNew}>
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

