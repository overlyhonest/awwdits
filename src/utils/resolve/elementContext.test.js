import { describe, it, expect } from 'vitest';
import { summarizeChildren, childSignature } from './elementContext.js';

describe('childSignature', () => {
  it('joins up to three classes onto the tag', () => {
    expect(childSignature({ tag: 'div', classes: ['h-8', 'w-8', 'rounded-full', 'extra'] }))
      .toBe('div.h-8.w-8.rounded-full');
  });
  it('is just the tag when there are no classes', () => {
    expect(childSignature({ tag: 'div', classes: [] })).toBe('div');
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
