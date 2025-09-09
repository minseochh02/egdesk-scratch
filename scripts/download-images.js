#!/usr/bin/env node
/**
 * Image Download Script
 * Downloads images from URLs without CORS restrictions using Node.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * Download an image from a URL and return base64 data
 * @param {string} url - Image URL to download
 * @param {string} imageId - Unique ID for the image
 * @returns {Promise<{success: boolean, imageId: string, data?: string, mimeType?: string, error?: string}>}
 */
async function downloadImage(url, imageId) {
  return new Promise((resolve) => {
    console.log(`🔍 DEBUG: Starting download for ${imageId}`);
    console.log(`🔍 DEBUG: URL: ${url}`);

    const protocol = url.startsWith('https:') ? https : http;
    
    const request = protocol.get(url, (response) => {
      console.log(`🔍 DEBUG: Response status: ${response.statusCode}`);
      console.log(`🔍 DEBUG: Response headers:`, response.headers);

      if (response.statusCode !== 200) {
        resolve({
          success: false,
          imageId: imageId,
          error: `HTTP ${response.statusCode}: ${response.statusMessage}`
        });
        return;
      }

      const chunks = [];
      let totalLength = 0;

      response.on('data', (chunk) => {
        chunks.push(chunk);
        totalLength += chunk.length;
        console.log(`🔍 DEBUG: Downloaded ${totalLength} bytes so far for ${imageId}`);
      });

      response.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const base64Data = buffer.toString('base64');
          const mimeType = response.headers['content-type'] || 'image/jpeg';
          
          console.log(`✅ DEBUG: Successfully downloaded ${imageId}:`);
          console.log(`  - Size: ${buffer.length} bytes`);
          console.log(`  - MIME Type: ${mimeType}`);
          console.log(`  - Base64 length: ${base64Data.length}`);

          resolve({
            success: true,
            imageId: imageId,
            data: base64Data,
            mimeType: mimeType,
            size: buffer.length
          });
        } catch (error) {
          console.error(`❌ DEBUG: Error processing downloaded data for ${imageId}:`, error);
          resolve({
            success: false,
            imageId: imageId,
            error: `Processing error: ${error.message}`
          });
        }
      });

      response.on('error', (error) => {
        console.error(`❌ DEBUG: Download error for ${imageId}:`, error);
        resolve({
          success: false,
          imageId: imageId,
          error: `Download error: ${error.message}`
        });
      });
    });

    request.on('error', (error) => {
      console.error(`❌ DEBUG: Request error for ${imageId}:`, error);
      resolve({
        success: false,
        imageId: imageId,
        error: `Request error: ${error.message}`
      });
    });

    request.setTimeout(30000, () => {
      console.error(`❌ DEBUG: Timeout downloading ${imageId}`);
      request.destroy();
      resolve({
        success: false,
        imageId: imageId,
        error: 'Download timeout (30s)'
      });
    });
  });
}

/**
 * Download multiple images from a list of image objects
 * @param {Array} images - Array of image objects with {id, url} properties
 * @returns {Promise<{success: boolean, results: Array, summary: Object}>}
 */
async function downloadImages(images) {
  console.log(`🚀 Starting bulk image download for ${images.length} images`);
  
  const results = [];
  const summary = {
    total: images.length,
    successful: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    console.log(`\n=== Downloading image ${i + 1}/${images.length} ===`);
    
    try {
      const result = await downloadImage(image.url, image.id);
      results.push(result);
      
      if (result.success) {
        summary.successful++;
        console.log(`✅ Successfully downloaded ${image.id}`);
      } else {
        summary.failed++;
        summary.errors.push(`${image.id}: ${result.error}`);
        console.log(`❌ Failed to download ${image.id}: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Unexpected error downloading ${image.id}:`, error);
      results.push({
        success: false,
        imageId: image.id,
        error: `Unexpected error: ${error.message}`
      });
      summary.failed++;
      summary.errors.push(`${image.id}: Unexpected error: ${error.message}`);
    }

    // Small delay between downloads to be respectful
    if (i < images.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n📊 Download Summary:`);
  console.log(`  - Total: ${summary.total}`);
  console.log(`  - Successful: ${summary.successful}`);
  console.log(`  - Failed: ${summary.failed}`);
  
  if (summary.errors.length > 0) {
    console.log(`  - Errors:`);
    summary.errors.forEach(error => console.log(`    * ${error}`));
  }

  return {
    success: summary.successful > 0,
    results: results,
    summary: summary
  };
}

// Handle command line execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node download-images.js <images-json>');
    console.log('');
    console.log('Where <images-json> is a JSON string containing an array of image objects:');
    console.log('[{"id": "img_123", "url": "https://example.com/image.jpg"}]');
    console.log('');
    console.log('Example:');
    console.log('node download-images.js \'[{"id":"test","url":"https://picsum.photos/200/300"}]\'');
    process.exit(1);
  }

  try {
    const imagesJson = args[0];
    const images = JSON.parse(imagesJson);
    
    if (!Array.isArray(images)) {
      throw new Error('Images must be an array');
    }

    console.log('🚀 Starting image download script');
    console.log(`📋 Images to download: ${images.length}`);
    
    downloadImages(images)
      .then(result => {
        console.log('\n🎉 Download script completed!');
        
        // Write results to a temporary file instead of stdout to avoid JSON parsing issues
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        
        const tempFile = path.join(os.tmpdir(), `download-results-${Date.now()}.json`);
        fs.writeFileSync(tempFile, JSON.stringify(result, null, 2));
        
        // Output the temp file path for the calling process
        console.log('\n--- DOWNLOAD_RESULTS_FILE ---');
        console.log(tempFile);
        console.log('--- DOWNLOAD_RESULTS_FILE_END ---');
        
        process.exit(result.success ? 0 : 1);
      })
      .catch(error => {
        console.error('\n💥 Download script failed:', error);
        process.exit(1);
      });
  } catch (error) {
    console.error('💥 Error parsing arguments:', error.message);
    console.log('Make sure to pass a valid JSON array of image objects.');
    process.exit(1);
  }
}

module.exports = {
  downloadImage,
  downloadImages
};
