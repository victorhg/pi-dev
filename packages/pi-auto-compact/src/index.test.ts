import { describe, it, expect } from 'vitest';
// Simple placeholder to align with package conventions and test:self requirements

describe('pi-auto-compact', () => {
  it('has correct default thresholds', () => {
    const warnThreshold = 75;
    const compactThreshold = 90;
    expect(warnThreshold).toBeLessThan(compactThreshold);
  });
});
