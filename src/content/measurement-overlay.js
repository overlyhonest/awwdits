import { makeBox, makeBadge, placeBox, placeBadge, hide, elementLabel } from './content-highlight.js';
import { fitCanvas, prepCtx, drawGaps, drawDimLabel } from './measureDraw.js';
import { ACCENT } from './overlayTokens.js';

let first = null, second = null;
let isActive = false;
let onMeasureCallback = null;

// Highlights
let firstBox, firstBadge, hoverBox, hoverBadge;
let canvas = null;

export function initMeasurement(onMeasure) {
  isActive = true;
  onMeasureCallback = onMeasure;

  firstBox   = makeBox(`2px solid ${ACCENT.info}`, ACCENT.infoMuted);
  firstBadge = makeBadge(ACCENT.infoBadge);
  hoverBox   = makeBox(`2px solid ${ACCENT.success}`, ACCENT.successMuted);
  hoverBadge = makeBadge(ACCENT.successBadge);

  ensureCanvas();

  document.addEventListener('mouseover', onHover, true);
  document.addEventListener('mouseout',  onOut,   true);
  document.addEventListener('click',     onClick, true);
  document.addEventListener('keydown',   onKey,   true);
  window.addEventListener('resize', onResize);
}

export function clearMeasurement() {
  isActive = false;
  first = second = null;
  [firstBox, firstBadge, hoverBox, hoverBadge].forEach(el => { if (el) el.remove(); });
  firstBox = firstBadge = hoverBox = hoverBadge = null;
  destroyCanvas();
  document.removeEventListener('mouseover', onHover, true);
  document.removeEventListener('mouseout',  onOut,   true);
  document.removeEventListener('click',     onClick, true);
  document.removeEventListener('keydown',   onKey,   true);
  window.removeEventListener('resize', onResize);
}

// ----- handlers -----

function onHover(e) {
  if (!isActive) return;
  const t = e.target;
  if (isSidebar(t)) return;
  if (t === first || t === second) return;

  const rect = t.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  // Show green hover highlight
  placeBox(hoverBox, rect);
  placeBadge(hoverBadge, rect, elementLabel(t));

  // If first is selected, draw live measurement line
  if (first) drawMeasurement(canvas, first, t);
}

function onOut(e) {
  if (!isActive) return;
  const t = e.target;
  if (t === first || t === second) return;
  hide(hoverBox); hide(hoverBadge);
  clearCanvas();
}

function onClick(e) {
  if (!isActive) return;
  const t = e.target;
  if (isSidebar(t)) return;

  e.preventDefault();
  e.stopPropagation();

  if (!first) {
    // Select first element
    first = t;
    const rect = t.getBoundingClientRect();
    placeBox(firstBox, rect);
    placeBadge(firstBadge, rect, elementLabel(t));
  } else if (!second) {
    // Select second element — report measurement
    second = t;
    hide(hoverBox); hide(hoverBadge);
    drawMeasurement(canvas, first, second);

    if (onMeasureCallback) {
      const r1 = first.getBoundingClientRect();
      const r2 = second.getBoundingClientRect();
      onMeasureCallback({
        from: elementLabel(first),
        to:   elementLabel(second),
        horizontal: Math.round(r2.left > r1.right ? r2.left - r1.right : r1.left > r2.right ? r1.left - r2.right : 0),
        vertical:   Math.round(r2.top > r1.bottom ? r2.top - r1.bottom : r1.top > r2.bottom ? r1.top - r2.bottom : 0),
        direction: getDirection(r1, r2),
      });
    }
  } else {
    // Third click: reset
    first = second = null;
    clearCanvas();
    hide(firstBox); hide(firstBadge);
    const rect = t.getBoundingClientRect();
    first = t;
    placeBox(firstBox, rect);
    placeBadge(firstBadge, rect, elementLabel(t));
  }
}

function onKey(e) {
  if (e.key === 'Escape') clearMeasurement();
}

function onResize() {
  if (canvas) fitCanvas(canvas);
}

// ----- canvas -----

function ensureCanvas() {
  if (canvas && document.body.contains(canvas)) return;
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483644';
  fitCanvas(canvas);
  document.body.appendChild(canvas);
}

function clearCanvas() {
  if (!canvas) return;
  prepCtx(canvas);
}

function destroyCanvas() {
  if (canvas) { canvas.remove(); canvas = null; }
}

// ----- drawing -----

function drawMeasurement(cvs, from, to) {
  if (!cvs) return;
  const ctx = prepCtx(cvs);
  const r1 = from.getBoundingClientRect();
  const r2 = to.getBoundingClientRect();
  drawDimLabel(ctx, r1);
  drawDimLabel(ctx, r2);
  drawGaps(ctx, r1, r2);
}

function getDirection(r1, r2) {
  const parts = [];
  if (r2.top > r1.bottom) parts.push('below');
  else if (r1.top > r2.bottom) parts.push('above');
  if (r2.left > r1.right) parts.push('right');
  else if (r1.left > r2.right) parts.push('left');
  return parts.join('-') || 'overlapping';
}

function isSidebar(el) {
  return !!(el.closest && (
    el.closest('#awwdits-sidebar-container') ||
    el.closest('#awwdits-hl') ||
    el.closest('#awwdits-comments') ||
    el.closest('#awwdits-toolbar') ||
    el.closest('#awwdits-changes-pop') ||
    el.closest('#awwdits-mark-menu')
  ));
}
