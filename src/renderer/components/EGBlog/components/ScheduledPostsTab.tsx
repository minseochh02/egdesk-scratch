import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarAlt, 
  faClock, 
  faSave,
  faCheckCircle,
  faExclamationTriangle,
  faInfoCircle,
  faCalendarDay,
  faCalendarWeek,
  faCalendarMonth,
  faRepeat,
  faFileAlt,
  faTimes,
  faPlus,
  faTag,
  faTrash,
  faEdit,
  faPlay,
  faPause,
  faSpinner,
  faSearch,
  faSort,
  faRefresh,
  faRocket,
  faHistory
} from '../../../utils/fontAwesomeIcons';
import './ScheduledPostsTab.css';
import ScheduledPostHistory from './ScheduledPostHistory';

interface Topic {
  id: string;
  name: string;
}

interface ScheduledPostForm {
  title: string;
  topics: Topic[];
  scheduledDate: string;
  scheduledTime: string;
  frequencyType: 'daily' | 'weekly' | 'monthly' | 'custom';
  frequencyValue: number;
  weeklyDay: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  monthlyDay: number; // 1-31
  aiKeyId?: string | null;
}

interface SavedScheduledPost {
  id: string;
  title: string;
  connectionId: string;
  connectionName: string;
  connectionType: string;
  aiKeyId?: string | null;
  scheduledTime: string;
  frequencyType: 'daily' | 'weekly' | 'monthly' | 'custom';
  frequencyValue: number;
  weeklyDay?: number;
  monthlyDay?: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
  topics: string[];
}

interface ScheduledPostsTabProps {
  connectionId: string;
  connectionName: string;
  connectionType: string;
  onStatsUpdate?: () => void;
}

const ScheduledPostsTab: React.FC<ScheduledPostsTabProps> = ({
  connectionId,
  connectionName,
  connectionType,
  onStatsUpdate
}) => {
  const [formData, setFormData] = useState<ScheduledPostForm>({
    title: '',
    topics: [],
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '09:00',
    frequencyType: 'weekly',
    frequencyValue: 1,
    weeklyDay: 1, // Monday
    monthlyDay: 1,
    aiKeyId: null
  });

  const [newTopic, setNewTopic] = useState({ name: '' });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // State for saved schedules
  const [savedSchedules, setSavedSchedules] = useState<SavedScheduledPost[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('list');
  
  // State for editing
  const [editingSchedule, setEditingSchedule] = useState<SavedScheduledPost | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // State for filtering and search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // State for immediate execution
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
  
  // Active AI key info
  const [activeAIKeyInfo, setActiveAIKeyInfo] = useState<{
    providerId: string;
    providerName: string;
    keyMasked: string;
    id?: string;
  } | null>(null);

  // List of available Google/Gemini keys (active only, like AIChat)
  const [googleKeys, setGoogleKeys] = useState<Array<{ id: string; name: string; masked: string }>>([]);

  const maskKey = (key?: string) => {
    if (!key || typeof key !== 'string') return '';
    const visible = 4;
    if (key.length <= visible * 2) return key[0] + '***' + key[key.length - 1];
    return `${key.slice(0, visible)}...${key.slice(-visible)}`;
  };

  const findBestAIKey = (keys: any[]) => {
    if (!Array.isArray(keys)) return null;
    const google = keys.find(
      (k) => k?.isActive && k?.providerId === 'google' && k?.fields?.apiKey,
    );
    if (google) return google;
    return keys.find((k) => k?.isActive && k?.fields?.apiKey) || null;
  };

  const refreshActiveAIKeyInfo = async () => {
    try {
      const keys = await window.electron.store.get('ai-keys');
      const selected = findBestAIKey(keys || []);
      const googleActive = (Array.isArray(keys) ? keys : [])
        .filter((k: any) => k?.providerId === 'google' && k?.isActive)
        .map((k: any) => ({ id: k.id, name: k.name || 'Unnamed Key', masked: maskKey(k.fields?.apiKey) }));
      setGoogleKeys(googleActive);
      if (!selected) {
        setActiveAIKeyInfo(null);
        return;
      }
      const providerName =
        selected.providerId === 'google'
          ? 'Google AI'
          : selected.providerId === 'openai'
          ? 'OpenAI'
          : selected.providerId === 'anthropic'
          ? 'Anthropic'
          : selected.providerId || 'Custom';
      setActiveAIKeyInfo({
        providerId: selected.providerId,
        providerName,
        keyMasked: maskKey(selected.fields?.apiKey),
        id: selected.id,
      });
    } catch (e) {
      setActiveAIKeyInfo(null);
    }
  };

  // State for history modal
  const [showHistory, setShowHistory] = useState(false);
  const [selectedScheduleForHistory, setSelectedScheduleForHistory] = useState<SavedScheduledPost | null>(null);

  // Fetch saved schedules from SQLite
  const fetchSavedSchedules = async () => {
    try {
      setIsLoadingSchedules(true);
      const result = await window.electron.scheduledPosts.getByConnection(connectionId);
      
      if (result.success && result.data) {
        // Fetch topics for each scheduled post
        const schedulesWithTopics = await Promise.all(
          result.data.map(async (schedule: any) => {
            const topicsResult = await window.electron.scheduledPosts.getTopics(schedule.id);
            return {
              ...schedule,
              topics: topicsResult.success ? topicsResult.data?.map((t: any) => t.topicName) || [] : []
            };
          })
        );
        setSavedSchedules(schedulesWithTopics);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to fetch saved schedules' });
      }
    } catch (error) {
      console.error('Failed to fetch saved schedules:', error);
      setMessage({ type: 'error', text: 'Failed to fetch saved schedules' });
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  // Load saved schedules on component mount
  useEffect(() => {
    fetchSavedSchedules();
    refreshActiveAIKeyInfo();
  }, [connectionId]);

  const handleInputChange = (field: keyof ScheduledPostForm, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddTopic = () => {
    if (!newTopic.name.trim()) {
      setMessage({ type: 'error', text: 'Please enter a topic name' });
      return;
    }

    // Split by comma and filter out empty strings
    const topicNames = newTopic.name
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (topicNames.length === 0) {
      setMessage({ type: 'error', text: 'Please enter valid topic names' });
      return;
    }

    // Create topics for each name
    const newTopics: Topic[] = topicNames.map(name => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: name
    }));

    setFormData(prev => ({
      ...prev,
      topics: [...prev.topics, ...newTopics]
    }));

    setNewTopic({ name: '' });
  };

  const handleRemoveTopic = (topicId: string) => {
    setFormData(prev => ({
      ...prev,
      topics: prev.topics.filter(topic => topic.id !== topicId)
    }));
  };

  const handleNewTopicChange = (value: string) => {
    setNewTopic({ name: value });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTopic();
    }
  };

  // Handle edit schedule
  const handleEditSchedule = (schedule: SavedScheduledPost) => {
    setEditingSchedule(schedule);
    setIsEditMode(true);
    setActiveTab('create');
    
    // Populate form with existing data
    setFormData({
      title: schedule.title,
      topics: schedule.topics.map(topic => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: topic
      })),
      scheduledDate: new Date().toISOString().split('T')[0], // Not used in current form
      scheduledTime: schedule.scheduledTime,
      frequencyType: schedule.frequencyType,
      frequencyValue: schedule.frequencyValue,
      weeklyDay: schedule.weeklyDay || 1,
      monthlyDay: schedule.monthlyDay || 1,
      aiKeyId: schedule.aiKeyId || null
    });
    setNewTopic({ name: '' });
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingSchedule(null);
    setIsEditMode(false);
    setActiveTab('list');
    
    // Reset form
    setFormData({
      title: '',
      topics: [],
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '09:00',
      frequencyType: 'weekly',
      frequencyValue: 1,
      weeklyDay: 1,
      monthlyDay: 1
    });
    setNewTopic({ name: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setMessage({ type: 'error', text: 'Please enter a name for your scheduler' });
      return;
    }

    if (formData.topics.length === 0) {
      setMessage({ type: 'error', text: 'Please add at least one topic for your post' });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);

      // Prepare data for database
      const scheduledPostData = {
        title: formData.title,
        connectionId,
        connectionName,
        connectionType,
        aiKeyId: formData.aiKeyId || activeAIKeyInfo?.id || null,
        scheduledTime: formData.scheduledTime,
        frequencyType: formData.frequencyType,
        frequencyValue: formData.frequencyValue,
        weeklyDay: formData.weeklyDay,
        monthlyDay: formData.monthlyDay,
        topics: formData.topics.map(topic => topic.name)
      };

      let result;
      
      if (isEditMode && editingSchedule) {
        // Update existing scheduled post
        result = await window.electron.scheduledPosts.update(editingSchedule.id, scheduledPostData);
      } else {
        // Create new scheduled post
        result = await window.electron.scheduledPosts.create(scheduledPostData);
      }
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: isEditMode ? 'Scheduled post updated successfully!' : 'Scheduled post created successfully!' 
        });
        onStatsUpdate?.();
        
        // Refresh the saved schedules list
        await fetchSavedSchedules();
        
        // Reset form and exit edit mode
        handleCancelEdit();
      } else {
        setMessage({ 
          type: 'error', 
          text: result.error || (isEditMode ? 'Failed to update scheduled post' : 'Failed to create scheduled post') 
        });
      }
    } catch (error) {
      console.error(isEditMode ? 'Failed to update scheduled post:' : 'Failed to create scheduled post:', error);
      setMessage({ 
        type: 'error', 
        text: isEditMode ? 'Failed to update scheduled post' : 'Failed to create scheduled post' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle schedule toggle (enable/disable)
  const handleToggleSchedule = async (id: string, enabled: boolean) => {
    try {
      const result = await window.electron.scheduledPosts.toggle(id, enabled);
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `Schedule ${enabled ? 'enabled' : 'disabled'} successfully!` 
        });
        await fetchSavedSchedules();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to toggle schedule' });
      }
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
      setMessage({ type: 'error', text: 'Failed to toggle schedule' });
    }
  };

  // Handle schedule deletion
  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this scheduled post?')) {
      return;
    }

    try {
      const result = await window.electron.scheduledPosts.delete(id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Schedule deleted successfully!' });
        await fetchSavedSchedules();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to delete schedule' });
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      setMessage({ type: 'error', text: 'Failed to delete schedule' });
    }
  };

  // Handle immediate execution
  const handleRunNow = async (schedule: SavedScheduledPost) => {
    if (!window.confirm(`Are you sure you want to run "${schedule.title}" immediately? This will generate and post a blog using the scheduled topics.`)) {
      return;
    }

    console.log(`\n🚀 ===== FRONTEND: STARTING MANUAL EXECUTION =====`);
    console.log(`📝 Schedule: ${schedule.title}`);
    console.log(`🔗 Connection: ${schedule.connectionName}`);
    console.log(`📋 Topics: ${schedule.topics?.join(', ') || 'None'}`);
    console.log(`⏰ Scheduled Time: ${schedule.scheduledTime}`);
    console.log(`🔄 Frequency: ${schedule.frequencyType}`);
    console.log(`🕐 Started at: ${new Date().toISOString()}`);

    try {
      // Add to running tasks
      setRunningTasks(prev => new Set([...prev, schedule.id]));
      setMessage({ type: 'info', text: `Running "${schedule.title}" now...` });

      console.log(`📤 Calling main process to execute scheduled post...`);
      
      // Call the main process to execute the scheduled post immediately
      const result = await window.electron.scheduledPosts.runNow(schedule.id);
      
      console.log(`📥 Main process response:`, result);
      
      if (result.success) {
        console.log(`✅ Execution completed successfully`);
        setMessage({ 
          type: 'success', 
          text: `"${schedule.title}" executed successfully! Blog post has been generated and published.` 
        });
        // Refresh the schedules to update statistics
        console.log(`🔄 Refreshing schedules to update statistics...`);
        await fetchSavedSchedules();
        onStatsUpdate?.();
        console.log(`✅ Schedules refreshed successfully`);
      } else {
        console.error(`❌ Execution failed:`, result.error);
        setMessage({ 
          type: 'error', 
          text: result.error || `Failed to execute "${schedule.title}"` 
        });
      }
    } catch (error) {
      console.error(`\n💥 ===== FRONTEND: EXECUTION FAILED =====`);
      console.error(`❌ Schedule: ${schedule.title}`);
      console.error(`🕐 Failed at: ${new Date().toISOString()}`);
      console.error(`📄 Error details:`, error);
      
      setMessage({ 
        type: 'error', 
        text: `Failed to execute "${schedule.title}": ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      // Remove from running tasks
      setRunningTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(schedule.id);
        return newSet;
      });
      console.log(`🏁 ===== FRONTEND: EXECUTION COMPLETED =====`);
    }
  };

  // Handle view history
  const handleViewHistory = (schedule: SavedScheduledPost) => {
    setSelectedScheduleForHistory(schedule);
    setShowHistory(true);
  };

  // Handle close history
  const handleCloseHistory = () => {
    setShowHistory(false);
    setSelectedScheduleForHistory(null);
  };

  const getFrequencyIcon = (frequencyType: string) => {
    switch (frequencyType) {
      case 'daily':
        return faCalendarDay;
      case 'weekly':
        return faCalendarWeek;
      case 'monthly':
        return faCalendarMonth;
      case 'custom':
        return faRepeat;
      default:
        return faClock;
    }
  };

  const formatSchedulePreview = () => {
    const time = formData.scheduledTime;
    const formattedTime = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    let scheduleText = '';
    
    switch (formData.frequencyType) {
      case 'daily':
        scheduleText = `Publish daily at ${formattedTime}`;
        break;
      case 'weekly':
        scheduleText = `Publish every ${daysOfWeek[formData.weeklyDay]} at ${formattedTime}`;
        break;
      case 'monthly':
        const daySuffix = formData.monthlyDay === 1 ? 'st' : 
                         formData.monthlyDay === 2 ? 'nd' : 
                         formData.monthlyDay === 3 ? 'rd' : 'th';
        scheduleText = `Publish on the ${formData.monthlyDay}${daySuffix} of every month at ${formattedTime}`;
        break;
      case 'custom':
        scheduleText = `Publish every ${formData.frequencyValue} days at ${formattedTime}`;
        break;
      default:
        scheduleText = `Publish at ${formattedTime}`;
    }
    
    return scheduleText;
  };

  // Format schedule display for saved schedules
  const formatSavedSchedulePreview = (schedule: SavedScheduledPost) => {
    const time = schedule.scheduledTime;
    const formattedTime = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    let scheduleText = '';
    
    switch (schedule.frequencyType) {
      case 'daily':
        scheduleText = `Daily at ${formattedTime}`;
        break;
      case 'weekly':
        scheduleText = `Every ${daysOfWeek[schedule.weeklyDay || 0]} at ${formattedTime}`;
        break;
      case 'monthly':
        const daySuffix = schedule.monthlyDay === 1 ? 'st' : 
                         schedule.monthlyDay === 2 ? 'nd' : 
                         schedule.monthlyDay === 3 ? 'rd' : 'th';
        scheduleText = `On the ${schedule.monthlyDay}${daySuffix} of every month at ${formattedTime}`;
        break;
      case 'custom':
        scheduleText = `Every ${schedule.frequencyValue} days at ${formattedTime}`;
        break;
      default:
        scheduleText = `At ${formattedTime}`;
    }
    
    return scheduleText;
  };

  // Filter and sort schedules
  const filteredSchedules = savedSchedules.filter(schedule => {
    const matchesSearch = schedule.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         schedule.topics.some(topic => topic.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'enabled' && schedule.enabled) ||
                         (statusFilter === 'disabled' && !schedule.enabled);
    return matchesSearch && matchesStatus;
  });

  const sortedSchedules = [...filteredSchedules].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortBy) {
      case 'name':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'status':
        aValue = a.enabled ? 1 : 0;
        bValue = b.enabled ? 1 : 0;
        break;
      case 'date':
      default:
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  return (
    <div className="eg-blog-scheduled-posts-tab">
      {message && (
        <div className={`eg-blog-scheduled-posts-message eg-blog-scheduled-posts-message-${message.type}`}>
          <FontAwesomeIcon 
            icon={message.type === 'success' ? faCheckCircle : 
                  message.type === 'error' ? faExclamationTriangle : faInfoCircle} 
          />
          {message.text}
        </div>
      )}

      <div className="eg-blog-scheduled-posts-content">
        {activeTab === 'create' ? (
          <div className="eg-blog-scheduled-posts-create-view">
            <div className="eg-blog-scheduled-posts-create-header">
              <div className="eg-blog-scheduled-posts-create-header-info">
                <h3>{isEditMode ? 'Edit Schedule' : 'Create New Schedule'}</h3>
                {isEditMode && editingSchedule && (
                  <p className="eg-blog-scheduled-posts-edit-info">
                    Editing: <strong>{editingSchedule.title}</strong>
                  </p>
                )}
              </div>
              <button
                className="eg-blog-scheduled-posts-back-btn"
                onClick={isEditMode ? handleCancelEdit : () => setActiveTab('list')}
              >
                <FontAwesomeIcon icon={faTimes} />
                {isEditMode ? 'Cancel Edit' : 'Cancel'}
              </button>
            </div>
            <form onSubmit={handleSubmit} className="eg-blog-scheduled-posts-form">
          {/* Post Topics Section */}
          <div className="eg-blog-scheduled-posts-section">
            <h4 className="eg-blog-scheduled-posts-section-title">
              <FontAwesomeIcon icon={faTag} />
              Post Topics
            </h4>
            
            <div className="eg-blog-scheduled-posts-field">
              <label htmlFor="scheduler-name">Scheduler Name *</label>
              <input
                id="scheduler-name"
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter scheduler name (e.g., Weekly Tech Posts)..."
                required
              />
            </div>

            <div className="eg-blog-scheduled-posts-field">
              <label>Add Topics</label>
              <div className="eg-blog-scheduled-posts-topic-input">
                <input
                  type="text"
                  value={newTopic.name}
                  onChange={(e) => handleNewTopicChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter topic names (comma-separated)..."
                  className="eg-blog-scheduled-posts-topic-name"
                />
                <button
                  type="button"
                  onClick={handleAddTopic}
                  className="eg-blog-scheduled-posts-add-topic-btn"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Add
                </button>
              </div>
            </div>

            {formData.topics.length > 0 && (
              <div className="eg-blog-scheduled-posts-field">
                <label>Topics ({formData.topics.length})</label>
                <div className="eg-blog-scheduled-posts-topics-list">
                  {formData.topics.map((topic) => (
                    <div key={topic.id} className="eg-blog-scheduled-posts-topic-item">
                      <div className="eg-blog-scheduled-posts-topic-content">
                        <span className="eg-blog-scheduled-posts-topic-name">{topic.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(topic.id)}
                        className="eg-blog-scheduled-posts-remove-topic-btn"
                        title="Remove topic"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scheduling Section */}
          <div className="eg-blog-scheduled-posts-section">
            <h4 className="eg-blog-scheduled-posts-section-title">
              <FontAwesomeIcon icon={faClock} />
              Recurring Schedule
            </h4>

            {/* AI Key Selection */}
            <div className="eg-blog-scheduled-posts-field">
              <label htmlFor="ai-key">AI API Key</label>
              <div className="eg-blog-scheduled-posts-ai-key-row">
                <select
                  id="ai-key"
                  value={formData.aiKeyId || activeAIKeyInfo?.id || ''}
                  onChange={(e) => handleInputChange('aiKeyId', e.target.value || null)}
                >
                  <option value="">Auto-select active key</option>
                  {googleKeys.map(k => (
                    <option key={k.id} value={k.id}>{k.name} — {k.masked}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="eg-blog-scheduled-posts-datetime-row">
              <div className="eg-blog-scheduled-posts-field">
                <label htmlFor="scheduled-time">Time</label>
                <input
                  id="scheduled-time"
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => handleInputChange('scheduledTime', e.target.value)}
                />
              </div>
              
              {formData.frequencyType === 'weekly' && (
                <div className="eg-blog-scheduled-posts-field">
                  <label htmlFor="weekly-day">Day of Week</label>
                  <select
                    id="weekly-day"
                    value={formData.weeklyDay}
                    onChange={(e) => handleInputChange('weeklyDay', parseInt(e.target.value))}
                    className="eg-blog-scheduled-posts-day-selector"
                  >
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>
              )}
              
              {formData.frequencyType === 'monthly' && (
                <div className="eg-blog-scheduled-posts-field">
                  <label htmlFor="monthly-day">Day of Month</label>
                  <select
                    id="monthly-day"
                    value={formData.monthlyDay}
                    onChange={(e) => handleInputChange('monthlyDay', parseInt(e.target.value))}
                    className="eg-blog-scheduled-posts-day-selector"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>
                        {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="eg-blog-scheduled-posts-field">
              <label>Publishing Frequency</label>
              <div className="eg-blog-scheduled-posts-frequency-row">
                <select
                  value={formData.frequencyType}
                  onChange={(e) => handleInputChange('frequencyType', e.target.value)}
                  className="eg-blog-scheduled-posts-frequency-type"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
                
                {formData.frequencyType === 'custom' && (
                  <div className="eg-blog-scheduled-posts-custom-frequency">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.frequencyValue}
                      onChange={(e) => handleInputChange('frequencyValue', parseInt(e.target.value))}
                      className="eg-blog-scheduled-posts-frequency-value"
                    />
                    <span>days</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Preview Section */}
          <div className="eg-blog-scheduled-posts-section">
            <h4 className="eg-blog-scheduled-posts-section-title">
              <FontAwesomeIcon icon={faInfoCircle} />
              Preview
            </h4>
            <div className="eg-blog-scheduled-posts-preview">
              <div className="eg-blog-scheduled-posts-preview-item">
                <strong>Name:</strong> {formData.title || 'Untitled Scheduler'}
              </div>
              <div className="eg-blog-scheduled-posts-preview-item">
                <strong>AI Key:</strong> {activeAIKeyInfo ? `${activeAIKeyInfo.providerName} — ${activeAIKeyInfo.keyMasked}` : 'Not selected'}
              </div>
              <div className="eg-blog-scheduled-posts-preview-item">
                <strong>Topics:</strong> {formData.topics.length > 0 ? formData.topics.map(topic => topic.name).join(', ') : 'No topics added'}
              </div>
              <div className="eg-blog-scheduled-posts-preview-item">
                <strong>Schedule:</strong> {formatSchedulePreview()}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="eg-blog-scheduled-posts-actions">
            <button
              type="submit"
              className="eg-blog-scheduled-posts-submit-btn"
              disabled={isLoading}
            >
              <FontAwesomeIcon icon={isLoading ? faClock : faSave} spin={isLoading} />
              {isLoading 
                ? (isEditMode ? 'Updating...' : 'Creating...') 
                : (isEditMode ? 'Update Scheduled Post' : 'Create Scheduled Post')
              }
            </button>
          </div>
            </form>
          </div>
        ) : (
          <div className="eg-blog-scheduled-posts-list-view">
            <div className="eg-blog-scheduled-posts-header">
              <div className="eg-blog-scheduled-posts-header-info">
                <h3>Scheduled Posts</h3>
                <p>Manage scheduled posts for {connectionName} ({connectionType})</p>
                {activeAIKeyInfo && (
                  <p className="eg-blog-scheduled-posts-active-ai-key" title="Active AI provider and key">
                    <FontAwesomeIcon icon={faInfoCircle} /> Active AI: <strong>{activeAIKeyInfo.providerName}</strong> — Key {activeAIKeyInfo.keyMasked}
                  </p>
                )}
              </div>
              <div className="eg-blog-scheduled-posts-header-actions">
                <button
                  className="eg-blog-scheduled-posts-refresh-btn"
                  onClick={async () => { await fetchSavedSchedules(); await refreshActiveAIKeyInfo(); }}
                  disabled={isLoadingSchedules}
                  title="Refresh schedules"
                >
                  <FontAwesomeIcon icon={faRefresh} spin={isLoadingSchedules} />
                  Refresh
                </button>
                <button
                  className="eg-blog-scheduled-posts-create-btn"
                  onClick={() => setActiveTab('create')}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Create New Schedule
                </button>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="eg-blog-scheduled-posts-filters">
              <div className="eg-blog-scheduled-posts-search">
                <FontAwesomeIcon icon={faSearch} />
                <input
                  type="text"
                  placeholder="Search schedules..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="eg-blog-scheduled-posts-filter-group">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="enabled">Active</option>
                  <option value="disabled">Paused</option>
                </select>
              </div>

              <div className="eg-blog-scheduled-posts-sort-group">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'status')}
                >
                  <option value="date">Sort by Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="status">Sort by Status</option>
                </select>
                <button
                  className="eg-blog-scheduled-posts-sort-order-btn"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  <FontAwesomeIcon icon={faSort} />
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            <div className="eg-blog-scheduled-posts-list">
            {isLoadingSchedules ? (
              <div className="eg-blog-scheduled-posts-loading">
                <FontAwesomeIcon icon={faSpinner} spin />
                <p>Loading saved schedules...</p>
              </div>
            ) : sortedSchedules.length === 0 ? (
              <div className="eg-blog-scheduled-posts-empty">
                <FontAwesomeIcon icon={faFileAlt} />
                <h4>No saved schedules</h4>
                <p>Create your first scheduled post to get started.</p>
                <button
                  className="eg-blog-scheduled-posts-create-first-btn"
                  onClick={() => setActiveTab('create')}
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Create First Schedule
                </button>
              </div>
            ) : (
              <div className="eg-blog-scheduled-posts-list-container">
                {sortedSchedules.map((schedule) => (
                  <div key={schedule.id} className={`eg-blog-scheduled-posts-item ${!schedule.enabled ? 'disabled' : ''}`}>
                    <div className="eg-blog-scheduled-posts-item-header">
                      <div className="eg-blog-scheduled-posts-item-title">
                        <h4>{schedule.title}</h4>
                        <div className="eg-blog-scheduled-posts-item-status">
                          <FontAwesomeIcon 
                            icon={schedule.enabled ? faPlay : faPause} 
                            className={schedule.enabled ? 'enabled' : 'disabled'}
                          />
                          <span>{schedule.enabled ? 'Active' : 'Paused'}</span>
                        </div>
                      </div>
                      <div className="eg-blog-scheduled-posts-item-actions">
                        <button
                          className="eg-blog-scheduled-posts-action-btn run-now"
                          onClick={() => handleRunNow(schedule)}
                          disabled={runningTasks.has(schedule.id)}
                          title="Run this schedule immediately"
                        >
                          <FontAwesomeIcon 
                            icon={runningTasks.has(schedule.id) ? faSpinner : faRocket} 
                            spin={runningTasks.has(schedule.id)}
                          />
                        </button>
                        <button
                          className="eg-blog-scheduled-posts-action-btn history"
                          onClick={() => handleViewHistory(schedule)}
                          title="View execution history"
                        >
                          <FontAwesomeIcon icon={faHistory} />
                        </button>
                        <button
                          className="eg-blog-scheduled-posts-action-btn toggle"
                          onClick={() => handleToggleSchedule(schedule.id, !schedule.enabled)}
                          title={schedule.enabled ? 'Pause schedule' : 'Enable schedule'}
                        >
                          <FontAwesomeIcon icon={schedule.enabled ? faPause : faPlay} />
                        </button>
                        <button
                          className="eg-blog-scheduled-posts-action-btn edit"
                          onClick={() => handleEditSchedule(schedule)}
                          title="Edit schedule"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                        </button>
                        <button
                          className="eg-blog-scheduled-posts-action-btn delete"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          title="Delete schedule"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="eg-blog-scheduled-posts-item-content">
                      {/* Schedule Information */}
                      <div className="eg-blog-scheduled-posts-item-schedule">
                        <FontAwesomeIcon icon={getFrequencyIcon(schedule.frequencyType)} />
                        <span>{formatSavedSchedulePreview(schedule)}</span>
                      </div>
                      
                      {/* Next Run Date */}
                      {schedule.nextRun && (
                        <div className="eg-blog-scheduled-posts-item-next-run">
                          <FontAwesomeIcon icon={faCalendarAlt} />
                          <span>
                            <strong>Next run:</strong> {new Date(schedule.nextRun).toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      {/* Topics */}
                      {schedule.topics.length > 0 && (
                        <div className="eg-blog-scheduled-posts-item-topics">
                          <FontAwesomeIcon icon={faTag} />
                          <div className="eg-blog-scheduled-posts-topics-container">
                            <span className="eg-blog-scheduled-posts-topics-label">
                              <strong>Topics ({schedule.topics.length}):</strong>
                            </span>
                            <div className="eg-blog-scheduled-posts-topics-tags">
                              {schedule.topics.map((topic, index) => (
                                <span key={index} className="eg-blog-scheduled-posts-topic-tag">
                                  {topic}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Usage Statistics */}
                      <div className="eg-blog-scheduled-posts-item-stats">
                        <div className="eg-blog-scheduled-posts-stats-header">
                          <FontAwesomeIcon icon={faInfoCircle} />
                          <span><strong>Usage Statistics</strong></span>
                        </div>
                        <div className="eg-blog-scheduled-posts-stats-grid">
                          <div className="eg-blog-scheduled-posts-stat">
                            <span className="stat-label">Total Runs:</span>
                            <span className="stat-value">{schedule.runCount}</span>
                          </div>
                          <div className="eg-blog-scheduled-posts-stat">
                            <span className="stat-label">Successful:</span>
                            <span className="stat-value success">{schedule.successCount}</span>
                          </div>
                          <div className="eg-blog-scheduled-posts-stat">
                            <span className="stat-label">Failed:</span>
                            <span className="stat-value error">{schedule.failureCount}</span>
                          </div>
                          <div className="eg-blog-scheduled-posts-stat">
                            <span className="stat-label">Success Rate:</span>
                            <span className="stat-value">
                              {schedule.runCount > 0 
                                ? `${Math.round((schedule.successCount / schedule.runCount) * 100)}%`
                                : 'N/A'
                              }
                            </span>
                          </div>
                        </div>
                        {schedule.lastRun && (
                          <div className="eg-blog-scheduled-posts-last-run">
                            <span className="stat-label">Last run:</span>
                            <span className="stat-value">
                              {new Date(schedule.lastRun).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        )}
      </div>

      {/* History Modal */}
      {showHistory && selectedScheduleForHistory && (
        <ScheduledPostHistory
          scheduledPostId={selectedScheduleForHistory.id}
          scheduledPostTitle={selectedScheduleForHistory.title}
          onClose={handleCloseHistory}
        />
      )}
    </div>
  );
};

export default ScheduledPostsTab;
