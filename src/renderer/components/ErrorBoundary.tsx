import React, { Component, ErrorInfo, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faRefresh } from '../utils/fontAwesomeIcons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Store error details for debugging
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // Try to save error to localStorage for debugging
    try {
      localStorage.setItem('lastError', JSON.stringify(errorDetails));
    } catch (e) {
      console.warn('Could not save error to localStorage:', e);
    }
    
    // Note: File saving removed for simplicity - error details are shown in UI
    
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-content">
            <div className="error-icon">
              <FontAwesomeIcon icon={faExclamationTriangle} />
            </div>
            <h2>Something went wrong</h2>
            <p>The WordPress Sites List encountered an error and couldn't render.</p>
            
            {this.state.error && (
              <details className="error-details">
                <summary>Error Details</summary>
                <div className="error-message">
                  <strong>Error:</strong> {this.state.error.message}
                </div>
                {this.state.error.stack && (
                  <div className="error-stack">
                    <strong>Stack Trace:</strong>
                    <pre>{this.state.error.stack}</pre>
                  </div>
                )}
                {this.state.errorInfo && (
                  <div className="error-component-stack">
                    <strong>Component Stack:</strong>
                    <pre>{this.state.errorInfo.componentStack}</pre>
                  </div>
                )}
                <div className="error-file-info">
                  <p><strong>Error details have been saved to:</strong></p>
                  <ul>
                    <li>localStorage key: 'lastError'</li>
                  </ul>
                </div>
              </details>
            )}
            
            <button onClick={this.handleRetry} className="retry-button">
              <FontAwesomeIcon icon={faRefresh} />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
