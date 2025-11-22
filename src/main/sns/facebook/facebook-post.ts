import { Page } from "playwright";

export interface FacebookPostOptions {
  imagePath?: string;
  text?: string;
  waitAfterPost?: number; // milliseconds to wait after clicking Post
}

/**
 * Facebook post upload function using Playwright
 * Note: Facebook interface may vary by language, but selectors use common patterns.
 */
export async function createFacebookPost(
  page: Page,
  options: FacebookPostOptions
): Promise<void> {
  const { imagePath, text, waitAfterPost = 10000 } = options;

  console.log('[createFacebookPost] Starting Facebook post creation...');
  console.log('[createFacebookPost] Has image:', !!imagePath);
  console.log('[createFacebookPost] Has text:', !!text);

  // Navigate to Facebook
  const facebookUrl = 'https://www.facebook.com/';
  console.log('[createFacebookPost] Navigating to Facebook...');
  
  try {
    await page.goto(facebookUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  } catch (error) {
    console.error('[createFacebookPost] Failed to navigate to Facebook:', error);
    throw new Error('Failed to navigate to Facebook. Please check your internet connection.');
  }

  // Wait for page to fully load and React to render
  console.log('[createFacebookPost] Waiting for page to load...');
  await page.waitForTimeout(3000);
  
  // Check if we're actually logged in (not on login page)
  const currentUrl = page.url();
  if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
    await takeDebugScreenshot(page, 'facebook_not_logged_in');
    throw new Error('Not logged in to Facebook. Please log in first or check your credentials.');
  }
  
  // Wait for Facebook's React app to fully render
  console.log('[createFacebookPost] Waiting for Facebook UI to render...');
  try {
    // Wait for common Facebook elements to appear
    await page.waitForSelector('div[role="main"], div[data-pagelet], div[aria-label*="What\'s on your mind"]', {
      timeout: 15000,
    }).catch(() => {
      console.warn('[createFacebookPost] Main content selector not found, continuing...');
    });
  } catch (e) {
    console.warn('[createFacebookPost] Could not wait for main content, continuing...');
  }
  
  await page.waitForTimeout(2000);
  
  // Scroll to top to ensure we're at the home feed
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  // Try to find and click "Create Post" button first if it exists
  console.log('[createFacebookPost] Checking for Create Post button...');
  const createPostButtonSelectors = [
    "div[aria-label*='Create post']",
    "div[aria-label*='Create Post']",
    "span:has-text('Create post')",
    "span:has-text('Create Post')",
    "div[role='button']:has-text('Create post')",
    "div[role='button']:has-text('Create Post')",
  ];

  for (const selector of createPostButtonSelectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.count() > 0 && await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`[createFacebookPost] Found Create Post button, clicking...`);
        await button.click();
        await page.waitForTimeout(2000); // Wait for composer to open
        break;
      }
    } catch (e) {
      // Continue
    }
  }

  // Find the "What's on your mind?" text area or create post button
  console.log('[createFacebookPost] Looking for post creation area...');
  
  // More comprehensive selectors for Facebook's reactive UI
  const postAreaSelectors = [
    // Data testid selectors (most reliable)
    "div[data-testid='status-attachment-mentions-input']",
    "div[data-testid='post_message']",
    "div[data-testid='composer']",
    
    // Contenteditable divs with role textbox
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true'][data-testid]",
    "div[contenteditable='true'][aria-label]",
    "div[contenteditable='true']",
    
    // Aria-label based selectors
    "div[aria-label*=\"What's on your mind\"]",
    "div[aria-label*=\"What's on your mind?\"]",
    "div[aria-label*=\"What are you thinking?\"]",
    "div[aria-label*='Write something']",
    "div[aria-label*='Create a post']",
    
    // Placeholder based selectors
    "div[placeholder*=\"What's on your mind\"]",
    "div[placeholder*=\"What are you thinking?\"]",
    
    // Textarea fallbacks
    "textarea[placeholder*=\"What's on your mind\"]",
    "textarea[placeholder*=\"What are you thinking?\"]",
    "textarea[data-testid='status-attachment-mentions-input']",
    
    // Generic contenteditable in composer area
    "div[role='textbox'][contenteditable='true']",
    "div[role='textbox']",
  ];

  let postArea = null;
  let usedSelector = '';
  let maxWaitTime = 10000; // Wait up to 10 seconds for the post area to appear
  const startTime = Date.now();

  // Keep trying to find the post area as Facebook's React UI loads
  while (!postArea && (Date.now() - startTime < maxWaitTime)) {
    for (const selector of postAreaSelectors) {
      try {
        const element = page.locator(selector).first();
        const count = await element.count();
        if (count > 0) {
          const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
          if (isVisible) {
            // Additional check: make sure it's actually the post composer
            const ariaLabel = await element.getAttribute('aria-label').catch(() => '');
            const dataTestId = await element.getAttribute('data-testid').catch(() => '');
            const contentEditable = await element.getAttribute('contenteditable').catch(() => '');
            
            // If it has relevant attributes, it's likely the post area
            if (ariaLabel || dataTestId || contentEditable === 'true') {
              postArea = element;
              usedSelector = selector;
              console.log(`[createFacebookPost] Found post area with selector: ${selector}`);
              console.log(`[createFacebookPost] Attributes - aria-label: ${ariaLabel}, data-testid: ${dataTestId}, contenteditable: ${contentEditable}`);
              break;
            }
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!postArea) {
      await page.waitForTimeout(1000);
      // Try scrolling a bit to trigger lazy loading
      await page.evaluate(() => window.scrollBy(0, 100));
      await page.waitForTimeout(500);
    }
  }

  if (!postArea) {
    // Try one more time with a broader search
    console.log('[createFacebookPost] Trying broader search for post area...');
    
    // First, try to find the main feed/composer container
    const mainContainerSelectors = [
      'div[role="main"]',
      'div[data-pagelet]',
      'div[data-testid="feed"]',
      'div[data-testid="composer"]',
    ];
    
    let mainContainer = null;
    for (const selector of mainContainerSelectors) {
      try {
        const container = page.locator(selector).first();
        if (await container.count() > 0) {
          mainContainer = container;
          console.log(`[createFacebookPost] Found main container: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Search within main container or entire page
    const searchScope = mainContainer || page;
    const allContentEditable = searchScope.locator("div[contenteditable='true']");
    const count = await allContentEditable.count();
    console.log(`[createFacebookPost] Found ${count} contenteditable divs on page`);
    
    if (count > 0) {
      // Try the first few contenteditable divs
      for (let i = 0; i < Math.min(count, 10); i++) {
        try {
          const element = allContentEditable.nth(i);
          const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
          if (isVisible) {
            const boundingBox = await element.boundingBox().catch(() => null);
            // Check if it's in the visible area and seems like a text input
            // Post composer is usually wider and taller than other contenteditable elements
            if (boundingBox && boundingBox.height > 20 && boundingBox.width > 200) {
              // Additional check: see if it's near the top of the page (where composer usually is)
              if (boundingBox.y < 500) {
                postArea = element;
                usedSelector = `div[contenteditable='true']:nth-of-type(${i + 1})`;
                console.log(`[createFacebookPost] Found post area using fallback selector (index ${i})`);
                console.log(`[createFacebookPost] Bounding box: x=${boundingBox.x}, y=${boundingBox.y}, width=${boundingBox.width}, height=${boundingBox.height}`);
                break;
              }
            }
          }
        } catch (e) {
          // Continue
        }
      }
    }
    
    // If still not found, log page structure for debugging
    if (!postArea) {
      console.log('[createFacebookPost] Post area still not found. Logging page structure...');
      try {
        const pageStructure = await page.evaluate(() => {
          const contentEditables = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
          return contentEditables.map((el, i) => ({
            index: i,
            tagName: el.tagName,
            ariaLabel: el.getAttribute('aria-label') || '',
            dataTestId: el.getAttribute('data-testid') || '',
            role: el.getAttribute('role') || '',
            placeholder: el.getAttribute('placeholder') || '',
            className: el.className || '',
            boundingRect: el.getBoundingClientRect(),
          }));
        });
        console.log('[createFacebookPost] Contenteditable elements found:', JSON.stringify(pageStructure, null, 2));
      } catch (e) {
        console.warn('[createFacebookPost] Could not log page structure:', e);
      }
    }
  }

  if (!postArea) {
    await takeDebugScreenshot(page, 'facebook_no_post_area');
    throw new Error('Could not find Facebook post creation area. Please make sure you are logged in and on the home page.');
  }

  // Click on the post area to focus it
  console.log(`[createFacebookPost] Clicking post area (selector: ${usedSelector})`);
  try {
    await postArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await postArea.click({ force: true });
    await page.waitForTimeout(1000);
  } catch (e) {
    console.warn('[createFacebookPost] Click failed, trying alternative method:', e);
    // Try using keyboard focus
    await postArea.focus();
    await page.waitForTimeout(500);
  }

  // Type the text if provided
  if (text && text.trim()) {
    console.log('[createFacebookPost] Typing post text...');
    try {
      // For contenteditable divs, use type() instead of fill()
      const tagName = await postArea.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
      if (tagName === 'div' || tagName === 'span') {
        // Clear any existing text first
        await postArea.evaluate((el) => {
          el.textContent = '';
          el.innerText = '';
        });
        await page.waitForTimeout(200);
        // Type the text character by character for contenteditable divs
        await postArea.type(text, { delay: 50 });
      } else {
        await postArea.fill(text);
      }
      await page.waitForTimeout(500);
    } catch (e) {
      console.warn('[createFacebookPost] Failed to type text, trying alternative:', e);
      // Fallback: use keyboard typing
      await postArea.focus();
      await page.keyboard.type(text, { delay: 50 });
      await page.waitForTimeout(500);
    }
    
    // Check for dialog after typing (it might appear)
    await dismissFacebookDialogs(page);
  }

  // Upload image if provided
  if (imagePath) {
    // First, check for and dismiss any Facebook dialogs/modals that might be blocking
    console.log('[createFacebookPost] Checking for Facebook dialogs to dismiss...');
    await dismissFacebookDialogs(page);
    
    console.log('[createFacebookPost] Looking for photo/video button...');
    
    // Look for photo/video upload button
    const photoButtonSelectors = [
      "div[aria-label*='Photo']",
      "div[aria-label*='photo']",
      "div[aria-label*='Photo/video']",
      "div[aria-label*='Add Photo']",
      "span:has-text('Photo')",
      "span:has-text('Photo/video')",
      "[data-testid='media-attachment-button']",
      "input[type='file'][accept*='image']",
    ];

    let photoButton = null;
    for (const selector of photoButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.count() > 0 && await button.isVisible({ timeout: 2000 }).catch(() => false)) {
          photoButton = button;
          console.log(`[createFacebookPost] Found photo button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (photoButton) {
      // Check if it's a file input or a button
      const tagName = await photoButton.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
      if (tagName === 'input') {
        console.log('[createFacebookPost] Found file input, uploading image...');
        await photoButton.setInputFiles(imagePath);
      } else {
        console.log('[createFacebookPost] Clicking photo button...');
        
        // Check for dialog again before clicking (it might have appeared)
        await dismissFacebookDialogs(page);
        
        try {
          // Try normal click first
          await photoButton.click({ force: true, timeout: 10000 });
        } catch (e) {
          console.warn('[createFacebookPost] Normal click failed, trying JavaScript click:', e);
          // Fallback: use JavaScript click
          await photoButton.evaluate((el: any) => {
            if (el && typeof el.click === 'function') {
              el.click();
            } else if (el && el.dispatchEvent) {
              const event = new MouseEvent('click', { bubbles: true, cancelable: true });
              el.dispatchEvent(event);
            }
          });
        }
        await page.waitForTimeout(1000);
        
        // Check if dialog appeared after clicking photo button
        await dismissFacebookDialogs(page);

        // Look for file input after clicking
        const fileInput = page.locator("input[type='file']").first();
        if (await fileInput.count() > 0) {
          console.log('[createFacebookPost] Found file input after clicking, uploading image...');
          await fileInput.setInputFiles(imagePath);
        } else {
          throw new Error('Could not find file input after clicking photo button');
        }
      }
      await page.waitForTimeout(2000); // Wait for image to upload
    } else {
      // Try to find file input directly
      const fileInput = page.locator("input[type='file']").first();
      if (await fileInput.count() > 0) {
        console.log('[createFacebookPost] Found file input directly, uploading image...');
        await fileInput.setInputFiles(imagePath);
        await page.waitForTimeout(2000);
      } else {
        console.warn('[createFacebookPost] Could not find photo upload button, continuing without image');
      }
    }
  }

  // Wait a bit for the Post button to appear after typing
  await page.waitForTimeout(1000);

  // Click the Post button
  console.log('[createFacebookPost] Looking for Post button...');
  
  const postButtonSelectors = [
    // Data testid selectors (most reliable)
    "[data-testid='react-composer-post-button']",
    "[data-testid='composer-post-button']",
    "div[data-testid='react-composer-post-button']",
    
    // Aria-label based
    "div[aria-label='Post']",
    "div[aria-label='post']",
    "button[aria-label='Post']",
    "button[aria-label='post']",
    
    // Text-based (case insensitive)
    "button:has-text('Post')",
    "button:has-text('POST')",
    "div[role='button']:has-text('Post')",
    "div[role='button']:has-text('POST')",
    "span:has-text('Post')",
    
    // Generic button in composer area
    "div[role='button'][tabindex='0']",
    "div[role='button']",
  ];

  let postButton = null;
  let maxButtonWaitTime = 10000;
  const buttonStartTime = Date.now();

  // Keep trying to find the Post button as it may appear after typing
  while (!postButton && (Date.now() - buttonStartTime < maxButtonWaitTime)) {
    for (const selector of postButtonSelectors) {
      try {
        const button = page.locator(selector).first();
        const count = await button.count();
        if (count > 0) {
          const isVisible = await button.isVisible({ timeout: 2000 }).catch(() => false);
          if (isVisible) {
            // Check if it's enabled
            const isDisabled = await button.isDisabled().catch(() => false);
            if (!isDisabled) {
              postButton = button;
              console.log(`[createFacebookPost] Found Post button with selector: ${selector}`);
              break;
            }
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!postButton) {
      await page.waitForTimeout(500);
    }
  }

  if (!postButton) {
    await takeDebugScreenshot(page, 'facebook_no_post_button');
    throw new Error('Could not find Facebook "Post" button. Please check if all required fields are filled.');
  }

  console.log('[createFacebookPost] Clicking Post button...');
  try {
    await postButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await postButton.click({ force: true });
  } catch (e) {
    console.warn('[createFacebookPost] Click failed, trying alternative:', e);
    // Try using Enter key as fallback
    await postArea.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  }

  // Wait for the post to be published
  console.log('[createFacebookPost] Waiting for post to be published...');
  
  try {
    const maxWaitTime = Math.min(waitAfterPost, 30000); // Cap at 30 seconds
    const startTime = Date.now();
    
    let postPublished = false;
    
    while (Date.now() - startTime < maxWaitTime && !postPublished) {
      try {
        // Check for success indicators (post area disappears, success message, etc.)
        const postAreaStillVisible = await postArea.isVisible({ timeout: 1000 }).catch(() => false);
        if (!postAreaStillVisible) {
          postPublished = true;
          console.log('[createFacebookPost] Post area disappeared - post likely published');
          break;
        }
        
        // Check for success messages
        const successMessages = [
          'text=Your post has been shared',
          'text=Post shared',
          'text=Posted',
        ];
        
        for (const msgSelector of successMessages) {
          const count = await page.locator(msgSelector).count().catch(() => 0);
          if (count > 0) {
            postPublished = true;
            console.log('[createFacebookPost] Detected success message');
            break;
          }
        }
      } catch (e) {
        // Continue polling
      }
      
      await page.waitForTimeout(1000); // Poll every second
    }
    
    // Additional wait to ensure post is fully processed
    await page.waitForTimeout(2000);
    
    if (postPublished) {
      console.log('[createFacebookPost] Post published successfully');
    } else {
      console.log('[createFacebookPost] Post upload completed (timeout reached)');
    }
  } catch (error) {
    console.warn('[createFacebookPost] Could not confirm post success, but continuing:', error);
    await page.waitForTimeout(3000);
  }
}

/**
 * Dismiss Facebook dialogs/modals that might appear
 * Handles dialogs like "Post and reel default audience merge dialog"
 */
async function dismissFacebookDialogs(page: Page): Promise<void> {
  try {
    // Wait a moment for any dialogs to appear
    await page.waitForTimeout(1000);

    // Look for dialog close buttons
    const closeButtonSelectors = [
      // Close button (X)
      "div[aria-label='Close']",
      "div[aria-label='close']",
      "button[aria-label='Close']",
      "button[aria-label='close']",
      "div[role='button'][aria-label='Close']",
      "div[role='button'][aria-label='close']",
      
      // Continue/Next buttons
      "div[aria-label='Continue']",
      "div[aria-label='continue']",
      "button:has-text('Continue')",
      "button:has-text('CONTINUE')",
      "div[role='button']:has-text('Continue')",
      
      // Got it / OK buttons
      "button:has-text('Got it')",
      "button:has-text('Got It')",
      "button:has-text('OK')",
      "div[role='button']:has-text('Got it')",
      
      // Not now / Skip buttons
      "button:has-text('Not now')",
      "button:has-text('Not Now')",
      "button:has-text('Skip')",
      "div[role='button']:has-text('Not now')",
      
      // Generic close in dialog
      "div[role='dialog'] button[aria-label*='Close']",
      "div[role='dialog'] div[aria-label*='Close']",
      "div[role='dialog'] div[role='button']:last-child",
    ];

    // Check for dialog presence by looking for common dialog indicators
    const dialogIndicators = [
      'div[role="dialog"]',
      'div[aria-modal="true"]',
      'div[data-testid*="dialog"]',
      'div[data-testid*="modal"]',
    ];

    let dialogFound = false;
    let isAudienceDialog = false;
    
    for (const indicator of dialogIndicators) {
      try {
        const dialog = page.locator(indicator).first();
        if (await dialog.count() > 0 && await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
          dialogFound = true;
          console.log(`[dismissFacebookDialogs] Found dialog with indicator: ${indicator}`);
          
          // Check if this dialog contains audience selection text
          const dialogTexts = [
            'Who can see your future posts',
            'Choose who can see this',
            'Update settings',
          ];
          
          for (const text of dialogTexts) {
            try {
              const textElement = dialog.locator(`text=${text}`).first();
              if (await textElement.count() > 0) {
                isAudienceDialog = true;
                console.log(`[dismissFacebookDialogs] Detected audience dialog with text: ${text}`);
                break;
              }
            } catch (e) {
              // Continue
            }
          }
          
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    // Also check for specific dialog text content if not found yet
    if (!dialogFound) {
      const dialogTexts = [
        'Choose who can see this',
        'Who can see your future posts',
        'Post and reel default audience',
        'All video posts are now reels',
        'Reels will now share',
        'Don\'t worry about length',
        'Update settings',
      ];

      for (const text of dialogTexts) {
        try {
          const element = page.locator(`text=${text}`).first();
          if (await element.count() > 0 && await element.isVisible({ timeout: 1000 }).catch(() => false)) {
            dialogFound = true;
            // Check if this is the audience selection dialog
            if (text.includes('Who can see') || text.includes('Choose who can see') || text.includes('Update settings')) {
              isAudienceDialog = true;
            }
            console.log(`[dismissFacebookDialogs] Found dialog with text: ${text}`);
            break;
          }
        } catch (e) {
          // Continue
        }
      }
    }

    if (dialogFound) {
      console.log('[dismissFacebookDialogs] Attempting to dismiss dialog...');
      
      // If this is the audience selection dialog, first select "Public"
      if (isAudienceDialog) {
        console.log('[dismissFacebookDialogs] Detected audience selection dialog, selecting Public...');
        try {
          const dialog = page.locator('div[role="dialog"], div[aria-modal="true"]').first();
          if (await dialog.count() > 0) {
            // Wait a bit for the dialog to fully render
            await page.waitForTimeout(1000);
            
            // First, log all elements in the dialog for debugging
            try {
              const allElements = await dialog.evaluate((dialogEl) => {
                const elements: any[] = [];
                const walker = document.createTreeWalker(
                  dialogEl as any,
                  NodeFilter.SHOW_ELEMENT,
                  null
                );
                let node;
                while (node = walker.nextNode()) {
                  const el = node as HTMLElement;
                  const text = el.textContent?.trim() || '';
                  if (text && (text.toLowerCase().includes('public') || text.toLowerCase().includes('friends') || text.toLowerCase().includes('only me'))) {
                    elements.push({
                      tagName: el.tagName,
                      text: text.substring(0, 50),
                      role: el.getAttribute('role'),
                      ariaLabel: el.getAttribute('aria-label') || '',
                      dataTestId: el.getAttribute('data-testid') || '',
                      className: el.className || '',
                    });
                  }
                }
                return elements;
              });
              console.log('[dismissFacebookDialogs] Found elements with audience-related text:', JSON.stringify(allElements, null, 2));
            } catch (e) {
              console.warn('[dismissFacebookDialogs] Could not log dialog elements:', e);
            }
            
            // Look for "Public" option using multiple strategies
            const publicSelectors = [
              // Direct text matches
              "div:has-text('Public')",
              "span:has-text('Public')",
              "button:has-text('Public')",
              "div[role='button']:has-text('Public')",
              "div[role='radio']:has-text('Public')",
              
              // Aria-label matches
              "div[aria-label*='Public']",
              "button[aria-label*='Public']",
              "div[role='button'][aria-label*='Public']",
              
              // Data-testid matches
              "div[data-testid*='public']",
              "button[data-testid*='public']",
              
              // More specific patterns
              "div[role='button'] >> text=Public",
              "div[role='radio'] >> text=Public",
            ];
            
            let publicSelected = false;
            
            // Strategy 1: Try direct selectors
            for (const selector of publicSelectors) {
              try {
                const publicOption = dialog.locator(selector).first();
                const count = await publicOption.count();
                if (count > 0) {
                  const isVisible = await publicOption.isVisible({ timeout: 2000 }).catch(() => false);
                  if (isVisible) {
                    console.log(`[dismissFacebookDialogs] Found Public option with selector: ${selector}`);
                    // Scroll into view
                    await publicOption.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(300);
                    await publicOption.click({ force: true, timeout: 5000 }).catch(() => {
                      publicOption.evaluate((el: any) => {
                        if (el.click) el.click();
                        else if (el.dispatchEvent) {
                          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                        }
                      }).catch(() => {});
                    });
                    await page.waitForTimeout(1500);
                    publicSelected = true;
                    break;
                  }
                }
              } catch (e) {
                // Continue to next selector
              }
            }
            
            // Strategy 2: Find all clickable elements and check their text content
            if (!publicSelected) {
              console.warn('[dismissFacebookDialogs] Direct selectors failed, searching all clickable elements...');
              const allClickable = dialog.locator('div[role="button"], div[role="radio"], button, div[tabindex], span[role="button"]');
              const clickableCount = await allClickable.count();
              console.log(`[dismissFacebookDialogs] Found ${clickableCount} clickable elements in dialog`);
              
              for (let i = 0; i < clickableCount; i++) {
                try {
                  const element = allClickable.nth(i);
                  const isVisible = await element.isVisible({ timeout: 500 }).catch(() => false);
                  if (!isVisible) continue;
                  
                  // Get text content (including nested text)
                  const text = await element.textContent().catch(() => '');
                  const innerText = await element.evaluate((el: any) => el.innerText || el.textContent || '').catch(() => '');
                  const ariaLabel = await element.getAttribute('aria-label').catch(() => '');
                  
                  const combinedText = `${text} ${innerText} ${ariaLabel}`.toLowerCase();
                  
                  if (combinedText.includes('public') && !combinedText.includes('friends') && !combinedText.includes('only me')) {
                    console.log(`[dismissFacebookDialogs] Found Public option at index ${i}: text="${text?.substring(0, 50)}", aria-label="${ariaLabel}"`);
                    await element.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(300);
                    await element.click({ force: true, timeout: 5000 }).catch(() => {
                      element.evaluate((el: any) => {
                        if (el.click) el.click();
                        else if (el.dispatchEvent) {
                          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                        }
                      }).catch(() => {});
                    });
                    await page.waitForTimeout(1500);
                    publicSelected = true;
                    break;
                  }
                } catch (e) {
                  // Continue
                }
              }
            }
            
            // Strategy 3: Use JavaScript to find and click Public option
            if (!publicSelected) {
              console.warn('[dismissFacebookDialogs] Trying JavaScript-based search...');
              try {
                const clicked = await dialog.evaluate((dialogEl) => {
                  // Find all elements with "Public" text within the dialog
                  const allElements = Array.from(dialogEl.querySelectorAll('*'));
                  for (const el of allElements) {
                    const text = (el.textContent || (el as any).innerText || '').toLowerCase().trim();
                    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                    
                    if ((text === 'public' || ariaLabel.includes('public')) && 
                        !text.includes('friends') && 
                        !text.includes('only me')) {
                      // Check if it's clickable
                      const isClickable = el.getAttribute('role') === 'button' || 
                                        el.getAttribute('role') === 'radio' ||
                                        el.tagName === 'BUTTON' ||
                                        el.getAttribute('tabindex') !== null;
                      
                      if (isClickable || el.closest('[role="button"], [role="radio"]')) {
                        const clickableEl = el.closest('[role="button"], [role="radio"]') || el;
                        if (clickableEl && typeof (clickableEl as any).click === 'function') {
                          (clickableEl as any).click();
                          return true;
                        }
                      }
                    }
                  }
                  return false;
                });
                
                if (clicked) {
                  console.log('[dismissFacebookDialogs] Public option clicked via JavaScript');
                  await page.waitForTimeout(1500);
                  publicSelected = true;
                }
              } catch (e) {
                console.warn('[dismissFacebookDialogs] JavaScript search failed:', e);
              }
            }
            
            if (publicSelected) {
              console.log('[dismissFacebookDialogs] Public option selected successfully');
            } else {
              console.warn('[dismissFacebookDialogs] Could not select Public option, will try to continue anyway');
              // Take a screenshot for debugging
              await takeDebugScreenshot(page, 'facebook_audience_dialog_no_public');
            }
          }
        } catch (e) {
          console.warn('[dismissFacebookDialogs] Error selecting Public option:', e);
        }
      }
      
      // Try clicking close buttons
      for (const selector of closeButtonSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.count() > 0) {
            const isVisible = await button.isVisible({ timeout: 1000 }).catch(() => false);
            if (isVisible) {
              console.log(`[dismissFacebookDialogs] Found close button: ${selector}`);
              await button.click({ force: true, timeout: 5000 }).catch(() => {
                // Try JavaScript click as fallback
                button.evaluate((el: any) => el.click()).catch(() => {});
              });
              await page.waitForTimeout(1500);
              // Verify dialog is actually gone
              const stillVisible = await button.isVisible({ timeout: 500 }).catch(() => false);
              if (!stillVisible) {
                console.log('[dismissFacebookDialogs] Dialog dismissed successfully');
                return;
              }
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      // Try pressing ESC key
      console.log('[dismissFacebookDialogs] Trying ESC key...');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);

      // Try clicking outside the dialog (click on backdrop)
      try {
        const dialog = page.locator('div[role="dialog"], div[aria-modal="true"]').first();
        if (await dialog.count() > 0) {
          // Click on the backdrop (usually the parent or a sibling element)
          const backdrop = page.locator('div[role="dialog"] ~ div, div[aria-modal="true"] ~ div').first();
          if (await backdrop.count() > 0) {
            await backdrop.click({ force: true, position: { x: 10, y: 10 } }).catch(() => {});
            await page.waitForTimeout(1000);
          }
        }
      } catch (e) {
        // Continue
      }

      // Try finding and clicking buttons in the dialog by text content
      try {
        const dialog = page.locator('div[role="dialog"], div[aria-modal="true"]').first();
        if (await dialog.count() > 0) {
          // First, try to find buttons with specific text
          const buttonTexts = ['Continue', 'Got it', 'OK', 'Next', 'Done', 'Close'];
          let buttonClicked = false;
          
          for (const buttonText of buttonTexts) {
            try {
              const button = dialog.locator(`button:has-text('${buttonText}'), div[role='button']:has-text('${buttonText}')`).first();
              if (await button.count() > 0) {
                const isVisible = await button.isVisible({ timeout: 1000 }).catch(() => false);
                if (isVisible) {
                  console.log(`[dismissFacebookDialogs] Found button with text: ${buttonText}`);
                  await button.click({ force: true, timeout: 5000 }).catch(() => {
                    button.evaluate((el: any) => el.click()).catch(() => {});
                  });
                  await page.waitForTimeout(1500);
                  // Verify dialog is gone
                  const dialogStillVisible = await dialog.isVisible({ timeout: 500 }).catch(() => false);
                  if (!dialogStillVisible) {
                    console.log('[dismissFacebookDialogs] Dialog dismissed successfully');
                    return;
                  }
                  buttonClicked = true;
                  break;
                }
              }
            } catch (e) {
              // Continue to next text
            }
          }
          
          // If no specific button found, try the last button (usually the primary action)
          if (!buttonClicked) {
            const buttons = dialog.locator('button, div[role="button"]');
            const buttonCount = await buttons.count();
            if (buttonCount > 0) {
              // Try the last button (usually the primary action)
              const lastButton = buttons.nth(buttonCount - 1);
              console.log(`[dismissFacebookDialogs] Trying to click last button in dialog (${buttonCount} buttons found)`);
              await lastButton.click({ force: true, timeout: 5000 }).catch(() => {
                lastButton.evaluate((el: any) => el.click()).catch(() => {});
              });
              await page.waitForTimeout(1000);
            }
          }
        }
      } catch (e) {
        console.warn('[dismissFacebookDialogs] Could not click dialog button:', e);
      }
    } else {
      console.log('[dismissFacebookDialogs] No dialog found, continuing...');
    }
  } catch (error) {
    console.warn('[dismissFacebookDialogs] Error dismissing dialogs:', error);
    // Continue anyway - dialog might not be present
  }
}

async function takeDebugScreenshot(page: Page, prefix: string): Promise<void> {
  try {
    const { app } = require('electron');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    const tempDir = app?.getPath?.('temp') || os.tmpdir();
    const screenshotDir = path.join(tempDir, 'egdesk-facebook-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const screenshotPath = path.join(screenshotDir, `${prefix}_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[createFacebookPost] Debug screenshot saved to: ${screenshotPath}`);
  } catch (e) {
    console.error('[createFacebookPost] Could not take screenshot:', e);
  }
}

