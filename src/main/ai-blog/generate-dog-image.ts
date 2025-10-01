// Generate dog image using Gemini AI and prepare for clipboard
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';
import retryWithBackoff from './retry';

export interface GeneratedImage {
  fileName: string;
  mimeType: string;
  data: string; // base64 data
  buffer: Buffer;
  size: number;
  filePath: string;
}

/**
 * Generate a dog image using Gemini AI
 * @param {string} prompt - The image generation prompt (optional, defaults to dog description)
 * @returns {Promise<GeneratedImage>} - Generated image data
 */
export async function generateDogImage(prompt?: string): Promise<GeneratedImage> {
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
  const imagePrompt = prompt || 'A cute, friendly golden retriever dog sitting in a park, high quality, photorealistic, professional photography style, bright and cheerful lighting';
  
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: imagePrompt,
        },
      ],
    },
  ];

  console.log(`🐕 Generating dog image with prompt: "${imagePrompt}"`);

  // Use retry logic for the API call
  const response = await retryWithBackoff(async () => {
    return await ai.models.generateContentStream({
      model,
      config,
      contents,
    });
  }, 3, 2000); // 3 retries, 2 second base delay

  let generatedImage: GeneratedImage | null = null;
  let fileIndex = 0;

  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
      continue;
    }

    if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
      const fileName = `dog_image_${Date.now()}_${fileIndex++}`;
      const inlineData = chunk.candidates[0].content.parts[0].inlineData;
      const fileExtension = mime.extension(inlineData.mimeType || 'image/png');
      const buffer = Buffer.from(inlineData.data || '', 'base64');
      
      // Create output directory if it doesn't exist
      const outputDir = path.join(process.cwd(), 'output', 'generated-images');
      await fs.promises.mkdir(outputDir, { recursive: true });
      
      const fullFileName = `${fileName}.${fileExtension}`;
      const filePath = path.join(outputDir, fullFileName);
      
      // Save image to file
      await fs.promises.writeFile(filePath, buffer);
      
      generatedImage = {
        fileName: fullFileName,
        mimeType: inlineData.mimeType || 'image/png',
        data: inlineData.data,
        buffer: buffer,
        size: buffer.length,
        filePath: filePath
      };

      console.log(`✅ Generated dog image: ${generatedImage.fileName} (${generatedImage.size} bytes)`);
      console.log(`📁 Saved to: ${filePath}`);
    } else if (chunk.text) {
      console.log('📝 Image generation response:', chunk.text);
    }
  }

  if (!generatedImage) {
    throw new Error('Failed to generate dog image - no image data received from Gemini');
  }

  console.log(`🎉 Dog image generated successfully!`);
  return generatedImage;
}

/**
 * Copy image to clipboard using Playwright's clipboard API
 * @param {string} imagePath - Path to the image file
 * @param {any} page - Playwright page object
 * @returns {Promise<boolean>} - Success status
 */
export async function copyImageToClipboardWithPlaywright(imagePath: string, page: any): Promise<boolean> {
  try {
    console.log(`📋 Copying image to clipboard using Playwright: ${imagePath}`);
    
    // Read the image file as buffer
    const imageBuffer = await fs.promises.readFile(imagePath);
    console.log(`📊 Image buffer size: ${imageBuffer.length} bytes`);
    
    // Get the MIME type from the file extension
    const mimeType = mime.lookup(imagePath) || 'image/png';
    console.log(`📄 MIME type: ${mimeType}`);
    
    // Use Playwright's clipboard API to set the image
    const result = await page.evaluate(({ buffer, mimeType }: { buffer: number[], mimeType: string }) => {
      return new Promise<{ success: boolean, error?: string }>((resolve) => {
        console.log('🔍 Starting clipboard operation in browser context...');
        console.log('Buffer length:', buffer.length);
        console.log('MIME type:', mimeType);
        
        const reader = new FileReader();
        reader.onload = () => {
          console.log('📖 FileReader onload triggered');
          if (reader.result) {
            console.log('📦 Creating blob from result...');
            const blob = new Blob([reader.result], { type: mimeType });
            console.log('📋 Blob created, size:', blob.size);
            
            console.log('📝 Writing to clipboard...');
            navigator.clipboard.write([
              new ClipboardItem({
                [mimeType]: blob
              })
            ]).then(() => {
              console.log('✅ Clipboard write successful');
              resolve({ success: true });
            }).catch((error) => {
              console.error('❌ Clipboard write failed:', error);
              resolve({ success: false, error: error.message });
            });
          } else {
            console.error('❌ FileReader result is null');
            resolve({ success: false, error: 'FileReader result is null' });
          }
        };
        reader.onerror = (error) => {
          console.error('❌ FileReader error:', error);
          resolve({ success: false, error: 'FileReader error' });
        };
        
        console.log('🔄 Starting FileReader...');
        reader.readAsArrayBuffer(new Blob([new Uint8Array(buffer)]));
      });
    }, { buffer: Array.from(imageBuffer), mimeType });
    
    if (result.success) {
      console.log(`✅ Image copied to clipboard successfully using Playwright`);
      return true;
    } else {
      console.error(`❌ Clipboard operation failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to copy image to clipboard with Playwright:', error);
    return false;
  }
}

/**
 * Copy image to clipboard (macOS specific implementation) - fallback method
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<boolean>} - Success status
 */
export async function copyImageToClipboard(imagePath: string): Promise<boolean> {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Use macOS pbcopy with image data
    const command = `osascript -e 'set the clipboard to (read (POSIX file "${imagePath}") as «class PNGf») as string'`;
    
    console.log(`📋 Copying image to clipboard: ${imagePath}`);
    await execAsync(command);
    console.log(`✅ Image copied to clipboard successfully`);
    return true;
  } catch (error) {
    console.error('❌ Failed to copy image to clipboard:', error);
    return false;
  }
}

/**
 * Generate dog image and copy to clipboard
 * @param {string} prompt - Optional custom prompt for image generation
 * @returns {Promise<{success: boolean, imagePath?: string, error?: string}>} - Result object
 */
export async function generateAndCopyDogImage(prompt?: string): Promise<{success: boolean, imagePath?: string, error?: string}> {
  try {
    // Generate the dog image
    const image = await generateDogImage(prompt);
    
    // Copy to clipboard
    const clipboardSuccess = await copyImageToClipboard(image.filePath);
    
    if (clipboardSuccess) {
      return {
        success: true,
        imagePath: image.filePath
      };
    } else {
      return {
        success: false,
        error: 'Failed to copy image to clipboard'
      };
    }
  } catch (error) {
    console.error('❌ Error generating and copying dog image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
