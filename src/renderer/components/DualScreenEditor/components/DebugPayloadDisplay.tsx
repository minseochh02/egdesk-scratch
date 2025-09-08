import React from 'react';
import {
  faBug,
  faCheck,
  faTimes,
  faRocket,
} from '@fortawesome/free-solid-svg-icons';

interface DebugPayloadDisplayProps {
  debugPayload: any;
  onClose: () => void;
  onSendAnyway: () => void;
  FontAwesomeIcon: any;
}

export const DebugPayloadDisplay: React.FC<DebugPayloadDisplayProps> = ({
  debugPayload,
  onClose,
  onSendAnyway,
  FontAwesomeIcon,
}) => {
  if (!debugPayload) return null;

  return (
    <div className="message debug-message">
      <div className="message-content">
        <div className="response-header">
          <span className="response-title">🐛 Debug Payload</span>
          <div className="response-actions">
            <button onClick={onClose} className="close-btn">
              ✕
            </button>
          </div>
        </div>

        <div className="debug-payload-content">
          <h4>
            Enhanced Context:{' '}
            {debugPayload.enhancedContext ? <>✅ Yes</> : <>❌ No</>}
          </h4>

          <details open>
            <summary>
              <strong>Original User Instruction:</strong>
            </summary>
            <pre>{debugPayload.originalUserInstruction}</pre>
          </details>

          <details open>
            <summary>
              <strong>Enhanced User Instruction (sent to AI):</strong>
            </summary>
            <pre>{debugPayload.enhancedUserInstruction}</pre>
          </details>

          <details>
            <summary>
              <strong>Full Request Object:</strong>
            </summary>
            <pre>{JSON.stringify(debugPayload.request, null, 2)}</pre>
          </details>

          <details>
            <summary>
              <strong>Config:</strong>
            </summary>
            <pre>{JSON.stringify(debugPayload.config, null, 2)}</pre>
          </details>
        </div>

        <div className="debug-actions">
          <button
            onClick={() => {
              onClose();
              onSendAnyway();
            }}
            className="send-anyway-btn"
          >
            🚀 Send to AI Anyway
          </button>
        </div>
      </div>
    </div>
  );
};
