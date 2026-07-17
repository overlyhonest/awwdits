/**
 * Shared Chrome-style measurement drawing utilities.
 * All coordinates are in logical CSS pixels; DPR scaling is applied internally.
 */

import { ACCENT, COLORS, FONT, WEIGHT } from './overlayTokens.js';

const LINE_COLOR  = ACCENT.destructive;
const LABEL_BG    = COLORS.bg;
const LABEL_COLOR = COLORS.fg;
const CAP         = 4;    // half-length of perpendicular end cap, px
const LINE_W      = 1;
// Measurements are data — mono, like every other number awwdits shows.
const LABEL_FONT  = `${WEIGHT.medium} 10px ${FONT.mono}`;
const DIM_FONT    = `${WEIGHT.medium} 10px ${FONT.mono}`;

/** Resize a canvas for the current viewport + devicePixelRatio. */
export function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w   = window.innerWidth;
  const h   = window.innerHeight;
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
}

/** Clear the canvas and return a DPR-scaled context. */
export function prepCtx(canvas) {
  fitCanvas(canvas);
  const dpr = window.devicePixelRatio || 1;
  const ctx  = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // reset + scale in one call
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  return ctx;
}

function clamp(v, lo, hi) {
  return lo >= hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
}

/** Draw a rounded-rect label pill. Returns nothing; mutates ctx fill. */
function labelPill(ctx, cx, cy, text) {
  const tw  = ctx.measureText(text).width;
  const pw  = tw + 10;
  const ph  = 16;
  const px  = cx - pw / 2;
  const py  = cy - ph / 2;
  const r   = 3;

  ctx.fillStyle = LABEL_BG;
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.lineTo(px + pw - r, py);
  ctx.arcTo(px + pw, py,      px + pw, py + r,      r);
  ctx.lineTo(px + pw, py + ph - r);
  ctx.arcTo(px + pw, py + ph, px + pw - r, py + ph, r);
  ctx.lineTo(px + r, py + ph);
  ctx.arcTo(px,      py + ph, px,      py + ph - r, r);
  ctx.lineTo(px,     py + r);
  ctx.arcTo(px,      py,      px + r,  py,          r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = LABEL_COLOR;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

/** Draw a horizontal measurement line at y from x1→x2 with end caps and a label. */
function hLine(ctx, x1, x2, y, label) {
  const lx = Math.round(Math.min(x1, x2)) + 0.5;
  const rx = Math.round(Math.max(x1, x2)) + 0.5;
  const ly = Math.round(y) + 0.5;
  if (rx - lx < 2) return;

  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth   = LINE_W;
  ctx.setLineDash([]);

  // Main line
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(rx, ly);
  ctx.stroke();

  // Left end cap
  ctx.beginPath();
  ctx.moveTo(lx, ly - CAP);
  ctx.lineTo(lx, ly + CAP);
  ctx.stroke();

  // Right end cap
  ctx.beginPath();
  ctx.moveTo(rx, ly - CAP);
  ctx.lineTo(rx, ly + CAP);
  ctx.stroke();

  ctx.font = LABEL_FONT;
  labelPill(ctx, (lx + rx) / 2, ly, label);
}

/** Draw a vertical measurement line at x from y1→y2 with end caps and a label. */
function vLine(ctx, y1, y2, x, label) {
  const ty = Math.round(Math.min(y1, y2)) + 0.5;
  const by = Math.round(Math.max(y1, y2)) + 0.5;
  const lx = Math.round(x) + 0.5;
  if (by - ty < 2) return;

  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth   = LINE_W;
  ctx.setLineDash([]);

  // Main line
  ctx.beginPath();
  ctx.moveTo(lx, ty);
  ctx.lineTo(lx, by);
  ctx.stroke();

  // Top end cap
  ctx.beginPath();
  ctx.moveTo(lx - CAP, ty);
  ctx.lineTo(lx + CAP, ty);
  ctx.stroke();

  // Bottom end cap
  ctx.beginPath();
  ctx.moveTo(lx - CAP, by);
  ctx.lineTo(lx + CAP, by);
  ctx.stroke();

  ctx.font = LABEL_FONT;
  labelPill(ctx, lx, (ty + by) / 2, label);
}

/**
 * Draw Chrome-style gap measurements between two bounding rects.
 * r1 = source (selected), r2 = target (hovered).
 * Draws horizontal gap, vertical gap, or overlapping distance.
 */
export function drawGaps(ctx, r1, r2) {
  let drew = false;

  // Horizontal gap
  if (r2.left >= r1.right) {
    const gap = Math.round(r2.left - r1.right);
    if (gap > 0) {
      const y = clamp(
        (r1.top + r1.bottom) / 2,
        Math.max(r1.top, r2.top) + 2,
        Math.min(r1.bottom, r2.bottom) - 2,
      );
      hLine(ctx, r1.right, r2.left, y, `${gap}`);
      drew = true;
    }
  } else if (r1.left >= r2.right) {
    const gap = Math.round(r1.left - r2.right);
    if (gap > 0) {
      const y = clamp(
        (r1.top + r1.bottom) / 2,
        Math.max(r1.top, r2.top) + 2,
        Math.min(r1.bottom, r2.bottom) - 2,
      );
      hLine(ctx, r2.right, r1.left, y, `${gap}`);
      drew = true;
    }
  }

  // Vertical gap
  if (r2.top >= r1.bottom) {
    const gap = Math.round(r2.top - r1.bottom);
    if (gap > 0) {
      const x = clamp(
        (r1.left + r1.right) / 2,
        Math.max(r1.left, r2.left) + 2,
        Math.min(r1.right, r2.right) - 2,
      );
      vLine(ctx, r1.bottom, r2.top, x, `${gap}`);
      drew = true;
    }
  } else if (r1.top >= r2.bottom) {
    const gap = Math.round(r1.top - r2.bottom);
    if (gap > 0) {
      const x = clamp(
        (r1.left + r1.right) / 2,
        Math.max(r1.left, r2.left) + 2,
        Math.min(r1.right, r2.right) - 2,
      );
      vLine(ctx, r2.bottom, r1.top, x, `${gap}`);
      drew = true;
    }
  }

  // Overlapping or same element: draw distances from each edge of r1 to the nearest edge of r2
  if (!drew) {
    const dx = Math.round(Math.abs((r2.left + r2.right) / 2 - (r1.left + r1.right) / 2));
    const dy = Math.round(Math.abs((r2.top  + r2.bottom) / 2 - (r1.top  + r1.bottom) / 2));
    const cx1 = (r1.left + r1.right) / 2, cy1 = (r1.top + r1.bottom) / 2;
    const cx2 = (r2.left + r2.right) / 2, cy2 = (r2.top + r2.bottom) / 2;
    if (dx > 1) hLine(ctx, cx1, cx2, (cy1 + cy2) / 2, `${dx}`);
    if (dy > 1) vLine(ctx, cy1, cy2, (cx1 + cx2) / 2, `${dy}`);
  }
}

/**
 * Draw a small element dimension label (WxH) below/above the element rect.
 */
export function drawDimLabel(ctx, rect) {
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (w <= 0 || h <= 0) return;
  const label = `${w} × ${h}`;
  ctx.font = DIM_FONT;
  const tw  = ctx.measureText(label).width;
  const pw  = tw + 10;
  const ph  = 16;
  const cx  = clamp((rect.left + rect.right) / 2, pw / 2 + 4, window.innerWidth - pw / 2 - 4);
  const cy  = rect.bottom + 4 + ph / 2 < window.innerHeight - 4
    ? rect.bottom + 4 + ph / 2
    : rect.top - 4 - ph / 2;

  ctx.fillStyle = ACCENT.infoBadge;   // the selected-element hue, dark enough for white text
  const px = cx - pw / 2, py = cy - ph / 2, r = 3;
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.lineTo(px + pw - r, py);
  ctx.arcTo(px + pw, py,      px + pw, py + r,      r);
  ctx.lineTo(px + pw, py + ph - r);
  ctx.arcTo(px + pw, py + ph, px + pw - r, py + ph, r);
  ctx.lineTo(px + r, py + ph);
  ctx.arcTo(px,      py + ph, px,      py + ph - r, r);
  ctx.lineTo(px,     py + r);
  ctx.arcTo(px,      py,      px + r,  py,          r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle    = ACCENT.onAccent;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
}
