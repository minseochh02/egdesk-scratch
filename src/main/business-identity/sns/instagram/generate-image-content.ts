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
 */
function getGoogleApiKey(): string | null {
  try {
    const store = getStore?.();
    if (store) {
      const aiKeys = store.get('ai-keys', []);
      if (Array.isArray(aiKeys)) {
        const googleKey = aiKeys.find(
          (k: any) =>
            k?.providerId === 'google' &&
            k?.fields?.apiKey &&
            typeof k.fields.apiKey === 'string' &&
            k.fields.apiKey.trim().length > 0
        );
        if (googleKey?.fields?.apiKey) {
          return googleKey.fields.apiKey.trim();
        }
      }
    }
  } catch (error) {
    console.error('[generateInstagramImage] Error reading API key from store:', error);
  }

  // Fallback to environment variable
  if (process.env.GEMINI_API_KEY && typeof process.env.GEMINI_API_KEY === 'string') {
    return process.env.GEMINI_API_KEY.trim();
  }

  return null;
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

  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    throw new Error('AI is not configured. Please configure a Google AI key first.');
  }

  // Ensure output directory exists
  const outputDir = options.outputDir || path.join(app.getPath('temp'), 'egdesk-instagram-images');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileNamePrefix = options.fileNamePrefix || 'instagram_image';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 9);

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey,
    });

    const config = {
      responseModalities: ['IMAGE', 'TEXT'],
    };

    const model = 'gemini-2.5-flash-image-preview';
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

    console.log('[generateInstagramImage] Calling Gemini image generation API...');
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    let generatedImage: GeneratedInstagramImage | null = null;
    let fileIndex = 0;
    const mime = require('mime-types');

    for await (const chunk of response) {
      if (!chunk.candidates || !chunk.candidates[0]?.content?.parts) {
        continue;
      }

      // Check for image data in the chunk
      if (chunk.candidates[0]?.content?.parts[0]?.inlineData) {
        const inlineData = chunk.candidates[0].content.parts[0].inlineData;
        const mimeType = inlineData.mimeType || 'image/png';
        const fileExtension = mime.extension(mimeType) || 'png';
        const buffer = Buffer.from(inlineData.data || '', 'base64');

        const fileName = `${fileNamePrefix}_${timestamp}_${fileIndex++}.${fileExtension}`;
        const filePath = path.join(outputDir, fileName);

        // Save the image to disk
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
          `[generateInstagramImage] Generated image: ${fileName} (${buffer.length} bytes) at ${filePath}`
        );
        break; // We only need one image for Instagram
      } else if (chunk.text) {
        console.log('[generateInstagramImage] Generation response:', chunk.text);
      }
    }

    if (!generatedImage) {
      throw new Error('Image generation did not return any image data');
    }

    console.log('[generateInstagramImage] Image generation completed successfully');
    return generatedImage;
  } catch (error) {
    console.error('[generateInstagramImage] Error generating image:', error);
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

