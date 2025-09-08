import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faCheck,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import SchedulerService, {
  CreateTaskData,
  UpdateTaskData,
} from '../../services/schedulerService';
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
  mode,
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
    errorFile: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduleType, setScheduleType] = useState<'interval' | 'cron'>(
    'interval',
  );
  const [intervalValue, setIntervalValue] = useState(5);
  const [intervalUnit, setIntervalUnit] = useState<
    'seconds' | 'minutes' | 'hours' | 'days'
  >('minutes');
  const [cronExpression, setCronExpression] = useState('0 9 * * 1-5'); // 9 AM weekdays

  const schedulerService = SchedulerService.getInstance();

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && editingTask) {
        setFormData(editingTask as CreateTaskData);

        // Parse schedule type
        if (editingTask.schedule?.startsWith('interval:')) {
          setScheduleType('interval');
          const interval = parseInt(
            editingTask.schedule.replace('interval:', ''),
          );
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
          errorFile: '',
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
    const scheduleValidation = schedulerService.validateSchedule(
      formData.schedule,
    );
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
      setFormData((prev) => ({ ...prev, schedule: `cron:${cronExpression}` }));
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

    setFormData((prev) => ({ ...prev, schedule: `interval:${milliseconds}` }));
  };

  const handleIntervalChange = () => {
    updateScheduleFromInterval();
  };

  const handleCronChange = (value: string) => {
    setCronExpression(value);
    setFormData((prev) => ({ ...prev, schedule: `cron:${value}` }));
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

  const handleInputChange = (
    field: keyof CreateTaskData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const createHttpRequestTask = () => {
    const url = 'https://demo-chatbot-iota.vercel.app/';
    const command = `curl -X GET "${url}"`;

    setFormData((prev) => ({
      ...prev,
      name: 'HTTP Request to Demo Chatbot',
      description: `Sends a GET request to ${url}`,
      command,
      schedule: 'interval:300000', // 5 minutes
      enabled: true,
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
            <h4>빠른 템플릿</h4>
            <div className="template-buttons">
              <button
                type="button"
                className="btn btn-outline"
                onClick={createHttpRequestTask}
              >
                <FontAwesomeIcon icon={faCheck} />
                HTTP 요청 (5분)
              </button>
            </div>
          </div>

          <div className="form-section">
            <h4>기본 정보</h4>

            <div className="form-group">
              <label htmlFor="name">작업 이름 *</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="예: 데이터베이스 백업"
                className={errors.name ? 'error' : ''}
              />
              {errors.name && (
                <span className="error-message">{errors.name}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="description">설명</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange('description', e.target.value)
                }
                placeholder="이 작업이 수행하는 내용에 대한 선택적 설명"
                rows={3}
              />
            </div>
          </div>

          <div className="form-section">
            <h4>명령어</h4>

            <div className="form-group">
              <label htmlFor="command">실행할 명령어 *</label>
              <textarea
                id="command"
                value={formData.command}
                onChange={(e) => handleInputChange('command', e.target.value)}
                placeholder="예: curl -X GET 'https://api.example.com/status'"
                rows={3}
                className={errors.command ? 'error' : ''}
              />
              {errors.command && (
                <span className="error-message">{errors.command}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="workingDirectory">작업 디렉토리</label>
              <input
                id="workingDirectory"
                type="text"
                value={formData.workingDirectory}
                onChange={(e) =>
                  handleInputChange('workingDirectory', e.target.value)
                }
                placeholder="비워두면 홈 디렉토리 사용"
              />
            </div>
          </div>

          <div className="form-section">
            <h4>스케줄</h4>

            <div className="schedule-type-selector">
              <button
                type="button"
                className={`schedule-type-btn ${scheduleType === 'interval' ? 'active' : ''}`}
                onClick={() => handleScheduleTypeChange('interval')}
              >
                간격
              </button>
              <button
                type="button"
                className={`schedule-type-btn ${scheduleType === 'cron' ? 'active' : ''}`}
                onClick={() => handleScheduleTypeChange('cron')}
              >
                Cron 표현식
              </button>
            </div>

            {scheduleType === 'interval' && (
              <div className="interval-settings">
                <div className="form-group">
                  <label>실행 간격</label>
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
                      <option value="seconds">초</option>
                      <option value="minutes">분</option>
                      <option value="hours">시간</option>
                      <option value="days">일</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {scheduleType === 'cron' && (
              <div className="cron-settings">
                <div className="form-group">
                  <label htmlFor="cronExpression">Cron 표현식</label>
                  <input
                    id="cronExpression"
                    type="text"
                    value={cronExpression}
                    onChange={(e) => handleCronChange(e.target.value)}
                    placeholder="0 9 * * 1-5 (평일 오전 9시)"
                    className={errors.schedule ? 'error' : ''}
                  />
                  {errors.schedule && (
                    <span className="error-message">{errors.schedule}</span>
                  )}
                  <div className="cron-help">
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    형식: 분 시 일 월 요일
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="form-section">
            <h4>고급 설정</h4>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) =>
                    handleInputChange('enabled', e.target.checked)
                  }
                />
                <span>이 작업 활성화</span>
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="outputFile">출력 파일 (선택사항)</label>
              <input
                id="outputFile"
                type="text"
                value={formData.outputFile}
                onChange={(e) =>
                  handleInputChange('outputFile', e.target.value)
                }
                placeholder="예: /tmp/task-output.log"
              />
            </div>

            <div className="form-group">
              <label htmlFor="errorFile">오류 파일 (선택사항)</label>
              <input
                id="errorFile"
                type="text"
                value={formData.errorFile}
                onChange={(e) => handleInputChange('errorFile', e.target.value)}
                placeholder="예: /tmp/task-errors.log"
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
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <FontAwesomeIcon icon={faCheck} className="spinning" />
                  {mode === 'create' ? '생성 중...' : '저장 중...'}
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheck} />
                  {mode === 'create' ? '작업 생성' : '변경사항 저장'}
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
