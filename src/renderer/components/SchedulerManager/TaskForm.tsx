import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { CreateTaskData, UpdateTaskData } from '../../services/schedulerService';
import SchedulerService from '../../services/schedulerService';
import './TaskForm.css';

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: CreateTaskData) => Promise<void>;
  editingTask?: CreateTaskData | null;
  mode: 'create' | 'edit';
}

const TaskForm: React.FC<TaskFormProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  editingTask, 
  mode 
}) => {
  const [formData, setFormData] = useState<CreateTaskData>({
    name: '',
    description: '',
    command: '',
    schedule: 'interval:300000', // 5 minutes default
    enabled: true,
    workingDirectory: '',
    environment: {},
    outputFile: '',
    errorFile: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduleType, setScheduleType] = useState<'interval' | 'cron'>('interval');
  const [intervalValue, setIntervalValue] = useState(5);
  const [intervalUnit, setIntervalUnit] = useState<'seconds' | 'minutes' | 'hours' | 'days'>('minutes');
  const [cronExpression, setCronExpression] = useState('0 9 * * 1-5'); // 9 AM weekdays

  const schedulerService = SchedulerService.getInstance();

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && editingTask) {
        setFormData(editingTask as CreateTaskData);
        
        // Parse schedule type
        if (editingTask.schedule?.startsWith('interval:')) {
          setScheduleType('interval');
          const interval = parseInt(editingTask.schedule.replace('interval:', ''));
          setIntervalValue(interval / 1000); // Convert to seconds for display
          setIntervalUnit('seconds');
        } else if (editingTask.schedule?.startsWith('cron:')) {
          setScheduleType('cron');
          setCronExpression(editingTask.schedule.replace('cron:', ''));
        }
      } else {
        // Reset form for create mode
        setFormData({
          name: '',
          description: '',
          command: '',
          schedule: 'interval:300000',
          enabled: true,
          workingDirectory: '',
          environment: {},
          outputFile: '',
          errorFile: ''
        });
        setScheduleType('interval');
        setIntervalValue(5);
        setIntervalUnit('minutes');
        setCronExpression('0 9 * * 1-5');
      }
      setErrors({});
    }
  }, [isOpen, mode, editingTask]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Task name is required';
    }

    if (!formData.command.trim()) {
      newErrors.command = 'Command is required';
    }

    // Validate schedule
    const scheduleValidation = schedulerService.validateSchedule(formData.schedule);
    if (!scheduleValidation.valid) {
      newErrors.schedule = scheduleValidation.error || 'Invalid schedule';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleScheduleTypeChange = (type: 'interval' | 'cron') => {
    setScheduleType(type);
    if (type === 'interval') {
      updateScheduleFromInterval();
    } else {
      setFormData(prev => ({ ...prev, schedule: `cron:${cronExpression}` }));
    }
  };

  const updateScheduleFromInterval = () => {
    let milliseconds = intervalValue;
    
    switch (intervalUnit) {
      case 'seconds':
        milliseconds *= 1000;
        break;
      case 'minutes':
        milliseconds *= 60 * 1000;
        break;
      case 'hours':
        milliseconds *= 60 * 60 * 1000;
        break;
      case 'days':
        milliseconds *= 24 * 60 * 60 * 1000;
        break;
    }

    setFormData(prev => ({ ...prev, schedule: `interval:${milliseconds}` }));
  };

  const handleIntervalChange = () => {
    updateScheduleFromInterval();
  };

  const handleCronChange = (value: string) => {
    setCronExpression(value);
    setFormData(prev => ({ ...prev, schedule: `cron:${value}` }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CreateTaskData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const createHttpRequestTask = () => {
    const url = 'https://demo-chatbot-iota.vercel.app/';
    const command = `curl -X GET "${url}"`;
    
    setFormData(prev => ({
      ...prev,
      name: 'HTTP Request to Demo Chatbot',
      description: `Sends a GET request to ${url}`,
      command: command,
      schedule: 'interval:300000', // 5 minutes
      enabled: true
    }));
    
    setScheduleType('interval');
    setIntervalValue(5);
    setIntervalUnit('minutes');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal task-form-modal">
        <div className="modal-header">
          <h3>{mode === 'create' ? 'Create New Task' : 'Edit Task'}</h3>
          <button className="close-button" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="task-form">
          <div className="form-section">
            <h4>Quick Templates</h4>
            <div className="template-buttons">
              <button 
                type="button" 
                className="btn btn-outline"
                onClick={createHttpRequestTask}
              >
                <FontAwesomeIcon icon={faCheck} />
                HTTP Request (5 min)
              </button>
            </div>
          </div>

          <div className="form-section">
            <h4>Basic Information</h4>
            
            <div className="form-group">
              <label htmlFor="name">Task Name *</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Backup Database"
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-message">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Optional description of what this task does"
                rows={3}
              />
            </div>
          </div>

          <div className="form-section">
            <h4>Command</h4>
            
            <div className="form-group">
              <label htmlFor="command">Command to Execute *</label>
              <textarea
                id="command"
                value={formData.command}
                onChange={(e) => handleInputChange('command', e.target.value)}
                placeholder="e.g., curl -X GET 'https://api.example.com/status'"
                rows={3}
                className={errors.command ? 'error' : ''}
              />
              {errors.command && <span className="error-message">{errors.command}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="workingDirectory">Working Directory</label>
              <input
                id="workingDirectory"
                type="text"
                value={formData.workingDirectory}
                onChange={(e) => handleInputChange('workingDirectory', e.target.value)}
                placeholder="Leave empty to use home directory"
              />
            </div>
          </div>

          <div className="form-section">
            <h4>Schedule</h4>
            
            <div className="schedule-type-selector">
              <button
                type="button"
                className={`schedule-type-btn ${scheduleType === 'interval' ? 'active' : ''}`}
                onClick={() => handleScheduleTypeChange('interval')}
              >
                Interval
              </button>
              <button
                type="button"
                className={`schedule-type-btn ${scheduleType === 'cron' ? 'active' : ''}`}
                onClick={() => handleScheduleTypeChange('cron')}
              >
                Cron Expression
              </button>
            </div>

            {scheduleType === 'interval' && (
              <div className="interval-settings">
                <div className="form-group">
                  <label>Run every</label>
                  <div className="interval-inputs">
                    <input
                      type="number"
                      min="1"
                      value={intervalValue}
                      onChange={(e) => {
                        setIntervalValue(parseInt(e.target.value) || 1);
                        setTimeout(handleIntervalChange, 0);
                      }}
                      className="interval-number"
                    />
                    <select
                      value={intervalUnit}
                      onChange={(e) => {
                        setIntervalUnit(e.target.value as any);
                        setTimeout(handleIntervalChange, 0);
                      }}
                      className="interval-unit"
                    >
                      <option value="seconds">Seconds</option>
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {scheduleType === 'cron' && (
              <div className="cron-settings">
                <div className="form-group">
                  <label htmlFor="cronExpression">Cron Expression</label>
                  <input
                    id="cronExpression"
                    type="text"
                    value={cronExpression}
                    onChange={(e) => handleCronChange(e.target.value)}
                    placeholder="0 9 * * 1-5 (9 AM weekdays)"
                    className={errors.schedule ? 'error' : ''}
                  />
                  {errors.schedule && <span className="error-message">{errors.schedule}</span>}
                  <div className="cron-help">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    Format: minute hour day month weekday
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="form-section">
            <h4>Advanced Settings</h4>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => handleInputChange('enabled', e.target.checked)}
                />
                <span>Enable this task</span>
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="outputFile">Output File (optional)</label>
              <input
                id="outputFile"
                type="text"
                value={formData.outputFile}
                onChange={(e) => handleInputChange('outputFile', e.target.value)}
                placeholder="e.g., /tmp/task-output.log"
              />
            </div>

            <div className="form-group">
              <label htmlFor="errorFile">Error File (optional)</label>
              <input
                id="errorFile"
                type="text"
                value={formData.errorFile}
                onChange={(e) => handleInputChange('errorFile', e.target.value)}
                placeholder="e.g., /tmp/task-errors.log"
              />
            </div>
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
                  <FontAwesomeIcon icon={faCheck} className="spinning" />
                  {mode === 'create' ? 'Creating...' : 'Saving...'}
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheck} />
                  {mode === 'create' ? 'Create Task' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;
