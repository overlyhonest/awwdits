import { describe, it, expect } from 'vitest';
import { summarizeChildren, childSignature, snippetText } from './elementContext.js';

describe('childSignature', () => {
  it('joins up to three classes onto the tag', () => {
    expect(childSignature({ tag: 'div', classes: ['h-8', 'w-8', 'rounded-full', 'extra'] }))
      .toBe('div.h-8.w-8.rounded-full');
  });
  it('is just the tag when there are no classes', () => {
    expect(childSignature({ tag: 'div', classes: [] })).toBe('div');
  });
  it('filters out Tailwind variant classes containing a colon', () => {
    expect(childSignature({ tag: 'div', classes: ['hover:bg-red', 'w-8', 'focus:ring'] })).toBe('div.w-8');
  });
});

describe('summarizeChildren', () => {
  it('uses the shared signature when every child is identical', () => {
    const kids = Array.from({ length: 11 }, () => ({ tag: 'div', classes: ['h-8', 'w-8', 'rounded-full'] }));
    expect(summarizeChildren(kids)).toEqual({ count: 11, signature: 'div.h-8.w-8.rounded-full' });
  });
  it('falls back to the shared tag when classes differ', () => {
    const kids = [{ tag: 'div', classes: ['a'] }, { tag: 'div', classes: ['b'] }, { tag: 'div', classes: [] }];
    expect(summarizeChildren(kids)).toEqual({ count: 3, signature: 'div' });
  });
  it('gives a null signature for mixed tags', () => {
    expect(summarizeChildren([{ tag: 'div', classes: [] }, { tag: 'span', classes: [] }]))
      .toEqual({ count: 2, signature: null });
  });
  it('reports zero children', () => {
    expect(summarizeChildren([])).toEqual({ count: 0, signature: null });
  });
});

describe('snippetText', () => {
  it('collapses runs of whitespace and trims', () => {
    expect(snippetText('  Get\n  started  ')).toBe('Get started');
  });

  it('caps at 80 chars with an ellipsis', () => {
    const raw = 'x'.repeat(100);
    const out = snippetText(raw);
    expect(out.length).toBe(80);
    expect(out.endsWith('…')).toBe(true);
  });

  it('returns null for empty/whitespace/null input', () => {
    expect(snippetText('   ')).toBeNull();
    expect(snippetText('')).toBeNull();
    expect(snippetText(null)).toBeNull();
  });
});
