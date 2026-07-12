export interface SavingsRecord {
  command: string;
  bytesSaved: number;
  timestamp: number;
}

export class SavingsTracker {
  private history: SavingsRecord[] = [];
  private sessionSavings = 0;

  record(command: string, originalSize: number, filteredSize: number) {
    const saved = originalSize - filteredSize;
    if (saved > 0) {
      this.sessionSavings += saved;
      this.history.push({
        command,
        bytesSaved: saved,
        timestamp: Date.now(),
      });
    }
  }

  getSessionSavings(): number {
    return this.sessionSavings;
  }

  getHistory(): SavingsRecord[] {
    return this.history;
  }
}
