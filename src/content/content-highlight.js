// Shared overlay highlight utilities (pointer-events: none layer)
import { ACCENT, FONT, SIZE, WEIGHT } from './overlayTokens.js';

let layer = null;

export function getLayer() {
  if (layer && document.body.contains(layer)) return layer;
  layer = document.createElement('div');
  layer.id = 'awwdits-hl';
  layer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483644;pointer-events:none;overflow:visible';
  document.body.appendChild(layer);
  return layer;
}

export function removeLayer() {
  if (layer) { layer.remove(); layer = null; }
}

export function makeBox(border, bg) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;box-sizing:border-box;pointer-events:none;border-radius:2px;display:none;border:${border};background:${bg}`;
  getLayer().appendChild(el);
  return el;
}

// A badge shows a selector — data, so JetBrains Mono. `bgColor` must be an ACCENT.*Badge
// shade; those are the variants dark enough to carry ACCENT.onAccent text.
export function makeBadge(bgColor) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;font:${WEIGHT.medium} ${SIZE.base}/1.3 ${FONT.mono};padding:2px 7px;border-radius:3px;white-space:nowrap;pointer-events:none;display:none;background:${bgColor};color:${ACCENT.onAccent};max-width:220px;overflow:hidden;text-overflow:ellipsis`;
  getLayer().appendChild(el);
  return el;
}

export function placeBox(box, rect) {
  box.style.left = Math.round(rect.left) + 'px';
  box.style.top = Math.round(rect.top) + 'px';
  box.style.width = Math.round(rect.width) + 'px';
  box.style.height = Math.round(rect.height) + 'px';
  box.style.display = 'block';
}

export function placeBadge(badge, rect, text) {
  const h = 22;
  const top = rect.top >= h + 5 ? rect.top - h - 2 : rect.bottom + 2;
  badge.textContent = text;
  badge.style.left = Math.max(4, rect.left) + 'px';
  badge.style.top = top + 'px';
  badge.style.display = 'block';
}

export function hide(el) {
  if (el) el.style.display = 'none';
}

export function elementLabel(el) {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `#${el.id}`;
  const cls = Array.from(el.classList)
    .filter(c => !c.includes(':') && !c.includes('[') && c.length < 30)
    .slice(0, 2);
  if (cls.length) return `${tag}.${cls.join('.')}`;
  return tag;
}
