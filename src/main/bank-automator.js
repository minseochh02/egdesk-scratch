const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { analyzeImageSegmentation } = require('./ai-vision/test');
const { processSegmentationResults } = require('./automator');


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

async function runWooriAutomation(username, password, proxyUrl, geminiApiKey) {
  const proxy = buildProxyOption(proxyUrl);
  const targetUrl = 'https://spib.wooribank.com/pib/Dream?withyou=CMLGN0001';
  const undesiredHostnames = new Set(['wooribank.com', 'www.wooribank.com']);

  // Helper to get element box { x, y, width, height } for any selector/xpath
  async function getElementBox(pageOrFrame, selector) {
    try {
      const locator = pageOrFrame.locator(selector);
      if (await locator.count()) {
        const handle = await locator.first().elementHandle();
        if (handle) {
          const box = await handle.boundingBox();
          if (box) return { x: box.x, y: box.y, width: box.width, height: box.height };
          // Fallback to DOM API
          const rect = await handle.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          });
          return rect;
        }
      }
    } catch {}
    return null;
  }

  try {
    // Prefer system Chrome if available
    const browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      proxy
    });
    const context = await browser.newContext({
      locale: 'ko-KR'
    });

    // Intercept top-level document requests that try to go to unwanted hostnames
    await context.route('**/*', async (route) => {
      try {
        const request = route.request();
        const isDocument = request.resourceType() === 'document';
        const url = new URL(request.url());
        if (isDocument && undesiredHostnames.has(url.hostname)) {
          // Redirect back to the target spot domain
          return route.fulfill({ status: 302, headers: { location: targetUrl } });
        }
      } catch {}
      return route.continue();
    });

    const page = await context.newPage();

    // If navigation escapes to the undesired domain, push it back to spot
    page.on('framenavigated', (frame) => {
      try {
        if (frame === page.mainFrame()) {
          const u = new URL(frame.url());
          if (undesiredHostnames.has(u.hostname)) {
            page.goto(targetUrl).catch(() => {});
          }
        }
      } catch {}
    });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Try to click the specified XPath input and type "test"
    try {
      const inputXPath = 'xpath=/html/body/div[2]/div[2]/div[3]/div[4]/form/fieldset/div[1]/div/div[2]/dl/dd[1]/ul/li[1]/input';
      // Prefer waiting for it to be visible/enabled
      await page.waitForSelector(inputXPath, { timeout: 10000 });
      const inputLocator = page.locator(inputXPath);
      await inputLocator.click({ timeout: 5000 }).catch(() => {});
      // fill is better for input elements; fallback to type
      await inputLocator.fill('test').catch(async () => {
        await inputLocator.type('test').catch(() => {});
      });
    } catch (e) {
      console.warn('[WOORI] Failed to interact with target input (primary path):', e);
      // Fallback: search same element inside frames if present
      try {
        const frames = page.frames();
        for (const f of frames) {
          try {
            const inputXPath = 'xpath=/html/body/div[2]/div[2]/div[3]/div[4]/form/fieldset/div[1]/div/div[2]/dl/dd[1]/ul/li[1]/input';
            const handle = await f.waitForSelector(inputXPath, { timeout: 3000 });
            if (handle) {
              await handle.click({ timeout: 3000 }).catch(() => {});
              try {
                await handle.fill('test');
              } catch {
                await handle.type('test').catch(() => {});
              }
              break;
            }
          } catch {}
        }
      } catch {}
    }

    // Click the second provided XPath
    try {
      const secondXPath = 'xpath=/html/body/div[2]/div[2]/div[3]/div[4]/form/fieldset/div[1]/div/div[2]/dl/dd[1]/ul/li[2]/div/input[1]';
      await page.waitForSelector(secondXPath, { timeout: 10000 });
      const secondLocator = page.locator(secondXPath);
      await secondLocator.click({ timeout: 5000 }).catch(() => {});
    } catch (e) {
      console.warn('[WOORI] Failed to click second input (primary path):', e);
      try {
        const frames = page.frames();
        for (const f of frames) {
          try {
            const secondXPath = 'xpath=/html/body/div[2]/div[2]/div[3]/div[4]/form/fieldset/div[1]/div/div[2]/dl/dd[1]/ul/li[2]/div/input[1]';
            const handle = await f.waitForSelector(secondXPath, { timeout: 3000 });
            if (handle) {
              await handle.click({ timeout: 3000 }).catch(() => {});
              break;
            }
          } catch {}
        }
      } catch {}
    }

    // Example: measure boxes for the two inputs and log them
    const boxes = {};
    try {
      const firstXPath = 'xpath=/html/body/div[2]/div[2]/div[3]/div[4]/form/fieldset/div[1]/div/div[2]/dl/dd[1]/ul/li[1]/input';
      boxes.firstInput = await getElementBox(page, firstXPath);
    } catch {}
    try {
      const secondXPath = 'xpath=/html/body/div[2]/div[2]/div[3]/div[4]/form/fieldset/div[1]/div/div[2]/dl/dd[1]/ul/li[2]/div/input[1]';
      boxes.secondInput = await getElementBox(page, secondXPath);
    } catch {}
    try {
      const imgXPath = 'xpath=/html/body/div[2]/div[2]/div[3]/div[4]/form/fieldset/div[1]/div/div[2]/dl/dd[1]/ul/li[2]/div/div/div[1]/img';
      boxes.targetImage = await getElementBox(page, imgXPath);
    } catch {}
    console.log('[WOORI] Element boxes:', boxes);

    // If we have the target image box, click at an offset inside it
    let clickedPoint = null;
    try {
      if (boxes.targetImage && typeof boxes.targetImage.x === 'number') {
        // Ensure the element is in view before clicking
        const imgLocator = page.locator('xpath=/html/body/div[2]/div[2]/div[3]/div[4]/form/fieldset/div[1]/div/div[2]/dl/dd[1]/ul/li[2]/div/div/div[1]/img');
        await imgLocator.first().scrollIntoViewIfNeeded().catch(() => {});

        const offsetX = 173;
        const offsetY = 135.5;
        const clickX = boxes.targetImage.x + offsetX;
        const clickY = boxes.targetImage.y + offsetY;
        await page.mouse.move(clickX, clickY).catch(() => {});
        await page.mouse.click(clickX, clickY, { delay: 40 }).catch(() => {});
        clickedPoint = { x: clickX, y: clickY, offsetX, offsetY };
      }
    } catch (e) {
      console.warn('[WOORI] Failed to click at targetImage offset:', e);
    }

    // Take a screenshot of the target image
    let screenshotPath = null;
    let aiSegmentation = null;
    try {
      const imgXPath = 'xpath=/html/body/div[2]/div[2]/div[3]/div[4]/form/fieldset/div[1]/div/div[2]/dl/dd[1]/ul/li[2]/div/div/div[1]/img';
      const imgLocator = page.locator(imgXPath);
      if (await imgLocator.count()) {
        // Ensure output directory exists
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `woori-target-image-${timestamp}.png`;
        screenshotPath = path.join(outputDir, filename);
        
        await imgLocator.first().screenshot({ path: screenshotPath });
        console.log('[WOORI] Screenshot saved:', screenshotPath);
        
        // Analyze screenshot with AI if API key provided
        if (geminiApiKey) {
          try {
            console.log('[WOORI] Analyzing screenshot with AI...');
            aiSegmentation = await analyzeImageSegmentation(screenshotPath, geminiApiKey);
            console.log('[WOORI] AI segmentation results:', JSON.stringify(aiSegmentation, null, 2));
            
            // Pass segmentation results to automator for processing
            if (aiSegmentation && aiSegmentation.length > 0) {
              console.log('[WOORI] Passing segmentation results to automator...');
              await processSegmentationResults(aiSegmentation, screenshotPath, boxes, page);
            }
          } catch (aiError) {
            console.warn('[WOORI] Failed to analyze screenshot with AI:', aiError);
          }
        }
      }
    } catch (e) {
      console.warn('[WOORI] Failed to take screenshot of target image:', e);
    }

    // Keep browser open for manual steps/debugging
    return { success: true, boxes, clickedPoint, screenshotPath };
  } catch (error) {
    // Fallback to bundled Chromium
    try {
      const browser = await chromium.launch({ headless: false, proxy });
      const context = await browser.newContext({ locale: 'ko-KR' });

      await context.route('**/*', async (route) => {
        try {
          const request = route.request();
          const isDocument = request.resourceType() === 'document';
          const url = new URL(request.url());
          if (isDocument && undesiredHostnames.has(url.hostname)) {
            return route.fulfill({ status: 302, headers: { location: targetUrl } });
          }
        } catch {}
        return route.continue();
      });

      const page = await context.newPage();
      page.on('framenavigated', (frame) => {
        try {
          if (frame === page.mainFrame()) {
            const u = new URL(frame.url());
            if (undesiredHostnames.has(u.hostname)) {
              page.goto(targetUrl).catch(() => {});
            }
          }
        } catch {}
      });

      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      return { success: true, fallback: true, boxes: null, clickedPoint: null, screenshotPath: null };
    } catch (fallbackErr) {
      return { success: false, error: String(fallbackErr && fallbackErr.message ? fallbackErr.message : fallbackErr) };
    }
  }
}

module.exports = { runWooriAutomation };