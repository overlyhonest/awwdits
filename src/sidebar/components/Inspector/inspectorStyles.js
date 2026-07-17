// Shared text styles for the inspect detail panels, so every property label and
// value reads consistently. All values trace back to tokens.js.

import { FONT, COLOR } from '../redesign/tokens.js';

// Two text levels, which is all the canvas affords: below `foregroundLabel` (5.77:1)
// you hit the 4.5:1 AA floor almost immediately, so a third "annotation" tier would be
// too close to LABEL to see. Secondary meaning is carried by size, mono/sans, and
// strike-through instead of by a dimmer grey.

// Field labels (Width, Font size, Display, …). Mono, 13px — one panel-wide rule.
export const LABEL = {
  fontFamily: FONT.mono,
  fontSize: 13,
  fontWeight: 400,
  color: COLOR.foregroundLabel,
  lineHeight: '17px',
};

// Primary values (the data). Mono, 16px.
export const VALUE = {
  fontFamily: FONT.mono,
  fontSize: 16,
  fontWeight: 500,
  color: COLOR.foreground,
  lineHeight: '20px',
};

// WCAG contrast verdict → semantic tone. One place, so the two panels that show
// a ratio (ColorSection, ContrastChecker) can never disagree.
export function contrastVerdict(ratio) {
  if (ratio >= 4.5) return { label: ratio >= 7.0 ? 'AAA Pass' : 'AA Pass', fg: COLOR.success, bg: COLOR.successMuted };
  if (ratio >= 3.0) return { label: 'AA Large', fg: COLOR.warning, bg: COLOR.warningMuted };
  return { label: 'Fail', fg: COLOR.danger, bg: COLOR.dangerMuted };
}
