import { describe, it, expect, beforeEach } from 'vitest';
import { formatTokenCount, formatContextBar, formatGitStatusIndicators } from './utils/format.js';
import { resetSessionStats, invalidateStatsCache, getTokenUsageStats } from './utils/stats.js';

// ── Minimal colorize mock (returns the string unchanged for assertion clarity)
const colorize = (_token: string, s: string) => s;

// ── formatTokenCount ──────────────────────────────────────────────────────────
describe('formatTokenCount', () => {
  it('returns raw number below 1 K', () => {
    expect(formatTokenCount(0)).toBe('0');
    expect(formatTokenCount(512)).toBe('512');
    expect(formatTokenCount(1023)).toBe('1023');
  });

  it('formats 1 K–9.9 K with one decimal', () => {
    expect(formatTokenCount(1024)).toBe('1.0k');
    expect(formatTokenCount(2048)).toBe('2.0k');
    expect(formatTokenCount(9 * 1024)).toBe('9.0k');
  });

  it('rounds to whole K between 10 K and 1 M', () => {
    expect(formatTokenCount(10 * 1024)).toBe('10k');
    expect(formatTokenCount(500 * 1024)).toBe('500k');
  });

  it('formats M range with one decimal below 10 M', () => {
    const M = 1_048_576;
    expect(formatTokenCount(M)).toBe('1.0M');
    expect(formatTokenCount(5 * M)).toBe('5.0M');
  });

  it('rounds to whole M at 10 M and above', () => {
    const M = 1_048_576;
    expect(formatTokenCount(10 * M)).toBe('10M');
  });
});

// ── formatContextBar ──────────────────────────────────────────────────────────
describe('formatContextBar', () => {
  it('returns empty string when availableSpace <= 2', () => {
    expect(formatContextBar(colorize, 50, 0)).toBe('');
    expect(formatContextBar(colorize, 50, 2)).toBe('');
  });

  it('returns a string for valid inputs', () => {
    const result = formatContextBar(colorize, 50, 20);
    expect(result.length).toBeGreaterThan(0);
  });

  it('contains the percent value', () => {
    const result = formatContextBar(colorize, 75, 30);
    expect(result).toContain('75%');
  });

  it('renders at 0% without throwing', () => {
    expect(() => formatContextBar(colorize, 0, 20)).not.toThrow();
  });

  it('renders at 100% without throwing', () => {
    expect(() => formatContextBar(colorize, 100, 20)).not.toThrow();
  });
});

// ── formatGitStatusIndicators ────────────────────────────────────────────────
describe('formatGitStatusIndicators', () => {
  it('returns empty string when all counts are zero', () => {
    const result = formatGitStatusIndicators(
      { staged: 0, unstaged: 0, untracked: 0, ahead: 0, behind: 0 },
      colorize,
    );
    expect(result).toBe('');
  });

  it('includes staged indicator when staged > 0', () => {
    const result = formatGitStatusIndicators(
      { staged: 3, unstaged: 0, untracked: 0, ahead: 0, behind: 0 },
      colorize,
    );
    expect(result).toContain('3');
  });

  it('includes all active indicators', () => {
    const result = formatGitStatusIndicators(
      { staged: 1, unstaged: 2, untracked: 3, ahead: 1, behind: 0 },
      colorize,
    );
    expect(result).toContain('1'); // staged
    expect(result).toContain('2'); // unstaged
    expect(result).toContain('3'); // untracked
  });
});

// ── getTokenUsageStats / resetSessionStats ───────────────────────────────────
function makeCtx(entries: Array<{ input: number; output: number; cost: number }>) {
  return {
    sessionManager: {
      getEntries: () =>
        entries.map((e) => ({
          type: 'message',
          message: {
            role: 'assistant',
            usage: { input: e.input, output: e.output, cacheRead: 0, cacheWrite: 0, cost: { total: e.cost } },
          },
        })),
    },
  } as any;
}

describe('getTokenUsageStats', () => {
  beforeEach(() => {
    resetSessionStats();
  });

  it('sums input and output across entries', () => {
    const ctx = makeCtx([
      { input: 100, output: 50, cost: 0.01 },
      { input: 200, output: 100, cost: 0.02 },
    ]);
    const stats = getTokenUsageStats(ctx);
    expect(stats.totalInput).toBe(300);
    expect(stats.totalOutput).toBe(150);
    expect(stats.totalCost).toBeCloseTo(0.03);
  });

  it('returns zeros for an empty session', () => {
    const ctx = makeCtx([]);
    const stats = getTokenUsageStats(ctx);
    expect(stats.totalInput).toBe(0);
    expect(stats.totalOutput).toBe(0);
  });
});

describe('resetSessionStats', () => {
  it('clears running total so a fresh session does not inherit previous counts', () => {
    // First session
    const ctx1 = makeCtx([{ input: 500, output: 200, cost: 0.05 }]);
    getTokenUsageStats(ctx1);

    // Simulate session_shutdown — reset everything
    resetSessionStats();

    // New session with different (smaller) data
    const ctx2 = makeCtx([{ input: 10, output: 5, cost: 0.001 }]);
    const stats = getTokenUsageStats(ctx2);

    expect(stats.totalInput).toBe(10);
    expect(stats.totalOutput).toBe(5);
  });
});
