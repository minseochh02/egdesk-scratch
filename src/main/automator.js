// automator.js
const { chromium } = require('playwright');
const { clipboard } = require('electron');
const path = require('path');

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

async function runAutomation(username, password, proxyUrl) {
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
    await page.goto('https://nid.naver.com/nidlogin.login');
    try {
      if (username) await page.fill('input#id, input[name="id"]', String(username));
      if (password) await page.fill('input#pw, input[name="pw"]', String(password));
      const loginButtonSelector = 'button[type="submit"], input[type="submit"], button#log.login';
      if (username && password) {
        await page.click(loginButtonSelector).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        // After login attempt, navigate to Naver Blog home
        const targetUrl = 'https://section.blog.naver.com/BlogHome.naver?directoryNo=0&currentPage=1&groupId=0';
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});

        // Click the Write button which opens a new tab/window
        const writeSelector = 'a[href="https://blog.naver.com/GoBlogWrite.naver"]';
        await page.waitForSelector(writeSelector, { timeout: 15000 }).catch(() => {});
        try {
          const [newPage] = await Promise.all([
            context.waitForEvent('page', { timeout: 15000 }),
            page.click(writeSelector)
          ]);
          await newPage.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
          // Type "hi" using Playwright's keyboard API
          try {
            console.log('[DEBUG] Typing "hi" using Playwright keyboard API');
            await newPage.bringToFront().catch(() => {});
            await newPage.click('body').catch(() => {});
            console.log('[DEBUG] Using keyboard.type to input text');
            await newPage.keyboard.type('hi');
            console.log('[DEBUG] Text typed successfully');
          } catch (outerErr) {
            console.warn('[DEBUG] Unexpected error while trying to type:', outerErr);
          }

          // Translate Selenium script steps to Playwright for Naver Blog write page
          try {
            console.log('[DEBUG] Switching to mainFrame if present');
            const mainFrameLocator = newPage.frameLocator('#mainFrame');
            // If mainFrame exists, use it; otherwise operate on newPage
            const hasMainFrame = await newPage.locator('#mainFrame').count();
            const pageOrFrame = hasMainFrame ? mainFrameLocator : newPage;

            // Draft popup cancel
            try {
              console.log('[DEBUG] Attempt to cancel draft popup');
              const cancelBtn = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]/div[2]/div[3]/button[1]');
              if (await cancelBtn.count()) {
                await cancelBtn.click({ timeout: 3000 }).catch(() => {});
                console.log('[DEBUG] Draft popup cancelled');
              }
            } catch {}

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
                // search in frames
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

            // XPaths
            const title_field_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[1]/div[1]/div/div/p/span[2]';
            const content_field_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p';
            const publish_button_xpath = 'xpath=/html/body/div[1]/div/div[1]/div//div[3]/div[2]/button';
            const text_image_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/header/div[1]/ul/li[17]/button';
            const image_keyword_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/aside/div/div[1]/input';
            const first_image_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/aside/div/div[3]/div/ul/div/li[1]/div/div[2]';
            const help_panel_close_xpath = 'xpath=/html/body/div[1]/div[1]/div[3]/div/div/div[1]/div/div[1]/article/div/header/button';

            // Click 글감 button
            try {
              console.log('[DEBUG] Clicking 글감 button');
              await pageOrFrame.locator(text_image_xpath).click({ timeout: 5000 });
              await newPage.waitForTimeout(500);
            } catch (e) {
              console.warn('[DEBUG] 글감 button click failed:', e);
            }

            // Search image by keyword (use placeholder title)
            try {
              console.log('[DEBUG] Typing keyword for image search');
              const keywordField = pageOrFrame.locator(image_keyword_xpath);
              if (await keywordField.count()) {
                await keywordField.click({ timeout: 5000 });
                await keywordField.fill('EGDesk Test Title');
                await keywordField.press('Enter');
                await newPage.waitForTimeout(1000);
              }
            } catch (e) {
              console.warn('[DEBUG] Keyword search failed:', e);
            }

            // Click first image result
            try {
              console.log('[DEBUG] Clicking first image result');
              const firstImage = pageOrFrame.locator(first_image_xpath);
              if (await firstImage.count()) {
                await firstImage.click({ timeout: 5000 }).catch(() => {});
              }
            } catch (e) {
              console.warn('[DEBUG] First image click failed:', e);
            }

            // Fill title
            try {
              console.log('[DEBUG] Filling title');
              const titleField = pageOrFrame.locator(title_field_xpath);
              if (await titleField.count()) {
                await titleField.click({ timeout: 10000 });
                await newPage.keyboard.type('EGDesk Test Title');
              }
            } catch (e) {
              console.warn('[DEBUG] Title fill failed:', e);
            }

            // Fill content
            try {
              console.log('[DEBUG] Filling content');
              const contentField = pageOrFrame.locator(content_field_xpath);
              if (await contentField.count()) {
                await contentField.click({ timeout: 20000 });
                await newPage.keyboard.type('EGDesk Test Content');
                await newPage.keyboard.press('Enter');
                await newPage.keyboard.type('#egdesk #playwright');
              }
            } catch (e) {
              console.warn('[DEBUG] Content fill failed:', e);
            }

            // Ensure help panel is closed via explicit XPath before publishing
            try {
              const explicitClose = pageOrFrame.locator(help_panel_close_xpath);
              if (await explicitClose.count()) {
                await explicitClose.click({ timeout: 2000 }).catch(() => {});
                console.log('[DEBUG] Help panel closed via explicit XPath (pre-publish)');
              }
            } catch {}

            // Publish (optional; keep commented to avoid accidental publishing)
            try {
              console.log('[DEBUG] Clicking publish');
              const publishBtn = pageOrFrame.locator(publish_button_xpath);
              if (await publishBtn.count()) {
                await publishBtn.click({ timeout: 10000 });
                await newPage.waitForTimeout(2000);
              }
            } catch (e) {
              console.warn('[DEBUG] Publish click failed:', e);
            }
          } catch (scriptErr) {
            console.warn('[DEBUG] Error running translated Playwright steps:', scriptErr);
          }
        } catch (clickErr) {
          console.warn('Write button click/new page open issue:', clickErr);
        }
      }
    } catch (formErr) {
      console.warn('Login form interaction issue:', formErr);
    }
    // Keep browser open for debugging
    return { success: true };
  } catch (error) {
    if (error && typeof error.message === 'string' && error.message.includes('channel')) {
      // Fallback if Chrome isn't installed
      console.log('Chrome not found, using default Chromium');
      const browser = await chromium.launch({ 
        headless: false,
        proxy
      });
  const context = await browser.newContext();
  const page = await context.newPage();
      await page.goto('https://nid.naver.com/nidlogin.login');
      try {
        if (username) await page.fill('input#id, input[name="id"]', String(username));
        if (password) await page.fill('input#pw, input[name="pw"]', String(password));
        const loginButtonSelector = 'button[type="submit"], input[type="submit"], button#log.login';
        if (username && password) {
          await page.click(loginButtonSelector).catch(() => {});
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
          // After login attempt, navigate to Naver Blog home
          const targetUrl = 'https://section.blog.naver.com/BlogHome.naver?directoryNo=0&currentPage=1&groupId=0';
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});

          // Click the Write button which opens a new tab/window
          const writeSelector = 'a[href="https://blog.naver.com/GoBlogWrite.naver"]';
          await page.waitForSelector(writeSelector, { timeout: 15000 }).catch(() => {});
          try {
            const [newPage] = await Promise.all([
              context.waitForEvent('page', { timeout: 15000 }),
              page.click(writeSelector)
            ]);
            await newPage.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
            // Type "hi" using Playwright's keyboard API (fallback)
            try {
              console.log('[DEBUG] [fallback] Typing "hi" using Playwright keyboard API');
              await newPage.bringToFront().catch(() => {});
              await newPage.click('body').catch(() => {});
              console.log('[DEBUG] [fallback] Using keyboard.type to input text');
              await newPage.keyboard.type('hi');
              console.log('[DEBUG] [fallback] Text typed successfully');
            } catch (outerErr) {
              console.warn('[DEBUG] [fallback] Unexpected error while trying to type:', outerErr);
            }

            // Repeat translated steps for fallback path
            try {
              console.log('[DEBUG] [fallback] Switching to mainFrame if present');
              const hasMainFrame = await newPage.locator('#mainFrame').count();
              const mainFrameLocator = newPage.frameLocator('#mainFrame');
              const pageOrFrame = hasMainFrame ? mainFrameLocator : newPage;

              // Draft popup cancel
              try {
                console.log('[DEBUG] [fallback] Attempt to cancel draft popup');
                const cancelBtn = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[4]/div[2]/div[3]/button[1]');
                if (await cancelBtn.count()) {
                  await cancelBtn.click({ timeout: 3000 }).catch(() => {});
                }
              } catch {}

              // Right side popup close
              try {
                console.log('[DEBUG] [fallback] Attempt to close right-side popup');
                const rightCloseBtn = pageOrFrame.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/article/div/header/button');
                if (await rightCloseBtn.count()) {
                  await rightCloseBtn.click({ timeout: 3000 }).catch(() => {});
                }
              } catch {}

              // Help panel close button (fallback)
              try {
                console.log('[DEBUG] [fallback] Attempt to close help panel if present');
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

              const title_field_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[1]/div[1]/div/div/p/span[2]';
              const content_field_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p';
              const text_image_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/header/div[1]/ul/li[17]/button';
              const image_keyword_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/aside/div/div[1]/input';
              const first_image_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/aside/div/div[3]/div/ul/div/li[1]/div/div[2]';
              const help_panel_close_xpath = 'xpath=/html/body/div[1]/div[1]/div[3]/div/div/div[1]/div/div[1]/article/div/header/button';

              try { await pageOrFrame.locator(text_image_xpath).click({ timeout: 5000 }); } catch {}
              try {
                const keywordField = pageOrFrame.locator(image_keyword_xpath);
                if (await keywordField.count()) {
                  await keywordField.click({ timeout: 5000 });
                  await keywordField.fill('EGDesk Test Title');
                  await keywordField.press('Enter');
                  await newPage.waitForTimeout(1000);
                }
              } catch {}
              try {
                const firstImage = pageOrFrame.locator(first_image_xpath);
                if (await firstImage.count()) await firstImage.click({ timeout: 5000 }).catch(() => {});
              } catch {}
              // Extra attempt to close help panel via explicit XPath in fallback
              try {
                const explicitClose = pageOrFrame.locator(help_panel_close_xpath);
                if (await explicitClose.count()) await explicitClose.click({ timeout: 2000 }).catch(() => {});
              } catch {}
              try {
                const titleField = pageOrFrame.locator(title_field_xpath);
                if (await titleField.count()) { await titleField.click({ timeout: 10000 }); await newPage.keyboard.type('EGDesk Test Title'); }
              } catch {}
              try {
                const contentField = pageOrFrame.locator(content_field_xpath);
                if (await contentField.count()) {
                  await contentField.click({ timeout: 20000 });
                  await newPage.keyboard.type('EGDesk Test Content');
                  await newPage.keyboard.press('Enter');
                  await newPage.keyboard.type('#egdesk #playwright');
                }
              } catch {}
            } catch (scriptErr) {
              console.warn('[DEBUG] [fallback] Error running translated Playwright steps:', scriptErr);
            }
          } catch (clickErr) {
            console.warn('Write button click/new page open issue:', clickErr);
          }
        }
      } catch (formErr) {
        console.warn('Login form interaction issue:', formErr);
      }
  return { success: true };
    }
    return { success: false, error: String(error && error.message ? error.message : error) };
  }
}

async function typeTextWithKeyboard(keyboardKeys, text, page = null) {
  try {
    console.log(`[AUTOMATOR] Attempting to type "${text}" using keyboard coordinates...`);
    
    // Create a mapping of characters to their positions
    const charMap = {};
    Object.entries(keyboardKeys).forEach(([keyLabel, keyData]) => {
      // Extract character from the label field (e.g., "Key: n / ㅜ" -> "n")
      let char = '';
      
      // Parse the label field to extract the main character
      const label = keyData.label || '';
      if (label.toLowerCase().includes('key:')) {
        // Format: "Key: n / ㅜ" -> extract "n"
        const match = label.match(/key:\s*([a-z0-9])/i);
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
        // Fallback: try to extract single character from label
        const singleCharMatch = label.match(/\b([a-z0-9])\b/i);
        if (singleCharMatch) {
          char = singleCharMatch[1].toLowerCase();
        }
      }
      
      // If we found a valid character, map it
      if (char && ((char.length === 1 && /[a-z0-9]/.test(char)) || char === 'enter' || char === 'shift' || char === ' ')) {
        charMap[char] = keyData;
        console.log(`[AUTOMATOR] Mapped character '${char}' from label: '${label}'`);
      }
    });
    
    console.log('[AUTOMATOR] Available characters:', Object.keys(charMap));
    
    // Click on the first 5 characters to test accuracy
    const textToDebug = text.toLowerCase().substring(0, 5);
    console.log(`[AUTOMATOR] Clicking on first 5 characters: "${textToDebug}"`);
    
    for (let i = 0; i < textToDebug.length; i++) {
      const char = textToDebug[i];
      if (charMap[char]) {
        const keyData = charMap[char];
        console.log(`[AUTOMATOR] Clicking '${char}' at position (${keyData.position.x}, ${keyData.position.y})`);
        
        if (page) {
          try {
            // Take a screenshot before clicking for debugging
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotPath = path.join(process.cwd(), 'output', `key-${char}-${i + 1}-before-${timestamp}.png`);
            
            // Take screenshot of the key bounds before clicking
            await page.screenshot({
              path: screenshotPath,
              clip: {
                x: keyData.bounds.x,
                y: keyData.bounds.y,
                width: keyData.bounds.width,
                height: keyData.bounds.height
              }
            });
            
            console.log(`[AUTOMATOR] Pre-click screenshot saved: ${screenshotPath}`);
            console.log(`[AUTOMATOR] Key '${char}' bounds: x=${keyData.bounds.x}, y=${keyData.bounds.y}, w=${keyData.bounds.width}, h=${keyData.bounds.height}`);
            
            // Move mouse to the key position and click
            await page.mouse.move(keyData.position.x, keyData.position.y);
            await page.waitForTimeout(100); // Small delay before clicking
            await page.mouse.click(keyData.position.x, keyData.position.y);
            await page.waitForTimeout(200); // Delay after clicking
            
            console.log(`[AUTOMATOR] Successfully clicked '${char}' at (${keyData.position.x}, ${keyData.position.y})`);
            
            // Take a screenshot after clicking to see the result
            const afterScreenshotPath = path.join(process.cwd(), 'output', `key-${char}-${i + 1}-after-${timestamp}.png`);
            await page.screenshot({
              path: afterScreenshotPath,
              clip: {
                x: keyData.bounds.x,
                y: keyData.bounds.y,
                width: keyData.bounds.width,
                height: keyData.bounds.height
              }
            });
            console.log(`[AUTOMATOR] Post-click screenshot saved: ${afterScreenshotPath}`);
            
          } catch (clickError) {
            console.error(`[AUTOMATOR] Failed to click '${char}':`, clickError);
          }
        } else {
          console.log(`[AUTOMATOR] No page object available, would click at (${keyData.position.x}, ${keyData.position.y})`);
        }
      } else {
        console.warn(`[AUTOMATOR] Character '${char}' not found in keyboard mapping`);
      }
    }
    
    console.log(`[AUTOMATOR] Finished typing "${text}"`);
  } catch (error) {
    console.error('[AUTOMATOR] Error typing text:', error);
  }
}

async function processSegmentationResults(segmentationResults, screenshotPath, elementBoxes = null, page = null) {
  try {
    console.log('[AUTOMATOR] Processing segmentation results...');
    console.log('[AUTOMATOR] Found', segmentationResults.length, 'objects in the image');
    
    // If we have element boxes, calculate keyboard key positions
    if (elementBoxes && elementBoxes.targetImage) {
      console.log('[AUTOMATOR] Calculating keyboard key positions...');
      console.log('[AUTOMATOR] Target image bounds:', elementBoxes.targetImage);
      
      const targetImageBox = elementBoxes.targetImage;
      const keyboardKeys = {};
      
      // Process each segmented object
      segmentationResults.forEach((obj, index) => {
        const aiBox = obj.box_2d; // [ymin, xmin, ymax, xmax] from AI (normalized 0-1000)
        // Use label as primary key label, fallback to index
        const keyLabel = obj.label || `key_${index}`;
        
        // Convert from [ymin, xmin, ymax, xmax] format to [x, y, width, height]
        const [ymin, xmin, ymax, xmax] = aiBox;
        const normalizedX = xmin / 1000; // Convert from 0-1000 to 0-1
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
      
      // Log keyboard keys by category
      console.log('\n[AUTOMATOR] ===== KEYBOARD KEY POSITIONS =====');
      
      // Group by label type
      const byType = {};
      Object.entries(keyboardKeys).forEach(([key, data]) => {
        if (!byType[data.label]) byType[data.label] = {};
        byType[data.label][key] = data;
      });
      
      // Log each type
      Object.entries(byType).forEach(([type, keys]) => {
        console.log(`\n[AUTOMATOR] ${type.toUpperCase()} KEYS:`);
        Object.entries(keys).forEach(([keyLabel, keyData]) => {
          console.log(`[AUTOMATOR] ${keyLabel}: position(${keyData.position.x}, ${keyData.position.y}) bounds(${keyData.bounds.x}, ${keyData.bounds.y}, ${keyData.bounds.width}, ${keyData.bounds.height})`);
        });
      });
      
      // Log all keys in a single summary
      console.log('\n[AUTOMATOR] ===== ALL KEYS SUMMARY =====');
      Object.entries(keyboardKeys).forEach(([keyLabel, keyData]) => {
        console.log(`[AUTOMATOR] ${keyLabel}: (${keyData.position.x}, ${keyData.position.y})`);
      });
      
      // Try to click "hello" using the keyboard coordinates
      if (keyboardKeys && Object.keys(keyboardKeys).length > 0) {
        console.log('\n[AUTOMATOR] ===== TYPING "HELLO" =====');
        await typeTextWithKeyboard(keyboardKeys, 'hello', page);
      }
      
      return { success: true, processed: segmentationResults.length, keyboardKeys };
    } else {
      // Fallback: just log basic info
      segmentationResults.forEach((obj, index) => {
        console.log(`[AUTOMATOR] Object ${index + 1}:`, {
          label: obj.label,
          box: obj.box_2d,
          mask: obj.mask
        });
      });
      
      const buttons = segmentationResults.filter(obj => obj.label === 'button');
      const numbers = segmentationResults.filter(obj => obj.label === 'number');
      const characters = segmentationResults.filter(obj => obj.label === 'character');
      
      console.log('[AUTOMATOR] Summary:');
      console.log('[AUTOMATOR] - Buttons found:', buttons.length);
      console.log('[AUTOMATOR] - Numbers found:', numbers.length);
      console.log('[AUTOMATOR] - Characters found:', characters.length);
      
      return { success: true, processed: segmentationResults.length };
    }
  } catch (error) {
    console.error('[AUTOMATOR] Error processing segmentation results:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { runAutomation, processSegmentationResults };