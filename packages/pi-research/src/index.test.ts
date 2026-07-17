import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  slugify,
  researchPath,
  scoreSourceCredibility,
  credibilityLabel,
  makeCleanSession,
  renderDocument,
} from './index.js';
import type { ResearchSessionState, ResearchDocument } from './index.js';

// ── slugify tests ─────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('converts a phrase to a URL-safe slug', () => {
    expect(slugify('React vs Vue comparison')).toBe('react-vs-vue-comparison');
  });

  it('handles special characters', () => {
    expect(slugify('C++ & Java: A Guide!')).toBe('c-java-a-guide');
  });

  it('returns "research" for empty/whitespace input', () => {
    expect(slugify('')).toBe('research');
    expect(slugify('   ')).toBe('research');
  });

  it('lowercases the result', () => {
    expect(slugify('Hello WORLD Test')).toBe('hello-world-test');
  });
});

// ── researchPath tests ────────────────────────────────────────────────────────

describe('researchPath', () => {
  it('returns the expected path format', () => {
    expect(researchPath('react-vs-vue')).toBe('research/react-vs-vue.md');
  });
});

// ── makeCleanSession tests ────────────────────────────────────────────────────

describe('makeCleanSession', () => {
  it('returns a fresh state object with all fields cleared', () => {
    const s = makeCleanSession();
    expect(s.ctx).toBeUndefined();
    expect(s.activeDoc).toBeNull();
    expect(s.phase).toBe('idle');
    expect(s.sources).toEqual([]);
    expect(s.subQuestions).toEqual([]);
  });

  it('returns a new object on every call (no shared reference)', () => {
    const a = makeCleanSession();
    const b = makeCleanSession();
    a.phase = 'planning';
    expect(b.phase).toBe('idle');
  });
});

// ── scoreSourceCredibility tests ──────────────────────────────────────────────

describe('scoreSourceCredibility', () => {
  it('scores high-credibility domains highly', () => {
    expect(scoreSourceCredibility('https://github.com/example/repo')).toBeGreaterThanOrEqual(80);
    expect(scoreSourceCredibility('https://arxiv.org/paper/1234')).toBeGreaterThanOrEqual(80);
    expect(scoreSourceCredibility('https://docs.example.com/api')).toBeGreaterThanOrEqual(80);
  });

  it('scores medium-credibility domains moderately', () => {
    expect(scoreSourceCredibility('https://medium.com/article/123')).toBeGreaterThanOrEqual(50);
    expect(scoreSourceCredibility('https://quora.com/question/123')).toBeGreaterThanOrEqual(50);
  });

  it('scores unknown domains low', () => {
    expect(scoreSourceCredibility('https://unknown-blog.com/post')).toBeLessThan(50);
  });
});

// ── credibilityLabel tests ────────────────────────────────────────────────────

describe('credibilityLabel', () => {
  it('returns "high" for scores >= 80', () => {
    expect(credibilityLabel(90)).toBe('high');
    expect(credibilityLabel(80)).toBe('high');
  });

  it('returns "medium" for scores 50-79', () => {
    expect(credibilityLabel(60)).toBe('medium');
    expect(credibilityLabel(79)).toBe('medium');
  });

  it('returns "low" for scores < 50', () => {
    expect(credibilityLabel(40)).toBe('low');
    expect(credibilityLabel(0)).toBe('low');
  });
});

// ── renderDocument tests ──────────────────────────────────────────────────────

describe('renderDocument', () => {
  const sampleDoc: ResearchDocument = {
    topic: 'Testing Frameworks',
    slug: 'testing-frameworks',
    subQuestions: ['What are the popular frameworks?', 'How do they compare?'],
    sources: [
      {
        url: 'https://example.com/1',
        title: 'Framework Comparison Guide',
        credibility: 'high',
        relevanceScore: 95,
      },
    ],
    sections: {
      overview: 'An overview of testing frameworks.',
      keyConcepts: 'Key concepts include assertions, mocking, and fixtures.',
      findings: ['Findings for question 1.', 'Findings for question 2.'],
      directions: 'Future work includes benchmarking.',
    },
    createdAt: '2025-01-15T10:00:00.000Z',
    path: 'research/testing-frameworks.md',
  };

  it('produces a valid Markdown document with all sections', () => {
    const md = renderDocument(sampleDoc);

    expect(md).toContain('# Testing Frameworks');
    expect(md).toContain('## Overview');
    expect(md).toContain('## Key Concepts');
    expect(md).toContain('## Findings');
    expect(md).toContain('## References');
    expect(md).toContain('## Directions');
    expect(md).toContain('Framework Comparison Guide');
  });

  it('includes sub-questions as numbered headings', () => {
    const md = renderDocument(sampleDoc);
    expect(md).toContain('### 1. What are the popular frameworks?');
    expect(md).toContain('### 2. How do they compare?');
  });

  it('includes source references with URLs and credibility labels', () => {
    const md = renderDocument(sampleDoc);
    expect(md).toContain('[high]');
    expect(md).toContain('https://example.com/1');
  });
});
