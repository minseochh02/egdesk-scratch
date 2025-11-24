/**
 * Facebook Text Content Generator
 * Generates Facebook post text with company branding
 * Uses the generic AI search utility with Facebook-specific system prompt
 */

import { aiSearch, AISearchOptions } from '../../ai-code/ai-search';

const FACEBOOK_CONTENT_SYSTEM_PROMPT = `You are an expert Facebook content strategist.
Always respond with strictly valid JSON that matches this schema:
{
  "text": string,
  "cta": string,
  "hashtags": string[],
  "imagePrompt": string,
  "notes": string[]
}

Rules:
- Keep post text between 100-500 characters for optimal engagement.
- Limit hashtags to 1-3, no spaces, no punctuation besides '#'.
- Text should be conversational and authentic, matching the brand's tone.
- Mirror requested tone, target audience, and proof points exactly.
- If details are missing, acknowledge gaps in "notes" and still deliver text.
- imagePrompt should provide a DALLE/Midjourney-ready description of the visual.
- Use English unless the prompt specifies another language.
- Facebook users prefer genuine, relatable content over salesy posts.`;

export interface FacebookIdentityBrief {
  brandName?: string;
  coreIdentity?: string;
  brandCategory?: string;
  targetAudience?: string;
  toneVoice?: string;
  signatureProof?: string;
  keywords?: string[];
  proofPoints?: string[];
}

export interface FacebookPlanBrief {
  channel?: string;
  title?: string;
  summary?: string;
  topics?: string[];
  cta?: string;
  contentGoal?: string;
}

export interface FacebookContentPlan {
  identity?: FacebookIdentityBrief;
  plan?: FacebookPlanBrief;
  contentGoal?: string;
  visualBrief?: string;
  preferredHashtags?: string[];
  language?: string;
  extraInstructions?: string;
}

export interface GeneratedFacebookContent {
  text: string;
  cta?: string;
  hashtags: string[];
  imagePrompt?: string;
  notes?: string[];
  raw?: string;
}

export interface FacebookGenerationOptions {
  model?: string;
  maxHashtags?: number;
  maxTextLength?: number;
}

/**
 * Generate Facebook content using the generic AI search utility
 */
export async function generateFacebookContent(
  plan: FacebookContentPlan | string,
  options: FacebookGenerationOptions = {}
): Promise<GeneratedFacebookContent> {
  console.log('[generateFacebookContent] Starting Facebook content generation...');
  console.log('[generateFacebookContent] Plan type:', typeof plan);
  
  const maxHashtags = options.maxHashtags ?? 3;
  const maxTextLength = options.maxTextLength ?? 500;

  // Build the user prompt from the plan
  const userPrompt = buildPromptFromPlan(plan);
  console.log('[generateFacebookContent] User prompt length:', userPrompt.length);

  // Define the response schema for structured output
  const responseSchema = {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The main post text content',
      },
      cta: {
        type: 'string',
        description: 'Call-to-action',
        nullable: true,
      },
      hashtags: {
        type: 'array',
        description: 'Array of hashtag strings (1-3)',
        items: {
          type: 'string',
        },
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
    required: ['text', 'hashtags'],
  };

  // Call the generic AI search utility
  console.log('[generateFacebookContent] Calling aiSearch utility...');
  const result = await aiSearch({
    systemPrompt: FACEBOOK_CONTENT_SYSTEM_PROMPT,
    userMessage: userPrompt,
    responseSchema,
    model: options.model || process.env.GEMINI_FACEBOOK_MODEL || 'gemini-2.5-flash',
    temperature: 0.7,
    maxOutputTokens: 2048,
  });

  console.log('[generateFacebookContent] AI search result:', { success: result.success, hasContent: !!result.content, error: result.error });

  if (!result.success || !result.content) {
    console.error('[generateFacebookContent] AI search failed:', result.error);
    throw new Error(result.error || 'Failed to generate Facebook content');
  }

  // Parse the JSON response
  let parsed: any;
  try {
    parsed = JSON.parse(result.content);
  } catch (parseError) {
    throw new Error('Failed to parse AI response as JSON');
  }

  // Process and compose the final content
  const text = (parsed.text || '').trim();
  const cta = (parsed.cta || '').trim();
  const hashtags = sanitizeHashtags(parsed.hashtags, maxHashtags);

  // Combine text with CTA if provided
  let finalText = text;
  if (cta && !text.includes(cta)) {
    finalText = `${text}\n\n${cta}`;
  }

  // Trim to max length if needed
  if (finalText.length > maxTextLength) {
    finalText = finalText.substring(0, maxTextLength - 3) + '...';
  }

  return {
    text: finalText,
    cta: cta || undefined,
    hashtags,
    imagePrompt: typeof parsed.imagePrompt === 'string' ? parsed.imagePrompt.trim() : undefined,
    notes: Array.isArray(parsed.notes) ? parsed.notes.map((note: any) => String(note)).slice(0, 5) : undefined,
    raw: result.content,
  };
}

/**
 * Build user prompt from Facebook content plan
 */
function buildPromptFromPlan(plan: FacebookContentPlan | string): string {
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
 * Sanitize and limit hashtags
 */
function sanitizeHashtags(rawHashtags: any, maxCount: number): string[] {
  if (!Array.isArray(rawHashtags)) {
    return [];
  }

  return rawHashtags
    .map((tag) => {
      if (typeof tag !== 'string') return null;
      let cleaned = tag.trim();
      if (!cleaned.startsWith('#')) {
        cleaned = `#${cleaned}`;
      }
      // Remove any spaces or special characters except # and alphanumerics
      cleaned = cleaned.replace(/[^#\w]/g, '');
      return cleaned.length > 1 ? cleaned : null;
    })
    .filter((tag): tag is string => tag !== null)
    .slice(0, maxCount);
}

