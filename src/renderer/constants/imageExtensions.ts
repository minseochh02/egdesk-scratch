/**
 * Common image file extensions supported by the application
 */
export const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif',
  '.ico', '.jfif', '.pjpeg', '.pjp', '.avif', '.heic', '.heif'
] as const;

/**
 * Check if a file extension is a supported image format
 */
export const isImageExtension = (extension: string): boolean => {
  return IMAGE_EXTENSIONS.includes(extension.toLowerCase() as any);
};

/**
 * Get file extension from filename
 */
export const getFileExtension = (filename: string): string => {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return '';
  return '.' + filename.substring(lastDotIndex + 1).toLowerCase();
};
