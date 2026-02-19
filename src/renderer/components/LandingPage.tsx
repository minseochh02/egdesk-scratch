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
                Connect your brand assets and website to let AI instantly design your brand identity and social strategy.
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
                Connect social media accounts and generate content with AI to automatically post. Manage Instagram, Twitter, and more.
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
                Analyze SSL certificates and security status of your blog to ensure safe blog operation.
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
                Analyze your website's SEO performance and provide improvement suggestions for search engine optimization.
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
                Conduct in-depth company research with AI assistance. Gather insights, analyze market trends, and make informed decisions.
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
                Automatically log into bank accounts and extract transaction lists. Manage your business finances with AI-powered insights.
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
                Collaborate with your team in real-time, chat with AI assistants, and move projects forward quickly.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Real-time Collaboration</span>
                <span className="egdesk-landing-feature-tag">AI Assistant</span>
                <span className="egdesk-landing-feature-tag">Multi-tab</span>
              </div>
            </Link>

            <Link to="/homepage-editor" className="egdesk-landing-action-card egdesk-landing-homepage-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faCog} />
              </div>
              <h3 className="egdesk-landing-card-title">Coding</h3>
              <p className="egdesk-landing-card-description">
                Efficiently manage and edit your homepage with AI assistance. Automate content creation and editing.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">AI Management</span>
                <span className="egdesk-landing-feature-tag">Auto Edit</span>
                <span className="egdesk-landing-feature-tag">Content Generation</span>
              </div>
            </Link>

            <Link to="/coding" className="egdesk-landing-action-card egdesk-landing-coding-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faCog} />
              </div>
              <h3 className="egdesk-landing-card-title">New Coding</h3>
              <p className="egdesk-landing-card-description">
                New coding workspace for development tasks.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Development</span>
              </div>
            </Link>

            <Link to="/blog-connector" className="egdesk-landing-action-card egdesk-landing-scheduler-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faCalendarAlt} />
              </div>
              <h3 className="egdesk-landing-card-title">Blogging</h3>
              <p className="egdesk-landing-card-description">
                Plan blog content and schedule posts with AI assistance. Set up automated posting and content management.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">AI Writing</span>
                <span className="egdesk-landing-feature-tag">Auto Schedule</span>
                <span className="egdesk-landing-feature-tag">Content Planning</span>
              </div>
            </Link>

            <Link to="/mcp-server" className="egdesk-landing-action-card egdesk-landing-mcp-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faServer} />
              </div>
              <h3 className="egdesk-landing-card-title">MCP Server</h3>
              <p className="egdesk-landing-card-description">
                Register and manage MCP (Model Context Protocol) servers to establish connections with AI models.
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
                Manage Docker containers and images directly from EGDesk. Start, stop, and monitor your containerized applications.
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
                Manage desktop environment, remote access settings, and system controls directly.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Remote Access</span>
                <span className="egdesk-landing-feature-tag">System Control</span>
                <span className="egdesk-landing-feature-tag">Auto Start</span>
              </div>
            </Link>

            <Link to="/browser-recorder" className="egdesk-landing-action-card egdesk-landing-browser-recorder-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faVideo} />
              </div>
              <h3 className="egdesk-landing-card-title">Browser Recorder</h3>
              <p className="egdesk-landing-card-description">
                Record browser interactions and generate automated test scripts. Replay actions and test workflows with built-in download handling.
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
                Record desktop application interactions and automate workflows. Generate scripts for desktop automation and testing.
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
                Import and manage Excel/CSV files, sync browser downloads automatically, and query your data with SQL-like interface.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">Data Import</span>
                <span className="egdesk-landing-feature-tag">Auto Sync</span>
                <span className="egdesk-landing-feature-tag">Table Viewer</span>
              </div>
            </Link>

            <Link to="/rookie" className="egdesk-landing-action-card egdesk-landing-rookie-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faRobot} />
              </div>
              <h3 className="egdesk-landing-card-title">Rookie Automation</h3>
              <p className="egdesk-landing-card-description">
                Create automation workflows to extract data from websites and apps. Export results to Excel or PDF automatically.
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
