// Generate images if any are requested
import { ParsedContent, Image } from './index';
import { WordPressHandler } from '../wordpress/wordpress-handler';
import { generateSingleImage } from '../gemini';

export default async function generateImages(parsedContent: ParsedContent) {
  if (parsedContent.images && parsedContent.images.length > 0) {
    const generatedImages = [];
    
    for (let i = 0; i < parsedContent.images.length; i++) {
      const imageRequest = parsedContent.images[i];
      try {
        const generatedImage = await generateSingleImage(imageRequest.description, {
          useRetry: true,
          maxRetries: 3,
          retryBaseDelay: 2000,
        });
        
          // Immediately upload to WordPress using WordPressHandler
          const wp = new WordPressHandler(undefined as any, null);
          const uploadedArr = await wp.uploadImagesToWordPress([
            {
              ...imageRequest,
              fileName: generatedImage.fileName,
              mimeType: generatedImage.mimeType,
              buffer: generatedImage.buffer,
              altText: imageRequest.altText || imageRequest.description,
              caption: imageRequest.caption || '',
              description: imageRequest.description || '',
              title: imageRequest.description || generatedImage.fileName
            }
          ]);
          const uploaded = uploadedArr[0] || {};
          // Persist the WordPress IDs onto the original images array
          parsedContent.images[i] = {
            ...imageRequest,
            altText: uploaded.altText || imageRequest.description,
            caption: uploaded.caption || '',
            description: uploaded.description || imageRequest.description,
            title: uploaded.title || imageRequest.description,
            wordpress: {
              id: String(uploaded.mediaId || uploaded.id || ''),
              url: uploaded.wordpressUrl || uploaded.source_url || ''
            }
          } as Image;

          generatedImages.push({
            ...imageRequest,
            fileName: generatedImage.fileName,
            mimeType: generatedImage.mimeType,
            size: generatedImage.size,
            generated: true
          });
      } catch (error: any) {
        console.error(`❌ Failed to generate image ${i + 1}:`, error.message);
        generatedImages.push({
          ...imageRequest,
          generated: false,
          error: error.message
        });
      }
    }
    
    console.log(`🎉 Image generation completed: ${generatedImages.filter(img => img.generated).length}/${parsedContent.images.length} successful`);
    return parsedContent;
  }

  return parsedContent;
  }

