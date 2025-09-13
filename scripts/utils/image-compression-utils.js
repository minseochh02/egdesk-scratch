#!/usr/bin/env node

/**
 * Image Compression Utilities
 * This module provides functions to check file sizes and compress images
 * to meet WordPress upload limits (100MB max file size)
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// WordPress upload limits
const WORDPRESS_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
const RECOMMENDED_MAX_SIZE = 10 * 1024 * 1024; // 10MB recommended for better performance
const OPTIMAL_MAX_SIZE = 5 * 1024 * 1024; // 5MB optimal for content images

// Image quality settings
const COMPRESSION_QUALITY = {
  jpeg: 85,
  webp: 85,
  png: 90
};

// Maximum dimensions for different use cases
const MAX_DIMENSIONS = {
  featured: { width: 1920, height: 1080 },
  content: { width: 1200, height: 800 },
  thumbnail: { width: 300, height: 300 }
};

/**
 * Check if file size exceeds WordPress limits
 * @param {Buffer} fileBuffer - The file buffer to check
 * @returns {Object} - { exceeds: boolean, size: number, maxSize: number, needsCompression: boolean }
 */
function checkFileSize(fileBuffer) {
  const size = fileBuffer.length;
  const exceeds = size > WORDPRESS_MAX_FILE_SIZE;
  const needsCompression = size > RECOMMENDED_MAX_SIZE;
  const needsOptimization = size > OPTIMAL_MAX_SIZE;
  
  return {
    exceeds,
    size,
    maxSize: WORDPRESS_MAX_FILE_SIZE,
    needsCompression,
    needsOptimization,
    sizeMB: (size / (1024 * 1024)).toFixed(2),
    maxSizeMB: (WORDPRESS_MAX_FILE_SIZE / (1024 * 1024)).toFixed(0),
    optimalSizeMB: (OPTIMAL_MAX_SIZE / (1024 * 1024)).toFixed(0)
  };
}

/**
 * Get image metadata using Sharp
 * @param {Buffer} imageBuffer - The image buffer
 * @returns {Promise<Object>} - Image metadata
 */
async function getImageMetadata(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      channels: metadata.channels,
      space: metadata.space
    };
  } catch (error) {
    console.error('❌ Error getting image metadata:', error.message);
    throw new Error(`Failed to get image metadata: ${error.message}`);
  }
}

/**
 * Calculate optimal dimensions while maintaining aspect ratio
 * @param {number} originalWidth - Original image width
 * @param {number} originalHeight - Original image height
 * @param {Object} maxDimensions - Maximum allowed dimensions
 * @returns {Object} - { width: number, height: number }
 */
function calculateOptimalDimensions(originalWidth, originalHeight, maxDimensions) {
  const { width: maxWidth, height: maxHeight } = maxDimensions;
  
  // If image is already within limits, return original dimensions
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight };
  }
  
  // Calculate scale factor to fit within max dimensions
  const scaleX = maxWidth / originalWidth;
  const scaleY = maxHeight / originalHeight;
  const scale = Math.min(scaleX, scaleY);
  
  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale)
  };
}

/**
 * Compress image using Sharp
 * @param {Buffer} imageBuffer - The image buffer to compress
 * @param {Object} options - Compression options
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
async function compressImage(imageBuffer, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 85,
    format = 'jpeg',
    progressive = true
  } = options;

  try {
    console.log(`🔄 Compressing image...`);
    
    // Get original metadata
    const metadata = await getImageMetadata(imageBuffer);
    console.log(`📊 Original: ${metadata.width}x${metadata.height}, ${metadata.format}, ${(metadata.size / (1024 * 1024)).toFixed(2)}MB`);
    
    // Calculate optimal dimensions
    const optimalDimensions = calculateOptimalDimensions(metadata.width, metadata.height, { width: maxWidth, height: maxHeight });
    console.log(`📐 Optimal dimensions: ${optimalDimensions.width}x${optimalDimensions.height}`);
    
    let sharpInstance = sharp(imageBuffer)
      .resize(optimalDimensions.width, optimalDimensions.height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    
    // Apply format-specific compression
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        sharpInstance = sharpInstance.jpeg({
          quality,
          progressive,
          mozjpeg: true
        });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({
          quality,
          effort: 6
        });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({
          quality,
          compressionLevel: 9,
          progressive
        });
        break;
      default:
        // Keep original format but apply compression
        if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
          sharpInstance = sharpInstance.jpeg({ quality, progressive, mozjpeg: true });
        } else if (metadata.format === 'webp') {
          sharpInstance = sharpInstance.webp({ quality, effort: 6 });
        } else if (metadata.format === 'png') {
          sharpInstance = sharpInstance.png({ quality, compressionLevel: 9, progressive });
        }
    }
    
    const compressedBuffer = await sharpInstance.toBuffer();
    
    // Get compressed metadata
    const compressedMetadata = await getImageMetadata(compressedBuffer);
    const compressionRatio = ((metadata.size - compressedMetadata.size) / metadata.size * 100).toFixed(1);
    
    console.log(`✅ Compressed: ${compressedMetadata.width}x${compressedMetadata.height}, ${compressedMetadata.format}, ${(compressedMetadata.size / (1024 * 1024)).toFixed(2)}MB`);
    console.log(`📉 Compression ratio: ${compressionRatio}% reduction`);
    
    return compressedBuffer;
    
  } catch (error) {
    console.error('❌ Error compressing image:', error.message);
    throw new Error(`Image compression failed: ${error.message}`);
  }
}

/**
 * Apply double compression for very large images
 * @param {Buffer} imageBuffer - The image buffer to compress
 * @param {Object} options - Compression options
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
async function applyDoubleCompression(imageBuffer, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 85,
    format = 'jpeg'
  } = options;

  console.log(`🔄 Applying double compression for large image...`);
  
  // First compression with original settings
  let processedBuffer = await compressImage(imageBuffer, {
    maxWidth,
    maxHeight,
    quality,
    format
  });
  
  // Check if first compression was sufficient
  let sizeCheck = checkFileSize(processedBuffer);
  if (sizeCheck.exceeds) {
    console.warn(`⚠️  First compression not sufficient (${sizeCheck.sizeMB}MB), applying second compression...`);
    
    // Second compression with more aggressive settings
    const aggressiveQuality = Math.max(60, quality - 20); // Reduce quality by 20, minimum 60
    const aggressiveMaxWidth = Math.round(maxWidth * 0.8); // Reduce dimensions by 20%
    const aggressiveMaxHeight = Math.round(maxHeight * 0.8);
    
    console.log(`🔄 Second compression: quality=${aggressiveQuality}, dimensions=${aggressiveMaxWidth}x${aggressiveMaxHeight}`);
    
    processedBuffer = await compressImage(processedBuffer, {
      maxWidth: aggressiveMaxWidth,
      maxHeight: aggressiveMaxHeight,
      quality: aggressiveQuality,
      format
    });
    
    // Check final result
    sizeCheck = checkFileSize(processedBuffer);
    if (sizeCheck.exceeds) {
      console.error(`❌ Error: Even after double compression, file size (${sizeCheck.sizeMB}MB) still exceeds WordPress limit.`);
      console.error(`   Image will be rejected to prevent upload failures.`);
      throw new Error(`Image too large: ${sizeCheck.sizeMB}MB exceeds WordPress limit of ${sizeCheck.maxSizeMB}MB even after double compression`);
    } else {
      console.log(`✅ Double compression successful: ${sizeCheck.sizeMB}MB`);
    }
  }
  
  return processedBuffer;
}

/**
 * Process image for WordPress upload - check size and compress if needed
 * @param {Buffer} imageBuffer - The image buffer to process
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - { buffer: Buffer, metadata: Object, wasCompressed: boolean }
 */
async function processImageForUpload(imageBuffer, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 85,
    format = 'jpeg',
    placement = 'content'
  } = options;

  try {
    console.log(`🔍 Processing image for WordPress upload...`);
    
    // Check file size
    const sizeCheck = checkFileSize(imageBuffer);
    console.log(`📊 File size: ${sizeCheck.sizeMB}MB (optimal: ${sizeCheck.optimalSizeMB}MB, max: ${sizeCheck.maxSizeMB}MB)`);
    
    if (sizeCheck.exceeds) {
      console.log(`⚠️  File size exceeds WordPress limit! Compression required.`);
    } else if (sizeCheck.needsCompression) {
      console.log(`💡 File size is large, compressing for better performance...`);
    } else if (sizeCheck.needsOptimization) {
      console.log(`💡 File size is above optimal, compressing for consistency...`);
    } else {
      console.log(`✅ File size is within optimal limits.`);
    }
    
    // Get image metadata
    const metadata = await getImageMetadata(imageBuffer);
    
    // Determine if compression is needed
    const needsCompression = sizeCheck.exceeds || sizeCheck.needsCompression || sizeCheck.needsOptimization ||
                           metadata.width > maxWidth || metadata.height > maxHeight;
    
    let processedBuffer = imageBuffer;
    let wasCompressed = false;
    
    if (needsCompression) {
      console.log(`🔄 Compressing image...`);
      
      try {
        // Use double compression for very large images
        if (sizeCheck.exceeds) {
          processedBuffer = await applyDoubleCompression(imageBuffer, {
            maxWidth,
            maxHeight,
            quality,
            format
          });
        } else {
          // Single compression for moderately large images
          processedBuffer = await compressImage(imageBuffer, {
            maxWidth,
            maxHeight,
            quality,
            format
          });
        }
        
        wasCompressed = true;
      } catch (error) {
        if (error.message.includes('Image too large')) {
          console.error(`❌ Image rejected: ${error.message}`);
          throw error; // Re-throw the error to be handled by the calling function
        } else {
          throw error; // Re-throw other compression errors
        }
      }
    }
    
    // Get final metadata
    const finalMetadata = await getImageMetadata(processedBuffer);
    
    return {
      buffer: processedBuffer,
      metadata: finalMetadata,
      wasCompressed,
      originalSize: metadata.size,
      compressedSize: finalMetadata.size,
      compressionRatio: wasCompressed ? 
        ((metadata.size - finalMetadata.size) / metadata.size * 100).toFixed(1) : 0
    };
    
  } catch (error) {
    console.error('❌ Error processing image:', error.message);
    throw error;
  }
}

/**
 * Batch process multiple images for WordPress upload
 * @param {Array} images - Array of image objects with buffer property
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} - Array of processed image objects
 */
async function processImagesForUpload(images, options = {}) {
  console.log(`🖼️  Processing ${images.length} images for WordPress upload...`);
  
  const processedImages = [];
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    try {
      console.log(`\n📤 Processing image ${i + 1}/${images.length}: ${image.description || image.fileName || 'Unknown'}`);
      
      // Get image buffer
      let imageBuffer;
      if (image.buffer) {
        imageBuffer = image.buffer;
      } else if (image.data) {
        imageBuffer = Buffer.from(image.data, 'base64');
      } else {
        throw new Error('No image data available');
      }
      
      // Process the image
      const processed = await processImageForUpload(imageBuffer, options);
      
      // Update the image object with processed data
      const processedImage = {
        ...image,
        buffer: processed.buffer,
        originalSize: processed.originalSize,
        compressedSize: processed.compressedSize,
        wasCompressed: processed.wasCompressed,
        compressionRatio: processed.compressionRatio,
        metadata: processed.metadata
      };
      
      processedImages.push(processedImage);
      
      console.log(`✅ Image ${i + 1} processed successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to process image ${i + 1}:`, error.message);
      // Add original image with error info
      processedImages.push({
        ...image,
        processed: false,
        error: error.message
      });
    }
  }
  
  const successCount = processedImages.filter(img => !img.error).length;
  console.log(`\n🎉 Image processing completed: ${successCount}/${images.length} successful`);
  
  return processedImages;
}

/**
 * Get recommended compression settings based on image placement
 * @param {string} placement - Image placement ('featured', 'content', 'thumbnail')
 * @returns {Object} - Recommended compression settings
 */
function getCompressionSettings(placement = 'content') {
  const settings = {
    featured: {
      maxWidth: MAX_DIMENSIONS.featured.width,
      maxHeight: MAX_DIMENSIONS.featured.height,
      quality: 90,
      format: 'jpeg'
    },
    content: {
      maxWidth: MAX_DIMENSIONS.content.width,
      maxHeight: MAX_DIMENSIONS.content.height,
      quality: 85,
      format: 'jpeg'
    },
    thumbnail: {
      maxWidth: MAX_DIMENSIONS.thumbnail.width,
      maxHeight: MAX_DIMENSIONS.thumbnail.height,
      quality: 80,
      format: 'jpeg'
    }
  };
  
  return settings[placement] || settings.content;
}

module.exports = {
  checkFileSize,
  getImageMetadata,
  calculateOptimalDimensions,
  compressImage,
  applyDoubleCompression,
  processImageForUpload,
  processImagesForUpload,
  getCompressionSettings,
  WORDPRESS_MAX_FILE_SIZE,
  RECOMMENDED_MAX_SIZE,
  OPTIMAL_MAX_SIZE,
  MAX_DIMENSIONS,
  COMPRESSION_QUALITY
};
