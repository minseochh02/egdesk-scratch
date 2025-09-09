import { IMAGE_EXTENSIONS, isImageExtension, getFileExtension } from '../constants/imageExtensions';

export interface ImageFolderResult {
  folderPath: string;
  imageCount: number;
  relativePath: string;
}

export class ImageFolderService {
  private static instance: ImageFolderService;
  
  // Special prefix to identify images uploaded through the application
  private static readonly UPLOAD_PREFIX = 'egdesk_';

  public static getInstance(): ImageFolderService {
    if (!ImageFolderService.instance) {
      ImageFolderService.instance = new ImageFolderService();
    }
    return ImageFolderService.instance;
  }

  /**
   * Find the folder with the most image files in the project
   */
  async findFolderWithMostImages(projectPath: string, availableFiles: any[]): Promise<ImageFolderResult | null> {
    try {
      console.log('🔍 DEBUG: Finding folder with most images in project:', {
        projectPath,
        availableFilesCount: availableFiles?.length || 0
      });
      
      // Group files by directory
      const folderImageCounts = new Map<string, { count: number; files: any[] }>();
      
      // First, try to scan the project directory directly for image files
      try {
        console.log('🔍 DEBUG: Scanning project directory for image files...');
        const projectFiles = await this.scanProjectForImages(projectPath);
        console.log('📁 DEBUG: Found project files:', projectFiles.length);
        
        // Process project files
        for (const file of projectFiles) {
          if (!file || !file.path || !file.name) continue;
          
          // Check if it's an image file
          const fileName = file.name;
          const extension = getFileExtension(fileName);
          if (!extension || !isImageExtension(extension)) continue;
          
          // Get directory path
          const dirPath = file.path.substring(0, file.path.lastIndexOf('/'));
          const relativeDirPath = dirPath.replace(projectPath, '').replace(/^\//, '') || 'root';
          
          if (!folderImageCounts.has(relativeDirPath)) {
            folderImageCounts.set(relativeDirPath, { count: 0, files: [] });
          }
          
          const folderData = folderImageCounts.get(relativeDirPath)!;
          folderData.count++;
          folderData.files.push(file);
        }
      } catch (scanError) {
        console.warn('⚠️ DEBUG: Failed to scan project directory, falling back to available files:', scanError);
        
        // Fallback to available files if directory scan fails
        if (availableFiles && Array.isArray(availableFiles)) {
          for (const file of availableFiles) {
            if (!file || !file.path || !file.name) continue;
            
            // Check if it's an image file
            const fileName = file.name;
            const extension = getFileExtension(fileName);
            if (!extension || !isImageExtension(extension)) continue;
            
            // Get directory path
            const dirPath = file.path.substring(0, file.path.lastIndexOf('/'));
            const relativeDirPath = dirPath.replace(projectPath, '').replace(/^\//, '') || 'root';
            
            if (!folderImageCounts.has(relativeDirPath)) {
              folderImageCounts.set(relativeDirPath, { count: 0, files: [] });
            }
            
            const folderData = folderImageCounts.get(relativeDirPath)!;
            folderData.count++;
            folderData.files.push(file);
          }
        }
      }
      
      console.log('📊 DEBUG: Folder image counts:', Array.from(folderImageCounts.entries()).map(([path, data]) => ({
        path,
        count: data.count,
        files: data.files.map(f => f.name)
      })));
      
      // Find folder with most images
      let maxCount = 0;
      let bestFolder = '';
      let bestFolderFiles: any[] = [];
      
      for (const [folderPath, data] of folderImageCounts.entries()) {
        if (data.count > maxCount) {
          maxCount = data.count;
          bestFolder = folderPath;
          bestFolderFiles = data.files;
        }
      }
      
      if (maxCount === 0) {
        // No images found, create a default images folder
        const defaultFolder = 'assets/images';
        console.log('📁 DEBUG: No images found, using default folder:', defaultFolder);
        return {
          folderPath: `${projectPath}/${defaultFolder}`,
          imageCount: 0,
          relativePath: defaultFolder
        };
      }
      
      console.log('✅ DEBUG: Found best image folder:', {
        folderPath: bestFolder,
        imageCount: maxCount,
        fullPath: `${projectPath}/${bestFolder}`
      });
      
      return {
        folderPath: `${projectPath}/${bestFolder}`,
        imageCount: maxCount,
        relativePath: bestFolder
      };
      
    } catch (error) {
      console.error('❌ DEBUG: Error finding image folder:', error);
      return null;
    }
  }

  /**
   * Save uploaded image to the folder with most images
   */
  async saveImageToBestFolder(
    imageFile: File,
    projectPath: string,
    availableFiles: any[]
  ): Promise<{ success: boolean; imagePath?: string; error?: string }> {
    try {
      console.log('💾 DEBUG: Saving image to best folder:', {
        fileName: imageFile.name,
        projectPath,
        availableFilesCount: availableFiles?.length || 0
      });
      
      // Find the best folder
      const folderResult = await this.findFolderWithMostImages(projectPath, availableFiles || []);
      if (!folderResult) {
        console.error('❌ DEBUG: Could not determine best folder for images');
        return {
          success: false,
          error: 'Could not determine best folder for images'
        };
      }
      
      // Ensure the folder exists
      try {
        const folderInfo = await window.electron.fileSystem.getFileInfo(folderResult.folderPath);
        if (!folderInfo.success || !folderInfo.info?.isDirectory) {
          console.log('📁 DEBUG: Creating folder:', folderResult.folderPath);
          await window.electron.fileSystem.createFolder(folderResult.folderPath);
        }
      } catch (error) {
        // If we can't check, try to create the folder
        console.log('📁 DEBUG: Creating folder (fallback):', folderResult.folderPath);
        await window.electron.fileSystem.createFolder(folderResult.folderPath);
      }
      
      // Generate unique filename with EGDesk prefix
      const originalName = imageFile.name;
      const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
      const extension = originalName.substring(originalName.lastIndexOf('.'));
      
      // Add EGDesk prefix to the filename
      let fileName = `${ImageFolderService.UPLOAD_PREFIX}${originalName}`;
      let counter = 1;
      
      // Check if file already exists and generate unique name if needed
      let fileExists = true;
      while (fileExists) {
        try {
          const fileInfo = await window.electron.fileSystem.getFileInfo(`${folderResult.folderPath}/${fileName}`);
          fileExists = fileInfo.success && fileInfo.info?.isFile;
          if (fileExists) {
            fileName = `${ImageFolderService.UPLOAD_PREFIX}${baseName}_${counter}${extension}`;
            counter++;
          }
        } catch (error) {
          fileExists = false; // Assume file doesn't exist if we can't check
        }
      }
      
      // Convert File to ArrayBuffer
      const arrayBuffer = await imageFile.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert Uint8Array to base64 string for writing
      const base64String = btoa(String.fromCharCode(...uint8Array));
      
      // Save the file
      const fullPath = `${folderResult.folderPath}/${fileName}`;
      const saveResult = await window.electron.fileSystem.writeFile(fullPath, base64String);
      
      if (saveResult.success) {
        const relativePath = `${folderResult.relativePath}/${fileName}`;
        console.log('✅ DEBUG: Image saved successfully with EGDesk prefix:', {
          originalName: imageFile.name,
          prefixedName: fileName,
          fullPath,
          relativePath,
          size: imageFile.size
        });
        
        return {
          success: true,
          imagePath: relativePath
        };
      } else {
        return {
          success: false,
          error: saveResult.error || 'Failed to save image file'
        };
      }
      
    } catch (error) {
      console.error('❌ DEBUG: Error saving image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Scan project directory for image files
   */
  private async scanProjectForImages(projectPath: string): Promise<any[]> {
    try {
      console.log('🔍 DEBUG: Scanning project directory:', projectPath);
      
      // Use the electron file system to read the directory
      const result = await window.electron.fileSystem.readDirectory(projectPath);
      
      if (!result?.success || !Array.isArray(result.items)) {
        console.warn('⚠️ DEBUG: Failed to read project directory or no items found');
        return [];
      }
      
      const imageFiles: any[] = [];
      
      // Recursively scan directories for image files
      const scanDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
        if (depth > 10) {
          console.log(`⏭️ DEBUG: Max depth reached for ${dirPath}`);
          return; // Prevent infinite recursion
        }
        
        try {
          console.log(`🔍 DEBUG: Scanning directory (depth ${depth}): ${dirPath}`);
          const dirResult = await window.electron.fileSystem.readDirectory(dirPath);
          
          if (!dirResult) {
            console.warn(`⚠️ DEBUG: No result from readDirectory for ${dirPath}`);
            return;
          }
          
          if (!dirResult.success) {
            console.warn(`⚠️ DEBUG: readDirectory failed for ${dirPath}:`, dirResult.error || 'Unknown error');
            return;
          }
          
          if (!Array.isArray(dirResult.items)) {
            console.warn(`⚠️ DEBUG: readDirectory returned non-array items for ${dirPath}:`, typeof dirResult.items);
            return;
          }
          
          console.log(`📁 DEBUG: Found ${dirResult.items.length} items in ${dirPath}`);
          
          for (const item of dirResult.items) {
            if (!item || !item.name || !item.path) {
              console.warn('⚠️ DEBUG: Skipping invalid item:', item);
              continue;
            }
            
            if (item.isDirectory) {
              // Skip common non-image directories
              const skipDirs = new Set(['node_modules', '.git', '.vscode', 'dist', 'build', 'coverage', '.next', '.nuxt']);
              if (skipDirs.has(item.name) || (item.isHidden === true)) {
                console.log(`⏭️ DEBUG: Skipping directory: ${item.name} (${item.isHidden ? 'hidden' : 'in skip list'})`);
                continue;
              }
              
              // Recursively scan subdirectory
              await scanDirectory(item.path, depth + 1);
            } else if (item.isFile) {
              // Check if it's an image file
              const fileName = item.name;
              if (!fileName || typeof fileName !== 'string') {
                console.warn('⚠️ DEBUG: Skipping file with invalid name:', fileName);
                continue;
              }
              
              const extension = getFileExtension(fileName);
              if (extension && isImageExtension(extension)) {
                imageFiles.push({
                  name: fileName,
                  path: item.path,
                  isFile: true,
                  isDirectory: false
                });
                console.log(`🖼️ DEBUG: Found image file: ${fileName} in ${item.path}`);
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️ DEBUG: Error scanning directory ${dirPath}:`, error);
        }
      };
      
      // Start scanning from the project root
      try {
        await scanDirectory(projectPath);
        console.log('📁 DEBUG: Found image files in project:', imageFiles.length);
        return imageFiles;
      } catch (scanError) {
        console.error('❌ DEBUG: Error during directory scanning:', scanError);
        return imageFiles; // Return whatever we found so far
      }
      
    } catch (error) {
      console.error('❌ DEBUG: Error scanning project for images:', error);
      return [];
    }
  }

  /**
   * Check if a filename has the EGDesk upload prefix
   */
  static isEGDeskUploadedImage(fileName: string): boolean {
    return fileName.startsWith(ImageFolderService.UPLOAD_PREFIX);
  }

  /**
   * Get the original filename by removing the EGDesk prefix
   */
  static getOriginalFileName(prefixedFileName: string): string {
    if (ImageFolderService.isEGDeskUploadedImage(prefixedFileName)) {
      return prefixedFileName.substring(ImageFolderService.UPLOAD_PREFIX.length);
    }
    return prefixedFileName;
  }

  /**
   * Get all EGDesk-uploaded images from the project files
   */
  static getEGDeskUploadedImages(availableFiles: any[]): any[] {
    return availableFiles.filter(file => {
      if (!file.name) return false;
      return ImageFolderService.isEGDeskUploadedImage(file.name);
    });
  }

  /**
   * Save multiple images to the best folder
   */
  async saveMultipleImagesToBestFolder(
    imageFiles: File[],
    projectPath: string,
    availableFiles: any[]
  ): Promise<{ success: boolean; imagePaths?: string[]; errors?: string[] }> {
    try {
      console.log('💾 DEBUG: Saving multiple images to best folder:', {
        count: imageFiles.length,
        projectPath,
        availableFilesCount: availableFiles?.length || 0
      });
      
      const results = await Promise.all(
        imageFiles.map(file => this.saveImageToBestFolder(file, projectPath, availableFiles || []))
      );
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      console.log('📊 DEBUG: Batch save results:', {
        total: imageFiles.length,
        successful: successful.length,
        failed: failed.length
      });
      
      return {
        success: successful.length > 0,
        imagePaths: successful.map(r => r.imagePath!),
        errors: failed.map(r => r.error!)
      };
      
    } catch (error) {
      console.error('❌ DEBUG: Error saving multiple images:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }
}
