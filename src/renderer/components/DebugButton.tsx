import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBug, faExclamationTriangle } from '../utils/fontAwesomeIcons';
import WindowsTemplateDebugger from './WindowsTemplateDebugger';
import DebugService from '../services/debugService';
import './DebugButton.css';

interface DebugButtonProps {
  className?: string;
  showBadge?: boolean;
}

const DebugButton: React.FC<DebugButtonProps> = ({ className = '', showBadge = true }) => {
  const [showDebugger, setShowDebugger] = useState(false);
  const [debugSummary, setDebugSummary] = useState(() => {
    const debugService = DebugService.getInstance();
    return debugService.getDebugSummary();
  });

  const handleOpenDebugger = () => {
    setShowDebugger(true);
    // Refresh debug summary when opening
    const debugService = DebugService.getInstance();
    setDebugSummary(debugService.getDebugSummary());
  };

  const handleCloseDebugger = () => {
    setShowDebugger(false);
    // Refresh debug summary when closing
    const debugService = DebugService.getInstance();
    setDebugSummary(debugService.getDebugSummary());
  };

  const hasIssues = debugSummary.failedAttempts > 0 || debugSummary.totalErrors > 0;

  return (
    <>
      <button
        className={`debug-button ${className} ${hasIssues ? 'has-issues' : ''}`}
        onClick={handleOpenDebugger}
        title="Open Windows Template Debugger"
      >
        <FontAwesomeIcon icon={faBug} />
        {showBadge && hasIssues && (
          <span className="debug-badge">
            <FontAwesomeIcon icon={faExclamationTriangle} />
          </span>
        )}
      </button>

      {showDebugger && (
        <WindowsTemplateDebugger onClose={handleCloseDebugger} />
      )}
    </>
  );
};

export default DebugButton;
