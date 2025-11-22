/**
 * SNS Plan Generation Debug Modal
 * Shows detailed step-by-step debugging information for SNS plan generation
 */

import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCopy, faCheck, faExclamationTriangle, faSpinner } from '../../utils/fontAwesomeIcons';

export interface DebugStep {
  step: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  timestamp: Date;
  details?: any;
  error?: string;
}

interface SnsPlanDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: DebugStep[];
  currentStep?: string;
}

export const SnsPlanDebugModal: React.FC<SnsPlanDebugModalProps> = ({
  isOpen,
  onClose,
  steps,
  currentStep,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const getStatusIcon = (status: DebugStep['status']) => {
    switch (status) {
      case 'success':
        return <FontAwesomeIcon icon={faCheck} className="egbusiness-identity__debug-icon--success" />;
      case 'error':
        return <FontAwesomeIcon icon={faExclamationTriangle} className="egbusiness-identity__debug-icon--error" />;
      case 'running':
        return <FontAwesomeIcon icon={faSpinner} className="egbusiness-identity__debug-icon--running" spin />;
      default:
        return <span className="egbusiness-identity__debug-icon--pending">○</span>;
    }
  };

  const getStatusClass = (status: DebugStep['status']) => {
    return `egbusiness-identity__debug-step--${status}`;
  };

  return (
    <div className="egbusiness-identity__debug-overlay" onClick={onClose}>
      <div className="egbusiness-identity__debug-modal" onClick={(e) => e.stopPropagation()}>
        <div className="egbusiness-identity__debug-header">
          <h2>SNS Plan Generation Debug</h2>
          <button
            type="button"
            className="egbusiness-identity__debug-close"
            onClick={onClose}
            aria-label="Close debug modal"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="egbusiness-identity__debug-content">
          {steps.length === 0 ? (
            <div className="egbusiness-identity__debug-empty">
              <p>No debug information available yet.</p>
              <p className="egbusiness-identity__debug-hint">
                Start generating an SNS plan to see detailed step-by-step information.
              </p>
            </div>
          ) : (
            <div className="egbusiness-identity__debug-steps">
              {steps.map((step, index) => (
                <div
                  key={index}
                  className={`egbusiness-identity__debug-step ${getStatusClass(step.status)} ${
                    currentStep === step.step ? 'egbusiness-identity__debug-step--current' : ''
                  }`}
                >
                  <div className="egbusiness-identity__debug-step-header">
                    <div className="egbusiness-identity__debug-step-info">
                      {getStatusIcon(step.status)}
                      <div>
                        <h3>{step.step}</h3>
                        <span className="egbusiness-identity__debug-timestamp">
                          {formatTimestamp(step.timestamp)}
                        </span>
                      </div>
                    </div>
                    {step.details && (
                      <button
                        type="button"
                        className="egbusiness-identity__debug-copy"
                        onClick={() => copyToClipboard(JSON.stringify(step.details, null, 2), index)}
                        title="Copy details to clipboard"
                      >
                        <FontAwesomeIcon icon={copiedIndex === index ? faCheck : faCopy} />
                      </button>
                    )}
                  </div>

                  <div className="egbusiness-identity__debug-message">
                    {step.message}
                  </div>

                  {step.error && (
                    <div className="egbusiness-identity__debug-error">
                      <strong>Error:</strong> {step.error}
                    </div>
                  )}

                  {step.details && (
                    <details className="egbusiness-identity__debug-details">
                      <summary>View Details</summary>
                      <pre className="egbusiness-identity__debug-json">
                        {JSON.stringify(step.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="egbusiness-identity__debug-footer">
          <button
            type="button"
            className="egbusiness-identity__debug-close-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

