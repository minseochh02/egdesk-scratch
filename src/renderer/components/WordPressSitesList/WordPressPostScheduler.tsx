import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faClock,
  faGlobe,
  faCheck,
  faTimes,
  faExclamationTriangle,
  faRobot,
} from '@fortawesome/free-solid-svg-icons';
import SchedulerService, {
  CreateTaskData,
} from '../../services/schedulerService';
import { WordPressConnection } from '../../../main/preload';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import { AIKey } from '../AIKeysManager/types';
import './WordPressPostScheduler.css';

interface WordPressPostSchedulerProps {
  sites: WordPressConnection[];
  selectedSite?: WordPressConnection | null;
  onTaskCreated?: () => void;
}


const WordPressPostScheduler: React.FC<WordPressPostSchedulerProps> = ({
  sites,
  selectedSite: propSelectedSite,
  onTaskCreated,
}) => {
  const [selectedSite, setSelectedSite] = useState<WordPressConnection | null>(propSelectedSite || null);
  const [topics, setTopics] = useState<Array<{topic: string, lastUsed: string, count: number}>>([]);
  const [newTopic, setNewTopic] = useState<string>('');
  const [schedule, setSchedule] = useState<string>('interval:3600000'); // Default to 1 hour
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [topicSelectionMode, setTopicSelectionMode] = useState<'round-robin' | 'random' | 'least-used'>('least-used');

  // AI Configuration state
  const [activeKeys, setActiveKeys] = useState<AIKey[]>([]);

  const schedulerService = SchedulerService.getInstance();


  // Update selectedSite when prop changes
  useEffect(() => {
    setSelectedSite(propSelectedSite || null);
  }, [propSelectedSite]);

  // Load AI keys and configuration
  useEffect(() => {
    const unsub = aiKeysStore.subscribe((state) => {
      setActiveKeys(state.keys.filter((k) => k.isActive));
    });
    return () => unsub();
  }, []);

  // Topic management functions
  const addTopic = () => {
    if (!newTopic.trim()) return;
    
    const topicExists = topics.some(t => t.topic.toLowerCase() === newTopic.trim().toLowerCase());
    if (topicExists) {
      setError('이미 존재하는 주제입니다.');
      return;
    }
    
    setTopics(prev => [...prev, {
      topic: newTopic.trim(),
      lastUsed: '',
      count: 0
    }]);
    setNewTopic('');
  };

  const removeTopic = (index: number) => {
    setTopics(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllTopics = () => {
    setTopics([]);
  };





  const createBlogPostTask = async () => {
    if (!selectedSite) {
      setError('WordPress 사이트를 선택해주세요');
      return;
    }

    if (topics.length === 0) {
      setError('최소 하나의 블로그 주제를 추가해주세요');
      return;
    }

    // Validate WordPress credentials
    if (!selectedSite.username || !selectedSite.password) {
      setError(
        'WordPress 자격 증명(사용자명 및 비밀번호)이 필요합니다. WordPress 연결 설정을 확인해주세요.',
      );
      return;
    }

    // Validate AI settings
    if (activeKeys.length === 0) {
      setError('Gemini AI 설정이 필요합니다. AI Keys Manager에서 Google API 키를 추가해주세요.');
      return;
    }

    const selectedKey = activeKeys.find(key => key.providerId === 'google');
    if (!selectedKey) {
      setError('Gemini 블로그 생성을 위해서는 Google API 키가 필요합니다.');
      return;
    }

    // Validate Gemini API key exists
    if (!selectedKey.fields.apiKey) {
      setError('Gemini API 키가 설정되지 않았습니다.');
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      // Get the script path - use relative path from working directory
      const scriptPath = './scripts/generate-and-upload-blog.js';
      
      // Prepare environment variables for the Gemini script
      const environment = {
        GEMINI_API_KEY: selectedKey.fields.apiKey,
        WORDPRESS_URL: selectedSite.url,
        WORDPRESS_USERNAME: selectedSite.username,
        WORDPRESS_PASSWORD: selectedSite.password,
        // Image generation settings (enabled by default)
        IMAGE_GENERATION_ENABLED: 'true',
        IMAGE_PROVIDER: 'gemini',
        IMAGE_QUALITY: 'standard',
        IMAGE_SIZE: '1024x1024',
        IMAGE_STYLE: 'realistic',
        IMAGE_ASPECT_RATIO: 'landscape',
      };

      // Create the command to run the combined script with task ID as argument
      const command = `node --max-old-space-size=4096 ${scriptPath}`;

      const taskData: CreateTaskData = {
        name: `WordPress Blog: ${topics.length} topics - ${selectedSite.name || selectedSite.url} (Gemini AI)`,
        description: `자동으로 ${topics.length}개의 주제로 구성된 블로그 게시물을 ${selectedSite.url}에 Gemini AI가 매번 새로 생성한 콘텐츠와 이미지로 게시합니다.`,
        command,
        schedule,
        enabled: true,
        workingDirectory: '',
        environment,
        outputFile: '',
        errorFile: '',
        metadata: {
          topics: topics,
          topicSelectionMode: topicSelectionMode,
          wordpressSite: {
            url: selectedSite.url,
            name: selectedSite.name || selectedSite.url,
            username: selectedSite.username
          },
          aiSettings: {
            provider: 'gemini',
            imageGenerationEnabled: true,
            imageProvider: 'gemini',
            imageQuality: 'standard',
            imageSize: '1024x1024',
            imageStyle: 'realistic',
            imageAspectRatio: 'landscape'
          }
        }
      };

      const response = await schedulerService.createTask(taskData);

      if (response.success && response.data) {
        // Update the task with the correct command that includes the task ID
        const updatedCommand = `node --max-old-space-size=4096 ${scriptPath} "${response.data.id}"`;
        await schedulerService.updateTask(response.data.id, {
          command: updatedCommand
        });

        setSuccess(
          `블로그 작업이 성공적으로 생성되었습니다! ${topics.length}개의 주제로 구성된 게시물이 Gemini AI가 매번 새로 생성한 콘텐츠와 이미지와 함께 ${selectedSite.name || selectedSite.url}에 게시됩니다.`,
        );
        setTopics([]); // Clear the topics
        onTaskCreated?.();
      } else {
        setError(response.error || 'WordPress 블로그 작업 생성에 실패했습니다.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'WordPress 블로그 작업 생성에 실패했습니다.',
      );
    } finally {
      setIsCreating(false);
    }
  };






  if (sites.length === 0) {
    return (
      <div className="wordpress-post-scheduler">
        <div className="empty-state">
          <FontAwesomeIcon icon={faGlobe} />
          <h3>사용 가능한 WordPress 사이트가 없습니다</h3>
          <p>예약 게시물을 생성하려면 먼저 WordPress 사이트를 추가해주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wordpress-post-scheduler">
      <div className="scheduler-header">
        <h3>
          <FontAwesomeIcon icon={faRobot} />
          Gemini AI 블로그 자동화
        </h3>
        <p className="header-description">
          주제만 입력하면 Gemini AI가 고품질 블로그 콘텐츠와 이미지를 자동으로 생성하여 WordPress에 게시합니다.
        </p>
      </div>

      {error && (
        <div className="error-message">
          <FontAwesomeIcon icon={faTimes} />
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {success && (
        <div className="success-message">
          <FontAwesomeIcon icon={faCheck} />
          {success}
          <button onClick={() => setSuccess(null)}>×</button>
        </div>
      )}


      <div className="site-selector">
        <label htmlFor="site-select">WordPress 사이트 선택:</label>
        <select
          id="site-select"
          value={selectedSite?.id || ''}
          onChange={(e) => {
            const site = sites.find((s) => s.id === e.target.value);
            setSelectedSite(site || null);
          }}
        >
          <option value="">사이트를 선택하세요...</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name || site.url} ({site.url})
            </option>
          ))}
        </select>
      </div>

      {selectedSite && (
        <div className="selected-site-info">
          <h4>선택된 사이트: {selectedSite.name || selectedSite.url}</h4>
          <p>URL: {selectedSite.url}</p>
          <p>사용자명: {selectedSite.username}</p>
          <p>
            비밀번호: {selectedSite.password ? '••••••••' : '❌ 사용 불가'}
          </p>
          {!selectedSite.password && (
            <div className="credential-warning">
              ⚠️ WordPress 비밀번호가 없습니다. WordPress 연결 설정에서
              비밀번호를 확인해주세요.
            </div>
          )}
        </div>
      )}


      <div className="blog-creation-section">
        <h4>
          <FontAwesomeIcon icon={faRobot} />
          Gemini AI 블로그 생성
        </h4>
        <p className="section-description">
          주제만 입력하면 Gemini AI가 고품질 블로그 콘텐츠와 이미지를 자동으로 생성하여 WordPress에 게시합니다.
        </p>
        
        <div className="blog-creation-form">
          <div className="form-group">
            <label htmlFor="blog-topics">블로그 주제 관리 *</label>
            <div className="topics-input-container">
              <input
                id="blog-topics"
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="예: 인공지능의 미래, 지속가능한 에너지, 디지털 마케팅 트렌드"
                disabled={isCreating}
                onKeyPress={(e) => e.key === 'Enter' && addTopic()}
              />
              <button
                type="button"
                onClick={addTopic}
                disabled={isCreating || !newTopic.trim()}
                className="add-topic-btn"
              >
                <FontAwesomeIcon icon={faPlus} />
                추가
              </button>
            </div>
            <small className="form-help">
              여러 주제를 추가하면 AI가 자동으로 순환하며 다양한 콘텐츠를 생성합니다.
            </small>
          </div>

          {/* Topics List */}
          {topics.length > 0 && (
            <div className="topics-list">
              <div className="topics-header">
                <h5>추가된 주제 ({topics.length}개)</h5>
                <button
                  type="button"
                  onClick={clearAllTopics}
                  className="clear-all-btn"
                  disabled={isCreating}
                >
                  모두 삭제
                </button>
              </div>
              <div className="topics-items">
                {topics.map((topicItem, index) => (
                  <div key={index} className="topic-item">
                    <div className="topic-info">
                      <span className="topic-text">{topicItem.topic}</span>
                      <div className="topic-stats">
                        <span className="usage-count">사용: {topicItem.count}회</span>
                        {topicItem.lastUsed && (
                          <span className="last-used">
                            마지막: {new Date(topicItem.lastUsed).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTopic(index)}
                      className="remove-topic-btn"
                      disabled={isCreating}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Topic Selection Mode */}
          <div className="form-group">
            <label htmlFor="topic-selection-mode">주제 선택 방식</label>
            <select
              id="topic-selection-mode"
              value={topicSelectionMode}
              onChange={(e) => setTopicSelectionMode(e.target.value as 'round-robin' | 'random' | 'least-used')}
              disabled={isCreating}
            >
              <option value="round-robin">순환 (Round Robin)</option>
              <option value="random">무작위 (Random)</option>
              <option value="least-used">최소 사용 (Least Used)</option>
            </select>
            <small className="form-help">
              AI가 주제를 선택하는 방식을 설정합니다.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="blog-schedule">게시 스케줄</label>
            <select
              id="blog-schedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              disabled={isCreating}
            >
              <option value="interval:300000">5분마다</option>
              <option value="interval:1800000">30분마다</option>
              <option value="interval:3600000">1시간마다</option>
              <option value="interval:86400000">매일</option>
              <option value="interval:604800000">매주</option>
              <option value="cron:0 9 * * 1-5">평일 오전 9시</option>
              <option value="cron:0 0 * * 0">일요일 자정</option>
            </select>
            <small className="form-help">
              선택한 주제로 블로그를 자동 생성하는 빈도를 설정합니다.
            </small>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary btn-large"
              onClick={createBlogPostTask}
              disabled={isCreating || topics.length === 0 || !selectedSite}
            >
              {isCreating ? (
                <>
                  <FontAwesomeIcon icon={faClock} className="spinning" />
                  생성 중...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlus} />
                  블로그 작업 생성
                </>
              )}
            </button>
          </div>

          {!selectedSite && (
            <div className="form-warning">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              먼저 WordPress 사이트를 선택해주세요.
            </div>
          )}

          {topics.length === 0 && (
            <div className="form-warning">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              최소 하나의 블로그 주제를 추가해주세요.
            </div>
          )}

          {activeKeys.length === 0 && (
            <div className="form-warning">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              AI Keys Manager에서 Google API 키를 추가해주세요.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default WordPressPostScheduler;
