import { isOnGrid, gridBase } from '../helpers/gridHelpers.js';

// "Is this value part of the system, or a stray?" — the same question the Health
// tab asks, brought to the inspected element. The one signal we can compute from a
// single element without page-wide analysis is spacing off the base grid, so that's
// what we flag here. (Non-token colors need the extractor to run matchColorToToken;
// that's a follow-up.) We use the lenient 4px default base — see gridHelpers.
const BASE = gridBase();

// True when a spacing value (e.g. "13px") sits off the base grid. Non-numeric
// values (auto, %, "0px") never count.
export function isStray(value) {
  if (value == null) return false;
  return !isOnGrid(value, BASE);
}

// Every off-grid spacing value on the element, one entry per side, so the box
// model can flag each one where it appears.
export function spacingStrays(styles) {
  const out = [];
  const pad = styles?.spacing?.padding ?? {};
  const mar = styles?.spacing?.margin ?? {};
  const gap = styles?.layout?.gap;

  const check = (area, side, value) => {
    if (isStray(value)) out.push({ area, side, value });
  };

  ['top', 'right', 'bottom', 'left'].forEach((s) => check('padding', s, pad[s]));
  ['top', 'right', 'bottom', 'left'].forEach((s) => check('margin', s, mar[s]));
  if (gap) gap.split(/\s+/).forEach((g, i) => check('gap', i === 0 ? 'row' : 'col', g));

  return out;
}

// A friendlier headline count: a symmetric off-grid padding is one problem, not
// four. Collapse to distinct area+value pairs.
export function strayCount(styles) {
  const strays = spacingStrays(styles);
  return new Set(strays.map((s) => `${s.area}:${s.value}`)).size;
}
