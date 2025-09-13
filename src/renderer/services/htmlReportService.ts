import { OverallSecurityResult } from './sslAnalysisService';

export class HTMLReportService {
  /**
   * Generate and open HTML report using Electron's capabilities
   */
  static openHTMLReport(analysis: OverallSecurityResult, websiteUrl: string): void {
    const htmlContent = this.generateHTMLReport(analysis, websiteUrl);
    
    // For now, use the modal approach which works reliably in Electron
    // In the future, this can be enhanced to use Electron's main process
    this.openInCurrentWindow(htmlContent);
  }

  /**
   * Save HTML report as file (Electron-friendly approach)
   */
  static saveHTMLReport(analysis: OverallSecurityResult, websiteUrl: string): void {
    const htmlContent = this.generateHTMLReport(analysis, websiteUrl);
    const fileName = `SSL_보안분석_${websiteUrl.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
    
    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * Fallback method to open HTML in current window as modal
   */
  private static openInCurrentWindow(htmlContent: string): void {
    // Create a modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'ssl-report-modal';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 10000;
      overflow: auto;
      padding: 0;
      margin: 0;
    `;
    
    // Create content container
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      position: relative;
      overflow: auto;
    `;
    
    // Add control buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
      z-index: 10001;
    `;

    // Print button
    const printButton = document.createElement('button');
    printButton.innerHTML = '🖨️ 인쇄';
    printButton.title = '인쇄 (Ctrl+P)';
    printButton.style.cssText = `
      background: #3498db;
      color: white;
      border: none;
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: all 0.3s ease;
    `;
    
    printButton.onmouseover = () => {
      printButton.style.background = '#2980b9';
      printButton.style.transform = 'scale(1.05)';
    };
    
    printButton.onmouseout = () => {
      printButton.style.background = '#3498db';
      printButton.style.transform = 'scale(1)';
    };
    
    printButton.onclick = () => {
      // Create a new window for printing with clean, print-optimized content
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        // Create a clean HTML document optimized for printing
        const cleanHtmlContent = this.generatePrintOptimizedHTML(htmlContent);
        printWindow.document.write(cleanHtmlContent);
        printWindow.document.close();
        
        // Wait for content to load, then print
        printWindow.onload = () => {
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      } else {
        // Fallback: create a temporary print-optimized element
        this.printFallback(htmlContent);
      }
    };

    // Close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕ 닫기';
    closeButton.style.cssText = `
      background: #e74c3c;
      color: white;
      border: none;
      padding: 12px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: all 0.3s ease;
    `;
    
    closeButton.onmouseover = () => {
      closeButton.style.background = '#c0392b';
      closeButton.style.transform = 'scale(1.05)';
    };
    
    closeButton.onmouseout = () => {
      closeButton.style.background = '#e74c3c';
      closeButton.style.transform = 'scale(1)';
    };
    
    closeButton.onclick = () => {
      document.body.removeChild(overlay);
    };

    // Add buttons to container
    buttonContainer.appendChild(printButton);
    buttonContainer.appendChild(closeButton);
    
    // Set the HTML content
    content.innerHTML = htmlContent;
    
    // Add buttons to overlay (not content)
    overlay.appendChild(buttonContainer);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    // Handle keyboard shortcuts
    const handleKeyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('ssl-report-modal');
        if (modal) {
          document.body.removeChild(modal);
        }
        document.removeEventListener('keydown', handleKeyboard);
      } else if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        printButton.click();
      }
    };
    document.addEventListener('keydown', handleKeyboard);
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    
    // Restore body scroll when modal is closed
    const restoreScroll = () => {
      document.body.style.overflow = 'auto';
    };
    
    const cleanup = () => {
      document.body.removeChild(overlay);
      restoreScroll();
      document.removeEventListener('keydown', handleKeyboard);
    };

    closeButton.addEventListener('click', cleanup);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
      }
    });
  }

  /**
   * Generate print-optimized HTML content
   */
  private static generatePrintOptimizedHTML(htmlContent: string): string {
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SSL 보안 분석 보고서</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
            font-size: 12pt;
        }
        
        .report-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: white;
        }
        
        .report-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #3498db;
        }
        
        .report-title {
            font-size: 24pt;
            font-weight: 700;
            margin-bottom: 10px;
            color: #2c3e50;
        }
        
        .report-subtitle {
            font-size: 14pt;
            color: #666;
            margin-bottom: 20px;
        }
        
        .report-meta {
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
        }
        
        .meta-item {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .meta-label {
            font-size: 10pt;
            color: #666;
            margin-bottom: 5px;
        }
        
        .meta-value {
            font-size: 12pt;
            font-weight: 600;
            color: #333;
        }
        
        .section {
            margin: 25px 0;
            page-break-inside: avoid;
        }
        
        .section-title {
            font-size: 18pt;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #3498db;
        }
        
        .security-grade-section {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 25px;
            text-align: center;
            margin: 25px 0;
            page-break-inside: avoid;
        }
        
        .grade-display {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .grade-letter {
            font-size: 48pt;
            font-weight: 900;
            line-height: 1;
        }
        
        .grade-score {
            font-size: 20pt;
            font-weight: 600;
            color: #6c757d;
        }
        
        .grade-description {
            font-size: 16pt;
            font-weight: 500;
            color: #495057;
        }
        
        .grade-a-plus, .grade-a {
            color: #28a745;
        }
        
        .grade-b {
            color: #17a2b8;
        }
        
        .grade-c {
            color: #ffc107;
        }
        
        .grade-d {
            color: #fd7e14;
        }
        
        .grade-f {
            color: #dc3545;
        }
        
        .business-impact-section {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 25px;
            margin: 25px 0;
            page-break-inside: avoid;
        }
        
        .impact-summary, .investment-grid {
            display: block;
        }
        
        .impact-item, .investment-item {
            display: block;
            margin-bottom: 15px;
            padding: 15px;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            background: white;
            page-break-inside: avoid;
        }
        
        .impact-label, .investment-label {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        
        .impact-value, .investment-value {
            color: #333;
            font-size: 14pt;
        }
        
        .analysis-details {
            page-break-inside: avoid;
            margin: 20px 0;
        }
        
        .detail-item {
            page-break-inside: avoid;
            margin-bottom: 15px;
            padding: 15px;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            background: #f8f9fa;
        }
        
        .status-indicator {
            display: inline-block;
            margin-right: 8px;
        }
        
        .recommendations {
            page-break-inside: avoid;
            margin: 20px 0;
        }
        
        .recommendation-item {
            page-break-inside: avoid;
            margin-bottom: 10px;
            padding: 10px;
            border-left: 4px solid #3498db;
            background: #f8f9fa;
        }
        
        .footer {
            margin-top: 40px;
            padding: 20px 0;
            border-top: 1px solid #dee2e6;
            text-align: center;
            color: #666;
            font-size: 10pt;
        }
        
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            @page {
                margin: 0.5in;
                size: A4;
            }
            
            body {
                background: white !important;
                color: black !important;
                font-size: 12pt;
                line-height: 1.4;
            }
            
            .report-container {
                max-width: none !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            .section {
                page-break-inside: avoid;
                margin: 15px 0 !important;
            }
            
            .section-title {
                page-break-after: avoid;
                font-size: 16pt !important;
            }
            
            .security-grade-section, .business-impact-section {
                page-break-inside: avoid;
                margin: 15px 0 !important;
                padding: 15px !important;
            }
            
            .impact-item, .investment-item, .detail-item {
                page-break-inside: avoid;
                margin-bottom: 10px !important;
                padding: 10px !important;
            }
        }
    </style>
</head>
<body>
    <div class="report-container">
        ${this.extractBodyContent(htmlContent)}
    </div>
</body>
</html>`;
  }

  /**
   * Extract body content from full HTML
   */
  private static extractBodyContent(htmlContent: string): string {
    // Extract content between <body> tags or return the full content if no body tags
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      return bodyMatch[1];
    }
    
    // If no body tags, extract content from report-container
    const containerMatch = htmlContent.match(/<div class="report-container"[^>]*>([\s\S]*?)<\/div>/i);
    if (containerMatch) {
      return containerMatch[1];
    }
    
    // Fallback: return the full content
    return htmlContent;
  }

  /**
   * Fallback print method
   */
  private static printFallback(htmlContent: string): void {
    // Create a temporary iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.cssText = `
      position: fixed;
      top: -10000px;
      left: -10000px;
      width: 800px;
      height: 600px;
      border: none;
    `;
    
    document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(this.generatePrintOptimizedHTML(htmlContent));
      iframeDoc.close();
      
      // Wait for content to load, then print
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        
        // Cleanup after printing
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      };
    }
  }

  /**
   * Generate complete HTML report
   */
  static generateHTMLReport(analysis: OverallSecurityResult, websiteUrl: string): string {
    const currentDate = new Date().toLocaleString('ko-KR');
    
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SSL 보안 분석 보고서 - ${websiteUrl}</title>
    <style>
        ${this.getReportStyles()}
    </style>
</head>
<body>
    <div class="report-container">
        ${this.generateReportHeader(websiteUrl, currentDate)}
        ${this.generateSecurityGradeSection(analysis.grade)}
        ${this.generateBusinessImpactSection(analysis.businessImpact)}
        ${this.generateAccessibilitySection(analysis.accessibility)}
        ${this.generateCertificateSection(analysis.certificate)}
        ${this.generateSecurityHeadersSection(analysis.securityHeaders)}
        ${this.generateFooter()}
    </div>
</body>
</html>`;
  }

  /**
   * Get CSS styles for the report
   */
  private static getReportStyles(): string {
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }

        .report-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }

        .report-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .report-title {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 10px;
        }

        .report-subtitle {
            font-size: 1.2rem;
            opacity: 0.9;
            margin-bottom: 20px;
        }

        .report-meta {
            display: flex;
            justify-content: center;
            gap: 30px;
            flex-wrap: wrap;
        }

        .meta-item {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .meta-label {
            font-size: 0.9rem;
            opacity: 0.8;
            margin-bottom: 5px;
        }

        .meta-value {
            font-size: 1.1rem;
            font-weight: 600;
        }

        .section {
            margin: 30px 0;
            padding: 0 40px;
        }

        .section-title {
            font-size: 1.8rem;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #3498db;
        }

        .security-grade-section {
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            border-radius: 15px;
            padding: 30px;
            text-align: center;
            margin: 30px 40px;
        }

        .grade-display {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            margin-bottom: 30px;
        }

        .grade-letter {
            font-size: 5rem;
            font-weight: 900;
            line-height: 1;
        }

        .grade-score {
            font-size: 2rem;
            font-weight: 600;
            color: #6c757d;
        }

        .grade-description {
            font-size: 1.5rem;
            font-weight: 500;
            color: #495057;
        }

        .grade-a-plus, .grade-a {
            color: #28a745;
        }

        .grade-b {
            color: #17a2b8;
        }

        .grade-c {
            color: #ffc107;
        }

        .grade-d {
            color: #fd7e14;
        }

        .grade-f {
            color: #dc3545;
        }

        .issues-summary {
            display: grid;
            gap: 15px;
            margin-top: 20px;
        }

        .issue-category {
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid;
        }

        .issue-category.critical {
            background-color: #f8d7da;
            border-left-color: #dc3545;
        }

        .issue-category.high {
            background-color: #fff3cd;
            border-left-color: #ffc107;
        }

        .issue-category.medium {
            background-color: #d1ecf1;
            border-left-color: #17a2b8;
        }

        .issue-category.low {
            background-color: #d4edda;
            border-left-color: #28a745;
        }

        .issue-category h4 {
            margin: 0 0 10px 0;
            font-size: 1.1rem;
            font-weight: 600;
        }

        .issue-category ul {
            margin: 0;
            padding-left: 20px;
        }

        .issue-category li {
            margin-bottom: 5px;
            font-size: 0.95rem;
        }

        .business-impact-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 15px;
            padding: 30px;
            margin: 30px 40px;
        }

        .business-impact-section .section-title {
            color: white;
            border-bottom-color: rgba(255,255,255,0.3);
        }

        .impact-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            background: rgba(255, 255, 255, 0.1);
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 25px;
        }

        .impact-item {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .impact-label {
            font-size: 0.9rem;
            opacity: 0.9;
            font-weight: 500;
        }

        .impact-value {
            font-size: 1.2rem;
            font-weight: 600;
        }

        .impact-value.loss {
            color: #ff6b6b;
            font-size: 1.5rem;
        }

        .investment-analysis {
            background: rgba(255, 255, 255, 0.1);
            padding: 25px;
            border-radius: 10px;
        }

        .investment-analysis h5 {
            color: white;
            margin: 0 0 20px 0;
            font-size: 1.3rem;
            font-weight: 600;
        }

        .investment-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 25px;
        }

        .investment-item {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .investment-label {
            font-size: 0.9rem;
            opacity: 0.9;
            font-weight: 500;
        }

        .investment-value {
            font-size: 1.2rem;
            font-weight: 600;
        }

        .investment-value.positive {
            color: #51cf66;
        }

        .investment-value.negative {
            color: #ff6b6b;
        }

        .roi-conclusion {
            text-align: center;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            border: 2px solid rgba(255, 255, 255, 0.2);
        }

        .conclusion {
            font-size: 1.2rem;
            font-weight: 600;
            padding: 15px 30px;
            border-radius: 25px;
            display: inline-block;
        }

        .conclusion.high {
            background: linear-gradient(45deg, #51cf66, #40c057);
            color: white;
        }

        .conclusion.medium {
            background: linear-gradient(45deg, #ffd43b, #fab005);
            color: #333;
        }

        .conclusion.low {
            background: linear-gradient(45deg, #ff8cc8, #f783ac);
            color: white;
        }

        .conclusion.none {
            background: linear-gradient(45deg, #ff6b6b, #fa5252);
            color: white;
        }

        .detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .detail-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 6px;
            border-left: 4px solid #3498db;
        }

        .detail-label {
            font-weight: 600;
            color: #2c3e50;
        }

        .detail-value {
            font-weight: 500;
            color: #34495e;
        }

        .detail-value.success {
            color: #27ae60;
        }

        .detail-value.error {
            color: #e74c3c;
        }

        .detail-value.warning {
            color: #f39c12;
        }

        .headers-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .header-item {
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e1e8ed;
            background-color: #fff;
        }

        .header-item.present {
            border-left: 4px solid #27ae60;
            background-color: #f8fff8;
        }

        .header-item.missing {
            border-left: 4px solid #e74c3c;
            background-color: #fff8f8;
        }

        .header-name {
            font-weight: 600;
            font-size: 0.95rem;
            color: #2c3e50;
            margin-bottom: 8px;
        }

        .header-description {
            font-size: 0.85rem;
            color: #7f8c8d;
            margin-bottom: 8px;
        }

        .header-value {
            font-size: 0.8rem;
            color: #34495e;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            background-color: #f8f9fa;
            padding: 5px 8px;
            border-radius: 4px;
            word-break: break-all;
        }

        .recommended-tag {
            background-color: #3498db;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.7rem;
            font-weight: 500;
            margin-left: 8px;
        }

        .missing-headers, .recommendations {
            margin-top: 20px;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e1e8ed;
        }

        .missing-headers h5, .recommendations h5 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 1.1rem;
            font-weight: 600;
        }

        .missing-headers ul, .recommendations ul {
            margin: 0;
            padding-left: 20px;
        }

        .missing-headers li, .recommendations li {
            margin-bottom: 8px;
            color: #34495e;
            font-size: 0.95rem;
        }

        .report-footer {
            background: #2c3e50;
            color: white;
            padding: 30px 40px;
            text-align: center;
            margin-top: 40px;
        }

        .footer-text {
            font-size: 0.9rem;
            opacity: 0.8;
        }

        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            @page {
                margin: 0.5in;
                size: A4;
            }
            
            body {
                background: white !important;
                color: black !important;
                font-size: 12pt;
                line-height: 1.4;
                margin: 0;
                padding: 0;
            }
            
            .report-container {
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
                max-width: none !important;
                width: 100% !important;
            }
            
            .report-header {
                background: white !important;
                color: black !important;
                padding: 20px 0 !important;
                margin-bottom: 20px !important;
                page-break-after: avoid;
            }
            
            .report-title {
                color: black !important;
                font-size: 24pt !important;
                margin-bottom: 10px !important;
            }
            
            .report-subtitle {
                color: #666 !important;
                font-size: 14pt !important;
            }
            
            .section {
                page-break-inside: avoid;
                margin: 20px 0 !important;
                padding: 0 !important;
                break-inside: avoid;
            }
            
            .section-title {
                color: black !important;
                font-size: 18pt !important;
                margin-bottom: 15px !important;
                page-break-after: avoid;
                border-bottom: 2px solid #333 !important;
            }
            
            .security-grade-section {
                background: white !important;
                border: 1px solid #ccc !important;
                border-radius: 0 !important;
                padding: 20px !important;
                margin: 20px 0 !important;
                page-break-inside: avoid;
            }
            
            .grade-letter {
                font-size: 48pt !important;
                color: black !important;
            }
            
            .grade-a-plus, .grade-a {
                color: #28a745 !important;
            }
            
            .grade-b {
                color: #17a2b8 !important;
            }
            
            .grade-c {
                color: #ffc107 !important;
            }
            
            .grade-d {
                color: #fd7e14 !important;
            }
            
            .grade-f {
                color: #dc3545 !important;
            }
            
            .business-impact-section {
                background: white !important;
                border: 1px solid #ccc !important;
                border-radius: 0 !important;
                padding: 20px !important;
                margin: 20px 0 !important;
                page-break-inside: avoid;
            }
            
            .impact-summary, .investment-grid {
                display: block !important;
            }
            
            .impact-item, .investment-item {
                display: block !important;
                margin-bottom: 10px !important;
                padding: 10px !important;
                border: 1px solid #ddd !important;
                page-break-inside: avoid;
            }
            
            .impact-label, .investment-label {
                font-weight: bold !important;
                color: black !important;
            }
            
            .impact-value, .investment-value {
                color: black !important;
            }
            
            .analysis-details {
                page-break-inside: avoid;
                margin: 15px 0 !important;
            }
            
            .detail-item {
                page-break-inside: avoid;
                margin-bottom: 10px !important;
                padding: 10px !important;
                border: 1px solid #eee !important;
            }
            
            .status-indicator {
                display: inline-block !important;
                margin-right: 8px !important;
            }
            
            .recommendations {
                page-break-inside: avoid;
                margin: 15px 0 !important;
            }
            
            .recommendation-item {
                page-break-inside: avoid;
                margin-bottom: 8px !important;
                padding: 8px !important;
                border-left: 3px solid #3498db !important;
                background: #f8f9fa !important;
            }
            
            .footer {
                page-break-before: avoid;
                margin-top: 30px !important;
                padding: 20px 0 !important;
                border-top: 1px solid #ccc !important;
                text-align: center !important;
                color: #666 !important;
            }
            
            /* Hide any elements that shouldn't print */
            .no-print {
                display: none !important;
            }
            
            /* Ensure tables don't break awkwardly */
            table {
                page-break-inside: avoid;
                border-collapse: collapse !important;
            }
            
            th, td {
                border: 1px solid #ccc !important;
                padding: 8px !important;
                text-align: left !important;
            }
            
            th {
                background: #f5f5f5 !important;
                font-weight: bold !important;
            }
        }

        @media (max-width: 768px) {
            .report-header {
                padding: 20px;
            }
            
            .report-title {
                font-size: 2rem;
            }
            
            .section {
                padding: 0 20px;
            }
            
            .security-grade-section, .business-impact-section {
                margin: 20px;
                padding: 20px;
            }
            
            .grade-display {
                flex-direction: column;
                gap: 10px;
            }
            
            .impact-summary, .investment-grid {
                grid-template-columns: 1fr;
            }
        }
    `;
  }

  /**
   * Generate report header
   */
  private static generateReportHeader(websiteUrl: string, currentDate: string): string {
    return `
      <div class="report-header">
        <h1 class="report-title">🔒 SSL 보안 분석 보고서</h1>
        <p class="report-subtitle">웹사이트 보안 상태 종합 분석</p>
        <div class="report-meta">
          <div class="meta-item">
            <span class="meta-label">분석 대상</span>
            <span class="meta-value">${websiteUrl}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">분석 일시</span>
            <span class="meta-value">${currentDate}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">보고서 버전</span>
            <span class="meta-value">v1.0</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate security grade section
   */
  private static generateSecurityGradeSection(grade: any): string {
    const gradeClass = `grade-${grade.grade.toLowerCase().replace('+', '-plus')}`;
    
    return `
      <div class="security-grade-section">
        <h2 class="section-title">보안 등급</h2>
        <div class="grade-display">
          <div class="grade-letter ${gradeClass}">${grade.grade}</div>
          <div>
            <div class="grade-score">${grade.score}/100점</div>
            <div class="grade-description">${grade.description}</div>
          </div>
        </div>
        
        <div class="issues-summary">
          ${grade.criticalIssues.length > 0 ? `
            <div class="issue-category critical">
              <h4>🚨 심각한 문제 (${grade.criticalIssues.length}개)</h4>
              <ul>
                ${grade.criticalIssues.map((issue: string) => `<li>${issue}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${grade.highIssues.length > 0 ? `
            <div class="issue-category high">
              <h4>⚠️ 높은 위험 (${grade.highIssues.length}개)</h4>
              <ul>
                ${grade.highIssues.map((issue: string) => `<li>${issue}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${grade.mediumIssues.length > 0 ? `
            <div class="issue-category medium">
              <h4>🟡 중간 위험 (${grade.mediumIssues.length}개)</h4>
              <ul>
                ${grade.mediumIssues.map((issue: string) => `<li>${issue}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${grade.lowIssues.length > 0 ? `
            <div class="issue-category low">
              <h4>🔵 낮은 위험 (${grade.lowIssues.length}개)</h4>
              <ul>
                ${grade.lowIssues.map((issue: string) => `<li>${issue}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Generate business impact section
   */
  private static generateBusinessImpactSection(impact: any): string {
    const roiClass = impact.roi > 10 ? 'high' : impact.roi > 5 ? 'medium' : 'low';
    
    return `
      <div class="business-impact-section">
        <h2 class="section-title">비즈니스 영향 분석</h2>
        
        <div class="impact-summary">
          <div class="impact-item">
            <span class="impact-label">연간 예상 손실</span>
            <span class="impact-value loss">${impact.annualLoss.toLocaleString()}원</span>
          </div>
          <div class="impact-item">
            <span class="impact-label">보안 손실률</span>
            <span class="impact-value">${(impact.securityLossRate * 100).toFixed(1)}%</span>
          </div>
          <div class="impact-item">
            <span class="impact-label">SEO 순위 하락</span>
            <span class="impact-value">${impact.seoRankingLoss}%</span>
          </div>
          <div class="impact-item">
            <span class="impact-label">고객 신뢰도 손상</span>
            <span class="impact-value">${impact.customerTrustLoss}%</span>
          </div>
          <div class="impact-item">
            <span class="impact-label">브랜드 이미지</span>
            <span class="impact-value">${impact.brandImageImpact}</span>
          </div>
        </div>
        
        <div class="investment-analysis">
          <h5>투자 분석</h5>
          <div class="investment-grid">
            <div class="investment-item">
              <span class="investment-label">권장 투자비용</span>
              <span class="investment-value">${impact.investmentCost.toLocaleString()}원</span>
            </div>
            <div class="investment-item">
              <span class="investment-label">연간 순이익</span>
              <span class="investment-value ${impact.netBenefit > 0 ? 'positive' : 'negative'}">${impact.netBenefit.toLocaleString()}원</span>
            </div>
            <div class="investment-item">
              <span class="investment-label">투자 대비 효과</span>
              <span class="investment-value roi ${roiClass}">${impact.roi.toFixed(1)}배 ROI</span>
            </div>
          </div>
          
          <div class="roi-conclusion">
            ${impact.roi > 10 ? 
              '<div class="conclusion high">✅ 즉시 투자 권장 (높은 ROI)</div>' :
              impact.roi > 5 ? 
              '<div class="conclusion medium">✅ 투자 권장 (양호한 ROI)</div>' :
              impact.roi > 0 ? 
              '<div class="conclusion low">⚠️ 신중한 검토 필요</div>' :
              '<div class="conclusion none">❌ 투자 효과 미미</div>'
            }
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate accessibility section
   */
  private static generateAccessibilitySection(accessibility: any): string {
    return `
      <div class="section">
        <h2 class="section-title">웹사이트 접근성</h2>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">웹사이트 상태</span>
            <span class="detail-value ${accessibility.accessible ? 'success' : 'error'}">
              ${accessibility.accessible ? '✅ 접근 가능' : '❌ 접근 불가'}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">SSL 상태</span>
            <span class="detail-value ${accessibility.hasSSL ? 'success' : 'error'}">
              ${accessibility.hasSSL ? '🔒 SSL 사용 가능' : '❌ SSL 없음'}
            </span>
          </div>
          ${accessibility.connectionDetails ? `
            <div class="detail-item">
              <span class="detail-label">연결 시간</span>
              <span class="detail-value">${accessibility.connectionDetails.connectionTime}ms</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">호스트명</span>
              <span class="detail-value">${accessibility.connectionDetails.hostname}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">포트</span>
              <span class="detail-value">${accessibility.connectionDetails.port}</span>
            </div>
          ` : ''}
          ${accessibility.error ? `
            <div class="detail-item">
              <span class="detail-label">오류</span>
              <span class="detail-value error">${accessibility.error}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Generate certificate section
   */
  private static generateCertificateSection(certificate: any): string {
    if (!certificate.certificateInfo) {
      return `
        <div class="section">
          <h2 class="section-title">SSL 인증서 분석</h2>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">인증서 상태</span>
              <span class="detail-value error">인증서 정보를 가져올 수 없습니다</span>
            </div>
          </div>
        </div>
      `;
    }

    const statusClass = certificate.certificateStatus === 'valid' ? 'success' : 
                       certificate.certificateStatus === 'expired' ? 'error' : 'warning';
    
    const statusText = certificate.certificateStatus === 'valid' ? '✅ 유효' :
                      certificate.certificateStatus === 'expired' ? '❌ 만료' :
                      certificate.certificateStatus === 'self-signed' ? '⚠️ 자체 서명' : '❌ 유효하지 않음';

    return `
      <div class="section">
        <h2 class="section-title">SSL 인증서 분석</h2>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">인증서 상태</span>
            <span class="detail-value ${statusClass}">${statusText}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">주체</span>
            <span class="detail-value">${certificate.certificateInfo.subject}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">발급자</span>
            <span class="detail-value">${certificate.certificateInfo.issuer}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">유효 시작일</span>
            <span class="detail-value">${certificate.certificateInfo.validFrom}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">유효 종료일</span>
            <span class="detail-value">${certificate.certificateInfo.validTo}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">만료까지 남은 일수</span>
            <span class="detail-value ${certificate.certificateInfo.daysUntilExpiry < 30 ? 'warning' : 'success'}">
              ${certificate.certificateInfo.daysUntilExpiry}일
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">일련번호</span>
            <span class="detail-value">${certificate.certificateInfo.serialNumber}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">지문</span>
            <span class="detail-value">${certificate.certificateInfo.fingerprint}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate security headers section
   */
  private static generateSecurityHeadersSection(securityHeaders: any): string {
    return `
      <div class="section">
        <h2 class="section-title">보안 헤더 분석</h2>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">보안 점수</span>
            <span class="detail-value ${securityHeaders.securityScore >= 80 ? 'success' : securityHeaders.securityScore >= 60 ? 'warning' : 'error'}">
              ${securityHeaders.securityScore}/100점
            </span>
          </div>
        </div>
        
        <div class="headers-grid">
          ${securityHeaders.headers.map((header: any) => `
            <div class="header-item ${header.present ? 'present' : 'missing'}">
              <div class="header-name">
                ${header.present ? '✅' : '❌'} ${header.name}
                ${header.recommended ? '<span class="recommended-tag">권장</span>' : ''}
              </div>
              <div class="header-description">${header.description}</div>
              ${header.present && header.value ? `
                <div class="header-value">값: ${header.value}</div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        ${securityHeaders.missingHeaders.length > 0 ? `
          <div class="missing-headers">
            <h5>누락된 권장 헤더</h5>
            <ul>
              ${securityHeaders.missingHeaders.map((header: string) => `<li>${header}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${securityHeaders.recommendations.length > 0 ? `
          <div class="recommendations">
            <h5>권장사항</h5>
            <ul>
              ${securityHeaders.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Generate report footer
   */
  private static generateFooter(): string {
    return `
      <div class="report-footer">
        <p class="footer-text">
          이 보고서는 SSL 보안 분석 도구에 의해 자동 생성되었습니다.<br>
          보안 개선을 위한 구체적인 조치사항을 검토하고 즉시 실행하시기 바랍니다.
        </p>
      </div>
    `;
  }
}
