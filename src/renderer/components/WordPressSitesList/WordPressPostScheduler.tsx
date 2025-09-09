import React, { useState, useEffect, useMemo } from 'react';
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
  faRobot,
  faCog,
  faBug,
  faImage,
  faUpload,
  faFileEdit,
  faFileAlt,
} from '@fortawesome/free-solid-svg-icons';
import SchedulerService, {
  CreateTaskData,
} from '../../services/schedulerService';
import { WordPressConnection } from '../../../main/preload';
import BlogAIService, { BlogContentRequest, GeneratedBlogContent } from '../../services/blogAIService';
import { BlogImageGenerator, BlogImageRequest, GeneratedImage } from '../../services/blogImageGenerator';
import WordPressMediaService from '../../services/wordpressMediaService';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import { AIKey } from '../AIKeysManager/types';
import { CHAT_PROVIDERS, ModelInfo } from '../ChatInterface/types';
import './WordPressPostScheduler.css';

interface WordPressPostSchedulerProps {
  sites: WordPressConnection[];
  selectedSite?: WordPressConnection | null;
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
  aiSettings: {
    model: string;
    keyId: string;
  };
  imageSettings?: {
    enabled: boolean;
    provider: 'dalle' | 'placeholder' | 'stability' | 'midjourney';
    quality: 'standard' | 'hd';
    size: string;
    style: 'realistic' | 'illustration' | 'minimalist' | 'artistic' | 'photographic';
    aspectRatio: 'square' | 'landscape' | 'portrait' | 'wide';
    openaiKeyId?: string; // Separate key for DALL-E image generation
  };
}

const WordPressPostScheduler: React.FC<WordPressPostSchedulerProps> = ({
  sites,
  selectedSite: propSelectedSite,
  onTaskCreated,
}) => {
  const [selectedSite, setSelectedSite] = useState<WordPressConnection | null>(propSelectedSite || null);
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
  
  // Debug workflow state
  const [debugStep, setDebugStep] = useState<number>(0);
  const [debugStatus, setDebugStatus] = useState<string>('');
  const [debugResults, setDebugResults] = useState<{
    generatedContent?: GeneratedBlogContent;
    generatedImages?: GeneratedImage[];
    uploadedMedia?: any[];
    processedContent?: string;
    createdPost?: any;
  }>({});
  const [isDebugRunning, setIsDebugRunning] = useState(false);

  // AI Configuration state
  const [activeKeys, setActiveKeys] = useState<AIKey[]>([]);
  const [isGeneratingContent, setIsGeneratingContent] = useState<boolean>(false);
  const [savingAISettings, setSavingAISettings] = useState<string | null>(null);

  const schedulerService = SchedulerService.getInstance();
  const blogAIService = BlogAIService.getInstance();

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

  // Load AI keys and configuration
  useEffect(() => {
    const unsub = aiKeysStore.subscribe((state) => {
      setActiveKeys(state.keys.filter((k) => k.isActive));
    });
    return () => unsub();
  }, []);

  // Available AI models
  const availableModels: ModelInfo[] = React.useMemo(() => {
    return CHAT_PROVIDERS.flatMap((provider) => provider.models);
  }, []);


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
        aiSettings: {
          model: availableModels[0]?.id || 'gpt-3.5-turbo',
          keyId: activeKeys[0]?.id || ''
        },
        imageSettings: {
          enabled: false, // Disable image generation by default to avoid memory issues
          provider: 'placeholder',
          quality: 'standard',
          size: '400x300',
          style: 'realistic',
          aspectRatio: 'landscape'
        }
      }
    : null;
  // Pull any saved templates from the site (created via BlogWriter)
  const savedTemplatesRaw = ((selectedSite as any)?.blog_templates || []) as Array<{
    id: string;
    name: string;
    title: string;
    content: string;
    status?: 'draft' | 'publish' | 'private';
    aiSettings?: {
      model: string;
      keyId: string;
    };
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
      // Preserve existing aiSettings if they exist, otherwise use defaults
      aiSettings: (t as any).aiSettings || {
        model: availableModels[0]?.id || 'gpt-3.5-turbo',
        keyId: activeKeys[0]?.id || ''
      },
      // Add default image settings
      imageSettings: (t as any).imageSettings || {
        enabled: false, // Disable image generation by default to avoid memory issues
        provider: 'placeholder',
        quality: 'standard',
        size: '400x300',
        style: 'realistic',
        aspectRatio: 'landscape'
      }
    }));

  console.log('WordPressPostScheduler - savedTemplates:', savedTemplates);
  console.log('WordPressPostScheduler - availableModels:', availableModels);
  console.log('WordPressPostScheduler - activeKeys:', activeKeys);

  // No built-in default templates - only user-created templates
  const builtinTemplates: PostTemplate[] = useMemo(() => [], []);

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

  // Merge saved templates with built-in templates, prioritizing saved versions
  const mergedTemplates = [...builtinTemplates];
  
  // Replace built-in templates with saved versions if they exist
  savedTemplates.forEach(savedTemplate => {
    const builtinIndex = mergedTemplates.findIndex(t => t.id === savedTemplate.id);
    if (builtinIndex >= 0) {
      // Replace built-in with saved version, preserving ALL saved data including AI settings
      mergedTemplates[builtinIndex] = savedTemplate;
    } else {
      // Add new saved template
      mergedTemplates.push(savedTemplate);
    }
  });

  // Only add default AI settings to templates that don't have them or have empty values
  mergedTemplates.forEach(template => {
    if (!template.aiSettings || !template.aiSettings.model || !template.aiSettings.keyId) {
      template.aiSettings = {
        model: template.aiSettings?.model || availableModels[0]?.id || 'gpt-3.5-turbo',
        keyId: template.aiSettings?.keyId || activeKeys[0]?.id || ''
      };
    }
  });

  const postTemplates: PostTemplate[] = ensureUniqueIds([
    ...(defaultTemplate ? [defaultTemplate] : []),
    ...mergedTemplates,
  ]);

  // Debug: Log template AI settings
  console.log('Template AI settings after initialization:', 
    postTemplates.map(t => ({ 
      id: t.id, 
      name: t.name, 
      aiSettings: t.aiSettings,
      hasModel: !!t.aiSettings?.model,
      hasKeyId: !!t.aiSettings?.keyId
    }))
  );

  console.log('WordPressPostScheduler - mergedTemplates:', mergedTemplates);
  console.log('WordPressPostScheduler - postTemplates:', postTemplates);
  console.log('WordPressPostScheduler - postTemplates with aiSettings:', postTemplates.map(t => ({ id: t.id, name: t.name, aiSettings: t.aiSettings })));

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

  /**
   * Generate AI content for a template (now handled by dynamic script)
   * This function is kept for backward compatibility but content generation
   * is now handled by the dynamic script that runs for each task execution
   */
  const generateAIContent = async (template: PostTemplate): Promise<GeneratedBlogContent | null> => {
    // Content generation is now handled by the dynamic script
    // This function is kept for compatibility but returns null
    // The actual AI generation happens in the script during task execution
    return null;
  };

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

    // Validate AI settings
    if (!template.aiSettings?.keyId || !template.aiSettings?.model) {
      console.error('AI settings validation failed:', {
        templateId: template.id,
        templateName: template.name,
        aiSettings: template.aiSettings,
        availableKeys: activeKeys.length,
        availableModels: availableModels.length
      });
      setError('AI 설정이 필요합니다. 모델과 API 키를 선택해주세요.');
      return;
    }

    const selectedKey = activeKeys.find(key => key.id === template.aiSettings!.keyId);
    if (!selectedKey) {
      console.error('AI key not found:', {
        keyId: template.aiSettings!.keyId,
        availableKeys: activeKeys.map(k => ({ id: k.id, name: k.name, providerId: k.providerId }))
      });
      setError('선택된 AI 키를 찾을 수 없습니다.');
      return;
    }

    // Debug: Log the selected key details
    console.log('Selected AI key:', {
      id: selectedKey.id,
      name: selectedKey.name,
      providerId: selectedKey.providerId,
      fields: selectedKey.fields
    });

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      // Check if there's an existing task for this template and site
      const existingTask = await findExistingTask(template.id, selectedSite.id!);
      
      // Get the script path - use relative path from working directory
      const scriptPath = './scripts/generate-blog-content.js';
      
      // Validate API key exists
      if (!selectedKey.fields.apiKey) {
        console.error('API key not found in selected key fields:', selectedKey.fields);
        setError('AI 키에 API 키가 설정되지 않았습니다.');
        return;
      }

      // Find OpenAI key for image generation if needed
      const openaiKey = template.imageSettings?.enabled && template.imageSettings?.openaiKeyId 
        ? activeKeys.find(key => key.id === template.imageSettings!.openaiKeyId)
        : null;

      // Prepare environment variables for the dynamic script
      const environment = {
        AI_KEY: selectedKey.fields.apiKey,
        AI_MODEL: template.aiSettings.model,
        AI_PROVIDER: selectedKey.providerId,
        TEMPLATE_TYPE: template.id.startsWith('bw_') ? template.id : 'custom',
        TEMPLATE_TITLE: template.title,
        TEMPLATE_CONTENT: template.content,
        TEMPLATE_CATEGORIES: template.categories.join(','),
        TEMPLATE_TAGS: template.tags.join(','),
        TEMPLATE_AUDIENCE: (selectedSite as any)?.blog_audience || '일반 독자',
        TEMPLATE_WORD_LENGTH: (selectedSite as any)?.blog_word_length || '1200-1600 단어',
        TEMPLATE_TONE: (selectedSite as any)?.blog_tone || '친근하고 실용적인',
        WORDPRESS_URL: selectedSite.url,
        WORDPRESS_USERNAME: selectedSite.username,
        WORDPRESS_PASSWORD: selectedSite.password,
        // Image generation settings
        IMAGE_GENERATION_ENABLED: template.imageSettings?.enabled ? 'true' : 'false',
        IMAGE_PROVIDER: template.imageSettings?.provider || 'placeholder',
        IMAGE_QUALITY: template.imageSettings?.quality || 'standard',
        IMAGE_SIZE: template.imageSettings?.size || '400x300',
        IMAGE_STYLE: template.imageSettings?.style || 'realistic',
        IMAGE_ASPECT_RATIO: template.imageSettings?.aspectRatio || 'landscape',
        OPENAI_KEY: openaiKey?.fields.apiKey || '',
      };

      // Debug: Log environment variables (without sensitive data)
      console.log('Environment variables for script:', {
        AI_MODEL: environment.AI_MODEL,
        AI_PROVIDER: environment.AI_PROVIDER,
        TEMPLATE_TYPE: environment.TEMPLATE_TYPE,
        TEMPLATE_TITLE: environment.TEMPLATE_TITLE,
        TEMPLATE_CATEGORIES: environment.TEMPLATE_CATEGORIES,
        TEMPLATE_TAGS: environment.TEMPLATE_TAGS,
        TEMPLATE_AUDIENCE: environment.TEMPLATE_AUDIENCE,
        TEMPLATE_WORD_LENGTH: environment.TEMPLATE_WORD_LENGTH,
        TEMPLATE_TONE: environment.TEMPLATE_TONE,
        WORDPRESS_URL: environment.WORDPRESS_URL,
        WORDPRESS_USERNAME: environment.WORDPRESS_USERNAME,
        AI_KEY_PRESENT: !!environment.AI_KEY,
        WORDPRESS_PASSWORD_PRESENT: !!environment.WORDPRESS_PASSWORD
      });

      // Create the command to run the dynamic script with increased memory limit
      // Use relative path without quotes to avoid Windows cmd.exe issues
      const command = `node --max-old-space-size=4096 ${scriptPath}`;

      const taskData: CreateTaskData = {
        name: `WordPress Post: ${template.name} - ${selectedSite.name || selectedSite.url} (AI 생성)`,
        description: `자동으로 "${template.name}" 게시물을 ${selectedSite.url}에 AI가 매번 새로 생성한 콘텐츠로 게시합니다. (사용자명: ${selectedSite.username})`,
        command,
        schedule,
        enabled: true,
        workingDirectory: '', // Let the scheduler use the default working directory
        environment,
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
          environment: taskData.environment,
          enabled: true
        });
      } else {
        // Create new task
        response = await schedulerService.createTask(taskData);
      }

      if (response.success) {
        const action = existingTask ? '업데이트' : '생성';
        setSuccess(
          `작업이 성공적으로 ${action}되었습니다! "${template.name}" 게시물이 AI가 매번 새로 생성한 콘텐츠와 함께 ${selectedSite.name || selectedSite.url}에 게시됩니다. (사용자명: ${selectedSite.username})`,
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
      setSelectedSite((prev: WordPressConnection | null) => prev ? {
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
          if (site.id) {
            await window.electron.wordpress.updateConnection(
              site.id,
              { blog_templates: [] },
            );
          }
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
          setSelectedSite((prev: WordPressConnection | null) => prev ? {
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

  // Helper function to get or create categories
  const getOrCreateCategories = async (categoryNames: string[], site: WordPressConnection): Promise<number[]> => {
    const categoryIds: number[] = [];
    
    for (const categoryName of categoryNames) {
      try {
        // First, try to find existing category
        const searchResponse = await fetch(
          `${site.url}/wp-json/wp/v2/categories?search=${encodeURIComponent(categoryName)}`,
          {
            headers: {
              'Authorization': `Basic ${btoa(`${site.username}:${site.password}`)}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (searchResponse.ok) {
          const categories = await searchResponse.json();
          const existingCategory = categories.find((cat: any) => 
            cat.name.toLowerCase() === categoryName.toLowerCase()
          );
          
          if (existingCategory) {
            categoryIds.push(existingCategory.id);
            continue;
          }
        }
        
        // Create new category if not found
        const createResponse = await fetch(`${site.url}/wp-json/wp/v2/categories`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${site.username}:${site.password}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: categoryName,
            slug: categoryName.toLowerCase().replace(/\s+/g, '-')
          })
        });
        
        if (createResponse.ok) {
          const newCategory = await createResponse.json();
          categoryIds.push(newCategory.id);
        }
      } catch (error) {
        console.error(`Failed to get/create category "${categoryName}":`, error);
      }
    }
    
    return categoryIds;
  };

  // Helper function to get or create tags
  const getOrCreateTags = async (tagNames: string[], site: WordPressConnection): Promise<number[]> => {
    const tagIds: number[] = [];
    
    for (const tagName of tagNames) {
      try {
        // First, try to find existing tag
        const searchResponse = await fetch(
          `${site.url}/wp-json/wp/v2/tags?search=${encodeURIComponent(tagName)}`,
          {
            headers: {
              'Authorization': `Basic ${btoa(`${site.username}:${site.password}`)}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (searchResponse.ok) {
          const tags = await searchResponse.json();
          const existingTag = tags.find((tag: any) => 
            tag.name.toLowerCase() === tagName.toLowerCase()
          );
          
          if (existingTag) {
            tagIds.push(existingTag.id);
            continue;
          }
        }
        
        // Create new tag if not found
        const createResponse = await fetch(`${site.url}/wp-json/wp/v2/tags`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${site.username}:${site.password}`)}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: tagName,
            slug: tagName.toLowerCase().replace(/\s+/g, '-')
          })
        });
        
        if (createResponse.ok) {
          const newTag = await createResponse.json();
          tagIds.push(newTag.id);
        }
      } catch (error) {
        console.error(`Failed to get/create tag "${tagName}":`, error);
      }
    }
    
    return tagIds;
  };

  // Debug workflow function - hybrid approach (renderer downloads images, main process handles the rest)
  const runSingleImageDebug = async () => {
    if (!selectedSite) {
      setError('WordPress 사이트를 선택해주세요.');
      return;
    }

    if (!selectedSite.password) {
      setError('WordPress 비밀번호가 필요합니다.');
      return;
    }

    setIsDebugRunning(true);
    setDebugStep(0);
    setDebugStatus('');
    setDebugResults({});
    setError(null);

    try {
      console.log('🔍 DEBUG: Starting Single Image Debug Workflow');
      
      // Step 1: Generate single image
      setDebugStep(1);
      setDebugStatus('1. 단일 이미지 생성 중...');
      
      const mediaService = new WordPressMediaService(selectedSite.url, selectedSite.username, selectedSite.password);
      const imageGenerator = new BlogImageGenerator(mediaService, {
        provider: 'dalle',
        quality: 'standard',
        size: '1024x1024'
        // Note: API key is handled internally by the service via aiKeysStore
      });

      const imageRequest: BlogImageRequest = {
        title: 'Single Image Debug Test',
        content: '[IMAGE:A futuristic AI robot writing code on a computer screen, digital art style:featured]',
        excerpt: 'A test image for debugging purposes',
        keywords: ['debug', 'test', 'image'],
        category: 'Debug',
        style: 'realistic',
        aspectRatio: 'landscape'
      };

      console.log('🔍 DEBUG: Single Image Request:', imageRequest);
      console.log('🔍 DEBUG: Image Generator Options:', {
        provider: 'dalle',
        quality: 'standard',
        size: '1024x1024'
      });
      
      console.log('🔍 DEBUG: AI Key Information:', {
        selectedKeyId: activeKeys[0]!.id,
        providerId: activeKeys[0]!.providerId,
        isOpenAI: activeKeys[0]!.providerId === 'openai',
        hasApiKey: !!activeKeys[0]!.fields.apiKey,
        apiKeyLength: activeKeys[0]!.fields.apiKey?.length || 0,
        apiKeyPreview: activeKeys[0]!.fields.apiKey?.substring(0, 10) + '...' || 'NONE',
        allFields: Object.keys(activeKeys[0]!.fields)
      });
      
      if (activeKeys[0]!.providerId !== 'openai') {
        throw new Error(`Selected AI key is not an OpenAI key (provider: ${activeKeys[0]!.providerId}). Please select an OpenAI API key for image generation.`);
      }
      
      console.log('🔍 DEBUG: Calling imageGenerator.generateBlogImagesWithoutUpload...');
      
      let generatedImages;
      try {
        // Generate images without uploading to WordPress (to avoid CORS issues)
        generatedImages = await imageGenerator.generateBlogImagesWithoutUpload(imageRequest);
      } catch (imageError) {
        console.error('🔍 DEBUG: Image generation failed with error:', imageError);
        throw new Error(`Image generation failed: ${imageError instanceof Error ? imageError.message : 'Unknown error'}. Please check your OpenAI API key and configuration.`);
      }

      console.log('🔍 DEBUG: Generated Images Count:', generatedImages.length);
      console.log('🔍 DEBUG: Generated Images Details:', generatedImages.map(img => ({
        id: img.id,
        url: img.url,
        description: img.description,
        isPlaceholder: img.url.includes('via.placeholder.com'),
        isDalle: img.url.includes('oaidalleapiprodscus.blob.core.windows.net')
      })));
      
      if (generatedImages.length === 0) {
        throw new Error('No images were generated! Check your API key and configuration.');
      }

      const image = generatedImages[0];
      console.log('🔍 DEBUG: Using first image:', image);

      // Step 2: Download image via Node.js script (to avoid CORS)
      setDebugStep(2);
      setDebugStatus('2. 이미지 다운로드 중... (Node.js 스크립트 사용)');
      
      console.log('🔍 DEBUG: Downloading image via Node.js script:', image.url);
      const downloadResult = await window.electron.debug.downloadImages([{
        id: image.id,
        url: image.url
      }]);
      
      console.log('🔍 DEBUG: Download script result:', downloadResult);
      
      if (!downloadResult.success || downloadResult.results.length === 0) {
        throw new Error(`Failed to download image via Node.js script: ${downloadResult.stderr || 'Unknown error'}`);
      }
      
      const downloadedImage = downloadResult.results[0];
      if (!downloadedImage.success) {
        throw new Error(`Failed to download image: ${downloadedImage.error}`);
      }
      
      console.log('✅ Image downloaded via Node.js script:', {
        size: downloadedImage.size,
        mimeType: downloadedImage.mimeType,
        base64Length: downloadedImage.data?.length || 0
      });

      // Step 3: Upload to WordPress
      setDebugStep(3);
      setDebugStatus('3. WordPress에 이미지 업로드 중...');
      
      const fileName = `${image.id}.${downloadedImage.mimeType!.split('/')[1]}`;
      
      // Convert base64 to Uint8Array (since Buffer is not available in renderer)
      const binaryString = atob(downloadedImage.data!);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const imageBuffer = bytes;
      
      console.log('🔍 DEBUG: Uploading to WordPress:', {
        fileName: fileName,
        mimeType: downloadedImage.mimeType,
        bufferSize: imageBuffer.length
      });

      const uploadResult = await mediaService.uploadMedia(
        imageBuffer,
        fileName,
        downloadedImage.mimeType!,
        {
          title: image.description,
          altText: image.altText,
          caption: image.caption
        }
      );

      console.log('✅ Image uploaded to WordPress:', uploadResult);

      // Step 4: Summary
      setDebugStep(4);
      setDebugStatus('✅ 단일 이미지 디버그 완료!');
      setSuccess(`단일 이미지 디버그가 성공적으로 완료되었습니다! WordPress Media ID: ${uploadResult.id}`);

      console.log('🎉 Single Image Debug Summary:', {
        generatedImage: image,
        downloadSize: downloadedImage.size,
        downloadMethod: 'Node.js script',
        uploadResult: uploadResult
      });

    } catch (error) {
      console.error('Single image debug failed:', error);
      setError(`단일 이미지 디버그 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDebugRunning(false);
    }
  };

  const runDebugWorkflow = async () => {
    if (!selectedSite || !selectedSite.password) {
      setError('WordPress 사이트와 비밀번호가 필요합니다');
      return;
    }

    if (activeKeys.length === 0) {
      setError('AI 키가 필요합니다. AI Keys Manager에서 키를 추가해주세요.');
      return;
    }

    setIsDebugRunning(true);
    setDebugStep(0);
    setDebugStatus('');
    setDebugResults({});
    setError(null);

    try {
      // Step 1: Generate content and images in renderer (to avoid CORS issues)
      setDebugStep(1);
      setDebugStatus('1. 블로그 콘텐츠 생성 중... (이미지 마커 포함)');
      
      console.log('🔍 DEBUG: Starting Step 1 - Content Generation');
      console.log('🔍 DEBUG: Available AI Keys:', activeKeys.length);
      console.log('🔍 DEBUG: Selected AI Key:', activeKeys[0] ? {
        id: activeKeys[0].id,
        provider: activeKeys[0].providerId,
        hasApiKey: !!activeKeys[0].fields.apiKey
      } : 'NONE');
      console.log('🔍 DEBUG: Available Models:', availableModels.length);
      console.log('🔍 DEBUG: Selected Model:', availableModels[0]?.id || 'gpt-3.5-turbo');
      
      const blogAIService = BlogAIService.getInstance();
      const contentRequest: BlogContentRequest = {
        topic: 'AI와 블로그 자동화의 미래',
        audience: (selectedSite as any)?.blog_audience || '개발자',
        tone: (selectedSite as any)?.blog_tone || '전문적이고 친근한',
        length: (selectedSite as any)?.blog_word_length || '1200-1600 단어',
        keywords: ['AI', '블로그', '자동화', 'WordPress', '이미지 생성'],
        category: (selectedSite as any)?.blog_category || 'IT/기술',
        aiKey: activeKeys[0]!,
        model: availableModels[0]?.id || 'gpt-3.5-turbo'
      };

      console.log('🔍 DEBUG: Content Request:', {
        topic: contentRequest.topic,
        audience: contentRequest.audience,
        tone: contentRequest.tone,
        length: contentRequest.length,
        keywords: contentRequest.keywords,
        category: contentRequest.category,
        model: contentRequest.model,
        aiKeyProvider: contentRequest.aiKey.providerId
      });

      console.log('🔍 DEBUG: Calling blogAIService.generateBlogContent...');
      const generatedContent = await blogAIService.generateBlogContent(contentRequest);
      setDebugResults(prev => ({ ...prev, generatedContent }));
      
      console.log('🔍 DEBUG: Content Generation Result:');
      console.log('  - Title:', generatedContent.title);
      console.log('  - Content length:', generatedContent.content.length);
      console.log('  - Excerpt length:', generatedContent.excerpt?.length || 0);
      console.log('  - Tags:', generatedContent.tags);
      console.log('  - Categories:', generatedContent.categories);
      console.log('  - Has image markers [IMAGE:]:', generatedContent.content.includes('[IMAGE:'));
      console.log('  - Has image placeholders:', generatedContent.content.includes('image-placeholder'));
      console.log('  - Content preview (first 500 chars):', generatedContent.content.substring(0, 500));
      console.log('  - Content preview (last 500 chars):', generatedContent.content.substring(Math.max(0, generatedContent.content.length - 500)));

      // Step 2: Generate Images
      setDebugStep(2);
      setDebugStatus('2. 이미지 생성 중... (마커 기반)');
      
      console.log('🔍 DEBUG: Starting Step 2 - Image Generation');
      console.log('🔍 DEBUG: WordPress Site:', {
        url: selectedSite.url,
        username: selectedSite.username,
        hasPassword: !!selectedSite.password
      });
      
      const mediaService = new WordPressMediaService(selectedSite.url, selectedSite.username, selectedSite.password);
      const imageGenerator = new BlogImageGenerator(mediaService, {
        provider: 'dalle',
        quality: 'standard',
        size: '1024x1024',
        apiKey: activeKeys[0]!.fields.apiKey
      });

      console.log('🔍 DEBUG: Image Generator Config:', {
        provider: 'dalle',
        quality: 'standard',
        size: '1024x1024',
        hasApiKey: !!activeKeys[0]!.fields.apiKey,
        apiKeyLength: activeKeys[0]!.fields.apiKey?.length || 0
      });

      const imageRequest: BlogImageRequest = {
        title: generatedContent.title,
        content: generatedContent.content,
        excerpt: generatedContent.excerpt,
        keywords: generatedContent.tags,
        category: generatedContent.categories[0],
        style: 'realistic',
        aspectRatio: 'landscape'
      };

      console.log('🔍 DEBUG: Image Request:', {
        title: imageRequest.title,
        contentLength: imageRequest.content.length,
        excerpt: imageRequest.excerpt,
        keywords: imageRequest.keywords,
        category: imageRequest.category,
        style: imageRequest.style,
        aspectRatio: imageRequest.aspectRatio,
        hasImageMarkers: imageRequest.content.includes('[IMAGE:')
      });

      console.log('🔍 DEBUG: Calling imageGenerator.generateBlogImages...');
      const generatedImages = await imageGenerator.generateBlogImages(imageRequest, {
          url: selectedSite.url,
          username: selectedSite.username,
          password: selectedSite.password
      });
      setDebugResults(prev => ({ ...prev, generatedImages }));
      
      console.log('🔍 DEBUG: Image Generation Result:');
      console.log('  - Generated Images Count:', generatedImages.length);
      console.log('  - Generated Images Details:', generatedImages.map((img, index) => ({
        index: index + 1,
          id: img.id,
          description: img.description,
        url: img.url,
          placement: img.placement,
        style: img.style,
        aspectRatio: img.aspectRatio,
        prompt: img.prompt,
        altText: img.altText,
        caption: img.caption
      })));
      
      if (generatedImages.length === 0) {
        console.log('⚠️ WARNING: No images were generated! This could be due to:');
        console.log('  - API key issues');
        console.log('  - Provider configuration problems');
        console.log('  - Content analysis not finding image requirements');
        console.log('  - Image generation service errors');
      }

      // Step 3: Download images via Node.js script (to avoid CORS)
      setDebugStep(3);
      setDebugStatus('3. 이미지 다운로드 중... (Node.js 스크립트 사용)');
      
      console.log('🔍 DEBUG: Starting Step 3 - Image Download via Node.js Script');
      console.log('🔍 DEBUG: Images to download:', generatedImages.length);
      
      const downloadedImages = [];
      
      if (generatedImages.length > 0) {
        try {
          console.log('🔍 DEBUG: Downloading images via Node.js script...');
          const downloadResult = await window.electron.debug.downloadImages(generatedImages.map(img => ({
            id: img.id,
            url: img.url
          })));
          
          console.log('🔍 DEBUG: Download script result:', downloadResult);
          
          if (!downloadResult.success || downloadResult.results.length === 0) {
            throw new Error(`Failed to download images via Node.js script: ${downloadResult.stderr || 'Unknown error'}`);
          }
          
          // Process download results
          for (const result of downloadResult.results) {
            if (result.success) {
              const image = generatedImages.find(img => img.id === result.imageId);
              if (image) {
                const downloadedImage = {
                  ...image,
                  imageData: result.data,
                  mimeType: result.mimeType,
                  fileName: `${image.id}.${result.mimeType!.split('/')[1]}`,
                  size: result.size
                };
                
                downloadedImages.push(downloadedImage);
                
                console.log(`✅ DEBUG: Successfully downloaded image ${image.id}:`, {
                  fileName: downloadedImage.fileName,
                  mimeType: downloadedImage.mimeType,
                  size: downloadedImage.size,
                  base64Length: result.data?.length || 0
                });
              }
            } else {
              console.error(`❌ DEBUG: Failed to download image ${result.imageId}:`, result.error);
            }
          }
          
          console.log(`🔍 DEBUG: Download Summary: ${downloadedImages.length}/${generatedImages.length} images downloaded successfully`);
          
        } catch (error) {
          console.error('❌ DEBUG: Image download failed:', error);
          console.log('⚠️ WARNING: Image download failed! This could be due to:');
          console.log('  - Node.js script execution issues');
          console.log('  - Network connectivity issues');
          console.log('  - Image service returning errors');
        }
      }
      
      if (downloadedImages.length === 0 && generatedImages.length > 0) {
        console.log('⚠️ WARNING: No images were downloaded! This could be due to:');
        console.log('  - CORS issues (though we\'re using Node.js script)');
        console.log('  - Invalid image URLs');
        console.log('  - Network connectivity issues');
        console.log('  - Image service returning errors');
      }

      // Step 4: Send to main process for upload and post creation
      setDebugStep(4);
      setDebugStatus('4. WordPress 업로드 및 포스트 생성 중...');
      
      console.log('🔍 DEBUG: Starting Step 4 - Main Process Communication');
      
      const config = {
        wordpressUrl: selectedSite.url,
        wordpressUsername: selectedSite.username,
        wordpressPassword: selectedSite.password,
        generatedContent: generatedContent,
        downloadedImages: downloadedImages
      };
      
      console.log('🔍 DEBUG: Config for main process:', {
        wordpressUrl: config.wordpressUrl,
        wordpressUsername: config.wordpressUsername,
        hasPassword: !!config.wordpressPassword,
        contentTitle: config.generatedContent.title,
        contentLength: config.generatedContent.content.length,
        downloadedImagesCount: config.downloadedImages.length,
        downloadedImagesDetails: config.downloadedImages.map((img, index) => ({
          index: index + 1,
          id: img.id,
          fileName: img.fileName,
          mimeType: img.mimeType,
          hasImageData: !!img.imageData,
          imageDataLength: img.imageData?.length || 0
        }))
      });

      console.log('🔍 DEBUG: Calling window.electron.debug.executeWorkflow...');

      // Execute the upload and post creation via IPC
      const result = await (window.electron.debug.executeWorkflow as any)(config);
      
      console.log('🔍 DEBUG: Main process result:', {
        success: result.success,
        exitCode: result.exitCode,
        outputLength: result.output?.length || 0,
        errorLength: result.error?.length || 0,
        hasOutput: !!result.output,
        hasError: !!result.error
      });
      
      if (result.output) {
        console.log('🔍 DEBUG: Main process output:', result.output);
      }
      
      if (result.error) {
        console.log('🔍 DEBUG: Main process errors:', result.error);
      }
      
      if (result.success) {
      setDebugStatus('✅ 디버그 워크플로우 완료!');
      setSuccess('디버그 워크플로우가 성공적으로 완료되었습니다. 콘솔에서 상세 결과를 확인하세요.');
        
        // Log the script output
        console.log('Debug workflow script output:', result.output);
        if (result.error) {
          console.warn('Debug workflow script errors:', result.error);
        }
      } else {
        throw new Error(result.error || 'Debug workflow script failed');
      }

    } catch (error) {
      console.error('Debug workflow failed:', error);
      setError(`디버그 워크플로우 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDebugRunning(false);
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

  /**
   * Update AI settings for a template
   */
  const updateTemplateAISettings = async (templateId: string, aiSettings: {
    model: string;
    keyId: string;
  }) => {
    if (!selectedSite?.id) {
      console.error('No selected site to update');
      return;
    }

    setSavingAISettings(templateId);
    try {
      // Get current templates from the site
      const currentTemplates = (selectedSite as any)?.blog_templates || [];
      
      // Check if this is a built-in template that needs to be saved
      const isBuiltinTemplate = builtinTemplates.some(t => t.id === templateId);
      let updatedTemplates = [...currentTemplates];
      
      if (isBuiltinTemplate) {
        // For built-in templates, create a saved version with AI settings
        const builtinTemplate = builtinTemplates.find(t => t.id === templateId);
        if (builtinTemplate) {
          // Check if a saved version already exists
          const existingSavedTemplate = currentTemplates.find((t: any) => t.id === templateId);
          
          if (existingSavedTemplate) {
            // Update existing saved template
            updatedTemplates = currentTemplates.map((template: any) => {
              if (template.id === templateId) {
                return { ...template, aiSettings };
              }
              return template;
            });
          } else {
            // Create new saved template with AI settings
            const newSavedTemplate = {
              ...builtinTemplate,
              aiSettings
            };
            updatedTemplates.push(newSavedTemplate);
          }
        }
      } else {
        // For saved templates, update the AI settings
        updatedTemplates = currentTemplates.map((template: any) => {
          if (template.id === templateId) {
            return { ...template, aiSettings };
          }
          return template;
        });
      }
      
      // Save the updated templates back to the site
      await window.electron.wordpress.updateConnection(
        selectedSite.id,
        { blog_templates: updatedTemplates },
      );
      
      // Update the local selectedSite state to reflect the changes
      setSelectedSite((prev: WordPressConnection | null) => prev ? {
        ...prev,
        blog_templates: updatedTemplates
      } : null);
      
      // Force re-render by updating refreshKey
      setRefreshKey(prev => prev + 1);
      
      console.log('AI settings updated for template:', templateId, aiSettings);
    } catch (error) {
      console.error('Failed to update AI settings:', error);
      setError('AI 설정 저장에 실패했습니다.');
    } finally {
      setSavingAISettings(null);
    }
  };

  /**
   * Update image settings for a template
   */
  const updateTemplateImageSettings = async (templateId: string, imageSettings: {
    enabled: boolean;
    provider: 'dalle' | 'placeholder' | 'stability' | 'midjourney';
    quality: 'standard' | 'hd';
    size: string;
    style: 'realistic' | 'illustration' | 'minimalist' | 'artistic' | 'photographic';
    aspectRatio: 'square' | 'landscape' | 'portrait' | 'wide';
    openaiKeyId?: string;
  }) => {
    if (!selectedSite?.id) {
      console.error('No selected site to update');
      return;
    }

    setSavingAISettings(templateId);
    try {
      // Get current templates from the site
      const currentTemplates = (selectedSite as any)?.blog_templates || [];
      
      // Check if this is a built-in template that needs to be saved
      const isBuiltinTemplate = builtinTemplates.some(t => t.id === templateId);
      let updatedTemplates = [...currentTemplates];
      
      if (isBuiltinTemplate) {
        // For built-in templates, create a saved version with image settings
        const builtinTemplate = builtinTemplates.find(t => t.id === templateId);
        if (builtinTemplate) {
          // Check if a saved version already exists
          const existingSavedTemplate = currentTemplates.find((t: any) => t.id === templateId);
          
          if (existingSavedTemplate) {
            // Update existing saved template
            updatedTemplates = currentTemplates.map((template: any) => {
              if (template.id === templateId) {
                return { ...template, imageSettings };
              }
              return template;
            });
          } else {
            // Create new saved template with image settings
            const newSavedTemplate = {
              ...builtinTemplate,
              imageSettings
            };
            updatedTemplates.push(newSavedTemplate);
          }
        }
      } else {
        // For saved templates, update the image settings
        updatedTemplates = currentTemplates.map((template: any) => {
          if (template.id === templateId) {
            return { ...template, imageSettings };
          }
          return template;
        });
      }
      
      // Save the updated templates back to the site
      await window.electron.wordpress.updateConnection(
        selectedSite.id,
        { blog_templates: updatedTemplates },
      );
      
      // Update the local selectedSite state to reflect the changes
      setSelectedSite((prev: WordPressConnection | null) => prev ? {
        ...prev,
        blog_templates: updatedTemplates
      } : null);
      
      // Force re-render by updating refreshKey
      setRefreshKey(prev => prev + 1);
      
      console.log('Image settings updated for template:', templateId, imageSettings);
    } catch (error) {
      console.error('Failed to update image settings:', error);
      setError('이미지 설정 저장에 실패했습니다.');
    } finally {
      setSavingAISettings(null);
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
          <FontAwesomeIcon icon={faClock} />
          WordPress 게시물 스케줄러
        </h3>
        <div className="header-actions">
          <button
            className="btn btn-info"
            onClick={runDebugWorkflow}
            disabled={isDebugRunning || !selectedSite || !selectedSite.password}
            title={
              !selectedSite
                ? '먼저 WordPress 사이트를 선택해주세요'
                : !selectedSite.password
                  ? 'WordPress 비밀번호가 필요합니다'
                  : '디버그 워크플로우 실행 (콘텐츠 생성 → 이미지 생성 → 업로드 → 포스트 생성)'
            }
          >
            {isDebugRunning ? (
              <FontAwesomeIcon icon={faClock} className="spinning" />
            ) : (
              <FontAwesomeIcon icon={faBug} />
            )}
            {isDebugRunning ? '디버그 실행 중...' : '디버그 워크플로우'}
          </button>
          <button
            className="btn btn-warning"
            onClick={runSingleImageDebug}
            disabled={isDebugRunning || !selectedSite || !selectedSite.password}
            title={
              !selectedSite
                ? '먼저 WordPress 사이트를 선택해주세요'
                : !selectedSite.password
                  ? 'WordPress 비밀번호가 필요합니다'
                  : '단일 이미지 디버그 실행 (이미지 생성 → 다운로드 → 업로드)'
            }
          >
            {isDebugRunning ? (
              <FontAwesomeIcon icon={faClock} className="spinning" />
            ) : (
              <FontAwesomeIcon icon={faImage} />
            )}
            {isDebugRunning ? '단일 이미지 테스트 중...' : '단일 이미지 테스트'}
          </button>
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

      {/* Debug Status Display */}
      {isDebugRunning && (
        <div className="debug-status">
          <div className="debug-header">
            <FontAwesomeIcon icon={faBug} />
            <h4>디버그 워크플로우 실행 중</h4>
          </div>
          <div className="debug-progress">
            <div className="debug-steps">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`debug-step ${debugStep >= step ? 'active' : ''} ${debugStep > step ? 'completed' : ''}`}
                >
                  <div className="step-number">
                    {debugStep > step ? (
                      <FontAwesomeIcon icon={faCheck} />
                    ) : (
                      step
                    )}
                  </div>
                  <div className="step-label">
                    {step === 1 && '콘텐츠 생성'}
                    {step === 2 && '이미지 생성'}
                    {step === 3 && '이미지 업로드'}
                    {step === 4 && '콘텐츠 편집'}
                    {step === 5 && '포스트 생성'}
                  </div>
                </div>
              ))}
            </div>
            <div className="debug-status-text">
              <FontAwesomeIcon icon={faClock} className="spinning" />
              {debugStatus}
            </div>
          </div>
        </div>
      )}

      {/* Debug Results Display */}
      {debugResults.generatedContent && (
        <div className="debug-results">
          <h4>디버그 결과</h4>
          <div className="debug-result-section">
            <h5><FontAwesomeIcon icon={faFileAlt} /> 생성된 콘텐츠</h5>
            <div className="debug-content-preview">
              <strong>제목:</strong> {debugResults.generatedContent.title}<br/>
              <strong>카테고리:</strong> {debugResults.generatedContent.categories.join(', ')}<br/>
              <strong>태그:</strong> {debugResults.generatedContent.tags.join(', ')}<br/>
              <strong>콘텐츠 길이:</strong> {debugResults.generatedContent.content.length} 문자
            </div>
          </div>
          
          {debugResults.generatedImages && debugResults.generatedImages.length > 0 && (
            <div className="debug-result-section">
              <h5><FontAwesomeIcon icon={faImage} /> 생성된 이미지</h5>
              <div className="debug-images-preview">
                {debugResults.generatedImages.map((img, index) => (
                  <div key={index} className="debug-image-item">
                    <strong>위치:</strong> {img.placement} | 
                    <strong> 설명:</strong> {img.description}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {debugResults.uploadedMedia && debugResults.uploadedMedia.length > 0 && (
            <div className="debug-result-section">
              <h5><FontAwesomeIcon icon={faUpload} /> 업로드된 미디어</h5>
              <div className="debug-media-preview">
                {debugResults.uploadedMedia.map((media, index) => (
                  <div key={index} className="debug-media-item">
                    <strong>WordPress ID:</strong> {media.wordpressId} | 
                    <strong> URL:</strong> {media.wordpressUrl}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {debugResults.createdPost && (
            <div className="debug-result-section">
              <h5><FontAwesomeIcon icon={faFileEdit} /> 생성된 포스트</h5>
              <div className="debug-post-preview">
                <strong>포스트 ID:</strong> {debugResults.createdPost.id}<br/>
                <strong>상태:</strong> {debugResults.createdPost.status}<br/>
                <strong>링크:</strong> <a href={debugResults.createdPost.link} target="_blank" rel="noopener noreferrer">{debugResults.createdPost.link}</a>
              </div>
            </div>
          )}
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
                <span className="ai-status">
                  <FontAwesomeIcon icon={faRobot} />
                  AI 생성
                </span>
                <span className="note">
                  AI가 고품질 콘텐츠를 자동 생성합니다
                </span>
                {(!template.aiSettings?.keyId || !template.aiSettings?.model) && (
                  <span className="ai-warning">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    AI 설정 필요
                  </span>
                )}
              </div>

              {/* AI Settings for this template */}
              <div className="template-ai-settings">
                <div className="ai-settings-header">
                  <label>
                    <FontAwesomeIcon icon={faRobot} />
                    AI 설정
                    {savingAISettings === template.id && (
                      <span className="saving-indicator">저장 중...</span>
                    )}
                  </label>
                </div>
                
                <div className="ai-settings-controls">
                  <div className="ai-setting-item">
                    <label>모델</label>
                    <select
                      value={template.aiSettings?.model || ''}
                      onChange={async (e) => {
                        console.log('Model dropdown changed for template:', template.id, 'to:', e.target.value);
                        const newSettings = {
                          model: e.target.value,
                          keyId: template.aiSettings?.keyId || activeKeys[0]?.id || ''
                        };
                        console.log('Updating AI settings with:', newSettings);
                        await updateTemplateAISettings(template.id, newSettings);
                      }}
                      disabled={isGeneratingContent || savingAISettings === template.id}
                    >
                      {availableModels.map((model) => {
                        const provider = CHAT_PROVIDERS.find((p) => p.id === model.provider);
                        return (
                          <option key={model.id} value={model.id}>
                            {model.name} ({provider?.name || model.provider})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  
                  <div className="ai-setting-item">
                    <label>API 키</label>
                    <select
                      value={template.aiSettings?.keyId || ''}
                      onChange={async (e) => {
                        console.log('API key dropdown changed for template:', template.id, 'to:', e.target.value);
                        const newSettings = {
                          model: template.aiSettings?.model || availableModels[0]?.id || 'gpt-3.5-turbo',
                          keyId: e.target.value
                        };
                        console.log('Updating AI settings with:', newSettings);
                        await updateTemplateAISettings(template.id, newSettings);
                      }}
                      disabled={isGeneratingContent || savingAISettings === template.id}
                    >
                      {activeKeys.map((key) => {
                        const provider = CHAT_PROVIDERS.find((p) => p.id === key.providerId);
                        return (
                          <option key={key.id} value={key.id}>
                            {key.name} ({provider?.name || key.providerId})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Image Settings for this template */}
              <div className="template-image-settings">
                <div className="image-settings-header">
                  <label>
                    <FontAwesomeIcon icon={faImage} />
                    이미지 설정
                  </label>
                </div>
                
                <div className="image-settings-controls">
                  <div className="image-setting-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={template.imageSettings?.enabled || false}
                        onChange={async (e) => {
                          const newImageSettings = {
                            ...template.imageSettings,
                            enabled: e.target.checked,
                            provider: template.imageSettings?.provider || 'placeholder',
                            quality: template.imageSettings?.quality || 'standard',
                            size: template.imageSettings?.size || '400x300',
                            style: template.imageSettings?.style || 'realistic',
                            aspectRatio: template.imageSettings?.aspectRatio || 'landscape'
                          };
                          await updateTemplateImageSettings(template.id, newImageSettings);
                        }}
                      />
                      이미지 생성 활성화
                    </label>
                  </div>
                  
                  {template.imageSettings?.enabled && (
                    <>
                      <div className="image-setting-item">
                        <label>이미지 제공자</label>
                        <select
                          value={template.imageSettings?.provider || 'placeholder'}
                          onChange={async (e) => {
                            const newImageSettings = {
                              ...template.imageSettings,
                              provider: e.target.value as any
                            };
                            await updateTemplateImageSettings(template.id, newImageSettings);
                          }}
                        >
                          <option value="placeholder">플레이스홀더</option>
                          <option value="dalle">DALL-E (OpenAI)</option>
                        </select>
                      </div>
                      
                      {template.imageSettings?.provider === 'dalle' && (
                        <div className="image-setting-item">
                          <label>OpenAI 키 (이미지용)</label>
                          <select
                            value={template.imageSettings?.openaiKeyId || ''}
                            onChange={async (e) => {
                              const newImageSettings = {
                                ...template.imageSettings,
                                openaiKeyId: e.target.value
                              };
                              await updateTemplateImageSettings(template.id, newImageSettings);
                            }}
                          >
                            <option value="">OpenAI 키 선택...</option>
                            {activeKeys.filter(key => key.providerId === 'openai').map((key) => (
                              <option key={key.id} value={key.id}>
                                {key.name} (OpenAI)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      
                      <div className="image-setting-item">
                        <label>이미지 크기</label>
                        <select
                          value={template.imageSettings?.size || '400x300'}
                          onChange={async (e) => {
                            const newImageSettings = {
                              ...template.imageSettings,
                              size: e.target.value
                            };
                            await updateTemplateImageSettings(template.id, newImageSettings);
                          }}
                        >
                          <option value="400x300">400x300 (작은)</option>
                          <option value="800x600">800x600 (중간)</option>
                          <option value="1024x1024">1024x1024 (큰)</option>
                        </select>
                      </div>
                    </>
                  )}

                </div>
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
                    isCreating || !selectedSite || !template.aiSettings?.keyId || !template.aiSettings?.model
                  }
                  title={
                    !selectedSite
                      ? '먼저 WordPress 사이트를 선택해주세요'
                      : !template.aiSettings?.keyId || !template.aiSettings?.model
                        ? 'AI 설정을 먼저 완료해주세요 (모델과 API 키 선택)'
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
