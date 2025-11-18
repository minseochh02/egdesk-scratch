/**
 * Helper functions for SNS Plan data transformation
 */

import type { SnsPlanEntry, StoredSnsPlan } from './types';
import { normalizeCadenceType, normalizeTimeString, isFiniteNumber } from './utils';

export const parseStoredTopics = (topicsJson: string): string[] => {
  try {
    const parsed = JSON.parse(topicsJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((topic) => typeof topic === 'string' && topic.trim().length > 0);
    }
  } catch {
    // ignore
  }
  return [];
};

export const parseStoredAssets = (assetsJson: string | null): {
  mediaStyle?: string;
  copyGuidelines?: string;
  cta?: string;
  extraNotes?: string | null;
  summary?: string;
} => {
  if (!assetsJson) {
    return {};
  }
  try {
    const parsed = JSON.parse(assetsJson);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return {};
};

export const mapStoredPlanToEntry = (plan: StoredSnsPlan): SnsPlanEntry => {
  const assets = parseStoredAssets(plan.assetsJson);
  return {
    planId: plan.id, // Preserve SQLite plan ID
    channel: plan.channel,
    title: plan.title,
    summary: typeof assets.summary === 'string' ? assets.summary : '',
    cadence: {
      type: normalizeCadenceType(plan.cadenceType),
      dayOfWeek: isFiniteNumber(plan.dayOfWeek) ? plan.dayOfWeek : null,
      dayOfMonth: isFiniteNumber(plan.dayOfMonth) ? plan.dayOfMonth : null,
      customDays: isFiniteNumber(plan.cadenceValue) ? plan.cadenceValue : null,
      time: normalizeTimeString(plan.scheduledTime),
    },
    topics: parseStoredTopics(plan.topicsJson),
    assets: {
      mediaStyle: typeof assets.mediaStyle === 'string' ? assets.mediaStyle : undefined,
      copyGuidelines: typeof assets.copyGuidelines === 'string' ? assets.copyGuidelines : undefined,
      cta: typeof assets.cta === 'string' ? assets.cta : undefined,
      extraNotes: typeof assets.extraNotes === 'string' ? assets.extraNotes : null,
    },
    connectionId: plan.connectionId ?? null,
    connectionName: plan.connectionName ?? null,
    connectionType: plan.connectionType ?? null,
  };
};

