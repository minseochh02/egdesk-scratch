/**
 * Instagram Image Content Generator
 * Generates images for Instagram posts using Gemini AI image generation
 * Uses the image prompt from text generation to create appropriate visuals
 */

import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { getStore } from '../../../storage';

export interface GeneratedInstagramImage {
  filePath: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
  altText?: string;
}

export interface InstagramImageGenerationOptions {
  /** Image generation prompt (from text generation) */
  imagePrompt: string;
  /** Alt text for the image */
  altText?: string;
  /** Output directory (defaults to temp directory) */
  outputDir?: string;
  /** File name prefix (defaults to 'instagram_image') */
  fileNamePrefix?: string;
}

/**
 * Get Google API key from store or environment
 * Uses the same selection logic as ai-search.ts: prefers 'egdesk' named key, then active key, then any Google key
 */
function getGoogleApiKey(): { apiKey: string | null; keyName?: string; keyId?: string } {
  try {
    const store = getStore?.();
    if (!store) {
      console.warn('[generateInstagramImage] Store not available');
      return { apiKey: null };
    }

    const aiKeys = store.get('ai-keys', []);
    if (!Array.isArray(aiKeys)) {
      console.warn('[generateInstagramImage] AI keys not found or not an array');
      return { apiKey: null };
    }

    // Find preferred key: egdesk > active > any google key (same logic as ai-search.ts)
    const preferred =
      aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google') ??
      aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) ??
      aiKeys.find((k: any) => k?.providerId === 'google' && k?.fields?.apiKey && typeof k.fields.apiKey === 'string' && k.fields.apiKey.trim().length > 0);

    if (preferred) {
      const keyName = preferred.name || 'unnamed';
      const keyId = preferred.id;
      console.log('[generateInstagramImage] Selected API key:', keyName, 'ID:', keyId);
      
      const apiKey = preferred?.fields?.apiKey;
      if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
        const keyPreview = `${apiKey.trim().substring(0, 8)}...${apiKey.trim().substring(apiKey.trim().length - 4)}`;
        console.log('[generateInstagramImage] Using API key:', keyPreview);
        return { apiKey: apiKey.trim(), keyName, keyId };
      }
    } else {
      console.warn('[generateInstagramImage] No Google API key found in store');
    }

    // Fallback to environment variable
    if (process.env.GEMINI_API_KEY && typeof process.env.GEMINI_API_KEY === 'string') {
      console.log('[generateInstagramImage] Using API key from environment variable');
      return { apiKey: process.env.GEMINI_API_KEY.trim() };
    }

    console.warn('[generateInstagramImage] No valid API key found');
    return { apiKey: null };
  } catch (error) {
    console.error('[generateInstagramImage] Error reading API key from store:', error);
    return { apiKey: null };
  }
}

/**
 * Generate an Instagram image using Gemini AI
 */
export async function generateInstagramImage(
  options: InstagramImageGenerationOptions
): Promise<GeneratedInstagramImage> {
  console.log('[generateInstagramImage] Starting image generation...');
  console.log('[generateInstagramImage] Image prompt:', options.imagePrompt?.substring(0, 100) + '...');

  if (!options.imagePrompt || typeof options.imagePrompt !== 'string' || !options.imagePrompt.trim()) {
    throw new Error('Image prompt is required for image generation');
  }

  const { apiKey, keyName, keyId } = getGoogleApiKey();
  if (!apiKey) {
    throw new Error('AI is not configured. Please configure a Google AI key first.');
  }

  // Store key info for error logging
  const keyInfo = {
    keyName: keyName || 'unnamed',
    keyId: keyId || 'unknown',
    keyPreview: `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
  };

  console.log('[generateInstagramImage] Using API key for image generation:', keyInfo);

  // Ensure output directory exists
  const outputDir = options.outputDir || path.join(app.getPath('temp'), 'egdesk-instagram-images');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileNamePrefix = options.fileNamePrefix || 'instagram_image';
  const timestamp = Date.now();

  try {
    const { GoogleGenAI, PersonGeneration } = await import('@google/genai');
    const mime = require('mime-types');
    const ai = new GoogleGenAI({
      apiKey,
    });

    // Try Imagen 4.0 first
    try {
      console.log('[generateInstagramImage] Attempting Imagen 4.0 image generation...');
      const response = await ai.models.generateImages({
        model: 'models/imagen-4.0-generate-001',
        prompt: options.imagePrompt.trim(),
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          personGeneration: PersonGeneration.ALLOW_ALL,
          aspectRatio: '1:1', // Instagram square format
          imageSize: '1K',
        },
      });

      if (response?.generatedImages && response.generatedImages.length > 0) {
        const firstImage = response.generatedImages[0];
        if (firstImage?.image?.imageBytes) {
          const inlineData = firstImage.image.imageBytes;
          const buffer = Buffer.from(inlineData || '', 'base64');
          const mimeType = 'image/jpeg';
          const fileExtension = 'jpeg';
          const fileName = `${fileNamePrefix}_${timestamp}.${fileExtension}`;
          const filePath = path.join(outputDir, fileName);

          fs.writeFileSync(filePath, buffer);

          const generatedImage: GeneratedInstagramImage = {
            filePath,
            fileName,
            mimeType,
            buffer,
            size: buffer.length,
            altText: options.altText,
          };

          console.log(
            `[generateInstagramImage] Generated image using Imagen 4.0: ${fileName} (${buffer.length} bytes) at ${filePath}`
          );
          return generatedImage;
        }
      }
    } catch (imagenError) {
      const errorMsg = imagenError instanceof Error ? imagenError.message : String(imagenError);
      console.warn('[generateInstagramImage] Imagen 4.0 failed, trying fallback model:', errorMsg);
      // Log which key was used when Imagen fails
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('billing')) {
        console.error('[generateInstagramImage] Imagen 4.0 quota/billing error. Using API key:', keyInfo);
      }
    }

    // Fallback to gemini-2.5-flash-image with streaming
    console.log('[generateInstagramImage] Attempting fallback: gemini-2.5-flash-image...');
    const config = {
      responseModalities: ['IMAGE', 'TEXT'],
    };

    const model = 'gemini-2.5-flash-image';
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: options.imagePrompt.trim(),
          },
        ],
      },
    ];

    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    let generatedImage: GeneratedInstagramImage | null = null;
    let fileIndex = 0;

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
        const filePath = path.join(outputDir, fileName);

        fs.writeFileSync(filePath, buffer);

        generatedImage = {
          filePath,
          fileName,
          mimeType,
          buffer,
          size: buffer.length,
          altText: options.altText,
        };

        console.log(
          `[generateInstagramImage] Generated image using fallback model: ${fileName} (${buffer.length} bytes) at ${filePath}`
        );
        break; // We only need one image for Instagram
      } else if (chunk.text) {
        console.log('[generateInstagramImage] Generation response:', chunk.text);
      }
    }

    if (!generatedImage) {
      throw new Error('Image generation did not return any image data from either model');
    }

    console.log('[generateInstagramImage] Image generation completed successfully');
    return generatedImage;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[generateInstagramImage] Error generating image:', errorMsg);
    
    // Log which key was used when errors occur
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('billing')) {
      console.error('[generateInstagramImage] Quota/billing error. API key used:', keyInfo);
    }
    
    throw error instanceof Error
      ? error
      : new Error('Failed to generate image: Unknown error occurred');
  }
}

/**
 * Generate image from Instagram content plan
 * This is a convenience function that extracts the image prompt from generated content
 */
export async function generateImageFromContentPlan(
  imagePrompt: string,
  altText?: string,
  options?: Partial<InstagramImageGenerationOptions>
): Promise<GeneratedInstagramImage> {
  if (!imagePrompt || typeof imagePrompt !== 'string' || !imagePrompt.trim()) {
    throw new Error('Image prompt is required');
  }

  return generateInstagramImage({
    imagePrompt: imagePrompt.trim(),
    altText,
    ...options,
  });
}

