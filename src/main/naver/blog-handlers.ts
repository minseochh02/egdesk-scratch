// IPC handlers for Naver Blog automation with AI-generated images
import { ipcMain } from 'electron';
import { runNaverBlogAutomation } from './browser-controller';

/**
 * Register Naver Blog automation IPC handlers
 */
export function registerNaverBlogHandlers(): void {
  console.log('📝 Registering Naver Blog automation IPC handlers...');

  // Run Naver Blog automation with image
  ipcMain.handle('naver-blog-automation-with-image', async (event, params: {
    username: string;
    password: string;
    proxyUrl?: string;
    title?: string;
    content?: string;
    tags?: string;
  }) => {
    try {
      const {
        username,
        password,
        proxyUrl,
        title,
        content,
        tags,
      } = params;

      console.log('🚀 Starting Naver Blog automation...');
      
      const result = await runNaverBlogAutomation(
        {
          username,
          password,
          proxyUrl
        },
        {
          title: title || 'Test Title',
          content: content || 'Test Content',
          tags: tags || '#test'
        }
      );

      return {
        success: result.success,
        imageGenerated: result.imageGenerated,
        error: result.error,
        blogUrl: result.blogUrl
      };
    } catch (error) {
      console.error('Error running Naver Blog automation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });


  console.log('✅ Naver Blog automation IPC handlers registered');
}
