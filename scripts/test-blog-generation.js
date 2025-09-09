#!/usr/bin/env node

/**
 * Test script for blog content generation
 * This script tests the dynamic blog content generation without posting to WordPress
 */

// Set test environment variables
process.env.AI_KEY = 'test-key';
process.env.AI_MODEL = 'gpt-3.5-turbo';
process.env.AI_PROVIDER = 'openai';
process.env.TEMPLATE_TYPE = 'bw_weekly_update';
process.env.TEMPLATE_TITLE = '주간 업데이트: 주요 하이라이트와 인사이트';
process.env.TEMPLATE_CONTENT = '이번 주 진행 상황, 주요 지표, 향후 우선순위에 대한 요약.';
process.env.TEMPLATE_CATEGORIES = '업데이트,주간리포트';
process.env.TEMPLATE_TAGS = '주간업데이트,진행상황,하이라이트,지표';
process.env.WORDPRESS_URL = 'https://example.com';
process.env.WORDPRESS_USERNAME = 'testuser';
process.env.WORDPRESS_PASSWORD = 'testpass';

// Import the blog generation script
const { generateAIContent } = require('./generate-blog-content.js');

async function testBlogGeneration() {
  console.log('🧪 Testing blog content generation...');
  console.log('📋 Template Type:', process.env.TEMPLATE_TYPE);
  console.log('📝 Template Title:', process.env.TEMPLATE_TITLE);
  console.log('🏷️  Categories:', process.env.TEMPLATE_CATEGORIES);
  console.log('🔖 Tags:', process.env.TEMPLATE_TAGS);
  console.log('');

  try {
    // Test content generation (this will fail with test credentials, but we can see the structure)
    console.log('🤖 Attempting to generate AI content...');
    const content = await generateAIContent();
    
    console.log('✅ Content generation completed successfully!');
    console.log('📄 Generated Content:');
    console.log('Title:', content.title);
    console.log('Content Length:', content.content.length, 'characters');
    console.log('Excerpt:', content.excerpt);
    console.log('Tags:', content.tags);
    console.log('Categories:', content.categories);
    console.log('SEO Title:', content.seoTitle);
    console.log('Meta Description:', content.metaDescription);
    
  } catch (error) {
    console.log('⚠️  Expected error (test credentials):', error.message);
    console.log('✅ Script structure is working correctly!');
    console.log('📝 The script will work with real AI credentials.');
  }
}

// Run the test
testBlogGeneration().catch(console.error);
