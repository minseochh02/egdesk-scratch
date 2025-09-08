import React, { useRef, useState } from 'react';
import { faClock, faRocket, faStop } from '@fortawesome/free-solid-svg-icons';
import { AIKey } from '../../AIKeysManager/types';
import { CHAT_PROVIDERS } from '../../ChatInterface/types';
import { DragDropWrapper } from './DragDropWrapper';
import { FilePickerButton } from './FilePickerButton';

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
  onFilesSelected?: (files: File[]) => void;
  selectedFiles?: File[];
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
  FontAwesomeIcon,
  onFilesSelected,
  selectedFiles = [],
}) => {
  const instructionInputRef = useRef<HTMLTextAreaElement>(null);
  const [localSelectedFiles, setLocalSelectedFiles] = useState<File[]>(selectedFiles);

  const handleFilesSelected = (files: File[]) => {
    setLocalSelectedFiles(prev => [...prev, ...files]);
    onFilesSelected?.(files);
  };

  const handleFileRemove = (index: number) => {
    setLocalSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="input-area">
      <DragDropWrapper
        onFilesSelected={handleFilesSelected}
        onFileRemove={handleFileRemove}
        selectedFiles={localSelectedFiles}
        disabled={isLoading || isStreaming}
        FontAwesomeIcon={FontAwesomeIcon}
        maxFiles={5}
        showFileList={true}
      >
        <div className="input-container">
          <div className="input-row">
            <textarea
              ref={instructionInputRef}
              value={userInstruction}
              onChange={(e) => onInstructionChange(e.target.value)}
              placeholder="Describe what you'd like me to do with your code... (or drag & drop files here)"
              rows={3}
              className="instruction-input"
              disabled={isLoading || isStreaming}
            />
            
            <FilePickerButton
              onFilesSelected={handleFilesSelected}
              disabled={isLoading || isStreaming}
              FontAwesomeIcon={FontAwesomeIcon}
              maxFiles={5}
              selectedFilesCount={localSelectedFiles.length}
            />
          </div>
          
          <div className="input-buttons">
          <div className="config-controls">
            <select
              className="dualscreen-model-select"
              value={
                selectedModel
                  ? `${selectedKey?.providerId || 'openai'}::${selectedModel}`
                  : ''
              }
              onChange={(e) => {
                const { value } = e.target;
                if (!value) {
                  onModelChange('', '');
                  return;
                }
                const [providerId, modelId] = value.split('::');
                onModelChange(providerId, modelId);
              }}
            >
              <option value="">Model...</option>
              {CHAT_PROVIDERS.map((provider) => (
                <optgroup key={provider.id} label={provider.name}>
                  {provider.models.map((model) => (
                    <option
                      key={`${provider.id}::${model.id}`}
                      value={`${provider.id}::${model.id}`}
                    >
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
                const key = availableKeys.find((k) => k.id === e.target.value);
                onKeyChange(key || null);
              }}
              disabled={availableKeys.length === 0}
            >
              <option value="">
                {availableKeys.length === 0
                  ? 'No keys available'
                  : 'Select API key'}
              </option>
              {availableKeys.map((key) => (
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
      </DragDropWrapper>
    </div>
  );
};
