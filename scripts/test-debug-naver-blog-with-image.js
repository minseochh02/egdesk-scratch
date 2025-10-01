#!/usr/bin/env node

/**
 * Test script for the new Naver Blog with AI-generated dog image debug functionality
 * 
 * This script demonstrates how to use the new debug functionality that:
 * 1. Automatically uses the "egdesk" API key from the AI Keys Manager
 * 2. Generates AI-created dog images using Gemini
 * 3. Automatically pastes them into Naver Blog posts
 * 
 * Usage:
 *   node scripts/test-debug-naver-blog-with-image.js
 * 
 * Prerequisites:
 * - Have a Google/Gemini API key configured with the name "egdesk" in AI Keys Manager
 * - Have your Naver credentials ready
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Mock the debug function for testing
async function testDebugNaverBlogWithImage() {
  console.log('🐕 Testing Naver Blog with AI-generated dog image debug functionality...\n');

  // Test parameters
  const testParams = {
    id: process.env.NAVER_USERNAME || 'your-naver-username',
    password: process.env.NAVER_PASSWORD || 'your-naver-password',
    proxy: process.env.PROXY_URL || null,
    title: 'AI-Generated Dog Image Test Post via Debug',
    content: 'This is a test post featuring an AI-generated dog image! The image was created using Gemini AI and automatically pasted into the blog editor via the debug functionality.',
    tags: '#egdesk #ai #dog #test #debug #automation',
    includeDogImage: true,
    dogImagePrompt: 'A cute golden retriever puppy playing in a sunny garden, high quality, photorealistic, professional photography style'
  };

  console.log('📝 Test Parameters:');
  console.log(`   ID: ${testParams.id}`);
  console.log(`   Title: ${testParams.title}`);
  console.log(`   Content: ${testParams.content}`);
  console.log(`   Tags: ${testParams.tags}`);
  console.log(`   Include Dog Image: ${testParams.includeDogImage}`);
  console.log(`   Dog Image Prompt: ${testParams.dogImagePrompt}`);
  console.log('');

  try {
    console.log('🚀 Testing debug function call...');
    
    // Simulate the debug function call
    const { runNaverBlogWithImage } = require('../src/main/naver-blog-with-image');
    
    // Mock getting the "egdesk" API key
    const { getStore } = require('../src/main/storage');
    const store = getStore();
    const aiKeys = store.get('ai-keys', []);
    const egdeskKey = aiKeys.find((key) => key.name === 'egdesk' && key.providerId === 'google' && key.fields?.apiKey);
    
    if (!egdeskKey) {
      console.error('❌ No "egdesk" API key found in store');
      console.log('Available keys:', aiKeys.map(k => ({ name: k.name, providerId: k.providerId })));
      console.log('\nPlease configure a Google/Gemini API key with the name "egdesk" in the AI Keys Manager.');
      return;
    }

    console.log(`✅ Found "egdesk" API key: ${egdeskKey.name} (${egdeskKey.providerId})`);
    
    // Set the API key as environment variable
    process.env.GEMINI_API_KEY = egdeskKey.fields.apiKey;
    console.log('🔑 API key set as environment variable');

    // Call the automation function
    const result = await runNaverBlogWithImage(
      testParams.id,
      testParams.password,
      testParams.proxy,
      testParams.title,
      testParams.content,
      testParams.tags,
      testParams.includeDogImage,
      testParams.dogImagePrompt
    );

    if (result.success) {
      console.log('✅ Debug automation completed successfully!');
      console.log(`   Image Generated: ${result.imageGenerated ? 'Yes' : 'No'}`);
      if (result.fallback) {
        console.log('   Note: Used fallback Chromium (Chrome not found)');
      }
    } else {
      console.log('❌ Debug automation failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
if (require.main === module) {
  testDebugNaverBlogWithImage().catch(console.error);
}

module.exports = { testDebugNaverBlogWithImage };
