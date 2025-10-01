// browser-controller.ts
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { clipboard } from 'electron';
import path from 'path';

export interface NaverBlogSettings {
  username: string;
  password: string;
  proxyUrl?: string;
}

export interface BlogContent {
  title: string;
  content: string;
  tags: string;
}

export interface BrowserControllerResult {
  success: boolean;
  error?: string;
  imageGenerated?: boolean;
}

/**
 * Build proxy configuration from URL
 */
function buildProxyOption(proxyUrl?: string) {
  try {
    if (!proxyUrl) return undefined;
    const u = new URL(String(proxyUrl));
    const server = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
    const proxy: any = { server };
    if (u.username) proxy.username = decodeURIComponent(u.username);
    if (u.password) proxy.password = decodeURIComponent(u.password);
    return proxy;
  } catch {
    return undefined;
  }
}

/**
 * Launch browser with Chrome preference and fallback
 */
async function launchBrowser(proxyUrl?: string): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const proxy = buildProxyOption(proxyUrl);
  
  try {
    // Try to use system Chrome first
    const browser = await chromium.launch({ 
      headless: false,
      channel: 'chrome',  // Uses system Chrome
      proxy
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    return { browser, context, page };
  } catch (error) {
    if (error instanceof Error && error.message.includes('channel')) {
      // Fallback if Chrome isn't installed
      console.log('Chrome not found, using default Chromium');
      const browser = await chromium.launch({ 
        headless: false,
        proxy
      });
      const context = await browser.newContext();
      const page = await context.newPage();
      return { browser, context, page };
    }
    throw error;
  }
}

/**
 * Handle Naver login process
 */
async function handleNaverLogin(page: Page, username: string, password: string): Promise<boolean> {
  try {
    console.log('[NAVER] Starting Naver login process...');
    await page.goto('https://nid.naver.com/nidlogin.login');
    
    if (username) await page.fill('input#id, input[name="id"]', String(username));
    if (password) await page.fill('input#pw, input[name="pw"]', String(password));
    
    const loginButtonSelector = 'button[type="submit"], input[type="submit"], button#log.login';
    if (username && password) {
      await page.click(loginButtonSelector).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      
      // Navigate to Naver Blog home after login
      const targetUrl = 'https://section.blog.naver.com/BlogHome.naver?directoryNo=0&currentPage=1&groupId=0';
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      
      console.log('[NAVER] Login process completed');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[NAVER] Login failed:', error);
    return false;
  }
}

/**
 * Open Naver Blog write page in new window
 */
async function openBlogWritePage(context: BrowserContext, page: Page): Promise<Page | null> {
  try {
    console.log('[NAVER] Opening blog write page...');
    const writeSelector = 'a[href="https://blog.naver.com/GoBlogWrite.naver"]';
    await page.waitForSelector(writeSelector, { timeout: 15000 }).catch(() => {});
    
    const [newPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 15000 }),
      page.click(writeSelector)
    ]);
    
    await newPage.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    console.log('[NAVER] Blog write page opened successfully');
    return newPage;
  } catch (error) {
    console.error('[NAVER] Failed to open blog write page:', error);
    return null;
  }
}

/**
 * Handle various popups that may appear on the blog write page
 */
async function handlePopups(pageOrFrame: any, newPage: Page): Promise<void> {
  try {
    console.log('[NAVER] Handling popups...');
    
    // Draft popup handling
    try {
      console.log('[NAVER] Checking for draft popup...');
      const confirmBtn = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]/div[2]/div[3]/button[2]');
      const cancelBtn = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]/div[2]/div[3]/button[1]');
      
      if (await confirmBtn.count() > 0) {
        console.log('[NAVER] Draft popup found - clicking confirm');
        await confirmBtn.click({ timeout: 3000 }).catch(() => {});
        await newPage.waitForTimeout(1000);
      } else if (await cancelBtn.count() > 0) {
        console.log('[NAVER] Draft popup found - clicking cancel');
        await cancelBtn.click({ timeout: 3000 }).catch(() => {});
        await newPage.waitForTimeout(1000);
      }
    } catch (error) {
      console.log('[NAVER] Error handling draft popup:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Naver Blog confirmation popup
    try {
      console.log('[NAVER] Checking for confirmation popup...');
      await newPage.waitForTimeout(2000);
      
      const popupSelectors = [
        '.se-popup-alert-confirm',
        '.se-popup-alert', 
        '.se-popup',
        '[data-group="popupLayer"]',
        '.se-popup-dim'
      ];
      
      let popupFound = false;
      
      for (const selector of popupSelectors) {
        const popup = pageOrFrame.locator(selector);
        if (await popup.count() > 0) {
          console.log(`[NAVER] Found popup with selector: ${selector}`);
          popupFound = true;
          
          try {
            await popup.waitFor({ state: 'visible', timeout: 3000 });
            await newPage.waitForTimeout(1000);
            
            const buttons = pageOrFrame.locator(`${selector} button, ${selector} .btn, ${selector} [role="button"]`);
            if (await buttons.count() > 0) {
              console.log('[NAVER] Clicking popup button');
              await buttons.first().click({ timeout: 3000 }).catch(() => {});
              await newPage.waitForTimeout(1000);
            } else {
              await newPage.keyboard.press('Escape');
              await newPage.waitForTimeout(1000);
            }
            break;
          } catch (waitError) {
            await newPage.keyboard.press('Escape');
            await newPage.waitForTimeout(1000);
            break;
          }
        }
      }
      
      if (!popupFound) {
        console.log('[NAVER] No popup found - proceeding normally');
      }
    } catch (error) {
      console.log('[NAVER] Error handling confirmation popup:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Right side popup close
    try {
      const rightCloseBtn = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/article/div/header/button');
      if (await rightCloseBtn.count()) {
        await rightCloseBtn.click({ timeout: 3000 }).catch(() => {});
        console.log('[NAVER] Right-side popup closed');
      }
    } catch {}

    // Help panel close
    try {
      const helpSelector = 'button.se-help-panel-close-button, .se-help-panel-close-button';
      let closed = false;
      const helpBtn = pageOrFrame.locator(helpSelector);
      if (await helpBtn.count()) {
        await helpBtn.first().click({ timeout: 2000 }).catch(() => {});
        closed = true;
      }
      if (!closed) {
        for (const frame of newPage.frames()) {
          try {
            const frameBtn = await frame.$(helpSelector);
            if (frameBtn) {
              await frameBtn.click({ timeout: 2000 }).catch(() => {});
              closed = true;
              break;
            }
          } catch {}
        }
      }
    } catch {}
    
    console.log('[NAVER] Popup handling completed');
  } catch (error) {
    console.error('[NAVER] Error in popup handling:', error);
  }
}


/**
 * Fill blog post content (title, content, tags)
 */
async function fillBlogContent(pageOrFrame: any, newPage: Page, content: BlogContent): Promise<void> {
  try {
    console.log('[NAVER] Filling blog content...');
    
    // XPath selectors
    const title_field_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[1]/div[1]/div/div/p/span[2]';
    const content_field_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p';

    // Fill title
    try {
      console.log('[NAVER] Filling title:', content.title);
      const titleField = pageOrFrame.locator(title_field_xpath);
      if (await titleField.count()) {
        await titleField.click({ timeout: 10000 });
        await newPage.keyboard.press('Control+a');
        await newPage.waitForTimeout(200);
        await newPage.keyboard.type(content.title);
        console.log('[NAVER] Title filled successfully');
      }
    } catch (e) {
      console.warn('[NAVER] Title fill failed:', e);
    }

    // Fill content
    try {
      console.log('[NAVER] Filling content');
      const contentField = pageOrFrame.locator(content_field_xpath);
      if (await contentField.count()) {
        await contentField.click({ timeout: 20000 });
        await newPage.keyboard.press('Control+a');
        await newPage.waitForTimeout(200);
        await newPage.keyboard.type(content.content);
        await newPage.keyboard.press('Enter');
        await newPage.keyboard.type(content.tags);
        console.log('[NAVER] Content and tags filled successfully');
      }
    } catch (e) {
      console.warn('[NAVER] Content fill failed:', e);
    }
    
    console.log('[NAVER] Blog content filling completed');
  } catch (error) {
    console.error('[NAVER] Error filling blog content:', error);
  }
}

/**
 * Publish the blog post
 */
async function publishBlogPost(pageOrFrame: any, newPage: Page): Promise<boolean> {
  try {
    console.log('[NAVER] Publishing blog post...');
    
    // Ensure help panel is closed before publishing
    try {
      const help_panel_close_xpath = 'xpath=/html/body/div[1]/div[1]/div[3]/div/div/div[1]/div/div[1]/article/div/header/button';
      const explicitClose = pageOrFrame.locator(help_panel_close_xpath);
      if (await explicitClose.count()) {
        await explicitClose.click({ timeout: 2000 }).catch(() => {});
        console.log('[NAVER] Help panel closed before publishing');
      }
    } catch {}

    // Two-step publish process: First click initial button, then final publish button
    const initialPublishSelectors = [
      'xpath=/html/body/div[1]/div/div[1]/div/div[3]/div[2]/button', // First button to click
      'button:has-text("발행")', // Korean "Publish"
      'button:has-text("Publish")', // English "Publish"
      'button[type="submit"]', // Submit button
      'button:has-text("완료")', // Korean "Complete"
      'button:has-text("저장")', // Korean "Save"
      '[data-testid*="publish"]', // Test ID containing publish
      '[aria-label*="publish"]', // Aria label containing publish
      'button[class*="publish"]', // Class containing publish
      'button[class*="submit"]' // Class containing submit
    ];
    
    const finalPublishSelectors = [
      'xpath=/html/body/div[1]/div/div[1]/div/div[3]/div[2]/div/div/div/div[8]/div/button', // Final publish button
      'xpath=/html/body/div[1]/div/div[1]/div//div[3]/div[2]/button', // Alternative final selector
      'button:has-text("발행")', // Korean "Publish"
      'button:has-text("Publish")', // English "Publish"
      'button[type="submit"]', // Submit button
      'button:has-text("완료")', // Korean "Complete"
      'button:has-text("저장")', // Korean "Save"
    ];
    
    let publishButtonFound = false;
    
    // Step 1: Try to click the initial publish button
    console.log('[NAVER] Step 1: Looking for initial publish button...');
    let initialButtonClicked = false;
    
    for (const selector of initialPublishSelectors) {
      try {
        console.log(`[NAVER] Trying initial publish button selector: ${selector}`);
        const initialBtn = pageOrFrame.locator(selector);
        
        // Wait for the button to be visible and enabled
        await initialBtn.waitFor({ state: 'visible', timeout: 5000 });
        
        if (await initialBtn.count() > 0) {
          console.log(`[NAVER] Initial publish button found with selector: ${selector}`);
          
          // Check if button is enabled
          const isEnabled = await initialBtn.isEnabled();
          console.log(`[NAVER] Initial publish button enabled: ${isEnabled}`);
          
          if (isEnabled) {
            console.log('[NAVER] Clicking initial publish button...');
            await initialBtn.click({ timeout: 10000 });
            console.log('[NAVER] Initial publish button clicked successfully');
            initialButtonClicked = true;
            break;
          } else {
            console.log('[NAVER] Initial publish button found but not enabled, trying next selector');
          }
        }
      } catch (waitError) {
        console.log(`[NAVER] Initial publish button not found with selector: ${selector} - ${waitError.message}`);
      }
    }
    
    // Step 2: Wait for the final publish button to appear and click it
    if (initialButtonClicked) {
      console.log('[NAVER] Step 2: Waiting for final publish button to appear...');
      await newPage.waitForTimeout(5000); // Wait full 5 seconds as requested
      
      for (const selector of finalPublishSelectors) {
        try {
          console.log(`[NAVER] Trying final publish button selector: ${selector}`);
          const finalBtn = pageOrFrame.locator(selector);
          
          // Wait for the button to be visible and enabled
          await finalBtn.waitFor({ state: 'visible', timeout: 5000 });
          
          if (await finalBtn.count() > 0) {
            console.log(`[NAVER] Final publish button found with selector: ${selector}`);
            
            // Check if button is enabled
            const isEnabled = await finalBtn.isEnabled();
            console.log(`[NAVER] Final publish button enabled: ${isEnabled}`);
            
            if (isEnabled) {
              console.log('[NAVER] Clicking final publish button...');
              await finalBtn.click({ timeout: 10000 });
              await newPage.waitForTimeout(3000);
              console.log('[NAVER] Final publish button clicked successfully');
              publishButtonFound = true;
              break;
            } else {
              console.log('[NAVER] Final publish button found but not enabled, trying next selector');
            }
          }
        } catch (waitError) {
          console.log(`[NAVER] Final publish button not found with selector: ${selector} - ${waitError.message}`);
        }
      }
    } else {
      console.log('[NAVER] Initial publish button not found, trying direct final button approach...');
      
      // Fallback: Try to click final button directly
      for (const selector of finalPublishSelectors) {
        try {
          console.log(`[NAVER] Trying direct final publish button selector: ${selector}`);
          const finalBtn = pageOrFrame.locator(selector);
          
          // Wait for the button to be visible and enabled
          await finalBtn.waitFor({ state: 'visible', timeout: 5000 });
          
          if (await finalBtn.count() > 0) {
            console.log(`[NAVER] Direct final publish button found with selector: ${selector}`);
            
            // Check if button is enabled
            const isEnabled = await finalBtn.isEnabled();
            console.log(`[NAVER] Direct final publish button enabled: ${isEnabled}`);
            
            if (isEnabled) {
              console.log('[NAVER] Clicking direct final publish button...');
              await finalBtn.click({ timeout: 10000 });
              await newPage.waitForTimeout(3000);
              console.log('[NAVER] Direct final publish button clicked successfully');
              publishButtonFound = true;
              break;
            } else {
              console.log('[NAVER] Direct final publish button found but not enabled, trying next selector');
            }
          }
        } catch (waitError) {
          console.log(`[NAVER] Direct final publish button not found with selector: ${selector} - ${waitError.message}`);
        }
      }
    }
    
    if (!publishButtonFound) {
      console.log('[NAVER] No publish button found with any selector');
      
      // Try to find any button that might be the publish button
      console.log('[NAVER] Looking for any button that might be publish...');
      const allButtons = pageOrFrame.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`[NAVER] Found ${buttonCount} buttons on page`);
      
      // Log all button texts for debugging
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        try {
          const buttonText = await allButtons.nth(i).textContent();
          const buttonClass = await allButtons.nth(i).getAttribute('class');
          console.log(`[NAVER] Button ${i}: "${buttonText}" (class: ${buttonClass})`);
        } catch (e) {
          console.log(`[NAVER] Button ${i}: Could not get text/class`);
        }
      }
    }

    return publishButtonFound;
  } catch (error) {
    console.error('[NAVER] Error publishing blog post:', error);
    return false;
  }
}

/**
 * Main function to run Naver Blog automation
 */
export async function runNaverBlogAutomation(
  settings: NaverBlogSettings,
  content: BlogContent
): Promise<BrowserControllerResult> {
  let browser: Browser | null = null;
  
  try {
    console.log('[NAVER] Starting Naver Blog automation...');
    
    // Launch browser
    const { browser: launchedBrowser, context, page } = await launchBrowser(settings.proxyUrl);
    browser = launchedBrowser;
    
    // Handle login
    const loginSuccess = await handleNaverLogin(page, settings.username, settings.password);
    if (!loginSuccess) {
      throw new Error('Failed to login to Naver');
    }
    
    // Open blog write page
    const newPage = await openBlogWritePage(context, page);
    if (!newPage) {
      throw new Error('Failed to open blog write page');
    }
    
    // Switch to mainFrame if present
    const hasMainFrame = await newPage.locator('#mainFrame').count();
    const mainFrameLocator = newPage.frameLocator('#mainFrame');
    const pageOrFrame = hasMainFrame ? mainFrameLocator : newPage;
    
    // Handle popups
    await handlePopups(pageOrFrame, newPage);
    
    // Fill blog content
    await fillBlogContent(pageOrFrame, newPage, content);
    
    // Publish blog post
    const publishSuccess = await publishBlogPost(pageOrFrame, newPage);
    
    if (publishSuccess) {
      console.log('[NAVER] Naver Blog automation completed successfully');
      return {
        success: true,
        imageGenerated: false
      };
    } else {
      throw new Error('Failed to publish blog post');
    }
    
  } catch (error) {
    console.error('[NAVER] Naver Blog automation failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    // Keep browser open for debugging - comment out for production
    // if (browser) {
    //   await browser.close();
    // }
  }
}

/**
 * Type text using keyboard coordinates (for advanced keyboard automation)
 */
export async function typeTextWithKeyboard(
  keyboardKeys: any,
  text: string,
  page: Page | null = null
): Promise<void> {
  try {
    console.log(`[NAVER] Attempting to type "${text}" using keyboard coordinates...`);
    
    // Create a mapping of characters to their positions
    const charMap: any = {};
    Object.entries(keyboardKeys).forEach(([keyLabel, keyData]: [string, any]) => {
      let char = '';
      const label = keyData.label || '';
      
      if (label.toLowerCase().includes('key:')) {
        const match = label.match(/key:\s*([a-z0-9])/i);
        if (match) {
          char = match[1].toLowerCase();
        }
      } else if (label.match(/^[a-z]\s*\/\s*[ㅏ-ㅣ]/i)) {
        const match = label.match(/^([a-z])/i);
        if (match) {
          char = match[1].toLowerCase();
        }
      } else if (label.toLowerCase().includes('enter')) {
        char = 'enter';
      } else if (label.toLowerCase().includes('shift')) {
        char = 'shift';
      } else if (label.toLowerCase().includes('space')) {
        char = ' ';
      } else {
        const singleCharMatch = label.match(/\b([a-z0-9])\b/i);
        if (singleCharMatch) {
          char = singleCharMatch[1].toLowerCase();
        }
      }
      
      if (char && ((char.length === 1 && /[a-z0-9]/.test(char)) || char === 'enter' || char === 'shift' || char === ' ')) {
        charMap[char] = keyData;
      }
    });
    
    // Click on all characters in the text
    const textToType = text.toLowerCase();
    
    for (let i = 0; i < textToType.length; i++) {
      const char = textToType[i];
      if (charMap[char] && page) {
        const keyData = charMap[char];
        
        try {
          await page.mouse.move(keyData.position.x, keyData.position.y);
          await page.waitForTimeout(100);
          await page.mouse.click(keyData.position.x, keyData.position.y);
          await page.waitForTimeout(200);
        } catch (clickError) {
          console.error(`[NAVER] Failed to click '${char}':`, clickError);
        }
      }
    }
    
    console.log(`[NAVER] Finished typing "${text}"`);
  } catch (error) {
    console.error('[NAVER] Error typing text:', error);
  }
}

/**
 * Process segmentation results for keyboard automation
 */
export async function processSegmentationResults(
  segmentationResults: any[],
  screenshotPath: string,
  elementBoxes: any = null,
  page: Page | null = null,
  textToType: string = 'hello'
): Promise<{ success: boolean; processed: number; keyboardKeys?: any; error?: string }> {
  try {
    console.log('[NAVER] Processing segmentation results...');
    console.log('[NAVER] Found', segmentationResults.length, 'objects in the image');
    
    if (elementBoxes && elementBoxes.targetImage) {
      const targetImageBox = elementBoxes.targetImage;
      const keyboardKeys: any = {};
      
      // Process each segmented object
      segmentationResults.forEach((obj, index) => {
        const aiBox = obj.box_2d; // [ymin, xmin, ymax, xmax] from AI (normalized 0-1000)
        const keyLabel = obj.label || `key_${index}`;
        
        // Convert from [ymin, xmin, ymax, xmax] format to [x, y, width, height]
        const [ymin, xmin, ymax, xmax] = aiBox;
        const normalizedX = xmin / 1000;
        const normalizedY = ymin / 1000;
        const normalizedWidth = (xmax - xmin) / 1000;
        const normalizedHeight = (ymax - ymin) / 1000;
        
        // Calculate relative position within the target image
        const relativeX = normalizedX * targetImageBox.width;
        const relativeY = normalizedY * targetImageBox.height;
        const relativeWidth = normalizedWidth * targetImageBox.width;
        const relativeHeight = normalizedHeight * targetImageBox.height;
        
        // Convert to absolute page coordinates
        const absoluteX = targetImageBox.x + relativeX;
        const absoluteY = targetImageBox.y + relativeY;
        
        // Calculate center point for clicking
        const centerX = absoluteX + (relativeWidth / 2);
        const centerY = absoluteY + (relativeHeight / 2);
        
        keyboardKeys[keyLabel] = {
          position: {
            x: Math.round(centerX),
            y: Math.round(centerY)
          },
          bounds: {
            x: Math.round(absoluteX),
            y: Math.round(absoluteY),
            width: Math.round(relativeWidth),
            height: Math.round(relativeHeight)
          },
          label: obj.label,
          mask: obj.mask,
          aiBox: aiBox
        };
      });
      
      // Try to type the specified text using the keyboard coordinates
      if (keyboardKeys && Object.keys(keyboardKeys).length > 0 && page) {
        await typeTextWithKeyboard(keyboardKeys, textToType, page);
      }
      
      return { success: true, processed: segmentationResults.length, keyboardKeys };
    } else {
      // Fallback: just log basic info
      segmentationResults.forEach((obj, index) => {
        console.log(`[NAVER] Object ${index + 1}:`, {
          label: obj.label,
          box: obj.box_2d,
          mask: obj.mask
        });
      });
      
      return { success: true, processed: segmentationResults.length };
    }
  } catch (error) {
    console.error('[NAVER] Error processing segmentation results:', error);
      return { success: false, processed: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
