import { rgbToHex } from '../utils/helpers/colorHelpers.js';
import { hasOwnText } from '../utils/helpers/elementText.js';
import { checkContrast } from '../utils/analyzers/contrastChecker.js';
import { ACCENT, COLORS, FONT, SIZE, WEIGHT, ensureOverlayFonts } from './overlayTokens.js';

const MENU_ID = 'awwdits-ctx';
let menuEl = null;

// ── Public API ────────────────────────────────────────────────────────────────

/** @param {DOMRect} rect - hovered element rect
 *  @param {DOMRect|null} selectedRect - selected element rect (for distance-aware positioning) */
export function showContextMenu(element, rect, selectedRect) {
  ensureMenu();
  populate(element, rect, selectedRect);
}

export function hideContextMenu() {
  if (menuEl) menuEl.style.opacity = '0';
}

export function destroyContextMenu() {
  if (menuEl) { menuEl.remove(); menuEl = null; }
}

// ── Internals ─────────────────────────────────────────────────────────────────

function ensureMenu() {
  if (menuEl && document.body.contains(menuEl)) return;
  ensureOverlayFonts();
  menuEl = document.createElement('div');
  menuEl.id = MENU_ID;
  menuEl.style.cssText = [
    'position:fixed',
    'z-index:2147483646',
    `background:${COLORS.bg}`,
    `border:1px solid ${COLORS.border}`,
    'border-radius:10px',
    'padding:10px 12px',
    `font-family:${FONT.sans}`,
    `font-size:${SIZE.base}`,
    'line-height:1.7',
    `color:${COLORS.fg}`,
    'pointer-events:none',
    'box-shadow:0 8px 32px rgba(0,0,0,0.45)',
    'min-width:180px',
    'max-width:260px',
    'opacity:0',
    'transition:opacity 0.1s ease',
    'user-select:none',
    'left:-9999px',
    'top:-9999px',
  ].join(';');
  document.body.appendChild(menuEl);
}

function populate(el, rect, selectedRect) {
  const cs = getComputedStyle(el);
  const w  = Math.round(rect.width);
  const h  = Math.round(rect.height);

  // Text-related rows (Font, Line height, Color, Contrast) belong only to elements that
  // render their own text — not to containers that merely wrap text-bearing children.
  const hasText = hasOwnText(el);

  // Colors
  const bgHex      = rgbToHex(cs.backgroundColor);
  // Reading the inspected page's own color here, not styling ours.
  const showBg     = bgHex && bgHex !== '#000000' && !cs.backgroundColor.includes('rgba(0, 0, 0, 0)'); // design-token-exempt
  const textHex    = hasText ? rgbToHex(cs.color) : null;

  // Typography
  const fontFamily = hasText ? cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : null;
  const fontSize   = hasText ? cs.fontSize   : null;
  const fontWeight = hasText ? cs.fontWeight : null;
  const lineHeight = hasText ? cs.lineHeight : null;

  // Border radius — use individual corners
  const tl = cs.borderTopLeftRadius;
  const tr = cs.borderTopRightRadius;
  const br = cs.borderBottomRightRadius;
  const bl = cs.borderBottomLeftRadius;
  const allSameRadius = tl === tr && tr === br && br === bl;
  const radius = tl !== '0px' ? (allSameRadius ? tl : `${tl} ${tr} ${br} ${bl}`) : null;

  // Build rows
  const rows = [];

  // Dimensions — always shown, prominent
  rows.push(dimRow(`${w} × ${h}px`));

  // Divider if we have more rows
  const detail = [];

  if (fontFamily) {
    detail.push(labelRow('Font',    `${fontFamily} · ${fontSize} · ${fontWeight}`));
    if (lineHeight && lineHeight !== 'normal') {
      detail.push(labelRow('Line height', lineHeight));
    }
  }
  if (textHex) {
    detail.push(colorRow('Color', textHex));
  }
  if (showBg) {
    detail.push(colorRow('BG', bgHex));
  }
  // Contrast is a text-only property. checkContrast walks up to the effective background —
  // note it reads background-color only, so text over an image/gradient is measured against
  // the nearest solid ancestor (or white), matching DevTools. Omit the row if it can't resolve.
  if (hasText) {
    const contrast = checkContrast(el);
    if (contrast) detail.push(contrastRow(contrast.ratioLabel, contrast.grade, contrast.status));
  }
  if (radius) {
    detail.push(labelRow('Radius', radius));
  }

  const html = detail.length
    ? rows.join('') + `<div style="height:1px;background:${COLORS.divider};margin:7px -4px"></div>` + detail.join('')
    : rows.join('');

  menuEl.innerHTML = html;

  // Measure and position after content is set
  requestAnimationFrame(() => positionMenu(rect, selectedRect));
  menuEl.style.opacity = '1';
}

// ── Row builders ──────────────────────────────────────────────────────────────

// Dimensions are data, so they're mono. Weight 500 (not 600): the Special Gothic faces
// ship a single Regular, and the old font-weight:600 on a sans stack rendered as
// synthetic bold. JetBrains Mono has a real 500.
function dimRow(text) {
  return `<div style="font:${WEIGHT.medium} ${SIZE.base} ${FONT.mono};color:${COLORS.fg};margin-bottom:2px">${text}</div>`;
}

function labelRow(label, value) {
  return `
    <div style="display:flex;gap:8px;align-items:baseline">
      <span style="color:${COLORS.label};font:${SIZE.md} ${FONT.sans};width:68px;flex-shrink:0;white-space:nowrap">${label}</span>
      <span style="color:${COLORS.fg};font:${SIZE.md} ${FONT.mono};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${value}</span>
    </div>`;
}

// Contrast verdict → pill tint. The color lives only in the pill, so the row reads as data.
// An unknown status falls back to danger — a missing verdict should never read as "passing".
export function contrastPillStyle(status) {
  switch (status) {
    case 'good':    return { bg: ACCENT.successMuted, fg: ACCENT.success };
    case 'warning': return { bg: ACCENT.warningMuted, fg: ACCENT.warning };
    default:        return { bg: COLORS.dangerMuted,  fg: COLORS.danger  };
  }
}

function colorRow(label, hex) {
  return `
    <div style="display:flex;gap:8px;align-items:center">
      <span style="color:${COLORS.label};font:${SIZE.md} ${FONT.sans};width:68px;flex-shrink:0">${label}</span>
      <span style="width:12px;height:12px;border-radius:3px;background:${hex};border:1px solid ${COLORS.border};flex-shrink:0;display:inline-block"></span>
      <span style="color:${COLORS.fg};font:${SIZE.md} ${FONT.mono}">${hex}</span>
    </div>`;
}

// Ratio as data (mono, like every value), plus the WCAG grade in a tinted pill that carries
// the verdict color. The pill borrows the keycap's material language — the grade reads as data.
export function contrastRow(ratioLabel, grade, status) {
  const pill = contrastPillStyle(status);
  return `
    <div style="display:flex;gap:8px;align-items:center">
      <span style="color:${COLORS.label};font:${SIZE.md} ${FONT.sans};width:68px;flex-shrink:0">Contrast</span>
      <span style="color:${COLORS.fg};font:${SIZE.md} ${FONT.mono}">${ratioLabel}</span>
      <span style="background:${pill.bg};color:${pill.fg};font:${WEIGHT.medium} ${SIZE.sm} ${FONT.mono};padding:1px 6px;border-radius:5px;line-height:1.5">${grade}</span>
    </div>`;
}

// ── Positioning ───────────────────────────────────────────────────────────────

function positionMenu(rect, selectedRect) {
  const gap    = 12;  // distance between element edge and menu edge
  const margin = 8;   // minimum clearance from viewport edge
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mw = menuEl.offsetWidth  || 200;
  const mh = menuEl.offsetHeight || 120;

  /** Compute menu position for a given side, already clamped to viewport. */
  function placeOn(side) {
    let left, top;
    switch (side) {
      case 'below': top  = rect.bottom + gap;         left = rect.left;                         break;
      case 'above': top  = rect.top - mh - gap;       left = rect.left;                         break;
      case 'right': left = rect.right + gap;           top  = rect.top + (rect.height - mh) / 2; break;
      case 'left':  left = rect.left - mw - gap;       top  = rect.top + (rect.height - mh) / 2; break;
    }
    left = Math.min(Math.max(margin, left), vw - mw - margin);
    top  = Math.min(Math.max(margin, top),  vh - mh - margin);
    return { left, top };
  }

  /** True if a menu at `pos` would overlap DOMRect `r`. */
  function overlaps(pos, r) {
    if (!r) return false;
    return !(pos.left + mw <= r.left  || pos.left  >= r.right  ||
             pos.top  + mh <= r.top   || pos.top   >= r.bottom);
  }

  // Build preferred placement order based on spatial context
  let order;

  if (selectedRect) {
    // Measure the directional gaps between hovered and selected elements
    const gapRight = selectedRect.left   - rect.right;
    const gapLeft  = rect.left   - selectedRect.right;
    const gapBelow = selectedRect.top    - rect.bottom;
    const gapAbove = rect.top    - selectedRect.bottom;
    const hGap = Math.max(gapRight, gapLeft, 0);
    const vGap = Math.max(gapBelow, gapAbove, 0);
    const sideBy  = hGap > 0 && hGap >= vGap;  // elements sit side-by-side
    const stacked = vGap > 0 && vGap  >  hGap; // elements sit top-to-bottom

    const spaceBelow = vh - rect.bottom - gap;
    const spaceAbove = rect.top    - gap;
    const spaceRight = vw - rect.right  - gap;
    const spaceLeft  = rect.left   - gap;

    if (sideBy) {
      // Distance lines run horizontally → put menu above or below (out of the way)
      order = spaceBelow >= spaceAbove
        ? ['below', 'above', 'right', 'left']
        : ['above', 'below', 'right', 'left'];
    } else if (stacked) {
      // Distance lines run vertically → put menu to the left or right
      order = spaceRight >= spaceLeft
        ? ['right', 'left', 'below', 'above']
        : ['left', 'right', 'below', 'above'];
    } else {
      // Overlapping / diagonal — go to the quadrant away from the selected element
      const selCx = (selectedRect.left + selectedRect.right) / 2;
      const selCy = (selectedRect.top  + selectedRect.bottom) / 2;
      const cx    = (rect.left + rect.right) / 2;
      const cy    = (rect.top  + rect.bottom) / 2;
      if      (cx <= selCx && cy <= selCy) order = ['above', 'left',  'below', 'right'];
      else if (cx >  selCx && cy <= selCy) order = ['above', 'right', 'below', 'left'];
      else if (cx <= selCx && cy >  selCy) order = ['below', 'left',  'above', 'right'];
      else                                  order = ['below', 'right', 'above', 'left'];
    }
  } else {
    // No selection — rank all four sides by available space and try best-first
    const spaces = [
      { side: 'below', space: vh - rect.bottom - gap },
      { side: 'above', space: rect.top    - gap      },
      { side: 'right', space: vw - rect.right  - gap },
      { side: 'left',  space: rect.left   - gap      },
    ];
    spaces.sort((a, b) => b.space - a.space);
    order = spaces.map(s => s.side);
  }

  // Try each side in order; pick the first that covers neither the inspected
  // element nor the selected element (after viewport clamping).
  // Fallback: accept covering the selected element but never the hovered one.
  // Last resort: use the first side regardless.
  let best = null;
  let noHoverOverlap = null;
  for (const side of order) {
    const pos = placeOn(side);
    if (!overlaps(pos, rect) && !overlaps(pos, selectedRect)) { best = pos; break; }
    if (!overlaps(pos, rect) && !noHoverOverlap)               noHoverOverlap = pos;
  }
  const chosen = best || noHoverOverlap || placeOn(order[0]);

  menuEl.style.left = chosen.left + 'px';
  menuEl.style.top  = chosen.top  + 'px';
}
