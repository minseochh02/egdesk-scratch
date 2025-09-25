import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import type { ToolExecutor } from '../../types/ai-types';
import { projectContextBridge } from '../project-context-bridge';

export class MoveFileTool implements ToolExecutor {
  name = 'move_file';
  description = 'Move a file from source_path to dest_path (creates directories). Always overwrites with backups using the same schema as write_file/partial_edit.';
  dangerous = false;
  requiresConfirmation = false;

  async execute(parameters: Record<string, any>, _signal?: AbortSignal, conversationId?: string): Promise<any> {
    const sourcePath: string = parameters.sourcePath || parameters.source_path;
    const destPath: string = parameters.destPath || parameters.dest_path || parameters.destinationPath || parameters.destination_path;

    if (!sourcePath || !destPath) {
      throw new Error('source_path and dest_path are required');
    }

    // Resolve relative paths against current project directory to match other tools
    const hasProject = projectContextBridge.hasCurrentProject();
    const projectPath = projectContextBridge.getCurrentProjectPath();
    const from = path.isAbsolute(sourcePath)
      ? sourcePath
      : hasProject && projectPath && projectPath !== process.cwd()
        ? path.resolve(projectPath, sourcePath)
        : path.resolve(process.cwd(), sourcePath);
    const toBase = path.isAbsolute(destPath)
      ? destPath
      : hasProject && projectPath && projectPath !== process.cwd()
        ? path.resolve(projectPath, destPath)
        : path.resolve(process.cwd(), destPath);

    await fsp.mkdir(path.dirname(toBase), { recursive: true });
    const destExists = await existsAsync(toBase);
    await createBackupLikeWriteEdit(toBase, destExists, conversationId);

    try {
      await fsp.rename(from, toBase);
    } catch (err: any) {
      if (err && err.code === 'EXDEV') {
        await fsp.copyFile(from, toBase);
        await fsp.unlink(from);
      } else if (err && err.code === 'EISDIR') {
        // Edge: if dest is dir, append basename
        const final = path.join(toBase, path.basename(from));
        await fsp.mkdir(path.dirname(final), { recursive: true });
        const destExistsInner = await existsAsync(final);
        await createBackupLikeWriteEdit(final, destExistsInner, conversationId);
        await fsp.rename(from, final);
        return { source: from, destination: final };
      } else if (err && err.code === 'EXDEV') {
        const final = path.join(toBase, path.basename(from));
        const existsInner = await existsAsync(final);
        await createBackupLikeWriteEdit(final, existsInner, conversationId);
        await fsp.copyFile(from, final);
        await fsp.unlink(from);
        return { source: from, destination: final };
      } else if (err && err.message) {
        throw new Error(err.message);
      } else {
        throw err;
      }
    }

    return { source: from, destination: toBase };
  }

  async shouldConfirm(): Promise<false> {
    return false;
  }
}

async function existsAsync(p: string): Promise<boolean> {
  try { await fsp.access(p, fs.constants.F_OK); return true; } catch { return false; }
}

async function createBackupLikeWriteEdit(targetPath: string, fileExists: boolean, conversationId?: string): Promise<void> {
  try {
    const hasProject = projectContextBridge.hasCurrentProject();
    const projectPath = projectContextBridge.getCurrentProjectPath();
    const backupBaseDir = hasProject && projectPath
      ? path.join(projectPath, '.backup')
      : path.join(process.cwd(), '.backup');
    await fsp.mkdir(backupBaseDir, { recursive: true });
    const backupFolderName = conversationId
      ? `conversation-${conversationId}-backup`
      : `timestamp-${new Date().toISOString().replace(/[:.]/g, '-')}-backup`;
    const conversationBackupDir = path.join(backupBaseDir, backupFolderName);
    await fsp.mkdir(conversationBackupDir, { recursive: true });
    const relativePath = hasProject && projectPath
      ? path.relative(projectPath, targetPath)
      : path.relative(process.cwd(), targetPath);
    const backupFilePath = path.join(conversationBackupDir, relativePath);
    await fsp.mkdir(path.dirname(backupFilePath), { recursive: true });
    if (fileExists) {
      await fsp.copyFile(targetPath, backupFilePath);
    } else {
      await fsp.writeFile(backupFilePath + '.init', '');
    }
  } catch (e) {
    console.warn('Failed to create backup for move_file:', e);
  }
}


