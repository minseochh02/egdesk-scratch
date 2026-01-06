import { Page } from 'playwright-core';
import {
  generateYouTubeContent,
  GeneratedYouTubeContent,
  YouTubeContentPlan,
} from "./generate-youtube-content";
import {
  generateYouTubeShortVideo,
  YouTubeVideoGenerationOptions,
} from "./generate-youtube-video";

export interface YouTubePostOptions {
  videoPath?: string; // Optional - will generate video if not provided and structuredPrompt is available
  title?: string;
  description?: string;
  tags?: string[];
  structuredPrompt?: YouTubeContentPlan;
  visibility?: 'public' | 'unlisted' | 'private';
  waitAfterPublish?: number; // milliseconds to wait after clicking Publish
  /** Generate a short video if videoPath is not provided */
  generateVideo?: boolean;
  /** Video generation options */
  videoGenerationOptions?: YouTubeVideoGenerationOptions;
}

export type { YouTubeContentPlan, GeneratedYouTubeContent } from "./generate-youtube-content";

/**
 * YouTube video upload function using Playwright
 * Note: YouTube Studio interface may vary by language, but selectors use common patterns.
 */
export async function createYouTubePost(
  page: Page,
  options: YouTubePostOptions
): Promise<GeneratedYouTubeContent | undefined> {
  const { visibility = 'public', waitAfterPublish = 30000, generateVideo = false } = options;
  const { title, description, tags, generated } = await resolveVideoMetadata(options);

  // Generate video if videoPath is not provided and generateVideo is true
  let videoPath = options.videoPath;
  if (!videoPath && (generateVideo || options.structuredPrompt)) {
    console.log('[createYouTubePost] Generating short video...');
    try {
      // Convert script to string if it's an object
      let scriptText: string;
      if (generated?.script) {
        if (typeof generated.script === 'string') {
          scriptText = generated.script;
        } else {
          // If script is an object, convert to string
          const scriptObj = generated.script as any;
          scriptText = [
            scriptObj.hook,
            scriptObj.intro,
            Array.isArray(scriptObj.body) ? scriptObj.body.join(' ') : scriptObj.body,
            scriptObj.outro,
            scriptObj.cta,
          ].filter(Boolean).join(' ');
        }
      } else {
        scriptText = description || title || 'YouTube Short';
      }
      
      videoPath = await generateYouTubeShortVideo({
        script: scriptText,
        title: title || 'New Video',
        duration: 7, // 7 seconds for short-style video
        ...options.videoGenerationOptions,
      });
      console.log('[createYouTubePost] Video generated:', videoPath);
    } catch (error) {
      console.error('[createYouTubePost] Failed to generate video:', error);
      throw new Error(`Failed to generate video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (!videoPath) {
    throw new Error('videoPath is required. Either provide videoPath or enable generateVideo with structuredPrompt.');
  }

  console.log('[createYouTubePost] Starting YouTube video upload...');
  console.log('[createYouTubePost] Video path:', videoPath);
  console.log('[createYouTubePost] Title:', title);
  console.log('[createYouTubePost] Visibility:', visibility);

  // Navigate to YouTube Studio first to get the channel ID, then go to upload page
  console.log('[createYouTubePost] Navigating to YouTube Studio to get channel info...');
  
  try {
    // Reduced delay for bundled apps (performance optimization)
    await page.waitForTimeout(500);
    
    // First, go to YouTube Studio home to get channel context
    await page.goto('https://studio.youtube.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000, // Reduced from 60000 for faster failure detection
    });
    
    // Reduced wait for page to load
    await page.waitForTimeout(1000);
    
    // Try to extract channel ID from the current URL or page
    let channelId: string | null = null;
    try {
      const currentUrl = page.url();
      const channelMatch = currentUrl.match(/\/channel\/([^\/\?]+)/);
      if (channelMatch) {
        channelId = channelMatch[1];
        console.log(`[createYouTubePost] Found channel ID from URL: ${channelId}`);
      } else {
        // Try to find channel ID in the page content
        const channelIdFromPage = await page.evaluate(() => {
          // Look for channel ID in various places
          const metaChannel = document.querySelector('meta[property="og:url"]')?.getAttribute('content');
          if (metaChannel) {
            const match = metaChannel.match(/\/channel\/([^\/\?]+)/);
            if (match) return match[1];
          }
          
          // Look in data attributes
          const channelElement = document.querySelector('[data-channel-id]');
          if (channelElement) {
            return channelElement.getAttribute('data-channel-id');
          }
          
          // Look in script tags
          const scripts = Array.from(document.querySelectorAll('script'));
          for (const script of scripts) {
            const content = script.textContent || '';
            const match = content.match(/channelId["\']?\s*[:=]\s*["\']([^"\']+)["\']/);
            if (match) return match[1];
          }
          
          return null;
        }).catch(() => null);
        
        if (channelIdFromPage) {
          channelId = channelIdFromPage;
          console.log(`[createYouTubePost] Found channel ID from page: ${channelId}`);
        }
      }
    } catch (error) {
      console.warn('[createYouTubePost] Could not extract channel ID:', error);
    }
    
    // Build the correct upload URL
    let uploadUrl: string;
    if (channelId) {
      // Use the channel-specific upload URL
      uploadUrl = `https://studio.youtube.com/channel/${channelId}/videos/upload?d=ud&filter=%5B%5D&sort=%7B%22columnType%22%3A%22date%22%2C%22sortOrder%22%3A%22DESCENDING%22%7D`;
      console.log(`[createYouTubePost] Using channel-specific upload URL: ${uploadUrl}`);
    } else {
      // Fallback to generic upload URL
      uploadUrl = 'https://studio.youtube.com/video/upload';
      console.log('[createYouTubePost] Channel ID not found, using generic upload URL');
    }
    
    // Navigate to the upload page (reduced delays for bundled apps)
    await page.waitForTimeout(300);
    await page.goto(uploadUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000, // Reduced from 60000 for faster failure detection
    });
    
    // Reduced wait for page to load
    await page.waitForTimeout(1000);
    
    // Check if we need to handle any dialogs or continue buttons
    console.log('[createYouTubePost] Checking for dialogs or continue buttons...');
    const continueButtonSelectors = [
      'button:has-text("계속")', // Korean: Continue
      'button:has-text("Continue")',
      'button:has-text("CONTINUE")',
      'button:has-text("다음")', // Korean: Next
      'button[aria-label*="Continue"]',
      'button[aria-label*="계속"]',
    ];

    for (const selector of continueButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible({ timeout: 2000 }).catch(() => false);
          if (isVisible) {
            console.log(`[createYouTubePost] Found Continue button, clicking...`);
            await button.click();
            await page.waitForTimeout(2000);
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }
  } catch (error) {
    console.error('[createYouTubePost] Failed to navigate to YouTube Studio upload page:', error);
    // Fallback: try navigating to home first
    console.log('[createYouTubePost] Trying fallback: navigate to YouTube Studio home first...');
    try {
      await page.goto('https://studio.youtube.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2000);
    } catch (fallbackError) {
      throw new Error('Failed to navigate to YouTube Studio. Please check your internet connection.');
    }
  }

  // Click the "Create" button to open upload menu (exact selector from GitHub: ytcp-button#create-icon)
  console.log('[createYouTubePost] Looking for Create button...');
  
  const createButtonSelectors = [
    "ytcp-button#create-icon", // Exact from GitHub
    "button#create-icon",
    "button[aria-label='Create']",
    "button:has-text('Create')",
    "yt-button-shape button:has-text('Create')",
    "button[aria-label*='Create']",
    "yt-icon-button[aria-label='Create']",
  ];

  let createButton = null;
  let usedSelector = '';

  for (const selector of createButtonSelectors) {
    try {
      const button = page.locator(selector).first();
      const count = await button.count();
      if (count > 0) {
        const isVisible = await button.isVisible({ timeout: 3000 }).catch(() => false);
        if (isVisible) {
          createButton = button;
          usedSelector = selector;
          console.log(`[createYouTubePost] Found Create button with selector: ${selector}`);
          break;
        }
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  if (!createButton) {
    // If we're already on the upload page, continue
    const currentUrl = page.url();
    if (currentUrl.includes('/videos/upload') || currentUrl.includes('/video/upload') || currentUrl.includes('/upload')) {
      console.log('[createYouTubePost] Already on upload page, continuing...');
      console.log(`[createYouTubePost] Current URL: ${currentUrl}`);
      // Add small delay to mimic human reading the page
      await page.waitForTimeout(1000 + Math.random() * 1000);
    } else {
      // Try navigating directly to upload page with channel ID
      console.log('[createYouTubePost] Create button not found, trying to get channel ID and navigate to upload URL...');
      try {
        // Try to extract channel ID from current page
        let channelId: string | null = null;
        const currentUrl = page.url();
        const channelMatch = currentUrl.match(/\/channel\/([^\/\?]+)/);
        if (channelMatch) {
          channelId = channelMatch[1];
        }
        
          // Reduced delay for bundled apps
          await page.waitForTimeout(300);
          
          let uploadUrl: string;
          if (channelId) {
            uploadUrl = `https://studio.youtube.com/channel/${channelId}/videos/upload?d=ud&filter=%5B%5D&sort=%7B%22columnType%22%3A%22date%22%2C%22sortOrder%22%3A%22DESCENDING%22%7D`;
            console.log(`[createYouTubePost] Using channel-specific upload URL: ${uploadUrl}`);
          } else {
            uploadUrl = 'https://studio.youtube.com/video/upload';
            console.log('[createYouTubePost] Channel ID not found, using generic upload URL');
          }
          
          await page.goto(uploadUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000, // Reduced from 60000
          });
          await page.waitForTimeout(1000);
        
        // Handle any continue buttons again after navigation
        const continueButtonSelectors = [
          'button:has-text("계속")',
          'button:has-text("Continue")',
          'button[aria-label*="Continue"]',
        ];
        for (const selector of continueButtonSelectors) {
          try {
            const button = page.locator(selector).first();
            if (await button.count() > 0 && await button.isVisible({ timeout: 2000 }).catch(() => false)) {
              console.log(`[createYouTubePost] Clicking Continue button after navigation...`);
              await button.click();
              await page.waitForTimeout(2000);
              break;
            }
          } catch (e) {
            // Continue
          }
        }
      } catch (directNavError) {
        console.error('[createYouTubePost] Direct navigation also failed:', directNavError);
        await takeDebugScreenshot(page, 'youtube_no_create_button');
        throw new Error('Could not find YouTube "Create" button or navigate to upload page. YouTube UI may have changed.');
      }
    }
    } else {
      console.log(`[createYouTubePost] Clicking Create button (selector: ${usedSelector})`);
      // Reduced delays for bundled apps
      await page.waitForTimeout(200);
      await createButton.click();
      await page.waitForTimeout(500);

    // Click "Upload video" from the dropdown menu (exact selector from GitHub: //tp-yt-paper-item[@test-id="upload-beta"])
    const uploadVideoSelectors = [
      'tp-yt-paper-item[test-id="upload-beta"]', // Exact from GitHub (converted to CSS)
      'tp-yt-paper-item[test-id*="upload"]',
      "yt-button-shape:has-text('Upload video')",
      "button:has-text('Upload video')",
      "a:has-text('Upload video')",
      "[aria-label='Upload video']",
      "yt-button-shape:has-text('Upload videos')",
    ];

    let uploadVideoButton = null;
    for (const selector of uploadVideoSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0 && await button.isVisible({ timeout: 3000 }).catch(() => false)) {
          uploadVideoButton = button;
          console.log(`[createYouTubePost] Found Upload video button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }

          if (uploadVideoButton) {
            await uploadVideoButton.click();
            await page.waitForTimeout(1000); // Reduced from 2000
          } else {
            console.log('[createYouTubePost] Upload video button not found in menu, assuming already on upload page');
          }
  }

  // Wait for file input to be available
  console.log('[createYouTubePost] Waiting for file input...');
  
  // Reduced wait for bundled apps
  await page.waitForTimeout(1000);
  
  // YouTube uses a file input for video upload
  // Try multiple strategies to find or trigger the file input
  let fileInput = null;
  
  // Strategy 1: Look for file input directly
  const fileInputSelectors = [
    'input[type="file"]',
    'input[accept*="video"]',
    'input[accept*="video/mp4"]',
    'input[accept*="video/*"]',
    '#select-files-button input',
    'input[type="file"][accept]',
  ];

  for (const selector of fileInputSelectors) {
    try {
      const input = page.locator(selector).first();
      if (await input.count() > 0) {
        const isVisible = await input.isVisible({ timeout: 2000 }).catch(() => false);
        // File inputs are often hidden but still functional
        fileInput = input;
        console.log(`[createYouTubePost] Found file input with selector: ${selector}`);
        break;
      }
    } catch (e) {
      // Continue
    }
  }

  // Strategy 2: Try clicking "Select files" button (in multiple languages)
  if (!fileInput || (await fileInput.count()) === 0) {
    console.log('[createYouTubePost] File input not found directly, trying to click Select files button...');
    const selectFilesButtonSelectors = [
      'button:has-text("Select files")',
      'button:has-text("SELECT FILES")',
      'button:has-text("파일 선택")', // Korean: Select files
      'button[aria-label*="Select"]',
      'button[aria-label*="파일"]', // Korean: file
      'ytcp-button-shape:has-text("Select files")',
      'ytcp-button-shape:has-text("파일 선택")',
      '#select-files-button',
      'button[id*="select"]',
      'button[id*="upload"]',
    ];

    for (const selector of selectFilesButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0) {
          const isVisible = await button.isVisible({ timeout: 2000 }).catch(() => false);
          if (isVisible) {
            console.log(`[createYouTubePost] Found Select files button with selector: ${selector}, clicking...`);
            await button.click();
            await page.waitForTimeout(2000);
            
            // Try to find file input after clicking
            fileInput = page.locator('input[type="file"]').first();
            if (await fileInput.count() > 0) {
              console.log('[createYouTubePost] File input appeared after clicking Select files button');
              break;
            }
          }
        }
      } catch (e) {
        // Continue
      }
    }
  }

  // Strategy 3: Try using JavaScript to trigger file input
  if (!fileInput || (await fileInput.count()) === 0) {
    console.log('[createYouTubePost] Trying to find file input via JavaScript...');
    try {
      // Use JavaScript to find hidden file inputs
      const fileInputFound = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="file"]');
        return inputs.length > 0;
      });
      
      if (fileInputFound) {
        fileInput = page.locator('input[type="file"]').first();
        console.log('[createYouTubePost] Found file input via JavaScript');
      }
    } catch (e) {
      console.warn('[createYouTubePost] JavaScript search failed:', e);
    }
  }

  // Final check
  if (!fileInput || (await fileInput.count()) === 0) {
    await takeDebugScreenshot(page, 'youtube_no_file_input');
    console.error('[createYouTubePost] Current URL:', page.url());
    console.error('[createYouTubePost] Page title:', await page.title().catch(() => 'Unknown'));
    throw new Error('Could not find YouTube file input. YouTube upload UI may have changed. Please check the screenshot for details.');
  }

  // Upload the video file
  console.log('[createYouTubePost] Uploading video file...');
  try {
    // Wait a moment before setting file to ensure UI is ready
    await page.waitForTimeout(1000);
    
    // Set the file input
    await fileInput.setInputFiles(videoPath);
    console.log('[createYouTubePost] Video file selected');
    
    // Wait for upload to actually start (YouTube shows upload progress)
    // This prevents the modal from getting stuck in "greyed out" state
    console.log('[createYouTubePost] Waiting for upload to start...');
    let uploadStarted = false;
    const uploadStartTimeout = 30000; // 30 seconds to start upload
    const uploadStartTime = Date.now();
    
    while (Date.now() - uploadStartTime < uploadStartTimeout && !uploadStarted) {
      try {
        // Check for upload progress indicators (means upload has started)
        const progressIndicators = [
          'span.progress-label',
          '[class*="progress"]',
          'text=Uploading',
          'text=업로드 중', // Korean: Uploading
          'text=Upload',
          'text=업로드', // Korean: Upload
        ];
        
        for (const selector of progressIndicators) {
          const element = page.locator(selector).first();
          if (await element.count() > 0) {
            const text = await element.textContent().catch(() => '');
            if (text && (text.toLowerCase().includes('upload') || text.includes('업로드'))) {
              uploadStarted = true;
              console.log('[createYouTubePost] Upload started - progress indicator found:', text);
              break;
            }
          }
        }
        
        // Also check if modal is no longer greyed out (check for enabled inputs)
        const titleInput = page.locator('ytcp-video-title input, ytcp-video-title textarea, ytcp-video-title div[contenteditable]').first();
        if (await titleInput.count() > 0) {
          const isEnabled = await titleInput.isEnabled().catch(() => false);
          if (isEnabled) {
            uploadStarted = true;
            console.log('[createYouTubePost] Upload started - form fields are enabled');
            break;
          }
        }
        
        // Check if "링크 생성 중..." (Link generating...) appears (this means upload is processing)
        const linkGenerating = page.locator('text=링크 생성 중, text=Link generating, text=Generating link').first();
        if (await linkGenerating.count() > 0) {
          uploadStarted = true;
          console.log('[createYouTubePost] Upload started - link generation detected');
          break;
        }
        
      } catch (e) {
        // Continue checking
      }
      
      if (!uploadStarted) {
        await page.waitForTimeout(2000); // Check every 2 seconds
      }
    }
    
    if (!uploadStarted) {
      console.warn('[createYouTubePost] Upload may not have started, but continuing to wait for completion...');
    }
    
  } catch (error) {
    console.error('[createYouTubePost] Failed to set video file:', error);
    throw new Error(`Failed to upload video file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Wait for video to be completely uploaded before continuing
  console.log('[createYouTubePost] Waiting for video upload to complete...');
  
  try {
    // Wait for upload progress indicators
    const uploadProgressSelectors = [
      'span.progress-label',
      '[class*="progress"]',
      '[class*="upload"]',
      'text=Uploading',
      'text=업로드 중', // Korean: Uploading
      'text=Processing',
      'text=처리 중', // Korean: Processing
    ];

    let uploadComplete = false;
    const maxUploadTime = 600000; // 10 minutes max for upload
    const startTime = Date.now();
    let lastProgress = '';

    while (Date.now() - startTime < maxUploadTime && !uploadComplete) {
      try {
        // Check for upload progress text
        for (const selector of uploadProgressSelectors) {
          const element = page.locator(selector).first();
          if (await element.count() > 0) {
            const text = (await element.textContent().catch(() => null)) || '';
            const lowerText = text.toLowerCase();
            
            // Check if upload is complete
            if (lowerText.includes('100%') || 
                lowerText.includes('완료') || // Korean: Complete
                lowerText.includes('complete') ||
                lowerText.includes('finished') ||
                lowerText.includes('업로드 완료') || // Korean: Upload complete
                (lowerText.includes('processing') && !lowerText.includes('uploading'))) {
              console.log(`[createYouTubePost] Upload progress: ${text}`);
              
              // If it says complete/finished/processing (not uploading), we can proceed
              if (lowerText.includes('완료') || 
                  lowerText.includes('complete') || 
                  lowerText.includes('finished') ||
                  (lowerText.includes('processing') && !lowerText.includes('uploading'))) {
                uploadComplete = true;
                console.log('[createYouTubePost] Video upload completed');
                break;
              }
            } else if (text && text !== lastProgress) {
              console.log(`[createYouTubePost] Upload progress: ${text}`);
              lastProgress = text;
            }
          }
        }

        // Check if modal is stuck in "링크 생성 중..." (Link generating...) state
        // If stuck for too long, it might indicate an issue
        const linkGenerating = page.locator('text=링크 생성 중, text=Link generating, text=Generating link').first();
        const isLinkGenerating = await linkGenerating.count() > 0;
        
        if (isLinkGenerating) {
          const elapsedTime = Date.now() - startTime;
          // If stuck in "link generating" for more than 2 minutes, might be an issue
          if (elapsedTime > 120000) {
            console.warn('[createYouTubePost] Stuck in "link generating" state for over 2 minutes, but continuing to wait...');
          }
        }

        // Check for YouTube video URL link - this appears when upload is complete and video is processed
        // This is the most reliable indicator that the video is ready for form filling
        const videoUrlLink = page.locator('a.style-scope.ytcp-video-info, a[href*="youtu.be"], a[href*="youtube.com/watch"]').first();
        if (await videoUrlLink.count() > 0) {
          const isVisible = await videoUrlLink.isVisible({ timeout: 2000 }).catch(() => false);
          if (isVisible) {
            // Verify it contains a YouTube URL
            try {
              const href = await videoUrlLink.getAttribute('href').catch(() => '');
              if (href && (href.includes('youtu.be') || href.includes('youtube.com/watch'))) {
                uploadComplete = true;
                console.log('[createYouTubePost] YouTube video URL link appeared - upload and processing complete:', href);
                break;
              }
            } catch (e) {
              // Continue checking
            }
          }
        }
        
        // Also check if "링크 생성 중..." has disappeared and been replaced with actual link
        // This means link generation completed
        if (isLinkGenerating) {
          // Check if link generating text is gone and URL link appeared
          const linkGeneratingVisible = await linkGenerating.isVisible({ timeout: 1000 }).catch(() => false);
          if (!linkGeneratingVisible && await videoUrlLink.count() > 0) {
            uploadComplete = true;
            console.log('[createYouTubePost] Link generation completed - URL link appeared');
            break;
          }
        }

        // Also check if the title input field is available (indicates upload is complete)
        const titleInputCheck = page.locator('xpath=/html/body/ytcp-uploads-dialog/tp-yt-paper-dialog/div/ytcp-animatable[1]/ytcp-ve/ytcp-video-metadata-editor/div/ytcp-video-metadata-editor-basics/div[1]/ytcp-video-title/div/ytcp-social-suggestions-textbox/ytcp-form-input-container/div[1]/div[2]/div/ytcp-social-suggestion-input/div').first();
        if (await titleInputCheck.count() > 0) {
          const isVisible = await titleInputCheck.isVisible({ timeout: 2000 }).catch(() => false);
          if (isVisible) {
            uploadComplete = true;
            console.log('[createYouTubePost] Title input field appeared - upload likely complete');
            break;
          }
        }

        // Check if we've moved past the upload screen
        const currentUrl = page.url();
        if (!currentUrl.includes('/upload') || currentUrl.includes('/edit')) {
          uploadComplete = true;
          console.log('[createYouTubePost] Navigated away from upload page - upload likely complete');
          break;
        }
      } catch (e) {
        // Continue checking
      }

      if (!uploadComplete) {
        await page.waitForTimeout(3000); // Check every 3 seconds
      }
    }

    if (!uploadComplete) {
      console.warn('[createYouTubePost] Upload timeout reached, but continuing anyway...');
      // Wait a bit more to ensure form is ready
      await page.waitForTimeout(5000);
    } else {
      // Additional wait to ensure form is fully loaded
      await page.waitForTimeout(2000);
      console.log('[createYouTubePost] Video upload completed, proceeding with form filling...');
    }
  } catch (error) {
    console.warn('[createYouTubePost] Could not monitor upload status, but continuing:', error);
    // Wait a bit anyway before proceeding
    await page.waitForTimeout(10000);
  }

  // Wait for the details form to appear (title, description, etc.)
  // YouTube shows this after the video is uploaded and processed
  // First, wait for the YouTube video URL link to appear (most reliable indicator)
  console.log('[createYouTubePost] Waiting for YouTube video URL link (indicates upload complete)...');
  
  try {
    const videoUrlLink = page.locator('a.style-scope.ytcp-video-info, a[href*="youtu.be"], a[href*="youtube.com/watch"]').first();
    await videoUrlLink.waitFor({ state: 'visible', timeout: 600000 }); // 10 minutes max for upload
    
    // Verify it contains a YouTube URL
    const href = await videoUrlLink.getAttribute('href').catch(() => '');
    if (href && (href.includes('youtu.be') || href.includes('youtube.com/watch'))) {
      console.log('[createYouTubePost] ✅ YouTube video URL detected - upload complete:', href);
    } else {
      console.log('[createYouTubePost] Video URL link found but href is invalid, continuing anyway...');
    }
  } catch (error) {
    console.warn('[createYouTubePost] Video URL link not found within timeout, but continuing with form filling...', error);
  }

  console.log('[createYouTubePost] Waiting for video details form...');
  
  const titleInputSelectors = [
    // Exact XPath from user
    'xpath=/html/body/ytcp-uploads-dialog/tp-yt-paper-dialog/div/ytcp-animatable[1]/ytcp-ve/ytcp-video-metadata-editor/div/ytcp-video-metadata-editor-basics/div[1]/ytcp-video-title/div/ytcp-social-suggestions-textbox/ytcp-form-input-container/div[1]/div[2]/div/ytcp-social-suggestion-input/div',
    // Fallback selectors
    'ytcp-social-suggestion-input div',
    'ytcp-video-title ytcp-social-suggestion-input div',
    'ytcp-mention-textbox[label="Title"] div#textbox',
    'ytcp-mention-textbox div#textbox',
  ];

  let titleInput = null;
  let maxWaitTime = 120000; // 2 minutes for title input to appear (after upload is complete)
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime && !titleInput) {
    for (const selector of titleInputSelectors) {
      try {
        const input = page.locator(selector).first();
        if (await input.count() > 0) {
          // Check if it's visible or if it's the first input (might be hidden but functional)
          const isVisible = await input.isVisible({ timeout: 1000 }).catch(() => false);
          const isEnabled = await input.isEnabled().catch(() => false);
          
          // Also check if it's near a title label
          if (isVisible || (isEnabled && selector.includes('title') || selector.includes('제목'))) {
            // For ytcp-mention-textbox, the div#textbox is the actual editable element
            // We need to check if it's the title field
            try {
              // Check parent element for label
              const parentElement = await input.evaluateHandle((el) => {
                return el.closest('ytcp-mention-textbox') || el.closest('ytcp-form-input-container') || el.closest('div');
              }).catch(() => null);
              
              let nearbyText = '';
              if (parentElement) {
                nearbyText = await parentElement.evaluate((el: any) => el?.textContent || '').catch(() => '');
              }
              
              // Also check aria-label and other attributes
              const ariaLabel = await input.getAttribute('aria-label').catch(() => '');
              const id = await input.getAttribute('id').catch(() => '');
              const allText = (nearbyText + ' ' + ariaLabel + ' ' + id).toLowerCase();
              
              const isTitleField = allText.includes('제목') || 
                                   allText.includes('title') ||
                                   selector.includes('title') ||
                                   selector.includes('제목') ||
                                   selector.includes('ytcp-mention-textbox[label="Title"]') ||
                                   selector.includes('ytcp-mention-textbox div#textbox');
              
              if (isTitleField || selector.includes('first-of-type')) {
                titleInput = input;
                console.log(`[createYouTubePost] Found title input with selector: ${selector}`);
                break;
              }
            } catch (e) {
              // If we can't verify, try the input anyway if it's a specific selector
              if (selector.includes('title') || selector.includes('제목') || selector.includes('ytcp-mention-textbox')) {
                titleInput = input;
                console.log(`[createYouTubePost] Found title input with selector: ${selector} (unverified)`);
                break;
              }
            }
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!titleInput) {
      await page.waitForTimeout(2000);
    }
  }

  if (!titleInput) {
    // Last resort: try to find any text input and use the first one
    console.log('[createYouTubePost] Trying last resort: find any text input...');
    try {
      const allInputs = await page.locator('input[type="text"], textarea').all();
      if (allInputs.length > 0) {
        // Check each input to see if it's likely the title field
        for (const input of allInputs) {
          try {
            const ariaLabel = await input.getAttribute('aria-label').catch(() => '');
            const placeholder = await input.getAttribute('placeholder').catch(() => '');
            const id = await input.getAttribute('id').catch(() => '');
            const name = await input.getAttribute('name').catch(() => '');
            
            const text = (ariaLabel + ' ' + placeholder + ' ' + id + ' ' + name).toLowerCase();
            if (text.includes('title') || text.includes('제목') || text.includes('title')) {
              titleInput = input;
              console.log('[createYouTubePost] Found title input via last resort method');
              break;
            }
          } catch (e) {
            // Continue
          }
        }
        
        // If still not found, use the first input as fallback
        if (!titleInput && allInputs.length > 0) {
          titleInput = allInputs[0];
          console.log('[createYouTubePost] Using first text input as fallback for title');
        }
      }
    } catch (e) {
      console.warn('[createYouTubePost] Last resort method failed:', e);
    }
  }

  if (!titleInput) {
    await takeDebugScreenshot(page, 'youtube_no_title_input');
    throw new Error('Could not find title input. Video may still be uploading or YouTube UI may have changed.');
  }

  // Fill in the title (exact method from GitHub: clear() then send_keys())
  console.log('[createYouTubePost] Filling in title...');
  try {
    // Wait for element to be clickable (like their WebDriverWait)
    await titleInput.waitFor({ state: 'visible', timeout: 20000 });
    
    // Scroll to make sure the input is visible
    await titleInput.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    
    // Click to focus the input (important for ytcp-mention-textbox)
    await titleInput.click();
    await page.waitForTimeout(300);
    
    // Clear the input (exact from GitHub: title_input.clear())
    await titleInput.clear();
    await page.waitForTimeout(200);
    
    // Type the title (exact from GitHub: title_input.send_keys(title))
    // Playwright's fill() is equivalent to send_keys()
    await titleInput.fill(title);
    await page.waitForTimeout(500);
    
    console.log(`[createYouTubePost] Title filled successfully: "${title}"`);
  } catch (error) {
    console.error('[createYouTubePost] Error filling title:', error);
    throw new Error(`Failed to fill title: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Fill in the description
  console.log('[createYouTubePost] Filling in description...');
  const descriptionInputSelectors = [
    // Exact XPath from user
    'xpath=/html/body/ytcp-uploads-dialog/tp-yt-paper-dialog/div/ytcp-animatable[1]/ytcp-ve/ytcp-video-metadata-editor/div/ytcp-video-metadata-editor-basics/div[2]/ytcp-video-description/div/ytcp-social-suggestions-textbox/ytcp-form-input-container/div[1]/div[2]/div/ytcp-social-suggestion-input/div',
    // Fallback selectors
    'ytcp-video-description ytcp-social-suggestion-input div',
    'ytcp-social-suggestion-input div',
    'ytcp-mention-textbox[label="Description"] div#textbox',
  ];

  let descriptionInput = null;
  for (const selector of descriptionInputSelectors) {
    try {
      const input = page.locator(selector).first();
      if (await input.count() > 0) {
        const isVisible = await input.isVisible({ timeout: 1000 }).catch(() => false);
        const isEnabled = await input.isEnabled().catch(() => false);
        
        if (isVisible || isEnabled) {
          // Verify it's likely the description field
          try {
            // Check parent element for label (similar to title)
            const parentElement = await input.evaluateHandle((el) => {
              return el.closest('ytcp-mention-textbox') || el.closest('ytcp-form-textarea') || el.closest('div');
            }).catch(() => null);
            
            let nearbyText = '';
            if (parentElement) {
              nearbyText = await parentElement.evaluate((el: any) => el?.textContent || '').catch(() => '');
            }
            
            const ariaLabel = await input.getAttribute('aria-label').catch(() => '');
            const placeholder = await input.getAttribute('placeholder').catch(() => '');
            const id = await input.getAttribute('id').catch(() => '');
            
            const text = (ariaLabel + ' ' + placeholder + ' ' + nearbyText + ' ' + id).toLowerCase();
            const isDescriptionField = text.includes('description') || 
                                      text.includes('설명') ||
                                      selector.includes('description') ||
                                      selector.includes('설명') ||
                                      selector.includes('ytcp-mention-textbox[label="Description"]') ||
                                      selector.includes('ytcp-mention-textbox div#textbox') ||
                                      (selector === 'textarea' && !text.includes('title') && !text.includes('제목'));
            
            if (isDescriptionField) {
              descriptionInput = input;
              console.log(`[createYouTubePost] Found description input with selector: ${selector}`);
              break;
            }
          } catch (e) {
            // If we can't verify but it's a specific selector, use it
            if (selector.includes('description') || selector.includes('설명') || selector.includes('ytcp-mention-textbox') || selector === 'textarea') {
              descriptionInput = input;
              console.log(`[createYouTubePost] Found description input with selector: ${selector} (unverified)`);
              break;
            }
          }
        }
      }
    } catch (e) {
      // Continue
    }
  }
  
  // Last resort: find any textarea or div#textbox that's not the title
  if (!descriptionInput) {
    try {
      // Try finding all ytcp-mention-textbox elements and get the second one (description is usually after title)
      const allMentionTextboxes = await page.locator('ytcp-mention-textbox').all();
      if (allMentionTextboxes.length > 1) {
        // The second one is usually the description
        const descriptionBox = allMentionTextboxes[1];
        const descriptionDiv = descriptionBox.locator('div#textbox').first();
        if (await descriptionDiv.count() > 0) {
          descriptionInput = descriptionDiv;
          console.log('[createYouTubePost] Found description using second ytcp-mention-textbox (fallback)');
        }
      }
      
      // If still not found, try any textarea
      if (!descriptionInput) {
        const allTextareas = await page.locator('textarea').all();
        if (allTextareas.length > 0) {
          // Use the first textarea that's not the title field
          descriptionInput = allTextareas[0];
          console.log('[createYouTubePost] Using first textarea as description input (fallback)');
        }
      }
    } catch (e) {
      console.warn('[createYouTubePost] Could not find description textarea:', e);
    }
  }

  if (descriptionInput) {
    try {
      // Wait for element to be visible (like their WebDriverWait)
      await descriptionInput.waitFor({ state: 'visible', timeout: 20000 });
      
      // Scroll to make sure the input is visible
      await descriptionInput.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      
      // Click to focus the input (important for ytcp-mention-textbox)
      await descriptionInput.click();
      await page.waitForTimeout(300);
      
      // Fill description (exact from GitHub: description_input.send_keys(description))
      // Note: GitHub code doesn't clear description, just sends keys
      await descriptionInput.fill(description || '');
      await page.waitForTimeout(500);
      console.log(`[createYouTubePost] Description filled successfully (${(description || '').length} characters)`);
    } catch (error) {
      console.warn('[createYouTubePost] Error filling description:', error);
    }
  } else {
    console.warn('[createYouTubePost] Could not find description input, skipping');
  }

  // Fill in tags if provided
  if (tags && tags.length > 0) {
    console.log('[createYouTubePost] Filling in tags...');
    const tagsInputSelectors = [
      'input[aria-label*="Tags"]',
      'input[aria-label*="tags"]',
      '#textbox[aria-label*="Tags"]',
      '#textbox[aria-label*="tags"]',
    ];

    let tagsInput = null;
    for (const selector of tagsInputSelectors) {
      try {
        const input = page.locator(selector).first();
        if (await input.count() > 0) {
          tagsInput = input;
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (tagsInput) {
      const tagsString = tags.join(',');
      await tagsInput.fill(tagsString);
      await page.waitForTimeout(500);
    } else {
      console.warn('[createYouTubePost] Could not find tags input, skipping');
    }
  }

  // Click "자동 생성됨" (Auto-generated) for thumbnail (exact XPath from user)
  console.log('[createYouTubePost] Looking for auto-generated thumbnail option...');
  try {
    const thumbnailButton = page.locator('xpath=/html/body/ytcp-uploads-dialog/tp-yt-paper-dialog/div/ytcp-animatable[1]/ytcp-ve/ytcp-video-metadata-editor/div/ytcp-video-metadata-editor-basics/div[3]/ytcp-video-thumbnail-editor/div[3]/ytcp-video-autogenerated-thumbnails-editor/ytcp-thumbnail-editor/div[1]/ytcp-ve/button').first();
    
    if (await thumbnailButton.count() > 0) {
      const isVisible = await thumbnailButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (isVisible) {
        console.log('[createYouTubePost] Clicking auto-generated thumbnail button...');
        await thumbnailButton.click();
        await page.waitForTimeout(2000);
        
        // Wait for thumbnail generation to complete
        // The processing-shimmer element appears while generating and disappears when complete
        console.log('[createYouTubePost] Waiting for thumbnail generation to complete...');
        
        try {
          // Look for the processing-shimmer element
          const processingShimmer = page.locator('div.processing-shimmer.ytcp-still-cell').first();
          
          // Wait for it to appear (indicating generation started)
          const shimmerAppeared = await processingShimmer.count() > 0;
          if (shimmerAppeared) {
            console.log('[createYouTubePost] Thumbnail generation started (processing-shimmer appeared)...');
            
            // Wait for it to disappear (display: none or not visible)
            const maxThumbnailWait = 120000; // 2 minutes max
            const thumbnailStartTime = Date.now();
            let thumbnailComplete = false;
            
            while (Date.now() - thumbnailStartTime < maxThumbnailWait && !thumbnailComplete) {
              try {
                // Check if shimmer is hidden (display: none)
                const isHidden = await processingShimmer.evaluate((el) => {
                  const style = window.getComputedStyle(el);
                  return style.display === 'none' || style.visibility === 'hidden';
                }).catch(() => false);
                
                // Also check if it's not visible
                const isVisible = await processingShimmer.isVisible({ timeout: 1000 }).catch(() => false);
                
                if (isHidden || !isVisible) {
                  thumbnailComplete = true;
                  console.log('[createYouTubePost] Thumbnail generation completed (processing-shimmer disappeared)');
                  break;
                }
              } catch (e) {
                // Continue checking
              }
              
              await page.waitForTimeout(2000); // Check every 2 seconds
            }
            
            if (!thumbnailComplete) {
              console.warn('[createYouTubePost] Thumbnail generation timeout reached, but continuing...');
            } else {
              // Additional wait to ensure thumbnails are fully loaded
              await page.waitForTimeout(1000);
            }
          } else {
            console.log('[createYouTubePost] Processing-shimmer not found, thumbnail may already be generated');
            await page.waitForTimeout(3000); // Wait a bit anyway
          }
        } catch (error) {
          console.warn('[createYouTubePost] Could not monitor thumbnail generation, but continuing:', error);
          await page.waitForTimeout(5000); // Wait a bit anyway
        }
        
        // Click the thumbnail modal's complete button (exact XPath from user)
        console.log('[createYouTubePost] Clicking thumbnail modal complete button...');
        const thumbnailCompleteButton = page.locator('xpath=/html/body/ytcp-video-autogenerated-thumbnails-dialog/ytcp-dialog/tp-yt-paper-dialog/div[3]/div/ytcp-button[2]/ytcp-button-shape/button/yt-touch-feedback-shape/div[2]').first();
        
        if (await thumbnailCompleteButton.count() > 0) {
          const isCompleteVisible = await thumbnailCompleteButton.isVisible({ timeout: 10000 }).catch(() => false);
          if (isCompleteVisible) {
            await thumbnailCompleteButton.click();
            await page.waitForTimeout(2000);
            console.log('[createYouTubePost] Thumbnail modal complete button clicked');
          } else {
            console.warn('[createYouTubePost] Thumbnail complete button not visible');
          }
        } else {
          console.warn('[createYouTubePost] Could not find thumbnail complete button');
        }
      }
    } else {
      console.warn('[createYouTubePost] Could not find auto-generated thumbnail button');
    }
  } catch (error) {
    console.warn('[createYouTubePost] Error clicking auto-generated thumbnail option:', error);
  }

  // Select "아니요, 아동용이 아닙니다" (No, it's not for children) - exact XPath from user
  console.log('[createYouTubePost] Looking for audience/COPPA option...');
  try {
    const kidsRadioButton = page.locator('xpath=/html/body/ytcp-uploads-dialog/tp-yt-paper-dialog/div/ytcp-animatable[1]/ytcp-ve/ytcp-video-metadata-editor/div/ytcp-video-metadata-editor-basics/div[5]/ytkc-made-for-kids-select/div[4]/tp-yt-paper-radio-group/tp-yt-paper-radio-button[2]/div[1]').first();
    
    if (await kidsRadioButton.count() > 0) {
      const isVisible = await kidsRadioButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (isVisible) {
        console.log('[createYouTubePost] Setting "아니요, 아동용이 아닙니다" option...');
        await kidsRadioButton.click();
        await page.waitForTimeout(1000);
      } else {
        // Try waiting for it to become visible
        await kidsRadioButton.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        if (await kidsRadioButton.isVisible().catch(() => false)) {
          await kidsRadioButton.click();
          await page.waitForTimeout(1000);
        }
      }
    } else {
      console.warn('[createYouTubePost] Could not find kids option radio button');
    }
  } catch (error) {
    console.warn('[createYouTubePost] Error selecting audience option:', error);
  }

  // Click Next button (exact XPath from user - appears twice with same path)
  console.log('[createYouTubePost] Clicking Next button (first time)...');
  
  try {
    // Exact XPath from user (step 6)
    const nextButton1 = page.locator('xpath=/html/body/ytcp-uploads-dialog/tp-yt-paper-dialog/div/ytcp-animatable[2]/div/div[2]/ytcp-button[2]/ytcp-button-shape/button/yt-touch-feedback-shape/div[2]').first();
    
    // Wait for button to be visible
    await nextButton1.waitFor({ state: 'visible', timeout: 20000 });
    
    const isEnabled = await nextButton1.isEnabled().catch(() => false);
    if (!isEnabled) {
      console.log('[createYouTubePost] Next button is disabled, waiting...');
      let enabled = false;
      const maxWait = 30000;
      const startTime = Date.now();
      while (Date.now() - startTime < maxWait && !enabled) {
        await page.waitForTimeout(1000);
        enabled = await nextButton1.isEnabled().catch(() => false);
        if (enabled) {
          console.log(`[createYouTubePost] Next button became enabled after ${Date.now() - startTime}ms`);
          break;
        }
      }
      
      if (!enabled) {
        await takeDebugScreenshot(page, 'youtube_next_disabled_step_1');
        throw new Error('Next button still disabled. Required fields may not be filled.');
      }
    }
    
    await nextButton1.click();
    await page.waitForTimeout(2000);
    
    // Click Next button again (step 7 - same path)
    console.log('[createYouTubePost] Clicking Next button (second time)...');
    const nextButton2 = page.locator('xpath=/html/body/ytcp-uploads-dialog/tp-yt-paper-dialog/div/ytcp-animatable[2]/div/div[2]/ytcp-button[2]/ytcp-button-shape/button/yt-touch-feedback-shape/div[2]').first();
    await nextButton2.waitFor({ state: 'visible', timeout: 20000 });
    await nextButton2.click();
    await page.waitForTimeout(2000);
    
    // Click Next button third time (step 7 - same path)
    console.log('[createYouTubePost] Clicking Next button (third time)...');
    const nextButton3 = page.locator('xpath=/html/body/ytcp-uploads-dialog/tp-yt-paper-dialog/div/ytcp-animatable[2]/div/div[2]/ytcp-button[2]/ytcp-button-shape/button/yt-touch-feedback-shape/div[2]').first();
    await nextButton3.waitFor({ state: 'visible', timeout: 20000 });
    await nextButton3.click();
    await page.waitForTimeout(2000);
  } catch (error) {
    console.error('[createYouTubePost] Error clicking Next button:', error);
    await takeDebugScreenshot(page, 'youtube_next_error');
    throw error;
  }

  // Wait for processing to complete (exact from GitHub: _wait_for_processing)
  console.log('[createYouTubePost] Waiting for video processing...');
  try {
    // Exact selector from GitHub: span.progress-label
    const progressLabel = page.locator('span.progress-label').first();
    
    // Wait for progress label to appear
    await progressLabel.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    
    // Pattern from GitHub: (finished processing)|(processing hd.*)|(check.*)
    const pattern = /(finished processing)|(processing hd.*)|(check.*)/i;
    
    let currentProgress = await progressLabel.textContent().catch(() => '') || '';
    let lastProgress: string | null = null;
    
    while (currentProgress && !pattern.test(currentProgress.toLowerCase())) {
      if (lastProgress !== currentProgress) {
        console.log(`[createYouTubePost] Current progress: ${currentProgress}`);
      }
      lastProgress = currentProgress;
      await page.waitForTimeout(5000); // Check every 5 seconds (like their sleep(5))
      currentProgress = (await progressLabel.textContent().catch(() => null)) || '';
      
      // Safety timeout (5 minutes max)
      const processingStartTime = Date.now();
      if (Date.now() - processingStartTime > 300000) {
        console.warn('[createYouTubePost] Processing timeout reached');
        break;
      }
    }
    
    console.log(`[createYouTubePost] Processing completed: ${currentProgress}`);
  } catch (error) {
    console.warn('[createYouTubePost] Could not monitor processing status:', error);
    // Wait a bit anyway
    await page.waitForTimeout(10000);
  }

  // Select "공개" (Public) visibility option (exact XPath from user - step 8)
  console.log(`[createYouTubePost] Setting visibility to ${visibility}...`);
  
  try {
    // Exact XPath from user for Public option
    const publicRadioButton = page.locator('xpath=/html/body/ytcp-uploads-dialog/tp-yt-paper-dialog/div/ytcp-animatable[1]/ytcp-uploads-review/div[2]/div[1]/ytcp-video-visibility-select/div[2]/tp-yt-paper-radio-group/tp-yt-paper-radio-button[3]/div[1]/div[1]').first();
    
    if (await publicRadioButton.count() > 0) {
      const isVisible = await publicRadioButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (isVisible) {
        console.log('[createYouTubePost] Setting visibility to Public...');
        await publicRadioButton.click();
        await page.waitForTimeout(1000);
      } else {
        await publicRadioButton.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        if (await publicRadioButton.isVisible().catch(() => false)) {
          await publicRadioButton.click();
          await page.waitForTimeout(1000);
        }
      }
    } else {
      console.warn('[createYouTubePost] Could not find Public visibility option');
    }
  } catch (error) {
    console.warn('[createYouTubePost] Error setting visibility:', error);
  }

  // Click Next button (exact XPath from user - step 9)
  console.log('[createYouTubePost] Clicking Next button (final step)...');
  
  try {
    // Exact XPath from user (step 9 - different path from step 6/7)
    const finalNextButton = page.locator('xpath=/html/body/ytcp-uploads-dialog/tp-yt-paper-dialog/div/ytcp-animatable[2]/div/div[2]/ytcp-button[3]/ytcp-button-shape/button/yt-touch-feedback-shape/div[2]').first();
    
    await finalNextButton.waitFor({ state: 'visible', timeout: 20000 });
    
    const isEnabled = await finalNextButton.isEnabled().catch(() => false);
    if (!isEnabled) {
      console.log('[createYouTubePost] Final Next button is disabled, waiting...');
      let enabled = false;
      const maxWait = 30000;
      const startTime = Date.now();
      while (Date.now() - startTime < maxWait && !enabled) {
        await page.waitForTimeout(1000);
        enabled = await finalNextButton.isEnabled().catch(() => false);
        if (enabled) break;
      }
      if (!enabled) {
        throw new Error('Final Next button still disabled');
      }
    }
    
    await finalNextButton.click();
    await page.waitForTimeout(2000);
  } catch (error) {
    console.error('[createYouTubePost] Error clicking final Next button:', error);
    throw error;
  }

  // Look for "Done" button (their done-button)
  console.log('[createYouTubePost] Looking for Done button...');
  const doneButtonSelectors = [
    'button#done-button',
    'button:has-text("완료")', // Korean: Done
    'button:has-text("Done")',
    'button:has-text("DONE")',
    'ytcp-button-shape:has-text("완료")',
    'ytcp-button-shape:has-text("Done")',
    '[id*="done"]',
  ];

  let doneButton = null;
  for (const selector of doneButtonSelectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.count() > 0) {
        const isVisible = await button.isVisible({ timeout: 3000 }).catch(() => false);
        if (isVisible) {
          doneButton = button;
          console.log(`[createYouTubePost] Found Done button with selector: ${selector}`);
          break;
        }
      }
    } catch (e) {
      // Continue
    }
  }

  if (doneButton) {
    console.log('[createYouTubePost] Clicking Done button...');
    await doneButton.click();
    await page.waitForTimeout(5000); // Wait for dialog to disappear (like their code)
  } else {
    console.log('[createYouTubePost] Done button not found, upload may have completed already');
  }

  // Final wait for upload/publish to complete
  console.log('[createYouTubePost] Waiting for upload to complete...');
  
  try {
    // Wait for success confirmation or navigation
    const maxWaitTime = Math.min(waitAfterPublish, 120000); // Cap at 2 minutes
    const startTime = Date.now();
    
    let videoPublished = false;
    
    while (Date.now() - startTime < maxWaitTime && !videoPublished) {
      try {
        const currentUrl = page.url();
        // If we navigated away from upload page, video was likely published
        if (!currentUrl.includes('/upload') && (currentUrl.includes('/video/') || currentUrl.includes('/videos/'))) {
          videoPublished = true;
          console.log('[createYouTubePost] Detected navigation away from upload page - video likely published');
          break;
        }
        
        // Check for success messages
        const successMessages = [
          'text=Video published',
          'text=Your video is live',
          'text=Video is being processed',
          'text=동영상이 게시되었습니다', // Korean: Video published
          'text=업로드 완료', // Korean: Upload complete
        ];
        
        for (const msgSelector of successMessages) {
          const count = await page.locator(msgSelector).count().catch(() => 0);
          if (count > 0) {
            videoPublished = true;
            console.log('[createYouTubePost] Detected success message');
            break;
          }
        }
      } catch (e) {
        // Continue polling
      }
      
      await page.waitForTimeout(2000); // Poll every 2 seconds
    }
    
    // Additional wait to ensure video is fully processed
    await page.waitForTimeout(3000);
    
    if (videoPublished) {
      console.log('[createYouTubePost] Video published successfully');
    } else {
      console.log('[createYouTubePost] Video upload completed (timeout reached, may still be processing)');
    }
  } catch (error) {
    console.warn('[createYouTubePost] Could not confirm video publish success, but continuing:', error);
    await page.waitForTimeout(5000);
  }

  return generated;
}

async function resolveVideoMetadata(
  options: YouTubePostOptions
): Promise<{ 
  title: string; 
  description: string; 
  tags: string[]; 
  generated?: GeneratedYouTubeContent 
}> {
  console.log('[resolveVideoMetadata] Resolving video metadata...');
  console.log('[resolveVideoMetadata] Has title:', !!options.title);
  console.log('[resolveVideoMetadata] Has description:', !!options.description);
  console.log('[resolveVideoMetadata] Has tags:', !!options.tags);
  console.log('[resolveVideoMetadata] Has structuredPrompt:', !!options.structuredPrompt);
  
  // If we have a structured prompt, generate content
  if (options.structuredPrompt) {
    console.log('[resolveVideoMetadata] Calling generateYouTubeContent with structuredPrompt...');
    const generated = await generateYouTubeContent(options.structuredPrompt);
    console.log('[resolveVideoMetadata] Generated content:', {
      hasTitle: !!generated.title,
      hasDescription: !!generated.description,
      hasTags: !!generated.tags,
    });
    
    return {
      title: options.title || generated.title || 'Untitled Video',
      description: options.description || generated.description || '',
      tags: options.tags || generated.tags || [],
      generated,
    };
  }

  // Otherwise use provided values or defaults
  return {
    title: options.title || 'Untitled Video',
    description: options.description || '',
    tags: options.tags || [],
  };
}

async function takeDebugScreenshot(page: Page, prefix: string): Promise<void> {
  try {
    const { app } = require('electron');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const tempDir = app?.getPath?.('temp') || os.tmpdir();
    const screenshotDir = path.join(tempDir, 'egdesk-youtube-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const screenshotPath = path.join(screenshotDir, `${prefix}_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[createYouTubePost] Debug screenshot saved to: ${screenshotPath}`);
  } catch (e) {
    console.error('[createYouTubePost] Could not take screenshot:', e);
  }
}

