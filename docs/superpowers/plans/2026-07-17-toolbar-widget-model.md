# Toolbar-first widget model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the always-on 332px panel into a persistent floating **toolbar** (vanilla DOM) plus the existing **properties panel** (React iframe) that is summoned only when an element is selected, with tracked changes surfaced in a **Changes** popover on the toolbar (Export + Clear all).

**Architecture:** The toolbar and Changes popover are vanilla DOM in the content script — where mode activation (`activateInspector`/`activateMeasure`), selection, and the comment overlay already live, so toolbar buttons call those directly with no new round-trips. Notes/changes state stays in the panel React app (`App.jsx`); the panel pushes a `CHANGES_SUMMARY` to the content script on every notes change, and the toolbar renders the count + list from it. The panel iframe stays mounted (state + persistence keep running) but is only visible when an element is selected.

**Tech Stack:** Chrome MV3 extension, Vite build, vanilla DOM content scripts + React (iframe) panel, Vitest for pure logic, `@tabler/icons-react` (panel only — content-script icons are hand-authored SVG strings, matching the Tabler *filled* silhouettes as the existing overlays do).

## Global Constraints

- **Toolbar chrome is always dark**, styled with explicit hex (page context — no `var()` token shim, exactly like `comment-overlay.js`). Only the *panel* iframe responds to the theme toggle.
- **Active-tool state is monochrome:** armed tool = raised-surface pill (`#3a3a3f`) + foreground glyph (`#f1f1f3`), never an accent color. The **only** accent (the pink→coral→orange gradient `linear-gradient(135deg,#F7CFEC,#FF3E97 42%,#FF6E77 68%,#FF9A5A)`) appears on the mark and on the Changes count badge **when count > 0** (count is data).
- **Icons** are hand-authored SVG strings in `currentColor`, matching Tabler filled silhouettes; 20px in the toolbar.
- **Drag handle is a dedicated dotted grip**, distinct from the mark. The mark is a click-menu only.
- **z-index:** toolbar/popover use the extension's high band (`2147483646`, same as the comment layer) so they sit above page content but the panel iframe container keeps `2147483647`.
- **No new dependencies.** Reuse `recordOps`, `notesStorage`, `exportNotes`, `domPath`, `element-selector`, `measurement-overlay`.
- **Message shapes (do not deviate):** content→panel is `postToSidebar(type, data)` → panel reads `e.data.type` + `e.data.data`. panel→content is `postToContent(type, {…fields})` → content reads `e.data.type` + `e.data.<field>` (flat, spread).

---

### Task 1: Message constants + toolbar geometry helper (pure, tested)

**Files:**
- Modify: `src/utils/constants.js` (add 4 message keys)
- Create: `src/content/toolbarGeometry.js`
- Test: `src/content/toolbarGeometry.test.js`

**Interfaces:**
- Produces: `clampToolbarPos({x,y}, {vw,vh}, {w,h}) -> {x,y}`, `defaultToolbarPos({vw,vh}, {w,h}) -> {x,y}`, `TOOLBAR_MARGIN` (number). New `MESSAGES` keys: `CHANGES_SUMMARY`, `CLEAR_ALL_CHANGES`, `EXPORT_NOTES`, `TOGGLE_THEME`.

- [ ] **Step 1: Add message constants**

In `src/utils/constants.js`, inside the `MESSAGES` object (after `COMMENT_SAVED:` line 25), add:

```js
  CHANGES_SUMMARY: 'AWWDITS_CHANGES_SUMMARY',
  CLEAR_ALL_CHANGES: 'AWWDITS_CLEAR_ALL_CHANGES',
  EXPORT_NOTES: 'AWWDITS_EXPORT_NOTES',
  TOGGLE_THEME: 'AWWDITS_TOGGLE_THEME',
```

- [ ] **Step 2: Write the failing test**

Create `src/content/toolbarGeometry.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { clampToolbarPos, defaultToolbarPos, TOOLBAR_MARGIN } from './toolbarGeometry.js';

const VP = { vw: 1000, vh: 800 };
const SIZE = { w: 320, h: 48 };

describe('clampToolbarPos', () => {
  it('keeps an in-bounds position unchanged', () => {
    expect(clampToolbarPos({ x: 300, y: 400 }, VP, SIZE)).toEqual({ x: 300, y: 400 });
  });
  it('clamps past the right/bottom edge to leave a margin', () => {
    expect(clampToolbarPos({ x: 9999, y: 9999 }, VP, SIZE))
      .toEqual({ x: 1000 - 320 - TOOLBAR_MARGIN, y: 800 - 48 - TOOLBAR_MARGIN });
  });
  it('clamps negative coords up to the margin', () => {
    expect(clampToolbarPos({ x: -50, y: -50 }, VP, SIZE)).toEqual({ x: TOOLBAR_MARGIN, y: TOOLBAR_MARGIN });
  });
});

describe('defaultToolbarPos', () => {
  it('centers horizontally and sits near the bottom', () => {
    expect(defaultToolbarPos(VP, SIZE)).toEqual({ x: Math.round((1000 - 320) / 2), y: 800 - 48 - 24 });
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npm test -- toolbarGeometry`
Expected: FAIL — cannot resolve `./toolbarGeometry.js`.

- [ ] **Step 4: Implement the helper**

Create `src/content/toolbarGeometry.js`:

```js
// Pure geometry for the floating toolbar — position clamping + default placement.
// No DOM, so it is unit-tested (the DOM module toolbar.js consumes it).
export const TOOLBAR_MARGIN = 16;

export function clampToolbarPos({ x, y }, { vw, vh }, { w, h }) {
  const maxX = Math.max(TOOLBAR_MARGIN, vw - w - TOOLBAR_MARGIN);
  const maxY = Math.max(TOOLBAR_MARGIN, vh - h - TOOLBAR_MARGIN);
  return {
    x: Math.min(Math.max(TOOLBAR_MARGIN, x), maxX),
    y: Math.min(Math.max(TOOLBAR_MARGIN, y), maxY),
  };
}

export function defaultToolbarPos({ vw, vh }, { w, h }) {
  return { x: Math.round((vw - w) / 2), y: vh - h - 24 };
}
```

- [ ] **Step 5: Run tests and confirm pass**

Run: `npm test -- toolbarGeometry`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/utils/constants.js src/content/toolbarGeometry.js src/content/toolbarGeometry.test.js
git commit -m "feat(toolbar): message constants + pure toolbar geometry helper"
```

---

### Task 2: Toolbar module (vanilla DOM) — render, modes, drag, mark menu

**Files:**
- Create: `src/content/toolbarStorage.js`
- Create: `src/content/toolbar.js`

**Interfaces:**
- Consumes: `clampToolbarPos`, `defaultToolbarPos` (Task 1); `chrome.storage.local`.
- Produces:
  - `toolbarStorage.js`: `loadToolbarPos() -> Promise<{x,y}|null>`, `saveToolbarPos({x,y}) -> Promise<void>`.
  - `toolbar.js`: `initToolbar(callbacks) -> handle`. `callbacks = { onInspect, onComment, onMeasure, onToggleChanges, onToggleTheme, onHelp, onClose }`. `handle = { el, chipEl, setActiveTool(name), setChangesCount(n), destroy() }`. `name ∈ 'inspect'|'comment'|'measure'`.

- [ ] **Step 1: Create the storage wrapper**

Create `src/content/toolbarStorage.js` (mirrors `notesStorage.js` — degrade, never throw):

```js
// Remembers the toolbar's last position across pages/reloads.
const KEY = 'awwdits-toolbar-pos';

export async function loadToolbarPos() {
  try { const g = await chrome.storage.local.get(KEY); const v = g[KEY]; return (v && typeof v.x === 'number') ? v : null; }
  catch { return null; }
}

export async function saveToolbarPos(pos) {
  try { await chrome.storage.local.set({ [KEY]: pos }); } catch { /* storage blocked */ }
}
```

- [ ] **Step 2: Create the toolbar module**

Create `src/content/toolbar.js`:

```js
// Floating toolbar (vanilla DOM, PAGE context — explicit hex, always dark, like the
// other overlays). The persistent hub: inspect / comment / measure modes, a Changes
// chip, a draggable handle, and a gradient "mark" that opens a small menu. All
// behavior is delegated through callbacks; the content script owns the modes/state.
import { loadToolbarPos, saveToolbarPos } from './toolbarStorage.js';
import { clampToolbarPos, defaultToolbarPos, TOOLBAR_MARGIN } from './toolbarGeometry.js';

const BAR_ID = 'awwdits-toolbar';
const Z = 2147483646;
const GRAD = 'linear-gradient(135deg,#F7CFEC,#FF3E97 42%,#FF6E77 68%,#FF9A5A)';

// Tabler-filled silhouettes as inline SVG strings (currentColor).
const SVG = {
  cross: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.2" fill="#fff"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>',
  inspect: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/></svg>',
  msg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4 3.5A.6.6 0 0 1 4 21z"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="8" width="18" height="8" rx="1.5" fill="currentColor" opacity=".22"/><rect x="3" y="8" width="18" height="8" rx="1.5" stroke="currentColor" stroke-width="1.8"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  diff: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 21V9M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a6 6 0 0 1-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17" r="1.1" fill="currentColor"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

let bar = null, markMenu = null, cb = {};

export function initToolbar(callbacks = {}) {
  cb = callbacks;
  if (bar) return handle();

  bar = document.createElement('div');
  bar.id = BAR_ID;
  bar.style.cssText =
    `position:fixed;left:0;top:0;z-index:${Z};display:flex;align-items:center;gap:3px;` +
    'height:48px;padding:6px;border-radius:14px;background:#242427;border:1px solid #3a3a3f;' +
    'box-shadow:0 16px 40px -12px rgba(0,0,0,.7),0 2px 8px rgba(0,0,0,.4);' +
    'font:13px/1 "Special Gothic",system-ui,sans-serif;color:#f1f1f3;user-select:none';

  bar.appendChild(makeGrip());
  bar.appendChild(makeMark());
  bar.appendChild(toolBtn('inspect', SVG.inspect, 'Inspect  ⌘-click', cb.onInspect));
  bar.appendChild(toolBtn('comment', SVG.msg, 'Comment  ⌘C-click', cb.onComment));
  bar.appendChild(toolBtn('measure', SVG.ruler, 'Measure  M', cb.onMeasure));
  bar.appendChild(divider());
  bar.appendChild(makeChip());
  bar.appendChild(divider());
  bar.appendChild(iconBtn(SVG.x, 'Close awwdits', () => cb.onClose && cb.onClose()));

  document.body.appendChild(bar);
  positionInitial();
  setActiveTool('inspect');
  return handle();
}

// ---- pieces ----
function baseBtn() {
  const b = document.createElement('button');
  b.type = 'button';
  b.style.cssText =
    'width:38px;height:38px;border-radius:9px;border:none;background:transparent;color:#797d87;' +
    'display:grid;place-items:center;cursor:pointer;position:relative;transition:background .12s,color .12s';
  b.addEventListener('mouseenter', () => { if (!b.dataset.on) { b.style.background = '#2f2f33'; b.style.color = '#f1f1f3'; } });
  b.addEventListener('mouseleave', () => { if (!b.dataset.on) { b.style.background = 'transparent'; b.style.color = '#797d87'; } });
  return b;
}
function svgBox(markup) { const s = document.createElement('span'); s.style.cssText = 'width:20px;height:20px;display:block'; s.innerHTML = markup; return s; }
function iconBtn(svg, title, onClick) { const b = baseBtn(); b.title = title; b.appendChild(svgBox(svg)); b.addEventListener('click', onClick); return b; }
function divider() { const d = document.createElement('div'); d.style.cssText = 'width:1px;height:22px;background:#3a3a3f;margin:0 4px;flex:none'; return d; }

function toolBtn(name, svg, title, onClick) {
  const b = baseBtn(); b.title = title; b.dataset.tool = name; b.appendChild(svgBox(svg));
  b.addEventListener('click', () => onClick && onClick());
  return b;
}

function makeGrip() {
  const g = document.createElement('div');
  g.id = 'awwdits-toolbar-grip';
  g.title = 'Drag to move';
  g.style.cssText = 'width:20px;height:38px;display:grid;place-items:center;cursor:grab;color:#5c5f68;flex:none';
  g.appendChild(svgBox(SVG.grip));
  wireDrag(g);
  return g;
}

function makeMark() {
  const m = document.createElement('button');
  m.type = 'button'; m.title = 'awwdits';
  m.style.cssText = `width:32px;height:32px;border-radius:9px;border:none;background:${GRAD};` +
    'display:grid;place-items:center;cursor:pointer;flex:none;position:relative';
  m.appendChild(svgBox(SVG.cross));
  m.addEventListener('click', (e) => { e.stopPropagation(); toggleMarkMenu(m); });
  return m;
}

function makeChip() {
  const c = document.createElement('button');
  c.type = 'button'; c.id = 'awwdits-changes-chip'; c.title = 'Changes';
  c.style.cssText = 'display:flex;align-items:center;gap:7px;height:38px;padding:0 12px 0 10px;border-radius:9px;' +
    'border:none;background:transparent;color:#797d87;cursor:pointer;font:12px "JetBrains Mono",ui-monospace,monospace;transition:.12s';
  c.appendChild(svgBox(SVG.diff)).style.width = '17px';
  const label = document.createElement('span'); label.textContent = 'Changes'; c.appendChild(label);
  const cnt = document.createElement('span'); cnt.id = 'awwdits-changes-count'; cnt.textContent = '0';
  cnt.style.cssText = 'min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#3a3a3f;color:#f1f1f3;' +
    'display:grid;place-items:center;font-size:11px';
  c.appendChild(cnt);
  c.addEventListener('mouseenter', () => { if (!c.dataset.on) c.style.background = '#2f2f33', c.style.color = '#f1f1f3'; });
  c.addEventListener('mouseleave', () => { if (!c.dataset.on) c.style.background = 'transparent', c.style.color = c.dataset.hot ? '#f1f1f3' : '#797d87'; });
  c.addEventListener('click', () => cb.onToggleChanges && cb.onToggleChanges());
  return c;
}

// ---- mark menu ----
function toggleMarkMenu(anchor) {
  if (markMenu) { closeMarkMenu(); return; }
  markMenu = document.createElement('div');
  markMenu.style.cssText = `position:fixed;z-index:${Z + 1};background:#1d1d20;border:1px solid #34343a;border-radius:10px;` +
    'box-shadow:0 20px 50px -16px rgba(0,0,0,.8);padding:5px;min-width:150px;font:13px "Special Gothic",system-ui,sans-serif';
  const item = (svg, label, onClick) => {
    const r = document.createElement('button'); r.type = 'button';
    r.style.cssText = 'display:flex;align-items:center;gap:9px;width:100%;height:32px;padding:0 9px;border:none;border-radius:7px;' +
      'background:transparent;color:#c9cad1;cursor:pointer;font:inherit;text-align:left';
    r.appendChild(svgBox(svg)).style.cssText = 'width:16px;height:16px;color:#797d87';
    const t = document.createElement('span'); t.textContent = label; r.appendChild(t);
    r.addEventListener('mouseenter', () => r.style.background = '#2a2a2e');
    r.addEventListener('mouseleave', () => r.style.background = 'transparent');
    r.addEventListener('click', () => { closeMarkMenu(); onClick && onClick(); });
    return r;
  };
  markMenu.appendChild(item(SVG.sun, 'Toggle theme', cb.onToggleTheme));
  markMenu.appendChild(item(SVG.help, 'Shortcuts', cb.onHelp));
  markMenu.appendChild(item(SVG.x, 'Close awwdits', cb.onClose));
  document.body.appendChild(markMenu);
  const r = anchor.getBoundingClientRect();
  markMenu.style.left = r.left + 'px';
  markMenu.style.top = (r.bottom + 8) + 'px';
  setTimeout(() => document.addEventListener('mousedown', onDocDown, true), 0);
}
function onDocDown(e) { if (markMenu && !markMenu.contains(e.target)) closeMarkMenu(); }
function closeMarkMenu() { if (!markMenu) return; document.removeEventListener('mousedown', onDocDown, true); markMenu.remove(); markMenu = null; }

// ---- drag ----
function wireDrag(grip) {
  let dragging = false, ox = 0, oy = 0, sx = 0, sy = 0;
  grip.addEventListener('mousedown', (e) => {
    dragging = true; const r = bar.getBoundingClientRect();
    sx = r.left; sy = r.top; ox = e.clientX; oy = e.clientY;
    grip.style.cursor = 'grabbing'; e.preventDefault(); e.stopPropagation();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const size = { w: bar.offsetWidth, h: bar.offsetHeight };
    const vp = { vw: window.innerWidth, vh: window.innerHeight };
    const p = clampToolbarPos({ x: sx + (e.clientX - ox), y: sy + (e.clientY - oy) }, vp, size);
    bar.style.left = p.x + 'px'; bar.style.top = p.y + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return; dragging = false; grip.style.cursor = 'grab';
    saveToolbarPos({ x: parseInt(bar.style.left, 10), y: parseInt(bar.style.top, 10) });
  });
}

async function positionInitial() {
  const size = { w: bar.offsetWidth || 320, h: bar.offsetHeight || 48 };
  const vp = { vw: window.innerWidth, vh: window.innerHeight };
  const saved = await loadToolbarPos();
  const p = saved ? clampToolbarPos(saved, vp, size) : defaultToolbarPos(vp, size);
  bar.style.left = p.x + 'px'; bar.style.top = p.y + 'px';
}

// ---- public handle ----
function setActiveTool(name) {
  bar.querySelectorAll('[data-tool]').forEach(b => {
    const on = b.dataset.tool === name;
    if (on) { b.dataset.on = '1'; b.style.background = '#3a3a3f'; b.style.color = '#f1f1f3'; }
    else { delete b.dataset.on; b.style.background = 'transparent'; b.style.color = '#797d87'; }
  });
}
function setChangesCount(n) {
  const cnt = document.getElementById('awwdits-changes-count');
  const chip = document.getElementById('awwdits-changes-chip');
  if (!cnt || !chip) return;
  cnt.textContent = String(n);
  if (n > 0) { chip.dataset.hot = '1'; cnt.style.background = GRAD; cnt.style.color = '#1a1113'; cnt.style.fontWeight = '500'; if (!chip.dataset.on) chip.style.color = '#f1f1f3'; }
  else { delete chip.dataset.hot; cnt.style.background = '#3a3a3f'; cnt.style.color = '#f1f1f3'; cnt.style.fontWeight = '400'; if (!chip.dataset.on) chip.style.color = '#797d87'; }
}
function setChipOpen(open) {
  const chip = document.getElementById('awwdits-changes-chip'); if (!chip) return;
  if (open) { chip.dataset.on = '1'; chip.style.background = '#3a3a3f'; chip.style.color = '#f1f1f3'; }
  else { delete chip.dataset.on; chip.style.background = 'transparent'; chip.style.color = chip.dataset.hot ? '#f1f1f3' : '#797d87'; }
}
function destroy() { closeMarkMenu(); if (bar) { bar.remove(); bar = null; } }
function handle() { return { el: bar, chipEl: document.getElementById('awwdits-changes-chip'), setActiveTool, setChangesCount, setChipOpen, destroy }; }

export { setActiveTool, setChangesCount, setChipOpen, destroy };
```

- [ ] **Step 3: Build to confirm it compiles into the content bundle**

Run: `npm run build`
Expected: `dist/content-script.js` builds with no errors (the module is imported in Task 5; building now confirms syntax/imports resolve once wired — for this task, temporarily import it: skip if not yet imported). To verify in isolation, run `node --check` is not enough for ESM+import; rely on the Task 5 build. Instead confirm the file parses:

Run: `npx vite build 2>&1 | tail -3`
Expected: build succeeds (no parse error surfaced from the new files once imported).

> Note: `toolbar.js`/`toolbarStorage.js` are only bundled once imported by `content-script.js` (Task 5). This task's real verification is the manual matrix (Task 6). Commit the modules now; they are pure additions.

- [ ] **Step 4: Commit**

```bash
git add src/content/toolbarStorage.js src/content/toolbar.js
git commit -m "feat(toolbar): floating toolbar module (modes, drag+persist, mark menu, changes chip)"
```

---

### Task 3: Changes popover (vanilla DOM)

**Files:**
- Create: `src/content/changesPopover.js`

**Interfaces:**
- Consumes: nothing new (renders records shaped like `recordOps` records: `{ selector, path, label, comment, edits:[{property,before,after}] }`).
- Produces: `initChangesPopover({ getAnchor, onSelectRecord, onExport, onClearAll }) -> { open(records), close(), toggle(records), isOpen() }`. `getAnchor()` returns the chip element to position above.

- [ ] **Step 1: Create the module**

Create `src/content/changesPopover.js`:

```js
// Changes popover (vanilla DOM, PAGE context) — anchored above the toolbar's
// Changes chip. Lists tracked edits + comments per element, with Export and
// Clear all. Rendering only; the content script owns the data + actions.
const POP_ID = 'awwdits-changes-pop';
const Z = 2147483646;

let pop = null, opts = {};

const SVG_PENCIL = '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M4 20.5V16.6L15 5.6l3.9 3.9L7.9 20.5H4zM16.4 4.2 18 2.6a1.4 1.4 0 0 1 2 0l1.9 1.9a1.4 1.4 0 0 1 0 2l-1.6 1.6z"/></svg>';
const SVG_MSG = '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4 3.5A.6.6 0 0 1 4 21z"/></svg>';

export function initChangesPopover(o = {}) {
  opts = o;
  return { open, close, toggle, isOpen: () => !!pop };
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function open(records) {
  close();
  pop = document.createElement('div');
  pop.id = POP_ID;
  pop.style.cssText = `position:fixed;z-index:${Z + 1};width:340px;max-height:320px;background:#1d1d20;border:1px solid #34343a;` +
    'border-radius:14px;box-shadow:0 26px 64px -18px rgba(0,0,0,.85);display:flex;flex-direction:column;overflow:hidden;' +
    'font:13px "Special Gothic",system-ui,sans-serif;color:#f1f1f3';

  // header
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 12px 11px;border-bottom:1px solid #2a2a2d';
  const title = document.createElement('span'); title.textContent = 'Changes';
  title.style.cssText = 'font:13px "Special Gothic Expanded One","Arial",sans-serif';
  const spacer = document.createElement('span'); spacer.style.flex = '1';
  head.appendChild(title); head.appendChild(spacer);
  head.appendChild(headBtn('Export', () => opts.onExport && opts.onExport()));
  if (records.length) head.appendChild(headBtn('Clear all', () => {
    if (window.confirm('Clear all tracked changes and comments for this page?')) { opts.onClearAll && opts.onClearAll(); close(); }
  }, true));
  pop.appendChild(head);

  // list
  const list = document.createElement('div');
  list.style.cssText = 'overflow:auto;padding:6px';
  if (!records.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:26px 14px;text-align:center;color:#6c6d76;font-size:13px';
    empty.textContent = 'No changes yet. Edit a value or leave a comment.';
    list.appendChild(empty);
  } else {
    records.forEach(rec => list.appendChild(row(rec)));
  }
  pop.appendChild(list);
  document.body.appendChild(pop);
  positionAbove();
  setTimeout(() => document.addEventListener('mousedown', onDocDown, true), 0);
}

function headBtn(label, onClick, danger) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
  b.style.cssText = `font:10.5px "JetBrains Mono",ui-monospace,monospace;color:${danger ? '#f28b82' : '#797d87'};` +
    'border:1px solid #34343a;border-radius:6px;padding:4px 8px;background:transparent;cursor:pointer';
  b.addEventListener('mouseenter', () => { b.style.color = danger ? '#f28b82' : '#f1f1f3'; b.style.borderColor = danger ? '#5a3a38' : '#4a4a52'; });
  b.addEventListener('mouseleave', () => { b.style.color = danger ? '#f28b82' : '#797d87'; b.style.borderColor = '#34343a'; });
  b.addEventListener('click', onClick);
  return b;
}

function row(rec) {
  const r = document.createElement('div');
  r.style.cssText = 'display:flex;gap:10px;padding:9px 10px;border-radius:9px;cursor:pointer';
  r.addEventListener('mouseenter', () => r.style.background = '#232326');
  r.addEventListener('mouseleave', () => r.style.background = 'transparent');
  r.addEventListener('click', () => { opts.onSelectRecord && opts.onSelectRecord(rec); close(); });

  const hasComment = rec.comment && rec.comment.trim();
  const icon = document.createElement('span');
  icon.style.cssText = 'width:22px;height:22px;border-radius:6px;flex:none;display:grid;place-items:center;margin-top:1px;' +
    (hasComment ? 'background:#221c26;color:#e7b9d6' : 'background:#2a2320;color:#f0c9a0');
  icon.innerHTML = hasComment ? SVG_MSG : SVG_PENCIL;

  const body = document.createElement('div'); body.style.cssText = 'min-width:0;flex:1';
  const sel = document.createElement('div');
  sel.style.cssText = 'font:11px "JetBrains Mono",ui-monospace,monospace;color:#a9abb3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  sel.textContent = rec.selector;
  body.appendChild(sel);
  if (hasComment) {
    const c = document.createElement('div'); c.style.cssText = 'font-size:12.5px;color:#f1f1f3;margin-top:2px';
    c.textContent = '"' + rec.comment.trim() + '"'; body.appendChild(c);
  }
  (rec.edits || []).forEach(e => {
    const d = document.createElement('div');
    d.style.cssText = 'font:11.5px "JetBrains Mono",ui-monospace,monospace;color:#f1f1f3;margin-top:2px';
    d.innerHTML = esc(e.property) + ' <span style="color:#797d87;text-decoration:line-through">' + esc(e.before || '—') +
      '</span><span style="color:#6c6d76;margin:0 5px">→</span>' + esc(e.after);
    body.appendChild(d);
  });

  r.appendChild(icon); r.appendChild(body);
  return r;
}

function positionAbove() {
  const anchor = opts.getAnchor && opts.getAnchor();
  if (!anchor || !pop) return;
  const a = anchor.getBoundingClientRect();
  const w = pop.offsetWidth || 340;
  let left = a.left + a.width / 2 - w / 2;
  left = Math.max(12, Math.min(window.innerWidth - w - 12, left));
  pop.style.left = left + 'px';
  pop.style.top = Math.max(12, a.top - (pop.offsetHeight || 200) - 10) + 'px';
}

function onDocDown(e) {
  const anchor = opts.getAnchor && opts.getAnchor();
  if (pop && !pop.contains(e.target) && !(anchor && anchor.contains(e.target))) close();
}
function close() { if (!pop) return; document.removeEventListener('mousedown', onDocDown, true); pop.remove(); pop = null; }
function toggle(records) { if (pop) close(); else open(records); }
```

- [ ] **Step 2: Build parse-check + commit**

Run: `npx vite build 2>&1 | tail -3`
Expected: build succeeds.

```bash
git add src/content/changesPopover.js
git commit -m "feat(toolbar): changes popover (list, export, clear all, row-select)"
```

---

### Task 4: Panel (App.jsx) — headless-when-idle, summary push, new actions

**Files:**
- Modify: `src/sidebar/App.jsx`

**Interfaces:**
- Consumes: `MESSAGES.CHANGES_SUMMARY/CLEAR_ALL_CHANGES/EXPORT_NOTES/TOGGLE_THEME` (Task 1); `sortRecords` (recordOps); `formatAll` (exportNotes).
- Produces: posts `CHANGES_SUMMARY { count, records }` on notes change; renders nothing when no element is selected.

- [ ] **Step 1: Add imports**

In `src/sidebar/App.jsx`, extend the recordOps import (line 7) and exportNotes:

```jsx
import { upsertEdit, setComment as setCommentOp, clearEdits, removeEmpty, findRecord, sortRecords } from './notes/recordOps.js';
import { formatAll } from './notes/exportNotes.js';
```

- [ ] **Step 2: Add a download helper** (below the imports, before `function App()`):

```jsx
function downloadNotesText(records) {
  try {
    const blob = new Blob([formatAll(records)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'awwdits-notes.txt';
    a.click();
    URL.revokeObjectURL(url);
  } catch { /* no-op */ }
}
```

- [ ] **Step 3: Handle the three new content→panel messages**

In the `handleMessage` switch (after the `COMMENT_SAVED` case, ~line 80), add:

```jsx
        case MESSAGES.CLEAR_ALL_CHANGES:
          setNotes([]);
          break;
        case MESSAGES.EXPORT_NOTES:
          setNotes(prev => { downloadNotesText(sortRecords(removeEmpty(prev))); return prev; });
          break;
        case MESSAGES.TOGGLE_THEME:
          setTheme(prev => {
            const next = prev === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            try { localStorage.setItem('awwdits-theme', next); } catch (e) { /* blocked */ }
            return next;
          });
          break;
```

- [ ] **Step 4: Push CHANGES_SUMMARY on every notes change**

Replace the RENDER_COMMENTS effect (currently lines ~97-104) with one that posts both:

```jsx
  // Mirror commented elements to the on-page pins AND push a changes summary to
  // the toolbar (count + full records) whenever notes change.
  useEffect(() => {
    const shown = sortRecords(removeEmpty(notes));
    postToContent(MESSAGES.RENDER_COMMENTS, {
      comments: shown
        .filter(n => n.comment && n.comment.trim())
        .map(n => ({ selector: n.selector, path: n.path, comment: n.comment })),
    });
    postToContent(MESSAGES.CHANGES_SUMMARY, { count: shown.length, records: shown });
  }, [notes, postToContent]);
```

- [ ] **Step 5: Remove the home view + theme button; render nothing when idle**

Remove the `InspectEmptyState`/`NotesList` imports (lines 4, 9) and replace the body's `else` branch (lines ~316-325) so the panel renders only the inspector:

```jsx
      {/* Body — the panel only shows content while an element is selected; the
          toolbar is the resting UI, and tracked changes live in its popover. */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {selectedElement && (
          <InspectZone
            selected={selectedElement}
            selectionId={selectionId}
            editMode={editMode}
            manualArmed={manualArmed}
            onManualPick={handleManualPick}
            onSelectAncestor={selectAncestor}
            onApplyStyle={applyStyle}
            onApplyText={applyText}
          />
        )}
      </div>
```

Then delete the header's theme-toggle button block (the `{!selectedElement && (<button onClick={toggleTheme}…IconSun/IconMoon…/>)}` block, ~lines 224-247) — theme now lives in the toolbar's mark menu. Remove the now-unused `IconSun`, `IconMoon` from the icons import (line 6) and the unused `manualArmed`/`handleManualPick` only if the linter flags them (they are still used by InspectZone — keep). Keep `toggleTheme` (still referenced? no — remove it if unused after deleting the button; the TOGGLE_THEME handler inlines its own toggle).

> After edits, `InspectEmptyState`, `NotesList`, `IconSun`, `IconMoon`, `toggleTheme`, `selectBySelector`, `notFound`, `handleManualPick` may become unused. Remove exactly those that the build reports as unused; leave anything InspectZone still consumes. `NotesList`/`InspectEmptyState` files stay on disk (Task 6 decides deletion).

- [ ] **Step 6: Build + run existing tests**

Run: `npm run build && npm test`
Expected: build succeeds; 18 tests still pass (no test touches App.jsx directly).

- [ ] **Step 7: Commit**

```bash
git add src/sidebar/App.jsx
git commit -m "feat(toolbar): panel goes headless when idle; push CHANGES_SUMMARY; theme/export/clear via messages"
```

---

### Task 5: content-script wiring — toolbar in, grip/always-on panel out

**Files:**
- Modify: `src/content/content-script.js`

**Interfaces:**
- Consumes: `initToolbar` (Task 2), `initChangesPopover` (Task 3), `MESSAGES.*` (Task 1).
- Produces: toolbar mounted always; panel iframe shown on select, hidden on clear; toolbar callbacks wired to existing modes.

- [ ] **Step 1: Add imports** (top of `content-script.js`):

```js
import { initToolbar } from './toolbar.js';
import { initChangesPopover } from './changesPopover.js';
```

- [ ] **Step 2: Add module state** (near the other `let` declarations, ~line 39):

```js
let toolbar = null;         // { setActiveTool, setChangesCount, setChipOpen, chipEl, ... }
let changesPopover = null;  // { open, close, toggle, isOpen }
let changeRecords = [];      // latest records from the panel's CHANGES_SUMMARY
```

- [ ] **Step 3: Replace `injectSidebar()` with toolbar + hidden panel**

Rewrite `injectSidebar()` (lines ~47-147). The container now holds only the (initially hidden) panel iframe — no grip column — and the toolbar is mounted separately:

```js
function injectSidebar() {
  if (sidebarFrame) return;

  const PANEL_WIDTH = 300;
  const PANEL_HEIGHT = Math.min(Math.round(window.innerHeight * 0.85), 700);
  const initY = Math.round((window.innerHeight - PANEL_HEIGHT) / 2);

  // Panel container — right-docked, hidden until an element is selected.
  const container = document.createElement('div');
  container.id = 'awwdits-sidebar-container';
  container.style.cssText = `position:fixed;top:${initY}px;right:24px;width:${PANEL_WIDTH}px;height:${PANEL_HEIGHT}px;` +
    'z-index:2147483647;display:none;pointer-events:auto';

  const iframe = document.createElement('iframe');
  iframe.id = 'awwdits-sidebar-frame';
  iframe.src = chrome.runtime.getURL('sidebar.html');
  iframe.allow = 'clipboard-write';
  iframe.style.cssText = `width:100%;height:${PANEL_HEIGHT}px;border:none;background:#1d1d20;border-radius:16px;display:block;` +
    'box-shadow:0 8px 32px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.10)';
  container.appendChild(iframe);
  document.body.appendChild(container);
  sidebarFrame = iframe;

  // Toolbar — the always-visible hub.
  toolbar = initToolbar({
    onInspect: () => { activateInspector(); toolbar.setActiveTool('inspect'); },
    onComment: () => { const el = getSelectedElement(); if (el) openComposerFor(el); toolbar.setActiveTool('comment'); },
    onMeasure: () => { activateMeasure(); toolbar.setActiveTool('measure'); },
    onToggleChanges: () => { changesPopover.toggle(changeRecords); toolbar.setChipOpen(changesPopover.isOpen()); },
    onToggleTheme: () => postToSidebar(MESSAGES.TOGGLE_THEME, {}),
    onHelp: () => postToSidebar(MESSAGES.TOGGLE_THEME, {}) && null, // placeholder; see note
    onClose: () => { removeSidebar(); isOpen = false; },
  });

  changesPopover = initChangesPopover({
    getAnchor: () => toolbar.chipEl,
    onSelectRecord: (rec) => selectRecord(rec),
    onExport: () => postToSidebar(MESSAGES.EXPORT_NOTES, {}),
    onClearAll: () => postToSidebar(MESSAGES.CLEAR_ALL_CHANGES, {}),
  });

  window.addEventListener('message', handleSidebarMessage);
}
```

> **onHelp note:** for MVP, wire `onHelp` to a no-op that logs the shortcut list: replace the placeholder line with `onHelp: () => console.info('[awwdits] Shortcuts: ⌘/Ctrl-click = inspect · C = comment · M = measure · Alt+Shift+A = toggle'),`. A real help surface is deferred (spec: out of scope).

- [ ] **Step 4: Add panel show/hide + record-select helpers** (after `injectSidebar`):

```js
function showPanel() { const c = document.getElementById('awwdits-sidebar-container'); if (c) c.style.display = 'block'; }
function hidePanel() { const c = document.getElementById('awwdits-sidebar-container'); if (c) c.style.display = 'none'; }

// Re-select an element from a changes-popover row (local — same context).
function selectRecord(rec) {
  let el = null;
  try { el = rec.selector ? document.querySelector(rec.selector) : null; } catch { el = null; }
  if (!el) el = findByPath(rec.path);
  if (!el) { postToSidebar(MESSAGES.SELECT_NOT_FOUND, { selector: rec.selector }); return; }
  selectElement(el);
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  pulsePin(rec.selector);
}
```

- [ ] **Step 5: Show the panel on select, hide on clear**

In `activateInspector()` (the `initElementSelector` onSelect callback, ~line 250), after `postToSidebar(MESSAGES.ELEMENT_SELECTED, …)` add `showPanel();`. In `handleSidebarMessage`, the `CLEAR_SELECTION` case (~line 318) becomes:

```js
    case MESSAGES.CLEAR_SELECTION:
      clearSelection();
      hidePanel();
      break;
```

- [ ] **Step 6: Handle CHANGES_SUMMARY; drop the old close/remove path**

In `handleSidebarMessage`, add a case:

```js
    case MESSAGES.CHANGES_SUMMARY:
      changeRecords = e.data.records || [];
      if (toolbar) toolbar.setChangesCount(e.data.count || 0);
      if (changesPopover && changesPopover.isOpen()) changesPopover.toggle(changeRecords), changesPopover.toggle(changeRecords); // re-render open popover
      break;
```

> Simpler re-render: replace that last line with `if (changesPopover && changesPopover.isOpen()) { changesPopover.close(); changesPopover.open(changeRecords); }` — add an `open` passthrough to the popover handle if needed (it already exposes `open`). Prefer this explicit form.

- [ ] **Step 7: Update `removeSidebar()` to tear down the toolbar**

In `removeSidebar()` (~line 168), after removing the container, add:

```js
  if (changesPopover) { changesPopover.close(); changesPopover = null; }
  if (toolbar) { toolbar.destroy(); toolbar = null; }
  changeRecords = [];
```

- [ ] **Step 8: Point the panel `SIDEBAR_READY` at the toolbar active state**

In the `SIDEBAR_READY` case (~line 304), after `activateInspector();` add `if (toolbar) toolbar.setActiveTool('inspect');`. Remove the old `AWWDITS_CLOSE` case's whole-widget assumptions only if present; the panel no longer sends `AWWDITS_CLOSE` (its close button was removed in Task 4) — leave the `AWWDITS_CLOSE` handler in place as a harmless fallback.

- [ ] **Step 9: Replace the `c` keyboard handler with the ⌘/Ctrl+C+click comment gesture**

At the bottom of `content-script.js`, replace the existing `c`-opens-composer keydown block (the last `document.addEventListener('keydown', … e.key !== 'c' …)`, ~lines 482-490) with a held-key tracker + a capture-phase click gesture. It is registered at module load — **before** the element-selector's own click listener (added later on `SIDEBAR_READY`) — so `stopImmediatePropagation()` suppresses selection for this click:

```js
// Comment gesture: hold ⌘/Ctrl + C and click any element to comment it directly
// (parallels ⌘-click to inspect). Track the C key; the click claims itself via
// stopImmediatePropagation so the element-selector doesn't also select. A bare
// ⌘C (no click) is left alone, so normal Copy still works.
let cKeyHeld = false;
document.addEventListener('keydown', (e) => { if (e.key === 'c' || e.key === 'C') cKeyHeld = true; }, true);
document.addEventListener('keyup',   (e) => { if (e.key === 'c' || e.key === 'C') cKeyHeld = false; }, true);
window.addEventListener('blur', () => { cKeyHeld = false; });

document.addEventListener('click', (e) => {
  if (!(e.metaKey || e.ctrlKey) || !cKeyHeld) return;
  const t = e.target;
  if (!t || (t.closest && (t.closest('#awwdits-sidebar-container') || t.closest('#awwdits-comments') || t.closest('#awwdits-toolbar')))) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  selectElement(t);
  openComposerFor(t);
}, true);
```

> Keep `getSelectedElement`/`openComposerFor`/`selectElement` imports (already present). The Comment **tool** button still comments the current selection as the fallback path (wired in Step 3's `onComment`).

- [ ] **Step 10: Build**

Run: `npm run build`
Expected: `dist/content-script.js` and `dist/sidebar.js` build cleanly; all `toolbar.js`/`changesPopover.js`/`toolbarGeometry.js` now bundled.

- [ ] **Step 11: Commit**

```bash
git add src/content/content-script.js
git commit -m "feat(toolbar): wire toolbar + changes popover; summon panel on select; comment via cmd+c+click"
```

---

### Task 6: Manual verification matrix + cleanup

**Files:**
- Modify (cleanup): `src/content/content-script.js` (remove dead drag-grip code if any remains), `src/sidebar/App.jsx` (final unused-symbol sweep)
- Possibly delete: `src/sidebar/components/redesign/InspectEmptyState.jsx` + its story, `src/sidebar/notes/NotesList.jsx` + `NotesRow.jsx` — **only after confirming no remaining imports** (grep first; the spec says keep-for-now unless clearly orphaned).

- [ ] **Step 1: Grep for orphaned imports**

Run:
```bash
grep -rn "InspectEmptyState\|NotesList\|NotesRow" src/ | grep -v ".stories."
```
Expected: no non-story references remain in `App.jsx`. If a file is imported only by its own story, leave it (per spec). Record what you find; do not delete unprompted beyond dead code the build flags.

- [ ] **Step 2: Build the extension for manual load**

Run: `npm run build`
Expected: clean build; `dist/` populated.

- [ ] **Step 3: Run the manual matrix** (load `dist/` unpacked in Chrome — `chrome://extensions` → Load unpacked → select `dist/`; open any content-rich page; toggle with Alt+Shift+A). Verify each, in **both dark and light** panel themes (toggle via the mark menu):

  - [ ] Toolbar appears (bottom-center default), drag by the dotted grip moves it, position **persists** across reload and across a second page.
  - [ ] Mark click opens the menu; Toggle theme flips the panel light/dark; menu closes on outside click.
  - [ ] Inspect armed by default; ⌘/Ctrl-click an element → **panel slides in on the right** with its properties; plain click passes through to the page.
  - [ ] Back in the panel hides it; the toolbar stays. Re-selecting shows it again.
  - [ ] Edit (panel header pencil) → change a value → element updates on the page → **Changes count increments** and its badge goes gradient.
  - [ ] Comment via **⌘/Ctrl + C + click** on an element (and via the Comment tool on a selection) → composer → save → **gradient pin** drops; the comment shows in the Changes popover; count reflects it. Confirm a bare **⌘C still copies** normally (no click).
  - [ ] Changes chip opens the popover above it; rows show `selector` + `property before → after` and `"comment"`; clicking a row selects + scrolls + pulses the pin.
  - [ ] **Export** downloads `awwdits-notes.txt` with the expected content; **Clear all** (confirm) empties the list, removes pins, resets the count to 0.
  - [ ] Toolbar **Close** removes the whole widget; Alt+Shift+A reopens it; changes persist per URL across reloads.
  - [ ] Squint test: toolbar reads as quiet dark chrome; the only color is the mark + hot count badge; active tool is a neutral pill.

- [ ] **Step 4: Fix any defects found**, rebuild, re-verify the failed rows. Commit fixes as discrete `fix(toolbar): …` commits.

- [ ] **Step 5: Final cleanup commit**

```bash
git add -A
git commit -m "chore(toolbar): remove dead home-view code paths after toolbar migration"
```

---

## Self-Review

**Spec coverage:**
- Toolbar (horizontal pill, modes, drag+persist, mark menu, changes chip) → Tasks 1–2, 5. ✓
- Properties panel summoned on select, Edit in header → Tasks 4–5. ✓
- Changes popover with Export + **Clear all** → Task 3, wired Tasks 4–5. ✓
- Notes stay in panel; `CHANGES_SUMMARY` push → Task 4. ✓
- Dedicated drag handle ≠ mark-menu → Task 2 (`makeGrip` vs `makeMark`). ✓
- Monochrome active state, gradient only on mark + hot count → Global Constraints, Task 2 (`setActiveTool`, `setChangesCount`). ✓
- Remove home empty-state + in-panel notes list → Task 4 (render), Task 6 (file disposition). ✓
- Toolbar position persistence → Tasks 1–2. ✓
- Theme moves to mark menu → Tasks 2, 4, 5. ✓

**Placeholder scan:** The only "placeholder" is the `onHelp` handler, which is explicitly resolved to a `console.info` shortcut list in the Task 5 note (help surface is spec'd out-of-scope). No TBD/TODO steps.

**Type consistency:** `initToolbar` returns `{ el, chipEl, setActiveTool, setChangesCount, setChipOpen, destroy }` — used consistently in Task 5. `initChangesPopover` returns `{ open, close, toggle, isOpen }` — Task 5 uses `toggle`, `isOpen`, `close`, `open`. Record shape `{selector,path,label,comment,edits:[{property,before,after}]}` matches `recordOps`. Message keys match Task 1 exactly.

## Open questions carried from the spec (resolve during execution if they surface)
1. Measure still posts `MEASUREMENT_COMPLETE` to the panel — the panel is hidden when idle, so a measurement result won't be visible unless something is selected. **Decision for execution:** show the panel on `MEASUREMENT_COMPLETE` too (call `showPanel()` in that case within `handleSidebarMessage` if the panel renders measurement), or keep measure on-page-only for MVP. Default: on-page-only; leave the panel hidden.
2. Reopen-after-close: MVP uses Alt+Shift+A (no floating dot).
