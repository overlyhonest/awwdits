// The inspect card is DOM-bound (getComputedStyle, positioning), so most of it is
// verified by hand on the built extension. These tests cover the two DOM-free seams the
// Contrast row adds: the status→color map and the row's HTML template.
import { describe, it, expect } from 'vitest';
import { ACCENT, COLORS } from './overlayTokens.js';
import { contrastPillStyle, contrastRow } from './contextMenu.js';

describe('contrastPillStyle', () => {
  it('maps a passing result to the success tint', () => {
    expect(contrastPillStyle('good')).toEqual({ bg: ACCENT.successMuted, fg: ACCENT.success });
  });

  it('maps a marginal result to the warning tint', () => {
    expect(contrastPillStyle('warning')).toEqual({ bg: ACCENT.warningMuted, fg: ACCENT.warning });
  });

  it('maps a failing result to the danger tint', () => {
    expect(contrastPillStyle('error')).toEqual({ bg: COLORS.dangerMuted, fg: COLORS.danger });
  });

  it('falls back to the danger tint for an unexpected status, never throwing', () => {
    expect(contrastPillStyle(undefined)).toEqual({ bg: COLORS.dangerMuted, fg: COLORS.danger });
    expect(contrastPillStyle('bogus')).toEqual({ bg: COLORS.dangerMuted, fg: COLORS.danger });
  });
});

describe('contrastRow', () => {
  it('shows the ratio and the grade text', () => {
    const html = contrastRow('4.62:1', 'AA', 'good');
    expect(html).toContain('4.62:1');
    expect(html).toContain('>AA<');
    expect(html).toContain('Contrast');
  });

  it('tints the pill with the status color', () => {
    const good = contrastRow('7.10:1', 'AAA', 'good');
    expect(good).toContain(ACCENT.success);
    expect(good).toContain(ACCENT.successMuted);

    const fail = contrastRow('2.10:1', 'Fail', 'error');
    expect(fail).toContain(COLORS.danger);
    expect(fail).toContain(COLORS.dangerMuted);

    const marginal = contrastRow('3.50:1', 'Fail', 'warning');
    expect(marginal).toContain(ACCENT.warning);
    expect(marginal).toContain(ACCENT.warningMuted);
  });
});
