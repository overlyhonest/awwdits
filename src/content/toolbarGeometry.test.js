import { describe, it, expect } from 'vitest';
import { clampToolbarPos, defaultToolbarPos, TOOLBAR_MARGIN } from './toolbarGeometry.js';

const VP = { vw: 1000, vh: 800 };
const SIZE = { w: 320, h: 48 };

describe('clampToolbarPos', () => {
  it('keeps an in-bounds position unchanged', () => {
    expect(clampToolbarPos({ x: 300, y: 400 }, VP, SIZE)).toEqual({ x: 300, y: 400 });
  });
  it('clamps past the right/bottom edge to leave a margin', () => {
    expect(clampToolbarPos({ x: 9999, y: 9999 }, VP, SIZE))
      .toEqual({ x: 1000 - 320 - TOOLBAR_MARGIN, y: 800 - 48 - TOOLBAR_MARGIN });
  });
  it('clamps negative coords up to the margin', () => {
    expect(clampToolbarPos({ x: -50, y: -50 }, VP, SIZE)).toEqual({ x: TOOLBAR_MARGIN, y: TOOLBAR_MARGIN });
  });
});

describe('defaultToolbarPos', () => {
  it('centers horizontally and sits near the bottom', () => {
    expect(defaultToolbarPos(VP, SIZE)).toEqual({ x: Math.round((1000 - 320) / 2), y: 800 - 48 - 24 });
  });
});
