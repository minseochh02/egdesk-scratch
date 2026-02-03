/**
 * Centralized anti-detection measures
 * Hides browser automation fingerprints from detection systems
 *
 * Previously duplicated across 3+ files (~180 lines total)
 * Now centralized in one location for easy updates and security review
 */

import { Page } from 'playwright-core';

/**
 * Apply anti-detection measures to a page
 * Mocks navigator and chrome objects to hide automation
 *
 * @param page Playwright page to apply measures to
 *
 * @example
 * const page = await context.newPage();
 * await applyAntiDetectionMeasures(page);
 * await page.goto('https://example.com');
 */
export async function applyAntiDetectionMeasures(page: Page): Promise<void> {
  try {
    await page.addInitScript(() => {
      // Hide webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Mock chrome object
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {},
      };

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Mock permissions
      const originalQuery = (window.navigator as any).permissions.query;
      (window.navigator as any).permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);

      // Override the plugins property to return a fake array
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          return [
            {
              0: {
                type: 'application/x-google-chrome-pdf',
                suffixes: 'pdf',
                description: 'Portable Document Format',
                enabledPlugin: {},
              },
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Plugin',
            },
            {
              0: {
                type: 'application/pdf',
                suffixes: 'pdf',
                description: '',
                enabledPlugin: {},
              },
              description: '',
              filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
              length: 1,
              name: 'Chrome PDF Viewer',
            },
            {
              0: {
                type: 'application/x-nacl',
                suffixes: '',
                description: 'Native Client Executable',
                enabledPlugin: {},
              },
              1: {
                type: 'application/x-pnacl',
                suffixes: '',
                description: 'Portable Native Client Executable',
                enabledPlugin: {},
              },
              description: '',
              filename: 'internal-nacl-plugin',
              length: 2,
              name: 'Native Client',
            },
          ];
        },
      });

      // Mock mimeTypes
      Object.defineProperty(navigator, 'mimeTypes', {
        get: () => {
          return [
            {
              type: 'application/pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format',
              enabledPlugin: {},
            },
            {
              type: 'application/x-google-chrome-pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format',
              enabledPlugin: {},
            },
            {
              type: 'application/x-nacl',
              suffixes: '',
              description: 'Native Client Executable',
              enabledPlugin: {},
            },
            {
              type: 'application/x-pnacl',
              suffixes: '',
              description: 'Portable Native Client Executable',
              enabledPlugin: {},
            },
          ];
        },
      });

      // Mock platform (ensures consistency)
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32', // Or detect from process.platform
      });

      // Mock vendor
      Object.defineProperty(navigator, 'vendor', {
        get: () => 'Google Inc.',
      });

      // Mock hardwareConcurrency (common values: 4, 8, 16)
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });

      // Mock deviceMemory (common values: 4, 8)
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });

      // Mock maxTouchPoints
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0,
      });

      // Override toString methods to hide proxy
      const originalToString = Function.prototype.toString;
      Function.prototype.toString = function() {
        if (this === navigator.permissions.query) {
          return 'function query() { [native code] }';
        }
        return originalToString.call(this);
      };
    });

    console.log('✅ Applied anti-detection measures to page');
  } catch (error) {
    console.error('Failed to apply anti-detection measures:', error);
    throw error;
  }
}

/**
 * Apply minimal anti-detection measures (lighter version)
 * Only hides the most obvious automation markers
 *
 * @param page Playwright page to apply measures to
 */
export async function applyMinimalAntiDetection(page: Page): Promise<void> {
  try {
    await page.addInitScript(() => {
      // Hide webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Mock chrome object
      (window as any).chrome = {
        runtime: {},
      };
    });

    console.log('✅ Applied minimal anti-detection measures to page');
  } catch (error) {
    console.error('Failed to apply minimal anti-detection measures:', error);
    throw error;
  }
}
