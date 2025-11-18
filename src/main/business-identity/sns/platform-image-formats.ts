/**
 * Platform Image Format Specifications
 * Provides image format requirements for different social media platforms
 */

export interface ImageFormatSpec {
  /** Aspect ratio as width:height (e.g., "1:1", "16:9") */
  aspectRatio: string;
  /** Recommended width in pixels */
  width: number;
  /** Recommended height in pixels */
  height: number;
  /** File format (e.g., "JPEG", "PNG") */
  fileFormat: 'JPEG' | 'PNG';
  /** Maximum file size in MB */
  maxFileSizeMB?: number;
  /** Color profile */
  colorProfile?: string;
  /** Additional notes */
  notes?: string;
}

/**
 * Image format specifications for each platform
 */
const PLATFORM_FORMATS: Record<string, ImageFormatSpec> = {
  instagram: {
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    fileFormat: 'JPEG',
    maxFileSizeMB: 8,
    colorProfile: 'sRGB',
    notes: 'Square format. Also supports 4:5 (1080x1350) portrait and 1.91:1 (1080x566) landscape.',
  },
  'instagram-portrait': {
    aspectRatio: '4:5',
    width: 1080,
    height: 1350,
    fileFormat: 'JPEG',
    maxFileSizeMB: 8,
    colorProfile: 'sRGB',
    notes: 'Portrait format for Instagram feed posts.',
  },
  'instagram-landscape': {
    aspectRatio: '1.91:1',
    width: 1080,
    height: 566,
    fileFormat: 'JPEG',
    maxFileSizeMB: 8,
    colorProfile: 'sRGB',
    notes: 'Landscape format for Instagram feed posts.',
  },
  'instagram-story': {
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fileFormat: 'JPEG',
    maxFileSizeMB: 8,
    colorProfile: 'sRGB',
    notes: 'Vertical format for Instagram Stories and Reels.',
  },
  twitter: {
    aspectRatio: '16:9',
    width: 1200,
    height: 675,
    fileFormat: 'JPEG',
    maxFileSizeMB: 5,
    colorProfile: 'sRGB',
    notes: 'Landscape format. Also supports 1:1 (1200x1200) for cards.',
  },
  'twitter-card': {
    aspectRatio: '1:1',
    width: 1200,
    height: 1200,
    fileFormat: 'JPEG',
    maxFileSizeMB: 5,
    colorProfile: 'sRGB',
    notes: 'Square format for Twitter cards.',
  },
  facebook: {
    aspectRatio: '16:9',
    width: 1200,
    height: 675,
    fileFormat: 'JPEG',
    maxFileSizeMB: 8,
    colorProfile: 'sRGB',
    notes: 'Landscape format. Also supports 1:1 (1200x1200) square.',
  },
  'facebook-square': {
    aspectRatio: '1:1',
    width: 1200,
    height: 1200,
    fileFormat: 'JPEG',
    maxFileSizeMB: 8,
    colorProfile: 'sRGB',
    notes: 'Square format for Facebook posts.',
  },
  youtube: {
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    fileFormat: 'JPEG',
    maxFileSizeMB: 2,
    colorProfile: 'sRGB',
    notes: 'Standard thumbnail format. Also supports 2560x1440 for higher quality.',
  },
  tiktok: {
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    fileFormat: 'JPEG',
    maxFileSizeMB: 10,
    colorProfile: 'sRGB',
    notes: 'Vertical format for TikTok videos and images.',
  },
  wordpress: {
    aspectRatio: '16:9',
    width: 1200,
    height: 675,
    fileFormat: 'JPEG',
    maxFileSizeMB: 10,
    colorProfile: 'sRGB',
    notes: 'Standard blog post featured image format. Flexible, but 16:9 is recommended.',
  },
  'naver-blog': {
    aspectRatio: '16:9',
    width: 1200,
    height: 675,
    fileFormat: 'JPEG',
    maxFileSizeMB: 5,
    colorProfile: 'sRGB',
    notes: 'Standard blog post image format for Naver Blog.',
  },
  tistory: {
    aspectRatio: '16:9',
    width: 1200,
    height: 675,
    fileFormat: 'JPEG',
    maxFileSizeMB: 5,
    colorProfile: 'sRGB',
    notes: 'Standard blog post image format for Tistory.',
  },
  blog: {
    aspectRatio: '16:9',
    width: 1200,
    height: 675,
    fileFormat: 'JPEG',
    maxFileSizeMB: 10,
    colorProfile: 'sRGB',
    notes: 'Generic blog post image format. 16:9 is the most common.',
  },
};

/**
 * Get image format specification for a platform
 * @param platform Platform name (case-insensitive, supports variations)
 * @returns Image format specification or null if not found
 */
export function getImageFormatForPlatform(platform: string): ImageFormatSpec | null {
  if (!platform || typeof platform !== 'string') {
    return null;
  }

  const normalized = platform.toLowerCase().trim();

  // Direct match
  if (PLATFORM_FORMATS[normalized]) {
    return PLATFORM_FORMATS[normalized];
  }

  // Handle variations and partial matches
  if (normalized.includes('instagram')) {
    // Default to square format for Instagram
    return PLATFORM_FORMATS.instagram;
  }
  if (normalized.includes('twitter') || normalized === 'x') {
    return PLATFORM_FORMATS.twitter;
  }
  if (normalized.includes('facebook') || normalized === 'fb') {
    return PLATFORM_FORMATS.facebook;
  }
  if (normalized.includes('youtube') || normalized === 'yt') {
    return PLATFORM_FORMATS.youtube;
  }
  if (normalized.includes('tiktok') || normalized === 'tt') {
    return PLATFORM_FORMATS.tiktok;
  }
  if (normalized.includes('wordpress') || normalized === 'wp') {
    return PLATFORM_FORMATS.wordpress;
  }
  if (normalized.includes('naver')) {
    return PLATFORM_FORMATS['naver-blog'];
  }
  if (normalized.includes('tistory')) {
    return PLATFORM_FORMATS.tistory;
  }
  if (normalized === 'blog') {
    return PLATFORM_FORMATS.blog;
  }

  // Default to blog format for unknown platforms
  return PLATFORM_FORMATS.blog;
}

/**
 * Get all available platform formats
 */
export function getAllPlatformFormats(): Record<string, ImageFormatSpec> {
  return { ...PLATFORM_FORMATS };
}

/**
 * Format specification as a string for display or prompts
 */
export function formatSpecAsString(spec: ImageFormatSpec): string {
  return `${spec.aspectRatio} aspect ratio, ${spec.width}x${spec.height} pixels, ${spec.fileFormat} format${spec.maxFileSizeMB ? `, max ${spec.maxFileSizeMB}MB` : ''}`;
}

