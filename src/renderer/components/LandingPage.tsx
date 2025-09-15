import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHome,
  faCalendarAlt,
  faRocket,
  faCog,
  faShieldAlt,
} from '../utils/fontAwesomeIcons';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  return (
    <div className="landing-page">
      <div className="landing-container">

        {/* Main Content */}
        <div className="landing-content">
          <div className="welcome-section">
            <h2 className="welcome-title">EGDesk에 오신 것을 환영합니다!</h2>
          </div>

          {/* Action Cards */}
          <div className="action-cards">
            <Link to="/ai-chat" className="action-card homepage-card">
              <div className="card-icon">
                <FontAwesomeIcon icon={faCog} />
              </div>
              <h3 className="card-title">홈페이지 관리</h3>
              <p className="card-description">
                AI 도움으로 홈페이지를 효율적으로 관리하고 수정하세요. 콘텐츠 생성과 편집을 자동화하세요.
              </p>
              <div className="card-features">
                <span className="feature-tag">AI 관리</span>
                <span className="feature-tag">자동 편집</span>
                <span className="feature-tag">콘텐츠 생성</span>
              </div>
            </Link>

            <Link to="/wordpress-sites" className="action-card scheduler-card">
              <div className="card-icon">
                <FontAwesomeIcon icon={faCalendarAlt} />
              </div>
              <h3 className="card-title">블로그 관리</h3>
              <p className="card-description">
                AI 도움으로 블로그 콘텐츠를 계획하고 일정을 잡으세요. 자동 포스팅과 콘텐츠 관리를 설정하세요.
              </p>
              <div className="card-features">
                <span className="feature-tag">AI 글쓰기</span>
                <span className="feature-tag">자동 일정</span>
                <span className="feature-tag">콘텐츠 계획</span>
              </div>
            </Link>

            <Link to="/ssl-analyzer" className="action-card security-card">
              <div className="card-icon">
                <FontAwesomeIcon icon={faShieldAlt} />
              </div>
              <h3 className="card-title">사이트 보안 분석</h3>
              <p className="card-description">
                웹사이트의 SSL 인증서와 보안 상태를 분석하여 안전한 사이트 운영을 보장하세요.
              </p>
              <div className="card-features">
                <span className="feature-tag">SSL 분석</span>
                <span className="feature-tag">보안 검사</span>
                <span className="feature-tag">취약점 탐지</span>
              </div>
            </Link>
          </div>

          {/* Additional Options */}
          <div className="additional-options">
            <h3 className="options-title">도구 모음</h3>
            <div className="options-grid">
              <Link to="/ai-keys" className="option-item">
                <FontAwesomeIcon icon={faRocket} />
                <span>API 키 관리</span>
              </Link>
            </div>
          </div>
        </div>

        
      </div>
    </div>
  );
};

export default LandingPage;
