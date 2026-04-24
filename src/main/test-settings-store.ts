import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface TestSettings {
  headless?: boolean;
}

class TestSettingsStore {
  private settingsFile: string;
  private data: Record<string, TestSettings>; // keyed by spec filename (e.g. "foo.spec.js")

  constructor() {
    const baseDir = app.isPackaged
      ? path.join(app.getPath('userData'), 'output')
      : path.join(process.cwd(), 'output');

    const outputDir = path.join(baseDir, 'browser-recorder-tests');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    this.settingsFile = path.join(outputDir, 'test-settings.json');
    this.data = {};
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.settingsFile)) {
        this.data = JSON.parse(fs.readFileSync(this.settingsFile, 'utf8'));
      }
    } catch {
      this.data = {};
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.settingsFile, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[TestSettingsStore] Failed to save:', err);
    }
  }

  get(specFileName: string): TestSettings {
    return this.data[specFileName] ?? {};
  }

  set(specFileName: string, settings: Partial<TestSettings>): void {
    this.data[specFileName] = { ...this.data[specFileName], ...settings };
    this.save();
  }

  rename(oldSpecFileName: string, newSpecFileName: string): void {
    if (this.data[oldSpecFileName]) {
      this.data[newSpecFileName] = this.data[oldSpecFileName];
      delete this.data[oldSpecFileName];
      this.save();
    }
  }

  delete(specFileName: string): void {
    if (this.data[specFileName]) {
      delete this.data[specFileName];
      this.save();
    }
  }
}

let instance: TestSettingsStore | null = null;

export function getTestSettingsStore(): TestSettingsStore {
  if (!instance) {
    instance = new TestSettingsStore();
  }
  return instance;
}
