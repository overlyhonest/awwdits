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

  it('renders (none) for an empty before value', () => {
    expect(formatRecord({ selector: 'span', comment: '', edits: [{ property: 'content', before: '', after: '"x"' }] }, 1))
      .toBe('## [1] span\n    content: (none) → "x"');
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

  it('marks a truncated (depth-capped) chain, keeping a real source', () => {
    const rec = { selector: 'a', comment: '', edits: [{ property: 'color', before: 'x', after: 'y' }],
      context: { chains: { color: { declared: 'var(--a)', via: '.a', computed: 'y',
        hops: [{ name: '--a', value: 'var(--b)', source: S('theme.css', 42) }], root: null, truncated: true, cyclic: false } } } };
    expect(formatRecord(rec, 1)).toBe(
`## [1] a
    color: x → y
      declared:  var(--a)  via .a
      chain:     --a = var(--b)  theme.css:42
                 … (chain depth capped)`);
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

describe('formatRecord — layout & children edge cases', () => {
  it('composes a grid layout line from all four grid descriptors', () => {
    const rec = {
      selector: 'div.grid', comment: 'switch to grid', edits: [],
      context: {
        layout: { display: 'grid', flexDirection: null, gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto', gap: '12px' },
        children: { count: 4, signature: 'div.card' }, bbox: { w: 640, h: 320, x: 0, y: 96 }, chains: {},
      },
    };
    expect(formatRecord(rec, 4)).toBe(
`## [4] div.grid
    Comment: "switch to grid"
      layout:    display:grid; grid-template-columns:1fr 1fr; grid-template-rows:auto; gap:12px
      children:  4 × div.card
      bbox:      640×320 @ (0,96)`);
  });

  it('falls back to a bare count when children have no common signature', () => {
    const rec = {
      selector: 'div.mixed', comment: 'multiple different tags', edits: [],
      context: {
        layout: { display: 'flex', flexDirection: 'row', gridTemplateColumns: null, gridTemplateRows: null, gap: null },
        children: { count: 2, signature: null }, bbox: { w: 100, h: 50, x: 10, y: 20 }, chains: {},
      },
    };
    expect(formatRecord(rec, 5)).toBe(
`## [5] div.mixed
    Comment: "multiple different tags"
      layout:    display:flex; flex-direction:row
      children:  2
      bbox:      100×50 @ (10,20)`);
  });

  it('omits the children line entirely when count is zero', () => {
    const rec = {
      selector: 'div.empty', comment: 'no kids here', edits: [],
      context: {
        layout: { display: 'flex', flexDirection: 'row', gridTemplateColumns: null, gridTemplateRows: null, gap: null },
        children: { count: 0, signature: null }, bbox: { w: 40, h: 40, x: 0, y: 0 }, chains: {},
      },
    };
    const out = formatRecord(rec, 6);
    expect(out).not.toContain('children:');
    expect(out).toBe(
`## [6] div.empty
    Comment: "no kids here"
      layout:    display:flex; flex-direction:row
      bbox:      40×40 @ (0,0)`);
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
