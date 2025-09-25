// Generate images if any are requested
import { ParsedContent, Image } from './index';
import * as mime from 'mime-types';
import retryWithBackoff from './retry';
import { WordPressHandler } from '../wordpress/wordpress-handler';

export default async function generateImages(parsedContent: ParsedContent) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  
  if (parsedContent.images && parsedContent.images.length > 0) {
    const generatedImages = [];
    
    for (let i = 0; i < parsedContent.images.length; i++) {
      const imageRequest = parsedContent.images[i];
      try {
        const images = await generateImage(imageRequest.description, 1);
        if (images.length > 0) {
          const generatedImage = images[0];
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
        }
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

/**
 * Generate images using Gemini AI
 * @param {string} prompt - The image generation prompt
 * @param {number} count - Number of images to generate
 * @returns {Promise<Array>} - Array of generated image data
 */
async function generateImage(prompt: string, count = 1) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
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
            text: prompt,
          },
        ],
      },
    ];
  
    // Use retry logic for the API call
    const response = await retryWithBackoff(async () => {
      return await ai.models.generateContentStream({
        model,
        config,
        contents,
      });
    }, 3, 2000); // 3 retries, 2 second base delay
  
    const generatedImages = [];
    let fileIndex = 0;
  
    for await (const chunk of response) {
      if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
        continue;
      }
  
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        const fileName = `gemini_image_${Date.now()}_${fileIndex++}`;
        const inlineData = chunk.candidates[0].content.parts[0].inlineData;
        const fileExtension = mime.extension(inlineData.mimeType || 'image/png');
        const buffer = Buffer.from(inlineData.data || '', 'base64');
        
        const imageData = {
          fileName: `${fileName}.${fileExtension}`,
          mimeType: inlineData.mimeType || 'image/png',
          data: inlineData.data,
          buffer: buffer,
          size: buffer.length
        };
  
        generatedImages.push(imageData);

        console.log(`✅ Generated image: ${imageData.fileName} (${imageData.size} bytes)`);
      } else if (chunk.text) {
        console.log('📝 Image generation response:', chunk.text);
      }
    }
  
    console.log(`🎉 Generated ${generatedImages.length} image(s) successfully`);
    return generatedImages;
  }

