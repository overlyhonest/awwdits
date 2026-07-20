import { describe, it, expect } from 'vitest';
import { isGapContainer } from './layoutHelpers.js';

describe('isGapContainer', () => {
  it('accepts flex and grid containers', () => {
    expect(isGapContainer('flex')).toBe(true);
    expect(isGapContainer('grid')).toBe(true);
    expect(isGapContainer('inline-flex')).toBe(true);
    expect(isGapContainer('inline-grid')).toBe(true);
  });

  it('rejects layouts where gap does nothing', () => {
    expect(isGapContainer('block')).toBe(false);
    expect(isGapContainer('inline')).toBe(false);
    expect(isGapContainer('inline-block')).toBe(false);
    expect(isGapContainer('contents')).toBe(false);
    expect(isGapContainer('none')).toBe(false);
  });

  // 'flex-start' is an alignment value, not a display value — a substring match
  // would wrongly light the gap control up on it.
  it('does not match values that merely contain flex or grid', () => {
    expect(isGapContainer('flex-start')).toBe(false);
    expect(isGapContainer('grid-template')).toBe(false);
  });

  it('handles absent values', () => {
    expect(isGapContainer('')).toBe(false);
    expect(isGapContainer(null)).toBe(false);
    expect(isGapContainer(undefined)).toBe(false);
  });
});
