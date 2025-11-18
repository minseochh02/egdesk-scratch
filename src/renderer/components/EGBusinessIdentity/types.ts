/**
 * Type definitions for Business Identity components
 */

export interface IdentitySnapshot {
  id: string;
  brandKey: string;
  sourceUrl: string | null;
  identityJson: string;
  seoAnalysisJson?: string | null;
  sslAnalysisJson?: string | null;
  createdAt: string | Date;
}

export interface SnsPlanEntry {
  planId?: string; // SQLite plan ID (optional for new plans)
  channel: string;
  title: string;
  summary: string;
  cadence: {
    type: 'daily' | 'weekly' | 'monthly' | 'custom' | string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    customDays: number | null;
    time: string;
  };
  topics: string[];
  assets: {
    mediaStyle?: string;
    copyGuidelines?: string;
    cta?: string;
    extraNotes?: string | null;
  };
  connectionId?: string | null;
  connectionName?: string | null;
  connectionType?: string | null;
}

export interface StoredSnsPlan {
  id: string;
  snapshotId: string;
  channel: string;
  title: string;
  cadenceType: string;
  cadenceValue: number | null;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  scheduledTime: string;
  topicsJson: string;
  assetsJson: string | null;
  connectionId: string | null;
  connectionName: string | null;
  connectionType: string | null;
}

export interface BusinessIdentitySnsPlanInput {
  snapshotId: string;
  channel: string;
  title: string;
  cadenceType: 'daily' | 'weekly' | 'monthly' | 'custom';
  cadenceValue?: number | null;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  scheduledTime: string;
  topics: string[];
  assets?: Record<string, any> | null;
  connectionId?: string | null;
  connectionName?: string | null;
  connectionType?: string | null;
  enabled?: boolean;
}

export type IdentityLocationState = {
  bypassPreviewAutoRedirect?: boolean;
};

