#!/usr/bin/env node

/**
 * Test Complete Blog Workflow Script
 * Tests the complete blog generation workflow including AI content generation and media upload
 */

const { spawn } = require('child_process');
const path = require('path');

// Configuration from environment variables
const WORDPRESS_URL = process.env.WORDPRESS_URL;
const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;
const AI_KEY = process.env.AI_KEY;
const AI_MODEL = process.env.AI_MODEL;
const AI_PROVIDER = process.env.AI_PROVIDER;

/**
 * Test the complete blog generation workflow
 */
async function testCompleteWorkflow() {
  try {
    console.log('🚀 Starting complete blog workflow test...');
    
    // Validate required environment variables
    const requiredVars = [
      { name: 'WORDPRESS_URL', value: WORDPRESS_URL },
      { name: 'WORDPRESS_USERNAME', value: WORDPRESS_USERNAME },
      { name: 'WORDPRESS_PASSWORD', value: WORDPRESS_PASSWORD },
      { name: 'AI_KEY', value: AI_KEY },
      { name: 'AI_MODEL', value: AI_MODEL },
      { name: 'AI_PROVIDER', value: AI_PROVIDER }
    ];

    console.log('🔍 Environment variables:');
    for (const { name, value } of requiredVars) {
      if (!value) {
        throw new Error(`${name} environment variable is required`);
      }
      console.log(`${name}: ${name.includes('PASSWORD') || name.includes('KEY') ? '***' : value}`);
    }
    
    // Test 1: Media upload only
    console.log('\n📤 Test 1: Testing media upload functionality...');
    await testMediaUpload();
    
    // Test 2: Complete blog generation with images
    console.log('\n🤖 Test 2: Testing complete blog generation with images...');
    await testBlogGeneration();
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('📚 Stack trace:', error.stack);
    process.exit(1);
  }
}

/**
 * Test media upload functionality
 */
async function testMediaUpload() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'test-media-upload.js');
    
    const child = spawn('node', [scriptPath], {
      env: {
        ...process.env,
        WORDPRESS_URL,
        WORDPRESS_USERNAME,
        WORDPRESS_PASSWORD
      },
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Media upload test passed');
        resolve();
      } else {
        reject(new Error(`Media upload test failed with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(new Error(`Failed to run media upload test: ${error.message}`));
    });
  });
}

/**
 * Test complete blog generation workflow
 */
async function testBlogGeneration() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'generate-blog-content.js');
    
    const child = spawn('node', [scriptPath], {
      env: {
        ...process.env,
        AI_KEY,
        AI_MODEL,
        AI_PROVIDER,
        TEMPLATE_TYPE: 'bw_how_to',
        TEMPLATE_TITLE: 'WordPress 미디어 업로드 테스트 가이드',
        TEMPLATE_CONTENT: 'WordPress REST API를 사용한 미디어 업로드 방법에 대한 실용적인 가이드입니다.',
        TEMPLATE_CATEGORIES: '기술,가이드',
        TEMPLATE_TAGS: 'wordpress,api,미디어,업로드',
        WORDPRESS_URL,
        WORDPRESS_USERNAME,
        WORDPRESS_PASSWORD
      },
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Blog generation test passed');
        resolve();
      } else {
        reject(new Error(`Blog generation test failed with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(new Error(`Failed to run blog generation test: ${error.message}`));
    });
  });
}

/**
 * Display usage instructions
 */
function displayUsage() {
  console.log(`
📖 Complete Blog Workflow Test

This script tests the complete blog generation workflow including:
1. Media upload functionality
2. AI content generation with image suggestions
3. WordPress post creation with featured images

Required Environment Variables:
- WORDPRESS_URL: Your WordPress site URL
- WORDPRESS_USERNAME: WordPress username
- WORDPRESS_PASSWORD: WordPress application password
- AI_KEY: Your AI provider API key
- AI_MODEL: AI model to use (e.g., gpt-3.5-turbo)
- AI_PROVIDER: AI provider (openai, anthropic, google)

Usage:
  WORDPRESS_URL="https://yoursite.com" \\
  WORDPRESS_USERNAME="your_username" \\
  WORDPRESS_PASSWORD="your_app_password" \\
  AI_KEY="your_api_key" \\
  AI_MODEL="gpt-3.5-turbo" \\
  AI_PROVIDER="openai" \\
  node test-complete-blog-workflow.js

Example:
  WORDPRESS_URL="https://mysite.wordpress.com" \\
  WORDPRESS_USERNAME="myuser" \\
  WORDPRESS_PASSWORD="abcd efgh ijkl mnop qrst uvwx" \\
  AI_KEY="sk-..." \\
  AI_MODEL="gpt-3.5-turbo" \\
  AI_PROVIDER="openai" \\
  node test-complete-blog-workflow.js
`);
}

// Run the test
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    displayUsage();
  } else {
    testCompleteWorkflow();
  }
}

module.exports = { testCompleteWorkflow, testMediaUpload, testBlogGeneration };
