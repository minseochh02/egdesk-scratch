/**
 * AI Search Service for Business Identity
 * Handles AI calls for business identity analysis and SNS plan generation
 * Uses GoogleGenerativeAI with structured JSON output
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getStore } from '../storage';

export interface AISearchResult {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * Get Google AI API key from store
 */
function getGoogleApiKey(): string | null {
  try {
    const store = getStore?.();
    if (!store) {
      console.warn('[AISearch] Store not available');
      return null;
    }

    const aiKeys = store.get('ai-keys', []);
    if (!Array.isArray(aiKeys)) {
      console.warn('[AISearch] AI keys not found or not an array');
      return null;
    }

    // Find preferred key: egdesk > active > any google key
    const preferred =
      aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ??
      aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) ??
      aiKeys.find((k: any) => k?.providerId === 'google');

    if (preferred) {
      console.log('[AISearch] Selected API key:', preferred.name || 'unnamed', 'ID:', preferred.id);
    } else {
      console.warn('[AISearch] No Google API key found in store');
    }

    const apiKey = preferred?.fields?.apiKey;
    if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
      const keyPreview = `${apiKey.trim().substring(0, 8)}...${apiKey.trim().substring(apiKey.trim().length - 4)}`;
      console.log('[AISearch] Using API key:', keyPreview);
      return apiKey.trim();
    }

    // Fallback to environment variable
    if (process.env.GEMINI_API_KEY && typeof process.env.GEMINI_API_KEY === 'string') {
      console.log('[AISearch] Using API key from environment variable');
      return process.env.GEMINI_API_KEY.trim();
    }

    console.warn('[AISearch] No valid API key found');
    return null;
  } catch (error) {
    console.error('[AISearch] Failed to get API key from store:', error);
    return null;
  }
}

/**
 * Generate business identity from website content
 */
export async function generateBusinessIdentity(
  websiteText: string,
  rootUrl?: string
): Promise<AISearchResult> {
  try {
    const apiKey = getGoogleApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: 'AI is not configured. Please configure a Google AI key first.',
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Define schema for business identity
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        source: {
          type: SchemaType.OBJECT,
          properties: {
            url: {
              type: SchemaType.STRING,
              description: 'Website URL',
              nullable: true,
            },
            title: {
              type: SchemaType.STRING,
              description: 'Page title',
              nullable: false,
            },
            status: {
              type: SchemaType.NUMBER,
              description: 'HTTP status code',
              nullable: false,
            },
            language: {
              type: SchemaType.STRING,
              description: 'Language code',
              nullable: true,
            },
            description: {
              type: SchemaType.STRING,
              description: 'Meta description',
              nullable: true,
            },
            wordCount: {
              type: SchemaType.NUMBER,
              description: 'Total word count',
              nullable: false,
            },
            keywords: {
              type: SchemaType.ARRAY,
              description: 'Top 5 keywords',
              items: {
                type: SchemaType.STRING,
              },
            },
            excerpt: {
              type: SchemaType.STRING,
              description: 'Content excerpt',
              nullable: true,
            },
          },
          required: ['title', 'status', 'wordCount', 'keywords'],
        },
        identity: {
          type: SchemaType.OBJECT,
          properties: {
            coreIdentity: {
              type: SchemaType.STRING,
              description: 'Core business identity (≤280 chars)',
              nullable: false,
            },
            brandCategory: {
              type: SchemaType.STRING,
              description: 'Brand category',
              nullable: false,
            },
            targetAudience: {
              type: SchemaType.STRING,
              description: 'Target audience description (≤280 chars)',
              nullable: false,
            },
            signatureProof: {
              type: SchemaType.STRING,
              description: 'Signature proof points (≤280 chars)',
              nullable: false,
            },
            toneVoice: {
              type: SchemaType.STRING,
              description: 'Tone and voice description (≤280 chars)',
              nullable: false,
            },
          },
          required: ['coreIdentity', 'brandCategory', 'targetAudience', 'signatureProof', 'toneVoice'],
        },
        recommendedActions: {
          type: SchemaType.ARRAY,
          description: 'Recommended actions',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              label: {
                type: SchemaType.STRING,
                description: 'Action label',
                nullable: false,
              },
              detail: {
                type: SchemaType.STRING,
                description: 'Action detail',
                nullable: false,
              },
            },
            required: ['label', 'detail'],
          },
        },
      },
      required: ['source', 'identity', 'recommendedActions'],
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema as any,
        temperature: 0.7,
      },
    });

    const rootUrlInstruction = rootUrl ? `\n\nIMPORTANT: The source.url field must be set to the root/homepage URL: ${rootUrl}. Do not use URLs from subpages like /contact, /about, etc.` : '';
    
    const prompt = `You are a structured-data generator. Analyze this website and generate the business identity data in the required JSON format.

Rules:
- Emit only JSON (no markdown, prose, or explanations).
- Populate null where data is unavailable.
- Keep strings concise (≤ 280 chars when possible).
- Limit keywords to the top 5 ranked terms.${rootUrlInstruction}

Website Context:
${websiteText}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse and validate JSON
    try {
      const parsed = JSON.parse(text);
      
      // Override source.url to always use root URL if provided
      if (rootUrl && parsed.source) {
        parsed.source.url = rootUrl;
        console.log('[AISearch] Overriding source.url to root URL:', rootUrl);
      }
      
      // Return as stringified JSON to match the expected interface
      return {
        success: true,
        content: JSON.stringify(parsed, null, 2),
      };
    } catch (parseError) {
      console.error('[AISearch] Failed to parse JSON response:', parseError);
      return {
        success: false,
        error: 'AI response was not valid JSON',
      };
    }
  } catch (error) {
    console.error('[AISearch] Error generating business identity:', error);
    
    // Extract more user-friendly error messages from API errors
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check for quota/rate limit errors
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Quota exceeded')) {
        const apiKey = getGoogleApiKey();
        const keyPreview = apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'none';
        console.error('[AISearch] API quota exceeded. Using API key:', keyPreview);
        errorMessage = 'API quota exceeded. Please check your Gemini API plan and billing details, or try using a different API key.';
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'API authentication failed. Please check your Google AI API key.';
      }
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate SNS plan from business identity data
 */
export async function generateSnsPlan(
  identityData: any,
  availableBlogPlatforms?: string[]
): Promise<AISearchResult> {
  try {
    const apiKey = getGoogleApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: 'AI is not configured. Please configure a Google AI key first.',
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Define schema for SNS plan
    const schema = {
      type: SchemaType.OBJECT,
      properties: {
        snsPlan: {
          type: SchemaType.ARRAY,
          description: 'SNS marketing plan entries',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              channel: {
                type: SchemaType.STRING,
                description: availableBlogPlatforms && availableBlogPlatforms.length > 0
                  ? `SNS channel. Available platforms ONLY: ${availableBlogPlatforms.join(', ')}, Instagram, YouTube. CRITICAL: Use exact platform names (e.g., "WordPress", "Naver Blog") - these will be matched to user's blog connections. Do NOT use generic "Blog". DO NOT use LinkedIn, Twitter, Facebook, TikTok, or any other platforms.`
                  : 'SNS channel. Available platforms ONLY: Instagram, YouTube, WordPress, Naver Blog. DO NOT use LinkedIn, Twitter, Facebook, TikTok, or any other platforms.',
                nullable: false,
              },
              title: {
                type: SchemaType.STRING,
                description: 'Plan title (≤200 chars)',
                nullable: false,
              },
              summary: {
                type: SchemaType.STRING,
                description: 'Plan summary (≤200 chars)',
                nullable: false,
              },
              cadence: {
                type: SchemaType.OBJECT,
                properties: {
                  type: {
                    type: SchemaType.STRING,
                    description: 'Cadence type: daily, weekly, monthly, or custom',
                    nullable: false,
                  },
                  dayOfWeek: {
                    type: SchemaType.NUMBER,
                    description: 'Day of week (0-6, null if not applicable)',
                    nullable: true,
                  },
                  dayOfMonth: {
                    type: SchemaType.NUMBER,
                    description: 'Day of month (1-31, null if not applicable)',
                    nullable: true,
                  },
                  customDays: {
                    type: SchemaType.NUMBER,
                    description: 'Custom days interval (null if not applicable)',
                    nullable: true,
                  },
                  time: {
                    type: SchemaType.STRING,
                    description: 'Scheduled time (HH:mm format)',
                    nullable: false,
                  },
                },
                required: ['type', 'time'],
              },
              topics: {
                type: SchemaType.ARRAY,
                description: 'Content topics',
                items: {
                  type: SchemaType.STRING,
                },
              },
              assets: {
                type: SchemaType.OBJECT,
                properties: {
                  mediaStyle: {
                    type: SchemaType.STRING,
                    description: 'Media style guidelines (≤200 chars)',
                    nullable: true,
                  },
                  copyGuidelines: {
                    type: SchemaType.STRING,
                    description: 'Copy writing guidelines (≤200 chars)',
                    nullable: true,
                  },
                  cta: {
                    type: SchemaType.STRING,
                    description: 'Call-to-action (≤200 chars)',
                    nullable: true,
                  },
                  extraNotes: {
                    type: SchemaType.STRING,
                    description: 'Additional notes',
                    nullable: true,
                  },
                },
              },
            },
            required: ['channel', 'title', 'summary', 'cadence', 'topics', 'assets'],
          },
        },
      },
      required: ['snsPlan'],
    };

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema as any,
        temperature: 0.7,
      },
    });

    // Build available platforms context
    let platformContext = '';
    if (availableBlogPlatforms && availableBlogPlatforms.length > 0) {
      platformContext = `\n\nAvailable Blog Platforms: ${availableBlogPlatforms.join(', ')}\nIMPORTANT: When creating blog content plans, use the exact platform name (e.g., "WordPress", "Naver Blog") instead of the generic term "Blog".`;
    }

    const planPrompt = `You are an SNS marketing planner. Using the following business identity JSON, create a multi-channel SNS marketing plan.

Rules:
- Emit only JSON (no prose).
- Provide at least 3 plan entries across multiple channels when possible.
- Keep strings concise (≤ 200 chars).
- Available platforms ONLY: Instagram, YouTube, WordPress, Naver Blog.
- For blog platforms, use exact names: "WordPress" or "Naver Blog" (not generic "Blog").
- DO NOT use LinkedIn, Twitter, Facebook, TikTok, Tistory, or any other platforms.${platformContext}

Identity JSON:
${JSON.stringify(identityData, null, 2)}`;

    const result = await model.generateContent(planPrompt);
    const response = result.response;
    const text = response.text();

    // Parse and validate JSON
    try {
      const parsed = JSON.parse(text);
      // Return as stringified JSON to match the expected interface
      return {
        success: true,
        content: JSON.stringify(parsed, null, 2),
      };
    } catch (parseError) {
      console.error('[AISearch] Failed to parse JSON response:', parseError);
      return {
        success: false,
        error: 'AI response was not valid JSON',
      };
    }
  } catch (error) {
    console.error('[AISearch] Error generating SNS plan:', error);
    
    // Extract more user-friendly error messages from API errors
    let errorMessage = 'Unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check for quota/rate limit errors
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('Quota exceeded')) {
        const apiKey = getGoogleApiKey();
        const keyPreview = apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'none';
        console.error('[AISearch] API quota exceeded. Using API key:', keyPreview);
        errorMessage = 'API quota exceeded. Please check your Gemini API plan and billing details, or try using a different API key.';
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'API authentication failed. Please check your Google AI API key.';
      }
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}
