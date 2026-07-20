import { describe, it, expect } from 'vitest';
import { formatDimension, withUnit } from './dimensionHelpers.js';

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

describe('withUnit', () => {
  // The bug this fixes: typing "12" into a corner-radius field sent the bare
  // string to setProperty('border-top-left-radius', '12'), which is invalid CSS
  // and is dropped silently — the edit looked like it did nothing.
  it('appends the unit to a bare number', () => {
    expect(withUnit('12')).toBe('12px');
    expect(withUnit('0')).toBe('0px');
    expect(withUnit('12.5')).toBe('12.5px');
    expect(withUnit('-4')).toBe('-4px');
  });

  it('leaves an already-united value alone', () => {
    expect(withUnit('12px')).toBe('12px');
    expect(withUnit('50%')).toBe('50%');
    expect(withUnit('1.5rem')).toBe('1.5rem');
  });

  it('leaves keywords and shorthands alone', () => {
    expect(withUnit('auto')).toBe('auto');
    expect(withUnit('8px 4px')).toBe('8px 4px');
    expect(withUnit('calc(100% - 8px)')).toBe('calc(100% - 8px)');
  });

  it('trims surrounding whitespace', () => {
    expect(withUnit('  12  ')).toBe('12px');
  });

  // line-height is the one numeric field where a bare number is meaningful CSS
  // (a ratio), so px must not be forced onto it.
  it('passes bare numbers through when no unit is configured', () => {
    expect(withUnit('1.5', null)).toBe('1.5');
    expect(withUnit('1.5', '')).toBe('1.5');
  });

  it('returns empty for blank input', () => {
    expect(withUnit('')).toBe('');
    expect(withUnit('   ')).toBe('');
    expect(withUnit(null)).toBe('');
    expect(withUnit(undefined)).toBe('');
  });
});
