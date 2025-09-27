import React, { useState } from 'react';
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
  faTrash
} from '../../../utils/fontAwesomeIcons';
import './ScheduledPostsTab.css';

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
    monthlyDay: 1
  });

  const [newTopic, setNewTopic] = useState({ name: '' });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

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
        scheduledTime: formData.scheduledTime,
        frequencyType: formData.frequencyType,
        frequencyValue: formData.frequencyValue,
        weeklyDay: formData.weeklyDay,
        monthlyDay: formData.monthlyDay,
        topics: formData.topics.map(topic => topic.name)
      };

      // Call the API to create the scheduled post
      const result = await window.electron.scheduledPosts.create(scheduledPostData);
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Scheduled post created successfully!' });
        onStatsUpdate?.();
        
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
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to create scheduled post' });
      }
    } catch (error) {
      console.error('Failed to create scheduled post:', error);
      setMessage({ type: 'error', text: 'Failed to create scheduled post' });
    } finally {
      setIsLoading(false);
    }
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

  return (
    <div className="scheduled-posts-tab">
      {message && (
        <div className={`scheduled-posts-message scheduled-posts-message-${message.type}`}>
          <FontAwesomeIcon 
            icon={message.type === 'success' ? faCheckCircle : 
                  message.type === 'error' ? faExclamationTriangle : faInfoCircle} 
          />
          {message.text}
        </div>
      )}

      <div className="scheduled-posts-header">
        <div className="scheduled-posts-title">
          <h3>Create Scheduled Post</h3>
          <p>Set up automated blog posts for {connectionName}</p>
        </div>
      </div>

      <div className="scheduled-posts-content">
        <form onSubmit={handleSubmit} className="scheduled-posts-form">
          {/* Post Topics Section */}
          <div className="scheduled-posts-section">
            <h4 className="scheduled-posts-section-title">
              <FontAwesomeIcon icon={faTag} />
              Post Topics
            </h4>
            
            <div className="scheduled-posts-field">
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

            <div className="scheduled-posts-field">
              <label>Add Topics</label>
              <div className="scheduled-posts-topic-input">
                <input
                  type="text"
                  value={newTopic.name}
                  onChange={(e) => handleNewTopicChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter topic names (comma-separated)..."
                  className="scheduled-posts-topic-name"
                />
                <button
                  type="button"
                  onClick={handleAddTopic}
                  className="scheduled-posts-add-topic-btn"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Add
                </button>
              </div>
            </div>

            {formData.topics.length > 0 && (
              <div className="scheduled-posts-field">
                <label>Topics ({formData.topics.length})</label>
                <div className="scheduled-posts-topics-list">
                  {formData.topics.map((topic) => (
                    <div key={topic.id} className="scheduled-posts-topic-item">
                      <div className="scheduled-posts-topic-content">
                        <span className="scheduled-posts-topic-name">{topic.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(topic.id)}
                        className="scheduled-posts-remove-topic-btn"
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
          <div className="scheduled-posts-section">
            <h4 className="scheduled-posts-section-title">
              <FontAwesomeIcon icon={faClock} />
              Recurring Schedule
            </h4>

            <div className="scheduled-posts-datetime-row">
              <div className="scheduled-posts-field">
                <label htmlFor="scheduled-time">Time</label>
                <input
                  id="scheduled-time"
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => handleInputChange('scheduledTime', e.target.value)}
                />
              </div>
              
              {formData.frequencyType === 'weekly' && (
                <div className="scheduled-posts-field">
                  <label htmlFor="weekly-day">Day of Week</label>
                  <select
                    id="weekly-day"
                    value={formData.weeklyDay}
                    onChange={(e) => handleInputChange('weeklyDay', parseInt(e.target.value))}
                    className="scheduled-posts-day-selector"
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
                <div className="scheduled-posts-field">
                  <label htmlFor="monthly-day">Day of Month</label>
                  <select
                    id="monthly-day"
                    value={formData.monthlyDay}
                    onChange={(e) => handleInputChange('monthlyDay', parseInt(e.target.value))}
                    className="scheduled-posts-day-selector"
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

            <div className="scheduled-posts-field">
              <label>Publishing Frequency</label>
              <div className="scheduled-posts-frequency-row">
                <select
                  value={formData.frequencyType}
                  onChange={(e) => handleInputChange('frequencyType', e.target.value)}
                  className="scheduled-posts-frequency-type"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
                
                {formData.frequencyType === 'custom' && (
                  <div className="scheduled-posts-custom-frequency">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.frequencyValue}
                      onChange={(e) => handleInputChange('frequencyValue', parseInt(e.target.value))}
                      className="scheduled-posts-frequency-value"
                    />
                    <span>days</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Preview Section */}
          <div className="scheduled-posts-section">
            <h4 className="scheduled-posts-section-title">
              <FontAwesomeIcon icon={faInfoCircle} />
              Preview
            </h4>
            <div className="scheduled-posts-preview">
              <div className="scheduled-posts-preview-item">
                <strong>Name:</strong> {formData.title || 'Untitled Scheduler'}
              </div>
              <div className="scheduled-posts-preview-item">
                <strong>Topics:</strong> {formData.topics.length > 0 ? formData.topics.map(topic => topic.name).join(', ') : 'No topics added'}
              </div>
              <div className="scheduled-posts-preview-item">
                <strong>Schedule:</strong> {formatSchedulePreview()}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="scheduled-posts-actions">
            <button
              type="submit"
              className="scheduled-posts-submit-btn"
              disabled={isLoading}
            >
              <FontAwesomeIcon icon={isLoading ? faClock : faSave} spin={isLoading} />
              {isLoading ? 'Creating...' : 'Create Scheduled Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduledPostsTab;
