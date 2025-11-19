import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInstagram, faFacebook, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { faGlobe, faCheck, faArrowRight, faPlus } from '../../utils/fontAwesomeIcons';
import InstagramConnectionForm from './components/InstagramConnectionForm';
import YouTubeConnectionForm from './components/YouTubeConnectionForm';
import FacebookConnectionForm from './components/FacebookConnectionForm';
import './SocialMediaConnector.css';

interface SocialMediaPlatform {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  gradient: string;
  isAvailable: boolean;
  features: string[];
  status: 'available' | 'coming-soon' | 'beta';
}

interface SocialMediaConnectorProps {
  onShowConnectionList?: () => void;
}

const SocialMediaConnector: React.FC<SocialMediaConnectorProps> = ({ onShowConnectionList }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [showInstagramForm, setShowInstagramForm] = useState(false);
  const [showYouTubeForm, setShowYouTubeForm] = useState(false);
  const [showFacebookForm, setShowFacebookForm] = useState(false);

  const platforms: SocialMediaPlatform[] = [
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Connect to your Instagram account for automated posting and content management',
      icon: faInstagram,
      color: '#E4405F',
      gradient: 'linear-gradient(135deg, #E4405F 0%, #C13584 100%)',
      isAvailable: true,
      features: ['AI Image Generation', 'Automated Posting', 'Story Management'],
      status: 'available'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      description: 'Connect to your YouTube channel for video management and scheduling',
      icon: faYoutube,
      color: '#FF0000',
      gradient: 'linear-gradient(135deg, #FF0000 0%, #cc0000 100%)',
      isAvailable: false,
      features: ['Video Scheduling', 'Thumbnail Generation', 'Analytics'],
      status: 'coming-soon'
    },
    {
      id: 'facebook',
      name: 'Facebook',
      description: 'Connect to your Facebook page for automated posting and engagement',
      icon: faFacebook,
      color: '#1877F2',
      gradient: 'linear-gradient(135deg, #1877F2 0%, #0e5fc7 100%)',
      isAvailable: true,
      features: ['Page Management', 'Automated Posting', 'Insights'],
      status: 'available'
    }
  ];

  const handlePlatformSelect = (platformId: string) => {
    setSelectedPlatform(platformId);
    
    // Show appropriate form based on platform
    if (platformId === 'instagram') {
      setShowInstagramForm(true);
    } else if (platformId === 'youtube') {
      setShowYouTubeForm(true);
    } else if (platformId === 'facebook') {
      setShowFacebookForm(true);
    } else {
      // TODO: Add forms for other platforms
      console.log('Selected platform:', platformId);
    }
  };

  const handleInstagramSuccess = (connection: any) => {
    console.log('Instagram connection saved:', connection);
    // Navigate to connection list to show the new connection
    if (onShowConnectionList) {
      onShowConnectionList();
    }
  };

  const handleYouTubeSuccess = (connection: any) => {
    console.log('YouTube connection saved:', connection);
    // Navigate to connection list to show the new connection
    if (onShowConnectionList) {
      onShowConnectionList();
    }
  };

  const handleFacebookSuccess = (connection: any) => {
    console.log('Facebook connection saved:', connection);
    // Navigate to connection list to show the new connection
    if (onShowConnectionList) {
      onShowConnectionList();
    }
  };

  return (
    <>
      <div className="social-media-connector">
        <div className="platform-grid">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              className={`platform-card ${platform.isAvailable ? 'available' : 'unavailable'} ${selectedPlatform === platform.id ? 'selected' : ''}`}
              onClick={() => platform.isAvailable && handlePlatformSelect(platform.id)}
            >
              <div className="platform-card-header">
                <div className="platform-icon" style={{ background: platform.gradient }}>
                  <FontAwesomeIcon icon={platform.icon} />
                </div>
                <div className="platform-info">
                  <h3>{platform.name}</h3>
                  {platform.status === 'coming-soon' && (
                    <span className="platform-badge coming-soon">Coming Soon</span>
                  )}
                  {platform.status === 'beta' && (
                    <span className="platform-badge beta">Beta</span>
                  )}
                </div>
              </div>
              <p className="platform-description">{platform.description}</p>
              {platform.features.length > 0 && (
                <ul className="platform-features">
                  {platform.features.map((feature, index) => (
                    <li key={index}>
                      <FontAwesomeIcon icon={faCheck} className="feature-check" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
              <button
                className="platform-connect-btn"
                disabled={!platform.isAvailable}
                onClick={(e) => {
                  e.stopPropagation();
                  if (platform.isAvailable) {
                    handlePlatformSelect(platform.id);
                  }
                }}
              >
                {platform.isAvailable ? (
                  <>
                    <FontAwesomeIcon icon={faPlus} />
                    <span>Connect</span>
                  </>
                ) : (
                  <span>Coming Soon</span>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {showInstagramForm && (
        <InstagramConnectionForm
          onClose={() => setShowInstagramForm(false)}
          onSuccess={handleInstagramSuccess}
        />
      )}

      {showYouTubeForm && (
        <YouTubeConnectionForm
          onClose={() => setShowYouTubeForm(false)}
          onSuccess={handleYouTubeSuccess}
        />
      )}

      {showFacebookForm && (
        <FacebookConnectionForm
          onClose={() => setShowFacebookForm(false)}
          onSuccess={handleFacebookSuccess}
        />
      )}
    </>
  );
};

export default SocialMediaConnector;

