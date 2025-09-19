/**
 * Analyze Project Tool
 * Analyzes project structure and provides insights
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ToolExecutor } from '../../types/ai-types';

export class AnalyzeProjectTool implements ToolExecutor {
  name = 'analyze_project';
  description = 'Analyze project structure and provide insights';
  dangerous = false;

  async execute(params: { projectPath?: string }): Promise<any> {
    const projectPath = params.projectPath || process.cwd();
    
    try {
      // Get project structure
      const structure = await this.getProjectStructure(projectPath);
      
      // Analyze package.json if exists
      let packageInfo = null;
      const packagePath = path.join(projectPath, 'package.json');
      try {
        const packageContent = await fs.promises.readFile(packagePath, 'utf-8');
        packageInfo = JSON.parse(packageContent);
      } catch {
        // No package.json or invalid JSON
      }

      return {
        projectPath,
        structure,
        packageInfo,
        analysis: {
          totalFiles: structure.files,
          totalDirectories: structure.directories,
          hasPackageJson: !!packageInfo,
          projectType: this.detectProjectType(packageInfo, structure),
          mainLanguages: this.detectLanguages(structure)
        }
      };
    } catch (error) {
      throw new Error(`Failed to analyze project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getProjectStructure(dirPath: string, depth = 0): Promise<any> {
    if (depth > 3) return null; // Limit recursion

    try {
      const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const structure = {
        files: 0,
        directories: 0,
        children: {} as Record<string, any>
      };

      for (const item of items) {
        if (item.name.startsWith('.')) continue; // Skip hidden files
        
        const itemPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          structure.directories++;
          if (depth < 2) {
            structure.children[item.name] = await this.getProjectStructure(itemPath, depth + 1);
          }
        } else {
          structure.files++;
          structure.children[item.name] = { type: 'file' };
        }
      }

      return structure;
    } catch {
      return null;
    }
  }

  private detectProjectType(packageInfo: any, structure: any): string {
    if (packageInfo) {
      if (packageInfo.dependencies?.react || packageInfo.devDependencies?.react) return 'React';
      if (packageInfo.dependencies?.vue || packageInfo.devDependencies?.vue) return 'Vue';
      if (packageInfo.dependencies?.angular || packageInfo.devDependencies?.angular) return 'Angular';
      if (packageInfo.dependencies?.electron || packageInfo.devDependencies?.electron) return 'Electron';
      if (packageInfo.dependencies?.express) return 'Express/Node.js';
      return 'Node.js';
    }

    // Check for other project types
    if (structure.children?.['Cargo.toml']) return 'Rust';
    if (structure.children?.['go.mod']) return 'Go';
    if (structure.children?.['requirements.txt'] || structure.children?.['pyproject.toml']) return 'Python';
    
    return 'Unknown';
  }

  private detectLanguages(structure: any): string[] {
    const languages = new Set<string>();
    this.collectLanguages(structure, languages);
    return Array.from(languages);
  }

  private collectLanguages(node: any, languages: Set<string>): void {
    if (!node?.children) return;

    for (const [name, child] of Object.entries(node.children)) {
      if (typeof child === 'object' && child !== null && (child as any).type === 'file') {
        const ext = path.extname(name).toLowerCase();
        switch (ext) {
          case '.js': case '.jsx': languages.add('JavaScript'); break;
          case '.ts': case '.tsx': languages.add('TypeScript'); break;
          case '.py': languages.add('Python'); break;
          case '.rs': languages.add('Rust'); break;
          case '.go': languages.add('Go'); break;
          case '.java': languages.add('Java'); break;
          case '.cpp': case '.cc': case '.cxx': languages.add('C++'); break;
          case '.c': languages.add('C'); break;
          case '.php': languages.add('PHP'); break;
          case '.rb': languages.add('Ruby'); break;
        }
      } else if (typeof child === 'object') {
        this.collectLanguages(child, languages);
      }
    }
  }
}
