import { describe, it, expect } from 'vitest';
import { positionPin, PIN_SIZE } from './commentOverlayGeometry.js';

const vp = { width: 1000, height: 800 };
const rect = (o) => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, ...o });

describe('positionPin', () => {
  it('anchors the pin centered on the top-left corner', () => {
    const r = rect({ top: 100, left: 100, right: 300, bottom: 200, width: 200, height: 100 });
    expect(positionPin(r, vp)).toEqual({ left: 100 - PIN_SIZE / 2, top: 100 - PIN_SIZE / 2, visible: true });
  });

  it('hides the pin when the element is fully above the viewport', () => {
    const r = rect({ top: -200, left: 100, right: 300, bottom: -100 });
    expect(positionPin(r, vp).visible).toBe(false);
  });

  it('hides the pin when the element is fully below the viewport', () => {
    const r = rect({ top: 900, left: 100, right: 300, bottom: 1000 });
    expect(positionPin(r, vp).visible).toBe(false);
  });

  it('clamps the pin inside the viewport at the top-left edge', () => {
    const r = rect({ top: 0, left: 0, right: 40, bottom: 50 });
    const p = positionPin(r, vp);
    expect(p.left).toBe(0); // clamped from 0 - PIN_SIZE/2
    expect(p.top).toBe(0);  // clamped from 0 - PIN_SIZE/2
    expect(p.visible).toBe(true);
  });

  it('clamps the pin inside the viewport at the right edge', () => {
    const r = rect({ top: 100, left: 990, right: 1000, bottom: 150 });
    const p = positionPin(r, vp);
    expect(p.left).toBe(vp.width - PIN_SIZE); // clamped from 990 - PIN_SIZE/2
    expect(p.visible).toBe(true);
  });

  it('keeps a partially-visible element visible and clamps top to 0', () => {
    const r = rect({ top: -10, left: 100, right: 300, bottom: 40 });
    const p = positionPin(r, vp);
    expect(p.visible).toBe(true);
    expect(p.top).toBe(0);
  });
});
