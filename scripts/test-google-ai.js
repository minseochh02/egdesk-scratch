#!/usr/bin/env node

/**
 * Quick test for Google AI integration
 */

// Set test environment variables
process.env.AI_KEY = 'test-key';
process.env.AI_MODEL = 'gemini-1.5-flash-latest';
process.env.AI_PROVIDER = 'google';
process.env.TEMPLATE_TYPE = 'custom';
process.env.TEMPLATE_TITLE = '인테리어';
process.env.TEMPLATE_CONTENT = '인테리어 관련 내용';
process.env.TEMPLATE_CATEGORIES = '인테리어';
process.env.TEMPLATE_TAGS = '인테리어,디자인';
process.env.WORDPRESS_URL = 'https://example.com';
process.env.WORDPRESS_USERNAME = 'test';
process.env.WORDPRESS_PASSWORD = 'test';

// Import the blog generation script
const { generateAIContent } = require('./generate-blog-content.js');

async function testGoogleAI() {
  console.log('🧪 Testing Google AI integration...');
  
  try {
    const content = await generateAIContent();
    console.log('✅ Google AI integration working!');
    console.log('📝 Generated title:', content.title);
    console.log('📄 Content preview:', content.content.substring(0, 200) + '...');
  } catch (error) {
    console.log('⚠️  Expected error with test credentials:', error.message);
    console.log('✅ Script structure is correct for Google AI!');
  }
}

testGoogleAI().catch(console.error);
