import { describe, it, expect } from 'vitest';
import { formatDimension } from './dimensionHelpers.js';

describe('formatDimension', () => {
  it('rounds a px value to a bare number', () => {
    expect(formatDimension('181px')).toBe('181');
    expect(formatDimension('32.4px')).toBe('32');
    expect(formatDimension('32.6px')).toBe('33');
  });

  it('accepts a plain number', () => {
    expect(formatDimension(181)).toBe('181');
  });

  // The bug this fixes: a truthy non-numeric width ("auto") passed the old
  // truthiness guard, so parseFloat -> NaN -> Math.round(NaN) -> "NaN" rendered
  // literally in the panel. Anything that isn't a number must fall back.
  it('falls back for truthy non-numeric values rather than rendering "NaN"', () => {
    expect(formatDimension('auto')).toBe('—');
    expect(formatDimension('inherit')).toBe('—');
    expect(formatDimension('min-content')).toBe('—');
    expect(formatDimension('')).toBe('—');
  });

  it('falls back when the value is absent', () => {
    expect(formatDimension(undefined)).toBe('—');
    expect(formatDimension(null)).toBe('—');
  });

  // '0px' is falsy-adjacent only after parsing; it is a real measurement and must render.
  it('renders a genuine zero', () => {
    expect(formatDimension('0px')).toBe('0');
    expect(formatDimension(0)).toBe('0');
  });
});
