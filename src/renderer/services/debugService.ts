/**
 * Debug Service for tracking template save attempts and errors
 * This service helps diagnose Windows-specific template saving issues
 */

export interface TemplateSaveAttempt {
  timestamp: string;
  templateId: string;
  templateName: string;
  siteId: string;
  success: boolean;
  error?: string;
  stackTrace?: string;
}

export interface DebugError {
  timestamp: string;
  error: string;
  stackTrace: string;
  context: string;
}

class DebugService {
  private static instance: DebugService;
  private maxAttempts = 100;
  private maxErrors = 50;

  private constructor() {
    // Initialize error tracking
    this.setupErrorTracking();
  }

  public static getInstance(): DebugService {
    if (!DebugService.instance) {
      DebugService.instance = new DebugService();
    }
    return DebugService.instance;
  }

  private setupErrorTracking() {
    // Track unhandled errors
    window.addEventListener('error', (event) => {
      this.logError({
        timestamp: new Date().toISOString(),
        error: event.error?.message || event.message || 'Unknown error',
        stackTrace: event.error?.stack || 'No stack trace available',
        context: `Unhandled Error: ${event.filename}:${event.lineno}:${event.colno}`
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        timestamp: new Date().toISOString(),
        error: event.reason?.message || event.reason || 'Unhandled Promise Rejection',
        stackTrace: event.reason?.stack || 'No stack trace available',
        context: 'Unhandled Promise Rejection'
      });
    });
  }

  public logTemplateSaveAttempt(attempt: Omit<TemplateSaveAttempt, 'timestamp'>): void {
    const fullAttempt: TemplateSaveAttempt = {
      ...attempt,
      timestamp: new Date().toISOString()
    };

    try {
      const attempts = this.getTemplateSaveAttempts();
      attempts.push(fullAttempt);
      
      // Keep only the most recent attempts
      if (attempts.length > this.maxAttempts) {
        attempts.splice(0, attempts.length - this.maxAttempts);
      }
      
      localStorage.setItem('templateSaveAttempts', JSON.stringify(attempts));
    } catch (error) {
      console.error('Failed to log template save attempt:', error);
    }
  }

  public logError(error: Omit<DebugError, 'timestamp'>): void {
    const fullError: DebugError = {
      ...error,
      timestamp: new Date().toISOString()
    };

    try {
      const errors = this.getRecentErrors();
      errors.push(fullError);
      
      // Keep only the most recent errors
      if (errors.length > this.maxErrors) {
        errors.splice(0, errors.length - this.maxErrors);
      }
      
      localStorage.setItem('recentErrors', JSON.stringify(errors));
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  }

  public getTemplateSaveAttempts(): TemplateSaveAttempt[] {
    try {
      return JSON.parse(localStorage.getItem('templateSaveAttempts') || '[]');
    } catch (error) {
      console.error('Failed to get template save attempts:', error);
      return [];
    }
  }

  public getRecentErrors(): DebugError[] {
    try {
      return JSON.parse(localStorage.getItem('recentErrors') || '[]');
    } catch (error) {
      console.error('Failed to get recent errors:', error);
      return [];
    }
  }

  public clearDebugData(): void {
    try {
      localStorage.removeItem('templateSaveAttempts');
      localStorage.removeItem('recentErrors');
    } catch (error) {
      console.error('Failed to clear debug data:', error);
    }
  }

  public getDebugSummary(): {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    totalErrors: number;
    recentActivity: string;
  } {
    const attempts = this.getTemplateSaveAttempts();
    const errors = this.getRecentErrors();
    
    const successfulAttempts = attempts.filter(a => a.success).length;
    const failedAttempts = attempts.filter(a => !a.success).length;
    
    const lastAttempt = attempts[attempts.length - 1];
    const lastError = errors[errors.length - 1];
    
    let recentActivity = 'No recent activity';
    if (lastAttempt && lastError) {
      const attemptTime = new Date(lastAttempt.timestamp);
      const errorTime = new Date(lastError.timestamp);
      if (attemptTime > errorTime) {
        recentActivity = `Last template save: ${lastAttempt.success ? 'Success' : 'Failed'} at ${attemptTime.toLocaleString()}`;
      } else {
        recentActivity = `Last error: ${lastError.context} at ${errorTime.toLocaleString()}`;
      }
    } else if (lastAttempt) {
      recentActivity = `Last template save: ${lastAttempt.success ? 'Success' : 'Failed'} at ${new Date(lastAttempt.timestamp).toLocaleString()}`;
    } else if (lastError) {
      recentActivity = `Last error: ${lastError.context} at ${new Date(lastError.timestamp).toLocaleString()}`;
    }
    
    return {
      totalAttempts: attempts.length,
      successfulAttempts,
      failedAttempts,
      totalErrors: errors.length,
      recentActivity
    };
  }

  // Enhanced template save with debugging
  public async saveTemplateWithDebug(
    siteId: string,
    template: any,
    saveFunction: () => Promise<any>
  ): Promise<{ success: boolean; error?: string }> {
    const attemptId = `template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    try {
      console.log(`[DebugService] Starting template save attempt: ${attemptId}`);
      
      const result = await saveFunction();
      
      if (result.success) {
        this.logTemplateSaveAttempt({
          templateId: attemptId,
          templateName: template.name || 'Unknown',
          siteId,
          success: true
        });
        
        console.log(`[DebugService] Template save successful: ${attemptId}`);
        return { success: true };
      } else {
        this.logTemplateSaveAttempt({
          templateId: attemptId,
          templateName: template.name || 'Unknown',
          siteId,
          success: false,
          error: result.error || 'Unknown error'
        });
        
        console.log(`[DebugService] Template save failed: ${attemptId}`, result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const stackTrace = error instanceof Error ? error.stack || 'No stack trace' : 'No stack trace';
      
      this.logTemplateSaveAttempt({
        templateId: attemptId,
        templateName: template.name || 'Unknown',
        siteId,
        success: false,
        error: errorMessage,
        stackTrace
      });
      
      this.logError({
        error: errorMessage,
        stackTrace,
        context: `Template Save Error: ${template.name || 'Unknown'}`
      });
      
      console.error(`[DebugService] Template save error: ${attemptId}`, error);
      return { success: false, error: errorMessage };
    }
  }

  // Check for Windows-specific issues
  public checkWindowsIssues(): {
    isWindows: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const isWindows = (window as any).electron?.platform === 'win32' || 
                     navigator.platform.includes('Win');
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (isWindows) {
      // Check for common Windows issues
      const attempts = this.getTemplateSaveAttempts();
      const recentFailedAttempts = attempts.filter(a => !a.success && 
        new Date(a.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
      );
      
      if (recentFailedAttempts.length > 0) {
        issues.push(`${recentFailedAttempts.length} failed template saves in the last 24 hours`);
        
        // Check for specific error patterns
        const permissionErrors = recentFailedAttempts.filter(a => 
          a.error?.toLowerCase().includes('permission') || 
          a.error?.toLowerCase().includes('access denied') ||
          a.error?.toLowerCase().includes('eacces')
        );
        
        if (permissionErrors.length > 0) {
          issues.push('Permission denied errors detected');
          recommendations.push('Run EGDesk as Administrator or check file permissions');
        }
        
        const pathErrors = recentFailedAttempts.filter(a => 
          a.error?.toLowerCase().includes('path') ||
          a.error?.toLowerCase().includes('invalid') ||
          a.error?.toLowerCase().includes('not found')
        );
        
        if (pathErrors.length > 0) {
          issues.push('Path-related errors detected');
          recommendations.push('Check if the application data directory is accessible');
        }
        
        const networkErrors = recentFailedAttempts.filter(a => 
          a.error?.toLowerCase().includes('network') ||
          a.error?.toLowerCase().includes('timeout') ||
          a.error?.toLowerCase().includes('connection')
        );
        
        if (networkErrors.length > 0) {
          issues.push('Network-related errors detected');
          recommendations.push('Check internet connection and firewall settings');
        }
      }
      
      // General Windows recommendations
      recommendations.push('Ensure Windows Defender is not blocking the application');
      recommendations.push('Check if the application has proper write permissions to the user data directory');
      recommendations.push('Try running the application in compatibility mode if issues persist');
    }
    
    return {
      isWindows,
      issues,
      recommendations
    };
  }
}

export default DebugService;
