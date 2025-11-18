/**
 * Utility functions for Business Identity components
 */

import type { SnsPlanEntry, BusinessIdentitySnsPlanInput } from './types';

export const DEFAULT_SNS_PLAN_TIME = '09:00';

export const normalizeCadenceType = (value?: string): 'daily' | 'weekly' | 'monthly' | 'custom' => {
  if (!value) return 'custom';
  const normalized = value.toLowerCase();
  if (normalized === 'daily' || normalized === 'weekly' || normalized === 'monthly' || normalized === 'custom') {
    return normalized;
  }
  return 'custom';
};

export const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const normalizeTimeString = (value?: string): string => {
  if (!value) return DEFAULT_SNS_PLAN_TIME;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return DEFAULT_SNS_PLAN_TIME;
  const hours = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minutes = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const getBrandKeyFromValue = (value: string): string => {
  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
    return parsed.hostname?.toLowerCase() || parsed.toString();
  } catch {
    return value.trim().toLowerCase();
  }
};

export const buildAssetsPayload = (plan: SnsPlanEntry): Record<string, any> | null => {
  const assets: Record<string, any> = {
    mediaStyle: plan.assets?.mediaStyle,
    copyGuidelines: plan.assets?.copyGuidelines,
    cta: plan.assets?.cta,
    extraNotes: plan.assets?.extraNotes ?? null,
    summary: plan.summary,
  };

  const entries = Object.entries(assets).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );

  if (entries.length === 0) {
    return null;
  }

  return entries.reduce<Record<string, any>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
};

export const mapSnsPlanEntriesToStorage = (
  snapshotId: string,
  plans: SnsPlanEntry[]
): BusinessIdentitySnsPlanInput[] =>
  plans.map((plan, index) => {
    const topics = Array.isArray(plan.topics)
      ? plan.topics.filter((topic) => typeof topic === 'string' && topic.trim().length > 0)
      : [];

    return {
      snapshotId,
      channel: plan.channel?.trim() || `Channel ${index + 1}`,
      title: plan.title?.trim() || `Plan ${index + 1}`,
      cadenceType: normalizeCadenceType(plan.cadence?.type),
      cadenceValue: isFiniteNumber(plan.cadence?.customDays) ? plan.cadence?.customDays ?? null : null,
      dayOfWeek: isFiniteNumber(plan.cadence?.dayOfWeek) ? plan.cadence?.dayOfWeek ?? null : null,
      dayOfMonth: isFiniteNumber(plan.cadence?.dayOfMonth) ? plan.cadence?.dayOfMonth ?? null : null,
      scheduledTime: normalizeTimeString(plan.cadence?.time),
      topics,
      assets: buildAssetsPayload(plan),
      connectionId: plan.connectionId ?? null,
      connectionName: plan.connectionName ?? null,
      connectionType: plan.connectionType ?? null,
      enabled: true,
    };
  });

/**
 * Check if a channel is a blog platform (WordPress, Naver, Tistory)
 */
export function isBlogChannel(channel: string): boolean {
  const normalized = channel.toLowerCase().trim();
  return (
    normalized.includes('wordpress') ||
    normalized.includes('naver') ||
    normalized.includes('tistory') ||
    normalized === 'wp' ||
    normalized === 'blog'
  );
}

/**
 * Handle schedule toggle for blog channels - creates or toggles scheduled posts
 */
export async function handleBlogScheduleToggle(
  task: import('./BusinessIdentityScheduledDemo').BusinessIdentityScheduledTask,
  isActive: boolean,
  snsPlan?: SnsPlanEntry[]
): Promise<{ success: boolean; error?: string; scheduledPostId?: string }> {
  // Only handle blog channels
  if (!isBlogChannel(task.channel)) {
    return { success: false, error: 'This function only handles blog channels' };
  }

  try {
    // Find the matching SNS plan entry first (it has the most up-to-date connection info)
    const planEntry = snsPlan?.find((p) => p.planId === task.planId || p.title === task.title);
    if (!planEntry) {
      return { success: false, error: 'SNS plan entry not found' };
    }

    // Use connection info from plan entry (most up-to-date) or fall back to task
    const connectionId = planEntry.connectionId || task.connectionId;
    const connectionName = planEntry.connectionName || task.connectionName;
    const connectionType = planEntry.connectionType || task.connectionType;

    // Check if connection is selected
    if (!connectionId || !connectionName || !connectionType) {
      console.log('[handleBlogScheduleToggle] Missing connection info:', {
        planEntry: {
          connectionId: planEntry.connectionId,
          connectionName: planEntry.connectionName,
          connectionType: planEntry.connectionType,
        },
        task: {
          connectionId: task.connectionId,
          connectionName: task.connectionName,
          connectionType: task.connectionType,
        },
      });
      return { success: false, error: 'Please select a blog connection first' };
    }

    // Check if a scheduled post already exists for this connection and title
    // Use planEntry.title as the source of truth (it's the SNS plan's name)
    const planTitle = planEntry.title || task.title;
    const existingPostsResult = await window.electron.scheduledPosts.getByConnection(connectionId);
    const existingPost = existingPostsResult.success && existingPostsResult.data
      ? existingPostsResult.data.find((post: any) => post.title === planTitle)
      : null;

    if (isActive) {
      // Activate: Create or enable scheduled post
      if (existingPost) {
        // Update existing scheduled post
        const updateResult = await window.electron.scheduledPosts.toggle(existingPost.id, true);
        if (updateResult.success) {
          return { success: true, scheduledPostId: existingPost.id };
        } else {
          return { success: false, error: updateResult.error || 'Failed to enable scheduled post' };
        }
      } else {
        // Create new scheduled post
        const { convertSnsPlanToScheduledPost, mapChannelToConnectionType } = await import('./snsPlanToScheduledPost');
        
        // Normalize connection type to lowercase for scheduler compatibility
        const normalizedConnectionType = mapChannelToConnectionType(task.channel);
        if (!normalizedConnectionType) {
          return { success: false, error: 'Invalid connection type for channel' };
        }
        
        const connection = {
          id: connectionId, // Use connectionId from planEntry or task
          name: connectionName, // Use connectionName from planEntry or task
          type: normalizedConnectionType, // Use normalized type (wordpress, naver, tistory)
        };

        const scheduledPostData = convertSnsPlanToScheduledPost(planEntry, connection);
        if (!scheduledPostData) {
          return { success: false, error: 'Failed to convert SNS plan to scheduled post format' };
        }

        // Get active AI key if available
        const aiKeyId = null; // TODO: Get from active AI key selector if needed

        const createResult = await window.electron.scheduledPosts.create({
          ...scheduledPostData,
          aiKeyId,
        });

        if (createResult.success) {
          return { success: true, scheduledPostId: createResult.data?.id };
        } else {
          return { success: false, error: createResult.error || 'Failed to create scheduled post' };
        }
      }
    } else {
      // Deactivate: Disable scheduled post
      if (existingPost) {
        const toggleResult = await window.electron.scheduledPosts.toggle(existingPost.id, false);
        if (toggleResult.success) {
          return { success: true, scheduledPostId: existingPost.id };
        } else {
          return { success: false, error: toggleResult.error || 'Failed to disable scheduled post' };
        }
      } else {
        // No existing post to disable
        return { success: true };
      }
    }
  } catch (error) {
    console.error('[handleBlogScheduleToggle] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

