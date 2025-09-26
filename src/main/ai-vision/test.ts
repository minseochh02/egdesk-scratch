import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// We'll initialize the AI instance with the passed API key

interface SegmentationMask {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] format like spatial-understanding
  mask: string; // Base64 encoded mask
  label: string;
}

export async function analyzeImageSegmentation(
  imagePath: string,
  apiKey: string
): Promise<SegmentationMask[]> {
  try {
    // Initialize AI with the passed API key
    const ai = new GoogleGenerativeAI(apiKey);
    
    // Read image file
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    
    // Use the exact same prompt as spatial-understanding project
    const prompt = `Give the segmentation masks for all objects. Output a JSON list of segmentation masks where each entry contains the 2D bounding box in the key "box_2d", the segmentation mask in key "mask", and the text label in the key "label". Use descriptive labels.`;

    // Use the same configuration as spatial-understanding
    const config = {
      temperature: 0.1,
      thinkingConfig: { thinkingBudget: 0 } // Disable thinking for 2.5 Flash as recommended
    };

    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: config.temperature,
        responseMimeType: "application/json",
      }
    });

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType: 'image/png',
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;

    let responseText = response.text();
    
    // Clean up response like spatial-understanding does
    if (responseText.includes('```json')) {
      responseText = responseText.split('```json')[1].split('```')[0];
    }
    
    // Parse JSON response
    const segmentations: SegmentationMask[] = JSON.parse(responseText);
    return segmentations;
  } catch (error) {
    console.error('Error analyzing image segmentation:', error);
    throw error;
  }
}

// Example usage function
export async function analyzeWooriScreenshot(apiKey: string): Promise<SegmentationMask[]> {
  const screenshotPath = path.join(process.cwd(), 'output', 'woori-target-image-2025-09-26T03-13-40-888Z.png');
  
  if (!fs.existsSync(screenshotPath)) {
    throw new Error(`Screenshot not found at: ${screenshotPath}`);
  }
  
  return await analyzeImageSegmentation(screenshotPath, apiKey);
}
