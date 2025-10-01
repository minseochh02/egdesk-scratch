#!/usr/bin/env node

/**
 * Test script for Naver Blog automation with AI-generated dog image
 * 
 * Usage:
 *   node scripts/test-naver-blog-with-image.js
 * 
 * Make sure to set GEMINI_API_KEY environment variable before running
 */

const { runNaverBlogWithImage } = require('../src/main/naver-blog-with-image');

async function testNaverBlogWithImage() {
  console.log('🐕 Testing Naver Blog automation with AI-generated dog image...\n');

  // Check if GEMINI_API_KEY is set
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY environment variable is required');
    console.log('Please set it with: export GEMINI_API_KEY="your-api-key"');
    process.exit(1);
  }

  // Test parameters
  const testParams = {
    username: process.env.NAVER_USERNAME || 'your-naver-username',
    password: process.env.NAVER_PASSWORD || 'your-naver-password',
    proxyUrl: process.env.PROXY_URL || null,
    title: 'AI-Generated Dog Image Test Post',
    content: 'This is a test post featuring an AI-generated dog image! The image was created using Gemini AI and automatically pasted into the blog editor.',
    tags: '#egdesk #ai #dog #test #automation',
    includeDogImage: true,
    dogImagePrompt: 'A cute golden retriever puppy playing in a sunny garden, high quality, photorealistic, professional photography style'
  };

  console.log('📝 Test Parameters:');
  console.log(`   Title: ${testParams.title}`);
  console.log(`   Content: ${testParams.content}`);
  console.log(`   Tags: ${testParams.tags}`);
  console.log(`   Include Dog Image: ${testParams.includeDogImage}`);
  console.log(`   Dog Image Prompt: ${testParams.dogImagePrompt}`);
  console.log('');

  try {
    console.log('🚀 Starting automation...');
    const result = await runNaverBlogWithImage(
      testParams.username,
      testParams.password,
      testParams.proxyUrl,
      testParams.title,
      testParams.content,
      testParams.tags,
      testParams.includeDogImage,
      testParams.dogImagePrompt
    );

    if (result.success) {
      console.log('✅ Automation completed successfully!');
      console.log(`   Image Generated: ${result.imageGenerated ? 'Yes' : 'No'}`);
      if (result.fallback) {
        console.log('   Note: Used fallback Chromium (Chrome not found)');
      }
    } else {
      console.log('❌ Automation failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testNaverBlogWithImage().catch(console.error);
}

module.exports = { testNaverBlogWithImage };
