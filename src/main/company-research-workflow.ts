import { crawlWebsiteIntelligent, CrawlResult } from './company-research-stage1';
import { summarizeWebsiteContent, WebsiteSummary } from './company-research-stage2';
import { executeAgenticResearch, AgenticResearchData } from './company-research-stage3';
import { generateDetailedReport, DetailedReport } from './company-research-stage3b1';
import { generateExecutiveSummary, ExecutiveSummary } from './company-research-stage3b2';
import { autoSaveReport } from './company-research-stage4';
import { BrowserWindow, shell } from 'electron';
import { getSQLiteManager } from './sqlite/manager';
import path from 'path';

export interface WorkflowProgress {
  stage: 'crawl' | 'summary' | 'research' | 'report-detailed' | 'report-exec' | 'export' | 'complete' | 'error';
  message: string;
  data?: any;
}

export interface FullResearchResult {
  crawl?: CrawlResult;
  summary?: WebsiteSummary;
  research?: AgenticResearchData;
  detailedReport?: DetailedReport;
  execSummary?: ExecutiveSummary;
  localReportPath?: string;
  error?: string;
}

export async function processFullCompanyResearch(
  domain: string,
  inquiryData: any = {},
  options: { bypassCache?: boolean; createGoogleDoc?: boolean } = {},
  window?: BrowserWindow
): Promise<FullResearchResult> {
  const result: FullResearchResult = {};
  const { bypassCache = false, createGoogleDoc = false } = options;

  const sendProgress = (progress: WorkflowProgress) => {
    if (window) {
      window.webContents.send('company-research-progress', progress);
    }
    console.log(`[Workflow] ${progress.stage.toUpperCase()}: ${progress.message}`);
  };

  try {
    // Stage 1: Crawl
    sendProgress({ stage: 'crawl', message: 'Starting intelligent crawl...' });
    result.crawl = await crawlWebsiteIntelligent(domain, bypassCache);
    if (result.crawl.error && !result.crawl.pages.length) {
      throw new Error(`Crawl failed: ${result.crawl.error}`);
    }
    sendProgress({ stage: 'crawl', message: `Crawl complete. Found ${result.crawl.pageCount} pages.`, data: result.crawl });

    // Stage 2: Summary
    sendProgress({ stage: 'summary', message: 'Generating website summary...' });
    result.summary = await summarizeWebsiteContent(result.crawl, bypassCache) || undefined;
    if (!result.summary) {
      throw new Error('Summary generation failed');
    }
    sendProgress({ stage: 'summary', message: 'Summary generated.', data: result.summary });

    // Stage 3: Agentic Research
    sendProgress({ stage: 'research', message: 'Performing agentic research (Google Search Grounding)...' });
    result.research = await executeAgenticResearch(domain, result.summary, bypassCache) || undefined;
    if (!result.research) {
      throw new Error('Agentic research failed');
    }
    sendProgress({ stage: 'research', message: `Research complete. Found ${result.research.validatedFindings.length} validated findings.`, data: result.research });

    // Stage 3B-1: Detailed Report
    sendProgress({ stage: 'report-detailed', message: 'Generating detailed analysis report...' });
    result.detailedReport = await generateDetailedReport(domain, result.summary, result.research, inquiryData, bypassCache) || undefined;
    if (!result.detailedReport) {
      throw new Error('Detailed report generation failed');
    }
    sendProgress({ stage: 'report-detailed', message: 'Detailed report generated.', data: result.detailedReport });

    // Stage 3B-2: Executive Summary
    sendProgress({ stage: 'report-exec', message: 'Generating executive summary...' });
    result.execSummary = await generateExecutiveSummary(domain, result.detailedReport.content, inquiryData, result.summary, result.research, bypassCache) || undefined;
    if (!result.execSummary) {
      throw new Error('Executive summary generation failed');
    }
    sendProgress({ stage: 'report-exec', message: 'Executive summary generated.', data: result.execSummary });

    // Stage 4: Export (Local Save)
    const exportName = `${domain.replace(/[^a-z0-9]/gi, '_')}_Research_Report`;
    
    try {
      sendProgress({ stage: 'export', message: 'Saving research report locally...' });
      const exportResult = await autoSaveReport(exportName, result.detailedReport.content);
      
      if (exportResult.success && exportResult.filePath) {
        result.localReportPath = exportResult.filePath;
        console.log(`[Workflow] Report automatically saved to: ${exportResult.filePath}`);
        sendProgress({ stage: 'export', message: `Report saved locally: ${exportResult.filePath}` });
        
        // Open the folder containing the report
        const folderPath = path.dirname(exportResult.filePath);
        await shell.openPath(folderPath);
        console.log(`[Workflow] Opened folder: ${folderPath}`);
      } else {
        console.warn(`[Workflow] Automatic save failed: ${exportResult.error}`);
        sendProgress({ stage: 'export', message: `Warning: Failed to save report locally (${exportResult.error})` });
      }
    } catch (exportError) {
      console.error(`[Workflow] Failed during automatic report save:`, exportError);
    }

    sendProgress({ stage: 'complete', message: 'Full company research completed successfully!', data: result });

    // Save to database
    try {
      console.log(`[Workflow] Attempting to save research for ${domain} to database...`);
      const sqliteManager = getSQLiteManager();
      console.log(`[Workflow] SQLite Manager available: ${sqliteManager.isAvailable()}`);
      
      if (sqliteManager.isAvailable()) {
        const researchManager = sqliteManager.getCompanyResearchManager();
        const savedRecord = researchManager.saveResearch({
          domain,
          companyName: result.summary?.companyName || domain,
          status: 'completed',
          crawlData: result.crawl,
          summaryData: result.summary,
          researchData: result.research,
          detailedReport: result.detailedReport,
          executiveSummary: result.execSummary,
          localReportPath: result.localReportPath,
          inquiryData
        });
        console.log(`[Workflow] ✅ Saved research for ${domain} to database (ID: ${savedRecord.id}).`);
      } else {
        const status = sqliteManager.getStatus();
        console.warn(`[Workflow] ⚠️ Cannot save to database: SQLite Manager not ready. Status:`, status);
      }
    } catch (dbError) {
      console.error(`[Workflow] ❌ Failed to save research to database:`, dbError);
    }

    return result;

  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error during workflow';
    console.error(`❌ [Workflow] Failed at ${domain}:`, error);
    sendProgress({ stage: 'error', message: errorMessage });

    // Save failure to database
    try {
      const sqliteManager = getSQLiteManager();
      if (sqliteManager.isAvailable()) {
        const researchManager = sqliteManager.getCompanyResearchManager();
        researchManager.saveResearch({
          domain,
          status: 'failed',
          error: errorMessage,
          crawlData: result.crawl,
          summaryData: result.summary,
          researchData: result.research,
          detailedReport: result.detailedReport,
          executiveSummary: result.execSummary,
          localReportPath: result.localReportPath,
          inquiryData
        });
      }
    } catch (dbError) {
      // Ignore DB save error on top of main error
    }

    return { ...result, error: errorMessage };
  }
}

