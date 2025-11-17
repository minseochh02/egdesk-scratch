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
      enabled: true,
    };
  });

