import { Page } from "playwright";

export interface PostOptions {
  imagePath: string;
  caption: string;
  waitAfterShare?: number; // milliseconds to wait after clicking Share
}

/**
 * Instagram post upload function
 * Note: In headless mode, Instagram opens in English, so selectors use English text.
 * If not headless, you may need to adjust selectors for other languages.
 */
export async function createInstagramPost(
  page: Page,
  options: PostOptions
): Promise<void> {
  const { imagePath, caption, waitAfterShare = 10000 } = options;

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
}

