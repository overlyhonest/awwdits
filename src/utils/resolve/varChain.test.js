// src/utils/resolve/varChain.test.js
import { describe, it, expect } from 'vitest';
import { resolveChain } from './varChain.js';

const S = { file: 'theme.css', line: 1 };
const mk = (map) => (name) => (name in map ? { text: map[name], source: S } : null);

describe('resolveChain', () => {
  it('walks a multi-hop chain in order', () => {
    const lookup = mk({ '--radius-md': 'calc(var(--radius) - 2px)', '--radius': '0.625rem' });
    const r = resolveChain('var(--radius-md)', lookup, { root: { value: '15px', source: S } });
    expect(r.hops.map(h => [h.name, h.value])).toEqual([
      ['--radius-md', 'calc(var(--radius) - 2px)'],
      ['--radius', '0.625rem'],
    ]);
    expect(r.cyclic).toBe(false);
    expect(r.truncated).toBe(false);
  });

  it('passes calc() through as text, never evaluated', () => {
    const lookup = mk({ '--radius-md': 'calc(var(--radius) - 2px)', '--radius': '0.625rem' });
    const r = resolveChain('var(--radius-md)', lookup, {});
    expect(r.hops[0].value).toBe('calc(var(--radius) - 2px)');
    expect(JSON.stringify(r)).not.toContain('7.375');
  });

  it('emits root only when a rem appears, echoing opts.root', () => {
    const remLookup = mk({ '--radius': '0.625rem' });
    const pxLookup = mk({ '--gap': '8px' });
    const root = { value: '15px', source: S };
    expect(resolveChain('var(--radius)', remLookup, { root }).root).toEqual(root);
    expect(resolveChain('var(--gap)', pxLookup, { root }).root).toBe(null);
  });

  it('terminates on a cycle and flags it', () => {
    const lookup = mk({ '--a': 'var(--b)', '--b': 'var(--a)' });
    const r = resolveChain('var(--a)', lookup, {});
    expect(r.hops.map(h => h.name)).toEqual(['--a', '--b']);
    expect(r.cyclic).toBe(true);
  });

  it('resolves var(--x, fallback) to the fallback when --x is missing', () => {
    const r = resolveChain('var(--gone, 4px)', mk({}), {});
    expect(r.hops).toEqual([{ name: '--gone (fallback)', value: '4px', source: { file: null, line: null } }]);
  });

  it('caps depth and flags truncation', () => {
    const lookup = mk({ '--1': 'var(--2)', '--2': 'var(--3)', '--3': 'var(--4)', '--4': 'var(--5)', '--5': '9px' });
    const r = resolveChain('var(--1)', lookup, { maxDepth: 3 });
    expect(r.hops).toHaveLength(3);
    expect(r.truncated).toBe(true);
  });

  it('returns no hops when the declaration has no var()', () => {
    expect(resolveChain('20px', mk({}), {}).hops).toEqual([]);
  });
});
