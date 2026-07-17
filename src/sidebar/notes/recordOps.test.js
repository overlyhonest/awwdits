import { describe, it, expect } from 'vitest';
import { upsertEdit, setComment, clearEdits, removeEmpty, sortRecords, recordKey } from './recordOps.js';

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
