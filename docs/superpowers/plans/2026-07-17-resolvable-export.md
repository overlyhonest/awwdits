# Resolvable Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the awwdits export resolve each changed/commented value back to the token declaration a developer would edit — reconstructing the `var()` chain from the CSS the page already ships — plus page-state and layout context, all additive and degrading to today's output.

**Architecture:** A pure, DOM-free resolver (`varChain`) walks `var()` references through declared CSS text supplied by an injectable CSSOM adapter (`cssSource`). A `pageState` module handles theme detection and the header; an `elementContext` orchestrator (content-script side) assembles a `context` fragment at edit/comment time. `recordOps` merges the fragment onto the record; `exportNotes` renders it. `exportNotes` and every resolver module stay pure so they test under vitest's `environment: 'node'` with no DOM dep.

**Tech Stack:** Vanilla JS (ES modules), React 18 (sidebar only), Vitest 0.34 (`environment: 'node'`), Chrome MV3 extension, Vite 4 build.

## Global Constraints

- **No new runtime deps** — do not add jsdom, happy-dom, or any package. Tests run in `environment: 'node'`; DOM-touching code is verified manually, pure logic is unit-tested.
- **Degrade, never fail** — any resolution failure drops that one detail and keeps the rest; the plain `before → after` leaf line is always present. The current output (now restyled to `## [n]` layout) is the floor.
- **Class-based selector line stays** — everything is additive to `## [n] <selector>`.
- **Plain text, copy-pasteable, diff-friendly** — chain rows align *within* a single chain block only (per-block `padEnd`), never across blocks, so one edit never reflows another block's columns.
- **Don't bloat the common case** — an untokenized page emits no `declared:`/`chain:`/`layout:` blocks; its export is the new heading layout + comment + plain edit lines, nothing more.
- **`calc()` is passed through as text, never evaluated.**
- **Chains read from CSS rule text, not computed style** — `getComputedStyle` returns the substituted leaf; the hop chain only exists in declared rule text. Computed style is the cross-check/fallback leaf.
- **Phase 1 only** — no task here touches blast-radius UI or component identity (Phase 2, proposal-only in the spec).

**Spec:** `docs/superpowers/specs/2026-07-17-resolvable-export-design.md`

---

## File Structure

- Create: `src/utils/resolve/varChain.js` — pure transitive `var()` walker.
- Create: `src/utils/resolve/varChain.test.js`
- Create: `src/utils/resolve/cssSource.js` — CSSOM adapter (lookup, matched declaration, source lines).
- Create: `src/utils/resolve/cssSource.test.js`
- Create: `src/utils/resolve/pageState.js` — theme detection + header.
- Create: `src/utils/resolve/pageState.test.js`
- Create: `src/utils/resolve/elementContext.js` — content-script orchestrator + pure summary helpers.
- Create: `src/utils/resolve/elementContext.test.js`
- Modify: `src/sidebar/notes/recordOps.js` — `mergeContext` on upsert/setComment.
- Modify: `src/sidebar/notes/recordOps.test.js`
- Modify: `src/sidebar/notes/exportNotes.js` — new layout + chain/context/theme rendering + 4-corner collapse + header.
- Modify: `src/sidebar/notes/exportNotes.test.js`
- Modify: `src/content/content-script.js` — capture on edit; pass pageState into `formatAll`; thread `context` on `CHANGE_APPLIED`.
- Modify: `src/content/comment-overlay.js` — capture on comment save.
- Modify: `src/sidebar/App.jsx` — thread `context` through `CHANGE_APPLIED` / `COMMENT_SAVED` handlers.

---

## Shared type shapes (referenced by every task)

```js
// SourceRef — where a rule/declaration lives. Either field may be null (degrade).
{ file: string | null, line: number | null }

// Hop — one step of a resolved var chain.
{ name: string, value: string, source: SourceRef }

// ChainResult — stored at context.chains[<kebab-prop>]; null means "not var-backed".
{
  declared: string,        // e.g. "var(--radius-md)"
  via: string,             // rule selector that declared it, e.g. ".rounded-md"
  computed: string,        // resolved leaf from getComputedStyle (used by paint-on-comment)
  hops: Hop[],             // [] when declared has no var()
  root: { value: string, source: SourceRef } | null,  // present iff a rem appears in the chain
  truncated: boolean,      // hit maxDepth
  cyclic: boolean,         // a var referenced itself
}

// Context — stored at record.context, merged across capture events.
{
  chains: { [kebabProp: string]: ChainResult | null },
  layout:  { display, flexDirection, gridTemplateColumns, gridTemplateRows, gap } | undefined,
  children:{ count: number, signature: string | null } | undefined,
  bbox:    { w: number, h: number, x: number, y: number } | undefined,
  theme:   { mode: 'light'|'dark', method: string, carrier: string|null, carrierSelector: string|null } | undefined,
}

// PageState — passed into formatAll by the content script (which has the DOM).
{ header: string, mode: 'light' | 'dark' | null }
```

---

## Task 1: `varChain.js` — pure transitive resolver

**Files:**
- Create: `src/utils/resolve/varChain.js`
- Test: `src/utils/resolve/varChain.test.js`

**Interfaces:**
- Consumes: nothing (pure). `lookup` is `(name: string) => { text: string, source: SourceRef } | null`.
- Produces: `resolveChain(declaredText, lookup, { root = null, maxDepth = 16 } = {})` → `{ hops: Hop[], root: (opts.root|null), truncated: boolean, cyclic: boolean }`. `root` echoes `opts.root` iff any hop value (or `declaredText`) contains `rem`, else `null`. Also exports `firstVarName(text)` and `parseVar(text)` helpers used by tests.

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/resolve/varChain.test.js`
Expected: FAIL — "Failed to resolve import ./varChain.js" / `resolveChain is not a function`.

- [ ] **Step 3: Write the implementation**

```js
// src/utils/resolve/varChain.js
// PURE transitive var() resolver. Given a declared CSS value and a lookup that returns the
// declared text of any custom property, reconstruct the chain of hops from token to leaf.
// Knows nothing about the DOM — the caller binds `lookup` to an element. calc() and other
// non-var text pass through verbatim; nested var() inside them is still followed.
const NO_SOURCE = Object.freeze({ file: null, line: null });

// The first var(...) reference in `text`, split into name + optional fallback.
// "calc(var(--radius) - 2px)" -> { name: '--radius', fallback: null }
// "var(--gone, 4px)"          -> { name: '--gone', fallback: '4px' }
export function parseVar(text) {
  const i = text.indexOf('var(');
  if (i === -1) return null;
  // Walk to the matching close paren of this var( to capture a possibly-nested fallback.
  let depth = 0, end = -1;
  for (let j = i + 3; j < text.length; j++) {
    if (text[j] === '(') depth++;
    else if (text[j] === ')') { depth--; if (depth === 0) { end = j; break; } }
  }
  if (end === -1) return null;
  const inner = text.slice(i + 4, end); // between 'var(' and its ')'
  const comma = splitTopComma(inner);
  return { name: comma.head.trim(), fallback: comma.tail === null ? null : comma.tail.trim() };
}

// Split on the first top-level comma (ignoring commas inside nested parens).
function splitTopComma(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) return { head: s.slice(0, i), tail: s.slice(i + 1) };
  }
  return { head: s, tail: null };
}

export function firstVarName(text) {
  const p = parseVar(text);
  return p ? p.name : null;
}

export function resolveChain(declaredText, lookup, { root = null, maxDepth = 16 } = {}) {
  const hops = [];
  const seen = new Set();
  let cyclic = false, truncated = false;
  let text = declaredText;

  while (true) {
    const parsed = parseVar(text);
    if (!parsed) break;                       // no more var() references to follow
    if (hops.length >= maxDepth) { truncated = true; break; }
    if (seen.has(parsed.name)) { cyclic = true; break; }
    seen.add(parsed.name);

    const found = lookup(parsed.name);
    if (found) {
      hops.push({ name: parsed.name, value: found.text, source: found.source || NO_SOURCE });
      text = found.text;                      // follow into the resolved value (may hold var())
    } else if (parsed.fallback !== null) {
      hops.push({ name: `${parsed.name} (fallback)`, value: parsed.fallback, source: NO_SOURCE });
      text = parsed.fallback;                  // follow into the fallback (may itself hold var())
    } else {
      break;                                   // unresolvable and no fallback — chain ends here
    }
  }

  const hasRem = /[\d.]rem\b/.test(declaredText) || hops.some(h => /[\d.]rem\b/.test(h.value));
  return { hops, root: hasRem ? root : null, truncated, cyclic };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/resolve/varChain.test.js`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add src/utils/resolve/varChain.js src/utils/resolve/varChain.test.js
git commit -m "feat(resolve): pure transitive var() chain resolver"
```

---

## Task 2: `cssSource.js` — CSSOM adapter

**Files:**
- Create: `src/utils/resolve/cssSource.js`
- Test: `src/utils/resolve/cssSource.test.js`

**Interfaces:**
- Consumes: `SourceRef` shape from Task 1; produces a `lookup` compatible with `resolveChain`.
- Produces:
  - `buildLookup(el, { sheets = document.styleSheets } = {})` → `(name) => { text, source } | null`.
  - `matchedDeclaration(el, kebabProp, { sheets = document.styleSheets } = {})` → `{ declared, via, source } | null` (only when the winning author declaration's value contains `var(`).
  - `sourceForRule(rule)` → `SourceRef`.
  - `rootFontSizeSource({ sheets = document.styleSheets } = {})` → `{ value, source }`.
  - `collectStyleRules(sheets)` → `CSSStyleRule[]` in document order (descends into media/layer rules). Exported for tests.
  - `specificity(selectorText)` → `[a, b, c]`. Exported for tests.

**Fake-sheet test shape** (no DOM): a "sheet" is `{ cssRules: Rule[] }` or an object whose `cssRules` getter throws (cross-origin). A "rule" is `{ selectorText, style, ownerNodeText?, href? }` where `style` supports `getPropertyValue(name)` and iteration. A "fake element" is `{ matches(sel), parentElement }`.

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/resolve/cssSource.test.js
import { describe, it, expect } from 'vitest';
import { collectStyleRules, specificity, buildLookup, sourceForRule } from './cssSource.js';

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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/resolve/cssSource.test.js`
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Write the implementation**

```js
// src/utils/resolve/cssSource.js
// CSSOM adapter: turns document.styleSheets into a per-element custom-property lookup and
// resolves each rule to a { file, line } source. All DOM/CSSOM access is here so varChain
// stays pure. Everything is defensive — a cross-origin sheet, a missing ownerNode, or an
// unparseable rule degrades to less detail, never throws.

// Rough (a,b,c) specificity: ids, then classes/attrs/pseudo-classes, then type selectors.
export function specificity(sel) {
  const a = (sel.match(/#[\w-]+/g) || []).length;
  const b = (sel.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) || []).length;
  const c = (sel.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return [a, b, c];
}
function cmpSpec(x, y) { return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; }

// Flatten every CSSStyleRule in document order, descending into media/supports/layer blocks.
export function collectStyleRules(sheets) {
  const out = [];
  for (const sheet of sheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin — skip this sheet
    if (!rules) continue;
    walk(rules, out, sheet);
  }
  return out;
}
function walk(rules, out, sheet) {
  for (const r of rules) {
    if (r.selectorText && r.style) {
      if (sheet && r.ownerNodeText === undefined) attachOwner(r, sheet);
      out.push(r);
    } else if (r.cssRules) {
      walk(r.cssRules, out, sheet);           // @media / @supports / @layer block
    }
  }
}
// In the real DOM, rules don't carry their sheet's ownerNode text/href; attach it so
// sourceForRule can read it. In tests, rules already carry ownerNodeText/href/ownerViteId.
function attachOwner(r, sheet) {
  try {
    const node = sheet.ownerNode;
    if (node && node.tagName === 'STYLE') {
      r.ownerNodeText = node.textContent || '';
      r.ownerViteId = node.getAttribute('data-vite-dev-id') || null;
    } else if (sheet.href) {
      r.href = sheet.href;
    }
    if (r.ruleText === undefined) r.ruleText = r.cssText;
  } catch { /* leave undefined — sourceForRule degrades */ }
}

const basename = (p) => (p ? p.split(/[\\/]/).pop().split('?')[0] : null);

export function sourceForRule(rule) {
  try {
    if (rule.ownerNodeText != null) {
      const file = basename(rule.ownerViteId) || null;
      const idx = rule.ruleText ? rule.ownerNodeText.indexOf(rule.ruleText) : -1;
      const line = idx >= 0 ? rule.ownerNodeText.slice(0, idx).split('\n').length : null;
      return { file, line };
    }
    if (rule.href) return { file: basename(rule.href), line: null };
  } catch { /* fall through */ }
  return { file: null, line: null };
}

// Ancestor chain [el, parent, ..., root]; index 0 = the element itself (closest wins).
function chainOf(el) {
  const chain = [];
  for (let n = el; n; n = n.parentElement) chain.push(n);
  return chain;
}

// A candidate is a rule declaring `name` that matches some element in the chain.
// Winner: closest chain element (smallest index), then highest specificity, then source order.
function winner(rules, chain, name) {
  let best = null;
  rules.forEach((r, order) => {
    const val = r.style.getPropertyValue(name);
    if (!val) return;
    let idx = -1;
    for (let i = 0; i < chain.length; i++) {
      try { if (chain[i].matches(r.selectorText)) { idx = i; break; } } catch { /* bad selector */ }
    }
    if (idx === -1) return;
    const cand = { idx, spec: specificity(r.selectorText), order, rule: r, val: val.trim() };
    if (!best || cand.idx < best.idx ||
        (cand.idx === best.idx && (cmpSpec(cand.spec, best.spec) > 0 ||
          (cmpSpec(cand.spec, best.spec) === 0 && cand.order > best.order)))) best = cand;
  });
  return best;
}

export function buildLookup(el, { sheets = document.styleSheets } = {}) {
  const rules = collectStyleRules(sheets);
  const chain = chainOf(el);
  return (name) => {
    const w = winner(rules, chain, name);
    return w ? { text: w.val, source: sourceForRule(w.rule) } : null;
  };
}

// The winning author declaration of a normal (non-custom) property ON the element itself,
// but only when its value is var-backed (otherwise there is no chain to reconstruct).
export function matchedDeclaration(el, kebabProp, { sheets = document.styleSheets } = {}) {
  const rules = collectStyleRules(sheets);
  const w = winner(rules, [el], kebabProp);
  if (!w || !w.val.includes('var(')) return null;
  return { declared: w.val, via: w.rule.selectorText, source: sourceForRule(w.rule) };
}

export function rootFontSizeSource({ sheets = document.styleSheets } = {}) {
  const value = (typeof document !== 'undefined')
    ? getComputedStyle(document.documentElement).fontSize : null;
  const rules = collectStyleRules(sheets);
  let hit = null;
  for (const r of rules) {
    let sel; try { sel = r.selectorText; } catch { continue; }
    if (/(^|[\s,])(:root|html)(\s|,|$)/.test(sel) && r.style.getPropertyValue('font-size')) hit = r;
  }
  return { value, source: hit ? sourceForRule(hit) : { file: null, line: null } };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/resolve/cssSource.test.js`
Expected: PASS (8 passed).

- [ ] **Step 5: Commit**

```bash
git add src/utils/resolve/cssSource.js src/utils/resolve/cssSource.test.js
git commit -m "feat(resolve): CSSOM adapter — per-element var lookup + source lines"
```

---

## Task 3: `pageState.js` — theme detection + header

**Files:**
- Create: `src/utils/resolve/pageState.js`
- Test: `src/utils/resolve/pageState.test.js`

**Interfaces:**
- Consumes: nothing pure. `detectThemeFromChain` takes a plain ancestor descriptor array.
- Produces:
  - `detectThemeFromChain(chain, { prefersDark, hasMediaRule })` → `{ mode, method, carrier, carrierSelector } | null`. `chain` is `[{ selector, classList: string[], attrs: {..} }]` from element upward.
  - `pageHeader({ url, viewport: { w, h }, date, theme })` → string. `theme` is `{ mode, method } | null`.
  - `sheetsHavePrefersColorScheme(sheets)` → boolean (scans `@media` rule text). Exported for the DOM caller and tests.

Carrier detection: an element is a theme carrier if it has class `dark`/`light`, or attribute `data-theme`/`data-mode` with a `light`/`dark` value. Nearest carrier in the chain wins over the media query.

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/resolve/pageState.test.js
import { describe, it, expect } from 'vitest';
import { detectThemeFromChain, pageHeader } from './pageState.js';

const node = (selector, classList = [], attrs = {}) => ({ selector, classList, attrs });

describe('detectThemeFromChain', () => {
  it('reads an explicit .dark carrier', () => {
    const chain = [node('button.cta'), node('div.preview', ['dark'])];
    expect(detectThemeFromChain(chain, { prefersDark: false, hasMediaRule: false }))
      .toEqual({ mode: 'dark', method: 'carrier:.dark', carrier: '.dark', carrierSelector: 'div.preview' });
  });

  it('reads a data-theme carrier', () => {
    const chain = [node('a'), node('html', [], { 'data-theme': 'dark' })];
    const r = detectThemeFromChain(chain, { prefersDark: false, hasMediaRule: false });
    expect(r.mode).toBe('dark');
    expect(r.method).toBe('carrier:[data-theme=dark]');
  });

  it('falls back to prefers-color-scheme when a media rule exists and no carrier', () => {
    const chain = [node('a'), node('body')];
    expect(detectThemeFromChain(chain, { prefersDark: true, hasMediaRule: true }))
      .toEqual({ mode: 'dark', method: 'prefers-color-scheme', carrier: null, carrierSelector: null });
  });

  it('returns null (omit, never guess) with no carrier and no media rule', () => {
    expect(detectThemeFromChain([node('a')], { prefersDark: true, hasMediaRule: false })).toBe(null);
  });

  it('prefers the nearest carrier over a media query', () => {
    const chain = [node('span'), node('div.card', ['light'])];
    const r = detectThemeFromChain(chain, { prefersDark: true, hasMediaRule: true });
    expect(r.mode).toBe('light');
    expect(r.method).toBe('carrier:.light');
  });
});

describe('pageHeader', () => {
  it('includes the mode segment when theme is present', () => {
    const h = pageHeader({ url: 'http://localhost:5173/', viewport: { w: 1440, h: 900 }, date: '2026-07-17',
      theme: { mode: 'light', method: 'prefers-color-scheme' } });
    expect(h).toBe('# awwdits · http://localhost:5173/ · light mode (prefers-color-scheme) · 1440×900 · 2026-07-17');
  });

  it('omits the mode segment entirely when theme is null', () => {
    const h = pageHeader({ url: 'http://x/', viewport: { w: 800, h: 600 }, date: '2026-07-17', theme: null });
    expect(h).toBe('# awwdits · http://x/ · 800×600 · 2026-07-17');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/resolve/pageState.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// src/utils/resolve/pageState.js
// Theme detection + export header. The pure core (detectThemeFromChain, pageHeader) is
// tested without a DOM; the DOM readers (readAncestorChain, detectTheme, currentPageState)
// are thin wrappers used by the content script.

// chain: [{ selector, classList:[...], attrs:{...} }] from the element upward.
export function detectThemeFromChain(chain, { prefersDark, hasMediaRule }) {
  for (const n of chain) {
    if (n.classList.includes('dark')) return carrier('dark', '.dark', n.selector);
    if (n.classList.includes('light')) return carrier('light', '.light', n.selector);
    for (const key of ['data-theme', 'data-mode']) {
      const v = n.attrs && n.attrs[key];
      if (v === 'dark' || v === 'light') return carrier(v, `[${key}=${v}]`, n.selector);
    }
  }
  if (hasMediaRule) {
    return { mode: prefersDark ? 'dark' : 'light', method: 'prefers-color-scheme', carrier: null, carrierSelector: null };
  }
  return null; // omit rather than guess
}
function carrier(mode, sel, carrierSelector) {
  return { mode, method: `carrier:${sel}`, carrier: sel, carrierSelector };
}

export function pageHeader({ url, viewport: { w, h }, date, theme }) {
  const parts = ['# awwdits', url];
  if (theme) parts.push(`${theme.mode} mode (${theme.method})`);
  parts.push(`${w}×${h}`, date);
  return parts.join(' · ');
}

export function sheetsHavePrefersColorScheme(sheets) {
  for (const sheet of sheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    for (const r of rules) {
      try { if (r.media && /prefers-color-scheme/.test(r.conditionText || r.media.mediaText || '')) return true; }
      catch { /* ignore */ }
    }
  }
  return false;
}

// ----- DOM readers (thin; not unit-tested) -----
export function readAncestorChain(el) {
  const chain = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    chain.push({
      selector: descriptor(n),
      classList: Array.from(n.classList || []),
      attrs: { 'data-theme': n.getAttribute?.('data-theme'), 'data-mode': n.getAttribute?.('data-mode') },
    });
  }
  return chain;
}
function descriptor(n) {
  const tag = n.tagName.toLowerCase();
  const cls = Array.from(n.classList || []).filter(c => !c.includes(':')).slice(0, 2);
  return cls.length ? `${tag}.${cls.join('.')}` : tag;
}

export function detectTheme(el, { sheets = document.styleSheets } = {}) {
  const prefersDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  const hasMediaRule = sheetsHavePrefersColorScheme(sheets);
  return detectThemeFromChain(readAncestorChain(el), { prefersDark, hasMediaRule });
}

// Page-level state for the header. `date` is 'YYYY-MM-DD' from the caller.
export function currentPageState(date, { sheets = document.styleSheets } = {}) {
  const rootTheme = detectTheme(document.documentElement, { sheets });
  const header = pageHeader({
    url: location.href,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    date,
    theme: rootTheme,
  });
  return { header, mode: rootTheme ? rootTheme.mode : null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/resolve/pageState.test.js`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add src/utils/resolve/pageState.js src/utils/resolve/pageState.test.js
git commit -m "feat(resolve): theme detection + export header (omit, never guess)"
```

---

## Task 4: `elementContext.js` — capture orchestrator + pure summary helpers

**Files:**
- Create: `src/utils/resolve/elementContext.js`
- Test: `src/utils/resolve/elementContext.test.js`

**Interfaces:**
- Consumes: `matchedDeclaration`, `buildLookup`, `rootFontSizeSource` (Task 2); `resolveChain` (Task 1); `detectTheme` (Task 3).
- Produces:
  - `summarizeChildren(kids)` → `{ count, signature }` where `kids` is `[{ tag, classes: string[] }]`. **Pure, tested.**
  - `childSignature(kid)` → string. **Pure, tested.**
  - `resolveProp(el, kebabProp, { sheets })` → `ChainResult | null`. DOM-touching (thin), not unit-tested.
  - `captureForEdit(el, kebabProp, { sheets })` → `{ chains, theme }`. DOM glue.
  - `captureForComment(el, { sheets })` → `{ chains, layout, children, bbox, theme }`. DOM glue.

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/resolve/elementContext.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/resolve/elementContext.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```js
// src/utils/resolve/elementContext.js
// Content-script orchestrator: assembles the `context` fragment captured at edit/comment
// time. The child-summary logic is pure (tested); the rest is thin DOM glue over the
// resolver modules. Every DOM read is best-effort — a failure yields a smaller fragment,
// never an exception into the capture path.
import { resolveChain } from './varChain.js';
import { matchedDeclaration, buildLookup, rootFontSizeSource } from './cssSource.js';
import { detectTheme } from './pageState.js';

const PAINT_PROPS = ['background-color', 'color', 'border-color'];

export function childSignature(kid) {
  const cls = (kid.classes || []).filter(c => !c.includes(':')).slice(0, 3);
  return cls.length ? `${kid.tag}.${cls.join('.')}` : kid.tag;
}

export function summarizeChildren(kids) {
  if (!kids.length) return { count: 0, signature: null };
  const sigs = kids.map(childSignature);
  if (sigs.every(s => s === sigs[0])) return { count: kids.length, signature: sigs[0] };
  if (kids.every(k => k.tag === kids[0].tag)) return { count: kids.length, signature: kids[0].tag };
  return { count: kids.length, signature: null };
}

// Resolve one property on an element to a ChainResult, or null when it isn't var-backed.
export function resolveProp(el, kebabProp, { sheets = document.styleSheets } = {}) {
  try {
    const md = matchedDeclaration(el, kebabProp, { sheets });
    if (!md) return null;
    const lookup = buildLookup(el, { sheets });
    const root = rootFontSizeSource({ sheets });
    const chain = resolveChain(md.declared, lookup, { root });
    return {
      declared: md.declared, via: md.via,
      computed: getComputedStyle(el).getPropertyValue(kebabProp).trim(),
      hops: chain.hops, root: chain.root, truncated: chain.truncated, cyclic: chain.cyclic,
    };
  } catch { return null; }
}

export function captureForEdit(el, kebabProp, { sheets = document.styleSheets } = {}) {
  const chains = {}; chains[kebabProp] = resolveProp(el, kebabProp, { sheets });
  return { chains, theme: safeTheme(el, sheets) };
}

export function captureForComment(el, { sheets = document.styleSheets } = {}) {
  const theme = safeTheme(el, sheets);
  const chains = {};
  for (const p of PAINT_PROPS) { const c = resolveProp(el, p, { sheets }); if (c) chains[p] = c; }
  try {
    const cs = getComputedStyle(el);
    const isGrid = cs.display.includes('grid');
    const layout = {
      display: cs.display,
      flexDirection: (!isGrid && cs.display.includes('flex')) ? cs.flexDirection : null,
      gridTemplateColumns: isGrid && cs.gridTemplateColumns !== 'none' ? cs.gridTemplateColumns : null,
      gridTemplateRows: isGrid && cs.gridTemplateRows !== 'none' ? cs.gridTemplateRows : null,
      gap: (cs.gap && cs.gap !== 'normal' && cs.gap !== '0px') ? cs.gap : null,
    };
    const kids = Array.from(el.children).map(c => ({ tag: c.tagName.toLowerCase(), classes: Array.from(c.classList) }));
    const r = el.getBoundingClientRect();
    const bbox = { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
    return { chains, layout, children: summarizeChildren(kids), bbox, theme };
  } catch {
    return { chains, theme };   // degrade: layout/children/bbox omitted, capture never throws
  }
}

function safeTheme(el, sheets) {
  try { return detectTheme(el, { sheets }) || undefined; } catch { return undefined; }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/resolve/elementContext.test.js`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add src/utils/resolve/elementContext.js src/utils/resolve/elementContext.test.js
git commit -m "feat(resolve): element-context capture orchestrator + child summary"
```

---

## Task 5: `recordOps` — merge context onto records

**Files:**
- Modify: `src/sidebar/notes/recordOps.js`
- Test: `src/sidebar/notes/recordOps.test.js`

**Interfaces:**
- Consumes: `Context` fragment shape.
- Produces: `upsertEdit(records, { ..., context }, now)` and `setComment(records, { selector, path, label, context }, text, now)` now merge `context` onto `record.context` via a new exported `mergeContext(existing, fragment)` → new context object (never mutates inputs).

- [ ] **Step 1: Write the failing tests** (append to `recordOps.test.js`)

```js
// append to src/sidebar/notes/recordOps.test.js
import { mergeContext } from './recordOps.js';

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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/sidebar/notes/recordOps.test.js`
Expected: FAIL — `mergeContext` not exported; `context` not attached.

- [ ] **Step 3: Write the implementation**

In `src/sidebar/notes/recordOps.js`, add the `mergeContext` export and call it from both mutators. Add after `ensureRecord`:

```js
// Merge a captured context fragment onto a record's context. Returns a NEW context object
// (chains shallow-merged, scalar fields overwritten) so cloned records never share state
// with their inputs.
export function mergeContext(existing, fragment) {
  if (!fragment) return existing;
  const next = { ...(existing || {}), chains: { ...((existing && existing.chains) || {}), ...(fragment.chains || {}) } };
  for (const k of ['layout', 'children', 'bbox', 'theme']) {
    if (fragment[k] !== undefined) next[k] = fragment[k];
  }
  return next;
}
```

Then in `upsertEdit`, after the existing edit-merge logic and before `rec.updatedAt = now;`, add:

```js
  if (arguments[1].context) rec.context = mergeContext(rec.context, arguments[1].context);
```

(Use the destructured param instead for clarity — change the signature to include `context`:)

```js
export function upsertEdit(records, { selector, path, label, property, before, after, context }, now = Date.now()) {
  const next = cloneRecords(records);
  const rec = ensureRecord(next, { selector, path, label }, now);
  const existing = rec.edits.find(e => e.property === property);
  if (existing) existing.after = after;
  else rec.edits.push({ property, before, after });
  rec.edits = rec.edits.filter(e => e.after !== e.before);
  if (!rec.path || !rec.path.length) rec.path = path || [];
  if (context) rec.context = mergeContext(rec.context, context);
  rec.updatedAt = now;
  return next;
}
```

And `setComment`:

```js
export function setComment(records, { selector, path, label, context }, text, now = Date.now()) {
  const next = cloneRecords(records);
  const rec = ensureRecord(next, { selector, path, label }, now);
  rec.comment = text;
  if (context) rec.context = mergeContext(rec.context, context);
  rec.updatedAt = now;
  return next;
}
```

Update `cloneRecords` to carry `context` forward (shallow copy is fine; `mergeContext` never mutates it):

```js
function cloneRecords(records) {
  return records.map(r => ({ ...r, edits: (r.edits || []).map(e => ({ ...e })) }));
}
```

(No change needed — `{ ...r }` already copies the `context` reference, and `mergeContext` replaces it with a fresh object rather than mutating.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/sidebar/notes/recordOps.test.js`
Expected: PASS (all prior + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/sidebar/notes/recordOps.js src/sidebar/notes/recordOps.test.js
git commit -m "feat(notes): merge captured context onto records"
```

---

## Task 6: `exportNotes` — new layout, chains, context, theme, 4-corner collapse, header

**Files:**
- Modify: `src/sidebar/notes/exportNotes.js`
- Test: `src/sidebar/notes/exportNotes.test.js`

**Interfaces:**
- Consumes: `record.context` (Task 5 shape), `PageState`.
- Produces: `formatAll(records, pageState = null)` → string; `formatRecord(record, index, pageMode = null)` → string. `index` is 1-based.

**Layout rules (locked by tests):**
- Heading `## [<index>] <selector>`.
- Per-record theme line `    theme:  <mode>  (via <carrier> on <carrierSelector>)` only when `record.context.theme` exists and its `mode` differs from `pageMode`.
- Comment `    Comment: "<text>"`.
- Comment context (only when the record has a comment and the fields exist): `    layout:  <formatLayout>`, `    children:  <count> × <signature>` (or `    children:  <count>` when signature is null; omitted when count 0), `    bbox:  <w>×<h> @ (<x>,<y>)`.
- Paint chains on comment: for `background-color`/`color`/`border-color` present in `context.chains`, emit `      <prop>: <computed>` then the chain block at indent 8.
- Edits: `    <prop>: <before> → <after>`; then, if `context.chains[<prop>]` is a non-null ChainResult, the chain block at indent 6.
- 4-corner collapse: the four corner longhands with identical before and identical after collapse to `    border-radius: <before> → <after>  (4 corners)` plus one chain block (from any present corner's chain).
- Chain block (`renderChainBlock(chain, indent)`): `<indent>declared:  <declared>  via <via>` then `<indent>chain:     <name> = <value>  <src>` with continuation lines indented to align the names, a `root = <value>  <src>` row when `chain.root`, and `… (cycle)` / `… (chain depth capped)` markers. Source string is `file:line` / `file` / `''`. Rows within one block are `padEnd`-aligned to each other only.

- [ ] **Step 1: Rewrite the tests** (replace the whole file)

```js
// src/sidebar/notes/exportNotes.test.js
import { describe, it, expect } from 'vitest';
import { formatRecord, formatAll } from './exportNotes.js';

const S = (file, line) => ({ file, line });

describe('formatRecord — floor (untokenized)', () => {
  it('numbered heading + comment + plain indented edits, no context blocks', () => {
    const out = formatRecord({
      selector: 'button.cta', comment: 'tighten padding',
      edits: [{ property: 'padding', before: '12px', after: '8px' }],
    }, 1);
    expect(out).toBe('## [1] button.cta\n    Comment: "tighten padding"\n    padding: 12px → 8px');
  });

  it('comment-only record', () => {
    expect(formatRecord({ selector: 'nav a', comment: 'off-brand', edits: [] }, 2))
      .toBe('## [2] nav a\n    Comment: "off-brand"');
  });

  it('edits-only record (no comment line)', () => {
    expect(formatRecord({ selector: '.hero h1', comment: '', edits: [{ property: 'line-height', before: '1.1', after: '1.3' }] }, 1))
      .toBe('## [1] .hero h1\n    line-height: 1.1 → 1.3');
  });
});

describe('formatRecord — resolved chain (item 1)', () => {
  it('renders declared + chain + root with sources', () => {
    const rec = {
      selector: 'button.inline-flex.items-center.justify-center', comment: '',
      edits: [
        { property: 'border-top-left-radius', before: '7.375px', after: '20px' },
        { property: 'border-top-right-radius', before: '7.375px', after: '20px' },
        { property: 'border-bottom-right-radius', before: '7.375px', after: '20px' },
        { property: 'border-bottom-left-radius', before: '7.375px', after: '20px' },
      ],
      context: { chains: { 'border-top-left-radius': {
        declared: 'var(--radius-md)', via: '.rounded-md', computed: '7.375px',
        hops: [
          { name: '--radius-md', value: 'calc(var(--radius) - 2px)', source: S('theme.css', 109) },
          { name: '--radius', value: '0.625rem', source: S('theme.css', 33) },
        ],
        root: { value: '15px', source: S('theme.css', 337) }, truncated: false, cyclic: false,
      } } },
    };
    expect(formatRecord(rec, 1)).toBe(
`## [1] button.inline-flex.items-center.justify-center
    border-radius: 7.375px → 20px  (4 corners)
      declared:  var(--radius-md)  via .rounded-md
      chain:     --radius-md = calc(var(--radius) - 2px)  theme.css:109
                 --radius = 0.625rem  theme.css:33
                 root = 15px  theme.css:337`);
  });
});

describe('formatRecord — 4-corner collapse', () => {
  const corners = (before, after) => [
    { property: 'border-top-left-radius', before, after },
    { property: 'border-top-right-radius', before, after },
    { property: 'border-bottom-right-radius', before, after },
    { property: 'border-bottom-left-radius', before, after },
  ];
  it('collapses four identical corners to one line', () => {
    const out = formatRecord({ selector: 'div', comment: '', edits: corners('4px', '8px') }, 1);
    expect(out).toBe('## [1] div\n    border-radius: 4px → 8px  (4 corners)');
  });
  it('does not collapse when afters differ', () => {
    const edits = corners('4px', '8px'); edits[1].after = '12px';
    const out = formatRecord({ selector: 'div', comment: '', edits }, 1);
    expect(out.split('\n')).toHaveLength(5); // heading + 4 corner lines
  });
});

describe('formatRecord — comment context (items 2 & 3)', () => {
  it('renders layout/children/bbox and a var-backed paint chain', () => {
    const rec = {
      selector: 'div.bg-card.text-card-foreground.flex', comment: 'bg can be more darker', edits: [],
      context: {
        layout: { display: 'flex', flexDirection: 'column', gridTemplateColumns: null, gridTemplateRows: null, gap: '24px' },
        children: { count: 3, signature: 'div' }, bbox: { w: 384, h: 212, x: 64, y: 140 },
        chains: { 'background-color': {
          declared: 'var(--card)', via: '.bg-card', computed: 'oklch(0.21 0 0)',
          hops: [{ name: '--card', value: 'oklch(0.21 0 0)', source: S('theme.css', 71) }],
          root: null, truncated: false, cyclic: false,
        } },
      },
    };
    expect(formatRecord(rec, 2)).toBe(
`## [2] div.bg-card.text-card-foreground.flex
    Comment: "bg can be more darker"
      layout:    display:flex; flex-direction:column; gap:24px
      children:  3 × div
      bbox:      384×212 @ (64,140)
      background-color: oklch(0.21 0 0)
        declared:  var(--card)  via .bg-card
        chain:     --card = oklch(0.21 0 0)  theme.css:71`);
  });

  it('renders a bare-div comment with layout only', () => {
    const rec = {
      selector: 'div', comment: 'try out verical column arrangement for the colors,', edits: [],
      context: {
        layout: { display: 'flex', flexDirection: 'row', gridTemplateColumns: null, gridTemplateRows: null, gap: '8px' },
        children: { count: 11, signature: 'div.h-8.w-8.rounded-full' }, bbox: { w: 320, h: 32, x: 612, y: 480 }, chains: {},
      },
    };
    expect(formatRecord(rec, 3)).toBe(
`## [3] div
    Comment: "try out verical column arrangement for the colors,"
      layout:    display:flex; flex-direction:row; gap:8px
      children:  11 × div.h-8.w-8.rounded-full
      bbox:      320×32 @ (612,480)`);
  });
});

describe('formatRecord — degradation markers & theme', () => {
  it('marks a cyclic chain and omits missing source columns', () => {
    const rec = { selector: 'a', comment: '', edits: [{ property: 'color', before: 'x', after: 'y' }],
      context: { chains: { color: { declared: 'var(--a)', via: '.a', computed: 'y',
        hops: [{ name: '--a', value: 'var(--b)', source: { file: null, line: null } }], root: null, truncated: false, cyclic: true } } } };
    expect(formatRecord(rec, 1)).toBe(
`## [1] a
    color: x → y
      declared:  var(--a)  via .a
      chain:     --a = var(--b)
                 … (cycle)`);
  });

  it('emits a per-record theme line only when it differs from the page', () => {
    const rec = { selector: 'button', comment: '', edits: [{ property: 'color', before: 'x', after: 'y' }],
      context: { theme: { mode: 'dark', method: 'carrier:.dark', carrier: '.dark', carrierSelector: 'div.preview' } } };
    expect(formatRecord(rec, 1, 'light')).toBe(
`## [1] button
    theme:  dark  (via .dark on div.preview)
    color: x → y`);
    expect(formatRecord(rec, 1, 'dark')).toBe('## [1] button\n    color: x → y'); // agrees → silent
  });
});

describe('formatAll', () => {
  it('prepends the header and numbers records', () => {
    const out = formatAll(
      [{ selector: 'a', comment: 'x', edits: [] }, { selector: 'b', comment: 'y', edits: [] }],
      { header: '# awwdits · http://x/ · 800×600 · 2026-07-17', mode: null });
    expect(out).toBe('# awwdits · http://x/ · 800×600 · 2026-07-17\n\n## [1] a\n    Comment: "x"\n\n## [2] b\n    Comment: "y"');
  });
  it('omits the header when pageState is null', () => {
    const out = formatAll([{ selector: 'a', comment: 'x', edits: [] }]);
    expect(out).toBe('## [1] a\n    Comment: "x"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/sidebar/notes/exportNotes.test.js`
Expected: FAIL — old `formatRecord` signature/output.

- [ ] **Step 3: Rewrite `exportNotes.js`**

```js
// src/sidebar/notes/exportNotes.js
// Render notes records to LLM-friendly plain text. Additive to the class-based selector
// line: when a record carries captured `context`, we also emit the resolved var() chain
// (token → leaf, with sources), page/element theme, and layout context for comments.
// Everything degrades — a record with no context renders as heading + comment + plain edits.
// Pure: no DOM. The page-state header is passed in by the (DOM-having) caller.
const CORNERS = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'];
const PAINT_PROPS = ['background-color', 'color', 'border-color'];

export function formatAll(records, pageState = null) {
  const body = records.map((r, i) => formatRecord(r, i + 1, pageState ? pageState.mode : null)).join('\n\n');
  return pageState && pageState.header ? `${pageState.header}\n\n${body}` : body;
}

export function formatRecord(record, index, pageMode = null) {
  const ctx = record.context || {};
  const lines = [`## [${index}] ${record.selector}`];

  if (ctx.theme && ctx.theme.mode !== pageMode) {
    lines.push(`    theme:  ${ctx.theme.mode}  (via ${ctx.theme.carrier} on ${ctx.theme.carrierSelector})`);
  }

  const comment = record.comment && record.comment.trim();
  if (comment) lines.push(`    Comment: "${comment}"`);

  // Comment context block (only meaningful for commented elements).
  if (comment && ctx.layout) lines.push(...formatCommentContext(ctx));

  // Edits, with 4-corner collapse and per-edit chain blocks.
  lines.push(...formatEdits(record.edits || [], ctx.chains || {}));

  return lines.join('\n');
}

function formatCommentContext(ctx) {
  const out = [];
  out.push(`      layout:    ${formatLayout(ctx.layout)}`);
  if (ctx.children && ctx.children.count > 0) {
    out.push(`      children:  ${ctx.children.signature ? `${ctx.children.count} × ${ctx.children.signature}` : ctx.children.count}`);
  }
  if (ctx.bbox) out.push(`      bbox:      ${ctx.bbox.w}×${ctx.bbox.h} @ (${ctx.bbox.x},${ctx.bbox.y})`);
  for (const p of PAINT_PROPS) {
    const chain = ctx.chains && ctx.chains[p];
    if (!chain) continue;
    out.push(`      ${p}: ${chain.computed}`);
    out.push(...renderChainBlock(chain, 8));
  }
  return out;
}

export function formatLayout(l) {
  const parts = [`display:${l.display}`];
  if (l.flexDirection) parts.push(`flex-direction:${l.flexDirection}`);
  if (l.gridTemplateColumns) parts.push(`grid-template-columns:${l.gridTemplateColumns}`);
  if (l.gridTemplateRows) parts.push(`grid-template-rows:${l.gridTemplateRows}`);
  if (l.gap) parts.push(`gap:${l.gap}`);
  return parts.join('; ');
}

function formatEdits(edits, chains) {
  const out = [];
  const byProp = Object.fromEntries(edits.map(e => [e.property, e]));
  const canCollapse = CORNERS.every(c => byProp[c])
    && CORNERS.every(c => byProp[c].before === byProp[CORNERS[0]].before && byProp[c].after === byProp[CORNERS[0]].after);
  const skip = new Set(canCollapse ? CORNERS : []);
  let collapsed = false;
  for (const e of edits) {
    if (skip.has(e.property)) {
      if (!collapsed) {
        collapsed = true;
        out.push(`    border-radius: ${e.before} → ${e.after}  (4 corners)`);
        const chain = CORNERS.map(c => chains[c]).find(Boolean);
        if (chain) out.push(...renderChainBlock(chain, 6));
      }
      continue;
    }
    out.push(`    ${e.property}: ${e.before} → ${e.after}`);
    if (chains[e.property]) out.push(...renderChainBlock(chains[e.property], 6));
  }
  return out;
}

// Render `declared:` + `chain:` at a given base indent. Deliberately NOT column-aligned:
// each row is `<name> = <value>  <src>` with single spaces, so editing one hop never
// reflows the spacing of its siblings. Names line up because the continuation prefix width
// equals `chain:     ` (11 chars). This favors the hard diff-friendly constraint over the
// target's cosmetic column alignment (flagged to the user at handoff).
function renderChainBlock(chain, indent) {
  if (!chain || !chain.hops || !chain.hops.length) return [];
  const pad = ' '.repeat(indent);
  const out = [`${pad}declared:  ${chain.declared}  via ${chain.via}`];

  const rows = chain.hops.map(h => ({ name: h.name, value: h.value, src: srcStr(h.source) }));
  if (chain.root) rows.push({ name: 'root', value: chain.root.value, src: srcStr(chain.root.source) });

  rows.forEach((r, i) => {
    const prefix = i === 0 ? `${pad}chain:     ` : `${pad}           `;  // both 11 chars past pad
    const left = `${r.name} = ${r.value}`;
    out.push(r.src ? `${prefix}${left}  ${r.src}` : `${prefix}${left}`);
  });
  if (chain.cyclic) out.push(`${pad}           … (cycle)`);
  else if (chain.truncated) out.push(`${pad}           … (chain depth capped)`);
  return out;
}

function srcStr(s) {
  if (!s || !s.file) return '';
  return s.line != null ? `${s.file}:${s.line}` : s.file;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/sidebar/notes/exportNotes.test.js`
Expected: PASS (all describe blocks).

Note on alignment: chain rows are intentionally single-spaced (`<name> = <value>  <src>`),
not column-aligned, so one hop's length never reflows another's spacing (the diff-friendly
constraint). The continuation prefix is exactly 11 chars past the base indent, matching
`chain:     `, so hop names still start in the same column. If a whitespace assertion fails,
confirm the continuation prefix is `${pad}` + 11 spaces and the source separator is two spaces.

- [ ] **Step 5: Run the whole suite and commit**

Run: `npm test`
Expected: PASS (all files).

```bash
git add src/sidebar/notes/exportNotes.js src/sidebar/notes/exportNotes.test.js
git commit -m "feat(notes): resolved-chain export layout, context, theme, 4-corner collapse"
```

---

## Task 7: Wire capture into the extension (integration)

**Files:**
- Modify: `src/content/content-script.js`
- Modify: `src/content/comment-overlay.js`
- Modify: `src/sidebar/App.jsx`

No new unit tests (extension/DOM glue). Verified manually against the real dev app at the end.

**Interfaces:**
- Consumes: `captureForEdit`, `captureForComment` (Task 4); `currentPageState` (Task 3); `mergeContext`-aware `upsertEdit`/`setComment` (Task 5); `formatAll(records, pageState)` (Task 6).

- [ ] **Step 1: Capture on edit (content-script)**

In `src/content/content-script.js`, add the import near the top (with the other resolve-side imports):

```js
import { captureForEdit } from '../utils/resolve/elementContext.js';
import { currentPageState } from '../utils/resolve/pageState.js';
```

In the `APPLY_STYLE` handler ([content-script.js:474-488](../../../src/content/content-script.js)), capture context **before** writing the inline override and include it on `CHANGE_APPLIED`:

```js
    case MESSAGES.APPLY_STYLE: {
      const el = getSelectedElement();
      if (el && e.data.property) {
        const kebab = e.data.property.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
        const before = getComputedStyle(el).getPropertyValue(kebab).trim();
        const context = captureForEdit(el, kebab);   // capture from author rules, pre-override
        el.style.setProperty(kebab, e.data.value, 'important');
        if (e.data.property === 'fontFamily') injectGoogleFont(e.data.value);
        postToSidebar(MESSAGES.CHANGE_APPLIED, {
          selector: buildSelector(el), path: buildPath(el), label: buildSelector(el),
          property: kebab, before, after: e.data.value, context,
        });
      }
      break;
    }
```

- [ ] **Step 2: Capture on comment save (comment-overlay)**

In `src/content/comment-overlay.js`, import the orchestrator at the top:

```js
import { captureForComment } from '../utils/resolve/elementContext.js';
```

At the `save()` call ([comment-overlay.js:196](../../../src/content/comment-overlay.js)), attach context built from the live element:

```js
    const t = describe(element);
    const context = captureForComment(element);
    closeComposer();
    if (onSaveCb) onSaveCb({ selector: t.selector, path: t.path, label: t.label, text, context });
```

- [ ] **Step 3: Thread context through the sidebar handlers (App.jsx)**

In `src/sidebar/App.jsx`, the `CHANGE_APPLIED` handler already forwards `e.data.data` to `upsertEdit`, which now reads `context` — no change needed there. Update the `COMMENT_SAVED` handler ([App.jsx:66-70](../../../src/sidebar/App.jsx)) to pass `context`:

```js
        case MESSAGES.COMMENT_SAVED: {
          const { selector, path, label, text, context } = e.data.data;
          setNotes(prev => removeEmpty(setCommentOp(prev, { selector, path, label, context }, text)));
          break;
        }
```

- [ ] **Step 4: Pass page-state into the export (content-script)**

In `copyChanges()` ([content-script.js:221-231](../../../src/content/content-script.js)), build page-state at export time (the content script has the DOM) and pass it to `formatAll`:

```js
function copyChanges() {
  if (!changeRecords.length) return;
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const pageState = currentPageState(date);
  const text = formatAll(changeRecords, pageState);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  } catch { fallbackCopy(text); }
}
```

- [ ] **Step 5: Build and run the unit suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass.

- [ ] **Step 6: Manual verification against the real dev app**

Use the verify skill / manual matrix. Load the unpacked `dist/` in Chrome, open a Vite + Tailwind + tokens app (the motivating repo, or any `shadcn`-style app on `localhost`).

1. Inspect a token-backed button, edit its border-radius. Open the changes popover, Copy. Paste into a scratch file. Confirm: header line with URL + viewport + date; `## [1] <selector>`; `border-radius: … (4 corners)`; a `declared:`/`chain:` block naming `--radius-md` → `--radius` with `theme.css:<line>` (dev server) and a `root = <px>` row.
2. Comment on a `bg-card`-style element. Confirm `layout:`/`children:`/`bbox:` lines and a `background-color:` chain resolving `var(--card)`.
3. Comment on a bare `<div>` wrapper. Confirm `layout:`/`children:`/`bbox:` with no chain block.
4. Inspect an element under a `.dark` subtree on a light page. Confirm a per-record `theme:  dark  (via .dark on …)` line.
5. Open a plain, untokenized page (no Vite, no tokens — e.g. a static HTML page). Edit something and export. Confirm the output is heading + comment + plain edit lines, **no** `declared:`/`chain:`/`layout:` blocks (the floor).

Record results. If any step misbehaves, use systematic-debugging before patching.

- [ ] **Step 7: Commit**

```bash
git add src/content/content-script.js src/content/comment-overlay.js src/sidebar/App.jsx
git commit -m "feat: wire resolved-context capture into edit/comment/export"
```

---

## Self-Review

**1. Spec coverage:**
- Pure transitive resolver (multi-hop, calc passthrough, rem/root, cycle, fallback, depth cap) → Task 1. ✓
- CSSOM adapter (cross-origin skip, specificity + source order, ancestor inheritance, `<style>` line via `data-vite-dev-id`, linked-sheet filename) → Task 2. ✓
- Root font-size hop when a `rem` is in the chain → Task 1 (`opts.root` gate) + Task 2 (`rootFontSizeSource`). ✓
- Page-state header (URL, mode + method, viewport, date) + omit-never-guess → Task 3. ✓
- Per-record theme line when element mode ≠ page mode → Task 3 (detection) + Task 6 (render). ✓
- Layout/children/bbox for commented elements → Task 4 (capture) + Task 6 (render). ✓
- Var-backed paint chains on commented elements → Task 4 (`PAINT_PROPS`) + Task 6. ✓
- 4-corner `border-radius` collapse → Task 6. ✓
- Capture-time resolution; `exportNotes` stays pure → Tasks 4–6. ✓
- Merge context onto records → Task 5. ✓
- Wiring + pass pageState into `formatAll` → Task 7. ✓
- Degradation floor (no context → today's info, new layout) → Task 6 floor tests. ✓
- No new deps; pure tests under `environment: 'node'` → every test task. ✓
- Phase 2 untouched → confirmed; no task references blast-radius/component identity. ✓

**2. Placeholder scan:** none — every step has real code and exact commands.

**3. Type consistency:** `ChainResult` fields (`declared`, `via`, `computed`, `hops`, `root`, `truncated`, `cyclic`) are produced identically in Task 4 `resolveProp` and consumed in Task 6 `renderChainBlock`/`formatCommentContext`. `Context` (`chains`/`layout`/`children`/`bbox`/`theme`) is produced in Task 4, merged in Task 5 `mergeContext`, read in Task 6. `resolveChain` returns `{hops, root, truncated, cyclic}` (Task 1) and Task 4 spreads it into `ChainResult`, adding `declared`/`via`/`computed` — consistent. `detectThemeFromChain` returns `{mode, method, carrier, carrierSelector}` (Task 3), rendered with exactly those fields in Task 6. `PageState` `{header, mode}` produced by `currentPageState` (Task 3/7), consumed by `formatAll` (Task 6). ✓

**Known simplifications (documented, acceptable):** specificity is an approximate `(a,b,c)` regex, not a full selector-engine calc; `@layer` ordering degrades to source order; same-origin linked sheets contribute filename only (no line) by design. All are in the spec's "Out"/degradation sections.
