import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faClock,
  faGlobe,
  faEdit,
  faTrash,
  faPlay,
  faStop,
  faCheck,
  faTimes,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import SchedulerService, {
  CreateTaskData,
} from '../../services/schedulerService';
import { WordPressSite } from '../../../main/preload';
import './WordPressPostScheduler.css';

interface WordPressPostSchedulerProps {
  sites: WordPressSite[];
  selectedSite?: WordPressSite | null;
  onTaskCreated?: () => void;
}

interface PostTemplate {
  id: string;
  name: string;
  title: string;
  content: string;
  status: 'draft' | 'publish' | 'private';
  categories: string[];
  tags: string[];
}

const WordPressPostScheduler: React.FC<WordPressPostSchedulerProps> = ({
  sites,
  selectedSite: propSelectedSite,
  onTaskCreated,
}) => {
  const [selectedSite, setSelectedSite] = useState<WordPressSite | null>(propSelectedSite || null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFrequencies, setSelectedFrequencies] = useState<Record<string, string>>(() => {
    // Load saved frequencies from localStorage
    try {
      const saved = localStorage.getItem('wordpress-template-schedules');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.error('Failed to load saved template schedules:', error);
      return {};
    }
  });
  const [deletingTemplate, setDeletingTemplate] = useState<string | null>(null);
  const [clearingTemplates, setClearingTemplates] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const schedulerService = SchedulerService.getInstance();

  // Function to save selected frequencies to localStorage
  const saveSelectedFrequencies = (frequencies: Record<string, string>) => {
    try {
      localStorage.setItem('wordpress-template-schedules', JSON.stringify(frequencies));
    } catch (error) {
      console.error('Failed to save template schedules:', error);
    }
  };

  // Function to find existing task for a template and site
  const findExistingTask = async (templateId: string, siteId: string) => {
    try {
      // Find the template to get its name
      const template = postTemplates.find(t => t.id === templateId);
      if (!template) {
        return null;
      }
      
      const allTasks = await schedulerService.getAllTasks();
      
      if (allTasks.success && allTasks.data) {
        // Look for tasks that match the template name and site pattern
        const matchingTasks = allTasks.data.filter(task => {
          const matchesTemplate = task.name.includes(template.name);
          // Find the site to get its name/URL for matching
          const site = sites.find(s => s.id === siteId);
          const siteIdentifier = site ? (site.name || site.url) : siteId;
          const matchesSite = task.name.includes(siteIdentifier);
          const matchesCommand = task.command.includes('wp-json/wp/v2/posts');
          
          return matchesTemplate && matchesSite && matchesCommand;
        });
        
        return matchingTasks[0] || null;
      }
    } catch (error) {
      console.error('Failed to find existing task:', error);
    }
    return null;
  };

  // Update selectedSite when prop changes
  useEffect(() => {
    setSelectedSite(propSelectedSite || null);
  }, [propSelectedSite]);


  // Derive a default template from the site's saved blog settings (category/topic/keywords/audience)
  const defaultCategory = (selectedSite as any)?.blog_category as string | undefined;
  const defaultTopic = (selectedSite as any)?.blog_topic as string | undefined;
  const defaultKeywords = ((selectedSite as any)?.blog_keywords as string[] | undefined) || [];
  const defaultAudience = (selectedSite as any)?.blog_audience as string | undefined;

  const defaultTemplate: PostTemplate | null = defaultTopic
    ? {
        id: 'bw_auto',
        name: 'Default',
        title: defaultTopic,
        content: [
          defaultCategory ? `Category: ${defaultCategory}` : undefined,
          defaultAudience ? `Audience: ${defaultAudience}` : undefined,
          defaultKeywords.length ? `Keywords: ${defaultKeywords.join(', ')}` : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
        status: 'publish',
        categories: defaultCategory ? [defaultCategory] : [],
        tags: defaultKeywords,
      }
    : null;
  // Pull any saved templates from the site (created via BlogWriter)
  const savedTemplatesRaw = ((selectedSite as any)?.blog_templates || []) as Array<{
    id: string;
    name: string;
    title: string;
    content: string;
    status?: 'draft' | 'publish' | 'private';
  }>;

  // Debug logging
  console.log('WordPressPostScheduler - selectedSite:', selectedSite);
  console.log('WordPressPostScheduler - savedTemplatesRaw:', savedTemplatesRaw);

  const savedTemplates: PostTemplate[] = savedTemplatesRaw
    .filter((t) => t.id !== 'bw_auto') // Filter out any saved templates with conflicting ID
    .map((t) => ({
      id: t.id,
      name: t.name,
      title: t.title,
      content: t.content,
      status: (t.status as any) || 'publish',
      categories: defaultCategory ? [defaultCategory] : [],
      tags: defaultKeywords,
    }));

  console.log('WordPressPostScheduler - savedTemplates:', savedTemplates);

  // Built-in default templates to show even when no site templates exist
  const builtinTemplates: PostTemplate[] = [
    {
      id: 'bw_weekly_update',
      name: '주간 업데이트',
      title: '주간 업데이트: 주요 하이라이트와 인사이트',
      content:
        '이번 주 진행 상황, 주요 지표, 향후 우선순위에 대한 요약.\n\n섹션:\n- 하이라이트\n- 도전과제\n- 지표\n- 다음 주 포커스',
      status: 'publish',
      categories: defaultCategory ? [defaultCategory] : ['업데이트'],
      tags: defaultKeywords.length > 0 ? defaultKeywords : ['주간업데이트', '진행상황', '하이라이트', '지표'],
    },
    {
      id: 'bw_how_to',
      name: '가이드',
      title: '[무엇을] [몇 단계]로 하는 방법',
      content:
        '소개: 독자가 달성할 수 있는 것.\n\n단계:\n1) 사전 준비사항\n2) 단계별 지침\n3) 자주 발생하는 문제점\n4) 요약 및 다음 단계',
      status: 'publish',
      categories: defaultCategory ? [defaultCategory] : ['가이드'],
      tags: defaultKeywords.length > 0 ? defaultKeywords : ['가이드', '튜토리얼', '방법', '단계별'],
    },
    {
      id: 'bw_listicle',
      name: 'TOP 10 리스트',
      title: '[대상/목표]를 위한 TOP 10 [도구/전략/팁]',
      content:
        '선택 기준을 설명하는 간단한 소개.\n\n리스트:\n1) 항목\n2) 항목\n3) 항목\n...\n10) 항목\n\n행동 유도와 함께하는 결론.',
      status: 'publish',
      categories: defaultCategory ? [defaultCategory] : ['리스트'],
      tags: defaultKeywords.length > 0 ? defaultKeywords : ['TOP10', '리스트', '추천', '도구'],
    },
    {
      id: 'bw_announcement',
      name: '제품 공지',
      title: '공지: [기능/제품] – 새로운 점과 중요한 이유',
      content:
        '출시 개요, 주요 혜택, 시작하는 방법, 문서/지원 링크.',
      status: 'publish',
      categories: defaultCategory ? [defaultCategory] : ['공지'],
      tags: defaultKeywords.length > 0 ? defaultKeywords : ['공지', '출시', '신기능', '업데이트'],
    },
    {
      id: 'bw_case_study',
      name: '사례 연구',
      title: '이커머스 스타트업 사례: 6개월 만에 매출 300% 성장 달성',
      content:
        '배경: 낮은 전환율과 높은 장바구니 이탈률로 어려움을 겪던 소규모 이커머스 스타트업\n\n도전과제: 전환율 1.2%, 장바구니 이탈률 70%, 제한된 마케팅 예산\n\n해결방안: 개인화 상품 추천 시스템 도입, 체크아웃 프로세스 개선, 이메일 리마케팅 캠페인 실행\n\n결과: 매출 300% 증가, 전환율 2.8% 달성, 장바구니 이탈률 45% 감소\n\n교훈: 개인화와 사용자 경험 최적화가 성장의 핵심 동력\n\n행동 유도: 무료 전환율 최적화 체크리스트 다운로드',
      status: 'publish',
      categories: defaultCategory ? [defaultCategory] : ['사례연구'],
      tags: defaultKeywords.length > 0 ? defaultKeywords : ['사례연구', '이커머스', '성장', '전환율', '마케팅'],
    },
  ];

  // Ensure all template IDs are unique by adding a suffix if needed
  const ensureUniqueIds = (templates: PostTemplate[]): PostTemplate[] => {
    const seenIds = new Set<string>();
    return templates.map((template) => {
      let uniqueId = template.id;
      let counter = 1;
      while (seenIds.has(uniqueId)) {
        uniqueId = `${template.id}_${counter}`;
        counter++;
      }
      seenIds.add(uniqueId);
      return { ...template, id: uniqueId };
    });
  };

  const postTemplates: PostTemplate[] = ensureUniqueIds([
    ...(defaultTemplate ? [defaultTemplate] : []),
    ...savedTemplates,
    ...builtinTemplates,
  ]);

  // Load existing task schedules when component mounts or selectedSite changes
  useEffect(() => {
    const loadExistingSchedules = async () => {
      if (!selectedSite?.id) return;
      
      try {
        const allTasks = await schedulerService.getAllTasks();
        if (allTasks.success && allTasks.data) {
          const newFrequencies = { ...selectedFrequencies };
          
          // Find tasks for this site and extract their schedules
          allTasks.data.forEach(task => {
            if (task.command.includes('wp-json/wp/v2/posts') && 
                task.name.includes(selectedSite.id!) &&
                task.enabled) {
              // Extract template ID from task name
              const match = task.name.match(/WordPress Post: (.+?) -/);
              if (match) {
                const templateName = match[1];
                // Find the template by name
                const template = postTemplates.find(t => t.name === templateName);
                if (template) {
                  newFrequencies[template.id] = task.schedule;
                }
              }
            }
          });
          
          // Only update if there are changes
          const hasChanges = Object.keys(newFrequencies).some(
            key => newFrequencies[key] !== selectedFrequencies[key]
          );
          
          if (hasChanges) {
            setSelectedFrequencies(newFrequencies);
            saveSelectedFrequencies(newFrequencies);
          }
        }
      } catch (error) {
        console.error('Failed to load existing schedules:', error);
      }
    };

    loadExistingSchedules();
  }, [selectedSite?.id, postTemplates]);

  const createWordPressPostTask = async (
    template: PostTemplate,
    schedule: string,
  ) => {
    if (!selectedSite) {
      setError('Please select a WordPress site first');
      return;
    }

    // Validate WordPress credentials
    if (!selectedSite.username || !selectedSite.password) {
      setError(
        'WordPress credentials (사용자명 and 비밀번호) are required. Please check your WordPress connection settings.',
      );
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      // Check if there's an existing task for this template and site
      const existingTask = await findExistingTask(template.id, selectedSite.id!);
      
      // Create the WordPress REST API endpoint URL
      const baseUrl = selectedSite.url.replace(/\/$/, ''); // Remove trailing slash
      const endpoint = `${baseUrl}/wp-json/wp/v2/posts`;

      // Create the JSON payload for the POST request
      // Note: categories and tags require integer IDs, not string names
      // For now, we'll create posts without categories/tags to avoid API errors

      // Add timestamp and unique identifier to ensure each post is unique
      const now = new Date();
      const timestamp = now.toISOString();
      const uniqueId = `${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create content with raw category and keywords data
      const rawDataContent = [
        `# ${template.title}`,
        '',
        '## 카테고리',
        template.categories.length > 0 ? template.categories.join(', ') : '카테고리 없음',
        '',
        '## 키워드',
        template.tags.length > 0 ? template.tags.join(', ') : '키워드 없음',
        '',
        '## 추가 정보',
        template.content || '추가 정보 없음',
        '',
        '---',
        `*자동 게시됨: ${timestamp} (고유 ID: ${uniqueId})*`
      ].join('\n');

      const payload = {
        title: template.title,
        content: rawDataContent,
        status: template.status,
        // categories: template.categories, // Requires category IDs from WordPress API
        // tags: template.tags // Requires tag IDs from WordPress API
      };

      // Create the curl command for the POST request with proper authentication
      const auth = btoa(`${selectedSite.username}:${selectedSite.password}`);
      const command = `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Basic ${auth}" \\
  -d '${JSON.stringify(payload, null, 2)}'`;

      const taskData: CreateTaskData = {
        name: `WordPress Post: ${template.name} - ${selectedSite.name || selectedSite.url}`,
        description: `자동으로 "${template.name}" 게시물을 ${selectedSite.url}에 게시합니다. 카테고리와 키워드 데이터를 포함한 원시 데이터를 게시합니다. (사용자명: ${selectedSite.username})`,
        command,
        schedule,
        enabled: true,
        workingDirectory: '',
        environment: {},
        outputFile: '',
        errorFile: '',
      };

      let response;
      if (existingTask) {
        // Update existing task
        response = await schedulerService.updateTask(existingTask.id, {
          schedule: taskData.schedule,
          command: taskData.command,
          description: taskData.description,
          enabled: true
        });
      } else {
        // Create new task
        response = await schedulerService.createTask(taskData);
      }

      if (response.success) {
        const action = existingTask ? '업데이트' : '생성';
        setSuccess(
          `작업이 성공적으로 ${action}되었습니다! "${template.name}" 게시물이 ${selectedSite.name || selectedSite.url}에 카테고리와 키워드 데이터와 함께 게시됩니다. (사용자명: ${selectedSite.username})`,
        );
        setShowCreateModal(false);
        onTaskCreated?.();
      } else {
        setError(response.error || `WordPress 게시물 작업 ${existingTask ? '업데이트' : '생성'}에 실패했습니다.`);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'WordPress 게시물 작업 생성에 실패했습니다.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const createDemoPostTask = async () => {
    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const url = 'https://demo-chatbot-iota.vercel.app/';
      const command = `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello from scheduled task!", "timestamp": "$(date)"}'`;

      const taskData: CreateTaskData = {
        name: 'Demo POST Request to Chatbot',
        description: `Sends a POST request to ${url} every 5 minutes`,
        command,
        schedule: 'interval:300000', // 5 minutes
        enabled: true,
        workingDirectory: '',
        environment: {},
        outputFile: '',
        errorFile: '',
      };

      const response = await schedulerService.createTask(taskData);

      if (response.success) {
        setSuccess(
          `Demo POST task created successfully! It will send requests to ${url} every 5 minutes.`,
        );
        onTaskCreated?.();
      } else {
        setError(response.error || 'Failed to create demo POST task');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create demo POST task',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const createCustomPostTask = async (formData: {
    title: string;
    content: string;
    status: string;
    categories: string;
    tags: string;
    schedule: string;
  }) => {
    if (!selectedSite) {
      setError('Please select a WordPress site first');
      return;
    }

    // Validate WordPress credentials
    if (!selectedSite.username || !selectedSite.password) {
      setError(
        'WordPress credentials (사용자명 and 비밀번호) are required. Please check your WordPress connection settings.',
      );
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const baseUrl = selectedSite.url.replace(/\/$/, '');
      const endpoint = `${baseUrl}/wp-json/wp/v2/posts`;

      // Add timestamp and unique identifier to ensure each post is unique
      const now = new Date();
      const timestamp = now.toISOString();
      const uniqueId = `${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`;

      const payload = {
        title: `${formData.title} - ${now.toLocaleString()}`,
        content: `${formData.content}\n\n---\n*Posted automatically on ${timestamp} (Unique ID: ${uniqueId})*`,
        status: formData.status,
        // Note: categories and tags require integer IDs from WordPress API
        // categories: formData.categories.split(',').map(c => c.trim()).filter(c => c),
        // tags: formData.tags.split(',').map(t => t.trim()).filter(t => t)
      };

      // Create the curl command for the POST request with proper authentication
      const auth = btoa(`${selectedSite.username}:${selectedSite.password}`);
      const command = `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Basic ${auth}" \\
  -d '${JSON.stringify(payload, null, 2)}'`;

      const taskData: CreateTaskData = {
        name: `WordPress Post: ${formData.title} - ${selectedSite.name || selectedSite.url}`,
        description: `Custom post to ${selectedSite.url} using WordPress REST API (사용자명: ${selectedSite.username})`,
        command,
        schedule: formData.schedule,
        enabled: true,
        workingDirectory: '',
        environment: {},
        outputFile: '',
        errorFile: '',
      };

      const response = await schedulerService.createTask(taskData);

      if (response.success) {
        setSuccess(
          `Custom post task created successfully! Will post to ${selectedSite.name || selectedSite.url} using 사용자명: ${selectedSite.username}`,
        );
        setShowCreateModal(false);
        onTaskCreated?.();
        // Clear form data after successful creation
        localStorage.removeItem('wordpress-scheduler-form-data');
      } else {
        setError(response.error || 'Failed to create custom post task');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create custom post task',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!selectedSite?.id) {
      setError('사이트를 선택해주세요');
      return;
    }

    setDeletingTemplate(templateId);
    setError(null);
    setSuccess(null);

    try {
      const currentTemplates = (selectedSite as any)?.blog_templates || [];
      const updatedTemplates = currentTemplates.filter((t: any) => t.id !== templateId);
      
      await window.electron.wordpress.updateConnection(
        selectedSite.id,
        { blog_templates: updatedTemplates },
      );
      
      // Update local state immediately
      setSelectedSite((prev: WordPressSite | null) => prev ? {
        ...prev,
        blog_templates: updatedTemplates
      } : null);
      
      // Remove the schedule for this template from localStorage
      const newFrequencies = { ...selectedFrequencies };
      delete newFrequencies[templateId];
      setSelectedFrequencies(newFrequencies);
      saveSelectedFrequencies(newFrequencies);
      
      // Delete any associated scheduled task
      if (selectedSite?.id) {
        try {
          const existingTask = await findExistingTask(templateId, selectedSite.id);
          if (existingTask) {
            await schedulerService.deleteTask(existingTask.id);
          }
        } catch (error) {
          console.error('Failed to delete associated task:', error);
        }
      }
      
      // Force component refresh
      setRefreshKey(prev => prev + 1);
      
      setSuccess('템플릿이 성공적으로 삭제되었습니다');
      
      // Refresh the connections to update the UI
      if (onTaskCreated) {
        onTaskCreated();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '템플릿 삭제에 실패했습니다.',
      );
    } finally {
      setDeletingTemplate(null);
    }
  };

  const clearAllTemplates = async () => {
    if (sites.length === 0) {
      setError('삭제할 사이트가 없습니다');
      return;
    }

    setClearingTemplates(true);
    setError(null);
    setSuccess(null);

    try {
      let clearedCount = 0;
      const errors: string[] = [];

      for (const site of sites) {
        try {
          await window.electron.wordpress.updateConnection(
            site.id,
            { blog_templates: [] },
          );
          clearedCount++;
        } catch (err) {
          errors.push(`${site.name || site.url}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      if (errors.length > 0) {
        setError(`일부 사이트에서 오류가 발생했습니다: ${errors.join(', ')}`);
      }

      if (clearedCount > 0) {
        // Update local state for the currently selected site
        if (selectedSite) {
          setSelectedSite((prev: WordPressSite | null) => prev ? {
            ...prev,
            blog_templates: []
          } : null);
        }
        
        // Clear all saved schedules
        setSelectedFrequencies({});
        saveSelectedFrequencies({});
        
        // Force component refresh
        setRefreshKey(prev => prev + 1);
        
        setSuccess(`${clearedCount}개 사이트의 모든 템플릿이 삭제되었습니다`);
        
        // Refresh the connections to update the UI
        if (onTaskCreated) {
          onTaskCreated();
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '템플릿 삭제에 실패했습니다.',
      );
    } finally {
      setClearingTemplates(false);
    }
  };

  const getScheduleOptions = () => [
    { value: '', label: 'Never (스케줄 없음)' },
    { value: 'interval:300000', label: '5분마다' },
    { value: 'interval:1800000', label: '30분마다' },
    { value: 'interval:3600000', label: '1시간마다' },
    { value: 'interval:86400000', label: '매일' },
    { value: 'interval:604800000', label: '매주' },
    { value: 'cron:0 9 * * 1-5', label: '평일 오전 9시' },
    { value: 'cron:0 0 * * 0', label: '일요일 자정' },
  ];

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
          <FontAwesomeIcon icon={faClock} />
          WordPress 게시물 스케줄러
        </h3>
        <div className="header-actions">
          <button
            className="btn btn-warning"
            onClick={clearAllTemplates}
            disabled={clearingTemplates || sites.length === 0}
            title="모든 사이트의 사용자 생성 템플릿을 삭제합니다"
          >
            {clearingTemplates ? (
              <FontAwesomeIcon icon={faClock} className="spinning" />
            ) : (
              <FontAwesomeIcon icon={faTrash} />
            )}
            {clearingTemplates ? '템플릿 삭제 중...' : '모든 템플릿 삭제'}
          </button>
          <button
            className="btn btn-success"
            onClick={createDemoPostTask}
            disabled={isCreating}
          >
            <FontAwesomeIcon icon={faPlay} />
            데모 POST (5분)
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedSite || !selectedSite.password}
            title={
              !selectedSite
                ? '먼저 WordPress 사이트를 선택해주세요'
                : !selectedSite.password
                  ? 'WordPress 비밀번호가 필요합니다'
                  : '사용자 정의 게시물 작업 생성'
            }
          >
            <FontAwesomeIcon icon={faPlus} />
            사용자 정의 게시물 생성
          </button>
        </div>
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

      <div className="templates-section">
        <h4>빠른 템플릿 (미리 만들어진 템플릿 사용)</h4>
        <p className="section-description">
          아래 템플릿을 선택하여 빠르게 게시물을 생성할 수 있습니다. 
          <strong>사용자 정의 내용을 사용하려면 아래 "사용자 정의 게시물 생성" 버튼을 사용하세요.</strong>
        </p>
        <div className="templates-grid" key={refreshKey}>
          {postTemplates.map((template) => (
            <div key={template.id} className="template-card">
              <h5>{template.name}</h5>
              <p className="template-title">제목: {template.title}</p>
              <p className="template-content">{template.content}</p>
              <div className="template-meta">
                <span className={`status status-${template.status}`}>
                  {template.status === 'draft' ? '초안' : template.status === 'publish' ? '게시' : '비공개'}
                </span>
                <span className="note">
                  참고: 카테고리와 태그가 포함되어 있습니다 (WordPress API 통합 필요)
                </span>
              </div>
              <div className="template-actions">
                <select
                  className="schedule-select"
                  value={selectedFrequencies[template.id] || ''}
                  onChange={async (e) => {
                    const selectedValue = e.target.value;
                    // Update the selected frequency state (including empty value for "Never")
                    const newFrequencies = {
                      ...selectedFrequencies,
                      [template.id]: selectedValue
                    };
                    setSelectedFrequencies(newFrequencies);
                    // Save to localStorage
                    saveSelectedFrequencies(newFrequencies);
                    
                    if (selectedValue) {
                      // Create or update task with the selected schedule
                      createWordPressPostTask(template, selectedValue);
                    } else {
                      // Handle "Never" selection - delete existing task if it exists
                      if (selectedSite?.id) {
                        try {
                          // Debug: Log what we're looking for
                          console.log('Looking for task with template:', template.name, 'site:', selectedSite.name || selectedSite.url);
                          
                          const existingTask = await findExistingTask(template.id, selectedSite.id);
                          
                          if (existingTask) {
                            console.log('Found existing task to delete:', existingTask.name);
                            const deleteResponse = await schedulerService.deleteTask(existingTask.id);
                            
                            if (deleteResponse.success) {
                              setSuccess(`"${template.name}" 템플릿의 스케줄된 작업이 삭제되었습니다.`);
                            } else {
                              setError(`작업 삭제에 실패했습니다: ${deleteResponse.error}`);
                            }
                          } else {
                            console.log('No existing task found for template:', template.name);
                            setSuccess(`"${template.name}" 템플릿이 스케줄 없음으로 설정되었습니다.`);
                          }
                        } catch (error) {
                          console.error('Error in Never selection handler:', error);
                          setError(`작업 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                      } else {
                        setSuccess(`"${template.name}" 템플릿이 스케줄 없음으로 설정되었습니다.`);
                      }
                    }
                  }}
                  disabled={
                    isCreating || !selectedSite
                  }
                  title={
                    !selectedSite
                      ? '먼저 WordPress 사이트를 선택해주세요'
                      : '이 템플릿의 스케줄을 선택하세요 (스케줄 없음 선택 가능)'
                  }
                >
                  {getScheduleOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {/* Show delete button only for saved templates (not built-in ones) */}
                {!template.id.startsWith('bw_') && (
                  <button
                    className="btn btn-danger btn-sm delete-template-btn"
                    onClick={() => deleteTemplate(template.id)}
                    disabled={deletingTemplate === template.id || !selectedSite}
                    title="템플릿 삭제"
                  >
                    {deletingTemplate === template.id ? (
                      <FontAwesomeIcon icon={faClock} className="spinning" />
                    ) : (
                      <FontAwesomeIcon icon={faTrash} />
                    )}
                    {deletingTemplate === template.id ? '삭제 중...' : '삭제'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Post Creation Modal */}
      {showCreateModal && (
        <CustomPostModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={createCustomPostTask}
          isSubmitting={isCreating}
        />
      )}
    </div>
  );
};

interface CustomPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}

const CustomPostModal: React.FC<CustomPostModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  // Load saved form data from localStorage
  const loadFormData = () => {
    try {
      const saved = localStorage.getItem('wordpress-scheduler-form-data');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load form data:', error);
    }
    return {
      title: '',
      content: '',
      status: 'publish',
      categories: '',
      tags: '',
      schedule: 'interval:3600000', // 1 hour default
    };
  };

  const [formData, setFormData] = useState(loadFormData);

  // Save form data to localStorage
  const saveFormData = (data: typeof formData) => {
    try {
      localStorage.setItem('wordpress-scheduler-form-data', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save form data:', error);
    }
  };

  // Update form data and save to localStorage
  const updateFormData = (updates: Partial<typeof formData>) => {
    const newData = { ...formData, ...updates };
    setFormData(newData);
    saveFormData(newData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Clear form data after successful submission
  const clearFormData = () => {
    const defaultData = {
      title: '',
      content: '',
      status: 'publish',
      categories: '',
      tags: '',
      schedule: 'interval:3600000',
    };
    setFormData(defaultData);
    saveFormData(defaultData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal custom-post-modal">
        <div className="modal-header">
          <h3>사용자 정의 게시물 작업 생성</h3>
          <button className="close-button" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="custom-post-form">
          <div className="form-group">
            <label htmlFor="title">게시물 제목 *</label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => updateFormData({ title: e.target.value })}
              placeholder="게시물 제목을 입력하세요"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">게시물 내용 *</label>
            <textarea
              id="content"
              value={formData.content}
              onChange={(e) => updateFormData({ content: e.target.value })}
              placeholder="게시물 내용을 입력하세요"
              rows={4}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">게시물 상태</label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => updateFormData({ status: e.target.value })}
            >
              <option value="draft">초안</option>
              <option value="publish">게시</option>
              <option value="private">비공개</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="categories">카테고리 (쉼표로 구분)</label>
            <input
              id="categories"
              type="text"
              value={formData.categories}
              onChange={(e) => updateFormData({ categories: e.target.value })}
              placeholder="예: 뉴스, 업데이트, 보고서"
            />
          </div>

          <div className="form-group">
            <label htmlFor="tags">태그 (쉼표로 구분)</label>
            <input
              id="tags"
              type="text"
              value={formData.tags}
              onChange={(e) => updateFormData({ tags: e.target.value })}
              placeholder="예: 자동화, 일일, 상태"
            />
          </div>

          <div className="form-group">
            <label htmlFor="schedule">스케줄</label>
            <select
              id="schedule"
              value={formData.schedule}
              onChange={(e) => updateFormData({ schedule: e.target.value })}
            >
              <option value="interval:300000">5분마다</option>
              <option value="interval:1800000">30분마다</option>
              <option value="interval:3600000">1시간마다</option>
              <option value="interval:86400000">매일</option>
              <option value="interval:604800000">매주</option>
              <option value="cron:0 9 * * 1-5">평일 오전 9시</option>
              <option value="cron:0 0 * * 0">일요일 자정</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <FontAwesomeIcon icon={faClock} className="spinning" />
                  생성 중...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheck} />
                  작업 생성
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WordPressPostScheduler;
