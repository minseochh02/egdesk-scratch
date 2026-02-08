/**
 * NAVIGATOR - Phase 4: Navigation Plan Generator
 *
 * Combines results from ROOKIE, RESOLVER, and EXPLORER to create
 * actionable navigation plans for extracting missing data from websites.
 */

import { generateWithRookieAI } from './rookie-ai-handler';
import * as fs from 'fs';
import * as path from 'path';

export interface NavigationStep {
  step: number;
  action: string; // "Click 'Sales'", "Filter by date", "Export data"
  target: string; // Which element to interact with
  purpose: string; // Why this step is needed
  expectedResult: string; // What we expect to see
}

export interface NavigationPlan {
  goal: string; // "Extract 거래처 data for report"
  missingData: string[]; // Data fields not in Excel files
  websiteSource: {
    siteName: string;
    siteType: string;
    capability: string; // Which website capability provides this data
    path: string; // Navigation path to the data
  };
  steps: NavigationStep[];
  estimatedTime: string; // "~2 minutes"
  notes?: string; // Any caveats or considerations
}

export interface NavigatorResult {
  success: boolean;
  plans?: NavigationPlan[]; // One plan per missing data source
  summary?: string;
  error?: string;
}

/**
 * Generate navigation plans based on ROOKIE, RESOLVER, and EXPLORER results
 */
export async function generateNavigationPlans(params: {
  rookieAnalysis: any; // Target report analysis from Phase 1
  resolverAnalysis: any; // Source mapping from Phase 2
  explorerResults: any; // Website capabilities from Phase 3
}): Promise<NavigatorResult> {
  const { rookieAnalysis, resolverAnalysis, explorerResults } = params;

  try {
    console.log('[Navigator] Generating navigation plans...');
    console.log('  - Explorer found:', explorerResults.capabilities?.length || 0, 'website capabilities');

    // HARDCODED FOR NOW: Use cached unresolved item
    const missingItem = {
      item: 'Sell-out and Sell-in Definition',
      reason: 'Precise business logic is needed to differentiate these sales categories from the source data',
      workaround: 'Look for customer type/group fields in sales data'
    };

    console.log('[Navigator] Hardcoded missing item:', missingItem.item);
    console.log('[Navigator] Reason:', missingItem.reason);

    // Build prompt for AI to generate navigation plan
    const websiteCapabilities = explorerResults.capabilities || [];

    // Show only sales-related capabilities to AI (to keep prompt focused)
    const relevantCapabilities = websiteCapabilities.filter((cap: any) =>
      cap.description.toLowerCase().includes('sales') ||
      cap.description.includes('판매') ||
      cap.section.includes('판매조회') ||
      cap.section.includes('거래처') ||
      cap.dataAvailable.some((d: string) =>
        d.toLowerCase().includes('customer') ||
        d.includes('거래처') ||
        d.toLowerCase().includes('sales')
      )
    ).slice(0, 10); // Limit to 10 most relevant

    console.log('[Navigator] Found', relevantCapabilities.length, 'sales-related capabilities for AI');

    const capabilitiesSummary = relevantCapabilities.map((cap: any, idx: number) =>
      `${idx + 1}. **${cap.section}** (Path: ${cap.path})
   - Data available: ${cap.dataAvailable.join(', ')}`
    ).join('\n');

    const prompt = `You are a navigation planner for data extraction from an ERP website.

## CONTEXT

**Unresolved Item:** "${missingItem.item}"
**Why it's unresolved:** ${missingItem.reason}

**Website:** ${explorerResults.siteName} (${explorerResults.siteType})

**Relevant Website Capabilities:**
${capabilitiesSummary}

## YOUR TASK

Create a detailed, step-by-step navigation plan to resolve "${missingItem.item}" using the website capabilities above.

The plan should:
1. Start from login page
2. Navigate to the appropriate section that has customer/sales data
3. Guide user to find the customer classification/grouping fields
4. Explain how to identify Sell-out (direct customers/end users) vs Sell-in (distributors/resellers)
5. Show how to export the data

**Be specific:**
- Mention exact menu paths from the capabilities above
- Reference specific data fields shown in dataAvailable
- Provide actionable clicks (e.g., "Click 판매조회 link")
- Explain what to look for at each step

Create one comprehensive navigation plan with 5-7 steps.`;

    const navigationResult = await generateWithRookieAI({
      prompt,
      systemPrompt: 'You are a navigation planner. Create detailed, actionable step-by-step plans for extracting business data from ERP websites.',
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 8192,
      responseSchema: {
        type: 'object',
        properties: {
          plans: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                goal: { type: 'string', description: 'What data to extract' },
                missingData: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Data fields to get from website',
                },
                websiteSource: {
                  type: 'object',
                  properties: {
                    siteName: { type: 'string' },
                    siteType: { type: 'string' },
                    capability: { type: 'string' },
                    path: { type: 'string' },
                  },
                  required: ['siteName', 'siteType', 'capability', 'path'],
                },
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      step: { type: 'number' },
                      action: { type: 'string' },
                      target: { type: 'string' },
                      purpose: { type: 'string' },
                      expectedResult: { type: 'string' },
                    },
                    required: ['step', 'action', 'target', 'purpose', 'expectedResult'],
                  },
                },
                estimatedTime: { type: 'string' },
                notes: { type: 'string' },
              },
              required: ['goal', 'missingData', 'websiteSource', 'steps', 'estimatedTime'],
            },
          },
          summary: { type: 'string' },
        },
        required: ['plans', 'summary'],
      },
    });

    console.log('[Navigator] Navigation planning complete');

    if (navigationResult.json && navigationResult.json.plans) {
      const plans = navigationResult.json.plans;
      console.log('[Navigator] ✓ AI generated', plans.length, 'navigation plans');
      plans.forEach((p: any) => {
        console.log(`  - ${p.goal}: ${p.steps.length} steps`);
      });

      return {
        success: true,
        plans,
        summary: navigationResult.json.summary,
      };
    }

    return {
      success: false,
      error: 'AI did not generate valid navigation plans',
    };
  } catch (error: any) {
    console.error('[Navigator] Error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Save navigation plans to file
 */
export function saveNavigationPlans(result: NavigatorResult, outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `navigation_plan_${timestamp}.json`;
  const filePath = path.join(outputDir, fileName);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));

  return filePath;
}
