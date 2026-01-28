/**
 * Encrypted Password Capture Tool
 *
 * This tool captures the encrypted password value from Shinhan Card
 * so you can reuse it in automation.
 *
 * Run this ONCE per password to capture the encrypted value.
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

async function captureEncryptedPassword() {
  console.log('🔐 Encrypted Password Capture Tool');
  console.log('═'.repeat(70));
  console.log('');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({ locale: 'ko-KR' });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();

  console.log('📍 Navigating to Shinhan Card...');
  await page.goto('https://www.shinhancard.com/cconts/html/main.html');
  await page.waitForTimeout(3000);

  console.log('');
  console.log('═'.repeat(70));
  console.log('📝 INSTRUCTIONS:');
  console.log('═'.repeat(70));
  console.log('');
  console.log('1. Type your REAL password in the password field');
  console.log('2. Press ENTER here (DO NOT click login button!)');
  console.log('3. We will capture and save the encrypted values');
  console.log('');

  await new Promise(resolve => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    readline.question('Press ENTER after typing password: ', () => {
      readline.close();
      resolve();
    });
  });

  console.log('');
  console.log('🔍 Capturing encrypted values...');

  const captured = await page.evaluate(() => {
    const result = {
      maskedPattern: document.getElementById('pwd')?.value || '',
      encryptedFields: {}
    };

    // Capture all E2E encrypted fields
    document.querySelectorAll('input[type="hidden"]').forEach(field => {
      if (field.name && field.value) {
        if (field.name.includes('E2E') ||
            field.name.includes('__K') ||
            field.name.includes('pwd')) {
          result.encryptedFields[field.name] = field.value;
        }
      }
    });

    return result;
  });

  console.log('');
  console.log('✅ CAPTURED VALUES:');
  console.log('');
  console.log('Masked Pattern:', captured.maskedPattern);
  console.log('');
  console.log('Encrypted Fields:');
  Object.entries(captured.encryptedFields).forEach(([name, value]) => {
    console.log(`  ${name}:`);
    console.log(`    ${value.substring(0, 60)}${value.length > 60 ? '...' : ''}`);
  });

  // Save to file
  const configPath = path.join(__dirname, 'shinhan-card-encrypted-password.json');
  const config = {
    capturedAt: new Date().toISOString(),
    maskedPattern: captured.maskedPattern,
    encryptedFields: captured.encryptedFields,
    note: 'This file contains encrypted password values. Keep it secure!'
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log('');
  console.log('💾 SAVED TO:', configPath);
  console.log('');
  console.log('═'.repeat(70));
  console.log('✅ SUCCESS!');
  console.log('═'.repeat(70));
  console.log('');
  console.log('Your encrypted password has been captured and saved.');
  console.log('');
  console.log('NEXT STEPS:');
  console.log('1. Keep this file secure (it contains your password!)');
  console.log('2. Use it in automation to bypass security keyboard');
  console.log('3. Run: node test-full-automation.js');
  console.log('');

  await page.waitForTimeout(3000);
  await browser.close();
}

captureEncryptedPassword().catch(console.error);
