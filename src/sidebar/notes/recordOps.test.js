import { describe, it, expect } from 'vitest';
import { upsertEdit, setComment, clearEdits, removeEmpty, sortRecords, recordKey, setScope } from './recordOps.js';
import { mergeContext } from './recordOps.js';

const base = { selector: 'button.cta', path: [{ tag: 'button', index: 0 }], label: 'button.cta' };

describe('upsertEdit', () => {
  it('adds a new record with the edit', () => {
    const r = upsertEdit([], { ...base, property: 'padding', before: '12px', after: '8px' }, 1);
    expect(r).toHaveLength(1);
    expect(r[0].edits).toEqual([{ property: 'padding', before: '12px', after: '8px' }]);
    expect(r[0].updatedAt).toBe(1);
  });

  it('keeps the first before on a second edit of the same property', () => {
    let r = upsertEdit([], { ...base, property: 'padding', before: '12px', after: '8px' }, 1);
    r = upsertEdit(r, { ...base, property: 'padding', before: '8px', after: '4px' }, 2);
    expect(r[0].edits).toEqual([{ property: 'padding', before: '12px', after: '4px' }]);
  });

  it('drops the edit when reverted (after == before)', () => {
    let r = upsertEdit([], { ...base, property: 'padding', before: '12px', after: '8px' }, 1);
    r = upsertEdit(r, { ...base, property: 'padding', before: '8px', after: '12px' }, 2);
    expect(r[0].edits).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [];
    upsertEdit(input, { ...base, property: 'padding', before: '12px', after: '8px' }, 1);
    expect(input).toEqual([]);
  });
});

describe('setComment / clearEdits / removeEmpty / sortRecords', () => {
  it('setComment creates a record and stores text', () => {
    const r = setComment([], base, 'too tight', 5);
    expect(r[0].comment).toBe('too tight');
  });

  it('clearEdits empties edits but keeps the record', () => {
    let r = upsertEdit([], { ...base, property: 'padding', before: '12px', after: '8px' }, 1);
    r = clearEdits(r, recordKey(base), 9);
    expect(r[0].edits).toEqual([]);
  });

  it('keeps reused-selector instances as separate records (keyed by path)', () => {
    const a = { selector: 'li.item', path: [{ tag: 'ul', index: 0 }, { tag: 'li', index: 0 }], label: 'li.item' };
    const b = { selector: 'li.item', path: [{ tag: 'ul', index: 0 }, { tag: 'li', index: 1 }], label: 'li.item' };
    let r = setComment([], a, 'first', 1);
    r = setComment(r, b, 'second', 2);
    expect(r).toHaveLength(2);
    expect(r.map(x => x.comment)).toEqual(['first', 'second']);
  });

  it('removeEmpty drops records with no comment and no edits', () => {
    const r = removeEmpty([{ selector: 'a', comment: '', edits: [] }, { selector: 'b', comment: 'x', edits: [] }]);
    expect(r.map(x => x.selector)).toEqual(['b']);
  });

  it('sortRecords orders by updatedAt descending', () => {
    const r = sortRecords([{ updatedAt: 1 }, { updatedAt: 3 }, { updatedAt: 2 }]);
    expect(r.map(x => x.updatedAt)).toEqual([3, 2, 1]);
  });
});

describe('context capture', () => {
  const base = { selector: 'button.cta', path: [{ tag: 'button', index: 0 }], label: 'button.cta' };
  const chain = { declared: 'var(--radius-md)', via: '.rounded-md', computed: '7px', hops: [], root: null, truncated: false, cyclic: false };

  it('attaches an edit chain under context.chains keyed by property', () => {
    const r = upsertEdit([], { ...base, property: 'border-radius', before: '7px', after: '20px',
      context: { chains: { 'border-radius': chain }, theme: undefined } }, 1);
    expect(r[0].context.chains['border-radius']).toEqual(chain);
  });

  it('merges a comment fragment onto an existing edit record without dropping chains', () => {
    let r = upsertEdit([], { ...base, property: 'border-radius', before: '7px', after: '20px',
      context: { chains: { 'border-radius': chain } } }, 1);
    r = setComment(r, { ...base, context: { layout: { display: 'flex' }, chains: {} } }, 'hi', 2);
    expect(r[0].context.chains['border-radius']).toEqual(chain); // survives
    expect(r[0].context.layout).toEqual({ display: 'flex' });    // added
  });

  it('mergeContext does not mutate its inputs', () => {
    const existing = { chains: { a: 1 } };
    const out = mergeContext(existing, { chains: { b: 2 }, bbox: { w: 1 } });
    expect(existing).toEqual({ chains: { a: 1 } });
    expect(out.chains).toEqual({ a: 1, b: 2 });
    expect(out.bbox).toEqual({ w: 1 });
  });

  it('mergeContext merges a locator fragment onto a record', () => {
    const existing = { chains: { a: 1 } };
    const locator = { text: 'Starter $9/mo', bbox: { w: 320, h: 445, x: 464, y: 139 }, matchCount: 1 };
    const out = mergeContext(existing, { chains: {}, locator });
    expect(out.locator).toEqual(locator);
  });
});

describe('setScope', () => {
  const base = { selector: 'button.cta', path: [{ tag: 'button', index: 0 }], label: 'button.cta' };

  it('sets scope on the keyed record without touching others', () => {
    let r = upsertEdit([], { ...base, property: 'padding', before: '1px', after: '2px' }, 1);
    r = upsertEdit(r, { selector: 'a.other', path: [{ tag: 'a', index: 0 }], property: 'color', before: 'x', after: 'y' }, 1);
    r = setScope(r, recordKey(base), 'similar', 2);
    const hit = r.find(x => recordKey(x) === recordKey(base));
    const other = r.find(x => x.selector === 'a.other');
    expect(hit.scope).toBe('similar');
    expect(hit.updatedAt).toBe(2);
    expect(other.scope).toBeUndefined();
  });

  it('does not mutate the input array', () => {
    const input = upsertEdit([], { ...base, property: 'padding', before: '1px', after: '2px' }, 1);
    setScope(input, recordKey(base), 'similar', 2);
    expect(input[0].scope).toBeUndefined();
  });
});
