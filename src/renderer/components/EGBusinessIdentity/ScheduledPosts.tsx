/**
 * Scheduled Posts Component
 * Component for managing scheduled SNS posts
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt } from '../../utils/fontAwesomeIcons';
import BusinessIdentityScheduledDemo, { BusinessIdentityScheduledTask } from './BusinessIdentityScheduledDemo';

interface ScheduledPostsProps {
  instagramUsername: string;
  instagramPassword: string;
  onInstagramUsernameChange: (username: string) => void;
  onInstagramPasswordChange: (password: string) => void;
  onTestPost: (task: BusinessIdentityScheduledTask) => void;
  onToggleSchedule: (task: BusinessIdentityScheduledTask, isActive: boolean) => void;
  hasAccountForChannel: (channel: string) => boolean;
}

export const ScheduledPosts: React.FC<ScheduledPostsProps> = ({
  instagramUsername,
  instagramPassword,
  onInstagramUsernameChange,
  onInstagramPasswordChange,
  onTestPost,
  onToggleSchedule,
  hasAccountForChannel,
}) => {
  return (
    <section className="egbusiness-identity__panel egbusiness-identity__panel--scheduled">
      <div className="egbusiness-identity__panel-heading">
        <span className="egbusiness-identity__icon">
          <FontAwesomeIcon icon={faCalendarAlt} />
        </span>
        <div>
          <h2>Schedule Identity Deliverables</h2>
          <p>Plan recurring content tasks aligned with your business identity strategy.</p>
        </div>
      </div>
      <p className="egbusiness-identity__hint">
        Start from these Cursor-themed example cadences or replace them with your own. Automated scheduling is coming
        soon.
      </p>
      <div className="egbusiness-identity__credentials">
        <div>
          <label htmlFor="instagram-username">Instagram Username</label>
          <input
            id="instagram-username"
            type="text"
            autoComplete="username"
            placeholder="username"
            value={instagramUsername}
            onChange={(event) => onInstagramUsernameChange(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="instagram-password">Instagram Password</label>
          <input
            id="instagram-password"
            type="password"
            autoComplete="current-password"
            placeholder="password"
            value={instagramPassword}
            onChange={(event) => onInstagramPasswordChange(event.target.value)}
          />
        </div>
      </div>
      <BusinessIdentityScheduledDemo
        onTestPost={onTestPost}
        onToggleSchedule={onToggleSchedule}
        hasAccountForChannel={hasAccountForChannel}
      />
    </section>
  );
};

