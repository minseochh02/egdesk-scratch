// browser-controller.ts
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { 
  convertHtmlToSmartEditorJson as htmlToJson_convertHtmlToSmartEditorJson,
  convertHtmlToSmartEditorJsonWithImages as htmlToJson_convertHtmlToSmartEditorJsonWithImages,
  replaceImagePlaceholdersInJson as htmlToJson_replaceImagePlaceholdersInJson
} from './html-to-smarteditor';
import { clipboard } from 'electron';
import path from 'path';
// We'll use a simple UUID generator instead of importing uuid
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
 * Ensure clipboard permissions are granted (dialog + context grant)
 */
async function handleClipboardPermission(newPage: Page, context: BrowserContext): Promise<void> {
  try {
    console.log('[NAVER] Setting up clipboard permission handler...');
    newPage.on('dialog', async dialog => {
      const msg = dialog.message().toLowerCase();
      if (msg.includes('clipboard') || msg.includes('wants to') || msg.includes('see text and images')) {
        console.log('[NAVER] Clipboard permission dialog detected, accepting...');
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://blog.naver.com' });
      console.log('[NAVER] Clipboard permissions granted via context');
    } catch (permErr) {
      console.log('[NAVER] Context permission grant failed:', permErr instanceof Error ? permErr.message : 'Unknown error');
    }
    // Probe clipboard to trigger permission prompt if needed
    try {
      await newPage.waitForTimeout(1000);
      await newPage.evaluate(async () => {
        try {
          await navigator.clipboard.read();
        } catch {}
      });
    } catch {}
  } catch (error) {
    console.log('[NAVER] Error setting up clipboard permissions:', error instanceof Error ? error.message : 'Unknown error');
  }
}


// Removed duplicate: replaceImagePlaceholdersInJson (use import from html-to-smarteditor)

/**
 * Inject SmartEditor JSON into the editor
 */
async function injectSmartEditorJson(newPage: Page, smartEditorJson: any): Promise<{ ok: boolean; reason?: string }> {
  try {
    console.log('[NAVER] Injecting SmartEditor JSON into editor...');
    
    const injected = await newPage.evaluate(async (incoming) => {
      try {
        // Wait helper
        const waitFor = (ms: number) => new Promise(r => setTimeout(r, ms));
        
        // Access the iframe
        const iframe = document.querySelector('#mainFrame');
        if (!iframe) {
          console.warn('[NAVER] No iframe found');
          return { ok: false, reason: 'no_iframe' };
        }
        
        const iframeWindow = (iframe as HTMLIFrameElement).contentWindow;
        if (!iframeWindow) {
          console.warn('[NAVER] Cannot access iframe contentWindow');
          return { ok: false, reason: 'no_iframe_window' };
        }
        
        // Find editor dynamically
        const editors = ((iframeWindow as any).SmartEditor && (iframeWindow as any).SmartEditor._editors) || {};
        const editorKey = Object.keys(editors).find(k => k && k.startsWith('blogpc')) || Object.keys(editors)[0];
        const editor = editorKey ? editors[editorKey] : null;
        if (!editor) {
          console.warn('[NAVER] SmartEditor editor not found');
          return { ok: false, reason: 'no_editor' };
        }
        const docService = editor._documentService || editor.documentService;
        if (!docService) {
          console.warn('[NAVER] SmartEditor documentService not found');
          return { ok: false, reason: 'no_doc_service' };
        }
        
        // Replace the entire document with our content
        if (typeof docService.setDocumentData === 'function') {
          docService.setDocumentData(incoming);
        } else {
          docService._documentData = incoming;
        }
        if (docService._notifyChanged) docService._notifyChanged();
        
        console.log('[NAVER] SmartEditor document data replaced successfully');
        return { ok: true };
      } catch (err) {
        console.warn('[NAVER] Error during SmartEditor injection:', err);
        return { ok: false, reason: String(err instanceof Error ? err.message : err) };
      }
    }, smartEditorJson);
    
    return injected;
  } catch (error) {
    console.error('[NAVER] Error injecting SmartEditor JSON:', error);
    return { ok: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Extract image components from the current SmartEditor document
 */
async function extractImageComponentsFromDocument(newPage: Page): Promise<any[]> {
  try {
    console.log('[NAVER] Extracting image components from current document...');
    
    const imageComponents = await newPage.evaluate(() => {
      try {
        // Access the iframe
        const iframe = document.querySelector('#mainFrame');
        if (!iframe) {
          console.warn('[NAVER] No iframe found for image extraction');
          return [];
        }
        
        const iframeWindow = (iframe as HTMLIFrameElement).contentWindow;
        if (!iframeWindow) {
          console.warn('[NAVER] Cannot access iframe contentWindow for image extraction');
          return [];
        }
        
        // Get the editor and document data
        const editors = ((iframeWindow as any).SmartEditor && (iframeWindow as any).SmartEditor._editors) || {};
        const editorKey = Object.keys(editors).find(k => k && k.startsWith('blogpc')) || Object.keys(editors)[0];
        const editor = editorKey ? editors[editorKey] : null;
        
        if (!editor) {
          console.warn('[NAVER] SmartEditor editor not found for image extraction');
          return [];
        }
        
        const docService = editor._documentService || editor.documentService;
        if (!docService) {
          console.warn('[NAVER] SmartEditor documentService not found for image extraction');
          return [];
        }
        
        const documentData = docService.getDocumentData();
        if (!documentData || !documentData.document || !documentData.document.components) {
          console.warn('[NAVER] No document data found for image extraction');
          return [];
        }
        
        // Find all image components
        const imageComponents = documentData.document.components.filter((comp: any) => comp['@ctype'] === 'image');
        console.log(`[NAVER] Found ${imageComponents.length} image components in document`);
        
        return imageComponents;
      } catch (err) {
        console.error('[NAVER] Error extracting image components:', err);
        return [];
      }
    });
    
    console.log(`[NAVER] Successfully extracted ${imageComponents.length} image components`);
    return imageComponents;
  } catch (error) {
    console.error('[NAVER] Error extracting image components from document:', error);
    return [];
  }
}

/**
 * Find the XPath to the parent element of a text marker.
 */
async function getXPathForMarker(newPage: Page, markerText: string, occurrenceIndex: number): Promise<string | null> {
  try {
    const result: { xpath?: string; error?: string; details?: any } = await newPage.evaluate(({ markerText, occurrenceIndex }) => {
      const getElementXpath = (element: HTMLElement | null): string | null => {
        if (!element) return null;
        // Prioritize the SE- id as it's stable
        if (element.id && element.id.startsWith('SE-')) return `//*[@id='${element.id}']`;
        if (element.tagName === 'BODY') return '/html/body';
        
        let ix = 0;
        const siblings = element.parentElement?.children || new HTMLCollection();
        for (let i = 0; i < siblings.length; i++) {
          const sibling = siblings[i];
          if (sibling === element) {
            const parentXpath = getElementXpath(element.parentElement);
            // Make sure parentXpath is not null
            if (!parentXpath) return null;
            return `${parentXpath}/${element.tagName.toLowerCase()}[${ix + 1}]`;
          }
          if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
          }
        }
        return null;
      };

      try {
        const iframe = document.querySelector('#mainFrame') as HTMLIFrameElement | null;
        if (!iframe?.contentDocument) return { error: 'iframe_not_found' };

        const doc = iframe.contentDocument;
        const contentRoot = doc.querySelector('.se-content') || doc.body;
        const walker = doc.createTreeWalker(contentRoot, NodeFilter.SHOW_TEXT);
        const matches: Text[] = [];
        let node: Node | null;
        while (node = walker.nextNode()) {
          if (node.nodeValue?.includes(markerText)) {
            matches.push(node as Text);
          }
        }

        if (matches.length <= occurrenceIndex) {
            return {
                error: 'marker_not_found_in_text_nodes',
                details: {
                    searchedFor: markerText,
                    matchesFound: matches.length,
                    occurrenceSought: occurrenceIndex,
                    bodyText: (contentRoot as HTMLElement).innerText.substring(0, 1000)
                }
            };
        }
        
        const parentElement = matches[occurrenceIndex].parentElement;
        const xpath = getElementXpath(parentElement);
        if (!xpath) {
            return { error: 'xpath_generation_failed', details: { parentTag: parentElement?.tagName } };
        }
        return { xpath };

      } catch (e: any) {
        return { error: 'evaluation_exception', details: { message: e.message } };
      }
    }, { markerText, occurrenceIndex });

    if (result.xpath) {
      return result.xpath;
    }
    
    console.warn(`[NAVER] getXPathForMarker failed. Reason: ${result.error}`, result.details || '');
    return null;

  } catch (error) {
    console.error('[NAVER] Error executing getXPathForMarker:', error);
    return null;
  }
}

/**
 * Replace markers in the editor with pasted images via clipboard
 */
async function replaceMarkersWithPastedImages(pageOrFrame: any, newPage: Page, contentText: string, imagePaths?: string[]): Promise<void> {
  try {
    if (!imagePaths || imagePaths.length === 0) {
      console.log('[NAVER] No image paths provided for marker replacement');
      return;
    }
    const imagePlaceholderRegex = /\[IMAGE:([^:]+):([^\]]+)\]/g;
    const matches = Array.from(contentText.matchAll(imagePlaceholderRegex));
    console.log(`[NAVER] Replacing ${matches.length} markers with pasted images`);
    if (matches.length === 0) return;

    const seenMarkers = new Map<string, number>();
    for (let i = 0; i < matches.length; i++) {
      const placeholder = matches[i][0];
      const imagePath = imagePaths[i] || imagePaths[imagePaths.length - 1];
      console.log(`[NAVER] Processing marker ${i + 1}: ${placeholder}`);

      const occurrence = seenMarkers.get(placeholder) || 0;
      const markerXPath = await getXPathForMarker(newPage, placeholder, occurrence);
      seenMarkers.set(placeholder, occurrence + 1);
      
      let pasted = false;

      if (markerXPath) {
        try {
          console.log(`[NAVER] Found XPath for marker: ${markerXPath}`);
          const markerLocator = newPage.frameLocator('#mainFrame').locator(`xpath=${markerXPath}`);
          console.log('[NAVER] Attempting to double-click the marker to select it...');
          await markerLocator.dblclick({ timeout: 5000 });
          console.log('[NAVER] Double-click successful.');
          pasted = await addImageToBlog(pageOrFrame, newPage, imagePath, undefined, { skipFocus: true });
        } catch (e) {
          console.warn(`[NAVER] Failed to click marker XPath, falling back. Error: ${e instanceof Error ? e.message : 'Unknown'}`);
          pasted = await addImageToBlog(pageOrFrame, newPage, imagePath);
        }
      } else {
        console.warn(`[NAVER] Could not find XPath for marker #${i + 1}; attempting generic paste.`);
        pasted = await addImageToBlog(pageOrFrame, newPage, imagePath);
      }

      if (pasted) {
        console.log(`[NAVER] Marker #${i + 1} replaced with image`);
      } else {
        console.warn(`[NAVER] Failed to paste image for marker #${i + 1}`);
      }

      await newPage.waitForTimeout(500);
    }
  } catch (error) {
    console.error('[NAVER] Error replacing markers with pasted images:', error);
  }
}

/**
 * Find and click the text editor using the same selectors as the working fallback method
 */
async function findAndClickTextEditor(pageOrFrame: any, newPage: Page): Promise<any> {
  try {
    console.log('[NAVER] Finding text editor using working selectors...');
    
    // Use the same selectors as the working fallback method
    const content_field_selectors = [
      'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p[1]', // First paragraph
      'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p', // Any paragraph
      '.se-text-paragraph', // Class-based selector
      '[contenteditable="true"]' // Contenteditable elements
    ];
    
    // Try multiple selectors to find the right content field
    let targetField = null;
    let usedSelector = '';
    
    for (const selector of content_field_selectors) {
      console.log(`[NAVER] Trying text editor selector: ${selector}`);
      const field = pageOrFrame.locator(selector);
      const count = await field.count();
      console.log(`[NAVER] Found ${count} element(s) with selector: ${selector}`);
      
      if (count > 0) {
        targetField = field.first();
        usedSelector = selector;
        console.log(`[NAVER] Using text editor selector: ${selector}`);
        break;
      }
    }
    
    if (targetField) {
      console.log('[NAVER] Clicking on text editor...');
      await targetField.click({ timeout: 20000 });
      console.log('[NAVER] Text editor clicked successfully');
      return targetField;
    } else {
      console.warn('[NAVER] No suitable text editor found with any selector');
      return null;
    }
  } catch (error) {
    console.error('[NAVER] Error finding text editor:', error);
    return null;
  }
}

/**
 * Add image to blog post using clipboard paste
 * @param targetField - The original content field we typed content into
 */
async function addImageToBlog(pageOrFrame: any, newPage: Page, imagePath: string, targetField?: any, options?: { skipFocus?: boolean }): Promise<boolean> {
  try {
    console.log('[NAVER] Adding image to blog post...');
    
    // Copy image to clipboard using Playwright
    const { copyImageToClipboardWithPlaywright } = require('../ai-blog/generate-dog-image');
    const clipboardSuccess = await copyImageToClipboardWithPlaywright(imagePath, newPage);
    
    if (!clipboardSuccess) {
      console.warn('[NAVER] Failed to copy image to clipboard');
      return false;
    }
    
    console.log('[NAVER] Clipboard copy successful, attempting to paste...');
    
    let actualTargetField = targetField;
    if (!options?.skipFocus) {
      console.log('[NAVER] Focusing editor inside iframe...');
      
      if (!actualTargetField) {
        actualTargetField = await findAndClickTextEditor(pageOrFrame, newPage);
      } else {
        console.log('[NAVER] Using provided targetField');
        await actualTargetField.click({ timeout: 10000 });
      }

      if (!actualTargetField) {
        console.warn('[NAVER] Could not find text editor, trying fallback approach');
        // Fallback: try to click on body
        await newPage.click('body');
      }
    } else {
      console.log('[NAVER] Focus skipped, pasting at current cursor location.');
    }
    
    await newPage.waitForTimeout(500);
    
    // Phase 2: Try multiple paste methods
    const isMac = process.platform === 'darwin';
    console.log(`[NAVER] Method 1: Using ${isMac ? 'Meta+v' : 'Control+v'}`);
    await newPage.keyboard.press(isMac ? 'Meta+v' : 'Control+v');
    console.log('[NAVER] Waiting 5 seconds for image to render after paste...');
    await newPage.waitForTimeout(5000); // Increased wait time for image processing
    
    // Check if image was pasted by looking for img tags
    let imgCount = await newPage.locator('img').count();
    console.log(`[NAVER] Found ${imgCount} images on page after paste attempt`);
    
    if (imgCount === 0) {
      console.log('[NAVER] Primary paste method failed. All fallbacks are currently disabled for debugging.');
      /*
      console.log('[NAVER] Method 1 failed, trying Method 2: Right-click paste on targetField');
      // Avoid browser-level context menu; re-focus and try keyboard again
      if (actualTargetField) await actualTargetField.focus().catch(() => {});
      await newPage.waitForTimeout(200);
      await newPage.keyboard.press(isMac ? 'Meta+v' : 'Control+v');
      await newPage.waitForTimeout(2000);
      
      imgCount = await newPage.locator('img').count();
      console.log(`[NAVER] Found ${imgCount} images after right-click paste`);
      
      if (imgCount === 0) {
        console.log('[NAVER] Method 2 failed, trying Method 3: Focus targetField and paste');
        try {
          console.log('[NAVER] Method 3a: Focus targetField and paste with keyboard');
          if (actualTargetField) {
            await actualTargetField.focus();
          } else {
            await pageOrFrame.locator('[contenteditable="true"]').first().focus();
          }
          await newPage.waitForTimeout(200);
          await newPage.keyboard.press('Control+v');
          await newPage.waitForTimeout(2000);
          
          imgCount = await newPage.locator('img').count();
          console.log(`[NAVER] Found ${imgCount} images after focus paste`);
          
          if (imgCount === 0) {
            console.log('[NAVER] Method 3b: Try pasting with Shift+Insert');
            await newPage.keyboard.press('Shift+Insert');
            await newPage.waitForTimeout(2000);
            
            imgCount = await newPage.locator('img').count();
            console.log(`[NAVER] Found ${imgCount} images after Shift+Insert paste`);
            
            if (imgCount === 0) {
              console.log('[NAVER] Method 3c: Try pasting with Cmd+V (Mac)');
              await newPage.keyboard.press('Meta+v');
              await newPage.waitForTimeout(2000);
              
              imgCount = await newPage.locator('img').count();
              console.log(`[NAVER] Found ${imgCount} images after Cmd+V paste`);
            }
          }
        } catch (altPasteError) {
          console.log('[NAVER] Alternative paste methods failed:', altPasteError instanceof Error ? altPasteError.message : 'Unknown error');
        }
      }
      */
    }
    
    // Final check for images
    const finalImgCount = await newPage.locator('img').count();
    if (finalImgCount > 0) {
      console.log('[NAVER] Image pasted successfully!');
      return true;
    } else {
      console.warn('[NAVER] All paste methods failed - no images found on page');
      return false;
    }
  } catch (error) {
    console.error('[NAVER] Error adding image to blog:', error);
    return false;
  }
}

/**
 * Process content and handle image placeholders - IMAGE PASTING MODE
 * Uses the same pattern as WordPress: [IMAGE:description:placement]
 */
async function processContentWithImages(pageOrFrame: any, newPage: Page, content: BlogContent, imagePath?: string, targetField?: any): Promise<void> {
  try {
    console.log('[NAVER] Processing content with image placeholders...');
    
    // Use the same regex pattern as WordPress: [IMAGE:description:placement]
    const imagePlaceholderRegex = /\[IMAGE:([^:]+):([^\]]+)\]/g;
    const contentText = content.content;
    
    // Find all image placeholders
    const imageMatches = Array.from(contentText.matchAll(imagePlaceholderRegex));
    console.log(`[NAVER] Found ${imageMatches.length} image placeholders in content`);
    
    if (imageMatches.length === 0) {
      // No image placeholders, skip image processing
      console.log('[NAVER] No image placeholders found, skipping image processing');
      return;
    }
    
    // Process only image placeholders - paste images only
    for (let i = 0; i < imageMatches.length; i++) {
      const match = imageMatches[i];
      const placeholder = match[0]; // Full match like [IMAGE:description:placement]
      const description = match[1]; // Just the description part
      const placement = match[2]; // The placement part (header, footer, etc.)
      
      console.log(`[NAVER] Processing image placeholder ${i + 1}: "${placeholder}" (description: ${description}, placement: ${placement})`);
      
      // Wait for content to be stable before pasting image
      await newPage.waitForTimeout(500);
      
      if (imagePath) {
        console.log('[NAVER] Attempting to paste image...');
        const imageSuccess = await addImageToBlog(pageOrFrame, newPage, imagePath, targetField);
        if (imageSuccess) {
          await newPage.keyboard.press('Enter');
          console.log(`[NAVER] Image pasted successfully for placeholder: ${description} (${placement})`);
        } else {
          console.log(`[NAVER] Image paste failed for placeholder: ${description} (${placement})`);
        }
      } else {
        console.log(`[NAVER] No image path provided for placeholder: ${description} (${placement})`);
      }
    }
    
    console.log('[NAVER] Image processing completed');
    
  } catch (error) {
    console.error('[NAVER] Error processing content with images:', error);
  }
}

/**
 * Process content and handle image placeholders for SmartEditor JSON
 * Uses the same pattern as WordPress: [IMAGE:description:placement]
 */
// Moved: processContentWithImagesForJson → html-to-smarteditor.ts

/**
 * Advanced image handling: Paste image and extract JSON from SmartEditor
 * This function would be called during the actual blog posting process
 */
async function handleImagePlaceholdersWithSmartEditor(
  pageOrFrame: any, 
  newPage: Page, 
  htmlContent: string, 
  imagePaths?: string[]
): Promise<{ processedContent: string, imageComponents: any[] }> {
  try {
    console.log('[NAVER] Handling image placeholders with SmartEditor...');
    
    // Find image placeholders
    const imagePlaceholderRegex = /\[IMAGE:([^\]]+)\]/g;
    const imageMatches = Array.from(htmlContent.matchAll(imagePlaceholderRegex));
    
    if (imageMatches.length === 0) {
      return { processedContent: htmlContent, imageComponents: [] };
    }
    
    let processedContent = htmlContent;
    const imageComponents: any[] = [];
    
    for (let i = 0; i < imageMatches.length; i++) {
      const match = imageMatches[i];
      const placeholder = match[0];
      const description = match[1];
      
      console.log(`[NAVER] Processing image placeholder ${i + 1}: ${description}`);
      
      // Get the corresponding image path for this placeholder
      const imagePath = imagePaths && imagePaths[i] ? imagePaths[i] : undefined;
      
      if (imagePath) {
        try {
          // 1. Paste the image into SmartEditor
          const imageSuccess = await addImageToBlog(pageOrFrame, newPage, imagePath);
          
          if (imageSuccess) {
            // 2. Wait for image to be processed
            await newPage.waitForTimeout(2000);
            
            // 3. Extract the image JSON from SmartEditor
            const imageJson = await newPage.evaluate(() => {
              try {
                // Access the iframe
                const iframe = document.querySelector('#mainFrame');
                if (!iframe) return null;
                
                const iframeWindow = (iframe as HTMLIFrameElement).contentWindow;
                if (!iframeWindow) return null;
                
                // Get the editor and document data
                const editors = ((iframeWindow as any).SmartEditor && (iframeWindow as any).SmartEditor._editors) || {};
                const editorKey = Object.keys(editors).find(k => k && k.startsWith('blogpc')) || Object.keys(editors)[0];
                const editor = editorKey ? editors[editorKey] : null;
                
                if (!editor) return null;
                
                const docService = editor._documentService || editor.documentService;
                if (!docService) return null;
                
                const documentData = docService.getDocumentData();
                if (!documentData || !documentData.document || !documentData.document.components) return null;
                
                // Find the most recent image component
                const imageComponents = documentData.document.components.filter((comp: any) => comp['@ctype'] === 'image');
                return imageComponents[imageComponents.length - 1] || null;
              } catch (err) {
                console.error('[NAVER] Error extracting image JSON:', err);
                return null;
              }
            });
            
            if (imageJson) {
              console.log(`[NAVER] Successfully extracted image JSON for placeholder: ${description}`);
              imageComponents.push(imageJson);
              
              // Replace placeholder with marker
              processedContent = processedContent.replace(placeholder, `[IMAGE_COMPONENT_${imageComponents.length - 1}]`);
            } else {
              console.warn(`[NAVER] Failed to extract image JSON for placeholder: ${description}`);
              // Fallback to text description
              processedContent = processedContent.replace(placeholder, `[Image: ${description}]`);
            }
          } else {
            console.warn(`[NAVER] Failed to paste image for placeholder: ${description}`);
            processedContent = processedContent.replace(placeholder, `[Image: ${description} - Paste Failed]`);
          }
        } catch (error) {
          console.error(`[NAVER] Error handling image placeholder ${i + 1}:`, error);
          processedContent = processedContent.replace(placeholder, `[Image: ${description} - Error]`);
        }
      } else {
        // No image path provided
        processedContent = processedContent.replace(placeholder, `[Image: ${description}]`);
      }
    }
    
    return { processedContent, imageComponents };
  } catch (error) {
    console.error('[NAVER] Error handling image placeholders with SmartEditor:', error);
    return { processedContent: htmlContent, imageComponents: [] };
  }
}

/**
 * Fill blog post content using SmartEditor JSON API
 */
async function fillBlogContent(pageOrFrame: any, newPage: Page, content: BlogContent, imagePaths?: string[]): Promise<void> {
  try {
    console.log('[NAVER] Filling blog content using SmartEditor JSON API...');
    
    // Wait for editor to fully load first
    try {
      console.log('[NAVER] Waiting for SmartEditor to load...');
      
      // Wait for mainFrame to load
      await newPage.waitForSelector('#mainFrame', { timeout: 15000 });
      const frame = newPage.frameLocator('#mainFrame');
      
      // Wait for editor content area
      await frame.locator('.se-content').waitFor({ timeout: 10000 });
      console.log('[NAVER] SmartEditor loaded successfully');
      
      // Find the target field for image pasting (same as fallback method)
      const targetField = await findAndClickTextEditor(pageOrFrame, newPage);
      
      // Test SmartEditor availability first (access via iframe)
      const smartEditorTest = await newPage.evaluate(() => {
        try {
          console.log('[NAVER] Testing SmartEditor availability via iframe...');
          
          // Access the iframe
          const iframe = document.querySelector('#mainFrame');
          if (!iframe) {
            console.log('[NAVER] No iframe found');
            return { available: false, reason: 'no_iframe' };
          }
          
          const iframeWindow = (iframe as HTMLIFrameElement).contentWindow;
          if (!iframeWindow) {
            console.log('[NAVER] Cannot access iframe contentWindow');
            return { available: false, reason: 'no_iframe_window' };
          }
          
          console.log('[NAVER] SmartEditor:', (iframeWindow as any).SmartEditor);
          console.log('[NAVER] SmartEditor._editors:', (iframeWindow as any).SmartEditor?._editors);
          
          if (!(iframeWindow as any).SmartEditor || !(iframeWindow as any).SmartEditor._editors) {
            return { available: false, reason: 'no_smarteditor' };
          }
          
          // Get the editor instance
          const editor = (iframeWindow as any).SmartEditor._editors['blogpc001'];
          console.log('[NAVER] Editor:', editor);
          
          if (!editor) {
            console.log('[NAVER] Available editor keys:', Object.keys((iframeWindow as any).SmartEditor._editors));
            return { available: false, reason: 'no_editor' };
          }
          
          // Get document service
          const docService = editor._documentService;
          console.log('[NAVER] Document Service:', docService);
          
          if (!docService) {
            return { available: false, reason: 'no_docService' };
          }
          
          // Get document data
          const documentData = docService.getDocumentData();
          console.log('[NAVER] Document Data:', documentData);
          
          return { 
            available: true, 
            editor: !!editor, 
            docService: !!docService, 
            documentData: !!documentData,
            editorKeys: Object.keys((iframeWindow as any).SmartEditor._editors)
          };
        } catch (err) {
          console.error('[NAVER] SmartEditor test error:', err);
          return { available: false, reason: err instanceof Error ? err.message : String(err) };
        }
      });
      console.log('[NAVER] SmartEditor test result:', smartEditorTest);

      if (!smartEditorTest.available) {
        console.warn('[NAVER] SmartEditor not available. Fallback disabled for debugging.');
        // await fillBlogContentFallback(pageOrFrame, newPage, content, imagePaths?.[0]);
        return;
      }
      
      // Step 1: Convert HTML (with markers) to JSON and inject TEXT FIRST
      console.log('[NAVER] Step 1: Converting HTML (with markers) to SmartEditor JSON...');
      console.log('[NAVER] DEBUG: Processing HTML content:', content.content.substring(0, 200) + '...');
      const baseSmartEditorJson = htmlToJson_convertHtmlToSmartEditorJson(content.title, content.content, content.tags, undefined, { preserveImageMarkers: true });
      console.log('[NAVER] Injecting base content (markers intact)...');
      const injectedBase = await injectSmartEditorJson(newPage, baseSmartEditorJson);
      if (!injectedBase.ok) {
        console.warn('[NAVER] SmartEditor base injection failed. Fallback disabled for debugging.');
        return;
      }

      // Step 2: Find markers and replace them via clipboard paste (robust detection + diagnostics)
      const markerRegex = /\[IMAGE:[^\]]+\]/g;
      const hasMarkers = markerRegex.test(content.content);
      const imagesProvided = Array.isArray(imagePaths) ? imagePaths.length : 0;
      console.log(`[NAVER] Step 2: Marker detection → hasMarkers=${hasMarkers}, imagePaths=${imagesProvided}`);
      if (hasMarkers) {
        if (!imagePaths || imagePaths.length === 0) {
          console.warn('[NAVER] Markers detected but no imagePaths provided. Skipping marker replacement.');
        } else {
          console.log('[NAVER] Step 2: Replacing markers in-place with pasted images');
          console.log(`[NAVER] First images: ${imagePaths.slice(0, 3).join(', ')}`);
          await replaceMarkersWithPastedImages(pageOrFrame, newPage, content.content, imagePaths);
        }
      } else {
        console.log('[NAVER] Step 2: No markers detected in content');
      }
      return;
      
    } catch (e) {
      console.warn('[NAVER] SmartEditor API method failed. Fallback disabled for debugging:', e);
      // await fillBlogContentFallback(pageOrFrame, newPage, content);
    }
    
    console.log('[NAVER] Blog content filling completed');
  } catch (error) {
    console.error('[NAVER] Error filling blog content:', error);
  }
}

/**
 * Fill blog post content using keyboard typing (fallback method)
 */
async function fillBlogContentFallback(pageOrFrame: any, newPage: Page, content: BlogContent, imagePath?: string): Promise<void> {
  try {
    console.log('[NAVER] Using fallback keyboard typing method...');
    
    // XPath selectors - using same as working code
    const title_field_xpath = 'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[1]/div[1]/div/div/p/span[2]';
    
    // Try multiple content field selectors to find the right one (from working code)
    const content_field_selectors = [
      'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p[1]', // First paragraph
      'xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p', // Any paragraph
      '.se-text-paragraph', // Class-based selector
      '[contenteditable="true"]' // Contenteditable elements
    ];

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

    // Fill content - try multiple selectors like working code
    try {
      console.log('[NAVER] Filling content');
      
      // Try multiple selectors to find the right content field
      let targetField = null;
      let usedSelector = '';
      
      for (const selector of content_field_selectors) {
        console.log(`[NAVER] Trying selector: ${selector}`);
        const field = pageOrFrame.locator(selector);
        const count = await field.count();
        console.log(`[NAVER] Found ${count} element(s) with selector: ${selector}`);
        
        if (count > 0) {
          targetField = field.first(); // Use .first() like working code
          usedSelector = selector;
          console.log(`[NAVER] Using selector: ${selector}`);
          break;
        }
      }
      
      if (targetField) {
        await targetField.click({ timeout: 20000 });
        await newPage.keyboard.press('Control+a');
        await newPage.waitForTimeout(200);
        
        // Step 1: Process image placeholders first (if any)
        if (content.content.includes('[IMAGE:') && imagePath) {
          console.log('[NAVER] Step 1: Processing image placeholders in fallback mode');
          await processContentWithImages(pageOrFrame, newPage, content, imagePath, targetField);
        } else {
          console.log('[NAVER] Step 1: No image placeholders found, skipping image processing');
        }

        // Step 2: Process text content
        console.log('[NAVER] Step 2: Processing text content in fallback mode');
        await newPage.keyboard.type(content.content);
        await newPage.keyboard.press('Enter');
        
        // Add tags
        await newPage.keyboard.type(content.tags);
        console.log('[NAVER] Content and tags filled successfully');
      } else {
        console.warn('[NAVER] No suitable content field found with any selector');
      }
    } catch (e) {
      console.warn('[NAVER] Content fill failed:', e);
    }
    
    console.log('[NAVER] Fallback blog content filling completed');
  } catch (error) {
    console.error('[NAVER] Error in fallback blog content filling:', error);
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
        console.log(`[NAVER] Initial publish button not found with selector: ${selector} - ${waitError instanceof Error ? waitError.message : 'Unknown error'}`);
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
          console.log(`[NAVER] Final publish button not found with selector: ${selector} - ${waitError instanceof Error ? waitError.message : 'Unknown error'}`);
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
          console.log(`[NAVER] Direct final publish button not found with selector: ${selector} - ${waitError instanceof Error ? waitError.message : 'Unknown error'}`);
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
  content: BlogContent,
  imagePaths?: string[]
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
    
    // Ensure clipboard permissions before any paste operations
    await handleClipboardPermission(newPage, context);

    // Handle popups
    await handlePopups(pageOrFrame, newPage);
    
    // Fill blog content
    await fillBlogContent(pageOrFrame, newPage, content, imagePaths);
    
    // Publish blog post
    const publishSuccess = await publishBlogPost(pageOrFrame, newPage);
    
    if (publishSuccess) {
      console.log('[NAVER] Naver Blog automation completed successfully');
      return {
        success: true,
        imageGenerated: !!(imagePaths && imagePaths.length > 0)
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
