import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWordpress, faGlobe, faCheck, faArrowRight, faPlus, faFileAlt } from '../../utils/fontAwesomeIcons';
import WordPressConnectionForm from './WordPressConnectionForm';
import ConnectionList from './ConnectionList';
import naverBlogIcon from '../../../../assets/naverblog.svg';
import tistoryIcon from '../../../../assets/tistory.svg';
import './BlogConnector.css';

interface BlogPlatform {
  id: string;
  name: string;
  description: string;
  icon: any | string;
  color: string;
  gradient: string;
  isAvailable: boolean;
  features: string[];
  status: 'available' | 'coming-soon' | 'beta';
}

interface BlogConnectorProps {
  onShowConnectionList?: () => void;
}

const BlogConnector: React.FC<BlogConnectorProps> = ({ onShowConnectionList }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [showWordPressForm, setShowWordPressForm] = useState<boolean>(false);
  const [showConnectionList, setShowConnectionList] = useState<boolean>(false);

  const platforms: BlogPlatform[] = [
    {
      id: 'wordpress',
      name: 'WordPress',
      description: '',
      icon: faWordpress,
      color: '#21759b',
      gradient: 'linear-gradient(135deg, #21759b 0%, #1e6a8c 100%)',
      isAvailable: true,
      features: [],
      status: 'available'
    },
    {
      id: 'naver-blog',
      name: 'Naver Blog',
      description: '',
      icon: naverBlogIcon,
      color: '#03c75a',
      gradient: 'linear-gradient(135deg, #03c75a 0%, #02a54f 100%)',
      isAvailable: false,
      features: [],
      status: 'coming-soon'
    },
    {
      id: 'tistory',
      name: 'Tistory',
      description: '',
      icon: tistoryIcon,
      color: '#FF5A4A',
      gradient: 'linear-gradient(135deg, #FF5A4A 0%, #e04a3a 100%)',
      isAvailable: false,
      features: [],
      status: 'coming-soon'
    }
  ];

  const handlePlatformSelect = (platformId: string) => {
    setSelectedPlatform(platformId);
    if (platformId === 'wordpress') {
      setShowWordPressForm(true);
    }
  };

  const handleWordPressConnect = async (formData: any) => {
    // Connection is already saved to store in the form component
    console.log('WordPress connection completed:', formData);
    
    // Show success message (you could replace this with a toast notification)
    alert(`Successfully connected to WordPress site: ${formData.name}`);
    
    // Reset state on success
    setShowWordPressForm(false);
    setSelectedPlatform('');
  };

  const handleBackFromForm = () => {
    setShowWordPressForm(false);
    setSelectedPlatform('');
  };

  const handleShowConnectionList = () => {
    if (onShowConnectionList) {
      onShowConnectionList();
    } else {
      setShowConnectionList(true);
    }
  };

  const handleBackFromConnectionList = () => {
    setShowConnectionList(false);
  };

  const handleEditConnection = (connection: any) => {
    // For now, just show the form with the connection data
    // You could implement a proper edit mode later
    console.log('Edit connection:', connection);
    setShowWordPressForm(true);
    setShowConnectionList(false);
  };

  const handleDeleteConnection = (connectionId: string) => {
    console.log('Delete connection:', connectionId);
    // The ConnectionList component handles the actual deletion
  };

  // Show WordPress form if selected
  if (showWordPressForm) {
    return (
      <WordPressConnectionForm
        onBack={handleBackFromForm}
        onConnect={handleWordPressConnect}
      />
    );
  }

  // Show connection list if requested
  if (showConnectionList) {
    return (
      <div className="blog-connector">
        <div className="connector-header">
          <button className="return-btn" onClick={handleBackFromConnectionList}>
            <FontAwesomeIcon icon={faArrowRight} />
            <span>Back to Platform Selection</span>
          </button>
        </div>
        <ConnectionList
          onEdit={handleEditConnection}
          onDelete={handleDeleteConnection}
        />
      </div>
    );
  }

  return (
    <div className="blog-connector">
      {/* Platform Selection */}
      <div className="platforms-section">
        <div className="platforms-grid">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              className={`platform-card ${selectedPlatform === platform.id ? 'selected' : ''} ${
                !platform.isAvailable ? 'disabled' : ''
              }`}
              onClick={() => platform.isAvailable && handlePlatformSelect(platform.id)}
            >
              <div className="card-header">
                <div className="platform-status">
                  {platform.status === 'available' && (
                    <span className="status-badge available">
                      <FontAwesomeIcon icon={faCheck} />
                      Available
                    </span>
                  )}
                  {platform.status === 'beta' && (
                    <span className="status-badge beta">Beta</span>
                  )}
                  {platform.status === 'coming-soon' && (
                    <span className="status-badge coming-soon">Coming Soon</span>
                  )}
                </div>
              </div>
              
              <div className="platform-info">
              <div className="platform-icon" style={{ background: platform.gradient }}>
                  {typeof platform.icon === 'string' || platform.icon === naverBlogIcon || platform.icon === tistoryIcon ? (
                    <img src={platform.icon} alt={`${platform.name} icon`} />
                  ) : (
                    <FontAwesomeIcon icon={platform.icon} />
                  )}
                </div>
                <h3>{platform.name}</h3>
                {platform.description && <p>{platform.description}</p>}
                
                {platform.features.length > 0 && (
                  <div className="platform-features">
                    {platform.features.map((feature, index) => (
                      <div key={index} className="feature-item">
                        <FontAwesomeIcon icon={faCheck} />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedPlatform === platform.id && (
                <div className="selected-indicator">
                  <FontAwesomeIcon icon={faCheck} />
                </div>
              )}

            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BlogConnector;
