// Floating toolbar (vanilla DOM, PAGE context — explicit hex, dark chrome, like the
// other overlays). The persistent hub: a drag grip, inspect / comment / measure
// modes, and a Changes chip. Layout follows the Figma design (node 2114:2257);
// colors are awwdits' own dark tokens (see COLORS). Icons are Tabler *filled*
// silhouettes. All behavior is delegated through callbacks; the content script owns
// the modes/state.
import { loadToolbarPos, saveToolbarPos } from './toolbarStorage.js';
import { clampToolbarPos, defaultToolbarPos } from './toolbarGeometry.js';
import { attachTooltip, destroyTooltip } from './tooltip.js';
import { COLORS, FONT, SIZE, ensureOverlayFonts } from './overlayTokens.js';

const BAR_ID = 'awwdits-toolbar';
const Z = 2147483646;

// Tabler filled icon silhouettes (verbatim paths from @tabler/icons). grip-vertical
// has no filled variant, so it stays outline. All use currentColor.
const SVG = {
  grip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M14 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>',
  inspect: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a1 1 0 0 1 1 1v1.055a9.004 9.004 0 0 1 7.946 7.945h1.054a1 1 0 0 1 0 2h-1.055a9.004 9.004 0 0 1 -7.944 7.945l-.001 1.055a1 1 0 0 1 -2 0v-1.055a9.004 9.004 0 0 1 -7.945 -7.944l-1.055 -.001a1 1 0 0 1 0 -2h1.055a9.004 9.004 0 0 1 7.945 -7.945v-1.055a1 1 0 0 1 1 -1m0 4a7 7 0 1 0 0 14a7 7 0 0 0 0 -14m0 3a4 4 0 1 1 -4 4l.005 -.2a4 4 0 0 1 3.995 -3.8" /></svg>',
  comment: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 3a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-4.724l-4.762 2.857a1 1 0 0 1 -1.508 -.743l-.006 -.114v-2h-1a4 4 0 0 1 -3.995 -3.8l-.005 -.2v-8a4 4 0 0 1 4 -4zm-4 9h-6a1 1 0 0 0 0 2h6a1 1 0 0 0 0 -2m2 -4h-8a1 1 0 1 0 0 2h8a1 1 0 0 0 0 -2" /></svg>',
  measure: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.707 3.293a1 1 0 0 1 .083 1.32l-.083 .094l-1.292 1.293h4.585a1 1 0 0 1 .117 1.993l-.117 .007h-4.585l1.292 1.293a1 1 0 0 1 .083 1.32l-.083 .094a1 1 0 0 1 -1.32 .083l-.094 -.083l-3 -3a1.008 1.008 0 0 1 -.097 -.112l-.071 -.11l-.054 -.114l-.035 -.105l-.025 -.118l-.007 -.058l-.004 -.09l.003 -.075l.017 -.126l.03 -.111l.044 -.111l.052 -.098l.064 -.092l.083 -.094l3 -3a1 1 0 0 1 1.414 0z" /><path d="M18.613 3.21l.094 .083l3 3a.927 .927 0 0 1 .097 .112l.071 .11l.054 .114l.035 .105l.03 .148l.006 .118l-.003 .075l-.017 .126l-.03 .111l-.044 .111l-.052 .098l-.074 .104l-.073 .082l-3 3a1 1 0 0 1 -1.497 -1.32l.083 -.094l1.292 -1.293h-4.585a1 1 0 0 1 -.117 -1.993l.117 -.007h4.585l-1.292 -1.293a1 1 0 0 1 -.083 -1.32l.083 -.094a1 1 0 0 1 1.32 -.083z" /><path d="M18 13h-12a3 3 0 0 0 -3 3v2a3 3 0 0 0 3 3h12a3 3 0 0 0 3 -3v-2a3 3 0 0 0 -3 -3z" /></svg>',
  versions: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 4h-6a3 3 0 0 0 -3 3v10a3 3 0 0 0 3 3h6a3 3 0 0 0 3 -3v-10a3 3 0 0 0 -3 -3z" /><path d="M7 6a1 1 0 0 1 .993 .883l.007 .117v10a1 1 0 0 1 -1.993 .117l-.007 -.117v-10a1 1 0 0 1 1 -1z" /><path d="M4 7a1 1 0 0 1 .993 .883l.007 .117v8a1 1 0 0 1 -1.993 .117l-.007 -.117v-8a1 1 0 0 1 1 -1z" /></svg>',
  x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.707 5.293l5.293 5.292l5.293 -5.292a1 1 0 0 1 1.414 1.414l-5.292 5.293l5.292 5.293a1 1 0 0 1 -1.414 1.414l-5.293 -5.292l-5.293 5.292a1 1 0 1 1 -1.414 -1.414l5.292 -5.293l-5.292 -5.293a1 1 0 0 1 1.414 -1.414" /></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.926 7.074a3.67 3.67 0 0 1 1.074 2.593v8.666a3.667 3.667 0 0 1 -3.667 3.667h-8.666a3.667 3.667 0 0 1 -3.667 -3.667v-8.666q 0 -.053 .005 -.102a3.66 3.66 0 0 1 3.662 -3.565h8.666c.973 0 1.905 .386 2.593 1.074" /><path d="M17.374 3.514a1 1 0 1 1 -1.748 .972c-.221 -.398 -.342 -.486 -.626 -.486h-10c-.548 0 -1 .452 -1 1v9.998c0 .36 .194 .692 .507 .87a1 1 0 1 1 -.99 1.738a3 3 0 0 1 -1.517 -2.606v-10c0 -1.652 1.348 -3 3 -3h10c1.094 0 1.828 .533 2.374 1.514" /></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>',
};

let bar = null, cb = {}, dragMove = null, dragUp = null;

export function initToolbar(callbacks = {}) {
  cb = callbacks;
  if (bar) return handle();
  ensureOverlayFonts();

  bar = document.createElement('div');
  bar.id = BAR_ID;
  bar.style.cssText =
    `position:fixed;left:0;top:0;z-index:${Z};display:flex;align-items:center;gap:4px;box-sizing:border-box;` +
    `padding:6px 8px;border-radius:14px;background:${COLORS.bg};border:1px solid ${COLORS.border};` +
    'box-shadow:0 16px 40px -12px rgba(0,0,0,.7),0 2px 8px rgba(0,0,0,.4);' +
    `font:${SIZE.base} ${FONT.sans};color:${COLORS.fg};user-select:none`;

  bar.appendChild(makeGrip());
  bar.appendChild(divider());

  const tools = document.createElement('div');
  tools.style.cssText = 'display:flex;align-items:center;gap:2px';
  tools.appendChild(toolBtn('inspect', SVG.inspect, { label: 'Inspect', keys: ['⌘'], click: true }));
  tools.appendChild(toolBtn('comment', SVG.comment, { label: 'Comment', keys: ['⌘', '⇧'], click: true }));
  tools.appendChild(toolBtn('measure', SVG.measure, { label: 'Measure', keys: ['X'], click: true }));
  bar.appendChild(tools);

  bar.appendChild(divider());
  bar.appendChild(makeChip());
  bar.appendChild(makeCopyBtn());
  bar.appendChild(divider());
  bar.appendChild(iconBtn(SVG.x, { label: 'Close', aria: 'Close awwdits' }, () => cb.onClose && cb.onClose()));

  document.body.appendChild(bar);
  positionInitial();
  // No tool is highlighted at rest — a tool lights up only when its mode is engaged.
  return handle();
}

// ---- pieces ----
function svgBox(markup, size = 20) {
  const s = document.createElement('span');
  s.style.cssText = `width:${size}px;height:${size}px;display:block;flex:none`;
  s.innerHTML = markup;
  return s;
}

function baseBtn() {
  const b = document.createElement('button');
  b.type = 'button';
  b.style.cssText =
    `width:40px;height:40px;border-radius:9px;border:none;background:transparent;color:${COLORS.weak};` +
    'display:grid;place-items:center;cursor:pointer;position:relative;transition:background .12s,color .12s;flex:none';
  b.addEventListener('mouseenter', () => { if (!b.dataset.on) { b.style.background = COLORS.hover; b.style.color = COLORS.fg; } });
  b.addEventListener('mouseleave', () => { if (!b.dataset.on) { b.style.background = 'transparent'; b.style.color = COLORS.weak; } });
  return b;
}
// aria-label for a11y + the custom (styled) tooltip in place of a native `title`.
function setTip(el, spec) { el.setAttribute('aria-label', spec.aria || spec.label); attachTooltip(el, spec); return el; }
function iconBtn(svg, spec, onClick) { const b = baseBtn(); setTip(b, spec); b.appendChild(svgBox(svg)); b.addEventListener('click', onClick); return b; }
function divider() { const d = document.createElement('div'); d.style.cssText = `width:1px;height:24px;background:${COLORS.divider};flex:none;margin:0 2px`; return d; }

function toolBtn(name, svg, spec) {
  const b = baseBtn(); setTip(b, spec); b.dataset.tool = name; b.appendChild(svgBox(svg));
  const key = { inspect: 'onInspect', comment: 'onComment', measure: 'onMeasure' }[name];
  b.addEventListener('click', () => { const fn = cb[key]; if (fn) fn(); });
  return b;
}

function makeGrip() {
  const g = document.createElement('div');
  g.id = 'awwdits-toolbar-grip';
  setTip(g, { label: 'Drag to move' });
  g.style.cssText = `width:24px;height:40px;display:grid;place-items:center;cursor:grab;color:${COLORS.weak};flex:none`;
  g.appendChild(svgBox(SVG.grip));
  wireDrag(g);
  return g;
}

function makeChip() {
  const c = document.createElement('button');
  // No tooltip: the chip already shows its "Changes" label + count.
  c.type = 'button'; c.id = 'awwdits-changes-chip';
  c.style.cssText =
    `display:flex;align-items:center;gap:8px;height:40px;padding:0 12px 0 10px;border-radius:9px;` +
    `border:none;background:transparent;color:${COLORS.muted};cursor:pointer;transition:background .12s,color .12s;flex:none`;
  c.appendChild(svgBox(SVG.versions));
  const label = document.createElement('span');
  label.textContent = 'Changes';
  label.style.cssText = `font:${SIZE.base} ${FONT.display};letter-spacing:-.01em;color:${COLORS.fg}`;
  c.appendChild(label);
  const cnt = document.createElement('span');
  cnt.id = 'awwdits-changes-count';
  cnt.textContent = '0';
  cnt.style.cssText =
    `min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:${COLORS.badge};color:${COLORS.fg};` +
    `display:grid;place-items:center;font:${SIZE.sm} ${FONT.mono}`;
  c.appendChild(cnt);
  c.addEventListener('mouseenter', () => { if (!c.dataset.on) c.style.background = COLORS.hover; });
  c.addEventListener('mouseleave', () => { if (!c.dataset.on) c.style.background = 'transparent'; });
  c.addEventListener('click', () => cb.onToggleChanges && cb.onToggleChanges());
  return c;
}

// Quick-copy the changes without opening the popover. Hidden until there are changes.
function makeCopyBtn() {
  const b = baseBtn(); b.id = 'awwdits-copy-btn'; setTip(b, { label: 'Copy changes' });
  b.style.display = 'none';
  const box = svgBox(SVG.copy);
  b.appendChild(box);
  b.addEventListener('click', () => {
    if (cb.onCopy) cb.onCopy();
    box.innerHTML = SVG.check; // copied feedback
    setTimeout(() => { if (box.isConnected) box.innerHTML = SVG.copy; }, 1200);
  });
  return b;
}

// ---- drag ----
function wireDrag(grip) {
  let dragging = false, ox = 0, oy = 0, sx = 0, sy = 0;
  grip.addEventListener('mousedown', (e) => {
    dragging = true; const r = bar.getBoundingClientRect();
    sx = r.left; sy = r.top; ox = e.clientX; oy = e.clientY;
    grip.style.cursor = 'grabbing'; e.preventDefault(); e.stopPropagation();
  });
  dragMove = (e) => {
    if (!dragging) return;
    const size = { w: bar.offsetWidth, h: bar.offsetHeight };
    const vp = { vw: window.innerWidth, vh: window.innerHeight };
    const p = clampToolbarPos({ x: sx + (e.clientX - ox), y: sy + (e.clientY - oy) }, vp, size);
    bar.style.left = p.x + 'px'; bar.style.top = p.y + 'px';
  };
  dragUp = () => {
    if (!dragging) return; dragging = false; grip.style.cursor = 'grab';
    saveToolbarPos({ x: parseInt(bar.style.left, 10), y: parseInt(bar.style.top, 10) });
  };
  document.addEventListener('mousemove', dragMove);
  document.addEventListener('mouseup', dragUp);
}

function positionInitial() {
  const vp = { vw: window.innerWidth, vh: window.innerHeight };
  const size = { w: bar.offsetWidth || 360, h: bar.offsetHeight || 52 };
  const def = defaultToolbarPos(vp, size);
  bar.style.left = def.x + 'px'; bar.style.top = def.y + 'px';
  loadToolbarPos().then(saved => {
    if (!saved || !bar) return;
    const p = clampToolbarPos(saved, { vw: window.innerWidth, vh: window.innerHeight }, { w: bar.offsetWidth, h: bar.offsetHeight });
    bar.style.left = p.x + 'px'; bar.style.top = p.y + 'px';
  });
}

// ---- public handle ----
function setActiveTool(name) {
  if (!bar) return;
  bar.querySelectorAll('[data-tool]').forEach(b => {
    const on = b.dataset.tool === name;
    if (on) { b.dataset.on = '1'; b.style.background = COLORS.active; b.style.color = COLORS.fg; }
    else { delete b.dataset.on; b.style.background = 'transparent'; b.style.color = COLORS.weak; }
  });
}
function setChangesCount(n) {
  const cnt = document.getElementById('awwdits-changes-count');
  if (cnt) cnt.textContent = String(n);
  const cp = document.getElementById('awwdits-copy-btn');
  if (cp) cp.style.display = n > 0 ? 'grid' : 'none';
}
function setChipOpen(open) {
  const chip = document.getElementById('awwdits-changes-chip'); if (!chip) return;
  if (open) { chip.dataset.on = '1'; chip.style.background = COLORS.active; }
  else { delete chip.dataset.on; chip.style.background = 'transparent'; }
}
function destroy() {
  if (dragMove) document.removeEventListener('mousemove', dragMove);
  if (dragUp) document.removeEventListener('mouseup', dragUp);
  dragMove = dragUp = null;
  destroyTooltip();
  if (bar) { bar.remove(); bar = null; }
}
function handle() { return { el: bar, chipEl: document.getElementById('awwdits-changes-chip'), setActiveTool, setChangesCount, setChipOpen, destroy }; }

export { setActiveTool, setChangesCount, setChipOpen, destroy };
