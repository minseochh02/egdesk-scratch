/**
 * BuildPlanDisplay Component
 * Displays comprehensive build plan with strategy, steps, and data flow
 */

import React from 'react';

interface BuildStep {
  step: number;
  phase: string;
  action: string;
  source: string;
  details: string;
  output: string;
}

interface BuildPlan {
  success: boolean;
  strategy?: {
    overview: string;
    phases: string[];
  };
  steps?: BuildStep[];
  dataFlow?: {
    sourceFiles: Array<{
      file: string;
      columns: string[];
      usage: string;
    }>;
    websiteData: Array<{
      site: string;
      section: string;
      fields: string[];
      usage: string;
    }>;
  };
  summary?: string;
  estimatedComplexity?: string;
  savedTo?: string;
}

interface BuildPlanDisplayProps {
  plan: BuildPlan;
  onExecute: () => void;
  isExecuting: boolean;
}

export const BuildPlanDisplay: React.FC<BuildPlanDisplayProps> = ({
  plan,
  onExecute,
  isExecuting,
}) => {
  if (!plan.success) {
    return (
      <div className="rookie-build-plan-error">
        ❌ Failed to generate build plan: {plan.success === false ? 'Unknown error' : ''}
      </div>
    );
  }

  return (
    <div className="rookie-build-plan-container">
      {plan.savedTo && (
        <div className="rookie-results-saved-note">
          💾 Plan saved to: <code>{plan.savedTo}</code>
        </div>
      )}

      {/* Build Strategy Overview */}
      {plan.strategy && (
        <div className="rookie-build-strategy">
          <h4 className="rookie-build-section-title">📋 Build Strategy</h4>
          <div className="rookie-strategy-overview">{plan.strategy.overview}</div>
          {plan.strategy.phases && plan.strategy.phases.length > 0 && (
            <div className="rookie-strategy-phases">
              <strong>Phases:</strong>
              <ol>
                {plan.strategy.phases.map((phase, idx) => (
                  <li key={idx}>{phase}</li>
                ))}
              </ol>
            </div>
          )}
          {plan.estimatedComplexity && (
            <div className="rookie-complexity-badge">
              Complexity: <strong>{plan.estimatedComplexity}</strong>
            </div>
          )}
        </div>
      )}

      {/* Build Steps */}
      {plan.steps && plan.steps.length > 0 && (
        <div className="rookie-build-steps">
          <h4 className="rookie-build-section-title">🔨 Build Steps ({plan.steps.length})</h4>
          {plan.steps.map((step) => (
            <div key={step.step} className="rookie-build-step-card">
              <div className="rookie-build-step-header">
                <div className="rookie-step-number-circle">{step.step}</div>
                <div className="rookie-build-step-info">
                  <div className="rookie-build-step-phase">{step.phase}</div>
                  <div className="rookie-build-step-action">{step.action}</div>
                </div>
              </div>
              <div className="rookie-build-step-body">
                <div className="rookie-build-step-row">
                  <strong>📦 Source:</strong> {step.source}
                </div>
                <div className="rookie-build-step-row">
                  <strong>📝 Details:</strong> {step.details}
                </div>
                <div className="rookie-build-step-row">
                  <strong>📤 Output:</strong> {step.output}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Data Flow Summary */}
      {plan.dataFlow && (
        <div className="rookie-data-flow">
          <h4 className="rookie-build-section-title">🔄 Data Flow</h4>

          {plan.dataFlow.sourceFiles && plan.dataFlow.sourceFiles.length > 0 && (
            <div className="rookie-data-flow-section">
              <strong>📁 Source Files:</strong>
              {plan.dataFlow.sourceFiles.map((file, idx) => (
                <div key={idx} className="rookie-data-flow-item">
                  <div className="rookie-data-flow-name">{file.file}</div>
                  <div className="rookie-data-flow-columns">Columns: {file.columns.join(', ')}</div>
                  <div className="rookie-data-flow-usage">→ {file.usage}</div>
                </div>
              ))}
            </div>
          )}

          {plan.dataFlow.websiteData && plan.dataFlow.websiteData.length > 0 && (
            <div className="rookie-data-flow-section">
              <strong>🌐 Website Data:</strong>
              {plan.dataFlow.websiteData.map((web, idx) => (
                <div key={idx} className="rookie-data-flow-item">
                  <div className="rookie-data-flow-name">
                    {web.site} → {web.section}
                  </div>
                  <div className="rookie-data-flow-columns">Fields: {web.fields.join(', ')}</div>
                  <div className="rookie-data-flow-usage">→ {web.usage}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {plan.summary && (
        <div className="rookie-build-summary">
          <h4 className="rookie-build-section-title">📊 Summary</h4>
          <p>{plan.summary}</p>
        </div>
      )}

      {/* Execute Build Plan Button */}
      {!isExecuting && plan.steps && (
        <button type="button" className="rookie-execute-plan-button" onClick={onExecute}>
          🚀 Execute Build Plan
        </button>
      )}

      {isExecuting && (
        <div className="rookie-ai-loading">
          <div className="rookie-spinner"></div>
          <p>Executing build plan...</p>
        </div>
      )}
    </div>
  );
};
