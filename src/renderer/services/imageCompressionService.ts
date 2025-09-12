/**
 * Image Compression Service for TypeScript/Electron
 * This service provides functions to check file sizes and compress images
 * to meet WordPress upload limits (100MB max file size)
 */

import * as sharp from 'sharp';

// WordPress upload limits
export const WORDPRESS_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
export const RECOMMENDED_MAX_SIZE = 10 * 1024 * 1024; // 10MB recommended for better performance
export const OPTIMAL_MAX_SIZE = 5 * 1024 * 1024; // 5MB optimal for content images

// Image quality settings
export const COMPRESSION_QUALITY = {
  jpeg: 85,
  webp: 85,
  png: 90
};

// Maximum dimensions for different use cases
export const MAX_DIMENSIONS = {
  featured: { width: 1920, height: 1080 },
  content: { width: 1200, height: 800 },
  thumbnail: { width: 300, height: 300 }
};

export interface FileSizeCheck {
  exceeds: boolean;
  size: number;
  maxSize: number;
  needsCompression: boolean;
  needsOptimization: boolean;
  sizeMB: string;
  maxSizeMB: string;
  optimalSizeMB: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  density?: number;
  hasAlpha: boolean;
  channels: number;
  space: string;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: string;
  progressive?: boolean;
  placement?: 'featured' | 'content' | 'thumbnail';
}

export interface ProcessedImage {
  buffer: Buffer;
  metadata: ImageMetadata;
  wasCompressed: boolean;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Check if file size exceeds WordPress limits
 */
export function checkFileSize(fileBuffer: Buffer): FileSizeCheck {
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
 */
export async function getImageMetadata(imageBuffer: Buffer): Promise<ImageMetadata> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: metadata.size || 0,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha || false,
      channels: metadata.channels || 0,
      space: metadata.space || 'unknown'
    };
  } catch (error) {
    console.error('❌ Error getting image metadata:', error);
    throw new Error(`Failed to get image metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate optimal dimensions while maintaining aspect ratio
 */
export function calculateOptimalDimensions(
  originalWidth: number, 
  originalHeight: number, 
  maxDimensions: { width: number; height: number }
): { width: number; height: number } {
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
 */
export async function compressImage(
  imageBuffer: Buffer, 
  options: CompressionOptions = {}
): Promise<Buffer> {
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
    console.error('❌ Error compressing image:', error);
    throw new Error(`Image compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Apply double compression for very large images
 */
export async function applyDoubleCompression(
  imageBuffer: Buffer, 
  options: CompressionOptions = {}
): Promise<Buffer> {
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
 */
export async function processImageForUpload(
  imageBuffer: Buffer, 
  options: CompressionOptions = {}
): Promise<ProcessedImage> {
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
        if (error instanceof Error && error.message.includes('Image too large')) {
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
        parseFloat(((metadata.size - finalMetadata.size) / metadata.size * 100).toFixed(1)) : 0
    };
    
  } catch (error) {
    console.error('❌ Error processing image:', error);
    throw error;
  }
}

/**
 * Get recommended compression settings based on image placement
 */
export function getCompressionSettings(placement: 'featured' | 'content' | 'thumbnail' | 'header' | 'footer' = 'content'): CompressionOptions {
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
    },
    header: {
      maxWidth: MAX_DIMENSIONS.content.width,
      maxHeight: MAX_DIMENSIONS.content.height,
      quality: 85,
      format: 'jpeg'
    },
    footer: {
      maxWidth: MAX_DIMENSIONS.thumbnail.width,
      maxHeight: MAX_DIMENSIONS.thumbnail.height,
      quality: 80,
      format: 'jpeg'
    }
  };
  
  return settings[placement] || settings.content;
}
