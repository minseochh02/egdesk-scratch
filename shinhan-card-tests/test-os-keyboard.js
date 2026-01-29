/**
 * Test script for Virtual HID keyboard with Shinhan Card
 *
 * This script tests the Virtual HID keyboard (Python pynput) to bypass security keyboard.
 * The Virtual HID creates OS-level keyboard events through the kernel input stack.
 */

const { runShinhanCardAutomation } = require('./src/main/financehub/cards/shinhan-card/ShinhanCardAutomator');
const { getSystemInfo } = require('./src/main/financehub/utils/virtual-hid-bridge');

// Test configuration
const credentials = {
  userId: process.env.SHINHAN_CARD_USER_ID || 'YOUR_USER_ID',
  password: process.env.SHINHAN_CARD_PASSWORD || 'YOUR_PASSWORD'
};

const options = {
  headless: false,  // MUST be false to see the browser
  startDate: '20260101',
  endDate: '20260127'
};

async function testOSKeyboard() {
  console.log('='.repeat(60));
  console.log('Testing Virtual HID Keyboard with Shinhan Card');
  console.log('='.repeat(60));
  console.log('');

  // Check system info
  console.log('Checking system dependencies...');
  const sysInfo = await getSystemInfo();
  console.log(`Platform: ${sysInfo.platform} (${sysInfo.arch})`);
  console.log(`Python3: ${sysInfo.hasPython3 ? '✅ Installed' : '❌ Not found'}`);
  console.log(`pynput: ${sysInfo.hasPynput ? '✅ Installed' : '⚠️  Will be auto-installed'}`);
  console.log('');

  console.log('⚠️  IMPORTANT INSTRUCTIONS:');
  console.log('1. The browser will open and navigate to Shinhan Card login');
  console.log('2. When password entry starts, DO NOT touch your keyboard or mouse');
  console.log('3. The Virtual HID (Python pynput) creates OS-level keyboard events');
  console.log('4. These events go through the kernel input stack like a real USB keyboard');
  console.log('5. Watch the password field to see if characters appear');
  console.log('');
  console.log('How Virtual HID works:');
  console.log('  Python pynput → OS Kernel Input Stack → Security App ✅ → Browser');
  console.log('');
  console.log('Credentials:');
  console.log(`  User ID: ${credentials.userId}`);
  console.log(`  Password: ${'*'.repeat(credentials.password.length)} (${credentials.password.length} chars)`);
  console.log('');
  console.log('Starting automation in 3 seconds...');
  console.log('='.repeat(60));

  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    const result = await runShinhanCardAutomation(credentials, options);

    console.log('');
    console.log('='.repeat(60));
    console.log('Test Result:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('');
      console.log('✅ SUCCESS! Virtual HID keyboard input worked!');
      console.log('');
      console.log('The security keyboard accepted the input from Virtual HID.');
      console.log('This means the input went through the OS kernel input stack correctly,');
      console.log('and was indistinguishable from a real USB keyboard!');
    } else {
      console.log('');
      console.log('❌ FAILED! Virtual HID keyboard input did not work.');
      console.log('');
      console.log('Error:', result.error);
      console.log('');
      console.log('The security keyboard may be using even deeper kernel-level monitoring.');
      console.log('Possible next steps:');
      console.log('  1. Check if accessibility permissions are needed for pynput');
      console.log('  2. Try a true kernel-level virtual USB device driver');
      console.log('  3. Use a physical USB HID emulator device (e.g., USB Rubber Ducky)');
    }
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('❌ Test failed with error:');
    console.error('='.repeat(60));
    console.error(error);
  }
}

// Run the test
testOSKeyboard().catch(console.error);
