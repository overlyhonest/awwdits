import { describe, it, expect } from 'vitest';
import { formatRecord, formatAll } from './exportNotes.js';

describe('formatRecord', () => {
  it('formats comment + edits', () => {
    const out = formatRecord({
      selector: 'button.cta', comment: 'tighten padding',
      edits: [{ property: 'padding', before: '12px', after: '8px' }, { property: 'border-radius', before: '4px', after: '8px' }],
    });
    expect(out).toBe('## button.cta\nComment: "tighten padding"\nChanges:\n  - padding: 12px → 8px\n  - border-radius: 4px → 8px');
  });

  it('formats a comment-only record (no CSS block)', () => {
    expect(formatRecord({ selector: 'nav a', comment: 'off-brand', edits: [] }))
      .toBe('## nav a\nComment: "off-brand"');
  });

  it('formats an edits-only record (no comment quote)', () => {
    expect(formatRecord({ selector: '.hero h1', comment: '', edits: [{ property: 'line-height', before: '1.1', after: '1.3' }] }))
      .toBe('## .hero h1\nChanges:\n  - line-height: 1.1 → 1.3');
  });

  it('omits the nth-child path (heading selector carries the class)', () => {
    const out = formatRecord({
      selector: 'strong.x', comment: 'hi', edits: [],
      path: [{ tag: 'div', index: 0 }, { tag: 'strong', index: 2 }],
    });
    expect(out).toBe('## strong.x\nComment: "hi"');
  });
});

describe('formatAll', () => {
  it('joins records with a blank line', () => {
    const out = formatAll([
      { selector: 'a', comment: 'x', edits: [] },
      { selector: 'b', comment: 'y', edits: [] },
    ]);
    expect(out).toBe('## a\nComment: "x"\n\n## b\nComment: "y"');
  });
});
