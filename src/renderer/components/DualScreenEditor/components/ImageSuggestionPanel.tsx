import React from 'react';
import { ImagePlacementSuggestion } from '../../../services/imageAIService';

interface ImageSuggestionPanelProps {
  suggestions: ImagePlacementSuggestion[];
  isAnalyzing: boolean;
  error: string | null;
  onSelectSuggestion: (suggestion: ImagePlacementSuggestion) => void;
  onDismiss: () => void;
  FontAwesomeIcon: any;
}

export const ImageSuggestionPanel: React.FC<ImageSuggestionPanelProps> = ({
  suggestions,
  isAnalyzing,
  error,
  onSelectSuggestion,
  onDismiss,
  FontAwesomeIcon,
}) => {
  if (isAnalyzing) {
    return (
      <div className="image-suggestion-panel">
        <div className="image-suggestion-header">
          <h3>Analyzing Image...</h3>
          <button 
            className="image-suggestion-close"
            onClick={onDismiss}
            title="Cancel analysis"
          >
            <FontAwesomeIcon icon="times" />
          </button>
        </div>
        <div className="image-suggestion-loading">
          <div className="loading-spinner"></div>
          <p>AI is analyzing your image and project structure...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="image-suggestion-panel error">
        <div className="image-suggestion-header">
          <h3>Analysis Error</h3>
          <button 
            className="image-suggestion-close"
            onClick={onDismiss}
            title="Close"
          >
            <FontAwesomeIcon icon="times" />
          </button>
        </div>
        <div className="image-suggestion-error">
          <FontAwesomeIcon icon="exclamation-triangle" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="image-suggestion-panel">
      <div className="image-suggestion-header">
        <h3>Image Placement Suggestions</h3>
        <button 
          className="image-suggestion-close"
          onClick={onDismiss}
          title="Close suggestions"
        >
          <FontAwesomeIcon icon="times" />
        </button>
      </div>
      
      <div className="image-suggestions-list">
        {suggestions.map((suggestion, index) => (
          <div key={index} className="image-suggestion-item">
            <div className="suggestion-main">
              <div className="suggestion-path">
                <FontAwesomeIcon icon="folder" />
                <span className="path">{suggestion.suggestedPath}</span>
              </div>
              <div className="suggestion-name">
                <FontAwesomeIcon icon="file-image" />
                <span className="name">{suggestion.suggestedName}</span>
              </div>
              <div className="suggestion-reasoning">
                <FontAwesomeIcon icon="lightbulb" />
                <span className="reasoning">{suggestion.reasoning}</span>
              </div>
              <div className="suggestion-confidence">
                <div className="confidence-bar">
                  <div 
                    className="confidence-fill"
                    style={{ width: `${suggestion.confidence * 100}%` }}
                  ></div>
                </div>
                <span className="confidence-text">
                  {Math.round(suggestion.confidence * 100)}% confidence
                </span>
              </div>
            </div>
            
            <div className="suggestion-actions">
              <button
                className="suggestion-select-btn"
                onClick={() => onSelectSuggestion(suggestion)}
                title="Use this suggestion"
              >
                <FontAwesomeIcon icon="check" />
                Use This
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {suggestions.some(s => s.alternatives && s.alternatives.length > 0) && (
        <div className="image-alternatives">
          <h4>Alternative Suggestions</h4>
          {suggestions.map((suggestion, suggestionIndex) => 
            suggestion.alternatives && suggestion.alternatives.length > 0 && (
              <div key={suggestionIndex} className="alternatives-list">
                {suggestion.alternatives.map((alternative, altIndex) => (
                  <div key={altIndex} className="alternative-item">
                    <div className="alternative-path">
                      <FontAwesomeIcon icon="folder" />
                      <span>{alternative.path}</span>
                    </div>
                    <div className="alternative-reasoning">
                      <FontAwesomeIcon icon="info-circle" />
                      <span>{alternative.reasoning}</span>
                    </div>
                    <button
                      className="alternative-select-btn"
                      onClick={() => onSelectSuggestion({
                        ...suggestion,
                        suggestedPath: alternative.path,
                        suggestedName: alternative.name,
                        reasoning: alternative.reasoning
                      })}
                      title="Use this alternative"
                    >
                      <FontAwesomeIcon icon="check" />
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
