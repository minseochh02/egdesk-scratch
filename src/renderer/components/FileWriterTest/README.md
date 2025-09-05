# File Writer Test Suite

A comprehensive test interface for the enhanced file writing functionality in EGDesk.

## Features

### 🔧 Test Buttons
- **Search & Replace**: Test basic find-and-replace operations
- **Create File**: Test creating new files with content
- **Multiple Edits**: Test applying multiple edits to the same file
- **Validation**: Test edit validation before applying
- **Backup**: Test backup creation functionality
- **Configuration**: Test service configuration settings
- **Error Handling**: Test error scenarios and recovery

### 📊 Real-time Results
- Live test execution with status updates
- Detailed result logging with timestamps
- Success/error indicators with color coding
- Expandable result details for debugging
- Test history (last 10 results)

### 🔒 Safety Features
- **Backup Toggle**: Enable/disable automatic backups
- **Validation**: Pre-flight checks before applying changes
- **Error Recovery**: Automatic rollback on failures
- **Progress Tracking**: Real-time operation status

## Usage

### Accessing the Test Suite
1. Open the DualScreenAIEditor
2. Click the **"Test Writer"** button (🧪 flask icon) in the config bar
3. The test modal will open with all available test options

### Running Tests
1. **Toggle Backups**: Use the checkbox to enable/disable automatic backups
2. **Select Test**: Click any test button to execute
3. **View Results**: Check the results panel for execution status
4. **Clear Results**: Use the "Clear Results" button to reset the log

### Test Categories

#### Basic Operations
- **Search & Replace**: Tests simple text replacement
- **Create File**: Tests new file creation with timestamp-based naming
- **Multiple Edits**: Tests complex operations affecting multiple parts of a file

#### Advanced Features
- **Validation**: Tests the validation system with intentionally invalid edits
- **Backup**: Tests backup creation and restoration
- **Configuration**: Tests service configuration changes

#### Error Scenarios
- **Error Handling**: Tests how the system handles various error conditions

## File Structure

```
FileWriterTest/
├── FileWriterTest.tsx      # Main test component
├── FileWriterTest.css      # Component styles
├── index.ts               # Export file
└── README.md             # This documentation
```

## Integration

The test suite is integrated into the DualScreenAIEditor and uses the following services:

- **FileWriterService**: Core file writing functionality
- **codeChangeUtils**: Utility functions for applying changes
- **EnhancedAIEditorService**: AI-powered edit operations

## Dependencies

- React hooks (useState)
- FontAwesome icons
- EGDesk file system API
- AI Editor types and services

## Configuration

The test suite respects the following configuration options:

- **Backup Enabled**: Whether to create backups before modifications
- **Validation**: Whether to validate edits before applying
- **Progress Callbacks**: Whether to show progress updates

## Error Handling

The test suite includes comprehensive error handling:

- **Network Errors**: File system API failures
- **Permission Errors**: Access denied scenarios
- **Validation Errors**: Invalid edit configurations
- **Timeout Errors**: Long-running operation failures

## Best Practices

1. **Always Enable Backups**: Use the backup toggle for production testing
2. **Test Validation**: Run validation tests to ensure edit quality
3. **Check Results**: Review test results before applying changes in production
4. **Clear Logs**: Clear test results regularly to maintain performance

## Troubleshooting

### Common Issues

1. **Test Not Running**: Check if another test is currently executing
2. **File Not Found**: Ensure test files exist or use create operations
3. **Permission Denied**: Check file system permissions
4. **Backup Failed**: Verify write permissions for backup directory

### Debug Information

Each test result includes:
- Execution timestamp
- Success/failure status
- Detailed error information (if applicable)
- Performance metrics
- File operation details

## Contributing

When adding new tests:

1. Add the test function to `FileWriterTest.tsx`
2. Include appropriate error handling
3. Add success/failure indicators
4. Document the test purpose
5. Update this README if needed

## API Reference

### Test Functions
- `runTest(name, testFunction)`: Execute a test with logging
- `addTestResult(result)`: Add result to the test log
- `validateEdits(edits)`: Validate edit operations
- `applyCodeChanges(edits, options)`: Apply changes with options

### Configuration
- `backupEnabled`: Toggle backup creation
- `isRunning`: Current test execution state
- `testResults`: Array of test results

## Related Files

- `../services/fileWriterService.ts`: Core file writing service
- `../utils/codeChangeUtils.ts`: Utility functions
- `../examples/fileWriterUsageExamples.ts`: Usage examples
- `../AIEditor/services/enhancedAIEditorService.ts`: AI editor service
