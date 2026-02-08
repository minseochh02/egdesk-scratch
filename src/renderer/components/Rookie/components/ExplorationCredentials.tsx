/**
 * ExplorationCredentials Component
 * Credential input form when EXPLORER discovers login fields
 */

import React, { useState } from 'react';

interface LoginField {
  name: string;
  type: string;
  elementId: string;
}

interface LoginFinding {
  site: string;
  needsLogin: boolean;
  loginFields?: {
    fields: LoginField[];
    submitButton: string;
  };
}

interface ExplorationCredentialsProps {
  findings: LoginFinding[];
  isExploring: boolean;
  onContinueExploration: (siteIndex: number, credentials: Record<string, string>) => Promise<void>;
}

export const ExplorationCredentials: React.FC<ExplorationCredentialsProps> = ({
  findings,
  isExploring,
  onContinueExploration,
}) => {
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const sitesNeedingLogin = findings.filter(f => f.needsLogin && f.loginFields);

  if (sitesNeedingLogin.length === 0) {
    return null;
  }

  return (
    <div className="rookie-login-request-section">
      <h4 className="rookie-researcher-title">🔐 Login Credentials Needed</h4>
      <p className="rookie-login-request-note">
        🔍 EXPLORER discovered the login fields for this website.
        <br />
        🔒 Your passwords are encrypted and saved securely. You won't need to enter them again.
      </p>
      {sitesNeedingLogin.map((finding, idx) => (
        <div key={idx} className="rookie-login-request-card">
          <div className="rookie-login-site">{finding.site}</div>
          <div className="rookie-login-fields-discovered">
            <strong>Fields discovered:</strong>
            {finding.loginFields!.fields.map((field, fidx) => (
              <div key={fidx} className="rookie-credential-input-field">
                <label htmlFor={`cred-${idx}-${field.name}`}>{field.name}:</label>
                <input
                  id={`cred-${idx}-${field.name}`}
                  type={field.type === 'password' ? 'password' : 'text'}
                  placeholder={`Enter ${field.name}`}
                  value={credentials[field.name] || ''}
                  onChange={(e) => {
                    setCredentials((prev) => ({
                      ...prev,
                      [field.name]: e.target.value,
                    }));
                  }}
                  className="rookie-credential-input"
                  disabled={isExploring}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="rookie-continue-research-button"
            onClick={() => {
              onContinueExploration(idx, credentials);
            }}
            disabled={
              isExploring ||
              finding.loginFields!.fields.some((f) => !credentials[f.name])
            }
          >
            {isExploring ? '🔍 Exploring...' : '🚀 Continue Exploration'}
          </button>
        </div>
      ))}
    </div>
  );
};
