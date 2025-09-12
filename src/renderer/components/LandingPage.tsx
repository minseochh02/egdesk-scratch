import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHome,
  faCalendarAlt,
  faRocket,
  faCode,
  faClock,
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
          <p className="welcome-subtitle">워드프레스 관리 허브</p>
        </div>

        {/* Main Content */}
        <div className="landing-content">
          <div className="welcome-section">
            <h2 className="welcome-title">EGDesk에 오신 것을 환영합니다!</h2>
            <p className="welcome-description">
              오늘 작업하고 싶은 것을 선택하세요. 워드프레스 사이트를 효율적으로 관리할 수 있도록 도와드리겠습니다.
            </p>
          </div>

          {/* Action Cards */}
          <div className="action-cards">
            <Link to="/local-server" className="action-card homepage-card">
              <div className="card-icon">
                <FontAwesomeIcon icon={faHome} />
              </div>
              <h3 className="card-title">홈페이지 수정</h3>
              <p className="card-description">
                로컬 서버를 시작하고 듀얼 스크린 에디터로 워드프레스 사이트 파일을 효율적으로 편집하세요.
              </p>
              <div className="card-features">
                <span className="feature-tag">로컬 서버</span>
                <span className="feature-tag">듀얼 스크린 에디터</span>
                <span className="feature-tag">실시간 미리보기</span>
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
          </div>

          {/* Additional Options */}
          <div className="additional-options">
            <h3 className="options-title">추가 도구</h3>
            <div className="options-grid">
              <Link to="/code-editor" className="option-item">
                <FontAwesomeIcon icon={faCode} />
                <span>코드 에디터</span>
              </Link>
              <Link to="/ai-keys" className="option-item">
                <FontAwesomeIcon icon={faRocket} />
                <span>API 키 관리</span>
              </Link>
              <Link to="/local-server" className="option-item">
                <FontAwesomeIcon icon={faClock} />
                <span>로컬 서버</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="landing-footer">
          <p className="footer-text">
            시작할 준비가 되셨나요? 위의 옵션 중 하나를 선택하여 워드프레스 사이트 관리를 시작하세요.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
