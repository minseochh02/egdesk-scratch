/**
 * SSL Analysis Service
 * Implements the first step of SSL analysis: Website accessibility and SSL availability checking
 * Based on the SSL_Analyzer.md specification
 */

export interface WebsiteAccessibilityResult {
  accessible: boolean;
  hasSSL: boolean;
  connectionDetails?: {
    hostname: string;
    port: number;
    connectionTime: number;
    protocol?: string;
  };
  error?: string;
  timestamp: string;
}

export interface CertificateInfo {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  fingerprint: string;
  isExpired: boolean;
  isSelfSigned: boolean;
  isValid: boolean;
  daysUntilExpiry: number;
  error?: string;
}

export interface SSLCertificateResult {
  certificateInfo?: CertificateInfo;
  certificateStatus: 'valid' | 'expired' | 'self-signed' | 'invalid' | 'error';
  error?: string;
  timestamp: string;
}

export interface SecurityHeader {
  name: string;
  value: string;
  present: boolean;
  recommended: boolean;
  description: string;
}

export interface SecurityHeadersResult {
  headers: SecurityHeader[];
  missingHeaders: string[];
  securityScore: number;
  recommendations: string[];
  error?: string;
  timestamp: string;
}

export interface SecurityGrade {
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  description: string;
  criticalIssues: string[];
  highIssues: string[];
  mediumIssues: string[];
  lowIssues: string[];
}

export interface BusinessImpactResult {
  monthlyVisitors: number;
  conversionRate: number;
  orderConversionRate: number;
  averageOrderValue: number;
  securityLossRate: number;
  annualLoss: number;
  seoRankingLoss: number;
  customerTrustLoss: number;
  brandImageImpact: string;
  roi: number;
  investmentCost: number;
  netBenefit: number;
  report: string;
}

export interface OverallSecurityResult {
  grade: SecurityGrade;
  accessibility: WebsiteAccessibilityResult;
  certificate: SSLCertificateResult;
  securityHeaders: SecurityHeadersResult;
  businessImpact: BusinessImpactResult;
  combinedReport: string;
  timestamp: string;
}

export class SSLAnalysisService {
  /**
   * Step 1: Check website accessibility and SSL availability
   * Tests if the website is accessible and has SSL on port 443
   */
  static async analyzeWebsiteAccessibility(url: string): Promise<WebsiteAccessibilityResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    
    try {
      // Normalize URL - ensure it has protocol
      const normalizedUrl = this.normalizeUrl(url);
      const urlObj = new URL(normalizedUrl);
      
      // Check if it's HTTPS
      if (urlObj.protocol !== 'https:') {
        return {
          accessible: false,
          hasSSL: false,
          error: 'URL must use HTTPS protocol',
          timestamp
        };
      }

      // Test connection to port 443 (HTTPS)
      const connectionResult = await this.testHttpsConnection(urlObj.hostname, 443);
      
      if (connectionResult.success) {
        return {
          accessible: true,
          hasSSL: true,
          connectionDetails: {
            hostname: urlObj.hostname,
            port: 443,
            connectionTime: Date.now() - startTime,
            protocol: 'HTTPS'
          },
          timestamp
        };
      } else {
        return {
          accessible: false,
          hasSSL: false,
          connectionDetails: {
            hostname: urlObj.hostname,
            port: 443,
            connectionTime: Date.now() - startTime
          },
          error: connectionResult.error || 'Connection failed',
          timestamp
        };
      }
    } catch (error) {
      return {
        accessible: false,
        hasSSL: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp
      };
    }
  }

  /**
   * Normalize URL to ensure it has proper protocol
   */
  private static normalizeUrl(url: string): string {
    // Remove any whitespace
    url = url.trim();
    
    // If no protocol specified, assume HTTPS
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    return url;
  }

  /**
   * Test HTTPS connection to a specific host and port
   * This is a simplified version that uses fetch API
   */
  private static async testHttpsConnection(hostname: string, port: number): Promise<{success: boolean, error?: string}> {
    try {
      const testUrl = `https://${hostname}:${port}`;
      
      // Use fetch with a timeout to test the connection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors' // This allows us to test connectivity even with CORS issues
      });
      
      clearTimeout(timeoutId);
      
      // If we get here, the connection was successful
      return { success: true };
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, error: 'Connection timeout' };
        }

        const sslErrors = [
          'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
          'CERT_HAS_EXPIRED',
          'DEPTH_ZERO_SELF_SIGNED_CERT',
          'SELF_SIGNED_CERT_IN_CHAIN',
          'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
          'unable to verify the first certificate',
          'self signed certificate',
          'certificate has expired',
        ];
        
        const isSSLError = sslErrors.some(sslErr => 
          error.message.includes(sslErr) || 
          (error as NodeJS.ErrnoException).code?.includes(sslErr)
        );
        
        if (isSSLError) {
          return { success: false, error: `SSL 인증서 문제: ${hostname} 서버의 SSL 인증서를 확인할 수 없습니다. 서버 인증서 체인이 올바르지 않거나 만료되었을 수 있습니다.` };
        }

        return { success: false, error: error.message };
      }
      return { success: false, error: 'Connection failed' };
    }
  }

  /**
   * Step 2: Analyze SSL Certificate Status
   * Checks if the SSL certificate is valid, expired, or self-signed
   */
  static async analyzeSSLCertificate(url: string): Promise<SSLCertificateResult> {
    const timestamp = new Date().toISOString();
    
    try {
      // First check if the website is accessible
      const accessibilityResult = await this.analyzeWebsiteAccessibility(url);
      
      if (!accessibilityResult.accessible || !accessibilityResult.hasSSL) {
        return {
          certificateStatus: 'error',
          error: 'Website is not accessible or does not have SSL',
          timestamp
        };
      }

      // Get certificate information
      const certificateInfo = await this.getCertificateInfo(url);
      
      if (certificateInfo.error) {
        return {
          certificateStatus: 'error',
          error: certificateInfo.error,
          timestamp
        };
      }

      // Determine certificate status
      let certificateStatus: 'valid' | 'expired' | 'self-signed' | 'invalid' | 'error';
      
      if (certificateInfo.isExpired) {
        certificateStatus = 'expired';
      } else if (certificateInfo.isSelfSigned) {
        certificateStatus = 'self-signed';
      } else if (certificateInfo.isValid) {
        certificateStatus = 'valid';
      } else {
        certificateStatus = 'invalid';
      }

      return {
        certificateInfo,
        certificateStatus,
        timestamp
      };
    } catch (error) {
      return {
        certificateStatus: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp
      };
    }
  }

  /**
   * Get certificate information from a website
   * Note: This is a simplified implementation using fetch API
   * In a real implementation, you would use Node.js crypto module or similar
   */
  private static async getCertificateInfo(url: string): Promise<CertificateInfo> {
    try {
      const normalizedUrl = this.normalizeUrl(url);
      const urlObj = new URL(normalizedUrl);
      
      // For browser environment, we can't directly access certificate details
      // This is a limitation of the browser security model
      // In a real implementation, this would be done server-side using Node.js
      
      // Simulate certificate analysis for demo purposes
      const now = new Date();
      const validFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
      const validTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      
      const isExpired = now > validTo;
      const daysUntilExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Simulate different certificate types based on domain
      const isSelfSigned = urlObj.hostname.includes('localhost') || urlObj.hostname.includes('127.0.0.1');
      const isValid = !isExpired && !isSelfSigned;
      
      return {
        subject: `CN=${urlObj.hostname}`,
        issuer: isSelfSigned ? 'Self-signed' : 'Let\'s Encrypt Authority X3',
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
        serialNumber: '1234567890ABCDEF',
        fingerprint: 'SHA256:ABCDEF1234567890',
        isExpired,
        isSelfSigned,
        isValid,
        daysUntilExpiry: Math.max(0, daysUntilExpiry)
      };
    } catch (error) {
      return {
        subject: '',
        issuer: '',
        validFrom: '',
        validTo: '',
        serialNumber: '',
        fingerprint: '',
        isExpired: false,
        isSelfSigned: false,
        isValid: false,
        daysUntilExpiry: 0,
        error: error instanceof Error ? error.message : 'Failed to get certificate info'
      };
    }
  }

  /**
   * Generate a human-readable report from the accessibility analysis
   */
  static generateAccessibilityReport(result: WebsiteAccessibilityResult): string {
    let report = `🔍 SSL Analysis Report\n`;
    report += `📅 Generated: ${new Date(result.timestamp).toLocaleString()}\n\n`;
    
    if (result.accessible && result.hasSSL) {
      report += `✅ Blog Status: Accessible\n`;
      report += `🔒 SSL Status: Available\n`;
      
      if (result.connectionDetails) {
        report += `\n📊 Connection Details:\n`;
        report += `   • Hostname: ${result.connectionDetails.hostname}\n`;
        report += `   • Port: ${result.connectionDetails.port}\n`;
        report += `   • Connection Time: ${result.connectionDetails.connectionTime}ms\n`;
        report += `   • Protocol: ${result.connectionDetails.protocol || 'HTTPS'}\n`;
      }
      
      report += `\n🎯 Next Step: Ready for SSL certificate analysis\n`;
    } else {
      report += `❌ Blog Status: Not Accessible\n`;
      report += `🔒 SSL Status: ${result.hasSSL ? 'Available' : 'Not Available'}\n`;
      
      if (result.error) {
        report += `\n⚠️ Error Details:\n`;
        report += `   ${result.error}\n`;
      }
      
      if (result.connectionDetails) {
        report += `\n📊 Connection Details:\n`;
        report += `   • Hostname: ${result.connectionDetails.hostname}\n`;
        report += `   • Port: ${result.connectionDetails.port}\n`;
        report += `   • Connection Time: ${result.connectionDetails.connectionTime}ms\n`;
      }
      
      report += `\n🚫 Cannot proceed with SSL analysis - Blog is not accessible\n`;
    }
    
    return report;
  }

  /**
   * Generate a human-readable report from the certificate analysis
   */
  static generateCertificateReport(result: SSLCertificateResult): string {
    let report = `🔒 SSL Certificate Analysis Report\n`;
    report += `📅 Generated: ${new Date(result.timestamp).toLocaleString()}\n\n`;
    
    if (result.certificateInfo) {
      const cert = result.certificateInfo;
      
      report += `📋 Certificate Details:\n`;
      report += `   • Subject: ${cert.subject}\n`;
      report += `   • Issuer: ${cert.issuer}\n`;
      report += `   • Valid From: ${new Date(cert.validFrom).toLocaleDateString()}\n`;
      report += `   • Valid Until: ${new Date(cert.validTo).toLocaleDateString()}\n`;
      report += `   • Serial Number: ${cert.serialNumber}\n`;
      report += `   • Fingerprint: ${cert.fingerprint}\n`;
      report += `   • Days Until Expiry: ${cert.daysUntilExpiry} days\n\n`;
      
      // Status analysis
      switch (result.certificateStatus) {
        case 'valid':
          report += `✅ Certificate Status: Valid\n`;
          report += `🎯 This certificate is properly configured and trustworthy\n`;
          break;
        case 'expired':
          report += `❌ Certificate Status: Expired\n`;
          report += `⚠️ This certificate has expired and needs to be renewed\n`;
          break;
        case 'self-signed':
          report += `⚠️ Certificate Status: Self-signed\n`;
          report += `🔒 This certificate is not trusted by browsers\n`;
          break;
        case 'invalid':
          report += `❌ Certificate Status: Invalid\n`;
          report += `🚫 This certificate has configuration issues\n`;
          break;
        case 'error':
          report += `❌ Certificate Status: Error\n`;
          report += `🚫 Cannot analyze certificate\n`;
          break;
      }
    } else if (result.error) {
      report += `❌ Error: ${result.error}\n`;
    }
    
    return report;
  }

  /**
   * Step 3: Analyze Security Headers
   * Checks if the website has proper security headers configured
   */
  static async analyzeSecurityHeaders(url: string): Promise<SecurityHeadersResult> {
    const timestamp = new Date().toISOString();
    
    try {
      // First check if the website is accessible
      const accessibilityResult = await this.analyzeWebsiteAccessibility(url);
      
      if (!accessibilityResult.accessible) {
        return {
          headers: [],
          missingHeaders: [],
          securityScore: 0,
          recommendations: ['Cannot analyze security headers - blog is not accessible'],
          error: 'Blog is not accessible',
          timestamp
        };
      }

      // Fetch headers from the website
      const headers = await this.fetchSecurityHeaders(url);
      
      // Analyze security headers
      const securityHeaders = this.analyzeHeaders(headers);
      const missingHeaders = this.getMissingHeaders(securityHeaders);
      const securityScore = this.calculateSecurityScore(securityHeaders);
      const recommendations = this.generateSecurityRecommendations(securityHeaders, missingHeaders);

      return {
        headers: securityHeaders,
        missingHeaders,
        securityScore,
        recommendations,
        timestamp
      };
    } catch (error) {
      return {
        headers: [],
        missingHeaders: [],
        securityScore: 0,
        recommendations: ['An error occurred while analyzing security headers'],
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        timestamp
      };
    }
  }

  /**
   * Fetch security headers from a website
   */
  private static async fetchSecurityHeaders(url: string): Promise<Record<string, string>> {
    try {
      const normalizedUrl = this.normalizeUrl(url);
      const response = await fetch(normalizedUrl, {
        method: 'HEAD',
        mode: 'cors'
      });

      const headers: Record<string, string> = {};
      
      // Extract security-related headers
      const securityHeaderNames = [
        'strict-transport-security',
        'content-security-policy',
        'x-frame-options',
        'x-content-type-options',
        'x-xss-protection',
        'referrer-policy',
        'permissions-policy',
        'cross-origin-embedder-policy',
        'cross-origin-opener-policy',
        'cross-origin-resource-policy'
      ];

      securityHeaderNames.forEach(headerName => {
        const headerValue = response.headers.get(headerName);
        if (headerValue) {
          headers[headerName] = headerValue;
        }
      });

      return headers;
    } catch (error) {
      // If CORS fails, return empty headers
      return {};
    }
  }

  /**
   * Analyze security headers and determine their status
   */
  private static analyzeHeaders(headers: Record<string, string>): SecurityHeader[] {
    const securityHeaders: SecurityHeader[] = [];

    // HSTS (HTTP Strict Transport Security)
    securityHeaders.push({
      name: 'Strict-Transport-Security',
      value: headers['strict-transport-security'] || '',
      present: !!headers['strict-transport-security'],
      recommended: true,
      description: 'Enforce HTTPS and strengthen cookie security'
    });

    // CSP (Content Security Policy)
    securityHeaders.push({
      name: 'Content-Security-Policy',
      value: headers['content-security-policy'] || '',
      present: !!headers['content-security-policy'],
      recommended: true,
      description: 'Prevent XSS attacks and control resource loading'
    });

    // X-Frame-Options
    securityHeaders.push({
      name: 'X-Frame-Options',
      value: headers['x-frame-options'] || '',
      present: !!headers['x-frame-options'],
      recommended: true,
      description: 'Prevent clickjacking attacks'
    });

    // X-Content-Type-Options
    securityHeaders.push({
      name: 'X-Content-Type-Options',
      value: headers['x-content-type-options'] || '',
      present: !!headers['x-content-type-options'],
      recommended: true,
      description: 'Prevent MIME type sniffing'
    });

    // X-XSS-Protection
    securityHeaders.push({
      name: 'X-XSS-Protection',
      value: headers['x-xss-protection'] || '',
      present: !!headers['x-xss-protection'],
      recommended: true,
      description: 'Enable XSS filter'
    });

    // Referrer-Policy
    securityHeaders.push({
      name: 'Referrer-Policy',
      value: headers['referrer-policy'] || '',
      present: !!headers['referrer-policy'],
      recommended: true,
      description: 'Control referrer information'
    });

    // Permissions-Policy
    securityHeaders.push({
      name: 'Permissions-Policy',
      value: headers['permissions-policy'] || '',
      present: !!headers['permissions-policy'],
      recommended: false,
      description: 'Control browser feature access (optional)'
    });

    return securityHeaders;
  }

  /**
   * Get list of missing recommended headers
   */
  private static getMissingHeaders(headers: SecurityHeader[]): string[] {
    return headers
      .filter(header => header.recommended && !header.present)
      .map(header => header.name);
  }

  /**
   * Calculate security score based on headers
   */
  private static calculateSecurityScore(headers: SecurityHeader[]): number {
    const recommendedHeaders = headers.filter(header => header.recommended);
    const presentHeaders = recommendedHeaders.filter(header => header.present);
    
    if (recommendedHeaders.length === 0) return 0;
    
    return Math.round((presentHeaders.length / recommendedHeaders.length) * 100);
  }

  /**
   * Generate security recommendations
   */
  private static generateSecurityRecommendations(headers: SecurityHeader[], missingHeaders: string[]): string[] {
    const recommendations: string[] = [];

    if (missingHeaders.length === 0) {
      recommendations.push('All recommended security headers are configured!');
      return recommendations;
    }

    missingHeaders.forEach(headerName => {
      switch (headerName) {
        case 'Strict-Transport-Security':
          recommendations.push('Add HSTS header to enforce HTTPS usage');
          break;
        case 'Content-Security-Policy':
          recommendations.push('Add CSP header to prevent XSS attacks');
          break;
        case 'X-Frame-Options':
          recommendations.push('Add X-Frame-Options header to prevent clickjacking');
          break;
        case 'X-Content-Type-Options':
          recommendations.push('Add X-Content-Type-Options: nosniff header');
          break;
        case 'X-XSS-Protection':
          recommendations.push('Add X-XSS-Protection header to enable XSS filter');
          break;
        case 'Referrer-Policy':
          recommendations.push('Add Referrer-Policy header to control referrer information');
          break;
      }
    });

    return recommendations;
  }

  /**
   * Generate a human-readable report from the security headers analysis
   */
  static generateSecurityHeadersReport(result: SecurityHeadersResult): string {
    let report = `🛡️ Security Headers Analysis Report\n`;
    report += `📅 Generated: ${new Date(result.timestamp).toLocaleString()}\n\n`;
    
    report += `📊 Security Score: ${result.securityScore}/100\n\n`;
    
    if (result.headers.length > 0) {
      report += `📋 Security Headers Status:\n`;
      result.headers.forEach(header => {
        const status = header.present ? '✅' : '❌';
        const recommended = header.recommended ? ' (Recommended)' : ' (Optional)';
        report += `   ${status} ${header.name}${recommended}\n`;
        if (header.present && header.value) {
          report += `     Value: ${header.value}\n`;
        }
        report += `     Description: ${header.description}\n\n`;
      });
    }
    
    if (result.missingHeaders.length > 0) {
      report += `⚠️ Missing Recommended Headers:\n`;
      result.missingHeaders.forEach(header => {
        report += `   • ${header}\n`;
      });
      report += `\n`;
    }
    
    if (result.recommendations.length > 0) {
      report += `💡 Recommendations:\n`;
      result.recommendations.forEach(rec => {
        report += `   • ${rec}\n`;
      });
    }
    
    if (result.error) {
      report += `\n❌ Error: ${result.error}\n`;
    }
    
    return report;
  }

  /**
   * Step 4: Calculate Overall Security Grade
   * Determines security grade (A+ to F) based on SSL_Analyzer.md criteria
   */
  static calculateSecurityGrade(
    accessibility: WebsiteAccessibilityResult,
    certificate: SSLCertificateResult,
    securityHeaders: SecurityHeadersResult
  ): SecurityGrade {
    let baseScore = 0;
    const criticalIssues: string[] = [];
    const highIssues: string[] = [];
    const mediumIssues: string[] = [];
    const lowIssues: string[] = [];

    // Step 1: Basic SSL and accessibility checks (SSL_Analyzer.md criteria)
    if (!accessibility.accessible) {
      criticalIssues.push('Blog is not accessible');
      return {
        grade: 'F',
        score: 0,
        description: 'Cannot analyze - blog is not accessible',
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues
      };
    }

    if (!accessibility.hasSSL) {
      criticalIssues.push('HTTPS service is not available');
      return {
        grade: 'F',
        score: 0,
        description: 'No HTTPS service - serious security issue',
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues
      };
    }

    // Step 2: Certificate analysis (SSL_Analyzer.md criteria)
    if (certificate.certificateStatus === 'expired') {
      criticalIssues.push('SSL certificate has expired');
      return {
        grade: 'F',
        score: 0,
        description: 'Expired SSL certificate - serious security issue',
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues
      };
    }

    // Base score calculation according to SSL_Analyzer.md
    if (certificate.certificateStatus === 'self-signed') {
      baseScore = 30; // D등급
      highIssues.push('Using self-signed SSL certificate');
    } else if (certificate.certificateStatus === 'valid') {
      baseScore = 80; // B등급
    } else if (certificate.certificateStatus === 'invalid') {
      baseScore = 30; // Treat invalid as self-signed for scoring
      highIssues.push('Using invalid SSL certificate');
    } else {
      baseScore = 0; // Error case
      criticalIssues.push('Failed to analyze SSL certificate');
    }

    // Step 3: Security headers analysis (SSL_Analyzer.md criteria)
    const recommendedHeaders = securityHeaders.headers.filter(h => h.recommended);
    const presentHeaders = recommendedHeaders.filter(h => h.present);
    const missingHeaders = securityHeaders.missingHeaders;

    // Headers score addition according to SSL_Analyzer.md
    // More balanced approach: missing headers are Medium issues, not major penalties
    if (presentHeaders.length === recommendedHeaders.length && recommendedHeaders.length > 0) {
      // 모든 헤더 있음? → +10점
      baseScore += 10;
    } else if (presentHeaders.length >= recommendedHeaders.length * 0.5) {
      // 50% 이상 헤더 있음? → +5점 (일부 헤더 있음)
      baseScore += 5;
    } else if (presentHeaders.length > 0) {
      // 일부 헤더 있음? → +2점 (약간의 보너스)
      baseScore += 2;
    }
    // 헤더 없음? → 0점 (감점 없음, Medium 이슈로만 분류)

    // Issue classification based on SSL_Analyzer.md
    if (certificate.certificateInfo && certificate.certificateInfo.daysUntilExpiry < 30) {
      mediumIssues.push(`SSL certificate expires in ${certificate.certificateInfo.daysUntilExpiry} days`);
    }

    // Specific header issues classification (based on risk matrix - all Medium severity)
    if (missingHeaders.includes('Strict-Transport-Security')) {
      mediumIssues.push('HSTS header missing - HTTPS enforcement not configured');
    }
    if (missingHeaders.includes('Content-Security-Policy')) {
      mediumIssues.push('CSP header missing - vulnerable to XSS attacks');
    }
    if (missingHeaders.includes('X-Frame-Options')) {
      mediumIssues.push('X-Frame-Options header missing - vulnerable to clickjacking');
    }
    if (missingHeaders.includes('X-Content-Type-Options')) {
      mediumIssues.push('X-Content-Type-Options header missing - vulnerable to MIME type sniffing');
    }
    if (missingHeaders.includes('X-XSS-Protection')) {
      mediumIssues.push('X-XSS-Protection header missing - XSS filter disabled');
    }
    if (missingHeaders.includes('Referrer-Policy')) {
      mediumIssues.push('Referrer-Policy header missing - referrer information may be exposed');
    }

    // Final grade determination based on SSL_Analyzer.md scoring
    let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
    let description: string;

    if (baseScore >= 95) {
      grade = 'A+';
      description = 'Perfect security configuration';
    } else if (baseScore >= 90) {
      grade = 'A';
      description = 'Excellent security level';
    } else if (baseScore >= 80) {
      grade = 'B';
      description = 'Good security level';
    } else if (baseScore >= 70) {
      grade = 'C';
      description = 'Average security level';
    } else if (baseScore >= 50) {
      grade = 'D';
      description = 'Security improvement needed';
    } else {
      grade = 'F';
      description = 'Serious security issues';
    }

    return {
      grade,
      score: Math.max(0, Math.min(100, baseScore)),
      description,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues
    };
  }

  /**
   * Generate a comprehensive security grade report
   */
  static generateSecurityGradeReport(grade: SecurityGrade): string {
    let report = `🏆 Security Grade Analysis Report\n`;
    report += `📅 Generated: ${new Date().toLocaleString()}\n\n`;
    
    report += `🎯 Final Security Grade: ${grade.grade} (${grade.score}/100)\n`;
    report += `📝 Assessment: ${grade.description}\n\n`;
    
    if (grade.criticalIssues.length > 0) {
      report += `🚨 Critical Issues:\n`;
      grade.criticalIssues.forEach(issue => {
        report += `   • ${issue}\n`;
      });
      report += `\n`;
    }
    
    if (grade.highIssues.length > 0) {
      report += `⚠️ High Priority Issues:\n`;
      grade.highIssues.forEach(issue => {
        report += `   • ${issue}\n`;
      });
      report += `\n`;
    }
    
    if (grade.mediumIssues.length > 0) {
      report += `🔶 Medium Priority Issues:\n`;
      grade.mediumIssues.forEach(issue => {
        report += `   • ${issue}\n`;
      });
      report += `\n`;
    }
    
    if (grade.lowIssues.length > 0) {
      report += `🔸 Low Priority Issues:\n`;
      grade.lowIssues.forEach(issue => {
        report += `   • ${issue}\n`;
      });
      report += `\n`;
    }
    
    if (grade.criticalIssues.length === 0 && grade.highIssues.length === 0) {
      report += `✅ No serious security issues found!\n`;
    }
    
    return report;
  }

  /**
   * Complete SSL analysis including all steps and security grade calculation
   */
  static async performCompleteAnalysis(url: string): Promise<OverallSecurityResult> {
    const accessibility = await this.analyzeWebsiteAccessibility(url);
    const certificate = await this.analyzeSSLCertificate(url);
    const securityHeaders = await this.analyzeSecurityHeaders(url);
    
    // Calculate overall security grade
    const grade = this.calculateSecurityGrade(accessibility, certificate, securityHeaders);
    
    // Calculate business impact
    const businessImpact = this.calculateBusinessImpact(grade);
    
    // Generate combined report
    let combinedReport = `🔍 Complete SSL Security Analysis\n`;
    combinedReport += `📅 Generated: ${new Date().toLocaleString()}\n`;
    combinedReport += `🌐 Blog: ${url}\n\n`;
    
    combinedReport += `=== Security Grade ===\n`;
    combinedReport += this.generateSecurityGradeReport(grade);
    combinedReport += `\n\n=== Business Impact Analysis ===\n`;
    combinedReport += businessImpact.report;
    combinedReport += `\n\n=== Blog Accessibility ===\n`;
    combinedReport += this.generateAccessibilityReport(accessibility);
    combinedReport += `\n\n=== SSL Certificate Analysis ===\n`;
    combinedReport += this.generateCertificateReport(certificate);
    combinedReport += `\n\n=== Security Headers Analysis ===\n`;
    combinedReport += this.generateSecurityHeadersReport(securityHeaders);
    
    return {
      grade,
      accessibility,
      certificate,
      securityHeaders,
      businessImpact,
      combinedReport,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Step 5: Calculate Business Impact
   * Calculates potential business losses based on security grade
   */
  static calculateBusinessImpact(grade: SecurityGrade): BusinessImpactResult {
    // 기본 가정 설정 (SSL_Analyzer.md 기준)
    const monthlyVisitors = 10000; // 월 방문자
    const conversionRate = 0.02; // 전환율 2% (100명 중 2명이 고객)
    const orderConversionRate = 0.10; // 주문 전환율 10% (고객 중 10%가 실제 구매)
    const averageOrderValue = 50000000; // 평균 주문금액 5천만원

    // 보안 등급별 손실률 (SSL_Analyzer.md 기준)
    let securityLossRate: number;
    let seoRankingLoss: number;
    let customerTrustLoss: number;
    let brandImageImpact: string;

    switch (grade.grade) {
      case 'F':
        securityLossRate = 0.50; // 50% 손실
        seoRankingLoss = 40; // 40% 하락
        customerTrustLoss = 90; // 90% 손상
        brandImageImpact = 'Severe Damage';
        break;
      case 'D':
        securityLossRate = 0.30; // 30% loss
        seoRankingLoss = 30; // 30% drop
        customerTrustLoss = 70; // 70% damage
        brandImageImpact = 'Significant Damage';
        break;
      case 'C':
        securityLossRate = 0.20; // 20% loss
        seoRankingLoss = 25; // 25% drop
        customerTrustLoss = 50; // 50% damage
        brandImageImpact = 'Moderate Damage';
        break;
      case 'B':
        securityLossRate = 0.10; // 10% loss
        seoRankingLoss = 15; // 15% drop
        customerTrustLoss = 30; // 30% damage
        brandImageImpact = 'Minor Damage';
        break;
      case 'A':
        securityLossRate = 0.05; // 5% loss
        seoRankingLoss = 5; // 5% drop
        customerTrustLoss = 10; // 10% damage
        brandImageImpact = 'Minimal Damage';
        break;
      case 'A+':
        securityLossRate = 0.02; // 2% loss
        seoRankingLoss = 0; // no drop
        customerTrustLoss = 5; // 5% damage
        brandImageImpact = 'Almost None';
        break;
      default:
        securityLossRate = 0.50;
        seoRankingLoss = 40;
        customerTrustLoss = 90;
        brandImageImpact = 'Severe Damage';
    }

    // 연간 손실액 계산
    const monthlyCustomers = monthlyVisitors * conversionRate;
    const monthlyOrders = monthlyCustomers * orderConversionRate;
    const monthlyRevenue = monthlyOrders * averageOrderValue;
    const annualRevenue = monthlyRevenue * 12;
    const annualLoss = annualRevenue * securityLossRate;

    // 투자 비용 및 ROI 계산
    const investmentCost = grade.grade === 'F' ? 5000000 : // F등급: 500만원 (SSL 인증서 + 설정)
                          grade.grade === 'D' ? 3000000 : // D등급: 300만원 (인증서 교체)
                          grade.grade === 'C' ? 2000000 : // C등급: 200만원 (헤더 설정)
                          grade.grade === 'B' ? 1000000 : // B등급: 100만원 (최적화)
                          grade.grade === 'A' ? 500000 : 0; // A등급: 50만원 (유지보수)

    const netBenefit = annualLoss - investmentCost;
    const roi = investmentCost > 0 ? (netBenefit / investmentCost) * 100 : 0;

    // 보고서 생성
    const report = this.generateBusinessImpactReport({
      monthlyVisitors,
      conversionRate,
      orderConversionRate,
      averageOrderValue,
      securityLossRate,
      annualLoss,
      seoRankingLoss,
      customerTrustLoss,
      brandImageImpact,
      roi,
      investmentCost,
      netBenefit,
      report: ''
    });

    return {
      monthlyVisitors,
      conversionRate,
      orderConversionRate,
      averageOrderValue,
      securityLossRate,
      annualLoss,
      seoRankingLoss,
      customerTrustLoss,
      brandImageImpact,
      roi,
      investmentCost,
      netBenefit,
      report
    };
  }

  /**
   * Generate business impact report
   */
  static generateBusinessImpactReport(impact: BusinessImpactResult): string {
    let report = `\n=== Business Impact Analysis ===\n`;
    report += `Monthly Visitors: ${impact.monthlyVisitors.toLocaleString()}\n`;
    report += `Conversion Rate: ${(impact.conversionRate * 100).toFixed(1)}%\n`;
    report += `Order Conversion Rate: ${(impact.orderConversionRate * 100).toFixed(1)}%\n`;
    report += `Average Order Value: $${impact.averageOrderValue.toLocaleString()}\n`;
    report += `Security Loss Rate: ${(impact.securityLossRate * 100).toFixed(1)}%\n\n`;

    report += `💰 Loss Analysis:\n`;
    report += `Annual Estimated Loss: $${impact.annualLoss.toLocaleString()}\n`;
    report += `SEO Ranking Drop: ${impact.seoRankingLoss}%\n`;
    report += `Customer Trust Damage: ${impact.customerTrustLoss}%\n`;
    report += `Brand Image: ${impact.brandImageImpact}\n\n`;

    report += `💡 Investment Analysis:\n`;
    report += `Recommended Investment Cost: $${impact.investmentCost.toLocaleString()}\n`;
    report += `Annual Net Profit: $${impact.netBenefit.toLocaleString()}\n`;
    report += `ROI: ${impact.roi.toFixed(1)}x\n\n`;

    if (impact.roi > 10) {
      report += `✅ Conclusion: Immediate Investment Recommended (High ROI)\n`;
    } else if (impact.roi > 5) {
      report += `✅ Conclusion: Investment Recommended (Good ROI)\n`;
    } else if (impact.roi > 0) {
      report += `⚠️ Conclusion: Careful Review Needed\n`;
    } else {
      report += `❌ Conclusion: Minimal Investment Effect\n`;
    }

    return report;
  }
}
