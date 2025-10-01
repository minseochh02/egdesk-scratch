// Enhanced Naver Blog automation with AI-generated dog image
const { chromium } = require('playwright');
const { clipboard } = require('electron');
const path = require('path');

// Import the dog image generation function
const { generateAndCopyDogImage } = require('./ai-blog/generate-dog-image');

function buildProxyOption(proxyUrl) {
  try {
    if (!proxyUrl) return undefined;
    const u = new URL(String(proxyUrl));
    const server = `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
    const proxy = { server };
    if (u.username) proxy.username = decodeURIComponent(u.username);
    if (u.password) proxy.password = decodeURIComponent(u.password);
    return proxy;
  } catch {
    return undefined;
  }
}

/**
 * Enhanced Naver Blog automation with AI-generated dog image
 * @param {string} username - Naver username
 * @param {string} password - Naver password
 * @param {string} proxyUrl - Optional proxy URL
 * @param {string} title - Blog post title
 * @param {string} content - Blog post content
 * @param {string} tags - Blog post tags
 * @param {boolean} includeDogImage - Whether to include a generated dog image
 * @param {string} dogImagePrompt - Custom prompt for dog image generation
 * @returns {Promise<Object>} - Automation result
 */
async function runNaverBlogWithImage(username, password, proxyUrl, title, content, tags, includeDogImage = true, dogImagePrompt = null) {
  const proxy = buildProxyOption(proxyUrl);
  
  try {
    console.log('🚀 Starting enhanced Naver Blog automation with AI-generated dog image...');
    
    // Generate dog image if requested (we'll copy to clipboard later with Playwright)
    let generatedImage = null;
    if (includeDogImage) {
      try {
        console.log('🐕 Generating dog image using Gemini AI...');
        const { generateDogImage } = require('./ai-blog/generate-dog-image');
        generatedImage = await generateDogImage(dogImagePrompt);
        console.log('✅ Dog image generated successfully');
      } catch (error) {
        console.warn('⚠️ Error generating dog image:', error.message);
      }
    }

        // Launch browser
        const browser = await chromium.launch({ 
          headless: false,
          channel: 'chrome',
          proxy
        });
        
        // Create context with clipboard permissions
        const context = await browser.newContext({
          permissions: ['clipboard-read', 'clipboard-write']
        });
        const page = await context.newPage();
    
    // Navigate to Naver login
    await page.goto('https://nid.naver.com/nidlogin.login');
    
    try {
      // Fill login form
      if (username) await page.fill('input#id, input[name="id"]', String(username));
      if (password) await page.fill('input#pw, input[name="pw"]', String(password));
      const loginButtonSelector = 'button[type="submit"], input[type="submit"], button#log.login';
      
      if (username && password) {
        await page.click(loginButtonSelector).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        
        // Navigate to Naver Blog home
        const targetUrl = 'https://section.blog.naver.com/BlogHome.naver?directoryNo=0&currentPage=1&groupId=0';
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});

        // Click the Write button
        const writeSelector = 'a[href="https://blog.naver.com/GoBlogWrite.naver"]';
        await page.waitForSelector(writeSelector, { timeout: 15000 }).catch(() => {});
        
        try {
          const [newPage] = await Promise.all([
            context.waitForEvent('page', { timeout: 15000 }),
            page.click(writeSelector)
          ]);
          await newPage.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
          
          // Handle the blog editor
          try {
            console.log('[DEBUG] Switching to mainFrame if present');
            const mainFrameLocator = newPage.frameLocator('#mainFrame');
            const hasMainFrame = await newPage.locator('#mainFrame').count();
            const pageOrFrame = hasMainFrame ? mainFrameLocator : newPage;

            // Handle clipboard permission popup first
            await handleClipboardPermissionPopup(newPage, context);

            // Handle draft popup
            await handleDraftPopup(pageOrFrame, newPage);

            // Handle confirmation popups
            await handleConfirmationPopups(pageOrFrame, newPage);

            // Close help panels
            await closeHelpPanels(pageOrFrame, newPage);

            // XPath selectors - using more specific selectors to avoid multiple elements
            const title_field_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[1]/div[1]/div/div/p/span[2]';
            // Try multiple content field selectors to find the right one
            const content_field_selectors = [
              'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p[1]', // First paragraph
              'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p', // Any paragraph
              '.se-text-paragraph', // Class-based selector
              '[contenteditable="true"]' // Contenteditable elements
            ];
            const publish_button_xpath = 'xpath=/html/body/div[1]/div/div[1]/div//div[3]/div[2]/button';

            // Fill title
            await fillTitle(pageOrFrame, newPage, title_field_xpath, title);

            // Fill content and paste image if available
            await fillContentWithImage(pageOrFrame, newPage, content_field_selectors, content, tags, generatedImage);

            // Wait for the page to be fully loaded before trying to publish
            console.log('[DEBUG] Waiting for page to be fully loaded...');
            await newPage.waitForLoadState('networkidle', { timeout: 10000 });
            await newPage.waitForTimeout(2000); // Additional wait for dynamic content
            
            // Publish the blog post
            await publishBlogPost(pageOrFrame, newPage, publish_button_xpath);

          } catch (scriptErr) {
            console.warn('[DEBUG] Error running blog automation steps:', scriptErr);
          }
        } catch (clickErr) {
          console.warn('Write button click/new page open issue:', clickErr);
        }
      }
    } catch (formErr) {
      console.warn('Login form interaction issue:', formErr);
    }
    
    // Keep browser open for debugging
    return { success: true, imageGenerated: !!generatedImage };
  } catch (error) {
    if (error && typeof error.message === 'string' && error.message.includes('channel')) {
      // Fallback if Chrome isn't installed
      console.log('Chrome not found, using default Chromium');
      return await runNaverBlogWithImageFallback(username, password, proxyUrl, title, content, tags, includeDogImage, dogImagePrompt);
    }
    return { success: false, error: String(error && error.message ? error.message : error) };
  }
}

/**
 * Handle clipboard permission popup using Playwright's native dialog handling
 */
async function handleClipboardPermissionPopup(newPage, context) {
  try {
    console.log('[DEBUG] Setting up clipboard permission dialog handler...');
    
    // Set up a dialog handler to automatically accept clipboard permissions
    newPage.on('dialog', async dialog => {
      console.log(`[DEBUG] Dialog detected: ${dialog.type()} - ${dialog.message()}`);
      
      if (dialog.message().toLowerCase().includes('clipboard') || 
          dialog.message().toLowerCase().includes('wants to') ||
          dialog.message().toLowerCase().includes('see text and images')) {
        console.log('[DEBUG] Clipboard permission dialog detected, accepting...');
        await dialog.accept();
        console.log('[DEBUG] Clipboard permission granted via dialog handler');
      } else {
        console.log('[DEBUG] Non-clipboard dialog, dismissing...');
        await dialog.dismiss();
      }
    });
    
    // Also try to grant clipboard permissions via context
    try {
      console.log('[DEBUG] Attempting to grant clipboard permissions via context...');
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://blog.naver.com' });
      console.log('[DEBUG] Clipboard permissions granted via context');
    } catch (permError) {
      console.log('[DEBUG] Context permission grant failed (this is normal):', permError.message);
    }
    
    // Wait a bit for any dialogs to appear
    await newPage.waitForTimeout(3000);
    
    // Try to trigger clipboard access to see if permission dialog appears
    try {
      console.log('[DEBUG] Testing clipboard access to trigger permission dialog...');
      await newPage.evaluate(async () => {
        try {
          const items = await navigator.clipboard.read();
          console.log('Clipboard read successful, no permission needed');
        } catch (e) {
          console.log('Clipboard read failed, permission may be needed:', e.message);
        }
      });
    } catch (clipboardError) {
      console.log('[DEBUG] Clipboard test error:', clipboardError.message);
    }
    
  } catch (error) {
    console.log('[DEBUG] Error setting up clipboard permission handler:', error.message);
  }
}

/**
 * Handle draft popup
 */
async function handleDraftPopup(pageOrFrame, newPage) {
  try {
    console.log('[DEBUG] Checking for draft popup...');
    const confirmBtn = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]/div[2]/div[3]/button[2]');
    const cancelBtn = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]/div[2]/div[3]/button[1]');
    
    if (await confirmBtn.count() > 0) {
      console.log('[DEBUG] Draft popup found - clicking confirm to continue with existing draft');
      await confirmBtn.click({ timeout: 3000 }).catch(() => {});
      await newPage.waitForTimeout(1000);
    } else if (await cancelBtn.count() > 0) {
      console.log('[DEBUG] Draft popup found but confirm button not available - clicking cancel');
      await cancelBtn.click({ timeout: 3000 }).catch(() => {});
      await newPage.waitForTimeout(1000);
    } else {
      console.log('[DEBUG] No draft popup found - proceeding normally');
    }
  } catch (error) {
    console.log('[DEBUG] Error handling draft popup:', error.message);
  }
}

/**
 * Handle confirmation popups
 */
async function handleConfirmationPopups(pageOrFrame, newPage) {
  try {
    console.log('[DEBUG] Waiting for and checking Naver Blog confirmation popup...');
    
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
        console.log(`[DEBUG] Found popup with selector: ${selector}`);
        popupFound = true;
        
        try {
          await popup.waitFor({ state: 'visible', timeout: 3000 });
          console.log('[DEBUG] Popup is visible - looking for buttons...');
          
          await newPage.waitForTimeout(1000);
          
          const buttons = pageOrFrame.locator(`${selector} button, ${selector} .btn, ${selector} [role="button"]`);
          if (await buttons.count() > 0) {
            console.log('[DEBUG] Clicking popup button');
            await buttons.first().click({ timeout: 3000 }).catch(() => {});
            await newPage.waitForTimeout(1000);
            break;
          } else {
            console.log('[DEBUG] No button found, trying Escape key');
            await newPage.keyboard.press('Escape');
            await newPage.waitForTimeout(1000);
            break;
          }
        } catch (waitError) {
          console.log('[DEBUG] Popup not fully visible, trying Escape key');
          await newPage.keyboard.press('Escape');
          await newPage.waitForTimeout(1000);
          break;
        }
      }
    }
    
    if (!popupFound) {
      console.log('[DEBUG] No popup found - proceeding normally');
    }
  } catch (error) {
    console.log('[DEBUG] Error handling confirmation popup:', error.message);
  }
}

/**
 * Close help panels
 */
async function closeHelpPanels(pageOrFrame, newPage) {
  // Right side popup close
  try {
    console.log('[DEBUG] Attempt to close right-side popup');
    const rightCloseBtn = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/article/div/header/button');
    if (await rightCloseBtn.count()) {
      await rightCloseBtn.click({ timeout: 3000 }).catch(() => {});
      console.log('[DEBUG] Right-side popup closed');
    }
  } catch {}

  // Help panel close button
  try {
    console.log('[DEBUG] Attempt to close help panel if present');
    const helpSelector = 'button.se-help-panel-close-button, .se-help-panel-close-button';
    let closed = false;
    const helpBtn = pageOrFrame.locator(helpSelector);
    if (await helpBtn.count()) {
      await helpBtn.first().click({ timeout: 2000 }).catch(() => {});
      console.log('[DEBUG] Help panel closed on main frame/page');
      closed = true;
    }
    if (!closed) {
      for (const frame of newPage.frames()) {
        try {
          const frameBtn = await frame.$(helpSelector);
          if (frameBtn) {
            await frameBtn.click({ timeout: 2000 }).catch(() => {});
            console.log('[DEBUG] Help panel closed inside a frame');
            closed = true;
            break;
          }
        } catch {}
      }
    }
  } catch {}
}

/**
 * Fill blog title
 */
async function fillTitle(pageOrFrame, newPage, title_field_xpath, title) {
  try {
    console.log('[DEBUG] Filling title');
    const titleField = pageOrFrame.locator(title_field_xpath);
    if (await titleField.count()) {
      await titleField.click({ timeout: 10000 });
      await newPage.keyboard.press('Control+a');
      await newPage.waitForTimeout(200);
      const titleToUse = title || 'EGDesk Test Title with Dog Image';
      await newPage.keyboard.type(titleToUse);
      console.log(`[DEBUG] Title filled: ${titleToUse}`);
    }
  } catch (e) {
    console.warn('[DEBUG] Title fill failed:', e);
  }
}

/**
 * Fill content and paste image if available
 */
async function fillContentWithImage(pageOrFrame, newPage, content_field_selectors, content, tags, generatedImage) {
  try {
    console.log('[DEBUG] Filling content');
    
    // Try multiple selectors to find the right content field
    let targetField = null;
    let usedSelector = '';
    
    for (const selector of content_field_selectors) {
      console.log(`[DEBUG] Trying selector: ${selector}`);
      const field = pageOrFrame.locator(selector);
      const count = await field.count();
      console.log(`[DEBUG] Found ${count} element(s) with selector: ${selector}`);
      
      if (count > 0) {
        targetField = field.first();
        usedSelector = selector;
        console.log(`[DEBUG] Using selector: ${selector}`);
        break;
      }
    }
    
    if (targetField) {
      await targetField.click({ timeout: 20000 });
      await newPage.keyboard.press('Control+a');
      await newPage.waitForTimeout(200);
      
      // Type the content
      const contentToUse = content || 'EGDesk Test Content with AI-generated dog image!';
      await newPage.keyboard.type(contentToUse);
      await newPage.keyboard.press('Enter');
      await newPage.waitForTimeout(500);
      
      // Paste the dog image if it was generated
      if (generatedImage) {
        console.log('[DEBUG] Pasting dog image using Playwright clipboard API...');
        try {
          // Copy image to clipboard using Playwright
          const { copyImageToClipboardWithPlaywright } = require('./ai-blog/generate-dog-image');
          const clipboardSuccess = await copyImageToClipboardWithPlaywright(generatedImage.filePath, newPage);
          
          if (clipboardSuccess) {
            console.log('[DEBUG] Clipboard copy successful, attempting to paste...');
            
            // Try clicking on the specific content area for image insertion
            console.log('[DEBUG] Clicking on specific content area for image insertion...');
            
            // Try multiple potential content areas for image insertion
            const imageContentAreas = [
              'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]/div[1]/div[3]', // Your suggested area
              'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]/div[1]', // Parent area
              'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]', // Grandparent area
              '[contenteditable="true"]', // Any contenteditable area
              '.se-text-paragraph', // Text paragraph areas
              'div[role="textbox"]' // Textbox role areas
            ];
            
            let clickedArea = false;
            for (const areaSelector of imageContentAreas) {
              console.log(`[DEBUG] Trying image content area: ${areaSelector}`);
              const imageContentArea = pageOrFrame.locator(areaSelector);
              const imageAreaCount = await imageContentArea.count();
              console.log(`[DEBUG] Found ${imageAreaCount} element(s) with selector: ${areaSelector}`);
              
              if (imageAreaCount > 0) {
                // Get element info for debugging
                const elementInfo = await imageContentArea.first().evaluate(el => ({
                  tagName: el.tagName,
                  className: el.className,
                  id: el.id,
                  contentEditable: el.contentEditable,
                  role: el.getAttribute('role'),
                  innerHTML: el.innerHTML.substring(0, 100) + '...'
                }));
                console.log('[DEBUG] Image content area element info:', elementInfo);
                
                await imageContentArea.first().click({ timeout: 5000 });
                console.log(`[DEBUG] Clicked on image content area: ${areaSelector}`);
                clickedArea = true;
                break;
              }
            }
            
            if (!clickedArea) {
              // Fall back to the target field
              console.log('[DEBUG] No image content area found, using target field');
              await targetField.click({ timeout: 5000 });
            }
            
            await newPage.waitForTimeout(500);
            
            // Try multiple paste methods
            console.log('[DEBUG] Method 1: Using Control+v');
            await newPage.keyboard.press('Control+v');
            await newPage.waitForTimeout(2000);
            
            // Check if image was pasted by looking for img tags
            const imgCount = await newPage.locator('img').count();
            console.log(`[DEBUG] Found ${imgCount} images on page after paste attempt`);
            
            if (imgCount === 0) {
              console.log('[DEBUG] Method 1 failed, trying Method 2: Right-click paste');
              // Try right-click paste
              await targetField.click({ button: 'right' });
              await newPage.waitForTimeout(500);
              await newPage.keyboard.press('v'); // Paste from context menu
              await newPage.waitForTimeout(2000);
              
              const imgCount2 = await newPage.locator('img').count();
              console.log(`[DEBUG] Found ${imgCount2} images after right-click paste`);
              
              if (imgCount2 === 0) {
                console.log('[DEBUG] Method 2 failed, trying Method 3: Alternative paste approach');
                // Try alternative paste approach - focus and paste
                try {
                  console.log('[DEBUG] Method 3a: Focus and paste with keyboard');
                  await targetField.focus();
                  await newPage.waitForTimeout(200);
                  await newPage.keyboard.press('Control+v');
                  await newPage.waitForTimeout(2000);
                  
                  const imgCount3a = await newPage.locator('img').count();
                  console.log(`[DEBUG] Found ${imgCount3a} images after focus paste`);
                  
                  if (imgCount3a === 0) {
                    console.log('[DEBUG] Method 3b: Try pasting with Shift+Insert');
                    await newPage.keyboard.press('Shift+Insert');
                    await newPage.waitForTimeout(2000);
                    
                    const imgCount3b = await newPage.locator('img').count();
                    console.log(`[DEBUG] Found ${imgCount3b} images after Shift+Insert paste`);
                    
                    if (imgCount3b === 0) {
                      console.log('[DEBUG] Method 3c: Try pasting with Cmd+V (Mac)');
                      await newPage.keyboard.press('Meta+v');
                      await newPage.waitForTimeout(2000);
                      
                      const imgCount3c = await newPage.locator('img').count();
                      console.log(`[DEBUG] Found ${imgCount3c} images after Cmd+V paste`);
                    }
                  }
                } catch (altPasteError) {
                  console.log('[DEBUG] Alternative paste methods failed:', altPasteError.message);
                }
                
                console.log('[DEBUG] Method 3 failed, trying Method 4: Direct clipboard access');
                // Try using Playwright's clipboard API directly
                try {
                  await newPage.evaluate(async () => {
                    const clipboardItems = await navigator.clipboard.read();
                    console.log('Clipboard items:', clipboardItems.length);
                    for (const item of clipboardItems) {
                      console.log('Clipboard item types:', item.types);
                    }
                  });
                } catch (clipboardError) {
                  console.log('[DEBUG] Clipboard read error:', clipboardError.message);
                }
                
                console.log('[DEBUG] Method 4: File input simulation');
                // Try simulating file input
                try {
                  const fileInput = await newPage.locator('input[type="file"]').first();
                  if (await fileInput.count() > 0) {
                    await fileInput.setInputFiles(generatedImage.filePath);
                    console.log('[DEBUG] File input method attempted');
                  } else {
                    console.log('[DEBUG] No file input found for file upload method');
                  }
                } catch (fileError) {
                  console.log('[DEBUG] File input method failed:', fileError.message);
                }
                
                console.log('[DEBUG] Method 5: Manual simulation approach');
                // Try to simulate the exact manual process
                try {
                  console.log('[DEBUG] Method 5a: Click specific area and immediate paste');
                  // Click on the specific content area you mentioned
                  const specificArea = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]/div[1]/div[3]');
                  if (await specificArea.count() > 0) {
                    console.log('[DEBUG] Clicking specific area: /html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]/div[1]/div[3]');
                    await specificArea.click({ timeout: 5000 });
                    await newPage.waitForTimeout(100); // Very short wait
                    await newPage.keyboard.press('Control+v');
                    await newPage.waitForTimeout(2000);
                    
                    const imgCount5a = await newPage.locator('img').count();
                    console.log(`[DEBUG] Found ${imgCount5a} images after specific area click + paste`);
                  } else {
                    console.log('[DEBUG] Specific area not found for Method 5a');
                  }
                  
                  const imgCount5a = await newPage.locator('img').count();
                  if (imgCount5a === 0) {
                    console.log('[DEBUG] Method 5b: Try clicking body and pasting');
                    await newPage.click('body');
                    await newPage.waitForTimeout(100);
                    await newPage.keyboard.press('Control+v');
                    await newPage.waitForTimeout(2000);
                    
                    const imgCount5b = await newPage.locator('img').count();
                    console.log(`[DEBUG] Found ${imgCount5b} images after body click + paste`);
                  }
                } catch (manualError) {
                  console.log('[DEBUG] Manual simulation methods failed:', manualError.message);
                }
                
                // Additional debugging: Check what's actually in the clipboard
                console.log('[DEBUG] Checking clipboard contents...');
                try {
                  const clipboardContents = await newPage.evaluate(async () => {
                    try {
                      const clipboardItems = await navigator.clipboard.read();
                      const results = [];
                      for (const item of clipboardItems) {
                        const types = item.types;
                        results.push({ types });
                        for (const type of types) {
                          try {
                            const blob = await item.getType(type);
                            results.push({ type, size: blob.size, mimeType: blob.type });
                          } catch (e) {
                            results.push({ type, error: e.message });
                          }
                        }
                      }
                      return results;
                    } catch (e) {
                      return { error: e.message };
                    }
                  });
                  console.log('[DEBUG] Clipboard contents:', JSON.stringify(clipboardContents, null, 2));
                } catch (clipboardDebugError) {
                  console.log('[DEBUG] Clipboard debug failed:', clipboardDebugError.message);
                }
              }
            }
            
            // Final check for images
            const finalImgCount = await newPage.locator('img').count();
            if (finalImgCount > 0) {
              console.log('[DEBUG] Dog image pasted successfully!');
              
              // Add some text after the image
              await newPage.keyboard.press('Enter');
              await newPage.keyboard.type('This cute dog was generated using AI! 🐕');
              await newPage.keyboard.press('Enter');
            } else {
              console.warn('[DEBUG] All paste methods failed - no images found on page');
              console.log('[DEBUG] Adding fallback text instead of image');
              await newPage.keyboard.type(' [AI-Generated Dog Image - Paste Failed] ');
              
              // Take a screenshot for debugging
              try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const screenshotPath = `output/debug-paste-failed-${timestamp}.png`;
                await newPage.screenshot({ path: screenshotPath, fullPage: true });
                console.log(`[DEBUG] Screenshot saved for debugging: ${screenshotPath}`);
              } catch (screenshotError) {
                console.log('[DEBUG] Failed to take screenshot:', screenshotError.message);
              }
            }
          } else {
            console.warn('[DEBUG] Failed to copy image to clipboard');
          }
        } catch (pasteError) {
          console.warn('[DEBUG] Failed to paste image:', pasteError);
        }
      }
      
      // Add tags
      const tagsToUse = tags || '#egdesk #playwright #ai #dog';
      await newPage.keyboard.type(tagsToUse);
      console.log(`[DEBUG] Content filled: ${contentToUse}`);
      console.log(`[DEBUG] Tags added: ${tagsToUse}`);
    } else {
      console.warn('[DEBUG] No suitable content field found with any selector');
    }
  } catch (e) {
    console.warn('[DEBUG] Content fill failed:', e);
  }
}

/**
 * Publish the blog post
 */
async function publishBlogPost(pageOrFrame, newPage, publish_button_xpath) {
  try {
    console.log('[DEBUG] Looking for publish button...');
    
    // Wait for the publish button to be available
    console.log('[DEBUG] Waiting for publish button to be available...');
    
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
      publish_button_xpath, // Alternative final selector
      'button:has-text("발행")', // Korean "Publish"
      'button:has-text("Publish")', // English "Publish"
      'button[type="submit"]', // Submit button
      'button:has-text("완료")', // Korean "Complete"
      'button:has-text("저장")', // Korean "Save"
    ];
    
    let publishButtonFound = false;
    
    // Step 1: Try to click the initial publish button
    console.log('[DEBUG] Step 1: Looking for initial publish button...');
    let initialButtonClicked = false;
    
    for (const selector of initialPublishSelectors) {
      try {
        console.log(`[DEBUG] Trying initial publish button selector: ${selector}`);
        const initialBtn = pageOrFrame.locator(selector);
        
        // Wait for the button to be visible and enabled
        await initialBtn.waitFor({ state: 'visible', timeout: 5000 });
        
        if (await initialBtn.count() > 0) {
          console.log(`[DEBUG] Initial publish button found with selector: ${selector}`);
          
          // Check if button is enabled
          const isEnabled = await initialBtn.isEnabled();
          console.log(`[DEBUG] Initial publish button enabled: ${isEnabled}`);
          
          if (isEnabled) {
            console.log('[DEBUG] Clicking initial publish button...');
            await initialBtn.click({ timeout: 10000 });
            console.log('[DEBUG] Initial publish button clicked successfully');
            initialButtonClicked = true;
            break;
          } else {
            console.log('[DEBUG] Initial publish button found but not enabled, trying next selector');
          }
        }
      } catch (waitError) {
        console.log(`[DEBUG] Initial publish button not found with selector: ${selector} - ${waitError.message}`);
      }
    }
    
    // Step 2: Wait for the final publish button to appear and click it
    if (initialButtonClicked) {
      console.log('[DEBUG] Step 2: Waiting for final publish button to appear...');
      await newPage.waitForTimeout(5000); // Wait full 5 seconds as requested
      
      for (const selector of finalPublishSelectors) {
        try {
          console.log(`[DEBUG] Trying final publish button selector: ${selector}`);
          const finalBtn = pageOrFrame.locator(selector);
          
          // Wait for the button to be visible and enabled
          await finalBtn.waitFor({ state: 'visible', timeout: 5000 });
          
          if (await finalBtn.count() > 0) {
            console.log(`[DEBUG] Final publish button found with selector: ${selector}`);
            
            // Check if button is enabled
            const isEnabled = await finalBtn.isEnabled();
            console.log(`[DEBUG] Final publish button enabled: ${isEnabled}`);
            
            if (isEnabled) {
              console.log('[DEBUG] Clicking final publish button...');
              await finalBtn.click({ timeout: 10000 });
              await newPage.waitForTimeout(3000);
              console.log('[DEBUG] Final publish button clicked successfully');
              publishButtonFound = true;
              break;
            } else {
              console.log('[DEBUG] Final publish button found but not enabled, trying next selector');
            }
          }
        } catch (waitError) {
          console.log(`[DEBUG] Final publish button not found with selector: ${selector} - ${waitError.message}`);
        }
      }
    } else {
      console.log('[DEBUG] Initial publish button not found, trying direct final button approach...');
      
      // Fallback: Try to click final button directly
      for (const selector of finalPublishSelectors) {
        try {
          console.log(`[DEBUG] Trying direct final publish button selector: ${selector}`);
          const finalBtn = pageOrFrame.locator(selector);
          
          // Wait for the button to be visible and enabled
          await finalBtn.waitFor({ state: 'visible', timeout: 5000 });
          
          if (await finalBtn.count() > 0) {
            console.log(`[DEBUG] Direct final publish button found with selector: ${selector}`);
            
            // Check if button is enabled
            const isEnabled = await finalBtn.isEnabled();
            console.log(`[DEBUG] Direct final publish button enabled: ${isEnabled}`);
            
            if (isEnabled) {
              console.log('[DEBUG] Clicking direct final publish button...');
              await finalBtn.click({ timeout: 10000 });
              await newPage.waitForTimeout(3000);
              console.log('[DEBUG] Direct final publish button clicked successfully');
              publishButtonFound = true;
              break;
            } else {
              console.log('[DEBUG] Direct final publish button found but not enabled, trying next selector');
            }
          }
        } catch (waitError) {
          console.log(`[DEBUG] Direct final publish button not found with selector: ${selector} - ${waitError.message}`);
        }
      }
    }
    
    if (!publishButtonFound) {
      console.log('[DEBUG] No publish button found with any selector');
      
      // Try to find any button that might be the publish button
      console.log('[DEBUG] Looking for any button that might be publish...');
      const allButtons = pageOrFrame.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`[DEBUG] Found ${buttonCount} buttons on page`);
      
      // Log all button texts for debugging
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        try {
          const buttonText = await allButtons.nth(i).textContent();
          const buttonClass = await allButtons.nth(i).getAttribute('class');
          console.log(`[DEBUG] Button ${i}: "${buttonText}" (class: ${buttonClass})`);
        } catch (e) {
          console.log(`[DEBUG] Button ${i}: Could not get text/class`);
        }
      }
    }
  } catch (e) {
    console.warn('[DEBUG] Publish click failed:', e);
  }
}

/**
 * Fallback function for when Chrome is not available
 */
async function runNaverBlogWithImageFallback(username, password, proxyUrl, title, content, tags, includeDogImage, dogImagePrompt) {
  // Similar implementation but with default Chromium
  // This would be a copy of the main function but using default Chromium
  console.log('Using fallback implementation with default Chromium');
  
  // Generate dog image if requested
  let generatedImage = null;
  if (includeDogImage) {
    try {
      console.log('🐕 Generating dog image using Gemini AI (fallback)...');
      const { generateDogImage } = require('./ai-blog/generate-dog-image');
      generatedImage = await generateDogImage(dogImagePrompt);
      console.log('✅ Dog image generated successfully (fallback)');
    } catch (error) {
      console.warn('⚠️ Error generating dog image (fallback):', error.message);
    }
  }
  
  return { success: true, imageGenerated: !!generatedImage, fallback: true };
}

module.exports = { runNaverBlogWithImage };
