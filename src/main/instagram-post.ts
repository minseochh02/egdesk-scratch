import { Page } from "playwright";
import {
  generateInstagramContent,
  GeneratedInstagramContent,
  InstagramContentPlan,
} from "./business-identity/sns/instagram/generate-text-content";

export interface PostOptions {
  imagePath: string;
  caption?: string;
  structuredPrompt?: InstagramContentPlan;
  waitAfterShare?: number; // milliseconds to wait after clicking Share
}

export type { InstagramContentPlan, GeneratedInstagramContent } from "./business-identity/sns/instagram/generate-text-content";

/**
 * Instagram post upload function
 * Note: In headless mode, Instagram opens in English, so selectors use English text.
 * If not headless, you may need to adjust selectors for other languages.
 */
export async function createInstagramPost(
  page: Page,
  options: PostOptions
): Promise<GeneratedInstagramContent | undefined> {
  const { imagePath, waitAfterShare = 10000 } = options;
  const { caption, generated } = await resolveCaption(options);

  // Click the "New post" button with multiple fallback selectors
  console.log('[createInstagramPost] Looking for New post button...');
  
  const possibleSelectors = [
    "[aria-label='New post']",
    "[aria-label='New Post']",
    "[aria-label='Create']",
    "svg[aria-label='New post']",
    "svg[aria-label='New Post']",
    "svg[aria-label='Create']",
    "a[href='#'][role='link'] svg", // Generic create button
    "a[href*='/create/'] svg", // Create page link
  ];

  let postButton = null;
  let usedSelector = '';
  
  for (const selector of possibleSelectors) {
    try {
      const button = page.locator(selector).first();
      const count = await button.count();
      if (count > 0) {
        const isVisible = await button.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          postButton = button;
          usedSelector = selector;
          console.log(`[createInstagramPost] Found button with selector: ${selector}`);
          break;
        }
      }
    } catch (e) {
      // Continue to next selector
    }
  }

  if (!postButton) {
    console.error('[createInstagramPost] Could not find New post button with any selector');
    console.log('[createInstagramPost] Current URL:', page.url());
    
    // Take screenshot for debugging
    try {
      const { app } = require('electron');
      const os = require('os');
      const fs = require('fs');
      const path = require('path');
      const tempDir = app?.getPath?.('temp') || os.tmpdir();
      const screenshotDir = path.join(tempDir, 'egdesk-instagram-screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      const screenshotPath = path.join(screenshotDir, `instagram_debug_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`[createInstagramPost] Screenshot saved to: ${screenshotPath}`);
    } catch (e) {
      console.error('[createInstagramPost] Could not take screenshot:', e);
    }
    
    throw new Error('Could not find Instagram "New post" button. Instagram UI may have changed.');
  }

  console.log(`[createInstagramPost] Clicking New post button (selector: ${usedSelector})`);
  await postButton.click();

  // Upload the image file
  // Note: setInputFiles works with a single file path or array of paths
  await page.setInputFiles('input[type="file"]', imagePath);

  // Click "Next" button (first time - after image selection)
  const nextButton1 = page.getByRole("button", { name: "Next" }).first();
  await nextButton1.waitFor({ state: "visible", timeout: 30_000 });
  await nextButton1.click();

  // Click "Next" button (second time - after filters/edits)
  const nextButton2 = page.getByRole("button", { name: "Next" }).first();
  await nextButton2.waitFor({ state: "visible", timeout: 30_000 });
  await nextButton2.click();

  // Fill in the caption
  const textArea = page.locator("[aria-label='Write a caption...']");
  await textArea.waitFor({ state: "visible", timeout: 30_000 });
  await textArea.fill(caption);

  // Click "Share" button to upload
  const shareButton = page.getByRole("button", { name: "Share" });
  await shareButton.waitFor({ state: "visible", timeout: 30_000 });
  await shareButton.click();

  // Wait for the upload to complete
  await page.waitForTimeout(waitAfterShare);

  return generated;
}

async function resolveCaption(
  options: PostOptions
): Promise<{ caption: string; generated?: GeneratedInstagramContent }> {
  console.log('[resolveCaption] Resolving caption, has caption:', !!options.caption, 'has structuredPrompt:', !!options.structuredPrompt);
  
  if (options.caption && options.caption.trim().length > 0) {
    return { caption: options.caption.trim() };
  }

  if (options.structuredPrompt) {
    console.log('[resolveCaption] Calling generateInstagramContent with structuredPrompt...');
    const generated = await generateInstagramContent(options.structuredPrompt);
    console.log('[resolveCaption] Generated content:', { hasCaption: !!generated.caption, captionLength: generated.caption?.length });
    
    if (!generated.caption || generated.caption.trim().length === 0) {
      throw new Error("AI generation did not return an Instagram caption.");
    }
    return { caption: generated.caption.trim(), generated };
  }

  throw new Error(
    "Instagram caption is required. Provide a caption or a structuredPrompt for AI generation."
  );
}

