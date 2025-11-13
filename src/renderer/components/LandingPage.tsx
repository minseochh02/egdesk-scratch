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
  faDesktop,
  faComments,
  faBuilding,
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
            <h2 className="egdesk-landing-welcome-title">EGDesk에 오신 것을 환영합니다!</h2>
          </div>

          {/* Action Cards */}
          <div className="egdesk-landing-action-cards">
            <Link to="/egdesktop" className="egdesk-landing-action-card egdesk-landing-desktop-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faDesktop} />
              </div>
              <h3 className="egdesk-landing-card-title">EGDesktop</h3>
              <p className="egdesk-landing-card-description">
                통합 데스크톱 환경에서 모든 EGDesk 기능을 한눈에 관리하고 제어하세요.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">통합 관리</span>
                <span className="egdesk-landing-feature-tag">대시보드</span>
                <span className="egdesk-landing-feature-tag">중앙 제어</span>
              </div>
            </Link>

            <Link
              to="/egbusiness-identity"
              className="egdesk-landing-action-card egdesk-landing-identity-card"
            >
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faBuilding} />
              </div>
              <h3 className="egdesk-landing-card-title">EG Business Identity</h3>
              <p className="egdesk-landing-card-description">
                브랜드 자산과 웹사이트를 연결하여 AI가 즉시 브랜드 아이덴티티와 소셜 전략을 설계하도록
                해보세요.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">브랜드 허브</span>
                <span className="egdesk-landing-feature-tag">AI 아이덴티티</span>
                <span className="egdesk-landing-feature-tag">소셜 로드맵</span>
              </div>
            </Link>

            <Link to="/egchatting" className="egdesk-landing-action-card egdesk-landing-chat-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faComments} />
              </div>
              <h3 className="egdesk-landing-card-title">EG Chatting</h3>
              <p className="egdesk-landing-card-description">
                팀과 실시간으로 협업하고 AI 어시스턴트와 대화하며 프로젝트를 빠르게 진행하세요.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">실시간 협업</span>
                <span className="egdesk-landing-feature-tag">AI 어시스트</span>
                <span className="egdesk-landing-feature-tag">멀티 탭</span>
              </div>
            </Link>

            <Link to="/homepage-editor" className="egdesk-landing-action-card egdesk-landing-homepage-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faCog} />
              </div>
              <h3 className="egdesk-landing-card-title">EG Coding</h3>
              <p className="egdesk-landing-card-description">
                AI 도움으로 홈페이지를 효율적으로 관리하고 수정하세요. 콘텐츠 생성과 편집을 자동화하세요.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">AI 관리</span>
                <span className="egdesk-landing-feature-tag">자동 편집</span>
                <span className="egdesk-landing-feature-tag">콘텐츠 생성</span>
              </div>
            </Link>

            <Link to="/blog-connector" className="egdesk-landing-action-card egdesk-landing-scheduler-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faCalendarAlt} />
              </div>
              <h3 className="egdesk-landing-card-title">EG Blogging</h3>
              <p className="egdesk-landing-card-description">
                AI 도움으로 블로그 콘텐츠를 계획하고 일정을 잡으세요. 자동 포스팅과 콘텐츠 관리를 설정하세요.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">AI 글쓰기</span>
                <span className="egdesk-landing-feature-tag">자동 일정</span>
                <span className="egdesk-landing-feature-tag">콘텐츠 계획</span>
              </div>
            </Link>

            <Link to="/ssl-analyzer" className="egdesk-landing-action-card egdesk-landing-security-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faShieldAlt} />
              </div>
              <h3 className="egdesk-landing-card-title">EG SSL-Checker</h3>
              <p className="egdesk-landing-card-description">
                웹블로그의 SSL 인증서와 보안 상태를 분석하여 안전한 블로그 운영을 보장하세요.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">SSL 분석</span>
                <span className="egdesk-landing-feature-tag">보안 검사</span>
                <span className="egdesk-landing-feature-tag">취약점 탐지</span>
              </div>
            </Link>

            <Link to="/seo-analyzer" className="egdesk-landing-action-card egdesk-landing-seo-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faGlobe} />
              </div>
              <h3 className="egdesk-landing-card-title">EG SEO-Analyzer</h3>
              <p className="egdesk-landing-card-description">
                웹사이트의 SEO 성능을 분석하고 검색 엔진 최적화를 위한 개선 방안을 제시하세요.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">SEO 분석</span>
                <span className="egdesk-landing-feature-tag">키워드 최적화</span>
                <span className="egdesk-landing-feature-tag">성능 개선</span>
              </div>
            </Link>

            <Link to="/mcp-server" className="egdesk-landing-action-card egdesk-landing-mcp-card">
              <div className="egdesk-landing-card-icon">
                <FontAwesomeIcon icon={faServer} />
              </div>
              <h3 className="egdesk-landing-card-title">EG MCP Server</h3>
              <p className="egdesk-landing-card-description">
                MCP(Model Context Protocol) 서버를 등록하고 관리하여 AI 모델과의 연결을 설정하세요.
              </p>
              <div className="egdesk-landing-card-features">
                <span className="egdesk-landing-feature-tag">서버 등록</span>
                <span className="egdesk-landing-feature-tag">AI 연결</span>
                <span className="egdesk-landing-feature-tag">프로토콜 관리</span>
              </div>
            </Link>
          </div>

          {/* Additional Options */}
          <div className="egdesk-landing-additional-options">
            <h3 className="egdesk-landing-options-title">도구 모음</h3>
            <div className="egdesk-landing-options-grid">
              <Link to="/ai-keys" className="egdesk-landing-option-item">
                <FontAwesomeIcon icon={faRocket} />
                <span>API 키 관리</span>
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
