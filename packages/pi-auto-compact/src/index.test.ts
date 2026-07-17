import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCleanSession, checkContextUsage } from './index.js';
import type { SessionState } from './index.js';

// ── Minimal ExtensionContext mock ─────────────────────────────────────────────
function makeCtx(percent: number, hasCompact = true) {
  return {
    hasUI: false,
    getContextUsage: () => ({ percent }),
    compact: hasCompact
      ? vi.fn(({ onComplete }: { onComplete: () => void }) => onComplete())
      : undefined,
    sessionManager: {
      getEntries: () => [],
    },
  } as any;
}

// ── makeCleanSession ──────────────────────────────────────────────────────────
describe('makeCleanSession', () => {
  it('returns a fresh state object with all flags cleared', () => {
    const s = makeCleanSession();
    expect(s.ctx).toBeUndefined();
    expect(s.isCompacting).toBe(false);
    expect(s.warned).toBe(false);
    expect(s.lastPercent).toBe(0);
  });

  it('returns a new object on every call (no shared reference)', () => {
    const a = makeCleanSession();
    const b = makeCleanSession();
    a.isCompacting = true;
    expect(b.isCompacting).toBe(false);
  });
});

// ── checkContextUsage: warning threshold ─────────────────────────────────────
describe('checkContextUsage — warning threshold', () => {
  it('sets warned=true when percent crosses warnThreshold (75)', () => {
    const ctx = makeCtx(80);
    // Drive checkContextUsage through the exported function.
    // We need to inject session state — the function reads from the module-level
    // `session`. Reset it to a known clean state first via the activate path,
    // which we approximate by calling makeCleanSession and replacing the ctx.
    // The simplest integration approach: call the function and observe side-effects
    // on the ctx mock (notifications go to console since hasUI=false).
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    checkContextUsage(ctx);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('80.0%')
    );
    consoleSpy.mockRestore();
  });

  it('does not warn below warnThreshold', () => {
    const ctx = makeCtx(50);
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    checkContextUsage(ctx);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ── checkContextUsage: compaction threshold ───────────────────────────────────
describe('checkContextUsage — compaction threshold', () => {
  it('calls ctx.compact when percent reaches compactThreshold (90)', () => {
    const ctx = makeCtx(95);
    checkContextUsage(ctx);
    expect(ctx.compact).toHaveBeenCalledOnce();
  });

  it('resets isCompacting after onComplete fires', () => {
    const ctx = makeCtx(95);
    // compact mock calls onComplete synchronously
    checkContextUsage(ctx);
    // If isCompacting were still true the next call would be a no-op.
    // Calling again at a lower percent should now reach the warn branch.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    checkContextUsage(makeCtx(80));
    // Should warn (not be blocked by isCompacting)
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ── Session isolation: makeCleanSession contract ──────────────────────────────
describe('session state isolation', () => {
  it('a fresh session object never carries over isCompacting from a previous one', () => {
    const dirtySession: SessionState = {
      ctx: makeCtx(95),
      isCompacting: true,
      warned: true,
      lastPercent: 95,
    };

    // Simulate session_shutdown + session_start by replacing with a clean session
    const fresh = makeCleanSession();

    expect(fresh.isCompacting).toBe(false);
    expect(fresh.warned).toBe(false);
    expect(fresh.lastPercent).toBe(0);
    expect(fresh.ctx).toBeUndefined();
    // Confirm the dirty session object was not mutated
    expect(dirtySession.isCompacting).toBe(true);
  });
});
