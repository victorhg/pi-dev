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

  record(command: string, originalSize: number, filteredSize: number, matched: boolean) {
    const saved = Math.max(0, originalSize - filteredSize);
    if (saved > 0) {
      this.sessionSavings += saved;
    }

    if (!matched) {
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
  }

  getSessionSavings(): number {
    return this.sessionSavings;
  }

  getHistory(): SavingsRecord[] {
    return this.history;
  }
}
