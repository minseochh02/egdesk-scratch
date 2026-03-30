# Korean Security App Checker

Detects and verifies Korean banking security applications required for online banking and card websites in South Korea.

## Overview

Korean banks and card companies require specific security applications to be installed and running before allowing login. This module automatically detects these applications and provides detailed status reports.

## Supported Security Apps

### Required Apps

1. **TouchEn nxKey** (라온시큐어)
   - **Purpose**: Keyboard security solution (키보드보안)
   - **Process Names**: `nxkey`, `touchen`, `nprotect`
   - **Provider**: RaonSecure
   - **Users**: 10+ million in South Korea
   - **Status**: Required for most Korean banking websites

### Optional Apps

2. **IPinside**
   - **Purpose**: Process monitoring and fraud detection
   - **Process Names**: `ipinside`, `lws`, `lws_agent`
   - **Features**: Can enumerate running processes, collects system data

3. **ASTx**
   - **Purpose**: Anti-screen capture security
   - **Process Names**: `astx`, `transkey`

4. **Veraport**
   - **Purpose**: Application management system
   - **Process Names**: `veraport`, `veraport_launcher`

## Usage

### Basic Check

```javascript
const { checkKoreanSecurityApps } = require('./utils/korean-security-checker');

async function example() {
  const status = await checkKoreanSecurityApps();

  console.log('All required apps running:', status.allRequiredRunning);
  console.log('Details:', status.results);

  if (!status.allRequiredRunning) {
    console.warn('Missing required security apps:', status.errors);
  }
}
```

### Get Formatted Report

```javascript
const { getSecurityStatusReport } = require('./utils/korean-security-checker');

async function example() {
  const report = await getSecurityStatusReport();
  console.log(report);
}
```

### Check Specific App

```javascript
const { checkSpecificSecurityApp } = require('./utils/korean-security-checker');

async function example() {
  const touchEnStatus = await checkSpecificSecurityApp('touchEn');

  if (touchEnStatus.isRunning) {
    console.log('TouchEn nxKey is running');
    console.log('Processes:', touchEnStatus.processes);
  } else {
    console.log('TouchEn nxKey is NOT running');
  }
}
```

## Integration with Shinhan Card Automator

The security checker is automatically integrated into the Shinhan Card automator. When you call the `login()` method, it will:

1. Check for all required security apps
2. Log a detailed status report
3. Show warnings if required apps are missing
4. Include security status in the login result

### Example

```javascript
const { ShinhanCardAutomator } = require('./cards/shinhan-card/ShinhanCardAutomator');

async function loginExample() {
  const automator = new ShinhanCardAutomator({
    headless: false,
    arduinoPort: 'COM6'
  });

  const result = await automator.login({
    userId: 'your-user-id',
    password: 'your-password'
  });

  // Check security apps status in result
  console.log('Security apps checked:', result.securityApps.checked);
  console.log('All required running:', result.securityApps.allRequiredRunning);
  console.log('Details:', result.securityApps.details);
}
```

## Testing

Run the test script to verify security app detection:

```bash
node src/main/financehub/cards/shinhan-card/tests/test-security-checker.js
```

## Output Format

### Status Object

```javascript
{
  success: true,
  allRequiredRunning: false,
  results: {
    touchEn: {
      name: 'TouchEn nxKey',
      description: 'Keyboard security solution by RaonSecure',
      required: true,
      isRunning: false,
      processes: []
    },
    // ... other apps
  },
  warnings: ['Optional security app not running: IPinside'],
  errors: ['Required security app not running: TouchEn nxKey'],
  timestamp: '2026-03-29T01:39:17.234Z'
}
```

### Process Information

Each detected process includes:
- `name`: Process name
- `pid`: Process ID
- `cpu`: CPU usage percentage (not available on Windows)
- `memory`: Memory usage (not available on Windows)

## Platform Support

- **Windows**: ✓ Supported (primary platform for Korean banking)
- **macOS**: ✓ Supported (for testing/development)
- **Linux**: ✓ Supported (for testing/development)

Note: Korean banking security apps are typically Windows-only, but the detection mechanism works on all platforms.

## Version Detection

**Important**: Korean security apps typically do not have reliable auto-update mechanisms. Version detection is limited because:

1. Process information doesn't include version numbers
2. Apps are distributed by different banks with different versions
3. Many installations are years behind current releases

To detect versions, you would need to:
- Check Windows registry entries (Windows-specific)
- Check file versions in installation directories
- Use Windows Management Instrumentation (WMI) queries

## Technical Details

### How It Works

1. Uses `ps-list` npm package to get all running processes
2. Matches process names against known security app patterns
3. Returns detailed status for each security app
4. Categorizes apps as required or optional

### Process Name Matching

The checker performs case-insensitive substring matching on process names. For example, any process containing "nxkey", "touchen", or "nprotect" will be detected as TouchEn nxKey.

## References

- [TouchEn nxKey: The keylogging anti-keylogger solution](https://palant.info/2023/01/09/touchen-nxkey-the-keylogging-anti-keylogger-solution/)
- [IPinside: Korea's mandatory spyware](https://palant.info/2023/01/25/ipinside-koreas-mandatory-spyware/)
- [South Korea's banking security: Intermediate conclusions](https://palant.info/2023/02/20/south-koreas-banking-security-intermediate-conclusions/)
- [Veraport: Inside Korea's dysfunctional application management](https://palant.info/2023/03/06/veraport-inside-koreas-dysfunctional-application-management/)

## Troubleshooting

### "Required security app not running"

If you see this error:
1. Check if the security app is installed
2. Launch the security app manually
3. Verify it appears in Task Manager (Windows) or Activity Monitor (macOS)
4. Run the test script again to confirm detection

### Process not detected

If a security app is running but not detected:
1. Check the process name in Task Manager
2. Update the `processNames` array in `SECURITY_APPS` configuration
3. Submit an issue or pull request with the new process name

## License

MIT
