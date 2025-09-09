#!/usr/bin/env node

/**
 * Simple Media Upload Test
 * Tests media upload with a minimal setup
 */

const https = require('https');
const { URL } = require('url');

// Test configuration - replace with your actual WordPress details
const WORDPRESS_URL = process.env.WORDPRESS_URL || 'https://your-site.wordpress.com';
const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME || 'your-username';
const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD || 'your-app-password';

/**
 * Create a simple test image (1x1 pixel PNG)
 */
function createTestImage() {
  // Minimal PNG file (1x1 pixel, transparent)
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );
}

/**
 * Upload a test image to WordPress
 */
async function uploadTestImage() {
  console.log('🚀 Starting simple media upload test...');
  console.log(`📤 Target: ${WORDPRESS_URL}`);
  console.log(`👤 User: ${WORDPRESS_USERNAME}`);
  
  const baseUrl = WORDPRESS_URL.replace(/\/$/, '');
  const endpoint = `${baseUrl}/wp-json/wp/v2/media`;
  
  // Create test image
  const imageBuffer = createTestImage();
  const filename = `test-image-${Date.now()}.png`;
  
  // Create multipart form data
  const boundary = `----formdata-${Date.now()}`;
  const formData = createMultipartFormData(imageBuffer, filename, 'image/png', boundary, {
    altText: 'Test image for WordPress media upload',
    caption: 'This is a test image',
    title: 'Test Image Upload'
  });
  
  const auth = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_PASSWORD}`).toString('base64');
  
  const options = {
    hostname: new URL(endpoint).hostname,
    port: new URL(endpoint).port || 443,
    path: new URL(endpoint).pathname,
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': formData.length
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`📊 Response Status: ${res.statusCode}`);
        
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ Upload successful!');
            console.log(`🆔 Media ID: ${parsed.id}`);
            console.log(`🔗 Media URL: ${parsed.source_url}`);
            console.log(`📁 File: ${parsed.media_details?.file || 'N/A'}`);
            resolve(parsed);
          } else {
            console.error('❌ Upload failed!');
            console.error(`Status: ${res.statusCode}`);
            console.error(`Error: ${parsed.message || responseData}`);
            reject(new Error(`Upload failed: ${res.statusCode}`));
          }
        } catch (error) {
          console.error('❌ Failed to parse response:', error.message);
          console.error('Raw response:', responseData);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });
    
    req.write(formData);
    req.end();
  });
}

/**
 * Create multipart form data
 */
function createMultipartFormData(fileBuffer, filename, mimeType, boundary, options) {
  const parts = [];
  
  // File part
  parts.push(`--${boundary}`);
  parts.push(`Content-Disposition: form-data; name="file"; filename="${filename}"`);
  parts.push(`Content-Type: ${mimeType}`);
  parts.push('');
  parts.push(fileBuffer);
  parts.push('');
  
  // Metadata parts
  if (options.altText) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Disposition: form-data; name="alt_text"`);
    parts.push('');
    parts.push(options.altText);
    parts.push('');
  }
  
  if (options.caption) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Disposition: form-data; name="caption"`);
    parts.push('');
    parts.push(options.caption);
    parts.push('');
  }
  
  if (options.title) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Disposition: form-data; name="title"`);
    parts.push('');
    parts.push(options.title);
    parts.push('');
  }
  
  // Close boundary
  parts.push(`--${boundary}--`);
  
  return Buffer.concat(parts.map(part => 
    typeof part === 'string' ? Buffer.from(part + '\r\n', 'utf8') : part
  ));
}

// Run the test
if (require.main === module) {
  uploadTestImage()
    .then(() => {
      console.log('🎉 Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { uploadTestImage };
