#!/usr/bin/env node

/**
 * WordPress Uploader Script
 * This script uploads images to WordPress and creates blog posts with the uploaded images
 * To run this code you need to install the following dependencies:
 * npm install @google/genai mime-types
 */

const https = require('https');
const { URL } = require('url');
const mime = require('mime-types');

/**
 * Upload media to WordPress using multipart/form-data
 */
async function uploadMediaToWordPress(fileBuffer, filename, mimeType, options = {}) {
  const WORDPRESS_URL = process.env.WORDPRESS_URL;
  const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
  const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;

  if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_PASSWORD) {
    throw new Error('Missing WordPress configuration: WORDPRESS_URL, WORDPRESS_USERNAME, or WORDPRESS_PASSWORD not set');
  }

  console.log(`📤 Uploading media to WordPress: ${filename}`);

  const baseUrl = WORDPRESS_URL.replace(/\/$/, '');
  const endpoint = `${baseUrl}/wp-json/wp/v2/media`;

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
            console.log(`✅ Successfully uploaded media: ${filename}`);
            console.log(`🆔 Media ID: ${parsed.id}`);
            console.log(`🔗 Media URL: ${parsed.source_url}`);
            resolve(parsed);
          } else {
            console.error(`❌ WordPress Media API Error: ${res.statusCode}`);
            console.error(`📄 Response:`, parsed);
            reject(new Error(`WordPress Media API request failed: ${res.statusCode} - ${parsed.message || responseData}`));
          }
        } catch (error) {
          console.error(`❌ Failed to parse WordPress response:`, error.message);
          console.error(`📄 Raw response:`, responseData);
          
          // Handle 403 Forbidden and other HTML error responses
          if (responseData.includes('<html>') || responseData.includes('403 Forbidden')) {
            reject(new Error(`WordPress upload forbidden (403) - check file permissions or upload limits. Raw response: ${responseData.substring(0, 200)}...`));
          } else {
            reject(new Error(`Failed to parse WordPress response: ${error.message}`));
          }
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
 * Upload images to WordPress and return media IDs
 */
async function uploadImagesToWordPress(images) {
  const uploadedImages = [];
  
  console.log(`🖼️  Starting upload of ${images.length} image(s) to WordPress...`);
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    try {
      console.log(`📤 Uploading image ${i + 1}/${images.length}: ${image.description || image.fileName}`);
      
      // Convert base64 data to buffer if needed
      let fileBuffer;
      if (image.buffer) {
        fileBuffer = image.buffer;
      } else if (image.data) {
        fileBuffer = Buffer.from(image.data, 'base64');
      } else {
        throw new Error('No image data available');
      }
      
      const filename = image.fileName || `image-${Date.now()}-${i + 1}.${mime.extension(image.mimeType || 'image/png')}`;
      const mimeType = image.mimeType || 'image/png';
      
      const uploadOptions = {
        altText: image.altText || image.description || '',
        caption: image.caption || '',
        description: image.description || '',
        title: image.title || `${image.description || 'Generated Image'} ${i + 1}`
      };
      
      const uploadedMedia = await uploadMediaToWordPress(
        fileBuffer,
        filename,
        mimeType,
        uploadOptions
      );
      
      uploadedImages.push({
        ...image,
        mediaId: uploadedMedia.id,
        wordpressUrl: uploadedMedia.source_url,
        uploaded: true
      });
      
      console.log(`✅ Image ${i + 1} uploaded successfully (Media ID: ${uploadedMedia.id})`);
      
    } catch (error) {
      console.error(`❌ Failed to upload image ${i + 1}:`, error.message);
      uploadedImages.push({
        ...image,
        uploaded: false,
        error: error.message
      });
    }
  }
  
  const successCount = uploadedImages.filter(img => img.uploaded).length;
  console.log(`🎉 Image upload completed: ${successCount}/${images.length} successful`);
  
  return uploadedImages;
}

/**
 * Replace image markers in content with WordPress image shortcodes
 */
function replaceImageMarkers(content, uploadedImages) {
  let updatedContent = content;
  let imageIndex = 0;
  
  console.log(`🔄 Replacing image markers in content...`);
  console.log(`📊 Available uploaded images: ${uploadedImages.length}`);
  console.log(`📊 Uploaded images details:`, uploadedImages.map(img => ({
    description: img.description,
    altText: img.altText,
    uploaded: img.uploaded,
    mediaId: img.mediaId
  })));
  
  // Replace [IMAGE:description:placement] markers with WordPress image shortcodes
  const imageMarkerRegex = /\[IMAGE:([^:]+):([^\]]+)\]/g;
  
  // First, let's find all the markers in the content
  const allMarkers = content.match(imageMarkerRegex);
  console.log(`🔍 Found ${allMarkers ? allMarkers.length : 0} image markers in content:`, allMarkers);
  
  // Keep track of which uploaded images we've used
  const usedImages = new Set();
  
  updatedContent = updatedContent.replace(imageMarkerRegex, (match, description, placement) => {
    console.log(`🔍 Looking for image with description: "${description.trim()}"`);
    
    // Try multiple matching strategies
    let uploadedImage = uploadedImages.find(img => 
      img.description === description.trim() && img.uploaded && !usedImages.has(img.mediaId)
    );
    
    // If exact match fails, try partial match
    if (!uploadedImage) {
      uploadedImage = uploadedImages.find(img => 
        img.description && img.description.includes(description.trim()) && img.uploaded && !usedImages.has(img.mediaId)
      );
    }
    
    // If still no match, try altText match
    if (!uploadedImage) {
      uploadedImage = uploadedImages.find(img => 
        img.altText === description.trim() && img.uploaded && !usedImages.has(img.mediaId)
      );
    }
    
    // If still no match, try partial altText match
    if (!uploadedImage) {
      uploadedImage = uploadedImages.find(img => 
        img.altText && img.altText.includes(description.trim()) && img.uploaded && !usedImages.has(img.mediaId)
      );
    }
    
    // If still no match, use the next available uploaded image by order
    if (!uploadedImage) {
      uploadedImage = uploadedImages.find(img => img.uploaded && !usedImages.has(img.mediaId));
      if (uploadedImage) {
        console.log(`⚠️  No exact match found, using next available image: ${uploadedImage.description || 'Unknown'}`);
      }
    }
    
    if (uploadedImage) {
      imageIndex++;
      usedImages.add(uploadedImage.mediaId);
      console.log(`✅ Found matching image: ${uploadedImage.description || uploadedImage.altText} (Media ID: ${uploadedImage.mediaId})`);
      
      // Use WordPress image shortcode with media ID
      return `[caption id="attachment_${uploadedImage.mediaId}" align="aligncenter" width="800"]<img class="wp-image-${uploadedImage.mediaId}" src="${uploadedImage.wordpressUrl}" alt="${uploadedImage.altText || description.trim()}" width="800" height="auto" /> ${uploadedImage.caption || ''}[/caption]`;
    } else {
      console.log(`❌ No matching uploaded image found for: "${description.trim()}" - removing from content`);
      // Remove the image marker completely if upload failed
      return '';
    }
  });
  
  console.log(`🎉 Image marker replacement completed. ${imageIndex} images replaced.`);
  return updatedContent;
}

/**
 * Create a blog post in WordPress
 */
async function createWordPressPost(postData, uploadedImages = []) {
  const WORDPRESS_URL = process.env.WORDPRESS_URL;
  const WORDPRESS_USERNAME = process.env.WORDPRESS_USERNAME;
  const WORDPRESS_PASSWORD = process.env.WORDPRESS_PASSWORD;

  if (!WORDPRESS_URL || !WORDPRESS_USERNAME || !WORDPRESS_PASSWORD) {
    throw new Error('Missing WordPress configuration');
  }

  console.log(`📝 Creating WordPress post: ${postData.title}`);

  const baseUrl = WORDPRESS_URL.replace(/\/$/, '');
  const endpoint = `${baseUrl}/wp-json/wp/v2/posts`;

  // Find featured image (first image with placement 'featured' or first image)
  const featuredImage = uploadedImages.find(img => img.placement === 'featured') || uploadedImages[0];
  const featuredMediaId = featuredImage?.mediaId;

  // Replace image markers in content
  let updatedContent = postData.content;
  if (uploadedImages.length > 0) {
    console.log(`🔄 Replacing image markers in content...`);
    updatedContent = replaceImageMarkers(postData.content, uploadedImages);
  }

  // Add timestamp and unique identifier to ensure each post is unique
  const now = new Date();
  const timestamp = now.toISOString();
  const uniqueId = `${now.getTime()}-${Math.random().toString(36).substr(2, 9)}`;

  const payload = {
    title: postData.title,
    content: updatedContent,
    status: 'publish',
    excerpt: postData.excerpt || '',
    ...(featuredMediaId && { featured_media: featuredMediaId }),
    // Note: categories and tags require integer IDs from WordPress API
    // categories: postData.categories,
    // tags: postData.tags
  };

  const auth = Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_PASSWORD}`).toString('base64');
  
  const postDataJson = JSON.stringify(payload);

  const options = {
    hostname: new URL(endpoint).hostname,
    port: new URL(endpoint).port || 443,
    path: new URL(endpoint).pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'Content-Length': Buffer.byteLength(postDataJson)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log(`📊 WordPress Post API Response: ${res.statusCode}`);
        
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ Successfully created WordPress post`);
            console.log(`🔗 Post ID: ${parsed.id}`);
            console.log(`🔗 Post URL: ${parsed.link}`);
            if (featuredMediaId) {
              console.log(`🖼️  Featured image ID: ${featuredMediaId}`);
            }
            resolve(parsed);
          } else {
            console.error(`❌ WordPress Post API Error: ${res.statusCode}`);
            console.error(`📄 Response:`, parsed);
            reject(new Error(`WordPress Post API request failed: ${res.statusCode} - ${parsed.message || responseData}`));
          }
        } catch (error) {
          console.error(`❌ Failed to parse WordPress response:`, error.message);
          console.error(`📄 Raw response:`, responseData);
          reject(new Error(`Failed to parse WordPress response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ WordPress Post API request error:`, error.message);
      reject(new Error(`WordPress Post API request error: ${error.message}`));
    });

    req.write(postDataJson);
    req.end();
  });
}

/**
 * Main function to process blog content and upload to WordPress
 */
async function processBlogContent(blogContent) {
  try {
    console.log('🚀 Starting WordPress blog processing...');
    console.log(`📝 Title: ${blogContent.title}`);
    console.log(`📄 Content length: ${blogContent.content.length} characters`);
    console.log(`🖼️  Images to process: ${blogContent.generatedImages ? blogContent.generatedImages.length : 0}`);

    let uploadedImages = [];
    
    // Upload images if any were generated
    if (blogContent.generatedImages && blogContent.generatedImages.length > 0) {
      console.log('📤 Uploading generated images to WordPress...');
      console.log('🔍 Generated images details:', blogContent.generatedImages.map(img => ({
        description: img.description,
        altText: img.altText,
        placement: img.placement,
        hasData: !!img.data,
        hasBuffer: !!img.buffer
      })));
      uploadedImages = await uploadImagesToWordPress(blogContent.generatedImages);
    }

    // Create the blog post
    console.log('📝 Creating WordPress blog post...');
    const postResult = await createWordPressPost(blogContent, uploadedImages);
    
    console.log('🎉 Blog processing completed successfully!');
    console.log(`🔗 Post URL: ${postResult.link}`);
    
    return {
      success: true,
      post: postResult,
      uploadedImages: uploadedImages
    };

  } catch (error) {
    console.error('❌ Blog processing failed:', error.message);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Check for required environment variables
    const requiredVars = [
      'GEMINI_API_KEY',
      'WORDPRESS_URL',
      'WORDPRESS_USERNAME',
      'WORDPRESS_PASSWORD'
    ];

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        throw new Error(`${varName} environment variable is required`);
      }
    }

    // Get blog content from command line argument or use default
    const contentPath = process.argv[2];
    if (!contentPath) {
      throw new Error('Please provide path to blog content JSON file');
    }

    // Read blog content from file
    const fs = require('fs');
    const blogContent = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    
    console.log('📖 Loaded blog content from:', contentPath);
    
    // Process the blog content
    const result = await processBlogContent(blogContent);
    
    console.log('✅ WordPress upload completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = { 
  uploadImagesToWordPress, 
  createWordPressPost, 
  processBlogContent,
  replaceImageMarkers 
};