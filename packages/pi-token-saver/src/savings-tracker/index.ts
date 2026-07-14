import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface SavingsRecord {
  command: string;
  originalBytes: number;
  filteredBytes: number;
  bytesSaved: number;
  matched: boolean;
  timestamp: number;
}

export class SavingsTracker {
  private history: SavingsRecord[] = [];
  private sessionSavings = 0;
  private filePath: string;

  constructor() {
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.pi', 'agent', 'token-saver');
    this.filePath = path.join(configDir, 'savings.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);
        if (parsed && Array.isArray(parsed.history)) {
          this.history = parsed.history;
          this.sessionSavings = parsed.sessionSavings || 0;
        }
      }
    } catch (err) {
      console.error('[TokenSaver] Failed to load savings history:', err);
    }
  }

  private save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = JSON.stringify({
        history: this.history,
        sessionSavings: this.sessionSavings,
      }, null, 2);
      fs.writeFileSync(this.filePath, data, 'utf-8');
    } catch (err) {
      console.error('[TokenSaver] Failed to save savings history:', err);
    }
  }

  record(command: string, originalSize: number, filteredSize: number, matched: boolean) {
    const saved = Math.max(0, originalSize - filteredSize);
    if (saved > 0) {
      this.sessionSavings += saved;
    }

    if (!matched) {
      this.save();
      return;
    }

    this.history.push({
      command,
      originalBytes: originalSize,
      filteredBytes: filteredSize,
      bytesSaved: saved,
      matched,
      timestamp: Date.now(),
    });

    this.save();
  }

  getSessionSavings(): number {
    return this.sessionSavings;
  }

  getHistory(): SavingsRecord[] {
    return this.history;
  }

  clearHistory() {
    this.history = [];
    this.sessionSavings = 0;
    this.save();
  }
}
