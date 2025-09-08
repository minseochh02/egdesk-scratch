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
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import SchedulerService, { CreateTaskData } from '../../services/schedulerService';
import { WordPressSite } from '../../../main/preload';
import './WordPressPostScheduler.css';

interface WordPressPostSchedulerProps {
  sites: WordPressSite[];
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
  onTaskCreated 
}) => {
  const [selectedSite, setSelectedSite] = useState<WordPressSite | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const schedulerService = SchedulerService.getInstance();

  const postTemplates: PostTemplate[] = [
    {
      id: '1',
      name: 'Daily Status Update',
      title: 'Daily Status Update',
      content: 'This is a daily status update posted automatically.',
      status: 'publish',
      categories: ['Updates'],
      tags: ['daily', 'status', 'automated']
    },
    {
      id: '2',
      name: 'Weekly Report',
      title: 'Weekly Report',
      content: 'This is a weekly report generated automatically.',
      status: 'draft',
      categories: ['Reports'],
      tags: ['weekly', 'report', 'automated']
    },
    {
      id: '3',
      name: 'System Health Check',
      title: 'System Health Check',
      content: 'Automated system health check report.',
      status: 'publish',
      categories: ['System'],
      tags: ['health', 'check', 'automated']
    }
  ];

  const createWordPressPostTask = async (template: PostTemplate, schedule: string) => {
    if (!selectedSite) {
      setError('Please select a WordPress site first');
      return;
    }

    // Validate WordPress credentials
    if (!selectedSite.username || !selectedSite.password) {
      setError('WordPress credentials (사용자명 and 비밀번호) are required. Please check your WordPress connection settings.');
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
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
      
      const payload = {
        title: `${template.title} - ${now.toLocaleString()}`,
        content: `${template.content}\n\n---\n*Posted automatically on ${timestamp} (Unique ID: ${uniqueId})*`,
        status: template.status
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
        description: `Automatically posts "${template.name}" to ${selectedSite.url} using WordPress REST API (사용자명: ${selectedSite.username})`,
        command: command,
        schedule: schedule,
        enabled: true,
        workingDirectory: '',
        environment: {},
        outputFile: '',
        errorFile: ''
      };

      const response = await schedulerService.createTask(taskData);
      
      if (response.success) {
        setSuccess(`Task created successfully! It will post "${template.name}" to ${selectedSite.name || selectedSite.url} using 사용자명: ${selectedSite.username}`);
        setShowCreateModal(false);
        onTaskCreated?.();
      } else {
        setError(response.error || 'Failed to create WordPress post task');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create WordPress post task');
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
        command: command,
        schedule: 'interval:300000', // 5 minutes
        enabled: true,
        workingDirectory: '',
        environment: {},
        outputFile: '',
        errorFile: ''
      };

      const response = await schedulerService.createTask(taskData);
      
      if (response.success) {
        setSuccess(`Demo POST task created successfully! It will send requests to ${url} every 5 minutes.`);
        onTaskCreated?.();
      } else {
        setError(response.error || 'Failed to create demo POST task');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create demo POST task');
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
      setError('WordPress credentials (사용자명 and 비밀번호) are required. Please check your WordPress connection settings.');
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
        status: formData.status
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
        command: command,
        schedule: formData.schedule,
        enabled: true,
        workingDirectory: '',
        environment: {},
        outputFile: '',
        errorFile: ''
      };

      const response = await schedulerService.createTask(taskData);
      
      if (response.success) {
        setSuccess(`Custom post task created successfully! Will post to ${selectedSite.name || selectedSite.url} using 사용자명: ${selectedSite.username}`);
        setShowCreateModal(false);
        onTaskCreated?.();
      } else {
        setError(response.error || 'Failed to create custom post task');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create custom post task');
    } finally {
      setIsCreating(false);
    }
  };

  const getScheduleOptions = () => [
    { value: 'interval:300000', label: 'Every 5 minutes' },
    { value: 'interval:1800000', label: 'Every 30 minutes' },
    { value: 'interval:3600000', label: 'Every hour' },
    { value: 'interval:86400000', label: 'Every day' },
    { value: 'interval:604800000', label: 'Every week' },
    { value: 'cron:0 9 * * 1-5', label: 'Weekdays at 9 AM' },
    { value: 'cron:0 0 * * 0', label: 'Sundays at midnight' }
  ];

  if (sites.length === 0) {
    return (
      <div className="wordpress-post-scheduler">
        <div className="empty-state">
          <FontAwesomeIcon icon={faGlobe} />
          <h3>No WordPress Sites Available</h3>
          <p>Please add WordPress sites first to create scheduled posts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wordpress-post-scheduler">
      <div className="scheduler-header">
        <h3>
          <FontAwesomeIcon icon={faClock} />
          WordPress Post Scheduler
        </h3>
        <div className="header-actions">
          <button 
            className="btn btn-success"
            onClick={createDemoPostTask}
            disabled={isCreating}
          >
            <FontAwesomeIcon icon={faPlay} />
            Demo POST (5min)
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedSite || !selectedSite.password}
            title={!selectedSite ? 'Please select a WordPress site first' : !selectedSite.password ? 'WordPress 비밀번호가 필요합니다' : 'Create a custom post task'}
          >
            <FontAwesomeIcon icon={faPlus} />
            Create Post Task
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
        <label htmlFor="site-select">Select WordPress Site:</label>
        <select
          id="site-select"
          value={selectedSite?.id || ''}
          onChange={(e) => {
            const site = sites.find(s => s.id === e.target.value);
            setSelectedSite(site || null);
          }}
        >
          <option value="">Choose a site...</option>
          {sites.map(site => (
            <option key={site.id} value={site.id}>
              {site.name || site.url} ({site.url})
            </option>
          ))}
        </select>
      </div>

      {selectedSite && (
        <div className="selected-site-info">
          <h4>Selected Site: {selectedSite.name || selectedSite.url}</h4>
          <p>URL: {selectedSite.url}</p>
          <p>사용자명: {selectedSite.username}</p>
          <p>비밀번호: {selectedSite.password ? '••••••••' : '❌ Not available'}</p>
          {!selectedSite.password && (
            <div className="credential-warning">
              ⚠️ WordPress 비밀번호가 없습니다. WordPress 연결 설정에서 비밀번호를 확인해주세요.
            </div>
          )}
        </div>
      )}

      <div className="templates-section">
        <h4>Quick Templates</h4>
        <div className="templates-grid">
          {postTemplates.map(template => (
            <div key={template.id} className="template-card">
              <h5>{template.name}</h5>
              <p className="template-title">Title: {template.title}</p>
              <p className="template-content">{template.content}</p>
              <div className="template-meta">
                <span className={`status status-${template.status}`}>
                  {template.status}
                </span>
                <span className="note">
                  Note: Categories and tags will be set to default (requires WordPress API integration)
                </span>
              </div>
              <div className="template-actions">
                <select 
                  className="schedule-select"
                  onChange={(e) => {
                    if (e.target.value) {
                      createWordPressPostTask(template, e.target.value);
                    }
                  }}
                  disabled={isCreating || !selectedSite || !selectedSite.password}
                  title={!selectedSite ? 'Please select a WordPress site first' : !selectedSite.password ? 'WordPress 비밀번호가 필요합니다' : 'Select schedule for this template'}
                >
                  <option value="">Select schedule...</option>
                  {getScheduleOptions().map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
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
  isSubmitting 
}) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    status: 'draft',
    categories: '',
    tags: '',
    schedule: 'interval:3600000' // 1 hour default
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal custom-post-modal">
        <div className="modal-header">
          <h3>Create Custom Post Task</h3>
          <button className="close-button" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="custom-post-form">
          <div className="form-group">
            <label htmlFor="title">Post Title *</label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter post title"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">Post Content *</label>
            <textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Enter post content"
              rows={4}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="status">Post Status</label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="draft">Draft</option>
              <option value="publish">Publish</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="categories">Categories (comma-separated)</label>
            <input
              id="categories"
              type="text"
              value={formData.categories}
              onChange={(e) => setFormData(prev => ({ ...prev, categories: e.target.value }))}
              placeholder="e.g., News, Updates, Reports"
            />
          </div>

          <div className="form-group">
            <label htmlFor="tags">Tags (comma-separated)</label>
            <input
              id="tags"
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="e.g., automated, daily, status"
            />
          </div>

          <div className="form-group">
            <label htmlFor="schedule">Schedule</label>
            <select
              id="schedule"
              value={formData.schedule}
              onChange={(e) => setFormData(prev => ({ ...prev, schedule: e.target.value }))}
            >
              <option value="interval:300000">Every 5 minutes</option>
              <option value="interval:1800000">Every 30 minutes</option>
              <option value="interval:3600000">Every hour</option>
              <option value="interval:86400000">Every day</option>
              <option value="interval:604800000">Every week</option>
              <option value="cron:0 9 * * 1-5">Weekdays at 9 AM</option>
              <option value="cron:0 0 * * 0">Sundays at midnight</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <FontAwesomeIcon icon={faClock} className="spinning" />
                  Creating...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheck} />
                  Create Task
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
