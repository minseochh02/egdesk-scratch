import React, { useRef } from 'react';
import { AIKey } from '../../AIKeysManager/types';
import { CHAT_PROVIDERS } from '../../ChatInterface/types';
import { faClock, faRocket, faStop } from '@fortawesome/free-solid-svg-icons';

interface InputAreaProps {
  userInstruction: string;
  onInstructionChange: (instruction: string) => void;
  selectedModel: string;
  onModelChange: (providerId: string, modelId: string) => void;
  selectedKey: AIKey | null;
  onKeyChange: (key: AIKey | null) => void;
  availableKeys: AIKey[];
  isLoading: boolean;
  isStreaming: boolean;
  onSend: () => void;
  onStop: () => void;
  canSend: boolean;
  FontAwesomeIcon: any;
}

export const InputArea: React.FC<InputAreaProps> = ({
  userInstruction,
  onInstructionChange,
  selectedModel,
  onModelChange,
  selectedKey,
  onKeyChange,
  availableKeys,
  isLoading,
  isStreaming,
  onSend,
  onStop,
  canSend,
  FontAwesomeIcon
}) => {
  const instructionInputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="input-area">
      <div className="input-container">
        <textarea
          ref={instructionInputRef}
          value={userInstruction}
          onChange={(e) => onInstructionChange(e.target.value)}
          placeholder="Describe what you'd like me to do with your code..."
          rows={3}
          className="instruction-input"
          disabled={isLoading || isStreaming}
        />
        <div className="input-buttons">
          <div className="config-controls">
            <select
              className="dualscreen-model-select"
              value={selectedModel ? `${selectedKey?.providerId || 'openai'}::${selectedModel}` : ''}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) {
                  onModelChange('', '');
                  return;
                }
                const [providerId, modelId] = value.split('::');
                onModelChange(providerId, modelId);
              }}
            >
              <option value="">Model...</option>
              {CHAT_PROVIDERS.map(provider => (
                <optgroup key={provider.id} label={provider.name}>
                  {provider.models.map(model => (
                    <option key={`${provider.id}::${model.id}`} value={`${provider.id}::${model.id}`}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <select
              className="api-key-select"
              value={selectedKey?.id || ''}
              onChange={(e) => {
                const key = availableKeys.find(k => k.id === e.target.value);
                onKeyChange(key || null);
              }}
              disabled={availableKeys.length === 0}
            >
              <option value="">
                {availableKeys.length === 0 ? 'No keys available' : 'Select API key'}
              </option>
              {availableKeys.map(key => (
                <option key={key.id} value={key.id}>
                  {key.name} ({key.providerId})
                </option>
              ))}
            </select>
          </div>
          
          {isLoading || isStreaming ? (
            <button 
              className="stop-btn"
              onClick={onStop}
              title="Stop AI request"
            >
              <FontAwesomeIcon icon={faStop} />
            </button>
          ) : (
            <button 
              className="send-btn"
              onClick={onSend}
              disabled={!canSend}
              title="Send request"
            >
              <FontAwesomeIcon icon={faRocket} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
