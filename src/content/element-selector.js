import { makeBox, makeBadge, placeBox, placeBadge, hide, elementLabel, removeLayer } from './content-highlight.js';
import { fitCanvas, prepCtx, drawGaps } from './measureDraw.js';
import { showContextMenu, hideContextMenu, destroyContextMenu } from './contextMenu.js';
import { isComposerOpen } from './comment-overlay.js';
import { ACCENT } from './overlayTokens.js';

let selectedElement = null;
let isActive = false;
let onSelectCallback = null;
let onClearCallback = null;
// When true, a plain click is ignored (passes through to the page); only
// ⌘/Ctrl-click selects. A one-shot "manual pick" temporarily overrides this.
let requireModifier = false;
let oneShotPick = false;
// When armed, hovering highlights without a modifier (used by comment mode so the
// user sees what they're about to comment) — but clicks are NOT captured for
// selection (the comment gesture owns the click). Distinct from oneShotPick, which
// arms a single plain-click *selection*.
let armedHover = false;
// The element currently under the cursor — re-highlighted when the modifier state
// changes so holding ⌘ / ⌘+Shift after the cursor stops still lights it.
let lastHoverTarget = null;

// Hover highlight (amber)
let hoverBox, hoverBadge;
// Selected highlight (blue)
let selectedBox, selectedBadge;
// Measurement canvas (live distance while hovering after selection)
let measureCanvas = null;

// ----- public API -----

export function initElementSelector(onSelect, { requireModifier: rm = false, onClear = null } = {}) {
  onSelectCallback = onSelect;
  onClearCallback = onClear;
  requireModifier = rm;
  oneShotPick = false;
  armedHover = false;
  isActive = true;
  hoverBox     = makeBox(`1px solid ${ACCENT.warning}`, ACCENT.warningMuted);
  hoverBadge   = makeBadge(ACCENT.warningBadge);
  selectedBox  = makeBox(`1px solid ${ACCENT.info}`, ACCENT.infoMuted);
  selectedBadge = makeBadge(ACCENT.infoBadge);

  document.addEventListener('mouseover', onHover, true);
  document.addEventListener('mouseout',  onOut,   true);
  document.addEventListener('click',     onClick, true);
  document.addEventListener('keydown',   onKey,   true);
  document.addEventListener('keydown',   onModKey, true);
  document.addEventListener('keyup',     onModKey, true);
}

export function deactivateElementSelector(keepSelected = false) {
  isActive = false;
  if (keepSelected) {
    // Remove only hover highlights; leave the selected box visible
    if (hoverBox)   { hoverBox.remove();   hoverBox   = null; }
    if (hoverBadge) { hoverBadge.remove(); hoverBadge = null; }
  } else {
    destroyHighlights();
  }
  destroyCanvas();
  destroyContextMenu();
  document.removeEventListener('mouseover', onHover, true);
  document.removeEventListener('mouseout',  onOut,   true);
  document.removeEventListener('click',     onClick, true);
  document.removeEventListener('keydown',   onKey,   true);
  document.removeEventListener('keydown',   onModKey, true);
  document.removeEventListener('keyup',     onModKey, true);
  lastHoverTarget = null;
}

// Clearing the selection is the single signal that nothing is selected any more — it
// fires onClearCallback so the panel can't outlive its selection (the panel is visible
// iff something is selected). Guarded on `had` so no-op clears (mode switches with
// nothing selected) don't post spurious CLEAR_SELECTION messages. onClearCallback must
// not call back into clearSelection.
export function clearSelection() {
  const had = selectedElement !== null;
  selectedElement = null;
  hide(selectedBox); hide(selectedBadge);
  hide(hoverBox);    hide(hoverBadge);
  destroyCanvas();
  if (had && onClearCallback) onClearCallback();
}

/** Arm a single plain-click selection (no modifier needed for the next click). */
export function armOneShotPick() {
  oneShotPick = true;
}

/** Toggle whether selection needs a ⌘/Ctrl modifier. Sticky inspect (toolbar) sets
 *  this off so a plain hover highlights and a plain click selects; momentary/idle set
 *  it on so nothing reacts until ⌘ is held. Re-evaluates the current hover so the
 *  highlight appears/disappears immediately. */
export function setRequireModifier(on) {
  requireModifier = !!on;
  if (isActive && lastHoverTarget) applyHover(lastHoverTarget, false);
}

/** Toggle armed-hover: highlight-on-hover without a modifier (comment mode). Does
 *  not affect click selection — the comment gesture claims those clicks. */
export function setArmed(on) {
  armedHover = !!on;
  if (!armedHover) { hide(hoverBox); hide(hoverBadge); }
}

export function getSelectedElement() {
  return selectedElement;
}

/** Programmatically select a DOM element (e.g. an ancestor). */
export function selectElement(el) {
  selectedElement = el;
  const rect = el.getBoundingClientRect();
  if (!selectedBox)  selectedBox  = makeBox(`1px solid ${ACCENT.info}`, ACCENT.infoMuted);
  if (!selectedBadge) selectedBadge = makeBadge(ACCENT.infoBadge);
  placeBox(selectedBox, rect);
  placeBadge(selectedBadge, rect, elementLabel(el));
  if (onSelectCallback) onSelectCallback(el);
}

// ----- handlers -----

function onHover(e) {
  if (!isActive) return;
  const t = e.target;
  if (isSidebar(t)) { lastHoverTarget = null; return; }
  lastHoverTarget = t;
  applyHover(t, e.metaKey || e.ctrlKey);
}

// Apply (or clear) the hover highlight for `t` given whether a ⌘/Ctrl modifier is
// held. Split out from onHover so a modifier keydown/keyup can re-run it for the
// element already under the cursor.
function applyHover(t, hasMod) {
  if (!t || !document.contains(t) || isSidebar(t)) { hide(hoverBox); hide(hoverBadge); return; }
  // Before anything is selected, keep the page untouched until ⌘/Ctrl is held (or a
  // one-shot pick / armed-hover mode is on) — no highlight, no measurement, no menu.
  if (requireModifier && !oneShotPick && !armedHover && !selectedElement && !hasMod) {
    hide(hoverBox); hide(hoverBadge);
    clearCanvas();
    hideContextMenu();
    return;
  }
  const rect = t.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  if (t === selectedElement) {
    hide(hoverBox); hide(hoverBadge);
    clearCanvas();
    return;
  }

  placeBox(hoverBox, rect);
  placeBadge(hoverBadge, rect, elementLabel(t));

  const selRect = selectedElement ? selectedElement.getBoundingClientRect() : null;
  if (selRect) {
    ensureCanvas();
    drawDistances(measureCanvas, selectedElement, t);
  }

  // Element-spec card — hidden in comment-armed hover or while a comment composer is
  // open (comment takes priority); shown only in true inspect hover.
  if (armedHover || isComposerOpen()) {
    hideContextMenu();
  } else {
    showContextMenu(t, rect, selRect);
  }
}

// Re-light the hovered element when a modifier key changes (⌘ / ⌘+Shift held after
// the cursor has stopped), so the highlight tracks the keys, not just mouse moves.
function onModKey(e) {
  if (!isActive || !lastHoverTarget) return;
  if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Shift') {
    applyHover(lastHoverTarget, e.metaKey || e.ctrlKey);
  }
}

function onOut(e) {
  if (!isActive) return;
  const t = e.target;
  if (t === selectedElement) return;
  hide(hoverBox); hide(hoverBadge);
  hideContextMenu();
  clearCanvas();
}

function onClick(e) {
  if (!isActive) return;
  const t = e.target;
  if (isSidebar(t)) return;

  // Decide whether this click is a selection. While nothing is selected, a
  // plain click is left alone so the page keeps working; only ⌘/Ctrl-click (or
  // an armed one-shot manual pick) captures the first element. Once we're in
  // inspect mode (something selected), a plain click switches selection.
  const shouldSelect = oneShotPick || !requireModifier || selectedElement || e.metaKey || e.ctrlKey;
  if (!shouldSelect) return;
  oneShotPick = false;

  e.preventDefault();
  e.stopPropagation();

  selectedElement = t;
  const rect = t.getBoundingClientRect();

  // Move hover highlight off
  hide(hoverBox); hide(hoverBadge);
  clearCanvas();

  // Blue selected highlight
  placeBox(selectedBox, rect);
  placeBadge(selectedBadge, rect, elementLabel(t));

  // Show context menu for selected element
  showContextMenu(t, rect);

  if (onSelectCallback) onSelectCallback(t);
}

function onKey(e) {
  if (e.key === 'Escape') clearSelection();
}

// ----- canvas measurement -----

function ensureCanvas() {
  if (measureCanvas && document.body.contains(measureCanvas)) return;
  measureCanvas = document.createElement('canvas');
  measureCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483645';
  fitCanvas(measureCanvas);
  document.body.appendChild(measureCanvas);
}

function clearCanvas() {
  if (!measureCanvas) return;
  prepCtx(measureCanvas);
}

function destroyCanvas() {
  if (measureCanvas) { measureCanvas.remove(); measureCanvas = null; }
}

function destroyHighlights() {
  [hoverBox, hoverBadge, selectedBox, selectedBadge].forEach(el => { if (el) el.remove(); });
  hoverBox = hoverBadge = selectedBox = selectedBadge = null;
}

// ----- distance drawing -----

function drawDistances(canvas, from, to) {
  if (!canvas) return;
  const ctx = prepCtx(canvas);
  const r1 = from.getBoundingClientRect();
  const r2 = to.getBoundingClientRect();
  drawGaps(ctx, r1, r2);
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
