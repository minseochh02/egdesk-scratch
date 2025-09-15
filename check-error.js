// Simple script to check localStorage error details
// Run this in the Electron app's dev tools console or as a standalone script

console.log('Checking localStorage for error details...');

// Check if we're in a browser environment
if (typeof localStorage !== 'undefined') {
  const errorData = localStorage.getItem('lastError');
  if (errorData) {
    console.log('Error found in localStorage:');
    console.log(JSON.parse(errorData));
  } else {
    console.log('No error found in localStorage');
  }
} else {
  console.log('localStorage not available - this script needs to run in the browser');
}

// Also check for any other error-related keys
if (typeof localStorage !== 'undefined') {
  console.log('\nAll localStorage keys:');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    console.log(`- ${key}: ${localStorage.getItem(key)?.substring(0, 100)}...`);
  }
}
