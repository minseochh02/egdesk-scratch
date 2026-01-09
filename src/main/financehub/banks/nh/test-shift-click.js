const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function testShiftClick() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Navigate to NH Bank login page
    console.log('[TEST] Navigating to NH Bank...');
    await page.goto('https://banking.nonghyup.com/servlet/IPAIP0011R.view', { waitUntil: 'networkidle' });
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Click on user ID field
    console.log('[TEST] Clicking user ID field...');
    const userIdField = await page.locator('#loginUserId');
    await userIdField.click();
    await userIdField.fill('testuser');
    
    // Click on password field to open virtual keyboard
    console.log('[TEST] Clicking password field to open virtual keyboard...');
    const passwordField = await page.locator('#loginUserPwd');
    await passwordField.click();
    await page.waitForTimeout(2000);
    
    // Check if virtual keyboard is visible
    const keyboardSelectors = [
      '//div[@id="Tk_loginUserPwd_layoutLower"]',
      '//div[contains(@id, "_layoutLower") and contains(@style, "visibility: visible")]',
      '//img[@id="imgTwinLower"]'
    ];
    
    let keyboardFound = false;
    for (const selector of keyboardSelectors) {
      const element = page.locator(`xpath=${selector}`);
      if (await element.isVisible({ timeout: 1000 })) {
        console.log(`[TEST] Found keyboard with selector: ${selector}`);
        keyboardFound = true;
        
        // Get keyboard bounds
        const bounds = await element.boundingBox();
        console.log('[TEST] Keyboard bounds:', bounds);
        
        // Take screenshot before clicking SHIFT
        await page.screenshot({ path: 'before-shift-click.png' });
        break;
      }
    }
    
    if (!keyboardFound) {
      console.error('[TEST] Virtual keyboard not found!');
      return;
    }
    
    // Based on the AI output, SHIFT was found at position (1394, 764)
    const shiftX = 1394;
    const shiftY = 764;
    
    console.log(`[TEST] Moving mouse to SHIFT position: (${shiftX}, ${shiftY})`);
    await page.mouse.move(shiftX, shiftY);
    await page.waitForTimeout(300);
    
    // Highlight where we're clicking
    await page.evaluate(({x, y}) => {
      const dot = document.createElement('div');
      dot.style.position = 'fixed';
      dot.style.left = x + 'px';
      dot.style.top = y + 'px';
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.backgroundColor = 'red';
      dot.style.borderRadius = '50%';
      dot.style.zIndex = '999999';
      document.body.appendChild(dot);
    }, {x: shiftX, y: shiftY});
    
    await page.waitForTimeout(500);
    
    console.log('[TEST] Clicking SHIFT...');
    await page.mouse.click(shiftX, shiftY);
    
    await page.waitForTimeout(1000);
    
    // Take screenshot after clicking SHIFT
    await page.screenshot({ path: 'after-shift-click.png' });
    
    console.log('[TEST] SHIFT clicked. Browser will remain open for inspection.');
    
  } catch (error) {
    console.error('[TEST] Error:', error);
    await page.screenshot({ path: 'error-screenshot.png' });
  } finally {
    console.log('[TEST] Browser will remain open. Press Ctrl+C to close when done inspecting.');
    // Keep browser open indefinitely for manual inspection
    await new Promise(() => {}); // This will keep the browser open until process is killed
  }
}

// Run the test
testShiftClick().catch(console.error);