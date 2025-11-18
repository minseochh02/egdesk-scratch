/**
 * Conversion utilities to transform Business Identity SNS Plans to Scheduled Posts
 * for blog platforms (WordPress, Naver Blog, Tistory)
 */

import type { SnsPlanEntry } from './types';
import type { CreateScheduledPostData } from '../../../main/sqlite/scheduled-posts';

export interface BlogConnection {
  id: string;
  name: string;
  type: 'wordpress' | 'naver' | 'tistory';
}

/**
 * Map channel name from AI to connection type for scheduler
 */
export function mapChannelToConnectionType(channel: string): 'wordpress' | 'naver' | 'tistory' | null {
  const normalized = channel.toLowerCase().trim();
  
  if (normalized.includes('wordpress') || normalized === 'wp') {
    return 'wordpress';
  }
  if (normalized.includes('naver') || normalized.includes('naver blog')) {
    return 'naver';
  }
  if (normalized.includes('tistory')) {
    return 'tistory';
  }
  
  return null;
}

/**
 * Convert cadence type to frequency type
 */
export function mapCadenceToFrequency(
  cadenceType: string,
  cadenceValue?: number | null
): { frequencyType: 'daily' | 'weekly' | 'monthly' | 'custom'; frequencyValue: number } {
  const normalized = cadenceType?.toLowerCase().trim() || 'custom';
  
  switch (normalized) {
    case 'daily':
      return { frequencyType: 'daily', frequencyValue: 1 };
    case 'weekly':
      return { frequencyType: 'weekly', frequencyValue: cadenceValue || 1 };
    case 'monthly':
      return { frequencyType: 'monthly', frequencyValue: cadenceValue || 1 };
    default:
      return { frequencyType: 'custom', frequencyValue: cadenceValue || 1 };
  }
}

/**
 * Convert SNS plan entry to scheduled post data
 * Requires matching the channel to an actual blog connection
 */
export function convertSnsPlanToScheduledPost(
  plan: SnsPlanEntry,
  connection: BlogConnection
): CreateScheduledPostData | null {
  // Check if this is a blog platform
  const connectionType = mapChannelToConnectionType(plan.channel);
  if (!connectionType || connection.type !== connectionType) {
    // Channel doesn't match the connection type
    return null;
  }

  const { frequencyType, frequencyValue } = mapCadenceToFrequency(
    plan.cadence?.type || 'custom',
    plan.cadence?.customDays
  );

  // Map cadence dayOfWeek to weeklyDay, dayOfMonth to monthlyDay
  const weeklyDay = plan.cadence?.dayOfWeek ?? undefined;
  const monthlyDay = plan.cadence?.dayOfMonth ?? undefined;

  return {
    title: plan.title,
    connectionId: connection.id,
    connectionName: connection.name,
    connectionType: connectionType, // Use lowercase for scheduler compatibility
    scheduledTime: plan.cadence?.time || '09:00',
    frequencyType,
    frequencyValue,
    weeklyDay,
    monthlyDay,
    topics: Array.isArray(plan.topics) ? plan.topics : [],
  };
}

/**
 * Get available blog connections for a channel
 */
export async function getBlogConnectionsForChannel(
  channel: string
): Promise<BlogConnection[]> {
  const connectionType = mapChannelToConnectionType(channel);
  if (!connectionType) {
    return [];
  }

  const connections: BlogConnection[] = [];

  try {
    if (connectionType === 'wordpress') {
      const wpResult = await window.electron.wordpress.getConnections();
      if (wpResult.success && wpResult.connections) {
        connections.push(
          ...wpResult.connections.map((conn: any) => ({
            id: conn.id,
            name: conn.name,
            type: 'wordpress' as const,
          }))
        );
      }
    } else if (connectionType === 'naver') {
      const naverResult = await window.electron.naver.getConnections();
      if (naverResult.success && naverResult.connections) {
        connections.push(
          ...naverResult.connections.map((conn: any) => ({
            id: conn.id,
            name: conn.name,
            type: 'naver' as const,
          }))
        );
      }
    }
    // Tistory not yet implemented
  } catch (error) {
    console.error('[getBlogConnectionsForChannel] Error fetching connections:', error);
  }

  return connections;
}

