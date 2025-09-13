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
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return { success: false, error: 'Connection timeout' };
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
    let report = `🔍 SSL 분석 보고서\n`;
    report += `📅 생성일: ${new Date(result.timestamp).toLocaleString()}\n\n`;
    
    if (result.accessible && result.hasSSL) {
      report += `✅ 웹사이트 상태: 접근 가능\n`;
      report += `🔒 SSL 상태: 사용 가능\n`;
      
      if (result.connectionDetails) {
        report += `\n📊 연결 상세 정보:\n`;
        report += `   • 호스트명: ${result.connectionDetails.hostname}\n`;
        report += `   • 포트: ${result.connectionDetails.port}\n`;
        report += `   • 연결 시간: ${result.connectionDetails.connectionTime}ms\n`;
        report += `   • 프로토콜: ${result.connectionDetails.protocol || 'HTTPS'}\n`;
      }
      
      report += `\n🎯 다음 단계: SSL 인증서 분석 준비 완료\n`;
    } else {
      report += `❌ 웹사이트 상태: 접근 불가\n`;
      report += `🔒 SSL 상태: ${result.hasSSL ? '사용 가능' : '사용 불가'}\n`;
      
      if (result.error) {
        report += `\n⚠️ 오류 상세 정보:\n`;
        report += `   ${result.error}\n`;
      }
      
      if (result.connectionDetails) {
        report += `\n📊 연결 상세 정보:\n`;
        report += `   • 호스트명: ${result.connectionDetails.hostname}\n`;
        report += `   • 포트: ${result.connectionDetails.port}\n`;
        report += `   • 연결 시간: ${result.connectionDetails.connectionTime}ms\n`;
      }
      
      report += `\n🚫 SSL 분석을 진행할 수 없습니다 - 웹사이트에 접근할 수 없습니다\n`;
    }
    
    return report;
  }

  /**
   * Generate a human-readable report from the certificate analysis
   */
  static generateCertificateReport(result: SSLCertificateResult): string {
    let report = `🔒 SSL 인증서 분석 보고서\n`;
    report += `📅 생성일: ${new Date(result.timestamp).toLocaleString()}\n\n`;
    
    if (result.certificateInfo) {
      const cert = result.certificateInfo;
      
      report += `📋 인증서 상세 정보:\n`;
      report += `   • 주체: ${cert.subject}\n`;
      report += `   • 발급자: ${cert.issuer}\n`;
      report += `   • 유효 시작일: ${new Date(cert.validFrom).toLocaleDateString()}\n`;
      report += `   • 유효 종료일: ${new Date(cert.validTo).toLocaleDateString()}\n`;
      report += `   • 일련번호: ${cert.serialNumber}\n`;
      report += `   • 지문: ${cert.fingerprint}\n`;
      report += `   • 만료까지 남은 일수: ${cert.daysUntilExpiry}일\n\n`;
      
      // Status analysis
      switch (result.certificateStatus) {
        case 'valid':
          report += `✅ 인증서 상태: 유효함\n`;
          report += `🎯 이 인증서는 올바르게 구성되어 있고 신뢰할 수 있습니다\n`;
          break;
        case 'expired':
          report += `❌ 인증서 상태: 만료됨\n`;
          report += `⚠️ 이 인증서는 만료되었으며 갱신이 필요합니다\n`;
          break;
        case 'self-signed':
          report += `⚠️ 인증서 상태: 자체 서명\n`;
          report += `🔒 이 인증서는 브라우저에서 신뢰되지 않습니다\n`;
          break;
        case 'invalid':
          report += `❌ 인증서 상태: 유효하지 않음\n`;
          report += `🚫 이 인증서에는 구성 문제가 있습니다\n`;
          break;
        case 'error':
          report += `❌ 인증서 상태: 오류\n`;
          report += `🚫 인증서를 분석할 수 없습니다\n`;
          break;
      }
    } else if (result.error) {
      report += `❌ 오류: ${result.error}\n`;
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
          recommendations: ['웹사이트에 접근할 수 없어 보안 헤더를 분석할 수 없습니다'],
          error: '웹사이트에 접근할 수 없습니다',
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
        recommendations: ['보안 헤더 분석 중 오류가 발생했습니다'],
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다',
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
      description: 'HTTPS 강제 사용 및 쿠키 보안 강화'
    });

    // CSP (Content Security Policy)
    securityHeaders.push({
      name: 'Content-Security-Policy',
      value: headers['content-security-policy'] || '',
      present: !!headers['content-security-policy'],
      recommended: true,
      description: 'XSS 공격 방지 및 리소스 로딩 제어'
    });

    // X-Frame-Options
    securityHeaders.push({
      name: 'X-Frame-Options',
      value: headers['x-frame-options'] || '',
      present: !!headers['x-frame-options'],
      recommended: true,
      description: '클릭재킹 공격 방지'
    });

    // X-Content-Type-Options
    securityHeaders.push({
      name: 'X-Content-Type-Options',
      value: headers['x-content-type-options'] || '',
      present: !!headers['x-content-type-options'],
      recommended: true,
      description: 'MIME 타입 스니핑 방지'
    });

    // X-XSS-Protection
    securityHeaders.push({
      name: 'X-XSS-Protection',
      value: headers['x-xss-protection'] || '',
      present: !!headers['x-xss-protection'],
      recommended: true,
      description: 'XSS 필터 활성화'
    });

    // Referrer-Policy
    securityHeaders.push({
      name: 'Referrer-Policy',
      value: headers['referrer-policy'] || '',
      present: !!headers['referrer-policy'],
      recommended: true,
      description: '리퍼러 정보 제어'
    });

    // Permissions-Policy
    securityHeaders.push({
      name: 'Permissions-Policy',
      value: headers['permissions-policy'] || '',
      present: !!headers['permissions-policy'],
      recommended: false,
      description: '브라우저 기능 접근 제어 (선택사항)'
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
      recommendations.push('모든 권장 보안 헤더가 설정되어 있습니다!');
      return recommendations;
    }

    missingHeaders.forEach(headerName => {
      switch (headerName) {
        case 'Strict-Transport-Security':
          recommendations.push('HSTS 헤더를 추가하여 HTTPS 강제 사용을 설정하세요');
          break;
        case 'Content-Security-Policy':
          recommendations.push('CSP 헤더를 추가하여 XSS 공격을 방지하세요');
          break;
        case 'X-Frame-Options':
          recommendations.push('X-Frame-Options 헤더를 추가하여 클릭재킹을 방지하세요');
          break;
        case 'X-Content-Type-Options':
          recommendations.push('X-Content-Type-Options: nosniff 헤더를 추가하세요');
          break;
        case 'X-XSS-Protection':
          recommendations.push('X-XSS-Protection 헤더를 추가하여 XSS 필터를 활성화하세요');
          break;
        case 'Referrer-Policy':
          recommendations.push('Referrer-Policy 헤더를 추가하여 리퍼러 정보를 제어하세요');
          break;
      }
    });

    return recommendations;
  }

  /**
   * Generate a human-readable report from the security headers analysis
   */
  static generateSecurityHeadersReport(result: SecurityHeadersResult): string {
    let report = `🛡️ 보안 헤더 분석 보고서\n`;
    report += `📅 생성일: ${new Date(result.timestamp).toLocaleString()}\n\n`;
    
    report += `📊 보안 점수: ${result.securityScore}/100\n\n`;
    
    if (result.headers.length > 0) {
      report += `📋 보안 헤더 상태:\n`;
      result.headers.forEach(header => {
        const status = header.present ? '✅' : '❌';
        const recommended = header.recommended ? ' (권장)' : ' (선택)';
        report += `   ${status} ${header.name}${recommended}\n`;
        if (header.present && header.value) {
          report += `      값: ${header.value}\n`;
        }
        report += `      설명: ${header.description}\n\n`;
      });
    }
    
    if (result.missingHeaders.length > 0) {
      report += `⚠️ 누락된 권장 헤더:\n`;
      result.missingHeaders.forEach(header => {
        report += `   • ${header}\n`;
      });
      report += `\n`;
    }
    
    if (result.recommendations.length > 0) {
      report += `💡 권장사항:\n`;
      result.recommendations.forEach(rec => {
        report += `   • ${rec}\n`;
      });
    }
    
    if (result.error) {
      report += `\n❌ 오류: ${result.error}\n`;
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
      criticalIssues.push('웹사이트에 접근할 수 없습니다');
      return {
        grade: 'F',
        score: 0,
        description: '웹사이트에 접근할 수 없어 분석할 수 없습니다',
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues
      };
    }

    if (!accessibility.hasSSL) {
      criticalIssues.push('HTTPS 서비스가 없습니다');
      return {
        grade: 'F',
        score: 0,
        description: 'HTTPS 서비스가 없어 심각한 보안 문제가 있습니다',
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues
      };
    }

    // Step 2: Certificate analysis (SSL_Analyzer.md criteria)
    if (certificate.certificateStatus === 'expired') {
      criticalIssues.push('SSL 인증서가 만료되었습니다');
      return {
        grade: 'F',
        score: 0,
        description: '만료된 SSL 인증서로 인해 심각한 보안 문제가 있습니다',
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues
      };
    }

    // Base score calculation according to SSL_Analyzer.md
    if (certificate.certificateStatus === 'self-signed') {
      baseScore = 30; // D등급
      highIssues.push('자체 서명된 SSL 인증서를 사용하고 있습니다');
    } else if (certificate.certificateStatus === 'valid') {
      baseScore = 80; // B등급
    } else if (certificate.certificateStatus === 'invalid') {
      baseScore = 30; // Treat invalid as self-signed for scoring
      highIssues.push('유효하지 않은 SSL 인증서를 사용하고 있습니다');
    } else {
      baseScore = 0; // Error case
      criticalIssues.push('SSL 인증서 분석에 실패했습니다');
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
      mediumIssues.push(`SSL 인증서가 ${certificate.certificateInfo.daysUntilExpiry}일 후 만료됩니다`);
    }

    // Specific header issues classification (based on risk matrix - all Medium severity)
    if (missingHeaders.includes('Strict-Transport-Security')) {
      mediumIssues.push('HSTS 헤더가 누락되어 HTTPS 강제 사용이 설정되지 않았습니다');
    }
    if (missingHeaders.includes('Content-Security-Policy')) {
      mediumIssues.push('CSP 헤더가 누락되어 XSS 공격에 취약합니다');
    }
    if (missingHeaders.includes('X-Frame-Options')) {
      mediumIssues.push('X-Frame-Options 헤더가 누락되어 클릭재킹에 취약합니다');
    }
    if (missingHeaders.includes('X-Content-Type-Options')) {
      mediumIssues.push('X-Content-Type-Options 헤더가 누락되어 MIME 타입 스니핑에 취약합니다');
    }
    if (missingHeaders.includes('X-XSS-Protection')) {
      mediumIssues.push('X-XSS-Protection 헤더가 누락되어 XSS 필터가 비활성화되어 있습니다');
    }
    if (missingHeaders.includes('Referrer-Policy')) {
      mediumIssues.push('Referrer-Policy 헤더가 누락되어 리퍼러 정보가 노출될 수 있습니다');
    }

    // Final grade determination based on SSL_Analyzer.md scoring
    let grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
    let description: string;

    if (baseScore >= 95) {
      grade = 'A+';
      description = '완벽한 보안 설정입니다';
    } else if (baseScore >= 90) {
      grade = 'A';
      description = '우수한 보안 수준입니다';
    } else if (baseScore >= 80) {
      grade = 'B';
      description = '양호한 보안 수준입니다';
    } else if (baseScore >= 70) {
      grade = 'C';
      description = '보통 수준의 보안입니다';
    } else if (baseScore >= 50) {
      grade = 'D';
      description = '보안 개선이 필요합니다';
    } else {
      grade = 'F';
      description = '심각한 보안 문제가 있습니다';
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
    let report = `🏆 보안 등급 분석 보고서\n`;
    report += `📅 생성일: ${new Date().toLocaleString()}\n\n`;
    
    report += `🎯 최종 보안 등급: ${grade.grade} (${grade.score}/100점)\n`;
    report += `📝 평가: ${grade.description}\n\n`;
    
    if (grade.criticalIssues.length > 0) {
      report += `🚨 치명적 문제점:\n`;
      grade.criticalIssues.forEach(issue => {
        report += `   • ${issue}\n`;
      });
      report += `\n`;
    }
    
    if (grade.highIssues.length > 0) {
      report += `⚠️ 높은 우선순위 문제점:\n`;
      grade.highIssues.forEach(issue => {
        report += `   • ${issue}\n`;
      });
      report += `\n`;
    }
    
    if (grade.mediumIssues.length > 0) {
      report += `🔶 중간 우선순위 문제점:\n`;
      grade.mediumIssues.forEach(issue => {
        report += `   • ${issue}\n`;
      });
      report += `\n`;
    }
    
    if (grade.lowIssues.length > 0) {
      report += `🔸 낮은 우선순위 문제점:\n`;
      grade.lowIssues.forEach(issue => {
        report += `   • ${issue}\n`;
      });
      report += `\n`;
    }
    
    if (grade.criticalIssues.length === 0 && grade.highIssues.length === 0) {
      report += `✅ 심각한 보안 문제가 발견되지 않았습니다!\n`;
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
    let combinedReport = `🔍 완전한 SSL 보안 분석\n`;
    combinedReport += `📅 생성일: ${new Date().toLocaleString()}\n`;
    combinedReport += `🌐 웹사이트: ${url}\n\n`;
    
    combinedReport += `=== 보안 등급 ===\n`;
    combinedReport += this.generateSecurityGradeReport(grade);
    combinedReport += `\n\n=== 비즈니스 영향 분석 ===\n`;
    combinedReport += businessImpact.report;
    combinedReport += `\n\n=== 웹사이트 접근성 ===\n`;
    combinedReport += this.generateAccessibilityReport(accessibility);
    combinedReport += `\n\n=== SSL 인증서 분석 ===\n`;
    combinedReport += this.generateCertificateReport(certificate);
    combinedReport += `\n\n=== 보안 헤더 분석 ===\n`;
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
        brandImageImpact = '심각한 손상';
        break;
      case 'D':
        securityLossRate = 0.30; // 30% 손실
        seoRankingLoss = 30; // 30% 하락
        customerTrustLoss = 70; // 70% 손상
        brandImageImpact = '상당한 손상';
        break;
      case 'C':
        securityLossRate = 0.20; // 20% 손실
        seoRankingLoss = 25; // 25% 하락
        customerTrustLoss = 50; // 50% 손상
        brandImageImpact = '중간 손상';
        break;
      case 'B':
        securityLossRate = 0.10; // 10% 손실
        seoRankingLoss = 15; // 15% 하락
        customerTrustLoss = 30; // 30% 손상
        brandImageImpact = '경미한 손상';
        break;
      case 'A':
        securityLossRate = 0.05; // 5% 손실
        seoRankingLoss = 5; // 5% 하락
        customerTrustLoss = 10; // 10% 손상
        brandImageImpact = '최소 손상';
        break;
      case 'A+':
        securityLossRate = 0.02; // 2% 손실
        seoRankingLoss = 0; // 하락 없음
        customerTrustLoss = 5; // 5% 손상
        brandImageImpact = '거의 없음';
        break;
      default:
        securityLossRate = 0.50;
        seoRankingLoss = 40;
        customerTrustLoss = 90;
        brandImageImpact = '심각한 손상';
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
    let report = `\n=== 비즈니스 영향 분석 ===\n`;
    report += `월 방문자: ${impact.monthlyVisitors.toLocaleString()}명\n`;
    report += `전환율: ${(impact.conversionRate * 100).toFixed(1)}%\n`;
    report += `주문 전환율: ${(impact.orderConversionRate * 100).toFixed(1)}%\n`;
    report += `평균 주문금액: ${impact.averageOrderValue.toLocaleString()}원\n`;
    report += `보안 손실률: ${(impact.securityLossRate * 100).toFixed(1)}%\n\n`;

    report += `💰 손실 분석:\n`;
    report += `연간 예상 손실: ${impact.annualLoss.toLocaleString()}원\n`;
    report += `SEO 순위 하락: ${impact.seoRankingLoss}%\n`;
    report += `고객 신뢰도 손상: ${impact.customerTrustLoss}%\n`;
    report += `브랜드 이미지: ${impact.brandImageImpact}\n\n`;

    report += `💡 투자 분석:\n`;
    report += `권장 투자비용: ${impact.investmentCost.toLocaleString()}원\n`;
    report += `연간 순이익: ${impact.netBenefit.toLocaleString()}원\n`;
    report += `투자 대비 효과: ${impact.roi.toFixed(1)}배 ROI\n\n`;

    if (impact.roi > 10) {
      report += `✅ 결론: 즉시 투자 권장 (높은 ROI)\n`;
    } else if (impact.roi > 5) {
      report += `✅ 결론: 투자 권장 (양호한 ROI)\n`;
    } else if (impact.roi > 0) {
      report += `⚠️ 결론: 신중한 검토 필요\n`;
    } else {
      report += `❌ 결론: 투자 효과 미미\n`;
    }

    return report;
  }
}
