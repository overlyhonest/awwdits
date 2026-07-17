# On-Page Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move commenting from the sidebar panel onto the webpage — a Figma-style comment pin anchored to each commented element, with an on-page composer and read/edit/delete popover.

**Architecture:** A new vanilla-DOM overlay module in the content script (`comment-overlay.js`) renders one pin per commented element into a fixed-position layer, positioned from the element's `getBoundingClientRect` via a pure, unit-tested geometry helper. The sidebar panel (React) stays the single source of truth for comment state + storage: it sends the content script the list of comments to render (`RENDER_COMMENTS`) and folds page-authored edits back in (`COMMENT_SAVED`). The record model, storage, `recordOps`, and `exportNotes` are unchanged.

**Tech Stack:** React 18, Vite 4, Chrome MV3 (content script ↔ sidebar iframe via `postMessage`; `chrome.storage.local`), Vitest for the pure geometry unit.

## Global Constraints

- Chrome MV3. No manifest change (the `storage` permission already exists).
- **The content-script overlay runs in PAGE context — it has NO access to the sidebar's `COLOR`/`FONT` token shim.** Use explicit colors/fonts inline, exactly as the existing overlays do (`element-selector.js` uses `#2563eb`, `rgba(37,99,235,0.10)`, etc.). The sidebar's "no raw hex" rule does **not** apply to content-script overlay code.
- All content↔panel message type strings live in `src/utils/constants.js#MESSAGES`.
- Direction conventions (already established): content→panel via `postToSidebar(type, data)` → `{type, data}` (panel reads `e.data.data`); panel→content via `postToContent(type, data)` → `{type, ...data}` (content reads `e.data.<field>` flat).
- Overlay layer z-index is `2147483646` (above the page, just below the sidebar container's `2147483647`). Container is `pointer-events:none`; pins/composer/popover are `pointer-events:auto`.
- Pins represent **comments only** (records with a non-empty `comment`). Elements with only style edits get no pin. One comment per element (no threads).
- Pin anchor: the element's top-right corner. Save/dismiss in the composer: **Enter or click-away saves, Esc cancels, Shift+Enter = newline**; empty save deletes.
- Reuse `buildSelector` / `buildPath` / `findByPath` and the existing record/storage layer — do not duplicate them.
- Deferred (do NOT build): comment threads/replies, cross-page view, the React/shadow-DOM overlay (Approach B), Health-tab deletion.

---

### Task 1: Message constants + pin geometry helper

**Files:**
- Modify: `src/utils/constants.js` (add three `MESSAGES`)
- Create: `src/content/commentOverlayGeometry.js`
- Test: `src/content/commentOverlayGeometry.test.js`

**Interfaces:**
- Produces: `MESSAGES.RENDER_COMMENTS`, `MESSAGES.OPEN_COMMENT_COMPOSER`, `MESSAGES.COMMENT_SAVED`; `PIN_SIZE` (number) and `positionPin(rect, viewport, pinSize?) → {left, top, visible}` where `rect` is a DOMRect-like `{top,left,right,bottom,width,height}` and `viewport` is `{width, height}`.

- [ ] **Step 1: Add message constants**

In `src/utils/constants.js`, add inside the `MESSAGES` object (before its closing `}`):

```js
  RENDER_COMMENTS: 'AWWDITS_RENDER_COMMENTS',
  OPEN_COMMENT_COMPOSER: 'AWWDITS_OPEN_COMMENT_COMPOSER',
  COMMENT_SAVED: 'AWWDITS_COMMENT_SAVED',
```

- [ ] **Step 2: Write the failing tests**

`src/content/commentOverlayGeometry.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { positionPin, PIN_SIZE } from './commentOverlayGeometry.js';

const vp = { width: 1000, height: 800 };
const rect = (o) => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, ...o });

describe('positionPin', () => {
  it('anchors the pin centered on the top-right corner', () => {
    const r = rect({ top: 100, left: 100, right: 300, bottom: 200, width: 200, height: 100 });
    expect(positionPin(r, vp)).toEqual({ left: 300 - PIN_SIZE / 2, top: 100 - PIN_SIZE / 2, visible: true });
  });

  it('hides the pin when the element is fully above the viewport', () => {
    const r = rect({ top: -200, left: 100, right: 300, bottom: -100 });
    expect(positionPin(r, vp).visible).toBe(false);
  });

  it('hides the pin when the element is fully below the viewport', () => {
    const r = rect({ top: 900, left: 100, right: 300, bottom: 1000 });
    expect(positionPin(r, vp).visible).toBe(false);
  });

  it('clamps the pin inside the viewport at the top-right edge', () => {
    const r = rect({ top: 0, left: 980, right: 1000, bottom: 50 });
    const p = positionPin(r, vp);
    expect(p.left).toBe(vp.width - PIN_SIZE); // clamped from 1000 - PIN_SIZE/2
    expect(p.top).toBe(0);                    // clamped from -PIN_SIZE/2
    expect(p.visible).toBe(true);
  });

  it('keeps a partially-visible element visible and clamps top to 0', () => {
    const r = rect({ top: -10, left: 100, right: 300, bottom: 40 });
    const p = positionPin(r, vp);
    expect(p.visible).toBe(true);
    expect(p.top).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `commentOverlayGeometry.js` not found.

- [ ] **Step 4: Implement `src/content/commentOverlayGeometry.js`**

```js
// Pure geometry for a comment pin: given an element's viewport rect and the
// viewport size, return where the pin should sit and whether it should show.
// No DOM access, so it is unit-testable in the Vitest `node` environment.
export const PIN_SIZE = 28;

export function positionPin(rect, viewport, pinSize = PIN_SIZE) {
  const fullyOffscreen =
    rect.bottom < 0 || rect.top > viewport.height ||
    rect.right < 0 || rect.left > viewport.width;

  // Anchor centered on the element's top-right corner…
  let left = rect.right - pinSize / 2;
  let top = rect.top - pinSize / 2;

  // …then clamp so a partially-visible element's pin stays on screen.
  left = Math.max(0, Math.min(left, viewport.width - pinSize));
  top = Math.max(0, Math.min(top, viewport.height - pinSize));

  return { left, top, visible: !fullyOffscreen };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all existing suites + 5 new geometry tests).

- [ ] **Step 6: Commit**

```bash
git add src/utils/constants.js src/content/commentOverlayGeometry.js src/content/commentOverlayGeometry.test.js
git commit -m "feat(comments): message constants + pin geometry helper"
```

---

### Task 2: Comment overlay module (pins + composer + popover)

**Files:**
- Create: `src/content/comment-overlay.js`

**Interfaces:**
- Consumes: `positionPin`, `PIN_SIZE` (Task 1); `buildSelector` (`../utils/extractors/styleExtractor.js`), `buildPath`, `findByPath` (`../utils/helpers/domPath.js`).
- Produces: `initCommentOverlay({ onSave })`, `setComments(list)` where `list = [{selector, path, comment}]`, `openComposerFor(element, prefill?)`, `pulsePin(selector)`, `reposition()`, `destroy()`. `onSave` is called with `{selector, path, label, text}` (empty `text` = delete).

This whole module is one cohesive unit; it is verified by build (it is imported in Task 3). No unit tests — its only pure logic (`positionPin`) is already tested in Task 1.

- [ ] **Step 1: Create `src/content/comment-overlay.js`**

```js
// On-page comment overlay (vanilla DOM, PAGE context — no token shim; explicit
// colors like the other overlays). Renders one pin per commented element into a
// fixed layer, opens a composer/popover anchored to the element, and reports
// create/edit/delete back through `onSave`. State lives in the panel; this module
// only renders + reports. Kept behind a small interface so a future React/shadow
// -DOM version (Approach B) can replace the internals without touching callers.
import { positionPin } from './commentOverlayGeometry.js';
import { buildSelector } from '../utils/extractors/styleExtractor.js';
import { buildPath, findByPath } from '../utils/helpers/domPath.js';

const LAYER_ID = 'awwdits-comments';
const Z = 2147483646;

let layer = null;
let entries = [];   // [{ selector, path, comment, pinEl }]
let onSaveCb = null;
let composer = null; // { root, onDoc } | null
let popover = null;  // { root, entry, onDoc, onKey } | null
let bodyRO = null;
let rafPending = false;

// ---- lifecycle ----

export function initCommentOverlay({ onSave } = {}) {
  onSaveCb = onSave || null;
  if (!layer) {
    layer = document.createElement('div');
    layer.id = LAYER_ID;
    layer.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:${Z}`;
    document.body.appendChild(layer);
  }
  window.addEventListener('scroll', scheduleReposition, true);
  window.addEventListener('resize', scheduleReposition);
  bodyRO = new ResizeObserver(scheduleReposition);
  bodyRO.observe(document.documentElement);
}

export function destroy() {
  window.removeEventListener('scroll', scheduleReposition, true);
  window.removeEventListener('resize', scheduleReposition);
  if (bodyRO) { bodyRO.disconnect(); bodyRO = null; }
  closeComposer();
  closePopover();
  entries.forEach(e => e.pinEl.remove());
  entries = [];
  if (layer) { layer.remove(); layer = null; }
}

// ---- pins ----

export function setComments(list) {
  if (!layer) return; // overlay not initialized yet — ignore
  entries.forEach(e => e.pinEl.remove());
  entries = (list || []).map(c => {
    const pinEl = makePin();
    pinEl.addEventListener('click', ev => { ev.stopPropagation(); openPopover(entryFor(pinEl)); });
    layer.appendChild(pinEl);
    return { selector: c.selector, path: c.path || [], comment: c.comment, pinEl };
  });
  reposition();
}

export function pulsePin(selector) {
  const entry = entries.find(e => e.selector === selector);
  if (!entry) return;
  entry.pinEl.style.transition = 'transform 0.15s ease';
  entry.pinEl.style.transform = 'scale(1.4)';
  setTimeout(() => { entry.pinEl.style.transform = 'scale(1)'; }, 200);
}

function entryFor(pinEl) { return entries.find(e => e.pinEl === pinEl) || null; }

function makePin() {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;width:28px;height:28px;border-radius:50% 50% 50% 2px;background:#171717;' +
    'box-shadow:0 2px 8px rgba(0,0,0,0.35);cursor:pointer;display:none;align-items:center;' +
    'justify-content:center;pointer-events:auto;border:2px solid #fff;box-sizing:border-box';
  el.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  return el;
}

function findTarget(entry) {
  let el = null;
  try { el = entry.selector ? document.querySelector(entry.selector) : null; } catch { el = null; }
  if (!el) el = findByPath(entry.path);
  return el;
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
  if (popover) { const el = findTarget(popover.entry); if (el) positionCard(popover.root, el); }
}

// ---- composer ----

export function openComposerFor(element, prefill = '') {
  if (!element || !layer) return;
  closePopover();
  closeComposer();

  const root = document.createElement('div');
  root.style.cssText = cardCss();
  const ta = document.createElement('textarea');
  ta.value = prefill || '';
  ta.placeholder = 'Comment…';
  ta.style.cssText =
    'width:240px;min-height:60px;resize:vertical;border:1px solid #e5e5e5;border-radius:8px;padding:8px 10px;' +
    'font:13px/18px -apple-system,system-ui,sans-serif;color:#171717;outline:none;box-sizing:border-box';
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

  composer = { root, target: element, onDoc };
  positionCard(root, element);
  ta.focus();
}

function closeComposer() {
  if (!composer) return;
  document.removeEventListener('mousedown', composer.onDoc, true);
  composer.root.remove();
  composer = null;
}

// ---- popover (read / edit / delete) ----

function openPopover(entry) {
  if (!entry) return;
  closeComposer();
  closePopover();
  const el = findTarget(entry);
  if (!el) return;

  const root = document.createElement('div');
  root.style.cssText = cardCss();
  const text = document.createElement('div');
  text.textContent = entry.comment || '';
  text.style.cssText =
    'max-width:240px;font:13px/18px -apple-system,system-ui,sans-serif;color:#171717;white-space:pre-wrap;word-break:break-word';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;margin-top:8px;justify-content:flex-end';
  const editBtn = mkBtn('Edit');
  const delBtn = mkBtn('Delete');
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const target = findTarget(entry);
    closePopover();
    if (target) openComposerFor(target, entry.comment);
  });
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const d = describe(el);
    closePopover();
    if (onSaveCb) onSaveCb({ selector: d.selector, path: d.path, label: d.label, text: '' });
  });
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  root.appendChild(text);
  root.appendChild(actions);
  layer.appendChild(root);

  const onDoc = (e) => { if (!root.contains(e.target)) closePopover(); };
  const onKey = (e) => { if (e.key === 'Escape') closePopover(); };
  setTimeout(() => {
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onKey, true);
  }, 0);

  popover = { root, entry, onDoc, onKey };
  positionCard(root, el);
}

function closePopover() {
  if (!popover) return;
  document.removeEventListener('mousedown', popover.onDoc, true);
  document.removeEventListener('keydown', popover.onKey, true);
  popover.root.remove();
  popover = null;
}

// ---- shared bits ----

function cardCss() {
  return 'position:fixed;background:#fff;border:1px solid #e5e5e5;border-radius:10px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,0.18);padding:10px;pointer-events:auto;box-sizing:border-box';
}

function mkBtn(label) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText =
    'font:12px -apple-system,system-ui,sans-serif;padding:4px 10px;border-radius:6px;border:1px solid #e5e5e5;' +
    'background:#fafafa;color:#171717;cursor:pointer';
  return b;
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
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: `✓ built` for both bundles, no errors. (The module is not yet imported anywhere, so this only confirms it parses/bundles. Wiring happens in Task 3.)

- [ ] **Step 3: Commit**

```bash
git add src/content/comment-overlay.js
git commit -m "feat(comments): on-page overlay module (pins, composer, popover)"
```

---

### Task 3: Content-script wiring + selection exclusion

**Files:**
- Modify: `src/content/content-script.js`
- Modify: `src/content/element-selector.js` (exclude the overlay from selection)

**Interfaces:**
- Consumes: `initCommentOverlay`, `setComments`, `openComposerFor`, `pulsePin` (Task 2); `MESSAGES.*` (Task 1); `getSelectedElement`, `selectElement` (existing).
- Produces: initializes the overlay; posts `COMMENT_SAVED`; handles `RENDER_COMMENTS` and `OPEN_COMMENT_COMPOSER`; opens the composer on the `c` key; focuses the pin on `SELECT_BY_SELECTOR`.

- [ ] **Step 1: Add imports**

At the top of `src/content/content-script.js`, add:

```js
import { initCommentOverlay, setComments, openComposerFor, pulsePin, destroy as destroyCommentOverlay } from './comment-overlay.js';
```

- [ ] **Step 2: Initialize the overlay on `SIDEBAR_READY`**

In `handleSidebarMessage`, extend the `MESSAGES.SIDEBAR_READY` case to init the overlay (idempotent — `initCommentOverlay` guards its own layer). The case currently reads:

```js
    case MESSAGES.SIDEBAR_READY:
      scanPage();
      // Arm the inspector immediately — no "Start Inspecting" step.
      activateInspector();
      break;
```

Replace it with:

```js
    case MESSAGES.SIDEBAR_READY:
      initCommentOverlay({ onSave: payload => postToSidebar(MESSAGES.COMMENT_SAVED, payload) });
      scanPage();
      // Arm the inspector immediately — no "Start Inspecting" step.
      activateInspector();
      break;
```

Then tear the overlay down when the sidebar closes, so pins are only visible while the panel is open (spec requirement). In `removeSidebar()` (which is the single close path for both the toggle and `AWWDITS_CLOSE`), add `destroyCommentOverlay();` at the end. It currently reads:

```js
function removeSidebar() {
  if (sidebarFrame) {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    const container = document.getElementById('awwdits-sidebar-container');
    if (container) container.remove();
    sidebarFrame = null;
  }
  deactivateAll();
  window.removeEventListener('message', handleSidebarMessage);
}
```

Replace it with:

```js
function removeSidebar() {
  if (sidebarFrame) {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    const container = document.getElementById('awwdits-sidebar-container');
    if (container) container.remove();
    sidebarFrame = null;
  }
  deactivateAll();
  destroyCommentOverlay(); // clear pins/composer/popover + listeners; re-created on next SIDEBAR_READY
  window.removeEventListener('message', handleSidebarMessage);
}
```

- [ ] **Step 3: Handle `RENDER_COMMENTS` and `OPEN_COMMENT_COMPOSER`**

Add two cases to the same `switch` (next to `DEACTIVATE_ALL`):

```js
    case MESSAGES.RENDER_COMMENTS:
      setComments(e.data.comments || []);
      break;
    case MESSAGES.OPEN_COMMENT_COMPOSER: {
      const el = getSelectedElement();
      if (el) openComposerFor(el);
      break;
    }
```

(These are panel→content messages, so the payload is read flat: `e.data.comments`.)

- [ ] **Step 4: Focus the pin on `SELECT_BY_SELECTOR`**

The existing `SELECT_BY_SELECTOR` case selects the element. Extend it so a re-selected element scrolls into view and its pin pulses. It currently reads:

```js
    case MESSAGES.SELECT_BY_SELECTOR: {
      let target = null;
      try { target = document.querySelector(e.data.selector); } catch { target = null; }
      if (!target) target = findByPath(e.data.path);
      if (target) selectElement(target);
      else postToSidebar(MESSAGES.SELECT_NOT_FOUND, { selector: e.data.selector });
      break;
    }
```

Replace it with:

```js
    case MESSAGES.SELECT_BY_SELECTOR: {
      let target = null;
      try { target = document.querySelector(e.data.selector); } catch { target = null; }
      if (!target) target = findByPath(e.data.path);
      if (target) {
        selectElement(target);
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        pulsePin(e.data.selector);
      } else {
        postToSidebar(MESSAGES.SELECT_NOT_FOUND, { selector: e.data.selector });
      }
      break;
    }
```

- [ ] **Step 5: Add the `c` keyboard shortcut**

In the `// --- Bootstrap ---` section at the very bottom of `src/content/content-script.js` (module top level, always active), after the existing `document.addEventListener('keydown', …)` listener (the Alt+Shift+A sidebar toggle — no conflict with `c`), add a second keydown listener:

```js
// `c` opens the comment composer for the current selection (Figma-style), unless
// the user is typing in a field or a modifier is held.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'c' || e.metaKey || e.ctrlKey || e.altKey) return;
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
  const el = getSelectedElement();
  if (!el) return;
  e.preventDefault();
  openComposerFor(el);
}, true);
```

- [ ] **Step 6: Exclude the overlay from element selection**

In `src/content/element-selector.js`, the `isSidebar` guard currently reads:

```js
function isSidebar(el) {
  return !!(el.closest && (el.closest('#awwdits-sidebar-container') || el.closest('#awwdits-hl')));
}
```

Replace it with:

```js
function isSidebar(el) {
  return !!(el.closest && (
    el.closest('#awwdits-sidebar-container') ||
    el.closest('#awwdits-hl') ||
    el.closest('#awwdits-comments')
  ));
}
```

Also, in `src/content/content-script.js`, the ancestor-selection guard appears in the `SELECT_ANCESTOR` case as:

```js
        if (!parent.closest('#awwdits-sidebar-container') && !parent.closest('#awwdits-hl')) {
```

Replace it with:

```js
        if (!parent.closest('#awwdits-sidebar-container') && !parent.closest('#awwdits-hl') && !parent.closest('#awwdits-comments')) {
```

- [ ] **Step 7: Verify build + manual smoke**

Run: `npm run build`
Expected: `✓ built`, no errors. Load `dist/` unpacked: select an element, press `c` → a composer appears anchored to it (comments won't persist yet — the panel wiring is Task 4). No errors; clicking a pin or the page does not misfire selection onto the overlay.

- [ ] **Step 8: Commit**

```bash
git add src/content/content-script.js src/content/element-selector.js
git commit -m "feat(comments): content-script wiring, c-shortcut, overlay selection guard"
```

---

### Task 4: Panel — send comments, fold saves, drop the in-inspect composer

**Files:**
- Modify: `src/sidebar/App.jsx`
- Delete: `src/sidebar/notes/CommentComposer.jsx`

**Interfaces:**
- Consumes: `MESSAGES.RENDER_COMMENTS`, `MESSAGES.OPEN_COMMENT_COMPOSER`, `MESSAGES.COMMENT_SAVED`; `setCommentOp` (aliased `setComment` from `recordOps`), `removeEmpty`, `findRecord`, `currentTarget` (existing in App.jsx).
- Produces: sends `RENDER_COMMENTS` whenever `notes` changes; header comment button posts `OPEN_COMMENT_COMPOSER`; folds `COMMENT_SAVED` into `notes`.

- [ ] **Step 1: Remove the in-inspect composer import and render**

In `src/sidebar/App.jsx`, delete the import line:

```js
import CommentComposer from './notes/CommentComposer.jsx';
```

Delete the composer render block (currently rendered under the header):

```jsx
      {selectedElement && commentOpen && (
        <CommentComposer
          key={selectionId}
          value={currentComment}
          onSave={saveComment}
          onClose={() => setCommentOpen(false)}
        />
      )}
```

Delete the now-unused `commentOpen` state and the `saveComment` callback:

```js
  const [commentOpen, setCommentOpen] = useState(false);
```

```js
  const saveComment = useCallback((text) => {
    const t = currentTarget();
    if (!t) return;
    setNotes(prev => removeEmpty(setCommentOp(prev, t, text)));
  }, [currentTarget]);
```

Also remove the `setCommentOpen(false);` line from the `CLEAR_SELECTION` case and from `handleClearSelection` (the composer no longer lives in the panel). Keep `currentComment` and `currentTarget` — they still drive the header button's filled/outline state.

- [ ] **Step 2: Repoint the header comment button**

The header comment button currently toggles `commentOpen`. Change its `onClick` to open the on-page composer for the current selection:

```jsx
          {selectedElement && (
            <button
              onClick={() => postToContent(MESSAGES.OPEN_COMMENT_COMPOSER)}
              title={currentComment ? 'Edit comment' : 'Add comment'}
              className="awd-iconbtn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, color: currentComment ? COLOR.foreground : COLOR.foregroundMuted }}
            >
              {currentComment ? <IconMessageActive size={20} /> : <IconMessage size={20} stroke={1.75} />}
            </button>
          )}
```

- [ ] **Step 3: Send `RENDER_COMMENTS` whenever notes change**

Add an effect after the persistence effect:

```js
  // Mirror the commented elements to the page overlay whenever notes change.
  useEffect(() => {
    postToContent(MESSAGES.RENDER_COMMENTS, {
      comments: notes
        .filter(n => n.comment && n.comment.trim())
        .map(n => ({ selector: n.selector, path: n.path, comment: n.comment })),
    });
  }, [notes, postToContent]);
```

- [ ] **Step 4: Fold `COMMENT_SAVED` into notes**

Add a case to the `handleMessage` switch (content→panel, so read `e.data.data`):

```js
        case MESSAGES.COMMENT_SAVED: {
          const { selector, path, label, text } = e.data.data;
          setNotes(prev => removeEmpty(setCommentOp(prev, { selector, path, label }, text)));
          break;
        }
```

- [ ] **Step 5: Delete the panel composer file**

```bash
git rm src/sidebar/notes/CommentComposer.jsx
```

- [ ] **Step 6: Verify build + manual end-to-end**

Run: `npm run build`
Expected: `✓ built`, no errors, and `grep -n "CommentComposer\|commentOpen\|saveComment" src/sidebar/App.jsx` returns nothing. Load `dist/`: select an element, press `c` or the header bubble → composer on the page → type → Enter saves → a pin appears anchored to the element and the header bubble fills. Click the pin → popover with the comment + Edit/Delete. The comment appears in the home Notes list; Copy/Export include it. Delete (or empty-save) removes the pin and the note.

- [ ] **Step 7: Commit**

```bash
git add src/sidebar/App.jsx
git commit -m "feat(comments): panel sends RENDER_COMMENTS, folds COMMENT_SAVED, drops panel composer"
```

---

### Task 5: Integration pass

**Files:** none (verification only)

- [ ] **Step 1: Run the unit tests**

Run: `npm test`
Expected: all pass (recordOps 8 + exportNotes 4 + geometry 5).

- [ ] **Step 2: Full manual matrix (load `dist/` unpacked, dark + light)**

Verify each: select an element, press `c` and (separately) the header bubble — both open the on-page composer; Enter and click-away both save; Esc cancels; Shift+Enter inserts a newline; a saved comment shows a pin anchored to the element's top-right; the pin tracks the element on scroll and window resize; a pin hides when its element scrolls fully out of view and returns on scroll back; clicking a pin opens the popover (read); Edit reopens the composer prefilled; Delete removes the pin and the note; an element removed from the page shows no pin but still appears in the home Notes list as "not found on this page"; a Notes-list row click re-selects the element, scrolls it into view, and pulses its pin; Copy-all / Export include comment text; reload restores pins from storage; the inspect view shows no comment composer anywhere.

- [ ] **Step 3: Commit any fixes, then finalize**

```bash
git add -A && git commit -m "test(comments): integration pass fixes"
```

---

## Self-Review Notes

- **Spec coverage:** on-page pins → Tasks 2–4; compose via `c`/button → Tasks 2–4; read/edit/delete popover → Task 2; pins comment-only + one-per-element → Task 4 (`RENDER_COMMENTS` filters non-empty comments; `setComment` keeps one comment per record); positioning/off-screen/not-found → Tasks 1–2; drop in-inspect composer, keep Notes list → Task 4; Notes-row focuses pin → Task 3; geometry unit test → Task 1. All covered.
- **Type consistency:** `RENDER_COMMENTS` payload `comments:[{selector,path,comment}]` matches `setComments`'s expected list; `COMMENT_SAVED` payload `{selector,path,label,text}` matches both `openComposerFor`'s `onSave` argument and `setCommentOp`'s `(records, {selector,path,label}, text)` signature. `positionPin(rect, viewport)` return `{left,top,visible}` is consumed verbatim in `reposition`.
- **Message directions:** `RENDER_COMMENTS`/`OPEN_COMMENT_COMPOSER` are panel→content (read flat: `e.data.comments`); `COMMENT_SAVED` is content→panel (read `e.data.data`). Consistent with the established wrappers.
- **Known MVP limits (documented in spec):** the `c` shortcut only fires when page (not sidebar) has focus — the header button covers the sidebar-focus case; re-finding every pin each frame is fine for the small comment counts expected; overlapping pins are not de-cluttered.
