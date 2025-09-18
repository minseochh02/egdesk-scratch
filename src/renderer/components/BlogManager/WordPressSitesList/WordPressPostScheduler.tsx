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
  faKey,
  faCog,
} from '../../../utils/fontAwesomeIcons';
import SchedulerService, {
  CreateTaskData,
} from '../../../services/schedulerService';
import { WordPressConnection } from '../../../../main/preload';
import { aiKeysStore } from '../../AIKeysManager/store/aiKeysStore';
import { AIKey } from '../../AIKeysManager/types';
// AI_PROVIDERS from AIKeysManager types
import { AI_PROVIDERS } from '../../AIKeysManager/types';
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
  const [schedule, setSchedule] = useState<string>('weekly:1:9:0'); // Default to Monday 9:00 AM
  const [dayTimePairs, setDayTimePairs] = useState<Array<{day: string, time: string}>>([{day: '1', time: '09:00'}]); // Array of day-time pairs
  const [schedulingMode, setSchedulingMode] = useState<'weekly' | 'monthly' | 'date' | 'cron'>('weekly');
  const [cronExpression, setCronExpression] = useState<string>('0 9 * * 1'); // Default: Monday 9:00 AM
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [topicSelectionMode, setTopicSelectionMode] = useState<'round-robin' | 'random' | 'least-used'>('least-used');

  // Load topics from localStorage on component mount
  useEffect(() => {
    const loadTopics = () => {
      try {
        const stored = localStorage.getItem('wordpress-blog-topics');
        if (stored) {
          const parsed = JSON.parse(stored);
          setTopics(parsed);
        }
      } catch (error) {
        console.error('Failed to load topics from localStorage:', error);
      }
    };
    loadTopics();
  }, []);

  // Save topics to localStorage whenever topics change
  useEffect(() => {
    const saveTopics = () => {
      try {
        localStorage.setItem('wordpress-blog-topics', JSON.stringify(topics));
      } catch (error) {
        console.error('Failed to save topics to localStorage:', error);
      }
    };
    saveTopics();
  }, [topics]);

  // AI Configuration state
  const [activeKeys, setActiveKeys] = useState<AIKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<AIKey | null>(null);
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash-latest');

  const schedulerService = SchedulerService.getInstance();


  // Update selectedSite when prop changes
  useEffect(() => {
    setSelectedSite(propSelectedSite || null);
  }, [propSelectedSite]);

  // Load AI keys and configuration
  useEffect(() => {
    const unsub = aiKeysStore.subscribe((state) => {
      const activeKeys = state.keys.filter((k) => k.isActive);
      setActiveKeys(activeKeys);
      
      // Auto-select first Google key if none selected and keys are available
      if (!selectedKey && activeKeys.length > 0) {
        const googleKey = activeKeys.find(key => key.providerId === 'google');
        if (googleKey) {
          setSelectedKey(googleKey);
        } else {
          setSelectedKey(activeKeys[0]);
        }
      }
    });
    return () => unsub();
  }, []); // Remove selectedKey from dependencies to prevent infinite loop

  // Handle model change
  const handleModelChange = (providerId: string, modelId: string) => {
    setSelectedModel(modelId);

    // Auto-select a compatible API key for the new provider
    const compatibleKeys = activeKeys.filter(
      (key) => key.providerId === providerId,
    );
    if (compatibleKeys.length > 0) {
      setSelectedKey(compatibleKeys[0]);
    } else {
      setSelectedKey(null);
    }
  };

  // Handle key change
  const handleKeyChange = (key: AIKey | null) => {
    setSelectedKey(key);
  };

  // Add a new day-time pair
  const addDayTimePair = () => {
    setDayTimePairs(prev => [...prev, { day: '1', time: '09:00' }]);
  };

  // Remove a day-time pair
  const removeDayTimePair = (index: number) => {
    setDayTimePairs(prev => {
      const newPairs = prev.filter((_, i) => i !== index);
      updateScheduleWithPairs(newPairs);
      return newPairs;
    });
  };

  // Update day for a specific pair
  const updateDayTimePair = (index: number, day: string, time: string) => {
    setDayTimePairs(prev => {
      const newPairs = prev.map((pair, i) => 
        i === index ? { day, time } : pair
      );
      updateScheduleWithPairs(newPairs);
      return newPairs;
    });
  };

  // Helper function to validate date input
  const isValidDate = (dateString: string): boolean => {
    const date = new Date(dateString);
    const now = new Date();
    return !isNaN(date.getTime()) && date > now;
  };

  // Helper function to validate cron expression (basic validation)
  const isValidCronExpression = (cronExpr: string): boolean => {
    const parts = cronExpr.trim().split(/\s+/);
    return parts.length === 5;
  };

  // Get human-readable description of cron expression
  const getCronDescription = (cronExpr: string): string => {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) return '유효하지 않은 Cron 표현식';
    
    const [minute, hour, day, month, weekday] = parts;
    let description = '';
    
    if (weekday !== '*') {
      const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
      description += `매주 ${days[parseInt(weekday) % 7]}`;
    } else if (day !== '*') {
      description += `매월 ${day}일`;
    } else {
      description += '매일';
    }
    
    if (hour !== '*' && minute !== '*') {
      const h = parseInt(hour);
      const m = parseInt(minute);
      description += ` ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
    
    return description;
  };

  // Update schedule with day-time pairs based on scheduling mode
  const updateScheduleWithPairs = (pairs: Array<{day: string, time: string}>) => {
    if (pairs.length === 0) {
      setSchedule('weekly:1:9:0'); // Default to Monday if no pairs
      return;
    }
    
    // Use the first pair as the primary schedule
    const firstPair = pairs[0];
    const [hours, minutes] = firstPair.time.split(':');
    
    switch (schedulingMode) {
      case 'weekly':
        setSchedule(`weekly:${firstPair.day}:${hours}:${minutes}`);
        break;
      case 'monthly':
        // For monthly, day represents the day of the month (1-31)
        const dayOfMonth = parseInt(firstPair.day) || 1;
        setSchedule(`monthly:${dayOfMonth}:${hours}:${minutes}`);
        break;
      case 'cron':
        setSchedule(`cron:${cronExpression}`);
        break;
      case 'date':
        // For date mode, combine date and time
        const dateTime = `${firstPair.day}T${firstPair.time}:00`;
        setSchedule(`date:${dateTime}`);
        break;
      default:
        setSchedule(`weekly:${firstPair.day}:${hours}:${minutes}`);
    }
  };

  // Topic management functions
  const addTopic = () => {
    if (!newTopic.trim()) return;
    
    // Split by comma and process each topic
    const topicStrings = newTopic.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    if (topicStrings.length === 0) return;
    
    // Check for existing topics
    const existingTopics = topics.map(t => t.topic.toLowerCase());
    const duplicateTopics = topicStrings.filter(topic => 
      existingTopics.includes(topic.toLowerCase())
    );
    
    if (duplicateTopics.length > 0) {
      setError(`이미 존재하는 주제들: ${duplicateTopics.join(', ')}`);
      return;
    }
    
    // Add all new topics
    const newTopics = topicStrings.map(topic => ({
      topic: topic,
      lastUsed: '',
      count: 0
    }));
    
    setTopics(prev => [...prev, ...newTopics]);
    setNewTopic('');
    setError(null); // Clear any previous errors
  };

  const removeTopic = (index: number) => {
    setTopics(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllTopics = () => {
    setTopics([]);
    // Clear from localStorage as well
    try {
      localStorage.removeItem('wordpress-blog-topics');
    } catch (error) {
      console.error('Failed to clear topics from localStorage:', error);
    }
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

    if (dayTimePairs.length === 0) {
      setError('최소 하나의 스케줄을 설정해주세요');
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
    if (!selectedKey) {
      setError('AI API 키를 선택해주세요.');
      return;
    }

    // Validate API key exists
    if (!selectedKey.fields.apiKey) {
      setError('선택된 API 키가 유효하지 않습니다.');
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      // Get the script path - use relative path from working directory
      const scriptPath = './scripts/content/generate-and-upload-blog.js';
      
      // Prepare environment variables for the AI script
      const environment = {
        // AI Configuration - pass the selected API key based on provider
        ...(selectedKey.providerId === 'google' && {
          GEMINI_API_KEY: selectedKey.fields.apiKey,
        }),
        ...(selectedKey.providerId === 'openai' && {
          OPENAI_API_KEY: selectedKey.fields.apiKey,
        }),
        ...(selectedKey.providerId === 'anthropic' && {
          ANTHROPIC_API_KEY: selectedKey.fields.apiKey,
        }),
        // Generic AI settings
        AI_API_KEY: selectedKey.fields.apiKey,
        AI_PROVIDER: selectedKey.providerId,
        AI_MODEL: selectedModel,
        // WordPress settings
        WORDPRESS_URL: selectedSite.url,
        WORDPRESS_USERNAME: selectedSite.username,
        WORDPRESS_PASSWORD: selectedSite.password,
        // Image generation settings (enabled by default)
        IMAGE_GENERATION_ENABLED: 'true',
        IMAGE_PROVIDER: selectedKey.providerId === 'google' ? 'gemini' : 'dalle',
        IMAGE_QUALITY: 'standard',
        IMAGE_SIZE: '1024x1024',
        IMAGE_STYLE: 'realistic',
        IMAGE_ASPECT_RATIO: 'landscape',
      };

      // Create multiple tasks for each day-time pair
      const createdTasks = [];
      const dayLabels = { '1': '월', '2': '화', '3': '수', '4': '목', '5': '금', '6': '토', '0': '일' };

      for (let i = 0; i < dayTimePairs.length; i++) {
        const pair = dayTimePairs[i];
        const [hours, minutes] = pair.time.split(':');
        
        let taskSchedule: string;
        let dayLabel: string;
        
        switch (schedulingMode) {
          case 'weekly':
            taskSchedule = `weekly:${pair.day}:${hours}:${minutes}`;
            dayLabel = dayLabels[pair.day as keyof typeof dayLabels];
            break;
          case 'monthly':
            const dayOfMonth = Math.min(parseInt(pair.day) || 1, 28);
            taskSchedule = `monthly:${dayOfMonth}:${hours}:${minutes}`;
            dayLabel = `${dayOfMonth}일`;
            break;
          case 'cron':
            taskSchedule = `cron:${minutes} ${hours} * * ${pair.day}`;
            dayLabel = dayLabels[pair.day as keyof typeof dayLabels];
            break;
          case 'date':
            // For date mode, create a specific date
            const targetDate = new Date();
            targetDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            if (targetDate <= new Date()) {
              targetDate.setDate(targetDate.getDate() + 1); // Schedule for tomorrow if time has passed
            }
            taskSchedule = `date:${targetDate.toISOString()}`;
            dayLabel = targetDate.toLocaleDateString('ko-KR');
            break;
          default:
            taskSchedule = `weekly:${pair.day}:${hours}:${minutes}`;
            dayLabel = dayLabels[pair.day as keyof typeof dayLabels];
        }

        const taskData: CreateTaskData = {
          name: `WordPress Blog: ${topics.length} topics - ${selectedSite.name || selectedSite.url} (${dayLabel} ${pair.time})`,
          description: `${schedulingMode === 'monthly' ? '매월' : schedulingMode === 'weekly' ? '매주' : ''} ${dayLabel} ${pair.time}에 자동으로 ${topics.length}개의 주제로 구성된 블로그 게시물을 ${selectedSite.url}에 ${selectedKey.providerId.toUpperCase()} AI(${selectedModel})가 매번 새로 생성한 콘텐츠와 이미지로 게시합니다.`,
          command: `ELECTRON_SCRIPT:${scriptPath}`,
          schedule: taskSchedule,
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
              provider: selectedKey.providerId,
              model: selectedModel,
              imageGenerationEnabled: true,
              imageProvider: selectedKey.providerId === 'google' ? 'gemini' : 'dalle',
              imageQuality: 'standard',
              imageSize: '1024x1024',
              imageStyle: 'realistic',
              imageAspectRatio: 'landscape'
            },
            scheduleInfo: {
              day: pair.day,
              time: pair.time,
              dayLabel: dayLabel,
              pairIndex: i,
              totalPairs: dayTimePairs.length
            }
          }
        };

        const response = await schedulerService.createTask(taskData);
        
        if (response.success && response.data) {
          createdTasks.push(response.data);
        } else {
          throw new Error(`Failed to create task for ${dayLabel} ${pair.time}: ${response.error}`);
        }
      }

      if (createdTasks.length > 0) {
        const scheduleSummary = dayTimePairs.map(pair => {
          const dayLabel = dayLabels[pair.day as keyof typeof dayLabels];
          return `${dayLabel} ${pair.time}`;
        }).join(', ');

        setSuccess(
          `${createdTasks.length}개의 블로그 작업이 성공적으로 생성되었습니다! ${topics.length}개의 주제로 구성된 게시물이 ${selectedKey.providerId.toUpperCase()} AI가 매번 새로 생성한 콘텐츠와 이미지와 함께 ${selectedSite.name || selectedSite.url}에 다음 스케줄로 게시됩니다: ${scheduleSummary}`,
        );
        
        // Clear form data after successful task creation
        setTopics([]);
        setNewTopic('');
        setSchedule('cron:0 9 * * 1');
        setDayTimePairs([{day: '1', time: '09:00'}]);
        setTopicSelectionMode('least-used');
        
        // Notify parent component to refresh
        onTaskCreated?.();
      } else {
        setError('모든 작업 생성에 실패했습니다.');
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
          AI 블로그 자동화
        </h4>
        <p className="section-description">
          주제만 입력하면 선택한 AI가 고품질 블로그 콘텐츠와 이미지를 자동으로 생성하여 WordPress에 게시합니다.
        </p>
        
        {/* AI Configuration Controls */}
        <div className="ai-config-controls">
          <div className="config-control-group">
            <label className="config-label">
              <FontAwesomeIcon icon={faKey} />
              API 키
            </label>
            <select
              className="api-key-select"
              value={selectedKey?.id || ''}
              onChange={(e) => {
                const key = activeKeys.find((k) => k.id === e.target.value);
                handleKeyChange(key || null);
              }}
              disabled={activeKeys.length === 0}
            >
              <option value="">
                {activeKeys.length === 0
                  ? '사용 가능한 키가 없습니다'
                  : 'API 키를 선택하세요'}
              </option>
              {activeKeys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.name} ({key.providerId})
                </option>
              ))}
            </select>
          </div>
          
          {/* Model selector hidden as requested */}
          {/* <div className="config-control-group">
            <label className="config-label">
              <FontAwesomeIcon icon={faCog} />
              모델
            </label>
            <select
              className="model-select"
              value={
                selectedModel
                  ? `${selectedKey?.providerId || 'google'}::${selectedModel}`
                  : ''
              }
              onChange={(e) => {
                const { value } = e.target;
                if (!value) {
                  handleModelChange('', '');
                  return;
                }
                const [providerId, modelId] = value.split('::');
                handleModelChange(providerId, modelId);
              }}
            >
              <option value="">모델을 선택하세요...</option>
              {AI_PROVIDERS.map((provider: any) => (
                <optgroup key={provider.id} label={provider.name}>
                  {provider.models.map((model: any) => (
                    <option
                      key={`${provider.id}::${model.id}`}
                      value={`${provider.id}::${model.id}`}
                    >
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div> */}
        </div>
        
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
                {topics.slice(0, 10).map((topicItem, index) => (
                  <div key={index} className="topic-badge">
                    <span className="topic-text">{topicItem.topic}</span>
                    <button
                      type="button"
                      onClick={() => removeTopic(index)}
                      className="remove-topic-btn"
                      disabled={isCreating}
                      title={`사용: ${topicItem.count}회${topicItem.lastUsed ? `, 마지막: ${new Date(topicItem.lastUsed).toLocaleDateString()}` : ''}`}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                ))}
                {topics.length > 10 && (
                  <div className="topics-overflow">
                    <span className="overflow-text">+{topics.length - 10}개 더</span>
                  </div>
                )}
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

          {/* Scheduling Mode */}
          <div className="form-group">
            <label htmlFor="scheduling-mode">스케줄링 방식</label>
            <select
              id="scheduling-mode"
              value={schedulingMode}
              onChange={(e) => {
                const newMode = e.target.value as 'weekly' | 'monthly' | 'date' | 'cron';
                setSchedulingMode(newMode);
                
                // Initialize appropriate defaults for new mode
                if (newMode === 'cron') {
                  setSchedule(`cron:${cronExpression}`);
                } else if (newMode === 'date') {
                  // Set tomorrow as default
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const defaultDate = tomorrow.toISOString().split('T')[0];
                  setDayTimePairs([{day: defaultDate, time: '09:00'}]);
                } else if (newMode === 'monthly') {
                  // Set to 1st of month
                  setDayTimePairs([{day: '1', time: '09:00'}]);
                } else {
                  // Weekly mode
                  setDayTimePairs([{day: '1', time: '09:00'}]);
                }
                
                updateScheduleWithPairs(dayTimePairs);
              }}
              disabled={isCreating}
            >
              <option value="weekly">매주 (Weekly)</option>
              <option value="monthly">매월 (Monthly)</option>
              <option value="date">특정 날짜 (Specific Date)</option>
              <option value="cron">고급 스케줄 (Cron)</option>
            </select>
            <small className="form-help">
              {schedulingMode === 'weekly' && '매주 지정된 요일에 실행됩니다.'}
              {schedulingMode === 'monthly' && '매월 지정된 날짜에 실행됩니다.'}
              {schedulingMode === 'date' && '지정된 날짜와 시간에 한 번만 실행됩니다.'}
              {schedulingMode === 'cron' && '고급 Cron 표현식을 사용합니다.'}
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="blog-schedule">게시 스케줄</label>
            <div className="schedule-controls">
              {schedulingMode === 'cron' ? (
                // Cron expression input
                <div className="cron-input-section">
                  <div className="cron-input-container">
                    <input
                      type="text"
                      value={cronExpression}
                      onChange={(e) => {
                        setCronExpression(e.target.value);
                        setSchedule(`cron:${e.target.value}`);
                      }}
                      disabled={isCreating}
                      className={`cron-input ${!isValidCronExpression(cronExpression) ? 'invalid' : ''}`}
                      placeholder="0 9 * * 1 (분 시 일 월 요일)"
                    />
                    <div className="cron-validation">
                      {isValidCronExpression(cronExpression) ? (
                        <span className="validation-success">
                          <FontAwesomeIcon icon={faCheck} />
                          {getCronDescription(cronExpression)}
                        </span>
                      ) : (
                        <span className="validation-error">
                          <FontAwesomeIcon icon={faExclamationTriangle} />
                          유효하지 않은 Cron 표현식입니다
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="cron-examples">
                    <label>예시:</label>
                    <div className="cron-example-buttons">
                      <button
                        type="button"
                        onClick={() => setCronExpression('0 9 * * 1')}
                        disabled={isCreating}
                        className="cron-example-btn"
                      >
                        매주 월요일 9시
                      </button>
                      <button
                        type="button"
                        onClick={() => setCronExpression('0 14 1 * *')}
                        disabled={isCreating}
                        className="cron-example-btn"
                      >
                        매월 1일 오후 2시
                      </button>
                      <button
                        type="button"
                        onClick={() => setCronExpression('0 8 * * 1-5')}
                        disabled={isCreating}
                        className="cron-example-btn"
                      >
                        평일 8시
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // Day-time pairs input
                <div className="day-time-pairs">
                  <div className="pairs-header">
                    <label>
                      {schedulingMode === 'date' ? '날짜와 시간 설정:' : 
                       schedulingMode === 'monthly' ? '일자와 시간 설정:' : 
                       '요일과 시간 설정:'}
                    </label>
                    {schedulingMode !== 'date' && (
                      <button
                        type="button"
                        className="add-pair-btn"
                        onClick={addDayTimePair}
                        disabled={isCreating}
                      >
                        <FontAwesomeIcon icon={faPlus} />
                        추가
                      </button>
                    )}
                  </div>
                  
                  <div className="pairs-list">
                    {dayTimePairs.map((pair, index) => (
                      <div key={index} className="day-time-pair">
                        <div className="pair-controls">
                          <div className="day-selector">
                            {schedulingMode === 'monthly' ? (
                              <select
                                value={pair.day}
                                onChange={(e) => updateDayTimePair(index, e.target.value, pair.time)}
                                disabled={isCreating}
                                className="day-select"
                              >
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                  <option key={day} value={day.toString()}>
                                    {day}일
                                  </option>
                                ))}
                              </select>
                            ) : schedulingMode === 'date' ? (
                              <div className="date-input-container">
                                <input
                                  type="date"
                                  value={pair.day}
                                  onChange={(e) => updateDayTimePair(index, e.target.value, pair.time)}
                                  disabled={isCreating}
                                  className={`date-input ${!isValidDate(`${pair.day}T${pair.time}:00`) ? 'invalid' : ''}`}
                                  min={new Date().toISOString().split('T')[0]}
                                />
                                {!isValidDate(`${pair.day}T${pair.time}:00`) && pair.day && (
                                  <span className="date-validation-error">
                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                    과거 날짜는 선택할 수 없습니다
                                  </span>
                                )}
                              </div>
                            ) : (
                              <select
                                value={pair.day}
                                onChange={(e) => updateDayTimePair(index, e.target.value, pair.time)}
                                disabled={isCreating}
                                className="day-select"
                              >
                                <option value="1">월요일</option>
                                <option value="2">화요일</option>
                                <option value="3">수요일</option>
                                <option value="4">목요일</option>
                                <option value="5">금요일</option>
                                <option value="6">토요일</option>
                                <option value="0">일요일</option>
                              </select>
                            )}
                          </div>
                          
                          <div className="time-selector">
                            <input
                              type="time"
                              value={pair.time}
                              onChange={(e) => updateDayTimePair(index, pair.day, e.target.value)}
                              disabled={isCreating}
                              className="time-input"
                            />
                          </div>
                          
                          {((dayTimePairs.length > 1 && schedulingMode !== 'date') || 
                            (schedulingMode === 'date' && index > 0)) && (
                            <button
                              type="button"
                              className="remove-pair-btn"
                              onClick={() => removeDayTimePair(index)}
                              disabled={isCreating}
                              title="삭제"
                            >
                              <FontAwesomeIcon icon={faTimes} />
                            </button>
                          )}
                        </div>
                        
                        {schedulingMode === 'monthly' && parseInt(pair.day) > 28 && (
                          <div className="month-day-warning">
                            <FontAwesomeIcon icon={faExclamationTriangle} />
                            <small>
                              {parseInt(pair.day) === 29 && "2월에는 윤년에만 실행됩니다"}
                              {parseInt(pair.day) === 30 && "2월에는 실행되지 않습니다"}
                              {parseInt(pair.day) === 31 && "2월, 4월, 6월, 9월, 11월에는 실행되지 않습니다"}
                            </small>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <small className="form-help">
              {schedulingMode === 'weekly' && '각 요일마다 다른 시간을 설정할 수 있습니다.'}
              {schedulingMode === 'monthly' && '매월 지정된 날짜에 실행됩니다. 29일 이상은 해당 날짜가 없는 달에는 실행되지 않습니다.'}
              {schedulingMode === 'date' && '특정 날짜와 시간에 한 번만 실행됩니다. 과거 날짜는 선택할 수 없습니다.'}
              {schedulingMode === 'cron' && '고급 Cron 표현식을 사용하여 복잡한 스케줄을 설정할 수 있습니다. 형식: 분 시 일 월 요일'}
              {schedulingMode !== 'date' && schedulingMode !== 'cron' && ' 여러 개의 스케줄을 추가하려면 "추가" 버튼을 클릭하세요.'}
            </small>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="blog-scheduler-button blog-scheduler-button-primary blog-scheduler-button-large"
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
              AI Keys Manager에서 API 키를 추가해주세요.
            </div>
          )}

          {!selectedKey && activeKeys.length > 0 && (
            <div className="form-warning">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              AI API 키를 선택해주세요.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default WordPressPostScheduler;
