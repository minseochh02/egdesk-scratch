import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHome, 
  faCalendarAlt, 
  faRocket,
  faCode,
  faClock
} from '@fortawesome/free-solid-svg-icons';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  return (
    <div className="landing-page">
      <div className="landing-container">
        {/* Header Section */}
        <div className="landing-header">
          <div className="logo-section">
            <FontAwesomeIcon icon={faRocket} className="logo-icon" />
            <h1 className="app-title">EGDesk</h1>
          </div>
          <p className="welcome-subtitle">Your WordPress Management Hub</p>
        </div>

        {/* Main Content */}
        <div className="landing-content">
          <div className="welcome-section">
            <h2 className="welcome-title">Welcome to EGDesk!</h2>
            <p className="welcome-description">
              Choose what you'd like to work on today. We'll help you manage your WordPress sites efficiently.
            </p>
          </div>

          {/* Action Cards */}
          <div className="action-cards">
            <Link to="/wordpress" className="action-card homepage-card">
              <div className="card-icon">
                <FontAwesomeIcon icon={faHome} />
              </div>
              <h3 className="card-title">Fix Your Homepage</h3>
              <p className="card-description">
                Connect to your WordPress site and make changes to your homepage content, design, and functionality.
              </p>
              <div className="card-features">
                <span className="feature-tag">WordPress Editor</span>
                <span className="feature-tag">Live Preview</span>
                <span className="feature-tag">Code Editor</span>
              </div>
            </Link>

            <Link to="/scheduler" className="action-card scheduler-card">
              <div className="card-icon">
                <FontAwesomeIcon icon={faCalendarAlt} />
              </div>
              <h3 className="card-title">Schedule Blog Posts</h3>
              <p className="card-description">
                Plan and schedule your blog content with AI assistance. Set up automated posting and content management.
              </p>
              <div className="card-features">
                <span className="feature-tag">AI Writing</span>
                <span className="feature-tag">Auto Schedule</span>
                <span className="feature-tag">Content Planning</span>
              </div>
            </Link>
          </div>

          {/* Additional Options */}
          <div className="additional-options">
            <h3 className="options-title">More Tools</h3>
            <div className="options-grid">
              <Link to="/code-editor" className="option-item">
                <FontAwesomeIcon icon={faCode} />
                <span>Code Editor</span>
              </Link>
              <Link to="/ai-keys" className="option-item">
                <FontAwesomeIcon icon={faRocket} />
                <span>AI Keys</span>
              </Link>
              <Link to="/local-server" className="option-item">
                <FontAwesomeIcon icon={faClock} />
                <span>Local Server</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="landing-footer">
          <p className="footer-text">
            Ready to get started? Choose an option above to begin managing your WordPress sites.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
