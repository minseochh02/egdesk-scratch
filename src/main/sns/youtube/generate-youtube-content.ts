import { generateTextWithAI } from '../../gemini';

const YOUTUBE_CONTENT_SYSTEM_PROMPT = `You are an elite YouTube content strategist and scriptwriter.
Always respond with strictly valid JSON that matches this schema:
{
  "title": string,
  "description": string,
  "tags": string[],
  "script": {
    "hook": string,
    "intro": string,
    "body": string[],
    "outro": string,
    "cta": string
  },
  "thumbnailPrompt": string,
  "notes": string[]
}

Rules:
- Keep title ≤ 100 characters, engaging and SEO-friendly.
- Description should be 200-5000 characters, include keywords naturally.
- Limit tags to 10-15 relevant keywords, no spaces, lowercase.
- Script should be conversational, engaging, and structured for video format.
- Hook should grab attention in first 15 seconds.
- Body should be broken into clear sections/points.
- CTA should encourage engagement (like, subscribe, comment).
- thumbnailPrompt should describe a compelling thumbnail image (≤ 200 chars).
- Mirror requested tone, target audience, and proof points exactly.
- If details are missing, acknowledge gaps in "notes" and still deliver content.
- Use English unless the prompt specifies another language.`;

export interface YouTubeIdentityBrief {
  brandName?: string;
  coreIdentity?: string;
  brandCategory?: string;
  targetAudience?: string;
  toneVoice?: string;
  signatureProof?: string;
  keywords?: string[];
  proofPoints?: string[];
}

export interface YouTubePlanBrief {
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

export interface YouTubeContentPlanObject {
  identity?: YouTubeIdentityBrief;
  plan?: YouTubePlanBrief;
  contentGoal?: string;
  visualBrief?: string;
  preferredTags?: string[];
  language?: string;
  extraInstructions?: string;
  videoLength?: string; // e.g., "5 minutes", "10-15 minutes"
  videoType?: string; // e.g., "tutorial", "review", "vlog", "educational"
}

export type YouTubeContentPlan = string | YouTubeContentPlanObject;

export interface GeneratedYouTubeContent {
  title: string;
  description: string;
  tags: string[];
  script: {
    hook: string;
    intro: string;
    body: string[];
    outro: string;
    cta: string;
  };
  thumbnailPrompt?: string;
  notes?: string[];
  raw?: string;
}

export interface YouTubeGenerationOptions {
  model?: string;
  maxTags?: number;
  maxTitleLength?: number;
  maxDescriptionLength?: number;
  apiKey?: string;
}

export async function generateYouTubeContent(
  plan: YouTubeContentPlan,
  options: YouTubeGenerationOptions = {}
): Promise<GeneratedYouTubeContent> {
  const model = options.model || process.env.GEMINI_YOUTUBE_MODEL || "gemini-2.5-flash";
  const maxTags = options.maxTags ?? 15;
  const maxTitleLength = options.maxTitleLength ?? 100;
  const maxDescriptionLength = options.maxDescriptionLength ?? 5000;

  const result = await generateTextWithAI({
    prompt: buildPromptFromPlan(plan),
    systemPrompt: YOUTUBE_CONTENT_SYSTEM_PROMPT,
    apiKey: options.apiKey,
    model,
      maxOutputTokens: 4096,
    streaming: true,
    useRetry: true,
    maxRetries: 3,
    retryBaseDelay: 1500,
    package: 'genai',
    parseJson: true,
    });

  if (!result.json) {
    throw new Error('Failed to parse JSON response from AI');
  }

  const parsed = result.json;
  const raw = result.raw;

  const title = enforceTitleLimit((parsed.title || "").trim(), maxTitleLength);
  const description = enforceDescriptionLimit((parsed.description || "").trim(), maxDescriptionLength);
  const tags = sanitizeTags(parsed.tags, maxTags);
  const script = normalizeScript(parsed.script);

  return {
    title,
    description,
    tags,
    script,
    thumbnailPrompt: typeof parsed.thumbnailPrompt === "string" ? parsed.thumbnailPrompt.trim() : undefined,
    notes: Array.isArray(parsed.notes) ? parsed.notes.map((note: any) => String(note)).slice(0, 5) : undefined,
    raw: raw.trim(),
  };
}

function buildPromptFromPlan(plan: YouTubeContentPlan): string {
  if (typeof plan === "string") {
    return plan.trim();
  }

  const sections: string[] = [];

  if (plan.identity) {
    sections.push("## Brand Identity", JSON.stringify(plan.identity, null, 2));
  }
  if (plan.plan) {
    sections.push("## Scheduled Plan Entry", JSON.stringify(plan.plan, null, 2));
  }
  if (plan.contentGoal) {
    sections.push("## Content Goal", plan.contentGoal.trim());
  }
  if (plan.visualBrief) {
    sections.push("## Visual Brief", plan.visualBrief.trim());
  }
  if (plan.videoLength) {
    sections.push("## Video Length", plan.videoLength.trim());
  }
  if (plan.videoType) {
    sections.push("## Video Type", plan.videoType.trim());
  }
  if (plan.preferredTags?.length) {
    sections.push("## Preferred Tags", plan.preferredTags.join(", "));
  }
  if (plan.language) {
    sections.push("## Language", plan.language.trim());
  }
  if (plan.extraInstructions) {
    sections.push("## Extra Instructions", plan.extraInstructions.trim());
  }

  return sections.join("\n\n").trim();
}

function parseYouTubeJson(raw: string): any {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const target = jsonMatch ? jsonMatch[0] : trimmed;
  return JSON.parse(target);
}

function sanitizeTags(tags: any, maxCount: number): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  const sanitized = tags
    .map((tag) => {
      if (typeof tag !== "string") return null;
      const cleaned = tag.replace(/\s+/g, "").toLowerCase().trim();
      if (!cleaned) return null;
      return cleaned;
    })
    .filter((tag): tag is string => Boolean(tag));

  return Array.from(new Set(sanitized)).slice(0, maxCount);
}

function normalizeScript(script: any): {
  hook: string;
  intro: string;
  body: string[];
  outro: string;
  cta: string;
} {
  if (!script || typeof script !== "object") {
    return {
      hook: "",
      intro: "",
      body: [],
      outro: "",
      cta: "",
    };
  }

  return {
    hook: typeof script.hook === "string" ? script.hook.trim() : "",
    intro: typeof script.intro === "string" ? script.intro.trim() : "",
    body: Array.isArray(script.body)
      ? script.body.map((item: any) => String(item).trim()).filter(Boolean)
      : typeof script.body === "string"
      ? [script.body.trim()].filter(Boolean)
      : [],
    outro: typeof script.outro === "string" ? script.outro.trim() : "",
    cta: typeof script.cta === "string" ? script.cta.trim() : "",
  };
}

function enforceTitleLimit(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1).trim()}…`;
}

function enforceDescriptionLimit(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1).trim()}…`;
}

