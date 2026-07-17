// On-page comment overlay (vanilla DOM, PAGE context — no token shim; explicit
// colors like the other overlays). Renders one pin per commented element into a
// fixed layer and reports pin clicks + composer saves back through callbacks.
//
// Pins are page annotations: they persist for the lifetime of the page load,
// independent of the panel. Closing the panel keeps the pins (and their
// scroll/resize tracking) so they stay anchored to their elements until reload.
// A pin click is the shortcut back into editing — the content script reopens the
// panel, selects the element, and opens the composer prefilled. State lives in
// the panel; this module only renders + reports.
import { positionPin, PIN_SIZE } from './commentOverlayGeometry.js';
import { buildSelector } from '../utils/extractors/styleExtractor.js';
import { buildPath, locateElement, pathToSelector } from '../utils/helpers/domPath.js';
import { COLORS, COMMENT, FONT, SIZE, WEIGHT, ensureOverlayFonts } from './overlayTokens.js';

const LAYER_ID = 'awwdits-comments';
const Z = 2147483646;

let layer = null;
let entries = [];   // [{ selector, path, comment, pinEl }]
let onSaveCb = null;
let onPinClickCb = null;
let composer = null; // { root, target, onDoc } | null
let bodyRO = null;
let rafPending = false;

// ---- lifecycle ----

export function initCommentOverlay({ onSave, onPinClick } = {}) {
  onSaveCb = onSave || null;
  onPinClickCb = onPinClick || null;
  ensureOverlayFonts();
  if (!layer) {
    layer = document.createElement('div');
    layer.id = LAYER_ID;
    layer.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:${Z}`;
    document.body.appendChild(layer);
    window.addEventListener('scroll', scheduleReposition, true);
    window.addEventListener('resize', scheduleReposition);
    bodyRO = new ResizeObserver(scheduleReposition);
    bodyRO.observe(document.documentElement);
  }
}

// Close the composer but KEEP pins + tracking listeners alive, so pins persist on
// the page after the panel is dismissed (until reload). Called on panel close.
export function closeEditors() {
  closeComposer();
}

// Whether a comment composer is currently open — inspect overlays defer to it.
export function isComposerOpen() {
  return !!composer;
}

// ---- pins ----

export function setComments(list) {
  if (!layer) return; // overlay not initialized yet — ignore
  // Remove ALL pins in the layer (robust against any pin not tracked in `entries`,
  // so "clear all" never leaves an orphaned bubble behind).
  layer.querySelectorAll('.awwdits-pin').forEach(p => p.remove());
  entries = (list || []).map((c, i) => {
    const pinEl = makePin(i + 1);
    pinEl.addEventListener('click', ev => {
      ev.stopPropagation();
      const en = entryFor(pinEl);
      if (en && onPinClickCb) onPinClickCb({ selector: en.selector, path: en.path, comment: en.comment });
    });
    layer.appendChild(pinEl);
    return { selector: c.selector, path: c.path || [], comment: c.comment, pinEl };
  });
  reposition();
}

// Match by unique path (falls back to selector) so the right pin pulses even when a
// selector repeats across the page.
function entryKey(e) { return (Array.isArray(e.path) && e.path.length ? pathToSelector(e.path) : '') || e.selector || ''; }
export function pulsePin(selector, path) {
  const key = (Array.isArray(path) && path.length ? pathToSelector(path) : '') || selector;
  const entry = entries.find(e => entryKey(e) === key);
  if (!entry) return;
  entry.pinEl.style.transition = 'transform 0.15s ease';
  entry.pinEl.style.transform = 'scale(1.4)';
  setTimeout(() => { entry.pinEl.style.transform = 'scale(1)'; }, 200);
}

function entryFor(pinEl) { return entries.find(e => e.pinEl === pinEl) || null; }

// Figma-style comment pin (design node 2125:2452): a gradient teardrop bubble with
// a sharp bottom-left tail, a soft shadow, and its 1-based index in white. PIN_SIZE
// drives both the visual size and the geometry, so the two never drift.
function makePin(number) {
  const el = document.createElement('div');
  el.className = 'awwdits-pin';
  el.style.cssText =
    `position:fixed;width:${PIN_SIZE}px;height:${PIN_SIZE}px;box-sizing:border-box;` +
    'border-radius:50% 50% 50% 2px;' +
    'box-shadow:0 2px 10px rgba(0,0,0,0.28);cursor:pointer;display:none;' +
    'align-items:center;justify-content:center;pointer-events:auto;' +
    `background:${COMMENT.gradient}`;
  const n = document.createElement('span');
  n.textContent = number;
  // 600 is loaded for JetBrains Mono in page context (overlayTokens), so this is a real
  // weight rather than the synthetic bold it used to render as.
  n.style.cssText = `color:${COMMENT.onPin};font:${WEIGHT.semibold} 14px/1 ${FONT.mono}`;
  el.appendChild(n);
  return el;
}

function findTarget(entry) {
  return locateElement(entry.selector, entry.path);
}

function describe(el) {
  const selector = buildSelector(el);
  return { selector, path: buildPath(el), label: selector };
}

// ---- positioning ----

function scheduleReposition() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; reposition(); });
}

export function reposition() {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  for (const entry of entries) {
    const el = findTarget(entry);
    if (!el) { entry.pinEl.style.display = 'none'; continue; }
    const { left, top, visible } = positionPin(el.getBoundingClientRect(), viewport);
    entry.pinEl.style.left = `${left}px`;
    entry.pinEl.style.top = `${top}px`;
    entry.pinEl.style.display = visible ? 'flex' : 'none';
  }
  if (composer) positionCard(composer.root, composer.target);
}

// ---- composer ----

// A persistent highlight around the element a comment is open on, so it stays
// marked while the composer is up. Sits under the composer card, tracks scroll/resize.
function makeCommentHL() {
  const box = document.createElement('div');
  box.style.cssText =
    `position:fixed;pointer-events:none;box-sizing:border-box;border:2px solid ${COMMENT.solid};` +
    `border-radius:3px;background:${COMMENT.muted};display:none`;
  return box;
}
function positionCommentHL(box, el) {
  const r = el.getBoundingClientRect();
  box.style.left = `${r.left}px`;
  box.style.top = `${r.top}px`;
  box.style.width = `${r.width}px`;
  box.style.height = `${r.height}px`;
  box.style.display = 'block';
}

export function openComposerFor(element, prefill = '') {
  if (!element || !layer) return;
  closeComposer();

  // Highlight the commented element first (appended before the card so it sits under it).
  const hl = makeCommentHL();
  layer.appendChild(hl);
  positionCommentHL(hl, element);

  const root = document.createElement('div');
  root.style.cssText = cardCss();

  // Entity label (the commented element's selector), per the Figma comment card. A
  // selector is data, so it stays mono — but at COLORS.label, since 12px text needs AA.
  const label = document.createElement('div');
  label.textContent = buildSelector(element);
  label.style.cssText =
    `font:${SIZE.md}/1.4 ${FONT.mono};color:${COLORS.label};margin-bottom:8px;` +
    'max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  root.appendChild(label);

  // What you type here is prose, so it's set in the prose face — mono is for data.
  const ta = document.createElement('textarea');
  ta.value = prefill || '';
  ta.placeholder = 'Comment…';
  ta.style.cssText =
    'display:block;width:240px;min-height:56px;resize:vertical;border:none;border-radius:8px;padding:10px 12px;' +
    `background:${COLORS.active};font:${SIZE.base}/18px ${FONT.sans};color:${COLORS.fg};outline:none;box-sizing:border-box`;
  root.appendChild(ta);
  layer.appendChild(root);

  const save = () => {
    const text = ta.value.trim();
    const t = describe(element);
    closeComposer();
    if (onSaveCb) onSaveCb({ selector: t.selector, path: t.path, label: t.label, text });
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeComposer(); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
  };
  const onDoc = (e) => { if (!root.contains(e.target)) save(); }; // click-away saves

  ta.addEventListener('keydown', onKey);
  // Defer the doc listener a tick so the click that opened the composer
  // doesn't immediately count as a click-away.
  setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);

  composer = { root, target: element, onDoc, hl };
  positionCard(root, element);
  ta.focus();
}

function closeComposer() {
  if (!composer) return;
  document.removeEventListener('mousedown', composer.onDoc, true);
  if (composer.hl) composer.hl.remove();
  composer.root.remove();
  composer = null;
}

// ---- shared bits ----

function cardCss() {
  return `position:fixed;background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:14px;` +
    'box-shadow:0 26px 64px -18px rgba(0,0,0,0.85);padding:14px;pointer-events:auto;box-sizing:border-box';
}

function positionCard(root, element) {
  const r = element.getBoundingClientRect();
  const cw = root.offsetWidth || 260;
  const ch = root.offsetHeight || 100;
  let left = r.right + 8;
  let top = r.top;
  if (left + cw > window.innerWidth) left = Math.max(8, r.left - cw - 8);
  if (top + ch > window.innerHeight) top = Math.max(8, window.innerHeight - ch - 8);
  if (top < 8) top = 8;
  root.style.left = `${left}px`;
  root.style.top = `${top}px`;
}
