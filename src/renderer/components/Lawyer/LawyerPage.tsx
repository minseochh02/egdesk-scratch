import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGavel } from '../../utils/fontAwesomeIcons';
import './LawyerPage.css';

const LawyerPage: React.FC = () => {
  return (
    <div className="lawyer-page">
      <div className="lawyer-header">
        <div className="lawyer-header-icon">
          <FontAwesomeIcon icon={faGavel} />
        </div>
        <div className="lawyer-header-content">
          <h2 className="lawyer-title">Lawyer</h2>
          <p className="lawyer-subtitle">Legal management and analysis</p>
        </div>
      </div>
      <div className="lawyer-content">
        <div className="lawyer-empty-state">
          <FontAwesomeIcon icon={faGavel} className="empty-icon" />
          <h3>Coming Soon</h3>
          <p>The Lawyer module is currently under development.</p>
        </div>
      </div>
    </div>
  );
};

export default LawyerPage;
