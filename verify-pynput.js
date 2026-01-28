/**
 * Quick pynput verification script
 *
 * Run this to verify pynput is working correctly before running the full test
 */

const { spawn } = require('child_process');

async function verifyPynput() {
  console.log('🔍 Verifying pynput installation...\n');

  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const pipCmd = process.platform === 'win32' ? 'pip' : 'pip3';

  console.log(`Platform: ${process.platform}`);
  console.log(`Python command: ${pythonCmd}`);
  console.log(`Pip command: ${pipCmd}\n`);

  // Test 1: Python version
  console.log('Test 1: Python version');
  await new Promise((resolve) => {
    const proc = spawn(pythonCmd, ['--version']);
    proc.stdout.on('data', (data) => console.log(`  ${data.toString().trim()}`));
    proc.stderr.on('data', (data) => console.log(`  ${data.toString().trim()}`));
    proc.on('close', () => resolve());
    proc.on('error', (err) => {
      console.log(`  ❌ Error: ${err.message}`);
      resolve();
    });
  });
  console.log('');

  // Test 2: Import pynput
  console.log('Test 2: Import pynput');
  const importTest = await new Promise((resolve) => {
    const proc = spawn(pythonCmd, ['-c', 'import pynput; print("✅ pynput imported successfully")']);
    let success = false;

    proc.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`  ${output.trim()}`);
      if (output.includes('successfully')) success = true;
    });

    proc.stderr.on('data', (data) => {
      console.log(`  ❌ ${data.toString().trim()}`);
    });

    proc.on('close', (code) => resolve({ success, code }));
    proc.on('error', (err) => {
      console.log(`  ❌ Error: ${err.message}`);
      resolve({ success: false, code: -1 });
    });
  });
  console.log('');

  // Test 3: Check pynput version
  console.log('Test 3: pynput version');
  await new Promise((resolve) => {
    const proc = spawn(pythonCmd, ['-c', 'import pynput; print(f"  Version: {pynput.__version__}")']);
    proc.stdout.on('data', (data) => console.log(data.toString().trim()));
    proc.stderr.on('data', (data) => console.log(`  ❌ ${data.toString().trim()}`));
    proc.on('close', () => resolve());
    proc.on('error', () => resolve());
  });
  console.log('');

  // Test 4: Test keyboard controller
  console.log('Test 4: Test keyboard controller');
  const controllerTest = await new Promise((resolve) => {
    const code = `
import pynput.keyboard
controller = pynput.keyboard.Controller()
print("✅ Keyboard controller created successfully")
`;
    const proc = spawn(pythonCmd, ['-c', code]);

    let success = false;
    proc.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`  ${output.trim()}`);
      if (output.includes('successfully')) success = true;
    });

    proc.stderr.on('data', (data) => {
      console.log(`  ❌ ${data.toString().trim()}`);
    });

    proc.on('close', (code) => resolve({ success, code }));
    proc.on('error', (err) => {
      console.log(`  ❌ Error: ${err.message}`);
      resolve({ success: false, code: -1 });
    });
  });
  console.log('');

  // Summary
  console.log('═'.repeat(70));
  console.log('SUMMARY:');
  console.log('═'.repeat(70));

  if (importTest.success && controllerTest.success) {
    console.log('✅ pynput is installed and working correctly!');
    console.log('');
    console.log('You can now run the test:');
    console.log('  node test-pynput-only.js');
    console.log('');
  } else {
    console.log('❌ pynput is not working correctly');
    console.log('');
    console.log('To install pynput:');
    console.log(`  ${pipCmd} install pynput`);
    console.log('');
    console.log('Or upgrade if already installed:');
    console.log(`  ${pipCmd} install --upgrade pynput`);
    console.log('');

    if (process.platform === 'darwin') {
      console.log('⚠️  macOS users: You may need to grant accessibility permissions');
      console.log('   시스템 설정 → 개인 정보 보호 및 보안 → 손쉬운 사용');
      console.log('   System Settings → Privacy & Security → Accessibility');
      console.log('');
    }

    if (process.platform === 'win32') {
      console.log('⚠️  Windows users: You may need to run as Administrator');
      console.log('');
    }
  }
}

verifyPynput().catch(console.error);
