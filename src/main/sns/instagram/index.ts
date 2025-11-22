/**
 * Instagram SNS Post Handler for Business Identity
 * Handles Instagram post creation for business identity SNS plans
 */

import { Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { createInstagramPost, PostOptions } from './instagram-post';
import {
  generateInstagramContent,
  InstagramContentPlan,
  GeneratedInstagramContent,
} from './generate-text-content';
import { generateInstagramImage } from './generate-image-content';
import { login as playwrightInstagramLogin, getAuthenticatedPage, loginWithPage } from './login';
import type { AuthContext } from './login';
import { getStore } from '../../storage';
import { getSQLiteManager } from '../../sqlite/manager';

export interface BusinessIdentityInstagramPostOptions {
  /** SQLite plan ID for execution tracking */
  planId?: string;
  /** Instagram username for login */
  username?: string;
  /** Instagram password for login */
  password?: string;
  /** Path to image file (if not provided, will search for default or generate) */
  imagePath?: string;
  /** Direct caption text (optional if structuredPrompt is provided) */
  caption?: string;
  /** Structured prompt for AI-generated content */
  structuredPrompt?: InstagramContentPlan;
  /** Chrome profile path (optional) */
  profilePath?: string;
  /** Chrome profile directory (optional) */
  profileDirectory?: string;
  /** Chrome profile root (optional) */
  profileRoot?: string;
  /** Target URL (defaults to Instagram home) */
  targetUrl?: string;
  /** Wait time after sharing (milliseconds) */
  waitAfterShare?: number;
}

export interface BusinessIdentityInstagramPostResult {
  success: boolean;
  automation?: 'playwright' | 'chrome-automation' | 'chrome-profile';
  error?: string;
  generatedContent?: GeneratedInstagramContent;
  executionId?: string; // SQLite execution ID for tracking and retry
}

/**
 * Helper function to update execution status and plan stats
 */
function updateExecutionStatus(
  executionId: string | undefined,
  planId: string | undefined,
  status: 'completed' | 'failed',
  error?: string,
  output?: string
): void {
  if (!executionId || !planId) return;

  try {
    const sqliteManager = getSQLiteManager();
    if (!sqliteManager.isAvailable()) return;

    const biManager = sqliteManager.getBusinessIdentityManager();
    biManager.updateExecution(executionId, {
      endTime: new Date(),
      status,
      error,
      output,
    });

    // Update plan stats
    biManager.updatePlanStats(planId, status === 'completed');
    console.log(`[createBusinessIdentityInstagramPost] Updated execution ${executionId} to ${status}`);
  } catch (error) {
    console.error('[createBusinessIdentityInstagramPost] Failed to update execution status:', error);
  }
}

/**
 * Resolve image path for Instagram post
 * Tries custom path first, then generates image if prompt provided, finally falls back to default
 * @throws Error if image generation is required but fails
 */
export async function resolveImagePath(
  customPath?: string,
  imagePrompt?: string,
  altText?: string,
  requireImageGeneration?: boolean // If true, don't fall back to default if generation fails
): Promise<string | null> {
  // If custom path provided, use it
  if (customPath && typeof customPath === 'string' && customPath.trim().length > 0) {
    const resolved = path.resolve(customPath.trim());
    if (fs.existsSync(resolved)) {
      console.log('[BusinessIdentityInstagram] Using custom image path:', resolved);
      return resolved;
    }
  }

  // If image prompt is provided, generate the image
  if (imagePrompt && typeof imagePrompt === 'string' && imagePrompt.trim().length > 0) {
    try {
      console.log('[BusinessIdentityInstagram] Generating image from prompt...');
      const generatedImage = await generateInstagramImage({
        imagePrompt: imagePrompt.trim(),
        altText,
      });
      console.log('[BusinessIdentityInstagram] Generated image:', generatedImage.filePath);
      return generatedImage.filePath;
    } catch (error) {
      console.error('[BusinessIdentityInstagram] Failed to generate image:', error);
      
      // If image generation is required, throw the error instead of falling back
      if (requireImageGeneration) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Failed to generate image: Unknown error';
        
        // Extract more details from API errors
        let detailedError = errorMessage;
        if (error && typeof error === 'object' && 'status' in error) {
          if (error.status === 429) {
            detailedError = 'Image generation quota exceeded. Please check your Gemini API plan and billing details, or wait before retrying.';
          } else if (error.status === 401 || error.status === 403) {
            detailedError = 'Image generation authentication failed. Please check your Google AI API key.';
          }
        }
        
        throw new Error(detailedError);
      }
      // Fall through to default image if generation is not required
    }
  }

  // Default: search for cat.png in Downloads
  const defaultCatPath = path.join(app.getPath('home'), 'Downloads', 'cat.png');
  if (fs.existsSync(defaultCatPath)) {
    console.log('[BusinessIdentityInstagram] Using default image path:', defaultCatPath);
    return defaultCatPath;
  }

  // No image available
  return null;
}

/**
 * Create an Instagram post for business identity SNS plan
 */
export async function createBusinessIdentityInstagramPost(
  options: BusinessIdentityInstagramPostOptions
): Promise<BusinessIdentityInstagramPostResult> {
  console.log('[createBusinessIdentityInstagramPost] Starting Instagram post creation...');
  console.log('[createBusinessIdentityInstagramPost] Options:', {
    planId: options.planId,
    hasUsername: !!options.username,
    hasPassword: !!options.password,
    hasImagePath: !!options.imagePath,
    hasCaption: !!options.caption,
    hasStructuredPrompt: !!options.structuredPrompt,
  });

  const {
    planId,
    username,
    password,
    imagePath: customImagePath,
    caption: providedCaption,
    structuredPrompt,
    profilePath,
    profileDirectory,
    profileRoot,
    targetUrl = 'https://www.instagram.com/',
    waitAfterShare = 10000,
  } = options;

  let caption = providedCaption;

  // Create execution record if planId is provided
  let executionId: string | undefined;
  if (planId) {
    try {
      const sqliteManager = getSQLiteManager();
      if (sqliteManager.isAvailable()) {
        const biManager = sqliteManager.getBusinessIdentityManager();
        const execution = biManager.createExecution({
          planId,
          startTime: new Date(),
          status: 'running',
          executionData: {
            username: username ? '***' : undefined,
            hasPassword: !!password,
            imagePath: customImagePath,
            hasCaption: !!caption,
            hasStructuredPrompt: !!structuredPrompt,
            profilePath,
            targetUrl,
          },
        });
        executionId = execution.id;
        console.log('[createBusinessIdentityInstagramPost] Created execution record:', executionId);
      }
    } catch (error) {
      console.error('[createBusinessIdentityInstagramPost] Failed to create execution record:', error);
      // Continue without execution tracking
    }
  }

  // Validate target URL
  try {
    new URL(targetUrl);
  } catch {
    const errorMsg = `Invalid target URL: ${targetUrl}`;
    updateExecutionStatus(executionId, planId, 'failed', errorMsg);
    return {
      success: false,
      error: errorMsg,
      executionId,
    };
  }

  // Check if we need Gemini for content generation
  const needsGemini = Boolean(!caption && structuredPrompt);
  let generatedTextContent: GeneratedInstagramContent | undefined;
  let imagePrompt: string | undefined;
  let altText: string | undefined;

  if (needsGemini) {
    // Check for Google AI key in store (same logic as ai-search utility)
    const store = getStore?.();
    let hasGoogleKey = false;
    
    if (store) {
      const aiKeys = store.get('ai-keys', []);
      if (Array.isArray(aiKeys)) {
        hasGoogleKey = aiKeys.some(
          (k: any) => k?.providerId === 'google' && k?.fields?.apiKey && typeof k.fields.apiKey === 'string' && k.fields.apiKey.trim().length > 0
        );
      }
    }
    
    // Fallback to environment variable
    const hasEnvKey = Boolean(process.env.GEMINI_API_KEY && typeof process.env.GEMINI_API_KEY === 'string');
    
    if (!hasGoogleKey && !hasEnvKey) {
      const errorMsg = 'AI is not configured. Please configure a Google AI key first.';
      updateExecutionStatus(executionId, planId, 'failed', errorMsg);
      return {
        success: false,
        error: errorMsg,
        executionId,
      };
    }

    // Generate text content first to get image prompt
    try {
      console.log('[createBusinessIdentityInstagramPost] Generating text content...');
      if (!structuredPrompt) {
        throw new Error('Structured prompt is required for content generation');
      }
      generatedTextContent = await generateInstagramContent(structuredPrompt);
      caption = generatedTextContent.caption;
      imagePrompt = generatedTextContent.imagePrompt;
      altText = generatedTextContent.altText;
      console.log('[createBusinessIdentityInstagramPost] Text content generated, has image prompt:', !!imagePrompt);
    } catch (textGenError) {
      console.error('[createBusinessIdentityInstagramPost] Failed to generate text content:', textGenError);
      const errorMsg = textGenError instanceof Error ? textGenError.message : 'Failed to generate Instagram content';
      updateExecutionStatus(executionId, planId, 'failed', errorMsg);
      return {
        success: false,
        error: errorMsg,
        executionId,
      };
    }
  }

  // Resolve image path (will generate if imagePrompt is available)
  // If we have an imagePrompt, require successful generation (don't fall back to default)
  const requireImageGeneration = Boolean(imagePrompt && imagePrompt.trim().length > 0);
  let resolvedImagePath: string | null;
  
  try {
    resolvedImagePath = await resolveImagePath(customImagePath, imagePrompt, altText, requireImageGeneration);
  } catch (imageError) {
    // Image generation failed and was required
    const errorMsg = imageError instanceof Error 
      ? imageError.message 
      : 'Failed to generate image for Instagram post';
    console.error('[createBusinessIdentityInstagramPost] Image generation failed:', errorMsg);
    updateExecutionStatus(executionId, planId, 'failed', errorMsg);
    return {
      success: false,
      error: errorMsg,
      executionId,
    };
  }
  
  if (!resolvedImagePath) {
    const errorMsg = 'No image available for Instagram post. Provide imagePath, ensure image generation works, or ensure ~/Downloads/cat.png exists.';
    updateExecutionStatus(executionId, planId, 'failed', errorMsg);
    return {
      success: false,
      error: errorMsg,
      executionId,
    };
  }

  const hasCredentials = Boolean(username && password);
  const loginOptions = hasCredentials
    ? { username: username as string, password: password as string }
    : undefined;

  const profilePathProvided = Boolean(profilePath && typeof profilePath === 'string' && profilePath.trim().length > 0);

  try {
    let result: BusinessIdentityInstagramPostResult;

    // Use Playwright session if no profile path provided
    if (!profilePathProvided) {
      result = await createPostWithPlaywright({
        loginOptions,
        targetUrl,
        resolvedImagePath,
        caption,
        structuredPrompt,
        waitAfterShare,
      });
    } else {
      // Use Chrome profile if provided
      result = await createPostWithChromeProfile({
        profilePath: profilePath!,
        profileDirectory,
        profileRoot,
        loginOptions,
        targetUrl,
        resolvedImagePath,
        caption,
        structuredPrompt,
        waitAfterShare,
      });
    }

    // Update execution status
    if (result.success) {
      updateExecutionStatus(
        executionId,
        planId,
        'completed',
        undefined,
        `Instagram post created successfully. Automation: ${result.automation || 'unknown'}`
      );
    } else {
      updateExecutionStatus(executionId, planId, 'failed', result.error);
    }

    return {
      ...result,
      executionId,
      generatedContent: generatedTextContent || result.generatedContent,
    };
  } catch (error) {
    console.error('[BusinessIdentityInstagram] Unexpected error:', error);
    const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred.';
    updateExecutionStatus(executionId, planId, 'failed', errorMsg);
    return {
      success: false,
      error: errorMsg,
      executionId,
    };
  }
}

/**
 * Create post using Playwright session
 */
async function createPostWithPlaywright(options: {
  loginOptions?: { username: string; password: string };
  targetUrl: string;
  resolvedImagePath: string;
  caption?: string;
  structuredPrompt?: InstagramContentPlan;
  waitAfterShare: number;
}): Promise<BusinessIdentityInstagramPostResult> {
  const { loginOptions, targetUrl, resolvedImagePath, caption, structuredPrompt, waitAfterShare } = options;

  // Perform login if credentials provided
  if (loginOptions) {
    console.log('[BusinessIdentityInstagram] Performing Playwright login with provided credentials.');
    try {
      await playwrightInstagramLogin(loginOptions);
    } catch (authError) {
      console.error('[BusinessIdentityInstagram] Playwright login failed:', authError);
      return {
        success: false,
        error: authError instanceof Error ? authError.message || 'Instagram login failed.' : 'Instagram login failed.',
      };
    }
  }

  try {
    const authSession = await getAuthenticatedPage(loginOptions);
    const { page } = authSession;

    // Wait for page to be ready
    await waitForPageReady(page, 3000);

    // Navigate to Instagram
    try {
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
    } catch (navigationError) {
      console.error('[BusinessIdentityInstagram] Playwright navigation failed:', navigationError);
      try {
        await authSession.close();
      } catch (closeError) {
        console.warn('[BusinessIdentityInstagram] Failed to close Playwright session after navigation error:', closeError);
      }
      return {
        success: false,
        error:
          navigationError instanceof Error
            ? navigationError.message || 'Failed to navigate to Instagram.'
            : 'Failed to navigate to Instagram.',
      };
    }

    // Create the post
    console.log('[createPostWithPlaywright] Creating Instagram post...', {
      hasImagePath: !!resolvedImagePath,
      hasCaption: !!caption,
      hasStructuredPrompt: !!structuredPrompt,
    });
    
    let generatedContent: GeneratedInstagramContent | undefined;
    try {
      generatedContent = await createInstagramPost(page, {
        imagePath: resolvedImagePath,
        caption,
        structuredPrompt,
        waitAfterShare,
      });
      console.log('[createPostWithPlaywright] Post created successfully, generated content:', !!generatedContent);
    } catch (postError) {
      console.error('[BusinessIdentityInstagram] Failed to create Instagram post (Playwright session):', postError);
      await authSession.close();
      return {
        success: false,
        error:
          postError instanceof Error
            ? postError.message || 'Failed to create Instagram post.'
            : 'Failed to create Instagram post.',
      };
    }

    // Wait a moment for post to be fully processed
    await page.waitForTimeout(2000);

    // Bring page to front briefly so user can see the success
    try {
      await page.bringToFront();
      await page.waitForTimeout(1000);
    } catch (bringError) {
      console.warn('[BusinessIdentityInstagram] Failed to bring Playwright page to front:', bringError);
    }

    console.log('[BusinessIdentityInstagram] Instagram post created successfully via Playwright session. Closing browser...');
    
    // Close the browser after successful post
    try {
      await authSession.close();
      console.log('[BusinessIdentityInstagram] Browser closed successfully');
    } catch (closeError) {
      console.warn('[BusinessIdentityInstagram] Failed to close browser after successful post:', closeError);
    }

    return {
      success: true,
      automation: 'playwright',
      generatedContent,
    };
  } catch (sessionError) {
    console.error('[BusinessIdentityInstagram] Failed to open authenticated Playwright session:', sessionError);
    return {
      success: false,
      error:
        sessionError instanceof Error
          ? sessionError.message || 'Failed to open authenticated Instagram session.'
          : 'Failed to open authenticated Instagram session.',
    };
  }
}

/**
 * Create post using Chrome profile
 */
async function createPostWithChromeProfile(options: {
  profilePath: string;
  profileDirectory?: string;
  profileRoot?: string;
  loginOptions?: { username: string; password: string };
  targetUrl: string;
  resolvedImagePath: string;
  caption?: string;
  structuredPrompt?: InstagramContentPlan;
  waitAfterShare: number;
}): Promise<BusinessIdentityInstagramPostResult> {
  const {
    profilePath,
    profileDirectory,
    profileRoot,
    loginOptions,
    targetUrl,
    resolvedImagePath,
    caption,
    structuredPrompt,
    waitAfterShare,
  } = options;

  const resolvedProfilePath = path.resolve(profilePath);
  const resolvedRootPath =
    profileRoot && typeof profileRoot === 'string' && profileRoot.trim()
      ? path.resolve(profileRoot)
      : path.dirname(resolvedProfilePath);
  const profileDirName = (profileDirectory && profileDirectory.trim()) || path.basename(resolvedProfilePath);

  if (!fs.existsSync(resolvedRootPath)) {
    return {
      success: false,
      error: `Profile root does not exist: ${resolvedRootPath}`,
    };
  }

  const targetProfileDirPath = path.join(resolvedRootPath, profileDirName);
  if (!fs.existsSync(targetProfileDirPath)) {
    return {
      success: false,
      error: `Profile directory does not exist: ${targetProfileDirPath}`,
    };
  }

  const { chromium } = require('playwright');
  console.log(
    `[BusinessIdentityInstagram] Opening Instagram with profile: ${targetProfileDirPath} (root: ${resolvedRootPath})`
  );

  // Launch Chrome with profile
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: [`--profile-directory=${profileDirName}`],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();
  await waitForPageReady(page, 3000);

  // Perform login if credentials provided
  if (loginOptions) {
    console.log('[BusinessIdentityInstagram] Performing automated login inside Chrome session.');
    try {
      await loginWithPage(page, loginOptions);
    } catch (loginError) {
      console.error('[BusinessIdentityInstagram] Automated login failed:', loginError);
      await browser.close();
      return {
        success: false,
        error:
          loginError instanceof Error
            ? loginError.message || 'Failed to log in to Instagram.'
            : 'Failed to log in to Instagram.',
      };
    }
  }

  // Navigate to Instagram
  console.log('[BusinessIdentityInstagram] Navigating to', targetUrl);
  try {
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  } catch (navigationError) {
    console.error('[BusinessIdentityInstagram] Navigation failed:', navigationError);
    await browser.close();
    return {
      success: false,
      error:
        navigationError instanceof Error
          ? navigationError.message || 'Failed to navigate to Instagram.'
          : 'Failed to navigate to Instagram.',
    };
  }

  // Create the post
  console.log('[createPostWithChromeProfile] Creating Instagram post...', {
    hasImagePath: !!resolvedImagePath,
    hasCaption: !!caption,
    hasStructuredPrompt: !!structuredPrompt,
  });
  
  let generatedContent: GeneratedInstagramContent | undefined;
  try {
    generatedContent = await createInstagramPost(page, {
      imagePath: resolvedImagePath,
      caption,
      structuredPrompt,
      waitAfterShare,
    });
    console.log('[createPostWithChromeProfile] Post created successfully, generated content:', !!generatedContent);
  } catch (postError) {
    console.error('[BusinessIdentityInstagram] Failed to create Instagram post (Chrome session):', postError);
    await browser.close();
    return {
      success: false,
      error:
        postError instanceof Error
          ? postError.message || 'Failed to create Instagram post.'
          : 'Failed to create Instagram post.',
    };
  }

  // Wait a moment for post to be fully processed
  await page.waitForTimeout(2000);

  // Bring page to front briefly so user can see the success
  try {
    await page.bringToFront();
    await page.waitForTimeout(1000);
  } catch (bringError) {
    console.warn('[BusinessIdentityInstagram] Failed to bring page to front:', bringError);
  }

  console.log('[BusinessIdentityInstagram] Instagram post created successfully. Closing browser...');
  
  // Close the browser after successful post
  try {
    await browser.close();
    console.log('[BusinessIdentityInstagram] Browser closed successfully');
  } catch (closeError) {
    console.warn('[BusinessIdentityInstagram] Failed to close browser after successful post:', closeError);
  }

  return {
    success: true,
    automation: loginOptions ? 'chrome-automation' : 'chrome-profile',
    generatedContent,
  };
}

/**
 * Wait for page to be ready
 */
async function waitForPageReady(page: Page, maxWaitMs = 5000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const url = page.url();
      if (url && url !== 'about:blank' && url !== '') {
        return;
      }
    } catch (error) {
      // Page might not be ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

