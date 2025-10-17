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
            <Link to="/homepage-editor" className="action-card homepage-card">
              <div className="card-icon">
                <FontAwesomeIcon icon={faCog} />
              </div>
              <h3 className="card-title">EG Coding</h3>
              <p className="card-description">
                AI 도움으로 홈페이지를 효율적으로 관리하고 수정하세요. 콘텐츠 생성과 편집을 자동화하세요.
              </p>
              <div className="card-features">
                <span className="feature-tag">AI 관리</span>
                <span className="feature-tag">자동 편집</span>
                <span className="feature-tag">콘텐츠 생성</span>
              </div>
            </Link>

            <Link to="/blog-connector" className="action-card scheduler-card">
              <div className="card-icon">
                <FontAwesomeIcon icon={faCalendarAlt} />
              </div>
              <h3 className="card-title">EG Blogging</h3>
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
              <h3 className="card-title">EG SSL-Checker</h3>
              <p className="card-description">
                웹블로그의 SSL 인증서와 보안 상태를 분석하여 안전한 블로그 운영을 보장하세요.
              </p>
              <div className="card-features">
                <span className="feature-tag">SSL 분석</span>
                <span className="feature-tag">보안 검사</span>
                <span className="feature-tag">취약점 탐지</span>
              </div>
            </Link>

            <Link to="/seo-analyzer" className="action-card seo-card">
              <div className="card-icon">
                <FontAwesomeIcon icon={faGlobe} />
              </div>
              <h3 className="card-title">EG SEO-Analyzer</h3>
              <p className="card-description">
                웹사이트의 SEO 성능을 분석하고 검색 엔진 최적화를 위한 개선 방안을 제시하세요.
              </p>
              <div className="card-features">
                <span className="feature-tag">SEO 분석</span>
                <span className="feature-tag">키워드 최적화</span>
                <span className="feature-tag">성능 개선</span>
              </div>
            </Link>

            <Link to="/mcp-server" className="action-card mcp-card">
              <div className="card-icon">
                <FontAwesomeIcon icon={faServer} />
              </div>
              <h3 className="card-title">EG MCP Server</h3>
              <p className="card-description">
                MCP(Model Context Protocol) 서버를 등록하고 관리하여 AI 모델과의 연결을 설정하세요.
              </p>
              <div className="card-features">
                <span className="feature-tag">서버 등록</span>
                <span className="feature-tag">AI 연결</span>
                <span className="feature-tag">프로토콜 관리</span>
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
