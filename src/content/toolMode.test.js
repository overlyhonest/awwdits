import { describe, it, expect } from 'vitest';
import { computeHeldTool, resolveEffective, commitOnUse } from './toolMode.js';

describe('computeHeldTool', () => {
  it('is idle with no keys held', () => {
    expect(computeHeldTool()).toBe('none');
    expect(computeHeldTool({ mod: false, shift: false, x: false })).toBe('none');
  });

  it('⌘/Ctrl → inspect', () => {
    expect(computeHeldTool({ mod: true })).toBe('inspect');
  });

  it('⌘/Ctrl+Shift → comment', () => {
    expect(computeHeldTool({ mod: true, shift: true })).toBe('comment');
  });

  it('X → measure', () => {
    expect(computeHeldTool({ x: true })).toBe('measure');
  });

  it('Shift alone (no modifier) is idle — not comment', () => {
    expect(computeHeldTool({ shift: true })).toBe('none');
  });

  it('a held modifier wins over X', () => {
    expect(computeHeldTool({ mod: true, x: true })).toBe('inspect');
    expect(computeHeldTool({ mod: true, shift: true, x: true })).toBe('comment');
  });
});

describe('resolveEffective', () => {
  it('idle when nothing held and no sticky tool', () => {
    expect(resolveEffective('none', 'none')).toEqual({ tool: 'none', sticky: true });
  });

  it('a held tool overrides the sticky tool (momentary)', () => {
    // Sticky comment on, hold ⌘ → inspect wins, and it is momentary (not sticky).
    expect(resolveEffective('inspect', 'comment')).toEqual({ tool: 'inspect', sticky: false });
  });

  it('reverts to the sticky tool when no key is held', () => {
    // Releasing the held key (heldTool → none) lands back on the sticky tool.
    expect(resolveEffective('none', 'comment')).toEqual({ tool: 'comment', sticky: true });
  });

  it('a held tool equal to the sticky tool stays sticky (no downgrade)', () => {
    // Holding ⌘ while sticky-inspect is on must not turn off plain-click selection.
    expect(resolveEffective('inspect', 'inspect')).toEqual({ tool: 'inspect', sticky: true });
  });

  it('a bare held tool with no sticky tool is momentary', () => {
    expect(resolveEffective('measure', 'none')).toEqual({ tool: 'measure', sticky: false });
    expect(resolveEffective('inspect', 'none')).toEqual({ tool: 'inspect', sticky: false });
  });

  // Clicking while X is held commits measure to sticky, so you don't have to keep
  // holding X through a multi-click measurement.
  it('measure survives the X release once a click has committed it', () => {
    // Hold X: measure is momentary.
    expect(resolveEffective('measure', 'none')).toEqual({ tool: 'measure', sticky: false });
    // Click commits it → stickyTool becomes 'measure'; still measure, now sticky.
    expect(resolveEffective('measure', 'measure')).toEqual({ tool: 'measure', sticky: true });
    // Release X → heldTool none, but the committed sticky tool keeps measure alive.
    expect(resolveEffective('none', 'measure')).toEqual({ tool: 'measure', sticky: true });
    // Escape / the toolbar button clears sticky → idle.
    expect(resolveEffective('none', 'none')).toEqual({ tool: 'none', sticky: true });
  });
});

describe('commitOnUse', () => {
  it('promotes the held tool to sticky', () => {
    expect(commitOnUse('inspect', 'comment')).toBe('inspect');
    expect(commitOnUse('comment', 'inspect')).toBe('comment');
    expect(commitOnUse('measure', 'none')).toBe('measure');
  });

  it('leaves the sticky tool alone when nothing is held', () => {
    expect(commitOnUse('none', 'comment')).toBe('comment');
    expect(commitOnUse('none', 'none')).toBe('none');
  });

  it('is a no-op when the held and sticky tools already agree', () => {
    expect(commitOnUse('measure', 'measure')).toBe('measure');
  });

  // The bug this fixes: ⌘-click while comment is sticky used to inspect the element, then
  // snap back to comment on keyup — re-lighting the comment pill and clearing the selection.
  it('inspect survives the ⌘ release once a click has committed it', () => {
    let held = 'inspect', sticky = 'comment';
    expect(resolveEffective(held, sticky)).toEqual({ tool: 'inspect', sticky: false });
    sticky = commitOnUse(held, sticky);   // the click commits
    held = 'none';                        // ⌘ released
    expect(resolveEffective(held, sticky)).toEqual({ tool: 'inspect', sticky: true });
  });
});
