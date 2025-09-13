#!/usr/bin/env node
/**
 * Real Single Image Debug Script
 * This script uses the actual services to generate a single image, download it, and upload it to WordPress
 */

const fs = require('fs');
const path = require('path');

// Add the src directory to the module path so we can import our services
const srcPath = path.join(__dirname, '..', 'src');
require('module').globalPaths.push(srcPath);

async function runRealSingleImageDebug() {
  console.log('🚀 Starting Real Single Image Debug Workflow');
  console.log('============================================');

  try {
    // Configuration - Update these with your actual values
    const config = {
      wordpressUrl: 'http://m8chaa.mycafe24.com',
      wordpressUsername: 'admin',
      wordpressPassword: 'your-actual-password', // Replace with real password
      imagePrompt: 'A futuristic AI robot writing code on a computer screen, digital art style',
      placement: 'featured',
      // You'll need to provide a real API key for image generation
      openaiApiKey: 'your-openai-api-key' // Replace with real API key
    };

    console.log('🔍 DEBUG: Configuration:', {
      wordpressUrl: config.wordpressUrl,
      wordpressUsername: config.wordpressUsername,
      hasPassword: !!config.wordpressPassword,
      imagePrompt: config.imagePrompt,
      placement: config.placement,
      hasApiKey: !!config.openaiApiKey
    });

    // Step 1: Import and initialize services
    console.log('\n=== Step 1: Initializing Real Services ===');
    
    // Import the actual services
    const WordPressMediaService = require('../src/renderer/services/wordpressMediaService').default;
    const BlogImageGenerator = require('../src/renderer/services/blogImageGenerator').BlogImageGenerator;
    
    console.log('✅ Services imported successfully');

    // Initialize media service
    const mediaService = new WordPressMediaService(
      config.wordpressUrl,
      config.wordpressUsername,
      config.wordpressPassword
    );
    console.log('✅ WordPressMediaService initialized');

    // Initialize image generator
    const imageGenerator = new BlogImageGenerator(mediaService, {
      provider: 'dalle',
      quality: 'standard',
      size: '1024x1024',
      apiKey: config.openaiApiKey
    });
    console.log('✅ BlogImageGenerator initialized');

    // Step 2: Generate single image using the actual service
    console.log('\n=== Step 2: Generating Single Image with Real Service ===');
    
    const imageRequest = {
      title: 'Debug Test Image',
      content: `This is a test content with an image marker: [IMAGE:${config.imagePrompt}:${config.placement}]`,
      excerpt: 'A test image for debugging purposes',
      keywords: ['debug', 'test', 'image'],
      category: 'Debug',
      style: 'realistic',
      aspectRatio: 'landscape'
    };

    console.log('🔍 DEBUG: Image request:', {
      title: imageRequest.title,
      content: imageRequest.content,
      hasImageMarkers: imageRequest.content.includes('[IMAGE:'),
      style: imageRequest.style,
      aspectRatio: imageRequest.aspectRatio
    });

    console.log('🔍 DEBUG: Calling imageGenerator.generateBlogImages...');
    const generatedImages = await imageGenerator.generateBlogImages(imageRequest, {
      url: config.wordpressUrl,
      username: config.wordpressUsername,
      password: config.wordpressPassword
    });

    console.log('🔍 DEBUG: Image generation result:', {
      count: generatedImages.length,
      images: generatedImages.map(img => ({
        id: img.id,
        description: img.description,
        url: img.url,
        placement: img.placement
      }))
    });

    if (generatedImages.length === 0) {
      throw new Error('No images were generated! Check your API key and configuration.');
    }

    const image = generatedImages[0]; // Use the first generated image
    console.log('✅ Using first generated image:', image.id);

    // Step 3: Download the image
    console.log('\n=== Step 3: Downloading Image ===');
    console.log('🔍 DEBUG: Downloading from URL:', image.url);
    
    const response = await fetch(image.url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} - ${response.statusText}`);
    }
    
    const imageBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    
    console.log('✅ Image downloaded successfully:', {
      size: imageBuffer.byteLength,
      mimeType: mimeType
    });

    // Step 4: Upload to WordPress
    console.log('\n=== Step 4: Uploading to WordPress ===');
    const fileName = `${image.id}.${mimeType.split('/')[1]}`;
    
    console.log('🔍 DEBUG: Uploading to WordPress:', {
      fileName: fileName,
      mimeType: mimeType,
      bufferSize: imageBuffer.byteLength
    });

    const uploadResult = await mediaService.uploadMedia(
      Buffer.from(imageBuffer),
      fileName,
      mimeType,
      {
        title: image.description,
        alt_text: image.altText,
        caption: image.caption
      }
    );

    console.log('✅ Image uploaded to WordPress successfully:', {
      id: uploadResult.id,
      source_url: uploadResult.source_url,
      title: uploadResult.title
    });

    // Step 5: Summary
    console.log('\n=== Step 5: Summary ===');
    console.log('✅ Real Single Image Debug Workflow Completed Successfully!');
    console.log('📊 Results:');
    console.log(`  - Generated Image ID: ${image.id}`);
    console.log(`  - Image URL: ${image.url}`);
    console.log(`  - Downloaded Size: ${imageBuffer.byteLength} bytes`);
    console.log(`  - WordPress Media ID: ${uploadResult.id}`);
    console.log(`  - WordPress URL: ${uploadResult.source_url}`);
    console.log(`  - File Name: ${fileName}`);

    return {
      success: true,
      generatedImage: image,
      downloadResult: {
        buffer: imageBuffer,
        mimeType: mimeType
      },
      uploadResult: uploadResult
    };

  } catch (error) {
    console.error('\n❌ Real Single Image Debug Workflow Failed!');
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
  runRealSingleImageDebug()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 Real debug workflow completed successfully!');
        process.exit(0);
      } else {
        console.log('\n💥 Real debug workflow failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = {
  runRealSingleImageDebug
};
