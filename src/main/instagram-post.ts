import { Page } from "playwright";
import {
  generateInstagramContent,
  GeneratedInstagramContent,
  InstagramContentPlan,
} from "./instagram/generate-instagram-content";

export interface PostOptions {
  imagePath: string;
  caption?: string;
  structuredPrompt?: InstagramContentPlan;
  waitAfterShare?: number; // milliseconds to wait after clicking Share
}

export type { InstagramContentPlan, GeneratedInstagramContent } from "./instagram/generate-instagram-content";

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

  // Click the "New post" button
  const postButton = page.locator("[aria-label='New post']");
  await postButton.waitFor({ state: "visible", timeout: 30_000 });
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
  if (options.caption && options.caption.trim().length > 0) {
    return { caption: options.caption.trim() };
  }

  if (options.structuredPrompt) {
    const generated = await generateInstagramContent(options.structuredPrompt);
    if (!generated.caption || generated.caption.trim().length === 0) {
      throw new Error("AI generation did not return an Instagram caption.");
    }
    return { caption: generated.caption.trim(), generated };
  }

  throw new Error(
    "Instagram caption is required. Provide a caption or a structuredPrompt for AI generation."
  );
}

