import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface DeploymentVersion {
  versionId: string;
  timestamp: string;
  projectType: 'nextjs' | 'vite' | 'react' | 'unknown';
  sourcePath: string;
  deploymentPath: string;
  buildSize: number;
  status: 'active' | 'inactive' | 'failed';
  buildOutput?: string;
  deployedAt: string;
}

export interface DeploymentManifest {
  projectName: string;
  versions: DeploymentVersion[];
  activeVersionId: string | null;
  maxVersions: number;
}

export class DeploymentManager {
  private deploymentsRoot: string;

  constructor() {
    this.deploymentsRoot = path.join(os.homedir(), '.egdesk', 'deployments');
    fs.mkdirSync(this.deploymentsRoot, { recursive: true });
  }

  private getProjectDir(projectName: string): string {
    return path.join(this.deploymentsRoot, projectName);
  }

  private getManifestPath(projectName: string): string {
    return path.join(this.getProjectDir(projectName), 'manifest.json');
  }

  private loadManifest(projectName: string): DeploymentManifest {
    const manifestPath = this.getManifestPath(projectName);
    if (fs.existsSync(manifestPath)) {
      try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      } catch {
        // Fall through to default
      }
    }
    return { projectName, versions: [], activeVersionId: null, maxVersions: 5 };
  }

  private saveManifest(manifest: DeploymentManifest): void {
    const projectDir = this.getProjectDir(manifest.projectName);
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(
      this.getManifestPath(manifest.projectName),
      JSON.stringify(manifest, null, 2)
    );
  }

  private generateVersionId(projectName: string): string {
    const manifest = this.loadManifest(projectName);
    const count = manifest.versions.length + 1;
    const now = new Date();
    const date =
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0');
    const time =
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');
    return `v${count}-${date}-${time}`;
  }

  private calculateDirSize(dirPath: string): number {
    let size = 0;
    try {
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          size += this.calculateDirSize(fullPath);
        } else {
          size += fs.statSync(fullPath).size;
        }
      }
    } catch {
      // Ignore errors calculating size
    }
    return size;
  }

  /**
   * Copy build artifacts from source to a versioned deployment directory.
   * - React: copies build/
   * - Vite:  copies dist/
   * - Next.js: copies .next/, public/, package.json, next.config.*, and symlinks node_modules (Unix only)
   */
  private async copyArtifacts(
    sourcePath: string,
    deploymentPath: string,
    projectType: 'nextjs' | 'vite' | 'react' | 'unknown'
  ): Promise<number> {
    let totalSize = 0;

    switch (projectType) {
      case 'react': {
        const src = path.join(sourcePath, 'build');
        if (fs.existsSync(src)) {
          const dest = path.join(deploymentPath, 'build');
          fs.cpSync(src, dest, { recursive: true, force: true });
          totalSize = this.calculateDirSize(dest);
          console.log(`✅ Copied React build/ → ${deploymentPath}`);
        } else {
          console.warn(`⚠️ React build/ not found at ${src}`);
        }
        break;
      }

      case 'vite': {
        const src = path.join(sourcePath, 'dist');
        if (fs.existsSync(src)) {
          const dest = path.join(deploymentPath, 'dist');
          fs.cpSync(src, dest, { recursive: true, force: true });
          totalSize = this.calculateDirSize(dest);
          console.log(`✅ Copied Vite dist/ → ${deploymentPath}`);
        } else {
          console.warn(`⚠️ Vite dist/ not found at ${src}`);
        }
        break;
      }

      case 'nextjs': {
        // Copy .next/
        const nextSrc = path.join(sourcePath, '.next');
        if (fs.existsSync(nextSrc)) {
          const nextDest = path.join(deploymentPath, '.next');
          fs.cpSync(nextSrc, nextDest, { recursive: true, force: true });
          totalSize += this.calculateDirSize(nextDest);
          console.log(`✅ Copied .next/ → ${deploymentPath}`);
        }

        // Copy public/
        const publicSrc = path.join(sourcePath, 'public');
        if (fs.existsSync(publicSrc)) {
          const publicDest = path.join(deploymentPath, 'public');
          fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
          totalSize += this.calculateDirSize(publicDest);
        }

        // Copy package.json
        const pkgSrc = path.join(sourcePath, 'package.json');
        if (fs.existsSync(pkgSrc)) {
          fs.copyFileSync(pkgSrc, path.join(deploymentPath, 'package.json'));
          totalSize += fs.statSync(pkgSrc).size;
        }

        // Copy next.config files
        for (const cfg of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
          const cfgSrc = path.join(sourcePath, cfg);
          if (fs.existsSync(cfgSrc)) {
            fs.copyFileSync(cfgSrc, path.join(deploymentPath, cfg));
          }
        }

        // Symlink node_modules (Unix only — Windows symlinks require admin rights)
        if (process.platform !== 'win32') {
          const nmSrc = path.join(sourcePath, 'node_modules');
          const nmDest = path.join(deploymentPath, 'node_modules');
          if (fs.existsSync(nmSrc) && !fs.existsSync(nmDest)) {
            fs.symlinkSync(nmSrc, nmDest, 'dir');
            console.log(`✅ Symlinked node_modules → ${nmSrc}`);
          }
        } else {
          console.log(`ℹ️ Windows: skipping node_modules symlink for Next.js deployment`);
        }
        break;
      }

      default: {
        // Best-effort: copy common output dirs
        for (const dir of ['build', 'dist', 'out']) {
          const src = path.join(sourcePath, dir);
          if (fs.existsSync(src)) {
            const dest = path.join(deploymentPath, dir);
            fs.cpSync(src, dest, { recursive: true, force: true });
            totalSize = this.calculateDirSize(dest);
            break;
          }
        }
        break;
      }
    }

    return totalSize;
  }

  /**
   * Create a versioned deployment snapshot after a successful build.
   * Returns the deployment version info including the path to serve from.
   */
  public async createDeploymentSnapshot(
    projectName: string,
    sourcePath: string,
    projectType: 'nextjs' | 'vite' | 'react' | 'unknown',
    buildOutput?: string
  ): Promise<{ success: boolean; version?: DeploymentVersion; deploymentPath?: string; error?: string }> {
    try {
      console.log(`📦 Creating deployment snapshot for ${projectName} (${projectType})`);

      const versionId = this.generateVersionId(projectName);
      const deploymentPath = path.join(this.getProjectDir(projectName), versionId);
      fs.mkdirSync(deploymentPath, { recursive: true });

      const buildSize = await this.copyArtifacts(sourcePath, deploymentPath, projectType);

      const version: DeploymentVersion = {
        versionId,
        timestamp: new Date().toISOString(),
        projectType,
        sourcePath,
        deploymentPath,
        buildSize,
        status: 'active',
        buildOutput,
        deployedAt: new Date().toISOString(),
      };

      const manifest = this.loadManifest(projectName);

      // Archive previous active version
      if (manifest.activeVersionId) {
        const prev = manifest.versions.find(v => v.versionId === manifest.activeVersionId);
        if (prev) prev.status = 'inactive';
      }

      manifest.versions.unshift(version); // newest first
      manifest.activeVersionId = versionId;

      // Prune old versions beyond maxVersions
      const toRemove = manifest.versions.splice(manifest.maxVersions);
      for (const old of toRemove) {
        this.deleteVersionDir(old.deploymentPath);
        console.log(`🗑️ Pruned old deployment: ${old.versionId}`);
      }

      this.saveManifest(manifest);

      const sizeKb = Math.round(buildSize / 1024);
      console.log(`✅ Deployment snapshot created: ${versionId} (${sizeKb} KB)`);

      return { success: true, version, deploymentPath };
    } catch (error: any) {
      console.error(`❌ Failed to create deployment snapshot:`, error);
      return { success: false, error: error.message };
    }
  }

  private deleteVersionDir(deploymentPath: string): void {
    try {
      if (fs.existsSync(deploymentPath)) {
        fs.rmSync(deploymentPath, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`Failed to delete deployment dir ${deploymentPath}:`, err);
    }
  }

  /**
   * Get the path to serve production traffic from.
   * For Next.js on Windows, falls back to the source path since we can't symlink node_modules.
   */
  public getServingPath(version: DeploymentVersion): string {
    if (version.projectType === 'nextjs' && process.platform === 'win32') {
      return version.sourcePath;
    }
    return version.deploymentPath;
  }

  /**
   * List all deployment versions for a project (newest first).
   */
  public listDeployments(projectName: string): DeploymentVersion[] {
    return this.loadManifest(projectName).versions;
  }

  /**
   * Get the currently active deployment version.
   */
  public getActiveVersion(projectName: string): DeploymentVersion | null {
    const manifest = this.loadManifest(projectName);
    if (!manifest.activeVersionId) return null;
    return manifest.versions.find(v => v.versionId === manifest.activeVersionId) || null;
  }

  /**
   * Rollback to a specific version. Updates the manifest only — caller must restart the server.
   */
  public rollbackToVersion(
    projectName: string,
    versionId: string
  ): { success: boolean; version?: DeploymentVersion; error?: string } {
    try {
      const manifest = this.loadManifest(projectName);
      const version = manifest.versions.find(v => v.versionId === versionId);

      if (!version) {
        return { success: false, error: `Version ${versionId} not found for project ${projectName}` };
      }
      if (!fs.existsSync(version.deploymentPath)) {
        return { success: false, error: `Deployment artifacts for ${versionId} no longer exist on disk` };
      }

      // Mark others inactive, activate target
      for (const v of manifest.versions) {
        v.status = v.versionId === versionId ? 'active' : 'inactive';
      }
      manifest.activeVersionId = versionId;
      this.saveManifest(manifest);

      console.log(`✅ Rolled back ${projectName} to ${versionId}`);
      return { success: true, version };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up old deployments, keeping only the most recent `keepCount`.
   */
  public cleanupOldDeployments(
    projectName: string,
    keepCount: number = 5
  ): { success: boolean; removed: number } {
    try {
      const manifest = this.loadManifest(projectName);
      const toRemove = manifest.versions.splice(keepCount);

      for (const v of toRemove) {
        this.deleteVersionDir(v.deploymentPath);
      }

      this.saveManifest(manifest);
      return { success: true, removed: toRemove.length };
    } catch (error: any) {
      console.error(`Cleanup failed for ${projectName}:`, error);
      return { success: false, removed: 0 };
    }
  }
}

let deploymentManagerInstance: DeploymentManager | null = null;

export function getDeploymentManager(): DeploymentManager {
  if (!deploymentManagerInstance) {
    deploymentManagerInstance = new DeploymentManager();
  }
  return deploymentManagerInstance;
}
