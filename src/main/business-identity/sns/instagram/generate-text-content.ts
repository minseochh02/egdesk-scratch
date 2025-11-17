/**
 * Instagram Text Content Generator
 * Generates Instagram captions, hooks, CTAs, hashtags, and image prompts
 * Uses the generic AI search utility with Instagram-specific system prompt
 */

import { aiSearch, AISearchOptions } from '../../../ai-code/ai-search';

const INSTAGRAM_CONTENT_SYSTEM_PROMPT = `You are an elite Instagram social strategist.
Always respond with strictly valid JSON that matches this schema:
{
  "hook": string,
  "body": string,
  "cta": string,
  "caption": string,
  "hashtags": string[],
  "altText": string,
  "imagePrompt": string,
  "notes": string[]
}

Rules:
- Keep final caption ≤ 2200 characters, respecting Instagram line breaks.
- Limit hashtags to 3–15, no spaces, no punctuation besides '#'.
- Blend hook/body/cta with natural spacing; emojis OK if briefings allow.
- Mirror requested tone, target audience, and proof points exactly.
- If details are missing, acknowledge gaps in "notes" and still deliver a caption.
- altText should describe the visual succinctly (≤ 120 chars).
- imagePrompt should provide a DALLE/Midjourney-ready description of the visual.
- Use English unless the prompt specifies another language.`;

export interface InstagramIdentityBrief {
  brandName?: string;
  coreIdentity?: string;
  brandCategory?: string;
  targetAudience?: string;
  toneVoice?: string;
  signatureProof?: string;
  keywords?: string[];
  proofPoints?: string[];
}

export interface InstagramPlanBrief {
  channel?: string;
  title?: string;
  summary?: string;
  cadence?: string;
  cadenceType?: string;
  topics?: string[];
  assets?: Record<string, any>;
  cta?: string;
  notes?: string;
}

export interface InstagramContentPlanObject {
  identity?: InstagramIdentityBrief;
  plan?: InstagramPlanBrief;
  contentGoal?: string;
  visualBrief?: string;
  preferredHashtags?: string[];
  language?: string;
  extraInstructions?: string;
}

export type InstagramContentPlan = string | InstagramContentPlanObject;

export interface GeneratedInstagramContent {
  caption: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  altText?: string;
  imagePrompt?: string;
  notes?: string[];
  raw?: string;
}

export interface InstagramGenerationOptions {
  model?: string;
  maxHashtags?: number;
  maxCaptionLength?: number;
}

/**
 * Generate Instagram content using the generic AI search utility
 */
export async function generateInstagramContent(
  plan: InstagramContentPlan,
  options: InstagramGenerationOptions = {}
): Promise<GeneratedInstagramContent> {
  console.log('[generateInstagramContent] Starting Instagram content generation...');
  console.log('[generateInstagramContent] Plan type:', typeof plan);
  
  const maxHashtags = options.maxHashtags ?? 15;
  const maxCaptionLength = options.maxCaptionLength ?? 2200;

  // Build the user prompt from the plan
  const userPrompt = buildPromptFromPlan(plan);
  console.log('[generateInstagramContent] User prompt length:', userPrompt.length);

  // Define the response schema for structured output
  // Using plain object structure that will be converted to SchemaType by the AI utility
  const responseSchema = {
    type: 'object',
    properties: {
      hook: {
        type: 'string',
        description: 'Engaging hook to start the caption',
      },
      body: {
        type: 'string',
        description: 'Main body content of the caption',
      },
      cta: {
        type: 'string',
        description: 'Call-to-action',
      },
      caption: {
        type: 'string',
        description: 'Complete caption (optional, can be composed from hook/body/cta)',
        nullable: true,
      },
      hashtags: {
        type: 'array',
        description: 'Array of hashtag strings',
        items: {
          type: 'string',
        },
      },
      altText: {
        type: 'string',
        description: 'Alt text for the image (≤ 120 chars)',
        nullable: true,
      },
      imagePrompt: {
        type: 'string',
        description: 'DALLE/Midjourney-ready image description',
        nullable: true,
      },
      notes: {
        type: 'array',
        description: 'Optional notes or gaps',
        items: {
          type: 'string',
        },
        nullable: true,
      },
    },
    required: ['hook', 'body', 'cta', 'hashtags'],
  };

  // Call the generic AI search utility
  console.log('[generateInstagramContent] Calling aiSearch utility...');
  const result = await aiSearch({
    systemPrompt: INSTAGRAM_CONTENT_SYSTEM_PROMPT,
    userMessage: userPrompt,
    responseSchema,
    model: options.model || process.env.GEMINI_INSTAGRAM_MODEL || 'gemini-2.0-flash-exp',
    temperature: 0.7,
    maxOutputTokens: 2048,
  });

  console.log('[generateInstagramContent] AI search result:', { success: result.success, hasContent: !!result.content, error: result.error });

  if (!result.success || !result.content) {
    console.error('[generateInstagramContent] AI search failed:', result.error);
    throw new Error(result.error || 'Failed to generate Instagram content');
  }

  // Parse the JSON response
  let parsed: any;
  try {
    parsed = JSON.parse(result.content);
  } catch (parseError) {
    throw new Error('Failed to parse AI response as JSON');
  }

  // Process and compose the final content
  const hook = (parsed.hook || '').trim();
  const body = (parsed.body || parsed.story || '').trim();
  const cta = (parsed.cta || '').trim();
  const hashtags = sanitizeHashtags(parsed.hashtags, maxHashtags);
  const caption = composeCaption({
    caption: parsed.caption,
    hook,
    body,
    cta,
    hashtags,
    maxCaptionLength,
  });

  return {
    caption,
    hook,
    body,
    cta,
    hashtags,
    altText: typeof parsed.altText === 'string' ? parsed.altText.trim() : undefined,
    imagePrompt: typeof parsed.imagePrompt === 'string' ? parsed.imagePrompt.trim() : undefined,
    notes: Array.isArray(parsed.notes) ? parsed.notes.map((note: any) => String(note)).slice(0, 5) : undefined,
    raw: result.content,
  };
}

/**
 * Build user prompt from Instagram content plan
 */
function buildPromptFromPlan(plan: InstagramContentPlan): string {
  if (typeof plan === 'string') {
    return plan.trim();
  }

  const sections: string[] = [];

  if (plan.identity) {
    sections.push('## Brand Identity', JSON.stringify(plan.identity, null, 2));
  }
  if (plan.plan) {
    sections.push('## Scheduled Plan Entry', JSON.stringify(plan.plan, null, 2));
  }
  if (plan.contentGoal) {
    sections.push('## Content Goal', plan.contentGoal.trim());
  }
  if (plan.visualBrief) {
    sections.push('## Visual Brief', plan.visualBrief.trim());
  }
  if (plan.preferredHashtags?.length) {
    sections.push('## Preferred Hashtags', plan.preferredHashtags.join(', '));
  }
  if (plan.language) {
    sections.push('## Language', plan.language.trim());
  }
  if (plan.extraInstructions) {
    sections.push('## Extra Instructions', plan.extraInstructions.trim());
  }

  return sections.join('\n\n').trim();
}

/**
 * Sanitize and format hashtags
 */
function sanitizeHashtags(hashtags: any, maxCount: number): string[] {
  if (!Array.isArray(hashtags)) {
    return [];
  }
  const sanitized = hashtags
    .map((tag) => {
      if (typeof tag !== 'string') return null;
      const cleaned = tag.replace(/#/g, '').replace(/\s+/g, '').trim();
      if (!cleaned) return null;
      return `#${cleaned}`;
    })
    .filter((tag): tag is string => Boolean(tag));

  return Array.from(new Set(sanitized)).slice(0, maxCount);
}

/**
 * Compose final caption from components
 */
function composeCaption({
  caption,
  hook,
  body,
  cta,
  hashtags,
  maxCaptionLength,
}: {
  caption?: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  maxCaptionLength: number;
}): string {
  const cleanedCaption = caption?.trim();
  if (cleanedCaption) {
    return enforceCaptionLimit(cleanedCaption, maxCaptionLength);
  }

  const sections = [hook, body, cta].filter((section) => section && section.length);
  let result = sections.join('\n\n').trim();

  if (hashtags.length) {
    result = result.length ? `${result}\n\n${hashtags.join(' ')}` : hashtags.join(' ');
  }

  return enforceCaptionLimit(result, maxCaptionLength);
}

/**
 * Enforce caption character limit
 */
function enforceCaptionLimit(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1).trim()}…`;
}

