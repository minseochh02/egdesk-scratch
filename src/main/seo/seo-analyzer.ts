import path from 'path';
import { ipcMain, app } from 'electron';

export function registerSEOHandlers() {
  ipcMain.handle('generate-lighthouse-reports', async (event, { urls, proxy }) => {
    try {
      const { chromium } = require('playwright-core');
      const { playAudit } = require('playwright-lighthouse');
      const fs = require('fs');
      // Use userData directory in production, cwd in development
      const outputDir = app.isPackaged
        ? path.join(app.getPath('userData'), 'output')
        : path.join(process.cwd(), 'output');

      console.log(`🔍 Starting batch Lighthouse generation for ${urls.length} URLs...`);

      // Build proxy option if provided
      let proxyOption: any;
      if (proxy) {
        try {
          const proxyUrl = new URL(proxy);
          proxyOption = {
            server: `${proxyUrl.protocol}//${proxyUrl.host}`,
            username: proxyUrl.username || undefined,
            password: proxyUrl.password || undefined,
          };
        } catch {
          console.warn('Invalid proxy URL, ignoring proxy option');
        }
      }

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const results: any[] = [];
      const debugPort = Math.floor(Math.random() * 10000) + 9000;

      const browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        proxy: proxyOption,
        args: [
          `--remote-debugging-port=${debugPort}`,
          '--lang=ko',
          '--enable-features=Lighthouse',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
      });

      const context = await browser.newContext({ locale: 'ko-KR' });

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const urlResult = {
          url,
          success: false,
          reportName: null as string | null,
          error: null as string | null,
          index: i + 1,
          total: urls.length,
        };

        try {
          event.sender.send('lighthouse-progress', {
            current: i + 1,
            total: urls.length,
            url,
            status: 'processing',
          });

          const page = await context.newPage();
          
          // Navigate with better error handling
          try {
            await page.goto(url, { 
              waitUntil: 'load',
              timeout: 60000 // 60 second timeout
            });
            
            // Wait for network to be idle (but don't fail if it times out)
            try {
              await page.waitForLoadState('networkidle', { timeout: 10000 });
            } catch (networkIdleError) {
              console.warn(`⚠️ Network idle timeout for ${url} (page may still be loading)`);
              // Continue anyway - page is loaded even if network isn't idle
            }
            
          await page.waitForTimeout(2000);
            
            // Verify we're not stuck at about:blank
            const currentUrl = page.url();
            if (currentUrl === 'about:blank' || currentUrl.startsWith('about:')) {
              console.error(`❌ Navigation failed for ${url} - still at ${currentUrl}`);
              // Try navigation again
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
              const retryUrl = page.url();
              if (retryUrl === 'about:blank' || retryUrl.startsWith('about:')) {
                throw new Error(`Failed to navigate away from about:blank for ${url}`);
              }
            }
          } catch (navigationError) {
            const currentUrl = page.url();
            console.error(`❌ Navigation error for ${url}:`, navigationError);
            console.error(`❌ Current page URL: ${currentUrl}`);
            throw navigationError;
          }

          const timestamp = Date.now();
          const sanitizedUrl = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
          const reportName = `lighthouse-${sanitizedUrl}-${timestamp}`;

          // Run Lighthouse audit - catch threshold errors but still generate reports
          try {
            await playAudit({
              page,
              port: debugPort,
              opts: { locale: 'ko' },
              thresholds: {
                performance: 0, // Lower threshold to avoid blocking on performance issues
                accessibility: 50,
                'best-practices': 50,
                seo: 50,
                pwa: 0, // PWA is often not applicable, so don't block on it
              },
              reports: {
                formats: { html: true, json: true },
                name: reportName,
                directory: outputDir,
              },
            });
          } catch (thresholdError: any) {
            // If thresholds fail, the report is still generated, so we can continue
            // Log the warning but don't fail the entire analysis
            if (thresholdError?.message?.includes('threshold')) {
              console.warn(`⚠️ Lighthouse thresholds not met for ${url}, but report generated:`, thresholdError.message);
            } else {
              // Re-throw if it's a different error
              throw thresholdError;
            }
          }

          // Generate PDF: expand sections and print
          try {
            const htmlReportPath = `file://${path.join(outputDir, `${reportName}.html`)}`;
            const pdfPage = await context.newPage();
            await pdfPage.goto(htmlReportPath);
            await pdfPage.waitForLoadState('networkidle');
            await pdfPage.waitForTimeout(2000);
            await pdfPage.evaluate(() => {
              document.querySelectorAll('details').forEach((d: any) => (d.open = true));
              document.querySelectorAll('[aria-expanded="false"]').forEach((el: any) => el.setAttribute('aria-expanded', 'true'));
              document.querySelectorAll('.lh-collapsed, .collapsed').forEach((el: any) => el.classList.remove('lh-collapsed', 'collapsed'));
            });
            await pdfPage.waitForTimeout(1000);
            const pdfPath = path.join(outputDir, `${reportName}.pdf`);
            await pdfPage.pdf({
              path: pdfPath,
              format: 'A4',
              printBackground: true,
              margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
            });
            await pdfPage.close();
          } catch (pdfError) {
            console.error('❌ PDF generation failed:', pdfError);
          }

          urlResult.success = true;
          urlResult.reportName = reportName;

          event.sender.send('lighthouse-progress', {
            current: i + 1,
            total: urls.length,
            url,
            status: 'completed',
            reportName,
          });

          await page.close();
        } catch (error: any) {
          console.error(`❌ Failed to process ${url}:`, error);
          urlResult.error = error?.message || 'Unknown error';
          event.sender.send('lighthouse-progress', {
            current: i + 1,
            total: urls.length,
            url,
            status: 'failed',
            error: urlResult.error,
          });
        }

        results.push(urlResult);
      }

      // Merge JSON and synthesize reports and summary
      const fs = require('fs');
      const allJsonData: any[] = [];
      const successfulResults = results.filter((r) => r.success && r.reportName);
      const mergedJsonPath = path.join(outputDir, `merged-lighthouse-${Date.now()}.json`);
      for (const result of successfulResults) {
        try {
          const jsonPath = path.join(outputDir, `${result.reportName}.json`);
          if (fs.existsSync(jsonPath)) {
            const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            allJsonData.push({ url: result.url, reportName: result.reportName, data: jsonData });
          }
        } catch (err) {
          console.error(`Failed to read JSON for ${result.url}:`, err);
        }
      }
      fs.writeFileSync(mergedJsonPath, JSON.stringify(allJsonData, null, 2));

      // Aggregate scores
      const scores: any[] = [];
      let totalPerformance = 0;
      let totalAccessibility = 0;
      let totalBestPractices = 0;
      let totalSEO = 0;
      let totalPWA = 0;
      let validScoresCount = 0;
      for (const jsonItem of allJsonData) {
        const lhr = jsonItem.data?.lhr || jsonItem.data;
        if (lhr?.categories) {
          const perf = lhr.categories.performance?.score || 0;
          const a11y = lhr.categories.accessibility?.score || 0;
          const bp = lhr.categories['best-practices']?.score || 0;
          const seo = lhr.categories.seo?.score || 0;
          const pwa = lhr.categories.pwa?.score || 0;
          scores.push({
            url: jsonItem.url,
            performance: Math.round(perf * 100),
            accessibility: Math.round(a11y * 100),
            bestPractices: Math.round(bp * 100),
            seo: Math.round(seo * 100),
            pwa: Math.round(pwa * 100),
            average: Math.round(((perf + a11y + bp + seo + pwa) / 5) * 100),
          });
          totalPerformance += perf;
          totalAccessibility += a11y;
          totalBestPractices += bp;
          totalSEO += seo;
          totalPWA += pwa;
          validScoresCount++;
        }
      }
      const avgPerformance = validScoresCount > 0 ? Math.round((totalPerformance / validScoresCount) * 100) : 0;
      const avgAccessibility = validScoresCount > 0 ? Math.round((totalAccessibility / validScoresCount) * 100) : 0;
      const avgBestPractices = validScoresCount > 0 ? Math.round((totalBestPractices / validScoresCount) * 100) : 0;
      const avgSEO = validScoresCount > 0 ? Math.round((totalSEO / validScoresCount) * 100) : 0;
      const avgPWA = validScoresCount > 0 ? Math.round((totalPWA / validScoresCount) * 100) : 0;
      const overallAverage = validScoresCount > 0 ? Math.round(((totalPerformance + totalAccessibility + totalBestPractices + totalSEO + totalPWA) / (validScoresCount * 5)) * 100) : 0;

      // Collect issues by category
      const issuesByCategory: { [key: string]: Set<string> } = {
        performance: new Set(),
        accessibility: new Set(),
        'best-practices': new Set(),
        seo: new Set(),
        pwa: new Set(),
      };
      for (const jsonItem of allJsonData) {
        const lhr = jsonItem.data?.lhr || jsonItem.data;
        if (lhr?.audits) {
          Object.entries(lhr.audits).forEach(([key, audit]: [string, any]) => {
            if (audit.score !== null && audit.score < 1 && audit.score !== -1) {
              const category = Object.keys(lhr.categories || {}).find((cat) => {
                const categoryAudits = lhr.categories[cat]?.auditRefs || [];
                return categoryAudits.some((ref: any) => ref.id === key);
              }) || 'other';
              if (issuesByCategory[category]) {
                issuesByCategory[category].add(audit.title);
              }
            }
          });
        }
      }

      // Generate final report HTML (simplified): keep same as before
      const getScoreColor = (score: number) => {
        if (score >= 90) return '#0cce6b';
        if (score >= 50) return '#ffa400';
        return '#ff4e42';
      };

      let aiExplanation = '';
      try {
        const { getStore } = require('../storage');
        const store = getStore();
        const aiKeys = store ? store.get('ai-keys', []) : [];
        let googleKey: any = null;
        if (Array.isArray(aiKeys)) {
          const egdeskKey = aiKeys.find((k: any) => (k?.name || '').toLowerCase() === 'egdesk' && k?.providerId === 'google');
          googleKey = egdeskKey || aiKeys.find((k: any) => k?.providerId === 'google' && k?.isActive) || aiKeys.find((k: any) => k?.providerId === 'google');
        }
        const geminiApiKey = googleKey?.fields?.apiKey || process.env.GEMINI_API_KEY || '';
        if (geminiApiKey) {
          const issuesSummary = Object.entries(issuesByCategory)
            .filter(([_, issues]) => (issues as Set<string>).size > 0)
            .map(([category, issues]) => `${category}: ${Array.from(issues as Set<string>).join(', ')}`)
            .join('\n');
          const prompt = `당신은 SEO 전문가입니다. 웹사이트 분석 결과 발견된 다음 문제들을 SEO에 대해 전혀 모르는 일반 사용자가 이해할 수 있도록 쉽고 친절하게 설명해주세요:\n\n웹사이트 분석 점수:\n- 전체 평균: ${overallAverage}점\n- 성능: ${avgPerformance}점\n- 접근성: ${avgAccessibility}점\n- SEO: ${avgSEO}점\n\n발견된 주요 문제들:\n${issuesSummary}\n\n다음 형식으로 답변해주세요:\n1. 전체적인 상황 요약 (2-3문장)\n2. 각 카테고리별 문제점과 해결 방법을 쉽게 설명\n3. 우선순위가 높은 개선사항 3가지\n\n전문 용어는 피하고, 일반인도 이해할 수 있는 쉬운 말로 설명해주세요.`;
          const { generateTextWithAI } = await import('../gemini');
          const result = await generateTextWithAI({
            prompt,
            model: 'gemini-2.5-flash',
            streaming: false,
            useRetry: false,
            package: 'generative-ai',
          });
          aiExplanation = result.text || '(AI 설명을 생성하지 못했습니다)';
        } else {
          aiExplanation = '(AI 설명을 생성하려면 Google AI 키를 추가하거나 GEMINI_API_KEY 환경 변수를 설정하세요)';
        }
      } catch (aiError) {
        console.error('Failed to generate AI explanation:', aiError);
        aiExplanation = '(AI 설명 생성 중 오류가 발생했습니다)';
      }

      const finalReportPath = path.join(outputDir, `final-seo-report-${Date.now()}.html`);
      const urlsCount = urls.length;
      const successfulCount = results.filter((r) => r.success).length;
      const failedCount = results.filter((r) => !r.success).length;

      const finalReportHtml = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SEO 최종 분석 보고서</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px;background:#f5f5f5}.container{max-width:1200px;margin:0 auto;background:#fff;padding:40px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1)}h1{color:#202124;margin-bottom:10px;font-size:32px}.subtitle{color:#5f6368;margin-bottom:40px;font-size:16px}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:20px;margin-bottom:40px}.summary-card{padding:20px;border-radius:8px;background:#667eea;color:#fff}.summary-card .value{font-size:48px;font-weight:700;margin-bottom:8px}.summary-card .label{font-size:14px;opacity:.9}.overall-score{text-align:center;padding:40px;background:#f5576c;border-radius:12px;color:#fff;margin-bottom:40px}.overall-score .score{font-size:72px;font-weight:700;margin-bottom:10px}.overall-score .label{font-size:20px;opacity:.9}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:16px;text-align:left;border-bottom:1px solid #e0e0e0}th{background:#f8f9fa;font-weight:600;color:#202124}.score-badge{display:inline-block;padding:4px 12px;border-radius:12px;font-weight:600;font-size:14px;color:#fff}.url-cell{max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e0e0e0;color:#5f6368;font-size:14px;text-align:center}</style></head><body><div class="container"><h1>🎯 SEO 최종 분석 보고서</h1><div class="subtitle">생성일: ${new Date().toLocaleString('ko-KR')}</div><div class="overall-score"><div class="score">${overallAverage}</div><div class="label">전체 평균 점수</div></div><div class="summary"><div class="summary-card"><div class="value">${avgPerformance}</div><div class="label">평균 성능</div></div><div class="summary-card"><div class="value">${avgAccessibility}</div><div class="label">평균 접근성</div></div><div class="summary-card"><div class="value">${avgBestPractices}</div><div class="label">평균 모범 사례</div></div><div class="summary-card"><div class="value">${avgSEO}</div><div class="label">평균 SEO</div></div><div class="summary-card"><div class="value">${avgPWA}</div><div class="label">평균 PWA</div></div></div><h2 style="margin-bottom:20px;color:#202124;">페이지별 상세 점수</h2><table><thead><tr><th>URL</th><th>성능</th><th>접근성</th><th>모범 사례</th><th>SEO</th><th>PWA</th><th>평균</th></tr></thead><tbody>${scores.map((s)=>`<tr><td class="url-cell" title="${s.url}">${s.url}</td><td><span class="score-badge" style="background-color:${getScoreColor(s.performance)}">${s.performance}</span></td><td><span class="score-badge" style="background-color:${getScoreColor(s.accessibility)}">${s.accessibility}</span></td><td><span class="score-badge" style="background-color:${getScoreColor(s.bestPractices)}">${s.bestPractices}</span></td><td><span class="score-badge" style="background-color:${getScoreColor(s.seo)}">${s.seo}</span></td><td><span class="score-badge" style="background-color:${getScoreColor(s.pwa)}">${s.pwa}</span></td><td><span class="score-badge" style="background-color:${getScoreColor(s.average)}">${s.average}</span></td></tr>`).join('')}</tbody></table><div class="footer"><p>총 ${urlsCount}개 페이지 분석 완료 (성공: ${successfulCount}개, 실패: ${failedCount}개)</p><p>상세 보고서는 개별 Lighthouse HTML 파일을 참조하세요.</p></div></div></body></html>`;
      fs.writeFileSync(finalReportPath, finalReportHtml);

      await browser.close();

      return {
        success: true,
        results,
        summary: { total: urls.length, successful: successfulCount, failed: failedCount },
        mergedJsonPath,
        mergedPdfPath: null,
        finalReportPath,
        scores: {
          overall: overallAverage,
          performance: avgPerformance,
          accessibility: avgAccessibility,
          bestPractices: avgBestPractices,
          seo: avgSEO,
          pwa: avgPWA,
        },
      };
    } catch (error: any) {
      console.error('❌ Batch Lighthouse generation failed:', error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  });
}


