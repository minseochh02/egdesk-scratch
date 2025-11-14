import { BusinessIdentityScheduledTask } from './BusinessIdentityScheduledDemo';

interface IdentityDetails {
  coreIdentity?: string;
  brandCategory?: string;
  targetAudience?: string;
  signatureProof?: string;
  toneVoice?: string;
}

interface IdentitySourceMeta {
  title?: string;
  url?: string;
  keywords?: string[];
  description?: string;
}

interface ParsedIdentityData {
  identity?: IdentityDetails;
  source?: IdentitySourceMeta;
  recommendedActions?: Array<{ label?: string; detail?: string }>;
}

export interface InstagramStructuredPrompt {
  identity?: {
    brandName?: string;
    coreIdentity?: string;
    brandCategory?: string;
    targetAudience?: string;
    toneVoice?: string;
    signatureProof?: string;
    keywords?: string[];
  };
  plan: {
    channel: string;
    title: string;
    summary: string;
    cadence?: string;
    cadenceType?: string;
    topics: string[];
    assets?: Record<string, unknown>;
    cta?: string;
    notes?: string | null;
  };
  contentGoal?: string;
  visualBrief?: string;
  preferredHashtags?: string[];
  extraInstructions?: string;
}

export function buildInstagramStructuredPrompt(
  task: BusinessIdentityScheduledTask,
  parsedIdentity?: ParsedIdentityData | null
): InstagramStructuredPrompt {
  const cadenceLabel = `${task.schedule.dayLabel} • ${task.schedule.time} (${task.schedule.frequency})`;

  const identityPayload = parsedIdentity?.identity
    ? {
        brandName: parsedIdentity?.source?.title,
        coreIdentity: parsedIdentity.identity.coreIdentity,
        brandCategory: parsedIdentity.identity.brandCategory,
        targetAudience: parsedIdentity.identity.targetAudience,
        toneVoice: parsedIdentity.identity.toneVoice,
        signatureProof: parsedIdentity.identity.signatureProof,
        keywords: parsedIdentity?.source?.keywords?.slice(0, 10),
      }
    : undefined;

  const recommendedCta =
    Array.isArray(parsedIdentity?.recommendedActions) && parsedIdentity?.recommendedActions.length > 0
      ? parsedIdentity?.recommendedActions[0]?.detail
      : undefined;

  return {
    identity: identityPayload,
    plan: {
      channel: task.channel,
      title: task.title,
      summary: task.summary,
      cadence: cadenceLabel,
      cadenceType: task.schedule.frequency,
      topics: task.topics,
      assets: {
        mediaStyle: task.format,
        extraNotes: task.notes ?? null,
      },
      cta: recommendedCta,
      notes: task.notes ?? null,
    },
    contentGoal: `Draft a ${task.channel} post titled "${task.title}" scheduled for ${task.schedule.dayLabel} at ${task.schedule.time}. Emphasize ${task.topics.join(
      ', '
    )} and keep it Instagram-ready.`,
    visualBrief: task.format,
    preferredHashtags: parsedIdentity?.source?.keywords?.slice(0, 15) ?? [],
    extraInstructions:
      'Respond in JSON only. Include hook, body, CTA, and concise hashtags. This caption powers an automated Instagram test post triggered from EGDesk.',
  };
}

