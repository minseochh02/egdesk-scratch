import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import type { ToolExecutor } from '../../types/ai-types';

export class MoveFileTool implements ToolExecutor {
  name = 'move_file';
  description = 'Move a file from source_path to dest_path (creates directories). Optional overwrite.';
  dangerous = false;
  requiresConfirmation = false;

  async execute(parameters: Record<string, any>): Promise<any> {
    const sourcePath: string = parameters.sourcePath || parameters.source_path;
    const destPath: string = parameters.destPath || parameters.dest_path || parameters.destinationPath || parameters.destination_path;
    const overwrite: boolean = Boolean(parameters.overwrite);

    if (!sourcePath || !destPath) {
      throw new Error('source_path and dest_path are required');
    }

    const from = path.resolve(sourcePath);
    const to = path.resolve(destPath);

    await fsp.mkdir(path.dirname(to), { recursive: true });

    try {
      if (!overwrite) {
        try {
          await fsp.access(to, fs.constants.F_OK);
          throw new Error('Destination exists. Set overwrite=true to replace.');
        } catch {}
      }

      await fsp.rename(from, to);
    } catch (err: any) {
      if (err && err.code === 'EXDEV') {
        await fsp.copyFile(from, to);
        await fsp.unlink(from);
      } else if (overwrite && err && err.code === 'EISDIR') {
        // Edge: if dest is dir, append basename
        const final = path.join(to, path.basename(from));
        await fsp.mkdir(path.dirname(final), { recursive: true });
        await fsp.rename(from, final);
        return { source: from, destination: final };
      } else if (overwrite && err && err.code === 'EXDEV') {
        const final = path.join(to, path.basename(from));
        await fsp.copyFile(from, final);
        await fsp.unlink(from);
        return { source: from, destination: final };
      } else if (err && err.message) {
        throw new Error(err.message);
      } else {
        throw err;
      }
    }

    return { source: from, destination: to };
  }

  async shouldConfirm(): Promise<false> {
    return false;
  }
}


