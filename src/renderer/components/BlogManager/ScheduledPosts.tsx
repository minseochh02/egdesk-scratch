import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEdit,
  faEye,
  faTrash,
  faCalendarAlt,
  faUser,
  faClock,
  faCheckCircle,
  faTimesCircle,
  faExclamationTriangle,
  faFileAlt,
  faQuestion,
  faDatabase,
  faChartBar,
} from '../../utils/fontAwesomeIcons';
import ExecutionLogs from '../ExecutionLogs';
import './ScheduledPosts.css';

interface ScheduledPost {
  id: number;
  title: string;
  excerpt: string;
  content?: string;
  slug?: string;
  author: string;
  scheduledDate: string;
  status: string;
  type: string;
}

interface WordPressSite {
  id?: string;
  url: string;
  username: string;
  password?: string;
  name?: string;
  posts_count?: number;
  pages_count?: number;
  media_count?: number;
  local_sync_path?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ScheduledPostsProps {
  site: WordPressSite;
  onClose: () => void;
}

const ScheduledPosts: React.FC<ScheduledPostsProps> = ({ site, onClose }) => {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string>('');
  const [showExecutionLogs, setShowExecutionLogs] = useState(false);

  // Form state for creating new scheduled post
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    scheduledDate: '',
    scheduledTime: '',
  });

  // Predefined topics for quick selection
  const suggestedTopics = [
    '웹 개발 트렌드 2024',
    'React vs Vue.js 비교',
    'TypeScript 마스터하기',
    'CSS Grid 완벽 가이드',
    'Node.js 성능 최적화',
    '데이터베이스 설계 원칙',
    'API 설계 모범 사례',
    '보안 코딩 가이드',
    '코드 리뷰 문화 만들기',
    '개발자 생산성 향상 팁',
  ];

  useEffect(() => {
    loadScheduledPosts();
  }, [site]);

  const loadScheduledPosts = async () => {
    if (!site.password) {
      setError('예약된 포스트를 불러오려면 비밀번호가 필요합니다.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Fetch scheduled posts from WordPress API
      const response = await fetch(
        `${site.url}/wp-json/wp/v2/posts?status=future&per_page=50`,
        {
          headers: {
            Authorization: `Basic ${btoa(`${site.username}:${site.password}`)}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.ok) {
        const postsData = await response.json();
        const formattedPosts: ScheduledPost[] = postsData.map((post: any) => ({
          id: post.id,
          title: post.title.rendered,
          excerpt: post.excerpt.rendered.replace(/<[^>]*>/g, ''),
          content: post.content.rendered,
          slug: post.slug,
          author: post._embedded?.author?.[0]?.name || 'Unknown',
          scheduledDate: post.date,
          status: post.status,
          type: post.type,
        }));
        setScheduledPosts(formattedPosts);
      } else {
        throw new Error('예약된 포스트를 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('Failed to load scheduled posts:', error);
      setError('예약된 포스트를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setCreateError('');
  };

  const selectTopic = (topic: string) => {
    setFormData((prev) => ({
      ...prev,
      title: topic,
      content: generateContentForTopic(topic),
    }));
  };

  const generateContentForTopic = (topic: string): string => {
    const contentTemplates: { [key: string]: string } = {
      '웹 개발 트렌드 2024': `# ${topic}

## 소개
2024년 웹 개발 분야에서 주목받고 있는 주요 트렌드들을 살펴보겠습니다.

## 주요 트렌드
- **AI 통합 개발**: ChatGPT, GitHub Copilot 등 AI 도구의 개발 도구 통합
- **Edge Computing**: 더 빠른 응답을 위한 엣지 컴퓨팅 활용
- **WebAssembly**: 네이티브 성능의 웹 애플리케이션 개발
- **Progressive Web Apps**: 모바일 앱 수준의 웹 경험 제공

## 결론
이러한 트렌드들을 적절히 활용하여 더 나은 웹 애플리케이션을 개발해보세요.`,

      'React vs Vue.js 비교': `# ${topic}

## 개요
현재 가장 인기 있는 두 프론트엔드 프레임워크를 비교해보겠습니다.

## React
### 장점
- 큰 생태계와 커뮤니티
- 유연한 아키텍처
- 풍부한 서드파티 라이브러리

### 단점
- 높은 학습 곡선
- 복잡한 상태 관리

## Vue.js
### 장점
- 쉬운 학습 곡선
- 직관적인 템플릿 문법
- 좋은 문서화

### 단점
- 상대적으로 작은 생태계
- 기업 지원 부족

## 결론
프로젝트의 요구사항과 팀의 경험에 따라 선택하세요.`,

      'TypeScript 마스터하기': `# ${topic}

## TypeScript란?
JavaScript에 정적 타입을 추가한 프로그래밍 언어입니다.

## 주요 기능
- **타입 안정성**: 컴파일 타임에 오류 검출
- **IntelliSense**: 향상된 자동완성 기능
- **리팩토링**: 안전한 코드 수정
- **인터페이스**: 객체 구조 정의

## 실전 팁
1. 점진적 도입: 기존 JavaScript 프로젝트에 단계적으로 적용
2. 엄격한 설정: strict 모드 활성화
3. 타입 정의: 라이브러리별 타입 정의 활용

## 결론
TypeScript는 대규모 프로젝트에서 코드 품질과 개발 생산성을 크게 향상시킵니다.`,
    };

    return (
      contentTemplates[topic] ||
      `# ${topic}

## 소개
${topic}에 대해 자세히 알아보겠습니다.

## 주요 내용
- 핵심 개념 이해
- 실전 적용 방법
- 모범 사례

## 결론
이 주제에 대해 더 깊이 있게 학습하고 실전에 적용해보세요.`
    );
  };

  const createScheduledPost = async () => {
    if (!formData.title.trim()) {
      setCreateError('제목을 입력해주세요.');
      return;
    }
    if (!formData.content.trim()) {
      setCreateError('내용을 입력해주세요.');
      return;
    }
    if (!formData.scheduledDate || !formData.scheduledTime) {
      setCreateError('예약 날짜와 시간을 선택해주세요.');
      return;
    }

    setIsCreating(true);
    setCreateError('');

    try {
      const scheduledDateTime = new Date(
        `${formData.scheduledDate}T${formData.scheduledTime}`,
      );

      const postData = {
        title: formData.title,
        content: formData.content,
        status: 'future',
        date: scheduledDateTime.toISOString(),
      };

      const response = await fetch(`${site.url}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${site.username}:${site.password || ''}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      });

      if (response.ok) {
        const newPost = await response.json();
        setScheduledPosts((prev) => [
          ...prev,
          {
            id: newPost.id,
            title: newPost.title.rendered,
            excerpt: newPost.excerpt.rendered.replace(/<[^>]*>/g, ''),
            content: newPost.content.rendered,
            slug: newPost.slug,
            author: site.username,
            scheduledDate: newPost.date,
            status: newPost.status,
            type: newPost.type,
          },
        ]);

        setFormData({
          title: '',
          content: '',
          scheduledDate: '',
          scheduledTime: '',
        });
        setShowCreateForm(false);
        alert('예약된 포스트가 성공적으로 생성되었습니다!');
      } else {
        throw new Error('포스트 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create scheduled post:', error);
      setCreateError('포스트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const deleteScheduledPost = async (postId: number) => {
    if (!window.confirm('정말로 이 예약된 포스트를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(
        `${site.url}/wp-json/wp/v2/posts/${postId}?force=true`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${btoa(`${site.username}:${site.password || ''}`)}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.ok) {
        setScheduledPosts((prev) => prev.filter((post) => post.id !== postId));
        alert('예약된 포스트가 삭제되었습니다.');
      } else {
        throw new Error('포스트 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete scheduled post:', error);
      alert('포스트 삭제 중 오류가 발생했습니다.');
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'future':
        return '예약됨';
      case 'draft':
        return '임시저장';
      case 'pending':
        return '검토 대기';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string): React.JSX.Element => {
    switch (status) {
      case 'future':
        return <FontAwesomeIcon icon={faCalendarAlt} className="status-icon" />;
      case 'draft':
        return <FontAwesomeIcon icon={faFileAlt} className="status-icon" />;
      case 'pending':
        return <FontAwesomeIcon icon={faClock} className="status-icon" />;
      default:
        return <FontAwesomeIcon icon={faQuestion} className="status-icon" />;
    }
  };

  return (
    <div className="scheduled-posts-modal">
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-content">
        <div className="modal-header">
          <h3>📅 예약된 블로그 포스트 관리</h3>
          <div className="header-actions">
            <button
              className="scheduled-posts-action-btn secondary"
              onClick={() => setShowExecutionLogs(true)}
              title="View execution logs"
            >
              <FontAwesomeIcon icon={faDatabase} />
              실행 로그
            </button>
            <button
              className="create-btn"
              onClick={() => setShowCreateForm(true)}
            >
              ➕ 새 포스트 예약
            </button>
            <button className="close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="modal-body">
          {isLoading ? (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p>예약된 포스트를 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <h4>❌ 오류</h4>
              <p>{error}</p>
              <button onClick={loadScheduledPosts} className="retry-btn">
                다시 시도
              </button>
            </div>
          ) : scheduledPosts.length === 0 ? (
            <div className="empty-state">
              <h4>
                <FontAwesomeIcon icon={faFileAlt} className="empty-icon" /> 예약된 포스트가 없습니다
              </h4>
              <p>
                현재 예약된 블로그 포스트가 없습니다. 새로운 포스트를
                예약해보세요!
              </p>
              <button
                className="create-first-post-btn"
                onClick={() => setShowCreateForm(true)}
              >
                <FontAwesomeIcon icon={faFileAlt} className="action-icon" /> 첫 번째 포스트 예약하기
              </button>
            </div>
          ) : (
            <div className="scheduled-posts-list">
              <div className="posts-header">
                <h4>총 {scheduledPosts.length}개의 예약된 포스트</h4>
                <button className="refresh-btn" onClick={loadScheduledPosts}>
                  🔄 새로고침
                </button>
              </div>

              <div className="posts-grid">
                {scheduledPosts.map((post) => (
                  <div key={post.id} className="scheduled-post-card">
                    <div className="post-header">
                      <h5>{post.title}</h5>
                      <span className="post-status">
                        {getStatusIcon(post.status)}{' '}
                        {getStatusText(post.status)}
                      </span>
                    </div>

                    <div className="post-excerpt">
                      {post.excerpt || '요약 없음'}
                    </div>

                    <div className="post-meta">
                      <div className="meta-item">
                        <span className="meta-label">👤 작성자:</span>
                        <span className="meta-value">{post.author}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">📅 예약일:</span>
                        <span className="meta-value">
                          {new Date(post.scheduledDate).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">
                          📄 타입:
                        </span>
                        <span className="meta-value">{post.type}</span>
                      </div>
                    </div>

                    <div className="post-actions">
                      <button
                        className="scheduled-posts-action-btn small primary"
                        onClick={() => {
                          window.open(
                            `${site.url}/wp-admin/post.php?post=${post.id}&action=edit`,
                            '_blank',
                          );
                        }}
                      >
                        <FontAwesomeIcon icon={faEdit} className="action-icon" /> 편집
                      </button>
                      <button
                        className="scheduled-posts-action-btn small secondary"
                        onClick={() => {
                          window.open(
                            `${site.url}/?p=${post.id}&preview=true`,
                            '_blank',
                          );
                        }}
                      >
                        <FontAwesomeIcon icon={faEye} className="action-icon" /> 미리보기
                      </button>
                      <button
                        className="scheduled-posts-action-btn small danger"
                        onClick={() => deleteScheduledPost(post.id)}
                      >
                        <FontAwesomeIcon icon={faTrash} className="action-icon" /> 삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="scheduled-posts-action-btn secondary" onClick={onClose}>
            닫기
          </button>
          <button
            className="scheduled-posts-action-btn primary"
            onClick={() => {
              window.open(
                `${site.url}/wp-admin/edit.php?post_status=future`,
                '_blank',
              );
            }}
          >
            WordPress에서 관리
          </button>
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreateForm && (
        <div className="create-post-modal">
          <div
            className="modal-overlay"
            onClick={() => setShowCreateForm(false)}
          />
          <div className="modal-content create-modal">
            <div className="modal-header">
              <h3>
                <FontAwesomeIcon icon={faFileAlt} className="form-icon" /> 새 포스트 예약하기
              </h3>
              <button
                className="close-btn"
                onClick={() => setShowCreateForm(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="create-form">
                <div className="form-section">
                  <h4>💡 주제 선택 (빠른 시작)</h4>
                  <div className="topic-suggestions">
                    {suggestedTopics.map((topic, index) => (
                      <button
                        key={index}
                        className="topic-btn"
                        onClick={() => selectTopic(topic)}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-section">
                  <h4>
                    <FontAwesomeIcon icon={faFileAlt} className="section-icon" /> 포스트 정보
                  </h4>
                  <div className="form-group">
                    <label htmlFor="title">제목 *</label>
                    <input
                      type="text"
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        handleFormChange('title', e.target.value)
                      }
                      placeholder="포스트 제목을 입력하세요"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="content">내용 *</label>
                    <textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) =>
                        handleFormChange('content', e.target.value)
                      }
                      placeholder="포스트 내용을 입력하세요"
                      rows={10}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="scheduledDate">예약 날짜 *</label>
                      <input
                        type="date"
                        id="scheduledDate"
                        value={formData.scheduledDate}
                        onChange={(e) =>
                          handleFormChange('scheduledDate', e.target.value)
                        }
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="scheduledTime">예약 시간 *</label>
                      <input
                        type="time"
                        id="scheduledTime"
                        value={formData.scheduledTime}
                        onChange={(e) =>
                          handleFormChange('scheduledTime', e.target.value)
                        }
                        required
                      />
                    </div>
                  </div>
                </div>

                {createError && (
                  <div className="error-message">❌ {createError}</div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="scheduled-posts-action-btn secondary"
                onClick={() => setShowCreateForm(false)}
              >
                취소
              </button>
              <button
                className="scheduled-posts-action-btn primary"
                onClick={createScheduledPost}
                disabled={isCreating}
              >
                {isCreating ? '⏳ 생성 중...' : '📅 포스트 예약하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execution Logs Modal */}
      {showExecutionLogs && (
        <div className="execution-logs-modal">
          <div className="modal-overlay" onClick={() => setShowExecutionLogs(false)} />
          <div className="modal-content logs-modal">
            <ExecutionLogs
              onClose={() => setShowExecutionLogs(false)}
              showHeader={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledPosts;
