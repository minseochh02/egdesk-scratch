import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHome,
  faCalendarAlt,
  faRocket,
  faCog,
  faShieldAlt,
  faServer,
  faGlobe,
  faComments,
  faFingerprint,
  faShare,
  faDocker,
  faDesktop,
  faSearch,
  faUniversity,
  faVideo,
  faDatabase,
  faRobot,
  faRecordVinyl,
  faCode,
  faCloud,
  faCodeBranch,
} from '../utils/fontAwesomeIcons';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  return (
    <div className="egdesk-landing-page">
      <div className="egdesk-landing-scroll">
        <div className="egdesk-landing-container">

        {/* Main Content */}
        <div className="egdesk-landing-content">
          <div className="egdesk-landing-welcome-section">
            <h2 className="egdesk-landing-welcome-title">Welcome to EGDesk!</h2>
          </div>

          {/* Action Cards */}
          <div className="egdesk-landing-action-cards">
            <Link
              to="/egbusiness-identity"
              className="egdesk-landing-action-card egdesk-landing-identity-card"
            >
              <div className="egdesk-landing-card-icon egdesk-landing-identity-icon">
                <FontAwesomeIcon icon={faFingerprint} />
              </div>
              <h3 className="egdesk-landing-card-title">Business Identity</h3>
              <p className="egdesk-landing-card-description">
                Build your brand identity and social strategy with AI.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Brand Hub</span>
                <span className="egdesk-landing-feature-tag">AI Identity</span>
                <span className="egdesk-landing-feature-tag">Social Roadmap</span>
              </div>
            </Link>




            <Link to="/social-media" className="egdesk-landing-action-card egdesk-landing-social-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faShare} />
              </div>
              <h3 className="egdesk-landing-card-title">Social Media</h3>
              <p className="egdesk-landing-card-description">
                Create and schedule AI-powered social content in one place.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Social Automation</span>
                <span className="egdesk-landing-feature-tag">AI Content</span>
                <span className="egdesk-landing-feature-tag">Schedule Management</span>
              </div>
            </Link>

            <Link to="/ssl-analyzer" className="egdesk-landing-action-card egdesk-landing-security-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faShieldAlt} />
              </div>
              <h3 className="egdesk-landing-card-title">SSL-Checker</h3>
              <p className="egdesk-landing-card-description">
                Check SSL certificates and site security status quickly.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">SSL Analysis</span>
                <span className="egdesk-landing-feature-tag">Security Check</span>
                <span className="egdesk-landing-feature-tag">Vulnerability Detection</span>
              </div>
            </Link>

            <Link to="/seo-analyzer" className="egdesk-landing-action-card egdesk-landing-seo-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faGlobe} />
              </div>
              <h3 className="egdesk-landing-card-title">SEO-Analyzer</h3>
              <p className="egdesk-landing-card-description">
                Analyze SEO performance and get practical improvements.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">SEO Analysis</span>
                <span className="egdesk-landing-feature-tag">Keyword Optimization</span>
                <span className="egdesk-landing-feature-tag">Performance Improvement</span>
              </div>
            </Link>

            <Link to="/company-research" className="egdesk-landing-action-card egdesk-landing-company-research-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faSearch} />
              </div>
              <h3 className="egdesk-landing-card-title">Company Research</h3>
              <p className="egdesk-landing-card-description">
                Research companies with AI-powered insights and trend analysis.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">AI Analysis</span>
                <span className="egdesk-landing-feature-tag">Market Trends</span>
                <span className="egdesk-landing-feature-tag">Data Insights</span>
              </div>
            </Link>

            <Link to="/finance-hub" className="egdesk-landing-action-card egdesk-landing-finance-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faUniversity} />
              </div>
              <h3 className="egdesk-landing-card-title">Finance Hub</h3>
              <p className="egdesk-landing-card-description">
                Collect transactions and manage business finances with AI.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Auto-Login</span>
                <span className="egdesk-landing-feature-tag">Transaction Export</span>
                <span className="egdesk-landing-feature-tag">Financial AI</span>
              </div>
            </Link>

            <Link to="/egchatting" className="egdesk-landing-action-card egdesk-landing-chat-card">
              <div className="egdesk-landing-card-icon egdesk-landing-chat-icon">
                <FontAwesomeIcon icon={faComments} />
              </div>
              <h3 className="egdesk-landing-card-title">Chatting</h3>
              <p className="egdesk-landing-card-description">
                Collaborate with your team and AI assistants in real time.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Real-time Collaboration</span>
                <span className="egdesk-landing-feature-tag">AI Assistant</span>
                <span className="egdesk-landing-feature-tag">Multi-tab</span>
              </div>
            </Link>

            <Link to="/homepage-editor" className="egdesk-landing-action-card egdesk-landing-homepage-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faCode} />
              </div>
              <h3 className="egdesk-landing-card-title">Coding</h3>
              <p className="egdesk-landing-card-description">
                Manage and edit homepage projects with AI assistance.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">AI Management</span>
                <span className="egdesk-landing-feature-tag">Auto Edit</span>
                <span className="egdesk-landing-feature-tag">Content Generation</span>
              </div>
            </Link>

            <Link to="/coding" className="egdesk-landing-action-card egdesk-landing-hosting-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faServer} />
              </div>
              <h3 className="egdesk-landing-card-title">Hosting</h3>
              <p className="egdesk-landing-card-description">
                Deploy and manage your web projects with ease.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Deployment</span>
                <span className="egdesk-landing-feature-tag">Live Server</span>
              </div>
            </Link>

            <Link to="/blog-connector" className="egdesk-landing-action-card egdesk-landing-scheduler-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faCalendarAlt} />
              </div>
              <h3 className="egdesk-landing-card-title">Blogging</h3>
              <p className="egdesk-landing-card-description">
                Plan, write, and schedule blog content with AI.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">AI Writing</span>
                <span className="egdesk-landing-feature-tag">Auto Schedule</span>
                <span className="egdesk-landing-feature-tag">Content Planning</span>
              </div>
            </Link>

            <Link to="/mcp-server" className="egdesk-landing-action-card egdesk-landing-mcp-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faCloud} />
              </div>
              <h3 className="egdesk-landing-card-title">MCP Server</h3>
              <p className="egdesk-landing-card-description">
                Register and manage MCP servers for AI model connections.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Server Registration</span>
                <span className="egdesk-landing-feature-tag">AI Connection</span>
                <span className="egdesk-landing-feature-tag">Protocol Management</span>
              </div>
            </Link>

            <Link to="/docker" className="egdesk-landing-action-card egdesk-landing-docker-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faDocker} />
              </div>
              <h3 className="egdesk-landing-card-title">Docker</h3>
              <p className="egdesk-landing-card-description">
                Start, stop, and monitor Docker containers from EGDesk.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Container Management</span>
                <span className="egdesk-landing-feature-tag">Image Control</span>
                <span className="egdesk-landing-feature-tag">Live Logs</span>
              </div>
            </Link>

            <Link to="/egdesktop" className="egdesk-landing-action-card egdesk-landing-desktop-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faDesktop} />
              </div>
              <h3 className="egdesk-landing-card-title">EGDesktop</h3>
              <p className="egdesk-landing-card-description">
                Control desktop environment and remote access settings.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Remote Access</span>
                <span className="egdesk-landing-feature-tag">System Control</span>
                <span className="egdesk-landing-feature-tag">Auto Start</span>
              </div>
            </Link>

            <Link to="/browser-recorder" className="egdesk-landing-action-card egdesk-landing-browser-recorder-card">
              <div className="egdesk-landing-card-icon egdesk-landing-browser-recorder-icon">
                <FontAwesomeIcon icon={faVideo} />
              </div>
              <h3 className="egdesk-landing-card-title">Browser Recorder</h3>
              <p className="egdesk-landing-card-description">
                Record browser flows and generate automated test scripts.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Browser Recording</span>
                <span className="egdesk-landing-feature-tag">Test Automation</span>
                <span className="egdesk-landing-feature-tag">Script Generation</span>
              </div>
            </Link>

            <Link to="/desktop-recorder" className="egdesk-landing-action-card egdesk-landing-desktop-recorder-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faRecordVinyl} />
              </div>
              <h3 className="egdesk-landing-card-title">Desktop Recorder</h3>
              <p className="egdesk-landing-card-description">
                Record desktop interactions and automate workflow scripts.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Desktop Recording</span>
                <span className="egdesk-landing-feature-tag">App Automation</span>
                <span className="egdesk-landing-feature-tag">Workflow Scripts</span>
              </div>
            </Link>

            <Link to="/user-data" className="egdesk-landing-action-card egdesk-landing-userdata-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faDatabase} />
              </div>
              <h3 className="egdesk-landing-card-title">User Data</h3>
              <p className="egdesk-landing-card-description">
                Import Excel/CSV data, auto-sync files, and query tables.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Data Import</span>
                <span className="egdesk-landing-feature-tag">Auto Sync</span>
                <span className="egdesk-landing-feature-tag">Table Viewer</span>
              </div>
            </Link>

            <Link to="/openclaw" className="egdesk-landing-action-card egdesk-landing-openclaw-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faCodeBranch} />
              </div>
              <h3 className="egdesk-landing-card-title">OpenClaw</h3>
              <p className="egdesk-landing-card-description">
                Auto-create accounts and manage tokens using your Google profile.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">GitHub Signup</span>
                <span className="egdesk-landing-feature-tag">Google Profile</span>
                <span className="egdesk-landing-feature-tag">Token Management</span>
              </div>
            </Link>

            <Link to="/rookie" className="egdesk-landing-action-card egdesk-landing-rookie-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faRobot} />
              </div>
              <h3 className="egdesk-landing-card-title">Rookie Automation</h3>
              <p className="egdesk-landing-card-description">
                Build automation workflows to extract and export data fast.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Workflow Builder</span>
                <span className="egdesk-landing-feature-tag">Data Extraction</span>
                <span className="egdesk-landing-feature-tag">Auto Export</span>
              </div>
            </Link>


          </div>

          {/* Additional Options */}
          <div className="egdesk-landing-additional-options">
            <h3 className="egdesk-landing-options-title">Tools</h3>
            <div className="egdesk-landing-options-grid">
              <Link to="/ai-keys" className="egdesk-landing-option-item">
                <FontAwesomeIcon icon={faRocket} />
                <span>API Key Management</span>
              </Link>
            </div>
          </div>
        </div>

        
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
