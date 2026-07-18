import { describe, it, expect } from 'vitest';
import { collectStyleRules, specificity, buildLookup, sourceForRule, matchedDeclaration } from './cssSource.js';

// --- fakes -------------------------------------------------------------
function rule(selectorText, decls, extra = {}) {
  const map = new Map(Object.entries(decls));
  return {
    selectorText,
    style: { getPropertyValue: (n) => map.get(n) ?? '' },
    ...extra,
  };
}
function sheet(rules) { return { cssRules: rules }; }
function throwingSheet() { return { get cssRules() { throw new Error('cross-origin'); } }; }
// element that matches a fixed set of selectors, with an optional parent chain
function el(selectors, parent = null) {
  return { matches: (s) => selectors.includes(s), parentElement: parent };
}

describe('specificity', () => {
  it('ranks id > class > type and counts classes', () => {
    expect(specificity('.a.b')[1]).toBe(2);
    expect(specificity('.a')[1]).toBe(1);
    expect(specificity('#x')[0]).toBe(1);
  });
});

describe('collectStyleRules', () => {
  it('skips a cross-origin sheet without aborting the scan', () => {
    const good = rule('.x', { '--v': '1px' });
    const rules = collectStyleRules([throwingSheet(), sheet([good])]);
    expect(rules).toContain(good);
  });
});

describe('buildLookup', () => {
  it('picks the higher-specificity declaration', () => {
    const e = el(['.a', '.a.b']);
    const lookup = buildLookup(e, { sheets: [sheet([
      rule('.a', { '--x': '2px' }),
      rule('.a.b', { '--x': '1px' }),
    ])] });
    expect(lookup('--x').text).toBe('1px');
  });

  it('breaks specificity ties by source order (later wins)', () => {
    const e = el(['.a']);
    const lookup = buildLookup(e, { sheets: [sheet([
      rule('.a', { '--x': 'first' }),
      rule('.a', { '--x': 'second' }),
    ])] });
    expect(lookup('--x').text).toBe('second');
  });

  it('inherits a definition from an ancestor (:root) the element does not match', () => {
    const root = el([':root']);
    const e = el(['.card'], root);
    const lookup = buildLookup(e, { sheets: [sheet([ rule(':root', { '--x': 'tok' }) ])] });
    expect(lookup('--x').text).toBe('tok');
  });

  it('returns null for an undefined variable', () => {
    const lookup = buildLookup(el(['.a']), { sheets: [sheet([ rule('.a', { color: 'red' }) ])] });
    expect(lookup('--nope')).toBe(null);
  });
});

describe('matchedDeclaration', () => {
  it('falls back to a var-based shorthand when a longhand is queried', () => {
    const e = el(['.rounded-md']);
    const md = matchedDeclaration(e, 'border-top-left-radius', { sheets: [sheet([
      rule('.rounded-md', { 'border-radius': 'var(--radius-md)' }),   // longhand not present; shorthand is var-backed
    ])] });
    expect(md).toEqual({ declared: 'var(--radius-md)', via: '.rounded-md', source: { file: null, line: null } });
  });
});

describe('sourceForRule', () => {
  it('derives file from data-vite-dev-id and line from <style> text', () => {
    const text = 'a{}\nb{}\n.rounded-md{border-radius:var(--radius-md)}';
    const r = rule('.rounded-md', { 'border-radius': 'var(--radius-md)' }, {
      ownerNodeText: text, ownerViteId: '/abs/path/theme.css', ruleText: '.rounded-md{border-radius:var(--radius-md)}',
    });
    expect(sourceForRule(r)).toEqual({ file: 'theme.css', line: 3 });
  });

  it('gives a linked sheet its filename but no line', () => {
    const r = rule('.a', { color: 'red' }, { href: 'https://x/assets/index-a3f2.css' });
    expect(sourceForRule(r)).toEqual({ file: 'index-a3f2.css', line: null });
  });

  it('resolves the line via selectorText even when source is spaced/multi-line', () => {
    const source = 'a {}\n\n.rounded-md {\n  border-radius: var(--radius-md);\n}';
    const r = rule('.rounded-md', { 'border-radius': 'var(--radius-md)' }, { cssText: '.rounded-md { border-radius: var(--radius-md); }' });
    const sheet = { ownerNode: { tagName: 'STYLE', textContent: source, getAttribute: (a) => a === 'data-vite-dev-id' ? '/abs/path/theme.css' : null }, cssRules: [r] };
    const [collected] = collectStyleRules([sheet]);          // runs attachOwner (reads ownerNode.textContent + getAttribute)
    expect(sourceForRule(collected)).toEqual({ file: 'theme.css', line: 3 });   // '.rounded-md' is on line 3
  });
});
