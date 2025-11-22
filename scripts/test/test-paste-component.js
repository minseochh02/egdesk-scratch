#!/usr/bin/env node

/**
 * Test script for paste component functionality
 * This script tests the paste component on Naver Blog to debug why left click isn't bringing out the paste component
 */

const { chromium } = require('playwright');

async function testPasteComponent() {
  console.log('🧪 Starting paste component test...');
  
  let browser;
  try {
    // Launch browser
    browser = await chromium.launch({ 
      headless: false,
      channel: 'chrome'
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to Naver Blog write page
    console.log('🌐 Navigating to Naver Blog write page...');
    await page.goto('https://blog.naver.com/GoBlogWrite.naver');
    await page.waitForTimeout(3000);
    
    // Wait for login if needed
    const currentUrl = page.url();
    if (currentUrl.includes('nid.naver.com')) {
      console.log('🔐 Login required, waiting for manual login...');
      console.log('Please log in manually and close any popups. The test will continue automatically...');
      await page.waitForURL('**/GoBlogWrite.naver**', { timeout: 120000 }); // 2 minutes
      console.log('✅ Login completed, proceeding with test...');
    }
    
    // Wait a bit for any popups to be closed
    console.log('⏳ Waiting for any popups to be closed...');
    await page.waitForTimeout(3000);
    
    // Wait for the editor to load with multiple possible selectors
    console.log('⏳ Waiting for editor to load...');
    try {
      // Try multiple selectors for the editor
      await page.waitForSelector('.se-content.__se-scroll-target', { timeout: 15000 });
      console.log('✅ Editor loaded with .se-content.__se-scroll-target');
    } catch (error) {
      console.log('❌ .se-content.__se-scroll-target not found, trying alternative selectors...');
      
      try {
        // Try other possible selectors
        await page.waitForSelector('[contenteditable="true"]', { timeout: 10000 });
        console.log('✅ Editor found with [contenteditable="true"]');
      } catch (error2) {
        console.log('❌ [contenteditable="true"] not found, trying iframe...');
        
        try {
          // Try iframe
          await page.waitForSelector('iframe', { timeout: 10000 });
          console.log('✅ Iframe found, editor might be inside iframe');
        } catch (error3) {
          console.log('❌ No editor found with any selector. Current URL:', page.url());
          console.log('Please check if you need to close any popups or if the page structure has changed.');
          return;
        }
      }
    }
    
    console.log('✅ Editor loaded, starting paste test...');
    
    // Test 1: Use the specific XPath you provided
    console.log('🔍 Looking for content area using your XPath...');
    const contentArea = page.locator('xpath=/html/body/div[1]/div/div[3]/div/div/div[1]/div/div[1]/div[2]/section/article/div[2]/div/div/div/div/p');
    const contentAreaCount = await contentArea.count();
    console.log(`📝 Found ${contentAreaCount} element(s) with XPath`);
    
    if (contentAreaCount > 0) {
      // Test 1: Use the old method - first click, then right-click
      console.log('🖱️ Testing old method: first click, then right-click...');
      try {
        // First click on the targetField (or body if no targetField)
        if (contentArea) {
          await contentArea.first().click({ timeout: 5000 });
          console.log('✅ First click successful');
        } else {
          await page.click('body');
          console.log('✅ Clicked on body as fallback');
        }
        
        // Wait a bit
        await page.waitForTimeout(500);
        
        // Then right-click on the targetField
        if (contentArea) {
          await contentArea.first().click({ button: 'right', timeout: 5000 });
          console.log('✅ Right click successful');
        }
        
        // Wait a bit to see if context menu appears
        await page.waitForTimeout(1000);
        
        // Check if context menu is visible
        const contextMenu = page.locator('[role="menu"], .context-menu, .se-context-menu');
        const contextMenuCount = await contextMenu.count();
        console.log(`📋 Found ${contextMenuCount} context menu(s)`);
        
        if (contextMenuCount > 0) {
          console.log('✅ Context menu appeared!');
          // Try to find paste option
          const pasteOption = page.locator('text=Paste, text=붙여넣기, [data-action="paste"]');
          const pasteOptionCount = await pasteOption.count();
          console.log(`📋 Found ${pasteOptionCount} paste option(s)`);
          
          if (pasteOptionCount > 0) {
            console.log('✅ Paste option found in context menu!');
          } else {
            console.log('❌ No paste option found in context menu');
          }
        } else {
          console.log('❌ No context menu appeared');
        }
      } catch (error) {
        console.log('❌ Old method failed:', error.message);
      }
      
      // Test 4: Try typing to see if we can focus
      console.log('⌨️ Testing keyboard input...');
      try {
        await contentArea.first().focus();
        await page.keyboard.type('Test content for paste component debugging');
        console.log('✅ Keyboard input successful');
      } catch (error) {
        console.log('❌ Keyboard input failed:', error.message);
      }
      
      // Test 5: Check for other possible content areas
      console.log('🔍 Checking for other content areas...');
      const otherContentAreas = [
        '[contenteditable="true"]',
        '.se-text-paragraph',
        '.se-component',
        '.se-module',
        'iframe'
      ];
      
      for (const selector of otherContentAreas) {
        const elements = page.locator(selector);
        const count = await elements.count();
        if (count > 0) {
          console.log(`📝 Found ${count} element(s) with selector: ${selector}`);
        }
      }
      
      // Test 6: Check for iframes
      console.log('🖼️ Checking for iframes...');
      const iframes = page.locator('iframe');
      const iframeCount = await iframes.count();
      console.log(`🖼️ Found ${iframeCount} iframe(s)`);
      
      if (iframeCount > 0) {
        for (let i = 0; i < iframeCount; i++) {
          const iframe = iframes.nth(i);
          const src = await iframe.getAttribute('src');
          const id = await iframe.getAttribute('id');
          console.log(`🖼️ Iframe ${i + 1}: id="${id}", src="${src}"`);
        }
      }
      
      // Test 7: Try to copy something to clipboard and test paste
      console.log('📋 Testing clipboard functionality...');
      try {
        // Try to copy some text
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Control+c');
        console.log('✅ Copy command executed');
        
        // Try to paste
        await page.keyboard.press('Control+v');
        console.log('✅ Paste command executed');
        
        // Check if content was pasted
        const content = await contentArea.first().textContent();
        if (content && content.includes('Test content for paste component debugging')) {
          console.log('✅ Paste appears to have worked');
        } else {
          console.log('❌ Paste may not have worked - content not found');
        }
      } catch (error) {
        console.log('❌ Clipboard test failed:', error.message);
      }
      
    } else {
      console.log('❌ No content area found');
    }
    
    // Keep browser open for manual inspection
    console.log('🔍 Browser kept open for manual inspection. Close manually when done.');
    console.log('Press Ctrl+C to exit this script (browser will remain open)');
    
    // Wait for user to close
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Paste component test failed:', error);
  } finally {
    // Don't close browser automatically - let user inspect
    // if (browser) await browser.close();
  }
}

// Run the test
testPasteComponent().catch(console.error);
