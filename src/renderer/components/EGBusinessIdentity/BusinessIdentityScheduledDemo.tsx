import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarAlt,
  faClock,
  faInfoCircle,
  faTag,
} from '../../utils/fontAwesomeIcons';
import { faHashtag } from '@fortawesome/free-solid-svg-icons/faHashtag';
import { faPlay, faPause } from '@fortawesome/free-solid-svg-icons';

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
  onTestPost?: (task: BusinessIdentityScheduledTask) => void;
  onToggleSchedule?: (task: BusinessIdentityScheduledTask, isActive: boolean) => void;
  hasAccountForChannel?: (channel: string) => boolean; // Check if account exists for a channel
}

const BusinessIdentityScheduledDemo: React.FC<BusinessIdentityScheduledDemoProps> = ({
  tasks,
  renderTask,
  onTaskSelect,
  onTestPost,
  onToggleSchedule,
  hasAccountForChannel,
}) => {
  const items = tasks?.length ? tasks : businessIdentityDemoTasks;
  
  // Track active state for each task (defaults to false if not provided)
  const [taskStates, setTaskStates] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    items.forEach((task) => {
      initialState[task.id] = task.isActive ?? false;
    });
    return initialState;
  });

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
          onClick={() => onTaskSelect?.(task)}
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

          <footer>
            <p className="egbusiness-identity__scheduled-demo-format">{task.format}</p>
            {task.notes && <p className="egbusiness-identity__scheduled-demo-notes">{task.notes}</p>}
            <div className="egbusiness-identity__scheduled-demo-actions">
              <button
                type="button"
                className="egbusiness-identity__scheduled-demo-action-toggle"
                onClick={(event) => handleToggleSchedule(task, event)}
                disabled={hasAccountForChannel ? !hasAccountForChannel(task.channel) : false}
                title={
                  hasAccountForChannel && !hasAccountForChannel(task.channel)
                    ? `No ${task.channel} account configured. Please add account credentials first.`
                    : taskStates[task.id]
                      ? 'Pause schedule'
                      : 'Start schedule'
                }
              >
                <FontAwesomeIcon icon={taskStates[task.id] ? faPause : faPlay} />
                <span>{taskStates[task.id] ? 'Pause' : 'Start'}</span>
              </button>
              <button
                type="button"
                className="egbusiness-identity__scheduled-demo-action-test"
                onClick={(event) => {
                  event.stopPropagation();
                  if (onTestPost) {
                    onTestPost(task);
                  } else {
                    console.info('[BusinessIdentityScheduledDemo] Test Post clicked:', task.id);
                  }
                }}
              >
                Test Post
              </button>
            </div>
          </footer>
        </article>
      ))}
    </div>
  );
};

export default BusinessIdentityScheduledDemo;

