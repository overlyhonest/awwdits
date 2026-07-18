import { describe, it, expect } from 'vitest';
import { summarizeChildren, childSignature, snippetText, buildHook } from './elementContext.js';

const fakeEl = (opts) => ({
  id: opts.id || '',
  getAttribute: (a) => opts.attrs?.[a] ?? null,
  closest: (sel) => {
    const m = sel.match(/\[([\w-]+)\]/); const name = m && m[1];
    return (opts.attrs && name in opts.attrs) ? { getAttribute: (a) => opts.attrs[a] } : null;
  },
});

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

describe('buildHook', () => {
  it('prefers data-testid over id, aria-label, and data-slot', () => {
    const el = fakeEl({ id: 'clean-id', attrs: { 'data-testid': 'invoice-card', 'aria-label': 'Invoice', 'data-slot': 'card' } });
    expect(buildHook(el)).toEqual({ kind: 'data-testid', value: 'invoice-card' });
  });

  it('skips an auto-generated id containing a colon and falls through', () => {
    const el = fakeEl({ id: 'radix-:r1:', attrs: { 'aria-label': 'Close' } });
    expect(buildHook(el)).toEqual({ kind: 'aria-label', value: 'Close' });
  });

  it('skips an auto-generated id with a hex-like run and falls through', () => {
    const el = fakeEl({ id: 'e8f3a2b1c0', attrs: { 'data-slot': 'card' } });
    expect(buildHook(el)).toEqual({ kind: 'data-slot', value: 'card' });
  });

  it('uses a clean id when no testid is present', () => {
    const el = fakeEl({ id: 'main-nav', attrs: { 'aria-label': 'Navigation', 'data-slot': 'nav' } });
    expect(buildHook(el)).toEqual({ kind: 'id', value: 'main-nav' });
  });

  it('uses aria-label when no testid or clean id is present', () => {
    const el = fakeEl({ attrs: { 'aria-label': 'Invoice #INV-2847', 'data-slot': 'card' } });
    expect(buildHook(el)).toEqual({ kind: 'aria-label', value: 'Invoice #INV-2847' });
  });

  it('uses data-slot when only it is present', () => {
    const el = fakeEl({ attrs: { 'data-slot': 'card' } });
    expect(buildHook(el)).toEqual({ kind: 'data-slot', value: 'card' });
  });

  it('returns null when none of testid/id/aria-label/data-slot are present', () => {
    const el = fakeEl({});
    expect(buildHook(el)).toBeNull();
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
