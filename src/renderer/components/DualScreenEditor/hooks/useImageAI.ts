import { useState, useCallback } from 'react';
import { ImageAIService, ImageUploadRequest, ImagePlacementSuggestion } from '../../../services/imageAIService';
import PageRouteService from '../../../services/pageRouteService';

export interface ImageAIState {
  isAnalyzing: boolean;
  suggestions: ImagePlacementSuggestion[];
  error: string | null;
  currentAnalysis: {
    imageName: string;
    userRequest: string;
  } | null;
}

export const useImageAI = (projectContext?: {
  currentProject: any;
  availableFiles: any[];
}) => {
  const [state, setState] = useState<ImageAIState>({
    isAnalyzing: false,
    suggestions: [],
    error: null,
    currentAnalysis: null,
  });

  const imageAIService = ImageAIService.getInstance();

  /**
   * Analyze uploaded image and get placement suggestions
   */
  const analyzeImage = useCallback(async (
    imageFile: File,
    userRequest: string,
    aiKey: any,
    model: string
  ): Promise<ImagePlacementSuggestion | null> => {
    if (!projectContext?.currentProject?.path) {
      setState(prev => ({
        ...prev,
        error: 'No project context available'
      }));
      return null;
    }

    setState(prev => ({
      ...prev,
      isAnalyzing: true,
      error: null,
      currentAnalysis: {
        imageName: imageFile.name,
        userRequest
      }
    }));

    try {
      // Get current URL path
      const currentUrlPath = PageRouteService.getInstance().getState().urlPath || '/';

      // Create image upload request
      const request: ImageUploadRequest = {
        imagePath: '', // Will be set when file is actually saved
        originalName: imageFile.name,
        userRequest,
        projectRoot: projectContext.currentProject.path,
        currentUrlPath,
      };

      // Get AI suggestion
      const suggestion = await imageAIService.suggestImagePlacement(
        request,
        aiKey,
        model
      );

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        suggestions: [suggestion, ...prev.suggestions],
        currentAnalysis: null
      }));

      return suggestion;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze image';
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: errorMessage,
        currentAnalysis: null
      }));
      return null;
    }
  }, [projectContext]);

  /**
   * Process multiple images
   */
  const analyzeImages = useCallback(async (
    imageFiles: File[],
    userRequest: string,
    aiKey: any,
    model: string
  ): Promise<ImagePlacementSuggestion[]> => {
    const suggestions: ImagePlacementSuggestion[] = [];

    for (const imageFile of imageFiles) {
      const suggestion = await analyzeImage(imageFile, userRequest, aiKey, model);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }, [analyzeImage]);

  /**
   * Clear suggestions
   */
  const clearSuggestions = useCallback(() => {
    setState(prev => ({
      ...prev,
      suggestions: [],
      error: null
    }));
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  /**
   * Get suggestion by image name
   */
  const getSuggestionForImage = useCallback((imageName: string): ImagePlacementSuggestion | null => {
    return state.suggestions.find(s => 
      s.suggestedName === imageName || 
      s.suggestedPath.includes(imageName)
    ) || null;
  }, [state.suggestions]);

  /**
   * Generate unique filename if conflict exists
   */
  const generateUniqueFilename = useCallback((suggestedPath: string, projectRoot: string): string => {
    const pathParts = suggestedPath.split('/');
    const filename = pathParts.pop() || '';
    const directory = pathParts.join('/');
    
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    const extension = filename.substring(filename.lastIndexOf('.'));
    
    let counter = 1;
    let uniqueName = filename;
    
    // Check if file exists and generate unique name
    while (true) {
      const fullPath = `${projectRoot}/${directory}/${uniqueName}`;
      // Note: In a real implementation, you'd check if the file exists
      // For now, we'll just increment the counter
      if (counter === 1) {
        break; // First attempt, use original name
      }
      
      uniqueName = `${nameWithoutExt}-${counter}${extension}`;
      counter++;
      
      if (counter > 100) {
        // Fallback to timestamp
        uniqueName = `${nameWithoutExt}-${Date.now()}${extension}`;
        break;
      }
    }
    
    return uniqueName;
  }, []);

  return {
    ...state,
    analyzeImage,
    analyzeImages,
    clearSuggestions,
    clearError,
    getSuggestionForImage,
    generateUniqueFilename,
  };
};
