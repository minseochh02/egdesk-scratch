#!/usr/bin/env node

/**
 * Test script to demonstrate retry logic with Gemini API
 * This script tests the retry functionality when the API is overloaded
 */

const { generateStructuredBlogContent } = require('./gemini-generate-blog');

async function testRetryLogic() {
  try {
    console.log('🧪 Testing retry logic with Gemini API...');
    console.log('📝 This will attempt to generate blog content with automatic retries');
    console.log('⚠️  If the API is overloaded, it will retry up to 3 times with exponential backoff\n');
    
    const topic = 'The Future of Artificial Intelligence in Healthcare';
    const result = await generateStructuredBlogContent(topic);
    
    console.log('\n🎉 Test completed successfully!');
    console.log(`📝 Generated title: ${result.title}`);
    console.log(`📄 Content length: ${result.content.length} characters`);
    console.log(`🖼️  Images requested: ${result.images.length}`);
    
  } catch (error) {
    console.error('\n❌ Test failed after all retries:', error.message);
    console.log('\n💡 This could mean:');
    console.log('   - The API is still overloaded after 3 retries');
    console.log('   - There\'s an issue with your API key');
    console.log('   - The API has a different error that\'s not retryable');
    console.log('\n🔄 Try running the script again in a few minutes.');
  }
}

// Run the test
if (require.main === module) {
  testRetryLogic();
}

module.exports = { testRetryLogic };
