/**
 * Centralized Gemini AI Generation
 * Provides a unified interface for generating images and text using Google's Gemini/Imagen models
 */

import * as mime from 'mime-types';
import { getStore } from '../storage';
import retryWithBackoff from '../ai-blog/retry';

export interface GeneratedImageData {
  fileName: string;
  mimeType: string;
  data: string; // base64 encoded
  buffer: Buffer;
  size: number;
  filePath?: string; // If saved to disk
}

export interface ImageGenerationOptions {
  /** Image generation prompt */
  prompt: string;
  /** Number of images to generate (default: 1) */
  count?: number;
  /** API key (if not provided, will be retrieved from store or env) */
  apiKey?: string;
  /** Model to use: 'gemini-2.5-flash-image-preview' | 'gemini-2.5-flash-image' | 'imagen-4.0' (default: 'imagen-4.0') */
  model?: 'gemini-2.5-flash-image-preview' | 'gemini-2.5-flash-image' | 'imagen-4.0';
  /** Whether to use retry logic (default: true) */
  useRetry?: boolean;
  /** Max retries for retry logic (default: 3) */
  maxRetries?: number;
  /** Base delay for retry logic in ms (default: 2000) */
  retryBaseDelay?: number;
  /** Output directory to save files (optional) */
  outputDir?: string;
  /** File name prefix (default: 'gemini_image') */
  fileNamePrefix?: string;
  /** For Imagen 4.0: aspect ratio (default: '1:1') */
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  /** For Imagen 4.0: image size (default: '1K') */
  imageSize?: '1K' | '2K';
  /** For Imagen 4.0: output MIME type (default: 'image/png') */
  outputMimeType?: 'image/jpeg' | 'image/png';
  /** Whether to try Imagen 4.0 first, then fallback to Gemini (default: true) */
  tryImagenFirst?: boolean;
  /** Fallback model to use if Imagen 4.0 fails (default: 'gemini-2.5-flash-image-preview') */
  fallbackModel?: 'gemini-2.5-flash-image-preview' | 'gemini-2.5-flash-image';
}

export interface ApiKeyInfo {
  apiKey: string | null;
  keyName?: string;
  keyId?: string;
}

/**
 * Get Google API key from store or environment
 * Uses the same selection logic as other parts of the codebase:
 * prefers 'egdesk' named key, then active key, then any Google key
 */
export function getGoogleApiKey(): ApiKeyInfo {
  try {
    const store = getStore?.();
    if (!store) {
      console.warn('[GeminiAI] Store not available');
      return { apiKey: null };
    }

    const aiKeys = store.get('ai-keys', []);
    if (!Array.isArray(aiKeys)) {
      console.warn('[GeminiAI] AI keys not found or not an array');
      return { apiKey: null };
    }

    // Find preferred key: egdesk > active > any google key
    const preferred =
      aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ??
      aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) ??
      aiKeys.find((k: any) => k?.providerId === 'google' && k?.fields?.apiKey && typeof k.fields.apiKey === 'string' && k.fields.apiKey.trim().length > 0);

    if (preferred) {
      const keyName = preferred.name || 'unnamed';
      const keyId = preferred.id;
      const apiKey = preferred?.fields?.apiKey;
      if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
        return { apiKey: apiKey.trim(), keyName, keyId };
      }
    }

    // Fallback to environment variable
    if (process.env.GEMINI_API_KEY && typeof process.env.GEMINI_API_KEY === 'string') {
      return { apiKey: process.env.GEMINI_API_KEY.trim() };
    }

    return { apiKey: null };
  } catch (error) {
    console.error('[GeminiAI] Error reading API key from store:', error);
    return { apiKey: null };
  }
}

/**
 * Generate images using Gemini AI or Imagen
 * This is the central function that consolidates all image generation logic
 */
export async function generateImageWithAI(
  options: ImageGenerationOptions
): Promise<GeneratedImageData[]> {
  const {
    prompt,
    count = 1,
    apiKey: providedApiKey,
    model = 'imagen-4.0',
    useRetry = true,
    maxRetries = 3,
    retryBaseDelay = 2000,
    outputDir,
    fileNamePrefix = 'gemini_image',
    aspectRatio = '1:1',
    imageSize = '1K',
    outputMimeType = 'image/png',
    tryImagenFirst = true,
    fallbackModel = 'gemini-2.5-flash-image-preview',
  } = options;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Image prompt is required for image generation');
  }

  // Get API key
  const apiKeyInfo = providedApiKey ? { apiKey: providedApiKey } : getGoogleApiKey();
  const apiKey = apiKeyInfo.apiKey;

  if (!apiKey) {
    throw new Error(
      'Google API key is required for image generation. ' +
      'Please provide an API key parameter, configure one in the AI Keys Manager, or set the GEMINI_API_KEY environment variable.'
    );
  }

  // Store key info for error logging
  const keyInfo = {
    keyName: apiKeyInfo.keyName || 'unnamed',
    keyId: apiKeyInfo.keyId || 'unknown',
    keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
  };

  console.log('[GeminiImageGen] Generating image with model:', model);
  console.log('[GeminiImageGen] Using API key:', keyInfo.keyPreview);

  const { GoogleGenAI, PersonGeneration } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  // Try Imagen 4.0 if requested (default) or if model is explicitly imagen-4.0
  if (tryImagenFirst || model === 'imagen-4.0') {
    try {
      console.log('[GeminiImageGen] Attempting Imagen 4.0 image generation...');
      const response = await ai.models.generateImages({
        model: 'models/imagen-4.0-generate-001',
        prompt: prompt.trim(),
        config: {
          numberOfImages: count,
          outputMimeType,
          personGeneration: PersonGeneration.ALLOW_ALL,
          aspectRatio,
          imageSize,
        },
      });

      if (response?.generatedImages && response.generatedImages.length > 0) {
        const generatedImages: GeneratedImageData[] = [];
        const fs = outputDir ? await import('fs') : null;
        const path = outputDir ? await import('path') : null;
        const timestamp = Date.now();

        if (outputDir && fs && path) {
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
        }

        for (let i = 0; i < response.generatedImages.length; i++) {
          const generatedImage = response.generatedImages[i];
          if (generatedImage?.image?.imageBytes) {
            const inlineData = generatedImage.image.imageBytes;
            const buffer = Buffer.from(inlineData || '', 'base64');
            const fileExtension = mime.extension(outputMimeType) || 'png';
            const fileName = `${fileNamePrefix}_${timestamp}_${i}.${fileExtension}`;
            const filePath = outputDir && path ? path.join(outputDir, fileName) : undefined;

            if (filePath && fs) {
              fs.writeFileSync(filePath, buffer);
            }

            generatedImages.push({
              fileName,
              mimeType: outputMimeType,
              data: inlineData,
              buffer,
              size: buffer.length,
              filePath,
            });

            console.log(
              `[GeminiImageGen] Generated image using Imagen 4.0: ${fileName} (${buffer.length} bytes)`
            );
          }
        }

        if (generatedImages.length > 0) {
          return generatedImages;
        }
      }
    } catch (imagenError) {
      const errorMsg = imagenError instanceof Error ? imagenError.message : String(imagenError);
      console.warn('[GeminiImageGen] Imagen 4.0 failed, trying fallback model:', errorMsg);
      
      // Only skip fallback if model is explicitly imagen-4.0 AND tryImagenFirst is false
      // (meaning user explicitly wants only Imagen 4.0 with no fallback)
      if (model === 'imagen-4.0' && !tryImagenFirst) {
        throw imagenError instanceof Error ? imagenError : new Error('Imagen 4.0 generation failed');
      }

      // Log which key was used when Imagen fails
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('billing')) {
        console.error('[GeminiImageGen] Imagen 4.0 quota/billing error. Using API key:', keyInfo);
      }
      
      // Continue to fallback (will use Gemini model below)
    }
  }

  // Use Gemini streaming model as fallback
  // If model was explicitly set to a Gemini model, use that; otherwise use fallback model
  const geminiModel = (model === 'imagen-4.0' || tryImagenFirst) 
    ? fallbackModel 
    : model;
  console.log('[GeminiImageGen] Using Gemini fallback model:', geminiModel);

  const config = {
    responseModalities: ['IMAGE', 'TEXT'],
  };

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: prompt.trim(),
        },
      ],
    },
  ];

  // Generate with optional retry logic
  const generateStream = async () => {
    return await ai.models.generateContentStream({
      model: geminiModel,
      config,
      contents,
    });
  };

  const response = useRetry
    ? await retryWithBackoff(generateStream, maxRetries, retryBaseDelay)
    : await generateStream();

  const generatedImages: GeneratedImageData[] = [];
  let fileIndex = 0;
  const fs = outputDir ? await import('fs') : null;
  const path = outputDir ? await import('path') : null;
  const timestamp = Date.now();

  if (outputDir && fs && path) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0]?.content || !chunk.candidates[0]?.content?.parts) {
      continue;
    }

    if (chunk.candidates[0]?.content?.parts[0]?.inlineData) {
      const inlineData = chunk.candidates[0].content.parts[0].inlineData;
      const mimeType = inlineData.mimeType || 'image/png';
      const fileExtension = mime.extension(mimeType) || 'png';
      const buffer = Buffer.from(inlineData.data || '', 'base64');
      const fileName = `${fileNamePrefix}_${timestamp}_${fileIndex++}.${fileExtension}`;
      const filePath = outputDir && path ? path.join(outputDir, fileName) : undefined;

      if (filePath && fs) {
        fs.writeFileSync(filePath, buffer);
      }

      const imageData: GeneratedImageData = {
        fileName,
        mimeType,
        data: inlineData.data,
        buffer,
        size: buffer.length,
        filePath,
      };

      generatedImages.push(imageData);
      console.log(`[GeminiImageGen] Generated image: ${fileName} (${buffer.length} bytes)`);

      // If we only need one image, break early
      if (generatedImages.length >= count) {
        break;
      }
    } else if (chunk.text) {
      console.log('[GeminiImageGen] Generation response:', chunk.text);
    }
  }

  if (generatedImages.length === 0) {
    throw new Error('Image generation did not return any image data');
  }

  console.log(`[GeminiImageGen] Generated ${generatedImages.length} image(s) successfully`);
  return generatedImages;
}

/**
 * Convenience function for generating a single image
 */
/**
 * Convenience function for generating a single image
 */
export async function generateSingleImage(
  prompt: string,
  options?: Omit<ImageGenerationOptions, 'prompt' | 'count'>
): Promise<GeneratedImageData> {
  const images = await generateImageWithAI({
    prompt,
    count: 1,
    ...options,
  });
  return images[0];
}

// ============================================================================
// TEXT GENERATION
// ============================================================================

/**
 * Extract JSON from text, handling markdown code blocks
 * Removes ```json, ```, and other markdown formatting
 */
function extractJsonFromText(text: string): string {
  let cleaned = text.trim();
  
  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```json\s*/i, '');
  cleaned = cleaned.replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  
  // Try to find JSON object/array in the text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  return cleaned;
}

export interface TextGenerationOptions {
  /** User message/prompt */
  prompt: string;
  /** System instruction/prompt to guide the AI's behavior */
  systemPrompt?: string;
  /** API key (if not provided, will be retrieved from store or env) */
  apiKey?: string;
  /** Model to use (default: 'gemini-2.5-flash') */
  model?: string;
  /** Temperature for generation (default: 0.7) */
  temperature?: number;
  /** Maximum output tokens (default: 4096) */
  maxOutputTokens?: number;
  /** Whether to use streaming mode (default: false) */
  streaming?: boolean;
  /** Whether to use retry logic (default: true for streaming, false for non-streaming) */
  useRetry?: boolean;
  /** Max retries for retry logic (default: 3) */
  maxRetries?: number;
  /** Base delay for retry logic in ms (default: 2000) */
  retryBaseDelay?: number;
  /** Optional JSON schema for structured output */
  responseSchema?: any;
  /** Whether to parse JSON response automatically (default: true if responseSchema provided) */
  parseJson?: boolean;
  /** Package to use: 'genai' (streaming) or 'generative-ai' (non-streaming, default) */
  package?: 'genai' | 'generative-ai';
}

export interface TextGenerationResult {
  /** Generated text content */
  text: string;
  /** Parsed JSON object if parseJson is true and response is valid JSON */
  json?: any;
  /** Raw response text before parsing */
  raw: string;
}

/**
 * Generate text using Gemini AI
 * This is the central function that consolidates all text generation logic
 * Supports both streaming and non-streaming modes
 */
export async function generateTextWithAI(
  options: TextGenerationOptions
): Promise<TextGenerationResult> {
  const {
    prompt,
    systemPrompt,
    apiKey: providedApiKey,
    model = 'gemini-2.5-flash',
    temperature = 0.7,
    maxOutputTokens = 4096,
    streaming = false,
    useRetry,
    maxRetries = 3,
    retryBaseDelay = 2000,
    responseSchema,
    parseJson = !!responseSchema,
    package: pkg = 'generative-ai',
  } = options;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Text prompt is required for text generation');
  }

  // Get API key
  const apiKeyInfo = providedApiKey ? { apiKey: providedApiKey } : getGoogleApiKey();
  const apiKey = apiKeyInfo.apiKey;

  if (!apiKey) {
    throw new Error(
      'Google API key is required for text generation. ' +
      'Please provide an API key parameter, configure one in the AI Keys Manager, or set the GEMINI_API_KEY environment variable.'
    );
  }

  // Store key info for error logging
  const keyInfo = {
    keyName: apiKeyInfo.keyName || 'unnamed',
    keyId: apiKeyInfo.keyId || 'unknown',
    keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`,
  };

  console.log('[GeminiTextGen] Generating text with model:', model);
  console.log('[GeminiTextGen] Mode:', streaming ? 'streaming' : 'non-streaming');
  console.log('[GeminiTextGen] Package:', pkg);
  console.log('[GeminiTextGen] Using API key:', keyInfo.keyPreview);

  // Determine retry usage: default to true for streaming, false for non-streaming
  const shouldRetry = useRetry !== undefined ? useRetry : streaming;

  // Use @google/genai package (supports both streaming and non-streaming)
  if (pkg === 'genai') {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const config: any = {
      generationConfig: {
        temperature,
        maxOutputTokens,
      },
    };

    // Add system instruction if provided
    if (systemPrompt) {
      config.systemInstruction = [
        {
          text: systemPrompt,
        },
      ];
    }

    // Add JSON schema if provided - use responseJsonSchema for structured output
    // Structured output prevents markdown wrapping and ensures valid JSON
    if (responseSchema) {
      config.responseMimeType = 'application/json';
      config.responseJsonSchema = responseSchema;
    }

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: prompt.trim(),
          },
        ],
      },
    ];

    let fullText = '';

    // Use structured output mode (non-streaming) when schema is provided for better reliability
    // Structured output with responseJsonSchema works best with non-streaming and prevents markdown wrapping
    if (responseSchema) {
      // Force non-streaming when using structured output
      const generateContent = async () => {
        return await ai.models.generateContent({
          model,
          config,
          contents,
        });
      };

      const response = shouldRetry
        ? await retryWithBackoff(generateContent, maxRetries, retryBaseDelay)
        : await generateContent();

      fullText = response.text || '';
    } else if (streaming) {
      // Use streaming mode only when no schema is provided
      const generateStream = async () => {
        return await ai.models.generateContentStream({
          model,
          config,
          contents,
        });
      };

      const response = shouldRetry
        ? await retryWithBackoff(generateStream, maxRetries, retryBaseDelay)
        : await generateStream();

      for await (const chunk of response) {
        if (typeof chunk.text === 'string') {
          fullText += chunk.text;
        }
      }
    } else {
      // Non-streaming without schema
      const generateContent = async () => {
        return await ai.models.generateContent({
          model,
          config,
          contents,
        });
      };

      const response = shouldRetry
        ? await retryWithBackoff(generateContent, maxRetries, retryBaseDelay)
        : await generateContent();

      fullText = response.text || '';
    }

    console.log(`[GeminiTextGen] Generated text (${fullText.length} characters)`);

    // Parse JSON if requested
    let parsedJson: any = undefined;
    if (parseJson) {
      try {
        // If structured output was used, JSON should be clean (no markdown)
        // But we still extract as fallback in case of issues
        const jsonText = responseSchema ? fullText.trim() : extractJsonFromText(fullText);
        parsedJson = JSON.parse(jsonText);
        console.log('[GeminiTextGen] Successfully parsed JSON response');
      } catch (parseError) {
        console.warn('[GeminiTextGen] Failed to parse JSON response:', parseError);
        console.warn('[GeminiTextGen] Raw response (first 500 chars):', fullText.substring(0, 500));
        // Re-throw with more context
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response may be wrapped in markdown code blocks.`);
      }
    }

    return {
      text: fullText.trim(),
      json: parsedJson,
      raw: fullText,
    };
  }

  // Use non-streaming mode with @google/generative-ai
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);

  const generationConfig: any = {
    temperature,
    maxOutputTokens,
  };

  // Add JSON schema if provided
  if (responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = responseSchema;
  }

  const aiModel = genAI.getGenerativeModel({
    model,
    generationConfig,
    systemInstruction: systemPrompt,
  });

  // Generate with optional retry logic
  const generateContent = async () => {
    return await aiModel.generateContent(prompt.trim());
  };

  const result = shouldRetry
    ? await retryWithBackoff(generateContent, maxRetries, retryBaseDelay)
    : await generateContent();

  const response = result.response;
  const text = response.text();
  console.log(`[GeminiTextGen] Generated text (${text.length} characters)`);

  // Parse JSON if requested
  let parsedJson: any = undefined;
  if (parseJson) {
    try {
      parsedJson = JSON.parse(text);
      console.log('[GeminiTextGen] Successfully parsed JSON response');
    } catch (parseError) {
      console.warn('[GeminiTextGen] Failed to parse JSON response:', parseError);
    }
  }

  return {
    text: text.trim(),
    json: parsedJson,
    raw: text,
  };
}

/**
 * Convenience function for generating text with structured JSON output
 */
export async function generateStructuredText(
  prompt: string,
  systemPrompt: string,
  responseSchema: any,
  options?: Omit<TextGenerationOptions, 'prompt' | 'systemPrompt' | 'responseSchema' | 'parseJson'>
): Promise<any> {
  const result = await generateTextWithAI({
    prompt,
    systemPrompt,
    responseSchema,
    parseJson: true,
    ...options,
  });

  if (!result.json) {
    throw new Error('Failed to parse structured JSON response');
  }

  return result.json;
}

/**
 * Convenience function for generating text with streaming
 */
export async function generateTextStream(
  prompt: string,
  options?: Omit<TextGenerationOptions, 'prompt' | 'streaming'>
): Promise<string> {
  const result = await generateTextWithAI({
    prompt,
    streaming: true,
    package: 'genai',
    ...options,
  });

  return result.text;
}

