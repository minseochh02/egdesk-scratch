import retryWithBackoff from "../ai-blog/retry";

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

export async function generateInstagramContent(
  plan: InstagramContentPlan,
  options: InstagramGenerationOptions = {}
): Promise<GeneratedInstagramContent> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required to generate Instagram content.");
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const model = options.model || process.env.GEMINI_INSTAGRAM_MODEL || "gemini-2.5-flash";
  const maxHashtags = options.maxHashtags ?? 15;
  const maxCaptionLength = options.maxCaptionLength ?? 2200;

  const config = {
    responseMimeType: "application/json",
    generationConfig: {
      maxOutputTokens: 2048,
    },
    systemInstruction: [
      {
        text: INSTAGRAM_CONTENT_SYSTEM_PROMPT,
      },
    ],
  };

  const contents = [
    {
      role: "user" as const,
      parts: [
        {
          text: buildPromptFromPlan(plan),
        },
      ],
    },
  ];

  const response = await retryWithBackoff(async () => {
    return await ai.models.generateContentStream({
      model,
      config,
      contents,
    });
  }, 3, 1500);

  let raw = "";
  for await (const chunk of response) {
    if (typeof chunk.text === "string") {
      raw += chunk.text;
    }
  }

  const parsed = parseInstagramJson(raw);

  const hook = (parsed.hook || "").trim();
  const body = (parsed.body || parsed.story || "").trim();
  const cta = (parsed.cta || "").trim();
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
    altText: typeof parsed.altText === "string" ? parsed.altText.trim() : undefined,
    imagePrompt: typeof parsed.imagePrompt === "string" ? parsed.imagePrompt.trim() : undefined,
    notes: Array.isArray(parsed.notes) ? parsed.notes.map((note: any) => String(note)).slice(0, 5) : undefined,
    raw: raw.trim(),
  };
}

function buildPromptFromPlan(plan: InstagramContentPlan): string {
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
  if (plan.preferredHashtags?.length) {
    sections.push("## Preferred Hashtags", plan.preferredHashtags.join(", "));
  }
  if (plan.language) {
    sections.push("## Language", plan.language.trim());
  }
  if (plan.extraInstructions) {
    sections.push("## Extra Instructions", plan.extraInstructions.trim());
  }

  return sections.join("\n\n").trim();
}

function parseInstagramJson(raw: string): any {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const target = jsonMatch ? jsonMatch[0] : trimmed;
  return JSON.parse(target);
}

function sanitizeHashtags(hashtags: any, maxCount: number): string[] {
  if (!Array.isArray(hashtags)) {
    return [];
  }
  const sanitized = hashtags
    .map((tag) => {
      if (typeof tag !== "string") return null;
      const cleaned = tag.replace(/#/g, "").replace(/\s+/g, "").trim();
      if (!cleaned) return null;
      return `#${cleaned}`;
    })
    .filter((tag): tag is string => Boolean(tag));

  return Array.from(new Set(sanitized)).slice(0, maxCount);
}

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
  let result = sections.join("\n\n").trim();

  if (hashtags.length) {
    result = result.length ? `${result}\n\n${hashtags.join(" ")}` : hashtags.join(" ");
  }

  return enforceCaptionLimit(result, maxCaptionLength);
}

function enforceCaptionLimit(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit - 1).trim()}…`;
}


