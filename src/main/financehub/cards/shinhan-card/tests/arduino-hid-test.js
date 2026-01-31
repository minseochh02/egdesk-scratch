/**
 * Arduino HID Keyboard Test
 *
 * Tests using an Arduino (Leonardo/Pro Micro) as a USB HID keyboard
 * to type the password into Shinhan Card's login page.
 *
 * Prerequisites:
 *   1. Arduino Leonardo or Pro Micro (ATmega32U4)
 *   2. Flash with the sketch in arduino-hid-sketch.ino
 *   3. npm install serialport
 *   4. Find your COM port in Device Manager
 *
 * Usage:
 *   node arduino-hid-test.js --port COM3 --password yourpassword
 */

const { chromium } = require('playwright-core');
const { SerialPort } = require('serialport');
const { SHINHAN_CARD_INFO, SHINHAN_CARD_XPATHS, SHINHAN_CARD_TIMEOUTS } = require('../config');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    parsed[args[i].replace('--', '')] = args[i + 1];
  }
  if (!parsed.port) {
    console.error('Usage: node arduino-hid-test.js --port COM3 --password yourpassword');
    process.exit(1);
  }
  return parsed;
}

async function listPorts() {
  const ports = await SerialPort.list();
  console.log('Available serial ports:');
  ports.forEach((p) => {
    console.log(`  ${p.path} - ${p.manufacturer || 'Unknown'} (${p.vendorId || ''}:${p.productId || ''})`);
  });
  return ports;
}

function openArduino(comPort, baudRate = 9600) {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path: comPort, baudRate });
    port.on('open', () => {
      console.log(`[Arduino] Connected on ${comPort}`);
      // Give Arduino time to initialize after serial open
      setTimeout(() => resolve(port), 2000);
    });
    port.on('error', (err) => reject(err));
    port.on('data', (data) => {
      console.log(`[Arduino] ${data.toString().trim()}`);
    });
  });
}

function sendToArduino(port, text) {
  return new Promise((resolve, reject) => {
    port.write(text + '\n', (err) => {
      if (err) return reject(err);
      console.log(`[Arduino] Sent ${text.length} chars to type via HID`);
      resolve();
    });
  });
}

async function run() {
  const { port: comPort, password, userid } = parseArgs();

  // Step 1: List available ports
  await listPorts();

  // Step 2: Connect to Arduino
  console.log(`\nConnecting to Arduino on ${comPort}...`);
  const arduino = await openArduino(comPort);

  // Step 3: Launch browser (user's Chrome)
  console.log('\nLaunching Chrome...');
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(SHINHAN_CARD_INFO.loginUrl, {
    waitUntil: 'domcontentloaded',
    timeout: SHINHAN_CARD_TIMEOUTS.pageLoad,
  });
  console.log('Login page loaded');

  // Step 4: Fill user ID (normal Playwright input — no security keyboard on this field)
  if (userid) {
    await page.fill(SHINHAN_CARD_XPATHS.idInput.css, userid);
    console.log('User ID filled');
  }

  // Step 5: Focus password field, then let Arduino type it
  if (password) {
    const pwdField = page.locator(SHINHAN_CARD_XPATHS.passwordInput.css);
    await pwdField.click();
    console.log('Password field focused — sending to Arduino HID...');

    // Small delay to ensure focus is settled
    await new Promise((r) => setTimeout(r, 500));

    await sendToArduino(arduino, password);

    // Wait for Arduino to finish typing
    // ~500ms per char (150ms press + 350ms release delay), plus buffer
    const typingTime = password.length * 700 + 500;
    await new Promise((r) => setTimeout(r, typingTime));
    console.log('Arduino finished typing');
  }

  console.log('\n--- Test complete ---');
  console.log('Check the browser to verify the password was entered.');
  console.log('Press Ctrl+C to close.\n');

  // Keep alive so user can inspect
  await new Promise(() => {});
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
