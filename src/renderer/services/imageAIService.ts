import { ProjectContext } from '../types/projectContext';

export interface ImageUploadRequest {
  imagePath: string;
  originalName: string;
  userRequest: string;
  projectRoot: string;
  currentUrlPath?: string;
  projectStructure?: string;
}

export interface ImagePlacementSuggestion {
  suggestedPath: string;
  suggestedName: string;
  reasoning: string;
  confidence: number;
  alternatives?: Array<{
    path: string;
    name: string;
    reasoning: string;
  }>;
}

export class ImageAIService {
  private static instance: ImageAIService;

  private constructor() {}

  static getInstance(): ImageAIService {
    if (!ImageAIService.instance) {
      ImageAIService.instance = new ImageAIService();
    }
    return ImageAIService.instance;
  }

  /**
   * Analyze multiple images and suggest placement
   */
  async analyzeImages(
    imageFiles: File[],
    userRequest: string,
    aiKey: string,
    model: string,
    projectContext?: ProjectContext
  ): Promise<ImagePlacementSuggestion[]> {
    try {
      console.log('🖼️ DEBUG: Starting image analysis', {
        imageCount: imageFiles.length,
        userRequest,
        model
      });

      // For now, return placeholder suggestions
      // TODO: Implement actual AI analysis
      const suggestions: ImagePlacementSuggestion[] = imageFiles.map((file, index) => ({
        suggestedPath: `assets/images/${file.name}`,
        suggestedName: file.name,
        reasoning: `Placeholder suggestion for ${file.name} based on user request: "${userRequest}"`,
        confidence: 0.7,
        alternatives: [
          {
            path: `images/${file.name}`,
            name: file.name,
            reasoning: 'Alternative placement in images folder'
          }
        ]
      }));

      console.log('✅ DEBUG: Generated image suggestions', suggestions);
      return suggestions;
    } catch (error) {
      console.error('❌ DEBUG: Image analysis failed:', error);
      throw error;
    }
  }

  /**
   * Suggest placement for a single image
   */
  async suggestImagePlacement(
    request: ImageUploadRequest,
    aiKey: string,
    model: string
  ): Promise<ImagePlacementSuggestion> {
    try {
      console.log('🖼️ DEBUG: Suggesting image placement', {
        imagePath: request.imagePath,
        originalName: request.originalName,
        userRequest: request.userRequest
      });

      // For now, return placeholder suggestion
      // TODO: Implement actual AI analysis
      const suggestion: ImagePlacementSuggestion = {
        suggestedPath: `assets/images/${request.originalName}`,
        suggestedName: request.originalName,
        reasoning: `Placeholder suggestion based on user request: "${request.userRequest}"`,
        confidence: 0.7,
        alternatives: [
          {
            path: `images/${request.originalName}`,
            name: request.originalName,
            reasoning: 'Alternative placement in images folder'
          }
        ]
      };

      console.log('✅ DEBUG: Generated image suggestion', suggestion);
      return suggestion;
    } catch (error) {
      console.error('❌ DEBUG: Image placement suggestion failed:', error);
      throw error;
    }
  }

  /**
   * Build project structure string for AI context
   */
  private buildProjectStructure(files: any[]): string {
    const structure = files
      .map(file => {
        const relativePath = file.path.replace(/^.*[\\\/]/, '');
        return `  ${relativePath}`;
      })
      .join('\n');

    return structure.trim();
  }

  /**
   * Find existing images in the project
   */
  private findExistingImages(files: any[]): string[] {
    const imageExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif',
      '.ico', '.jfif', '.pjpeg', '.pjp', '.avif', '.heic', '.heif'
    ];
    
    return files
      .filter(file => {
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        return imageExtensions.includes(ext);
      })
      .map(file => file.path);
  }

  /**
   * Analyze naming patterns from existing images
   */
  private analyzeNamingPatterns(images: string[]): string[] {
    const patterns: string[] = [];
    
    // Extract common prefixes, suffixes, and naming conventions
    const names = images.map(img => img.split('/').pop()?.split('.')[0] || '');
    
    // Find common patterns
    const prefixes = new Set<string>();
    const suffixes = new Set<string>();
    
    names.forEach(name => {
      if (name.includes('-')) {
        const parts = name.split('-');
        if (parts[0]) prefixes.add(parts[0]);
        if (parts[parts.length - 1]) suffixes.add(parts[parts.length - 1]);
      }
      if (name.includes('_')) {
        const parts = name.split('_');
        if (parts[0]) prefixes.add(parts[0]);
        if (parts[parts.length - 1]) suffixes.add(parts[parts.length - 1]);
      }
    });
    
    return Array.from(prefixes).concat(Array.from(suffixes));
  }
}

export default ImageAIService;