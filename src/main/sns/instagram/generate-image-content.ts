/**
 * Instagram Image Content Generator
 * Generates images for Instagram posts using Gemini AI image generation
 * Uses the image prompt from text generation to create appropriate visuals
 */

import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { generateImageWithAI } from '../../gemini';

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

  // Ensure output directory exists
  const outputDir = options.outputDir || path.join(app.getPath('temp'), 'egdesk-instagram-images');
  const fileNamePrefix = options.fileNamePrefix || 'instagram_image';

  try {
    // Use centralized function - defaults to Imagen 4.0 with Gemini 2.5 fallback
    const generatedImages = await generateImageWithAI({
        prompt: options.imagePrompt.trim(),
      count: 1,
      fallbackModel: 'gemini-2.5-flash-image', // Fallback model if Imagen 4.0 fails
      aspectRatio: '1:1', // Instagram square format
      imageSize: '1K',
      outputMimeType: 'image/jpeg',
      outputDir,
      fileNamePrefix,
      useRetry: false, // Let the centralized function handle retries
    });

    if (generatedImages.length === 0) {
      throw new Error('Image generation did not return any image data');
      }

    const generatedImage = generatedImages[0];
    const result: GeneratedInstagramImage = {
      filePath: generatedImage.filePath!,
      fileName: generatedImage.fileName,
      mimeType: generatedImage.mimeType,
      buffer: generatedImage.buffer,
      size: generatedImage.size,
          altText: options.altText,
        };

    console.log('[generateInstagramImage] Image generation completed successfully');
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[generateInstagramImage] Error generating image:', errorMsg);
    
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

