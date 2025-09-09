#!/usr/bin/env node

/**
 * Test WordPress Media Upload Script
 * Tests the media upload functionality with a sample image
 */

const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// Configuration from environment variables
const WORDPRESS_URL = process.env.WORDPRESS_URL;
const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;

/**
 * Upload media to WordPress using multipart/form-data
 */
async function uploadMediaToWordPress(filePath, options = {}) {
  if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_PASSWORD) {
    throw new Error('Missing WordPress configuration');
  }

  console.log(`📤 Uploading media to WordPress: ${WORDPRESS_URL}`);

  const baseUrl = WORDPRESS_URL.replace(/\/$/, '');
  const endpoint = `${baseUrl}/wp-json/wp/v2/media`;

  // Read the file
  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);
  const mimeType = getMimeType(filename);

  // Create multipart form data
  const boundary = `----formdata-${Date.now()}`;
  const formData = createMultipartFormData(fileBuffer, filename, mimeType, boundary, options);

  const auth = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_PASSWORD}`).toString('base64');

  const requestOptions = {
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
    const req = https.request(requestOptions, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log(`📊 WordPress Media API Response: ${res.statusCode}`);
        
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ Successfully uploaded media to WordPress`);
            console.log(`🆔 Media ID: ${parsed.id}`);
            console.log(`🔗 Media URL: ${parsed.source_url}`);
            console.log(`📁 File: ${parsed.media_details?.file || 'N/A'}`);
            console.log(`📏 Dimensions: ${parsed.media_details?.width || 'N/A'}x${parsed.media_details?.height || 'N/A'}`);
            resolve(parsed);
          } else {
            console.error(`❌ WordPress Media API Error: ${res.statusCode}`);
            console.error(`📄 Response:`, parsed);
            reject(new Error(`WordPress Media API request failed: ${res.statusCode} - ${parsed.message || responseData}`));
          }
        } catch (error) {
          console.error(`❌ Failed to parse WordPress response:`, error.message);
          console.error(`📄 Raw response:`, responseData);
          reject(new Error(`Failed to parse WordPress response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ WordPress Media API request error:`, error.message);
      reject(new Error(`WordPress Media API request error: ${error.message}`));
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

  // Add file part
  parts.push(`--${boundary}`);
  parts.push(`Content-Disposition: form-data; name="file"; filename="${filename}"`);
  parts.push(`Content-Type: ${mimeType}`);
  parts.push('');
  parts.push(fileBuffer);
  parts.push('');

  // Add optional metadata
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

  if (options.description) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Disposition: form-data; name="description"`);
    parts.push('');
    parts.push(options.description);
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

/**
 * Get MIME type based on file extension
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Create a test image using a simple method
 */
function createTestImage() {
  // Create a simple 1x1 pixel PNG image
  // This is a minimal PNG file in base64
  const pngData = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );
  
  const testImagePath = path.join(__dirname, 'test-image.png');
  fs.writeFileSync(testImagePath, pngData);
  return testImagePath;
}

/**
 * Test media upload with a sample image
 */
async function testMediaUpload() {
  try {
    console.log('🚀 Starting WordPress media upload test...');
    
    // Debug: Log environment variables
    console.log('🔍 Environment variables:');
    console.log('WORDPRESS_URL:', WORDPRESS_URL);
    console.log('WORDPRESS_USERNAME:', WORDPRESS_USERNAME);
    console.log('WORDPRESS_PASSWORD present:', !!WORDPRESS_PASSWORD);
    
    // Validate required environment variables
    const requiredVars = [
      { name: 'WORDPRESS_URL', value: WORDPRESS_URL },
      { name: 'WORDPRESS_USERNAME', value: WORDPRESS_USERNAME },
      { name: 'WORDPRESS_PASSWORD', value: WORDPRESS_PASSWORD }
    ];

    for (const { name, value } of requiredVars) {
      if (!value) {
        throw new Error(`${name} environment variable is required`);
      }
    }
    
    // Create a test image
    console.log('🖼️  Creating test image...');
    const testImagePath = createTestImage();
    console.log(`✅ Test image created: ${testImagePath}`);
    
    // Upload the test image
    console.log('📤 Uploading test image to WordPress...');
    const uploadOptions = {
      altText: 'Test image for WordPress media upload',
      caption: 'This is a test image uploaded via the WordPress REST API',
      description: 'Test image created to verify media upload functionality',
      title: 'Test Image Upload'
    };
    
    const result = await uploadMediaToWordPress(testImagePath, uploadOptions);
    console.log('🎉 Media upload test completed successfully!');
    
    // Clean up test file
    try {
      fs.unlinkSync(testImagePath);
      console.log('🧹 Test image file cleaned up');
    } catch (error) {
      console.warn('⚠️  Failed to clean up test file:', error.message);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('📚 Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testMediaUpload();
}

module.exports = { uploadMediaToWordPress, testMediaUpload };
