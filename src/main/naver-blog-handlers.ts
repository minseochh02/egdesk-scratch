// IPC handlers for Naver Blog automation with AI-generated images
import { ipcMain } from 'electron';
import { runNaverBlogWithImage } from './naver-blog-with-image';

/**
 * Register Naver Blog automation IPC handlers
 */
export function registerNaverBlogHandlers(): void {
  console.log('📝 Registering Naver Blog automation IPC handlers...');

  // Generate dog image and copy to clipboard
  ipcMain.handle('naver-blog-generate-dog-image', async (event, params: {
    prompt?: string;
  }) => {
    try {
      const { generateAndCopyDogImage } = require('./ai-blog/generate-dog-image');
      
      const result = await generateAndCopyDogImage(params.prompt);
      
      return {
        success: result.success,
        imagePath: result.imagePath,
        error: result.error
      };
    } catch (error) {
      console.error('Error generating dog image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Run Naver Blog automation with image
  ipcMain.handle('naver-blog-automation-with-image', async (event, params: {
    username: string;
    password: string;
    proxyUrl?: string;
    title?: string;
    content?: string;
    tags?: string;
    includeDogImage?: boolean;
    dogImagePrompt?: string;
  }) => {
    try {
      const {
        username,
        password,
        proxyUrl,
        title,
        content,
        tags,
        includeDogImage = true,
        dogImagePrompt
      } = params;

      console.log('🚀 Starting Naver Blog automation with AI-generated dog image...');
      
      const result = await runNaverBlogWithImage(
        username,
        password,
        proxyUrl,
        title,
        content,
        tags,
        includeDogImage,
        dogImagePrompt
      );

      return {
        success: result.success,
        imageGenerated: result.imageGenerated,
        error: result.error,
        fallback: result.fallback
      };
    } catch (error) {
      console.error('Error running Naver Blog automation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Generate dog image only (without automation)
  ipcMain.handle('naver-blog-generate-dog-image-only', async (event, params: {
    prompt?: string;
    saveToFile?: boolean;
  }) => {
    try {
      const { generateDogImage } = require('./ai-blog/generate-dog-image');
      
      const image = await generateDogImage(params.prompt);
      
      return {
        success: true,
        image: {
          fileName: image.fileName,
          mimeType: image.mimeType,
          size: image.size,
          filePath: image.filePath
        }
      };
    } catch (error) {
      console.error('Error generating dog image only:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  console.log('✅ Naver Blog automation IPC handlers registered');
}
