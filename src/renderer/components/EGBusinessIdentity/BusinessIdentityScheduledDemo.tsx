import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarAlt,
  faClock,
  faInfoCircle,
  faTag,
  faUser,
  faExternalLinkAlt,
  faKey,
} from '../../utils/fontAwesomeIcons';
import { faHashtag } from '@fortawesome/free-solid-svg-icons/faHashtag';
import { faPlay, faPause } from '@fortawesome/free-solid-svg-icons';
import AccountSelector from './AccountSelector';
import { aiKeysStore } from '../AIKeysManager/store/aiKeysStore';
import type { AIKey } from '../AIKeysManager/types';

// Import image format utility (we'll need to expose this from main process or create a renderer version)
// For now, we'll create a simple helper function
const getImageFormatForChannel = (channel: string): string | null => {
  const normalized = channel.toLowerCase().trim();
  
  if (normalized.includes('instagram')) {
    return '1:1';
  }
  if (normalized.includes('twitter') || normalized === 'x') {
    return '16:9';
  }
  if (normalized.includes('facebook') || normalized === 'fb') {
    return '16:9';
  }
  if (normalized.includes('youtube') || normalized === 'yt') {
    return '16:9';
  }
  if (normalized.includes('tiktok') || normalized === 'tt') {
    return '9:16';
  }
  if (normalized.includes('wordpress') || normalized === 'wp') {
    return '16:9';
  }
  if (normalized.includes('naver')) {
    return '16:9';
  }
  if (normalized.includes('tistory')) {
    return '16:9';
  }
  if (normalized === 'blog') {
    return '16:9';
  }
  
  return null;
};

export type BusinessIdentityChannel = 'Instagram' | 'Twitter' | 'LinkedIn' | 'Blog' | string;

export interface BusinessIdentityScheduledTask {
  id: string;
  planId?: string; // SQLite plan ID (optional for demo tasks)
  channel: BusinessIdentityChannel;
  title: string;
  summary: string;
  schedule: {
    frequency: 'daily' | 'weekly' | 'custom';
    dayLabel: string;
    time: string;
  };
  topics: string[];
  format: string;
  notes?: string;
  isActive?: boolean; // Whether the schedule is currently active/running
  connectionId?: string | null;
  connectionName?: string | null;
  connectionType?: string | null;
  aiKeyId?: string | null;
}

export const businessIdentityDemoTasks: BusinessIdentityScheduledTask[] = [
  {
    id: 'instagram-midweek-spotlight',
    channel: 'Instagram',
    title: 'Cursor Spotlight – Midweek Build',
    summary: 'Show the latest Cursor-assisted build or workflow.',
    schedule: { frequency: 'weekly', dayLabel: 'Wednesday', time: '11:00 AM' },
    topics: ['Dev setup tips', 'AI-as-copilot wins', 'Team behind the scenes'],
    format: 'Carousel or short Reel with captions pulled from release notes.',
    notes: 'Pair with a carousel that teases what shipped on Monday.',
  },
  {
    id: 'instagram-weekend-community',
    channel: 'Instagram',
    title: 'Weekend Wrap – Cursor Community',
    summary: 'Highlight makers and top #BuiltWithCursor posts.',
    schedule: { frequency: 'weekly', dayLabel: 'Saturday', time: '09:30 AM' },
    topics: ['Maker shoutouts', 'Feature polls', 'UGC compilations'],
    format: 'Single image or Reel, CTA to submit the next project.',
  },
  {
    id: 'twitter-shipping-log',
    channel: 'Twitter',
    title: 'Shipping Log – Monday Kickoff',
    summary: 'Thread summarizing the new sprint, goals, and beta signups.',
    schedule: { frequency: 'weekly', dayLabel: 'Monday', time: '08:00 AM' },
    topics: ['Roadmap teasers', 'Sprint goals', 'Beta invites'],
    format: 'Thread (3–4 posts) linking to GitHub changelog.',
  },
  {
    id: 'twitter-tip-thursday',
    channel: 'Twitter',
    title: 'Tip Thursday – Cursor Cheat Codes',
    summary: 'Share concrete prompts or shortcuts inside Cursor.',
    schedule: { frequency: 'weekly', dayLabel: 'Thursday', time: '04:00 PM' },
    topics: ['Command palette tricks', 'Prompt engineering', 'Debug workflows'],
    format: 'Short video or GIF with plaintext code block.',
  },
  {
    id: 'linkedin-founder-pov',
    channel: 'LinkedIn',
    title: 'Founder POV – Cursor Vision',
    summary: 'Long-form POV on AI pair programming or a customer story.',
    schedule: { frequency: 'weekly', dayLabel: 'Tuesday', time: '01:00 PM' },
    topics: ['Future of AI pair programming', 'Case studies', 'Culture & hiring'],
    format: 'LinkedIn article or PDF carousel with key metrics.',
  },
  {
    id: 'blog-cursor-lab-notes',
    channel: 'Blog',
    title: 'Cursor Lab Notes',
    summary: 'Bi-weekly deep dive that powers other channel snippets.',
    schedule: { frequency: 'custom', dayLabel: 'Every 2nd Friday', time: '10:00 AM' },
    topics: ['Release breakdowns', 'Benchmarks', 'Security & compliance'],
    format: 'Long-form blog post feeding the rest of the weekly content.',
    notes: 'Trigger blog automation flow, then repurpose across channels.',
  },
];

export interface BusinessIdentityScheduledDemoProps {
  tasks?: BusinessIdentityScheduledTask[];
  renderTask?: (task: BusinessIdentityScheduledTask) => React.ReactNode;
  onTaskSelect?: (task: BusinessIdentityScheduledTask) => void;
  onTestPost?: (task: BusinessIdentityScheduledTask, credentials?: { username: string; password: string }) => void;
  onToggleSchedule?: (task: BusinessIdentityScheduledTask, isActive: boolean) => void;
  onAccountChange?: (task: BusinessIdentityScheduledTask, connectionId: string | null, connectionName: string | null, connectionType: string | null) => void;
  onAIKeyChange?: (task: BusinessIdentityScheduledTask, aiKeyId: string | null) => void;
  onInstagramCredentialsChange?: (task: BusinessIdentityScheduledTask, username: string, password: string) => void;
  onBlogCredentialsChange?: (task: BusinessIdentityScheduledTask, username: string, password: string) => void;
  onCredentialsChange?: (task: BusinessIdentityScheduledTask, username: string, password: string) => void; // Generic credentials change for all channels
  hasAccountForChannel?: (channel: string, task?: BusinessIdentityScheduledTask) => boolean; // Check if account exists for a channel
  getAvailableConnections?: (channel: string) => Promise<Array<{ id: string; name: string; type: string }>>; // Get available connections for a channel
}

const BusinessIdentityScheduledDemo: React.FC<BusinessIdentityScheduledDemoProps> = ({
  tasks,
  renderTask,
  onTaskSelect,
  onTestPost,
  onToggleSchedule,
  onAccountChange,
  onAIKeyChange,
  onInstagramCredentialsChange,
  onBlogCredentialsChange,
  onCredentialsChange,
  hasAccountForChannel,
  getAvailableConnections,
}) => {
  const navigate = useNavigate();
  const items = tasks?.length ? tasks : businessIdentityDemoTasks;
  
  // Get AI keys from store
  const [aiKeysState, setAiKeysState] = useState(aiKeysStore.getState());
  const googleKeys = useMemo(
    () => aiKeysState.keys.filter((key) => key.providerId === 'google' && key.isActive),
    [aiKeysState.keys]
  );

  useEffect(() => {
    const unsubscribe = aiKeysStore.subscribe(setAiKeysState);
    return unsubscribe;
  }, []);
  
  // Track active state for each task (defaults to false if not provided)
  const [taskStates, setTaskStates] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    items.forEach((task) => {
      initialState[task.id] = task.isActive ?? false;
    });
    return initialState;
  });

  // Track credentials per task for all channels
  const [taskCredentials, setTaskCredentials] = useState<Record<string, { username: string; password: string; url?: string }>>({});
  
  // Track Instagram credentials per task (for backward compatibility)
  const [instagramCredentials, setInstagramCredentials] = useState<Record<string, { username: string; password: string }>>({});
  
  // Track blog credentials per task (for backward compatibility)
  const [blogCredentials, setBlogCredentials] = useState<Record<string, { username: string; password: string }>>({});
  
  // Helper function to check if a channel is WordPress
  const isWordPressChannel = (channel: string): boolean => {
    const normalized = channel.toLowerCase().trim();
    return normalized.includes('wordpress') || normalized === 'wp';
  };
  
  // Helper function to check if a channel is a blog channel
  const isBlogChannel = (channel: string): boolean => {
    const normalized = channel.toLowerCase().trim();
    return normalized.includes('wordpress') || 
           normalized.includes('naver') || 
           normalized.includes('tistory') || 
           normalized === 'blog' ||
           normalized === 'wp';
  };

  // Helper function to check if a channel is a social media channel (Instagram, YouTube)
  const isSocialMediaChannel = (channel: string): boolean => {
    const normalized = channel.toLowerCase().trim();
    return normalized.includes('instagram') || 
           normalized.includes('youtube') || 
           normalized === 'yt';
  };

  // Sync task states when tasks change
  useEffect(() => {
    const newStates: Record<string, boolean> = {};
    items.forEach((task) => {
      newStates[task.id] = task.isActive ?? taskStates[task.id] ?? false;
    });
    setTaskStates(newStates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, items.map((t) => t.id).join(',')]); // Update when task IDs change

  const handleToggleSchedule = (task: BusinessIdentityScheduledTask, event: React.MouseEvent) => {
    event.stopPropagation();
    const newState = !taskStates[task.id];
    setTaskStates((prev) => ({ ...prev, [task.id]: newState }));
    onToggleSchedule?.(task, newState);
  };

  if (!items.length) {
    return null;
  }

  if (renderTask) {
    return (
      <div className="egbusiness-identity__scheduled-demo">
        {items.map((task) => (
          <div
            key={task.id}
            className="egbusiness-identity__scheduled-demo-item"
            onClick={() => onTaskSelect?.(task)}
          >
            {renderTask(task)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="egbusiness-identity__scheduled-demo">
      {items.map((task) => (
        <article
          key={task.id}
          className="egbusiness-identity__scheduled-demo-card"
          onClick={(e) => {
            // Don't trigger task selection if clicking on interactive elements
            const target = e.target as HTMLElement;
            if (
              target.closest('.egbusiness-identity__account-selector') ||
              target.closest('button') ||
              target.closest('input') ||
              target.closest('a')
            ) {
              return;
            }
            onTaskSelect?.(task);
          }}
        >
          <header>
            <div className="egbusiness-identity__scheduled-demo-channel">
              <FontAwesomeIcon icon={faTag} /> {task.channel}
            </div>
            <h4>{task.title}</h4>
            <p>{task.summary}</p>
          </header>

          <section className="egbusiness-identity__scheduled-demo-meta">
            <div>
              <FontAwesomeIcon icon={faCalendarAlt} />
              <span>{task.schedule.dayLabel}</span>
            </div>
            <div>
              <FontAwesomeIcon icon={faClock} />
              <span>{task.schedule.time}</span>
            </div>
            <div>
              <FontAwesomeIcon icon={faInfoCircle} />
              <span>{task.schedule.frequency === 'custom' ? 'Custom cadence' : 'Weekly cadence'}</span>
            </div>
          </section>

          <section className="egbusiness-identity__scheduled-demo-topics">
            <FontAwesomeIcon icon={faHashtag} />
            <div>
              {task.topics.map((topic) => (
                <span key={topic}>{topic}</span>
              ))}
            </div>
          </section>

          <section className="egbusiness-identity__scheduled-demo-account">
            <FontAwesomeIcon icon={faUser} />
            <div className="egbusiness-identity__instagram-credentials">
              {/* AccountSelector for blog platforms (WordPress, Naver, Tistory) and social media (Instagram, YouTube) */}
              {(isBlogChannel(task.channel) || isSocialMediaChannel(task.channel)) && (
                <AccountSelector
                  task={task}
                  onAccountChange={onAccountChange}
                  getAvailableConnections={getAvailableConnections}
                />
              )}
              {/* Username and password inputs for unsupported channels */}
              {!isBlogChannel(task.channel) && !isSocialMediaChannel(task.channel) && (
                <>
                  <input
                    type="text"
                    placeholder={`${task.channel} username`}
                    value={taskCredentials[task.id]?.username || ''}
                    onChange={(e) => {
                      const newCreds = { ...taskCredentials[task.id], username: e.target.value };
                      setTaskCredentials({ ...taskCredentials, [task.id]: newCreds });
                      // Call generic handler first, then specific handlers for backward compatibility
                      onCredentialsChange?.(task, newCreds.username, newCreds.password || '');
                      if (task.channel.toLowerCase() === 'instagram') {
                        onInstagramCredentialsChange?.(task, newCreds.username, newCreds.password || '');
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="egbusiness-identity__instagram-input"
                  />
                  <input
                    type="password"
                    placeholder={`${task.channel} password`}
                    value={taskCredentials[task.id]?.password || ''}
                    onChange={(e) => {
                      const newCreds = { ...taskCredentials[task.id], password: e.target.value };
                      setTaskCredentials({ ...taskCredentials, [task.id]: newCreds });
                      // Call generic handler first, then specific handlers for backward compatibility
                      onCredentialsChange?.(task, newCreds.username || '', newCreds.password);
                      if (task.channel.toLowerCase() === 'instagram') {
                        onInstagramCredentialsChange?.(task, newCreds.username || '', newCreds.password);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="egbusiness-identity__instagram-input"
                  />
                </>
              )}
            </div>
          </section>

          {/* AI Key Selector */}
          {googleKeys.length > 0 && (
            <section className="egbusiness-identity__scheduled-demo-ai-key">
              <FontAwesomeIcon icon={faKey} />
              <div className="egbusiness-identity__ai-key-selector">
                <select
                  value={task.aiKeyId || ''}
                  onChange={(e) => {
                    const aiKeyId = e.target.value || null;
                    onAIKeyChange?.(task, aiKeyId);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="egbusiness-identity__ai-key-select"
                >
                  <option value="">Use default AI key</option>
                  {googleKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          )}

          <footer>
            <div className="egbusiness-identity__scheduled-demo-format-container">
              <p className="egbusiness-identity__scheduled-demo-format">{task.format}</p>
              {getImageFormatForChannel(task.channel) && (
                <span className="egbusiness-identity__image-format-badge">
                  {getImageFormatForChannel(task.channel)} format
                </span>
              )}
            </div>
            {task.notes && <p className="egbusiness-identity__scheduled-demo-notes">{task.notes}</p>}
            <div className="egbusiness-identity__scheduled-demo-actions">
              <button
                type="button"
                className="egbusiness-identity__scheduled-demo-action-toggle"
                onClick={(event) => handleToggleSchedule(task, event)}
                disabled={hasAccountForChannel ? !hasAccountForChannel(task.channel, task) : false}
                title={
                  hasAccountForChannel && !hasAccountForChannel(task.channel, task)
                    ? `No ${task.channel} account configured. Please add account credentials first.`
                    : taskStates[task.id]
                      ? 'Pause schedule'
                      : 'Start schedule'
                }
              >
                <FontAwesomeIcon icon={taskStates[task.id] ? faPause : faPlay} />
                <span>{taskStates[task.id] ? 'Pause' : 'Start'}</span>
              </button>
              {isBlogChannel(task.channel) && task.connectionId && task.connectionType && (
                <button
                  type="button"
                  className="egbusiness-identity__scheduled-demo-action-dashboard"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate('/blog-connector', {
                      state: {
                        connectionId: task.connectionId,
                        connectionName: task.connectionName,
                        connectionType: task.connectionType,
                        activeTab: 'scheduled'
                      }
                    });
                  }}
                  title="Open Scheduled Posts"
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                  <span>Scheduled Posts</span>
                </button>
              )}
              {isSocialMediaChannel(task.channel) && (
                <button
                  type="button"
                  className="egbusiness-identity__scheduled-demo-action-dashboard"
                  onClick={(event) => {
                    event.stopPropagation();
                    // If connection info is available, navigate to specific connection dashboard
                    // Otherwise, navigate to general social media dashboard
                    if (task.connectionId && task.connectionType) {
                      navigate('/social-media', {
                        state: {
                          connectionId: task.connectionId,
                          connectionName: task.connectionName,
                          connectionType: task.connectionType,
                          activeTab: 'scheduled'
                        }
                      });
                    } else {
                      // Navigate to social media dashboard without specific connection
                      navigate('/social-media');
                    }
                  }}
                  title={task.connectionId && task.connectionType ? "Open Social Media Dashboard" : "Go to Social Media Dashboard"}
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                  <span>Dashboard</span>
                </button>
              )}
            </div>
          </footer>
        </article>
      ))}
    </div>
  );
};

export default BusinessIdentityScheduledDemo;

