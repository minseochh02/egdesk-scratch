/**
 * Shell Command Tool
 * Executes shell commands with safety checks
 */

import { spawn } from 'child_process';
import type { ToolExecutor, ToolCallConfirmationDetails } from '../../types/ai-types';

export class ShellCommandTool implements ToolExecutor {
  name = 'shell_command';
  description = 'Execute a shell command';
  dangerous = true;
  requiresConfirmation = false;

  async execute(params: { command: string; cwd?: string }, signal?: AbortSignal): Promise<string> {
    if (!params.command) {
      throw new Error('command parameter is required');
    }

    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', params.command], {
        cwd: params.cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout || 'Command executed successfully');
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Handle cancellation
      signal?.addEventListener('abort', () => {
        child.kill();
        reject(new Error('Command cancelled by user'));
      });
    });
  }

  async shouldConfirm(params: { command: string }): Promise<ToolCallConfirmationDetails> {
    const dangerous = /rm|del|format|sudo|chmod|chown/.test(params.command);
    
    return {
      toolName: this.name,
      parameters: params,
      description: `Execute shell command: ${params.command}`,
      risks: dangerous 
        ? ['Could modify or delete files', 'Could affect system security', 'Could cause data loss']
        : ['Will execute system command', 'Could affect files in current directory'],
      autoApprove: !dangerous
    };
  }
}
