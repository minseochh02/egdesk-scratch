import React, { useState, useEffect } from 'react';
import {
  faFileCode,
  faSearch,
  faPlus,
  faTrash,
  faRocket,
  faCheck,
  faTimes,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import { AIEdit } from '../AIEditor/types';
import {
  applyCodeChanges,
  validateEdits,
  createFileBackup,
  codeChangeConfig,
} from '../../utils/codeChangeUtils';
import './FileWriterTest.css';

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
  timestamp: Date;
}

interface FileWriterTestProps {
  projectContext?: {
    currentProject: {
      path: string;
      name: string;
    };
    availableFiles?: any[];
  };
}

export const FileWriterTest: React.FC<FileWriterTestProps> = ({
  projectContext,
}) => {
  // Dynamic import for FontAwesomeIcon to handle ES module compatibility
  const [FontAwesomeIcon, setFontAwesomeIcon] = useState<any>(null);

  useEffect(() => {
    const loadFontAwesome = async () => {
      try {
        const { FontAwesomeIcon: FAIcon } = await import(
          '@fortawesome/react-fontawesome'
        );
        setFontAwesomeIcon(() => FAIcon);
      } catch (error) {
        console.warn('Failed to load FontAwesome:', error);
      }
    };
    loadFontAwesome();
  }, []);

  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [backupEnabled, setBackupEnabled] = useState(true);

  const hasProjectContext = !!projectContext?.currentProject?.path;
  const projectPath =
    projectContext?.currentProject?.path || 'No project loaded';
  const projectName = projectContext?.currentProject?.name || 'Unknown Project';

  const addTestResult = (result: Omit<TestResult, 'timestamp'>) => {
    setTestResults((prev) => [
      {
        ...result,
        timestamp: new Date(),
      },
      ...prev.slice(0, 9),
    ]); // Keep only last 10 results
  };

  const runTest = async (
    testName: string,
    testFunction: () => Promise<any>,
  ) => {
    setIsRunning(true);
    addTestResult({
      success: false,
      message: `🧪 Running ${testName}...`,
    });

    try {
      const result = await testFunction();
      addTestResult({
        success: true,
        message: `✅ ${testName} completed successfully`,
        details: result,
      });
    } catch (error) {
      addTestResult({
        success: false,
        message: `❌ ${testName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Test 1: Simple search and replace
  const testSearchReplace = async () => {
    if (!projectContext?.currentProject?.path) {
      throw new Error('No project context available');
    }

    const projectPath = projectContext.currentProject.path;
    const wwwIndexPath = `${projectPath}/www/index.php`;

    const edits: AIEdit[] = [
      {
        type: 'replace',
        filePath: wwwIndexPath,
        oldText: "echo '<h2>Welcome to WordPress Development Server</h2>';",
        newText:
          "echo '<h2>Welcome to Enhanced WordPress Development Server</h2>';",
        description: 'Update the welcome message in www/index.php',
      },
    ];

    const result = await applyCodeChanges(edits, {
      createBackups: backupEnabled,
      validateBeforeWrite: true,
    });

    return result;
  };

  // Test 2: Create a new file
  const testCreateFile = async () => {
    if (!projectContext?.currentProject?.path) {
      throw new Error('No project context available');
    }

    const projectPath = projectContext.currentProject.path;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const newFilePath = `${projectPath}/www/wp-content/plugins/test-plugin-${timestamp}.php`;

    const edits: AIEdit[] = [
      {
        type: 'create',
        filePath: newFilePath,
        newText: `<?php
/**
 * Plugin Name: Test Plugin ${timestamp}
 * Description: A test plugin created by the File Writer Test Suite
 * Version: 1.0.0
 * Author: EGDesk Test Suite
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Test plugin functionality
function test_plugin_activation() {
    error_log('Test plugin activated at ' . date('Y-m-d H:i:s'));
}

function test_plugin_deactivation() {
    error_log('Test plugin deactivated at ' . date('Y-m-d H:i:s'));
}

// Add admin menu
function test_plugin_menu() {
    add_menu_page(
        'Test Plugin',
        'Test Plugin',
        'manage_options',
        'test-plugin',
        'test_plugin_page',
        'dashicons-admin-generic',
        30
    );
}

// Admin page content
function test_plugin_page() {
    echo '<div class="wrap">';
    echo '<h1>Test Plugin</h1>';
    echo '<p>This is a test plugin created by the File Writer Test Suite.</p>';
    echo '<p><strong>Created:</strong> ' . date('Y-m-d H:i:s') . '</p>';
    echo '<p><strong>Path:</strong> ' . __FILE__ . '</p>';
    echo '</div>';
}

// Register hooks
register_activation_hook(__FILE__, 'test_plugin_activation');
register_deactivation_hook(__FILE__, 'test_plugin_deactivation');
add_action('admin_menu', 'test_plugin_menu');
`,
        description: 'Create a new WordPress plugin file in the www directory',
      },
    ];

    const result = await applyCodeChanges(edits, {
      createBackups: backupEnabled,
      validateBeforeWrite: true,
    });

    return result;
  };

  // Test 3: Replace Product Selection Form
  const testReplaceProductForm = async () => {
    if (!projectContext?.currentProject?.path) {
      throw new Error('No project context available');
    }

    const projectPath = projectContext.currentProject.path;
    const wwwIndexPath = `${projectPath}/www/index.php`;

    // Check if we're working with the wordpress/index.php file instead
    const wordpressIndexPath = `${projectPath}/wordpress/index.php`;

    const edits: AIEdit[] = [
      {
        type: 'replace',
        filePath: wordpressIndexPath,
        oldText: "echo '<h2>Welcome to WordPress Development Server</h2>';",
        newText: `echo '<h2>Welcome to Enhanced WordPress Development Server</h2>';
echo '<div class="product-form" style="margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
    <h3>Product Selection Form</h3>
    <form name="select_machine" action="#" method="get" class="select_form cf">
        <fieldset style="margin-left: none;">
            <p>Product</p>
            <legend class="blind">Product</legend>
            <p>
                <select name=" " class="select" onChange="showSub(this.options[this.selectedIndex].value);" style="padding: 8px; border-radius: 4px;">
                    <option value="0" selected="select">Product</option>
                    <option value="1">Solid CTs for Metering &amp; monitoring</option>
                    <option value="2">Split-core CTs</option>
                    <option value="3">Zero Phase CT</option>
                    <option value="4">Rogowski Coils</option>
                    <option value="5">Smart Meters</option>
                    <option value="6">ACB &amp; GIS Current Transformer</option>
                    <option value="7" style="background: #e8f5e8; font-weight: bold;">🆕 New EGDesk Products</option>
                </select>
            </p>
        </fieldset>
        <fieldset>
            <p>Category</p>
            <legend class="blind">Category</legend>
            <p>
                <select name="SUB0" class="select" style="display: ; padding: 8px; border-radius: 4px;">
                    <option value="">------------------------------ Category ------------------------------</option>
                </select>
                <select name="SUB7" class="select1 select" style="display: none; background: #f0f8ff; padding: 8px; border-radius: 4px;" onchange="if(this.value) location.href=(this.value);">
                    <option value="">------------------------------ EGDesk New Products ------------------------------</option>
                    <option value="/EGDesk/smart-grid.php">🧠 Smart Grid Solutions</option>
                    <option value="/EGDesk/ai-monitoring.php">🤖 AI-Powered Monitoring</option>
                    <option value="/EGDesk/iot-sensors.php">📡 IoT Sensors</option>
                    <option value="/EGDesk/cloud-platform.php">☁️ Cloud Platform</option>
                    <option value="/EGDesk/blockchain-security.php">🔗 Blockchain Security</option>
                </select>
            </p>
        </fieldset>
    </form>
</div>';`,
        description:
          'Replace the product selection form with enhanced version including new EGDesk products',
      },
    ];

    const result = await applyCodeChanges(edits, {
      createBackups: backupEnabled,
      validateBeforeWrite: true,
      onProgress: (progress) => {
        console.log(
          `Progress: ${progress.current}/${progress.total} - ${progress.file}`,
        );
      },
    });

    return result;
  };

  // Test 4: Validation test
  const testValidation = async () => {
    const invalidEdits: AIEdit[] = [
      {
        type: 'replace',
        // Missing required fields
        oldText: 'test',
        description: 'Invalid edit - missing filePath and newText',
      } as any,
      {
        type: 'create',
        filePath: 'valid-test.txt',
        newText: 'This is valid',
        description: 'Valid create edit',
      },
    ];

    const validation = validateEdits(invalidEdits);
    return validation;
  };

  // Test 5: Backup creation test
  const testBackup = async () => {
    if (!projectContext?.currentProject?.path) {
      throw new Error('No project context available');
    }

    const projectPath = projectContext.currentProject.path;
    const wwwIndexPath = `${projectPath}/www/index.php`;

    // Create backup of the www index file
    const backupResult = await createFileBackup(wwwIndexPath);
    return backupResult;
  };

  // Test 6: Configuration test
  const testConfiguration = async () => {
    const originalBackupSetting = codeChangeConfig.isBackupEnabled();

    // Test setting changes
    codeChangeConfig.setBackupEnabled(false);
    const disabledResult = codeChangeConfig.isBackupEnabled();

    codeChangeConfig.setBackupEnabled(true);
    const enabledResult = codeChangeConfig.isBackupEnabled();

    codeChangeConfig.setMaxBackups(3);

    // CRITICAL: Always restore original setting immediately after testing
    codeChangeConfig.setBackupEnabled(originalBackupSetting);

    return {
      originalSetting: originalBackupSetting,
      disabledResult,
      enabledResult,
      maxBackupsSet: 3,
      restored: originalBackupSetting,
    };
  };

  // Test 7: Error handling test
  const testErrorHandling = async () => {
    const edits: AIEdit[] = [
      {
        type: 'replace',
        filePath: 'nonexistent-file.txt',
        oldText: 'This text does not exist',
        newText: 'New text',
        description: 'Test error handling with non-existent file',
      },
    ];

    const result = await applyCodeChanges(edits, {
      createBackups: backupEnabled,
      validateBeforeWrite: false, // Skip validation to test runtime error
    });

    return result;
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="file-writer-test">
      <div className="test-header">
        <h3>
          {FontAwesomeIcon && <FontAwesomeIcon icon={faFileCode} />} File Writer
          Test Suite
        </h3>
        <p>
          Test the enhanced file writing functionality with backup and
          validation
        </p>

        <div className="project-info">
          <div
            className={`project-status ${hasProjectContext ? 'loaded' : 'missing'}`}
          >
            {FontAwesomeIcon && (
              <FontAwesomeIcon icon={hasProjectContext ? faCheck : faTimes} />
            )}
            <span>
              {hasProjectContext ? 'Project Loaded' : 'No Project Context'}
            </span>
          </div>
          {hasProjectContext && (
            <div className="project-details">
              <strong>{projectName}</strong>
              <br />
              <small>{projectPath}</small>
            </div>
          )}
        </div>
      </div>

      <div className="test-controls">
        <div className="backup-toggle">
          <label>
            <input
              type="checkbox"
              checked={backupEnabled}
              onChange={(e) => setBackupEnabled(e.target.checked)}
              disabled={isRunning}
            />
            Enable Backups
          </label>
        </div>

        <button
          className="clear-btn"
          onClick={clearResults}
          disabled={isRunning}
        >
          {FontAwesomeIcon && <FontAwesomeIcon icon={faTrash} />} Clear Results
        </button>
      </div>

      <div className="test-buttons">
        <button
          className="test-btn"
          onClick={() => runTest('Search & Replace', testSearchReplace)}
          disabled={isRunning || !hasProjectContext}
          title={
            !hasProjectContext
              ? 'Project context required for this test'
              : 'Test search and replace functionality'
          }
        >
          {FontAwesomeIcon && <FontAwesomeIcon icon={faSearch} />}
          Search & Replace
        </button>

        <button
          className="test-btn"
          onClick={() => runTest('Create File', testCreateFile)}
          disabled={isRunning || !hasProjectContext}
          title={
            !hasProjectContext
              ? 'Project context required for this test'
              : 'Test file creation functionality'
          }
        >
          {FontAwesomeIcon && <FontAwesomeIcon icon={faPlus} />}
          Create File
        </button>

        <button
          className="test-btn"
          onClick={() =>
            runTest('Replace Product Form', testReplaceProductForm)
          }
          disabled={isRunning || !hasProjectContext}
          title={
            !hasProjectContext
              ? 'Project context required for this test'
              : 'Test replacing the product selection form'
          }
        >
          {FontAwesomeIcon && <FontAwesomeIcon icon={faFileCode} />}
          Replace Product Form
        </button>

        <button
          className="test-btn"
          onClick={() => runTest('Validation', testValidation)}
          disabled={isRunning}
          title="Test edit validation system"
        >
          {FontAwesomeIcon && <FontAwesomeIcon icon={faCheck} />}
          Validation
        </button>

        <button
          className="test-btn"
          onClick={() => runTest('Backup', testBackup)}
          disabled={isRunning || !hasProjectContext}
          title={
            !hasProjectContext
              ? 'Project context required for this test'
              : 'Test backup creation functionality'
          }
        >
          {FontAwesomeIcon && <FontAwesomeIcon icon={faRocket} />}
          Backup
        </button>

        <button
          className="test-btn"
          onClick={() => runTest('Configuration', testConfiguration)}
          disabled={isRunning}
          title="Test service configuration changes"
        >
          {FontAwesomeIcon && <FontAwesomeIcon icon={faRocket} />}
          Configuration
        </button>

        <button
          className="test-btn error-test"
          onClick={() => runTest('Error Handling', testErrorHandling)}
          disabled={isRunning || !hasProjectContext}
          title={
            !hasProjectContext
              ? 'Project context required for this test'
              : 'Test error handling and recovery'
          }
        >
          {FontAwesomeIcon && <FontAwesomeIcon icon={faExclamationTriangle} />}
          Error Handling
        </button>
      </div>

      <div className="test-results">
        <h4>Test Results</h4>
        {testResults.length === 0 ? (
          <div className="no-results">
            {!hasProjectContext ? (
              <div className="project-warning">
                {FontAwesomeIcon && (
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                )}
                <strong>Project Context Required</strong>
                <p>
                  Most tests require a loaded project to function properly.
                  Please ensure you have a project loaded in EGDesk before
                  running these tests.
                </p>
                <p>
                  The tests will work with the <code>www/index.php</code> file
                  and create test files in the project directory.
                </p>
              </div>
            ) : (
              <p>No tests run yet. Click a button above to start testing.</p>
            )}
          </div>
        ) : (
          <div className="results-list">
            {testResults.map((result, index) => (
              <div
                key={index}
                className={`result-item ${result.success ? 'success' : 'error'}`}
              >
                <div className="result-header">
                  <span className="result-icon">
                    {result.success
                      ? FontAwesomeIcon && <FontAwesomeIcon icon={faCheck} />
                      : FontAwesomeIcon && <FontAwesomeIcon icon={faTimes} />}
                  </span>
                  <span className="result-time">
                    {result.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="result-message">{result.message}</div>
                {result.details && (
                  <details className="result-details">
                    <summary>Details</summary>
                    <pre>{JSON.stringify(result.details, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isRunning && (
        <div className="running-indicator">
          <div className="spinner" />
          <span>Running test...</span>
        </div>
      )}
    </div>
  );
};
