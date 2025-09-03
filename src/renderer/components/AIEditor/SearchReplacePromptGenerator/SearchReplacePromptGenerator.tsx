import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faRefresh, faCheck, faCopy, faClock, faRocket, faClipboard, faTimes, faLightbulb } from '@fortawesome/free-solid-svg-icons';
import { SearchReplacePromptService, SearchReplacePromptRequest, SearchReplacePrompt } from '../services/searchReplacePromptService';
import { AIKey } from '../../AIKeysManager/types';
import './SearchReplacePromptGenerator.css';

interface SearchReplacePromptGeneratorProps {
  aiKey: AIKey | null;
  model: string;
  onGeneratePrompts?: (prompts: SearchReplacePrompt[]) => void;
}

export const SearchReplacePromptGenerator: React.FC<SearchReplacePromptGeneratorProps> = ({
  aiKey,
  model,
  onGeneratePrompts
}) => {
  const [userRequest, setUserRequest] = useState('');
  const [targetFile, setTargetFile] = useState('');
  const [context, setContext] = useState('');
  const [exampleBefore, setExampleBefore] = useState('');
  const [exampleAfter, setExampleAfter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<SearchReplacePrompt[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGeneratePrompts = async () => {
    if (!aiKey || !model || !userRequest.trim()) {
      setError('Please provide AI key, model, and user request');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const service = SearchReplacePromptService.getInstance();
      const request: SearchReplacePromptRequest = {
        userRequest: userRequest.trim(),
        targetFile: targetFile.trim() || undefined,
        context: context.trim() || undefined,
        exampleBefore: exampleBefore.trim() || undefined,
        exampleAfter: exampleAfter.trim() || undefined
      };

      const response = await service.generateSearchReplacePrompts(aiKey, model, request);

      if (response.success && response.searchReplacePrompts.length > 0) {
        setGeneratedPrompts(response.searchReplacePrompts);
        onGeneratePrompts?.(response.searchReplacePrompts);
      } else {
        setError(response.error || 'Failed to generate search/replace prompts');
        setGeneratedPrompts([]);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      setGeneratedPrompts([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearForm = () => {
    setUserRequest('');
    setTargetFile('');
    setContext('');
    setExampleBefore('');
    setExampleAfter('');
    setGeneratedPrompts([]);
    setError(null);
  };

  const handleCopyPrompt = (prompt: SearchReplacePrompt) => {
    const service = SearchReplacePromptService.getInstance();
    const formattedPrompt = service.formatPromptForDisplay(prompt);
    
    navigator.clipboard.writeText(formattedPrompt).then(() => {
      // Could add a toast notification here
      console.log('Prompt copied to clipboard');
    });
  };

  const handleCopySearchReplace = (prompt: SearchReplacePrompt) => {
    const searchReplaceText = `Search: ${prompt.searchText}\nReplace: ${prompt.replaceText}`;
    
    navigator.clipboard.writeText(searchReplaceText).then(() => {
      console.log('Search/Replace text copied to clipboard');
    });
  };

  return (
    <div className="search-replace-prompt-generator">
      <div className="generator-header">
        <h3><FontAwesomeIcon icon={faSearch} /> Search & Replace Prompt Generator</h3>
        <p>Generate precise search and replace operations for code files</p>
      </div>

      <div className="generator-form">
        <div className="form-group">
          <label htmlFor="userRequest">User Request *</label>
          <textarea
            id="userRequest"
            value={userRequest}
            onChange={(e) => setUserRequest(e.target.value)}
            placeholder="Describe what you want to change (e.g., 'Add a new option to the select dropdown')"
            rows={3}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="targetFile">Target File (optional)</label>
          <input
            id="targetFile"
            type="text"
            value={targetFile}
            onChange={(e) => setTargetFile(e.target.value)}
            placeholder="e.g., index.php, style.css"
          />
        </div>

        <div className="form-group">
          <label htmlFor="context">Additional Context (optional)</label>
          <textarea
            id="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Any additional context about the file structure or requirements"
            rows={2}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="exampleBefore">Example Before (optional)</label>
            <textarea
              id="exampleBefore"
              value={exampleBefore}
              onChange={(e) => setExampleBefore(e.target.value)}
              placeholder="Example of existing code to help with context"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="exampleAfter">Example After (optional)</label>
            <textarea
              id="exampleAfter"
              value={exampleAfter}
              onChange={(e) => setExampleAfter(e.target.value)}
              placeholder="Example of what the result should look like"
              rows={3}
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            onClick={handleGeneratePrompts}
            disabled={!aiKey || !model || !userRequest.trim() || isGenerating}
            className="generate-btn"
          >
            {isGenerating ? <><FontAwesomeIcon icon={faClock} /> Generating...</> : <><FontAwesomeIcon icon={faRocket} /> Generate Prompts</>}
          </button>
          
          <button
            onClick={handleClearForm}
            className="clear-btn"
            disabled={isGenerating}
          >
            🧹 Clear Form
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p><FontAwesomeIcon icon={faTimes} /> {error}</p>
        </div>
      )}

      {generatedPrompts.length > 0 && (
        <div className="generated-prompts">
          <h4><FontAwesomeIcon icon={faCheck} /> Generated Search & Replace Prompts</h4>
          
          {generatedPrompts.map((prompt, index) => (
            <div key={prompt.id} className="prompt-card">
              <div className="prompt-header">
                <span className="prompt-number">#{index + 1}</span>
                <span className="prompt-description">{prompt.description}</span>
                <span className="prompt-confidence">{Math.round(prompt.confidence * 100)}%</span>
              </div>

              <div className="prompt-content">
                <div className="search-section">
                  <h5><FontAwesomeIcon icon={faSearch} /> Search for:</h5>
                  <pre className="search-text">{prompt.searchText}</pre>
                </div>

                <div className="replace-section">
                  <h5><FontAwesomeIcon icon={faRefresh} /> Replace with:</h5>
                  <pre className="replace-text">{prompt.replaceText}</pre>
                </div>

                {prompt.filePath && (
                  <div className="file-info">
                    <strong>File:</strong> {prompt.filePath}
                  </div>
                )}

                {prompt.notes && (
                  <div className="notes">
                    <strong>Notes:</strong> {prompt.notes}
                  </div>
                )}
              </div>

              <div className="prompt-actions">
                <button
                  onClick={() => handleCopyPrompt(prompt)}
                  className="copy-prompt-btn"
                  title="Copy formatted prompt"
                >
                  <FontAwesomeIcon icon={faClipboard} /> Copy Prompt
                </button>
                
                <button
                  onClick={() => handleCopySearchReplace(prompt)}
                  className="copy-search-replace-btn"
                  title="Copy search/replace text only"
                >
                  <FontAwesomeIcon icon={faCopy} /> Copy Search/Replace
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="usage-tips">
        <h4><FontAwesomeIcon icon={faLightbulb} /> Usage Tips</h4>
        <ul>
          <li><strong>Exact Matching:</strong> The search text must be an EXACT match of existing code</li>
          <li><strong>Unique Context:</strong> Include enough surrounding context to make the search unique</li>
          <li><strong>Proper Escaping:</strong> Use \n for line breaks, \t for tabs, etc.</li>
          <li><strong>File Path:</strong> Specify the target file for better context</li>
          <li><strong>Examples:</strong> Provide before/after examples for complex changes</li>
        </ul>
      </div>
    </div>
  );
};
