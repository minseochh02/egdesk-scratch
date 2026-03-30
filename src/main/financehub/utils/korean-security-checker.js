// ============================================================================
// KOREAN SECURITY APP CHECKER
// ============================================================================
// Detects and checks Korean banking security applications
// Required for Korean banking and card websites

// ps-list is an ES module, so we need to use dynamic import
let psList = null;

/**
 * Lazy load ps-list using dynamic import
 * @returns {Promise<Function>} ps-list function
 */
async function getPsList() {
  if (!psList) {
    const module = await import('ps-list');
    psList = module.default;
  }
  return psList;
}

/**
 * Known Korean security applications and their common process names
 */
const SECURITY_APPS = {
  touchEn: {
    name: 'TouchEn nxKey',
    processNames: ['nxkey', 'touchen', 'nprotect'],
    description: 'Keyboard security solution by RaonSecure',
    required: true,
  },
  ipinside: {
    name: 'IPinside',
    processNames: ['ipinside', 'lws', 'lws_agent'],
    description: 'Process monitoring and fraud detection',
    required: false,
  },
  astx: {
    name: 'ASTx',
    processNames: ['astx', 'transkey'],
    description: 'Anti-screen capture security',
    required: false,
  },
  veraport: {
    name: 'Veraport',
    processNames: ['veraport', 'veraport_launcher'],
    description: 'Application management system',
    required: false,
  },
};

/**
 * Check if a specific security app is running
 * @param {Array} processes - List of running processes from psList
 * @param {Object} appConfig - Security app configuration
 * @returns {Object} Detection result
 */
function checkSecurityApp(processes, appConfig) {
  const detectedProcesses = processes.filter(p => {
    const processName = p.name.toLowerCase();
    return appConfig.processNames.some(name =>
      processName.includes(name.toLowerCase())
    );
  });

  return {
    name: appConfig.name,
    description: appConfig.description,
    required: appConfig.required,
    isRunning: detectedProcesses.length > 0,
    processes: detectedProcesses.map(p => ({
      name: p.name,
      pid: p.pid,
      cpu: p.cpu,
      memory: p.memory,
    })),
  };
}

/**
 * Check all Korean security applications
 * @returns {Promise<Object>} Security apps status
 */
async function checkKoreanSecurityApps() {
  try {
    const psListFunc = await getPsList();
    const processes = await psListFunc();

    const results = {};
    const warnings = [];
    const errors = [];

    // Check each security app
    for (const [key, appConfig] of Object.entries(SECURITY_APPS)) {
      const result = checkSecurityApp(processes, appConfig);
      results[key] = result;

      // Track missing required apps
      if (appConfig.required && !result.isRunning) {
        errors.push(`Required security app not running: ${appConfig.name}`);
      } else if (!appConfig.required && !result.isRunning) {
        warnings.push(`Optional security app not running: ${appConfig.name}`);
      }
    }

    // Check if any required apps are missing
    const allRequiredRunning = Object.values(results)
      .filter(r => r.required)
      .every(r => r.isRunning);

    return {
      success: true,
      allRequiredRunning,
      results,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      allRequiredRunning: false,
      results: {},
      warnings: [],
      errors: [error.message],
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Check for a specific security app by name
 * @param {string} appKey - Security app key (e.g., 'touchEn', 'ipinside')
 * @returns {Promise<Object>} Detection result for specific app
 */
async function checkSpecificSecurityApp(appKey) {
  const appConfig = SECURITY_APPS[appKey];
  if (!appConfig) {
    throw new Error(`Unknown security app: ${appKey}`);
  }

  const psListFunc = await getPsList();
  const processes = await psListFunc();
  return checkSecurityApp(processes, appConfig);
}

/**
 * Get formatted security status report
 * @returns {Promise<string>} Formatted status report
 */
async function getSecurityStatusReport() {
  const status = await checkKoreanSecurityApps();

  let report = '\n=== Korean Security Apps Status ===\n';
  report += `Timestamp: ${status.timestamp}\n\n`;

  for (const [key, result] of Object.entries(status.results)) {
    const statusIcon = result.isRunning ? '✓' : '✗';
    const requiredLabel = result.required ? '[REQUIRED]' : '[OPTIONAL]';

    report += `${statusIcon} ${requiredLabel} ${result.name}\n`;
    report += `   ${result.description}\n`;

    if (result.isRunning) {
      report += `   Running: ${result.processes.length} process(es)\n`;
      result.processes.forEach(p => {
        report += `     - ${p.name} (PID: ${p.pid})\n`;
      });
    } else {
      report += `   Status: Not detected\n`;
    }
    report += '\n';
  }

  if (status.warnings.length > 0) {
    report += 'Warnings:\n';
    status.warnings.forEach(w => report += `  ⚠ ${w}\n`);
    report += '\n';
  }

  if (status.errors.length > 0) {
    report += 'Errors:\n';
    status.errors.forEach(e => report += `  ✗ ${e}\n`);
    report += '\n';
  }

  report += `Overall Status: ${status.allRequiredRunning ? 'READY ✓' : 'NOT READY ✗'}\n`;
  report += '===================================\n';

  return report;
}

module.exports = {
  checkKoreanSecurityApps,
  checkSpecificSecurityApp,
  getSecurityStatusReport,
  SECURITY_APPS,
};
