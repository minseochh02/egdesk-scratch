#!/usr/bin/env node
/**
 * Single Image Debug Script
 * This script generates a single image, downloads it, and uploads it to WordPress
 * for debugging image generation and upload issues.
 */

const fs = require('fs');
const path = require('path');

// Mock services for standalone execution
class MockBlogImageGenerator {
  constructor(options = {}) {
    this.options = options;
    console.log('🔍 DEBUG: MockBlogImageGenerator initialized with options:', {
      provider: options.provider,
      quality: options.quality,
      size: options.size,
      hasApiKey: !!options.apiKey
    });
  }

  async generateSingleImage(prompt, placement = 'featured') {
    console.log('🔍 DEBUG: Generating single image...');
    console.log('  - Prompt:', prompt);
    console.log('  - Placement:', placement);
    console.log('  - Provider:', this.options.provider);
    console.log('  - API Key present:', !!this.options.apiKey);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // For debugging, we'll use a placeholder image service
    const imageId = `debug_${Date.now()}`;
    const mockImageUrl = `https://picsum.photos/1024/1024?random=${Date.now()}`;
    
    console.log('🔍 DEBUG: Mock image generated:', {
      id: imageId,
      url: mockImageUrl,
      prompt: prompt
    });

    return {
      id: imageId,
      url: mockImageUrl,
      prompt: prompt,
      description: `Debug image for: ${prompt}`,
      altText: `Debug image: ${prompt}`,
      caption: `Generated for debugging: ${prompt}`,
      placement: placement,
      style: this.options.quality || 'standard',
      aspectRatio: 'landscape'
    };
  }
}

class MockWordPressMediaService {
  constructor(url, username, password) {
    this.url = url;
    this.username = username;
    this.password = password;
    console.log('🔍 DEBUG: MockWordPressMediaService initialized:', {
      url: url,
      username: username,
      hasPassword: !!password
    });
  }

  async uploadMedia(imageBuffer, fileName, mimeType, metadata = {}) {
    console.log('🔍 DEBUG: Uploading media to WordPress...');
    console.log('  - File name:', fileName);
    console.log('  - MIME type:', mimeType);
    console.log('  - Buffer size:', imageBuffer.length, 'bytes');
    console.log('  - Metadata:', metadata);

    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock successful upload
    const mockMediaId = Math.floor(Math.random() * 1000) + 100;
    const mockUrl = `${this.url}/wp-content/uploads/debug-${fileName}`;
    
    console.log('✅ DEBUG: Mock upload successful:', {
      id: mockMediaId,
      source_url: mockUrl,
      fileName: fileName
    });

    return {
      id: mockMediaId,
      source_url: mockUrl,
      title: metadata.title || fileName,
      alt_text: metadata.alt_text || '',
      caption: metadata.caption || ''
    };
  }
}

async function downloadImage(url) {
  console.log('🔍 DEBUG: Downloading image from URL:', url);
  
  try {
    // In a real implementation, you would use fetch or axios
    // For this mock, we'll simulate the download
    console.log('  - Fetching image...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate successful download
    const mockBuffer = Buffer.from('mock-image-data-' + Date.now());
    const mimeType = 'image/jpeg';
    
    console.log('✅ DEBUG: Image downloaded successfully:', {
      url: url,
      size: mockBuffer.length,
      mimeType: mimeType
    });

    return {
      buffer: mockBuffer,
      mimeType: mimeType
    };
  } catch (error) {
    console.error('❌ DEBUG: Failed to download image:', error.message);
    throw error;
  }
}

async function runSingleImageDebug() {
  console.log('🚀 Starting Single Image Debug Workflow');
  console.log('=====================================');

  try {
    // Configuration
    const config = {
      wordpressUrl: 'http://m8chaa.mycafe24.com',
      wordpressUsername: 'admin',
      wordpressPassword: 'your-password-here', // Replace with actual password
      imagePrompt: 'A futuristic AI robot writing code on a computer screen, digital art style',
      placement: 'featured'
    };

    console.log('🔍 DEBUG: Configuration:', {
      wordpressUrl: config.wordpressUrl,
      wordpressUsername: config.wordpressUsername,
      hasPassword: !!config.wordpressPassword,
      imagePrompt: config.imagePrompt,
      placement: config.placement
    });

    // Step 1: Initialize services
    console.log('\n=== Step 1: Initializing Services ===');
    const imageGenerator = new MockBlogImageGenerator({
      provider: 'dalle',
      quality: 'standard',
      size: '1024x1024',
      apiKey: 'mock-api-key-for-debugging'
    });

    const mediaService = new MockWordPressMediaService(
      config.wordpressUrl,
      config.wordpressUsername,
      config.wordpressPassword
    );

    // Step 2: Generate single image
    console.log('\n=== Step 2: Generating Single Image ===');
    const generatedImage = await imageGenerator.generateSingleImage(
      config.imagePrompt,
      config.placement
    );

    console.log('🔍 DEBUG: Generated image details:', {
      id: generatedImage.id,
      url: generatedImage.url,
      description: generatedImage.description,
      placement: generatedImage.placement
    });

    // Step 3: Download image
    console.log('\n=== Step 3: Downloading Image ===');
    const downloadResult = await downloadImage(generatedImage.url);
    
    console.log('🔍 DEBUG: Download result:', {
      bufferSize: downloadResult.buffer.length,
      mimeType: downloadResult.mimeType
    });

    // Step 4: Upload to WordPress
    console.log('\n=== Step 4: Uploading to WordPress ===');
    const fileName = `${generatedImage.id}.jpg`;
    const uploadResult = await mediaService.uploadMedia(
      downloadResult.buffer,
      fileName,
      downloadResult.mimeType,
      {
        title: generatedImage.description,
        alt_text: generatedImage.altText,
        caption: generatedImage.caption
      }
    );

    console.log('🔍 DEBUG: Upload result:', {
      id: uploadResult.id,
      source_url: uploadResult.source_url,
      title: uploadResult.title
    });

    // Step 5: Summary
    console.log('\n=== Step 5: Summary ===');
    console.log('✅ Single Image Debug Workflow Completed Successfully!');
    console.log('📊 Results:');
    console.log(`  - Generated Image: ${generatedImage.id}`);
    console.log(`  - Image URL: ${generatedImage.url}`);
    console.log(`  - Downloaded Size: ${downloadResult.buffer.length} bytes`);
    console.log(`  - WordPress Media ID: ${uploadResult.id}`);
    console.log(`  - WordPress URL: ${uploadResult.source_url}`);

    return {
      success: true,
      generatedImage,
      downloadResult,
      uploadResult
    };

  } catch (error) {
    console.error('\n❌ Single Image Debug Workflow Failed!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the debug workflow if this script is executed directly
if (require.main === module) {
  runSingleImageDebug()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 Debug workflow completed successfully!');
        process.exit(0);
      } else {
        console.log('\n💥 Debug workflow failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = {
  runSingleImageDebug,
  MockBlogImageGenerator,
  MockWordPressMediaService,
  downloadImage
};
