/**
 * BuildPlanDisplay Component
 * Displays comprehensive build plan with strategy, steps, and data flow
 */

import React from 'react';

/**
 * Check if a build step can be automated
 */
function isStepAutomatable(step: BuildStep): boolean {
  if (step.actionType) {
    // Use actionType if available (new format)
    const automatableTypes = [
      'NAVIGATE_WEBSITE',
      'DOWNLOAD_EXCEL',
      'LOAD_EXCEL_FILE',
      'EXTRACT_COLUMNS',
      'JOIN_DATA',
      'CALCULATE',
      'AGGREGATE',
      'CREATE_REPORT',
      'FORMAT_CELLS',
    ];
    return automatableTypes.includes(step.actionType);
  }

  // Fallback to old detection method
  const source = step.source?.toLowerCase() || '';
  const details = step.details?.toLowerCase() || '';

  const isWebsiteStep =
    source.includes('ecount') ||
    source.includes('erp') ||
    source.includes('website') ||
    details?.includes('navigate') ||
    details?.includes('export') ||
    details?.includes('download');

  const isHumanTask =
    details?.includes('consult') ||
    details?.includes('interview') ||
    details?.includes('stakeholder') ||
    details?.includes('review') ||
    details?.includes('sign-off') ||
    step.action.includes('Clarify') ||
    step.action.includes('Stakeholder');

  return isWebsiteStep && !isHumanTask;
}

interface BuildStep {
  step: number;
  phase: string;
  actionType?: string;
  action: string;
  source: string;
  details?: string;
  parameters?: {
    websiteSection?: string;
    columns?: string[];
    filters?: Array<{ field: string; value: string }>;
    joinOn?: string;
    formula?: string;
  };
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
  console.log('[BuildPlanDisplay] Rendering with plan:', {
    success: plan.success,
    stepsCount: plan.steps?.length || 0,
    hasStrategy: !!plan.strategy,
    hasDataFlow: !!plan.dataFlow,
    isExecuting,
  });

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
                {step.actionType && (
                  <div className="rookie-build-step-row">
                    <strong>🔧 Action Type:</strong>{' '}
                    <code className="rookie-action-type-badge">{step.actionType}</code>
                  </div>
                )}
                <div className="rookie-build-step-row">
                  <strong>📦 Source:</strong> {step.source}
                </div>
                {step.parameters && Object.keys(step.parameters).length > 0 && (
                  <div className="rookie-build-step-row">
                    <strong>⚙️ Parameters:</strong>
                    <div className="rookie-parameters-box">
                      {step.parameters.websiteSection && (
                        <div>• Website Section: <code>{step.parameters.websiteSection}</code></div>
                      )}
                      {step.parameters.columns && step.parameters.columns.length > 0 && (
                        <div>• Columns: <code>{step.parameters.columns.join(', ')}</code></div>
                      )}
                      {step.parameters.filters && step.parameters.filters.length > 0 && (
                        <div>
                          • Filters:{' '}
                          {step.parameters.filters.map((f, i) => (
                            <code key={i}>
                              {f.field} = {f.value}
                              {i < step.parameters.filters!.length - 1 ? ', ' : ''}
                            </code>
                          ))}
                        </div>
                      )}
                      {step.parameters.joinOn && (
                        <div>• Join On: <code>{step.parameters.joinOn}</code></div>
                      )}
                      {step.parameters.formula && (
                        <div>• Formula: <code>{step.parameters.formula}</code></div>
                      )}
                    </div>
                  </div>
                )}
                {step.details && (
                  <div className="rookie-build-step-row">
                    <strong>📝 Details:</strong> {step.details}
                  </div>
                )}
                <div className="rookie-build-step-row">
                  <strong>📤 Output:</strong> {step.output}
                </div>
                {isStepAutomatable(step) ? (
                  <div className="rookie-step-automation-badge">
                    🤖 Automatable
                  </div>
                ) : (
                  <div className="rookie-step-manual-badge">
                    👤 Manual Step
                  </div>
                )}
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
