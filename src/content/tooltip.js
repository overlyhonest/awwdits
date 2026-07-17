// Custom tooltip for the page-context overlays (toolbar, popover actions). Replaces the
// native `title=` tooltip — which is slow (~1.5s), unstyleable, wrong-colored, and clashes
// with the dark chrome. One shared element, positioned under (or over) the hovered target
// after a short delay, with the label in the toolbar's display face and the shortcut shown
// as tactile keycap chips. Fonts (Special Gothic / JetBrains Mono) are injected by the
// toolbar, so the tooltip inherits them for free.
//
// attachTooltip(el, spec) — spec: { label, keys?: string[], click?: boolean }
//   keys render as chips (e.g. ['⌘','⇧']); click appends a "+ click" hint.

import { COLORS, FONT, SIZE, WEIGHT } from './overlayTokens.js';

const TIP_ID = 'awwdits-tooltip';
const Z = 2147483647;
const SHOW_DELAY = 340;   // ms before it appears — long enough not to nag, short enough to help
const GAP = 9;            // px between target and tooltip

const reduceMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

let tip = null, label = null, shortcut = null, showTimer = null;

function ensureTip() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.id = TIP_ID;
  tip.style.cssText =
    `position:fixed;left:0;top:0;z-index:${Z};pointer-events:none;opacity:0;` +
    `display:flex;flex-direction:column;gap:5px;align-items:flex-start;` +
    `padding:8px 10px;border-radius:10px;background:${COLORS.bg};border:1px solid ${COLORS.border};` +
    'box-shadow:0 12px 32px -10px rgba(0,0,0,.75),0 2px 8px rgba(0,0,0,.4);' +
    `font:${SIZE.md} ${FONT.sans};color:${COLORS.fg};white-space:nowrap;` +
    (reduceMotion() ? '' : 'transform:translateY(3px);transition:opacity .13s ease,transform .13s ease');

  // No positive tracking — the system tracks −1.5%, so letter-spacing is left to inherit.
  label = document.createElement('div');
  label.style.cssText = `font:${SIZE.md} ${FONT.sans};color:${COLORS.fg};line-height:1`;
  tip.appendChild(label);

  shortcut = document.createElement('div');
  shortcut.style.cssText = 'display:flex;align-items:center;gap:5px';
  tip.appendChild(shortcut);

  document.body.appendChild(tip);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide, true);
  return tip;
}

// A single tactile keycap chip. Same raised surface as the toolbar's count badge
// (COLORS.active), so a keycap and a badge read as the same material.
function keycap(txt) {
  const k = document.createElement('span');
  k.textContent = txt;
  k.style.cssText =
    'display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;padding:0 5px;' +
    `border-radius:5px;background:${COLORS.active};border:1px solid ${COLORS.border};` +
    'box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 1px 1.5px rgba(0,0,0,.35);' +
    `font:${WEIGHT.medium} ${SIZE.sm} ${FONT.mono};color:${COLORS.fg};line-height:1`;
  return k;
}

function renderShortcut(keys, click) {
  shortcut.textContent = '';
  const hasKeys = Array.isArray(keys) && keys.length;
  if (!hasKeys && !click) { shortcut.style.display = 'none'; return; }
  shortcut.style.display = 'flex';
  if (hasKeys) keys.forEach(k => shortcut.appendChild(keycap(k)));
  if (click) {
    if (hasKeys) {
      const plus = document.createElement('span');
      plus.textContent = '+';
      plus.style.cssText = `color:${COLORS.label};font:${SIZE.sm} ${FONT.mono}`;
      shortcut.appendChild(plus);
    }
    const word = document.createElement('span');
    word.textContent = 'click';
    word.style.cssText = `color:${COLORS.label};font:${SIZE.sm} ${FONT.sans}`;
    shortcut.appendChild(word);
  }
}

function showFor(target, spec) {
  ensureTip();
  label.textContent = spec.label || '';
  renderShortcut(spec.keys, spec.click);

  // Measure while hidden, then place. Below the target by default; flip above near the
  // viewport bottom. Centered on the target, clamped to the viewport.
  tip.style.opacity = '0';
  tip.style.left = '-9999px';
  tip.style.top = '0';
  const tw = tip.offsetWidth, th = tip.offsetHeight; // forces layout
  const r = target.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  let top = r.bottom + GAP;
  if (top + th > window.innerHeight - 8) top = r.top - GAP - th;
  let left = cx - tw / 2;
  left = Math.max(8, Math.min(window.innerWidth - tw - 8, left));
  tip.style.left = Math.round(left) + 'px';
  tip.style.top = Math.round(top) + 'px';

  requestAnimationFrame(() => {
    if (!tip) return;
    tip.style.opacity = '1';
    tip.style.transform = 'translateY(0)';
  });
}

function hide() {
  clearTimeout(showTimer);
  showTimer = null;
  if (!tip) return;
  tip.style.opacity = '0';
  if (!reduceMotion()) tip.style.transform = 'translateY(3px)';
}

// Attach a tooltip to an element. Returns the element for chaining.
export function attachTooltip(el, spec) {
  if (!el) return el;
  el.addEventListener('mouseenter', () => {
    clearTimeout(showTimer);
    showTimer = setTimeout(() => showFor(el, spec), SHOW_DELAY);
  });
  el.addEventListener('mouseleave', hide);
  el.addEventListener('mousedown', hide); // a click dismisses it immediately
  return el;
}

export function destroyTooltip() {
  clearTimeout(showTimer);
  showTimer = null;
  window.removeEventListener('scroll', hide, true);
  window.removeEventListener('resize', hide, true);
  if (tip) { tip.remove(); tip = null; label = null; shortcut = null; }
}
