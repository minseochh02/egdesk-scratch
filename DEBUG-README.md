# EGDesk Windows Template Debugger

This debugger helps diagnose template saving issues on Windows systems. It provides comprehensive system information, tracks template save attempts, and identifies potential Windows-specific problems.

## Features

### 🔍 System Information
- Platform and architecture details
- Electron, Node.js, and Chrome versions
- Memory usage and system resources
- File system permissions and accessibility

### 📊 Template Save Tracking
- Logs all template save attempts with timestamps
- Tracks success/failure rates
- Captures error messages and stack traces
- Identifies patterns in failed saves

### 🪟 Windows-Specific Diagnostics
- Checks for common Windows issues
- Validates file system permissions
- Detects antivirus interference
- Provides Windows-specific recommendations

### 🧪 Built-in Tests
- Tests WordPress connection updates
- Validates file system write operations
- Checks Electron Store functionality
- Performs end-to-end template save tests

## How to Use

### 1. Access the Debugger
- Look for the 🐛 debug button in the WordPress Sites List header
- The button will show a warning badge if issues are detected
- Click the button to open the debugger interface

### 2. View System Information
- The debugger automatically collects system information
- Check the "System Information" section for platform details
- Review "Electron Store Status" for data persistence issues
- Examine "File System Status" for permission problems

### 3. Run Diagnostic Tests
- Click "Run Template Save Tests" to perform automated tests
- Tests will validate various components of the template saving process
- Review test results to identify specific failure points

### 4. Analyze Template Save Attempts
- View recent template save attempts in the "Recent Template Save Attempts" section
- Check for patterns in failed attempts
- Look for specific error messages that might indicate the root cause

### 5. Review Error Logs
- Check the "Recent Errors" section for any unhandled errors
- Stack traces are available for detailed debugging
- Errors are automatically categorized by context

### 6. Generate Debug Report
- Click the download button to generate a comprehensive debug report
- The report includes all collected information and test results
- Share this report with the EGDesk support team for assistance

## Common Windows Issues

### Permission Denied Errors
**Symptoms:** Template saves fail with "permission denied" or "access denied" errors
**Solutions:**
- Run EGDesk as Administrator
- Check if Windows Defender is blocking the application
- Verify file permissions on the user data directory

### Path-Related Errors
**Symptoms:** Errors mentioning invalid paths or "not found" messages
**Solutions:**
- Check if the application data directory is accessible
- Verify that the user profile path is valid
- Ensure no special characters in the path are causing issues

### Network/Connection Errors
**Symptoms:** Timeout or connection errors during template saves
**Solutions:**
- Check internet connection
- Verify firewall settings
- Ensure no proxy is interfering with local operations

### Antivirus Interference
**Symptoms:** Template saves work intermittently or fail silently
**Solutions:**
- Add EGDesk to antivirus exclusions
- Temporarily disable real-time protection for testing
- Check antivirus logs for blocked operations

## Debug Report Contents

The generated debug report includes:

- **System Information:** Platform, architecture, versions, memory usage
- **Environment Details:** Paths, environment variables, user data locations
- **File System Checks:** Permission validation for key directories
- **Template Save History:** All recent save attempts with results
- **Error Logs:** Unhandled errors with stack traces
- **Test Results:** Automated diagnostic test outcomes
- **Windows-Specific Issues:** Platform-specific problems and recommendations

## Command Line Debug Report

For advanced users, you can also generate a debug report from the command line:

```bash
# Navigate to the EGDesk directory
cd /path/to/egdesk-scratch

# Run the debug report generator
node scripts/generate-debug-report.js
```

This will generate a JSON report in your home directory with comprehensive system information.

## Troubleshooting

### Debugger Won't Open
- Check browser console for JavaScript errors
- Ensure all required dependencies are installed
- Try refreshing the application

### Tests Fail to Run
- Verify that EGDesk has proper permissions
- Check that the application is not in a restricted environment
- Ensure all required services are running

### No Template Save Attempts Logged
- Make sure you're actually attempting to save templates
- Check that the debug service is properly initialized
- Verify that localStorage is accessible

## Support

If you're still experiencing issues after using the debugger:

1. Generate a debug report using the built-in tool
2. Include the debug report when contacting support
3. Describe the specific steps that lead to the issue
4. Mention any error messages you see in the console

## Technical Details

### Debug Service
The `DebugService` class automatically tracks:
- Template save attempts and their outcomes
- Unhandled JavaScript errors
- Promise rejections
- System state changes

### Data Storage
Debug data is stored in:
- `localStorage.templateSaveAttempts` - Template save history
- `localStorage.recentErrors` - Error logs
- Generated reports are saved to the user's home directory

### Privacy
The debugger only collects technical information necessary for troubleshooting. No personal data or sensitive information is included in debug reports.

## Development

To extend the debugger:

1. Add new diagnostic tests in the `WindowsTemplateDebugger` component
2. Extend the `DebugService` class for additional tracking
3. Update the IPC handlers in `main.ts` for new system information
4. Modify the debug report format as needed

## Version History

- **v1.0.0** - Initial release with basic debugging capabilities
- **v1.1.0** - Added Windows-specific diagnostics
- **v1.2.0** - Enhanced error tracking and reporting
- **v1.3.0** - Added automated testing suite
