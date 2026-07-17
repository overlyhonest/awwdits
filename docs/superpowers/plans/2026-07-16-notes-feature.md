# Notes Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-URL comments and tracked style changes to the awwdits panel, with a home-screen Notes list and comment+CSS text export.

**Architecture:** A per-page record store (`chrome.storage.local`, keyed by URL) is the single source. The content script reports each style/text edit's `before→after` to the panel; the panel folds it into the store and renders a Notes list on the home screen. Pure logic (record ops, export formatting) is unit-tested with Vitest; UI + content-script wiring is build-and-manually verified.

**Tech Stack:** React 18, Vite 4, Chrome MV3 (content script ↔ sidebar iframe via `postMessage`; `chrome.storage.local` for persistence), Vitest for unit tests.

## Global Constraints

- Chrome MV3. The `storage` permission is already in `manifest.json` — no manifest change needed.
- Sidebar components are **inline-styled** and read colors/fonts through the `COLOR`/`FONT` shim in `src/sidebar/components/redesign/tokens.js`. **No raw hex** in component code.
- All content↔panel message type strings live in `src/utils/constants.js#MESSAGES`.
- Storage key is `awwdits-notes:` + `URL.origin + URL.pathname` (ignore query/hash).
- Export text format (exact):
  ```
  button.cta — "tighten padding"
    padding: 12px → 8px
    border-radius: 4px → 8px
  ```
- Deferred (do NOT build): on-page pins, Health tab in nav, threads, cross-page view.

---

### Task 1: Test harness + record operations

**Files:**
- Create: `vitest.config.js`
- Modify: `package.json` (add devDep + `test` script)
- Create: `src/sidebar/notes/recordOps.js`
- Test: `src/sidebar/notes/recordOps.test.js`

**Interfaces:**
- Produces: `upsertEdit(records, {selector, path, label, property, before, after}, now?) → records`, `setComment(records, {selector, path, label}, text, now?) → records`, `clearEdits(records, selector, now?) → records`, `removeEmpty(records) → records`, `sortRecords(records) → records`, `findRecord(records, selector) → record|null`. A record is `{selector, path, label, comment, edits:[{property, before, after}], updatedAt}`.

- [ ] **Step 1: Add Vitest dev dependency and script**

In `package.json`, add to `"scripts"`: `"test": "vitest run"`. Add to `"devDependencies"`: `"vitest": "^0.34.6"`. Then run `npm install`.

- [ ] **Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.js'] },
});
```

- [ ] **Step 3: Write the failing tests**

`src/sidebar/notes/recordOps.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { upsertEdit, setComment, clearEdits, removeEmpty, sortRecords } from './recordOps.js';

const base = { selector: 'button.cta', path: [{ tag: 'button', index: 0 }], label: 'button.cta' };

describe('upsertEdit', () => {
  it('adds a new record with the edit', () => {
    const r = upsertEdit([], { ...base, property: 'padding', before: '12px', after: '8px' }, 1);
    expect(r).toHaveLength(1);
    expect(r[0].edits).toEqual([{ property: 'padding', before: '12px', after: '8px' }]);
    expect(r[0].updatedAt).toBe(1);
  });

  it('keeps the first before on a second edit of the same property', () => {
    let r = upsertEdit([], { ...base, property: 'padding', before: '12px', after: '8px' }, 1);
    r = upsertEdit(r, { ...base, property: 'padding', before: '8px', after: '4px' }, 2);
    expect(r[0].edits).toEqual([{ property: 'padding', before: '12px', after: '4px' }]);
  });

  it('drops the edit when reverted (after == before)', () => {
    let r = upsertEdit([], { ...base, property: 'padding', before: '12px', after: '8px' }, 1);
    r = upsertEdit(r, { ...base, property: 'padding', before: '8px', after: '12px' }, 2);
    expect(r[0].edits).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [];
    upsertEdit(input, { ...base, property: 'padding', before: '12px', after: '8px' }, 1);
    expect(input).toEqual([]);
  });
});

describe('setComment / clearEdits / removeEmpty / sortRecords', () => {
  it('setComment creates a record and stores text', () => {
    const r = setComment([], base, 'too tight', 5);
    expect(r[0].comment).toBe('too tight');
  });

  it('clearEdits empties edits but keeps the record', () => {
    let r = upsertEdit([], { ...base, property: 'padding', before: '12px', after: '8px' }, 1);
    r = clearEdits(r, 'button.cta', 9);
    expect(r[0].edits).toEqual([]);
  });

  it('removeEmpty drops records with no comment and no edits', () => {
    const r = removeEmpty([{ selector: 'a', comment: '', edits: [] }, { selector: 'b', comment: 'x', edits: [] }]);
    expect(r.map(x => x.selector)).toEqual(['b']);
  });

  it('sortRecords orders by updatedAt descending', () => {
    const r = sortRecords([{ updatedAt: 1 }, { updatedAt: 3 }, { updatedAt: 2 }]);
    expect(r.map(x => x.updatedAt)).toEqual([3, 2, 1]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `recordOps.js` module not found.

- [ ] **Step 5: Implement `src/sidebar/notes/recordOps.js`**

```js
// Pure operations on the notes record list. All return new arrays (immutable);
// `now` is injectable so callers/tests control timestamps.

function cloneRecords(records) {
  return records.map(r => ({ ...r, edits: r.edits.map(e => ({ ...e })) }));
}

function ensureRecord(next, { selector, path, label }, now) {
  let rec = next.find(r => r.selector === selector);
  if (!rec) {
    rec = { selector, path: path || [], label: label || selector, comment: '', edits: [], updatedAt: now };
    next.push(rec);
  }
  return rec;
}

export function findRecord(records, selector) {
  return records.find(r => r.selector === selector) || null;
}

export function upsertEdit(records, { selector, path, label, property, before, after }, now = Date.now()) {
  const next = cloneRecords(records);
  const rec = ensureRecord(next, { selector, path, label }, now);
  const existing = rec.edits.find(e => e.property === property);
  if (existing) existing.after = after;                 // keep the original `before`
  else rec.edits.push({ property, before, after });
  rec.edits = rec.edits.filter(e => e.after !== e.before); // revert removes the edit
  if (!rec.path || !rec.path.length) rec.path = path || [];
  rec.updatedAt = now;
  return next;
}

export function setComment(records, { selector, path, label }, text, now = Date.now()) {
  const next = cloneRecords(records);
  const rec = ensureRecord(next, { selector, path, label }, now);
  rec.comment = text;
  rec.updatedAt = now;
  return next;
}

export function clearEdits(records, selector, now = Date.now()) {
  return records.map(r => (r.selector === selector ? { ...r, edits: [], updatedAt: now } : r));
}

export function removeEmpty(records) {
  return records.filter(r => (r.comment && r.comment.trim()) || r.edits.length > 0);
}

export function sortRecords(records) {
  return [...records].sort((a, b) => b.updatedAt - a.updatedAt);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (9 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json vitest.config.js src/sidebar/notes/recordOps.js src/sidebar/notes/recordOps.test.js
git commit -m "feat(notes): record operations + vitest harness"
```

---

### Task 2: Export formatter

**Files:**
- Create: `src/sidebar/notes/exportNotes.js`
- Test: `src/sidebar/notes/exportNotes.test.js`

**Interfaces:**
- Consumes: record shape from Task 1.
- Produces: `formatRecord(record) → string`, `formatAll(records) → string`.

- [ ] **Step 1: Write the failing tests**

`src/sidebar/notes/exportNotes.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { formatRecord, formatAll } from './exportNotes.js';

describe('formatRecord', () => {
  it('formats comment + edits', () => {
    const out = formatRecord({
      selector: 'button.cta', comment: 'tighten padding',
      edits: [{ property: 'padding', before: '12px', after: '8px' }, { property: 'border-radius', before: '4px', after: '8px' }],
    });
    expect(out).toBe('button.cta — "tighten padding"\n  padding: 12px → 8px\n  border-radius: 4px → 8px');
  });

  it('formats a comment-only record (no CSS block)', () => {
    expect(formatRecord({ selector: 'nav a', comment: 'off-brand', edits: [] }))
      .toBe('nav a — "off-brand"');
  });

  it('formats an edits-only record (no comment quote)', () => {
    expect(formatRecord({ selector: '.hero h1', comment: '', edits: [{ property: 'line-height', before: '1.1', after: '1.3' }] }))
      .toBe('.hero h1\n  line-height: 1.1 → 1.3');
  });
});

describe('formatAll', () => {
  it('joins records with a blank line', () => {
    const out = formatAll([
      { selector: 'a', comment: 'x', edits: [] },
      { selector: 'b', comment: 'y', edits: [] },
    ]);
    expect(out).toBe('a — "x"\n\nb — "y"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `exportNotes.js` not found.

- [ ] **Step 3: Implement `src/sidebar/notes/exportNotes.js`**

```js
// Render notes records to plain text: "selector — \"comment\"" then a CSS
// before→after line per edit.
export function formatRecord(record) {
  const c = record.comment && record.comment.trim();
  const head = c ? `${record.selector} — "${c}"` : record.selector;
  const lines = [head];
  for (const e of record.edits) lines.push(`  ${e.property}: ${e.before || '—'} → ${e.after}`);
  return lines.join('\n');
}

export function formatAll(records) {
  return records.map(formatRecord).join('\n\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sidebar/notes/exportNotes.js src/sidebar/notes/exportNotes.test.js
git commit -m "feat(notes): text export formatter"
```

---

### Task 3: DOM path helpers + element path

**Files:**
- Create: `src/utils/helpers/domPath.js`
- Modify: `src/utils/extractors/styleExtractor.js` (export `buildSelector`; add `path` to the element object)

**Interfaces:**
- Produces: `buildPath(el) → [{tag, index}]`, `findByPath(path) → Element|null`, and an exported `buildSelector(el) → string`. `extractElementStyles(el).element` gains `path`.

- [ ] **Step 1: Create `src/utils/helpers/domPath.js`**

```js
// A positional fallback path from <body> to an element: [{tag, index}], where
// index is the element's position among its parent's children. Re-finds an
// element when its CSS selector isn't unique.
export function buildPath(el) {
  const path = [];
  let node = el;
  while (node && node.nodeType === 1 && node.tagName !== 'BODY' && node.tagName !== 'HTML') {
    const parent = node.parentElement;
    if (!parent) break;
    const index = Array.prototype.indexOf.call(parent.children, node);
    path.unshift({ tag: node.tagName.toLowerCase(), index });
    node = parent;
  }
  return path;
}

export function findByPath(path) {
  if (!Array.isArray(path) || !path.length) return null;
  let node = document.body;
  for (const step of path) {
    const child = node && node.children[step.index];
    if (!child || child.tagName.toLowerCase() !== step.tag) return null;
    node = child;
  }
  return node && node !== document.body ? node : null;
}
```

- [ ] **Step 2: Export `buildSelector` and add `path` in `styleExtractor.js`**

At the top of `src/utils/extractors/styleExtractor.js`, add to the imports:

```js
import { buildPath } from '../helpers/domPath.js';
```

Change `function buildSelector(element) {` (line ~191) to `export function buildSelector(element) {`.

In the returned object's `element` block, add `path`:

```js
    element: {
      tag,
      classes: Array.from(element.classList),
      id: element.id || null,
      selector: buildSelector(element),
      path: buildPath(element),
    },
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: `✓ built` for both bundles, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/helpers/domPath.js src/utils/extractors/styleExtractor.js
git commit -m "feat(notes): dom path helpers + element path"
```

---

### Task 4: Message constants + storage wrapper

**Files:**
- Modify: `src/utils/constants.js`
- Create: `src/sidebar/notes/notesStorage.js`

**Interfaces:**
- Produces: `MESSAGES.CHANGE_APPLIED`, `MESSAGES.CHANGES_CLEARED`, `MESSAGES.SELECT_BY_SELECTOR`, `MESSAGES.SELECT_NOT_FOUND`; `loadNotes(url) → Promise<records>`, `saveNotes(url, records) → Promise<void>`, `storageKey(url) → string`.

- [ ] **Step 1: Add message constants**

In `src/utils/constants.js`, add inside the `MESSAGES` object:

```js
  CHANGE_APPLIED: 'AWWDITS_CHANGE_APPLIED',
  CHANGES_CLEARED: 'AWWDITS_CHANGES_CLEARED',
  SELECT_BY_SELECTOR: 'AWWDITS_SELECT_BY_SELECTOR',
  SELECT_NOT_FOUND: 'AWWDITS_SELECT_NOT_FOUND',
```

- [ ] **Step 2: Create `src/sidebar/notes/notesStorage.js`**

```js
// Per-URL persistence for notes records via chrome.storage.local. Keyed by
// origin+pathname so notes survive query/hash changes. Degrades to empty/no-op
// if storage is unavailable — never throws into the UI.
const PREFIX = 'awwdits-notes:';

export function storageKey(url) {
  try { const u = new URL(url); return PREFIX + u.origin + u.pathname; }
  catch { return PREFIX + (url || 'unknown'); }
}

export async function loadNotes(url) {
  try {
    const key = storageKey(url);
    const got = await chrome.storage.local.get(key);
    return Array.isArray(got[key]) ? got[key] : [];
  } catch { return []; }
}

export async function saveNotes(url, records) {
  try { await chrome.storage.local.set({ [storageKey(url)]: records }); }
  catch { /* storage blocked / quota — degrade to in-memory */ }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `✓ built`, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/constants.js src/sidebar/notes/notesStorage.js
git commit -m "feat(notes): messages + per-URL storage wrapper"
```

---

### Task 5: Content script — change reporting + select-by-selector

**Files:**
- Modify: `src/content/content-script.js`

**Interfaces:**
- Consumes: `MESSAGES.*` (Task 4), `buildSelector` (Task 3), `buildPath`/`findByPath` (Task 3), `getSelectedElement`/`selectElement` (existing).
- Produces: posts `CHANGE_APPLIED {selector, path, label, property, before, after}` and `CHANGES_CLEARED {selector}` to the panel; handles `SELECT_BY_SELECTOR {selector, path}` → selects or posts `SELECT_NOT_FOUND {selector}`.

- [ ] **Step 1: Add imports**

At the top of `src/content/content-script.js`, add:

```js
import { buildSelector } from '../utils/extractors/styleExtractor.js';
import { buildPath, findByPath } from '../utils/helpers/domPath.js';
```

- [ ] **Step 2: Report changes from `APPLY_STYLE`**

Replace the existing `case MESSAGES.APPLY_STYLE:` block body so it captures before/after and reports:

```js
    case MESSAGES.APPLY_STYLE: {
      const el = getSelectedElement();
      if (el && e.data.property) {
        const kebab = e.data.property.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
        const before = getComputedStyle(el).getPropertyValue(kebab).trim();
        el.style.setProperty(kebab, e.data.value, 'important');
        if (e.data.property === 'fontFamily') injectGoogleFont(e.data.value);
        postToSidebar(MESSAGES.CHANGE_APPLIED, {
          selector: buildSelector(el), path: buildPath(el), label: buildSelector(el),
          property: kebab, before, after: e.data.value,
        });
      }
      break;
    }
```

- [ ] **Step 3: Report changes from `APPLY_TEXT`**

Replace the `case MESSAGES.APPLY_TEXT:` block body:

```js
    case MESSAGES.APPLY_TEXT: {
      const el = getSelectedElement();
      if (el && typeof e.data.value === 'string' && el.children.length === 0) {
        const before = el.textContent;
        el.textContent = e.data.value;
        postToSidebar(MESSAGES.CHANGE_APPLIED, {
          selector: buildSelector(el), path: buildPath(el), label: buildSelector(el),
          property: 'text', before, after: e.data.value,
        });
      }
      break;
    }
```

- [ ] **Step 4: Report `CHANGES_CLEARED` from `RESET_STYLES`**

Replace the `case MESSAGES.RESET_STYLES:` block body:

```js
    case MESSAGES.RESET_STYLES: {
      const el = getSelectedElement();
      if (el) {
        el.removeAttribute('style');
        postToSidebar(MESSAGES.CHANGES_CLEARED, { selector: buildSelector(el) });
      }
      break;
    }
```

- [ ] **Step 5: Handle `SELECT_BY_SELECTOR`**

Add a new case in the same `switch` (next to `SELECT_ANCESTOR`):

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

- [ ] **Step 6: Verify build + manual smoke**

Run: `npm run build`
Expected: `✓ built`. Load `dist/` unpacked, select an element, enter edit mode, change a value. In the page's devtools console the panel iframe receives `CHANGE_APPLIED` (verify later via storage in Task 6). No errors, selection stays.

- [ ] **Step 7: Commit**

```bash
git add src/content/content-script.js
git commit -m "feat(notes): content-script change reporting + select-by-selector"
```

---

### Task 6: Panel data layer — track, persist, select

**Files:**
- Modify: `src/sidebar/App.jsx`

**Interfaces:**
- Consumes: `recordOps` (Task 1), `notesStorage` (Task 4), `MESSAGES.*`.
- Produces: `notes` state kept in sync with storage; `selectBySelector(record)`, `saveComment(text)`, and `notesFor` derivation available to later UI tasks. Establishes `currentTarget()` = `{selector, path, label}` from the current selection.

- [ ] **Step 1: Add imports and state**

At the top of `src/sidebar/App.jsx` add:

```js
import { upsertEdit, setComment as setCommentOp, clearEdits, removeEmpty, sortRecords, findRecord } from './notes/recordOps.js';
import { loadNotes, saveNotes } from './notes/notesStorage.js';
```

Add state (near the other `useState` calls):

```js
  const [notes, setNotes] = useState([]);
  const [pageUrl, setPageUrl] = useState('');
```

- [ ] **Step 2: Load notes when page data (with url) arrives**

In the `handleMessage` switch, extend the `PAGE_DATA` case to capture the url and load notes:

```js
        case MESSAGES.PAGE_DATA:
          setPageData(e.data.data);
          setScanning(false);
          if (e.data.data?.url && e.data.data.url !== pageUrl) {
            setPageUrl(e.data.data.url);
            loadNotes(e.data.data.url).then(setNotes);
          }
          break;
```

- [ ] **Step 3: Add a persistence effect and the current-target helper**

After the state declarations, add:

```js
  // Persist notes (empties pruned) whenever they change.
  useEffect(() => {
    if (!pageUrl) return;
    saveNotes(pageUrl, removeEmpty(notes));
  }, [notes, pageUrl]);

  const currentTarget = useCallback(() => {
    const el = selectedElement?.styles?.element;
    if (!el) return null;
    return { selector: el.selector, path: el.path || [], label: el.selector };
  }, [selectedElement]);
```

- [ ] **Step 4: Handle CHANGE_APPLIED / CHANGES_CLEARED / SELECT_NOT_FOUND**

Add cases to the `handleMessage` switch:

```js
        case MESSAGES.CHANGE_APPLIED:
          setNotes(prev => removeEmpty(upsertEdit(prev, e.data.data)));
          break;
        case MESSAGES.CHANGES_CLEARED:
          setNotes(prev => removeEmpty(clearEdits(prev, e.data.data.selector)));
          break;
        case MESSAGES.SELECT_NOT_FOUND:
          setNotFound(e.data.data.selector);
          break;
```

Add the supporting state near the others: `const [notFound, setNotFound] = useState(null);`

- [ ] **Step 5: Add comment save + select-by-selector handlers**

Add callbacks (near the other `useCallback`s):

```js
  const saveComment = useCallback((text) => {
    const t = currentTarget();
    if (!t) return;
    setNotes(prev => removeEmpty(setCommentOp(prev, t, text)));
  }, [currentTarget]);

  const selectBySelector = useCallback((record) => {
    setNotFound(null);
    postToContent(MESSAGES.SELECT_BY_SELECTOR, { selector: record.selector, path: record.path });
  }, [postToContent]);
```

- [ ] **Step 6: Verify build + manual persistence check**

Run: `npm run build`. Load `dist/`, edit an element's value, then in the page devtools run
`chrome.storage.local.get(console.log)` — a `awwdits-notes:<origin+path>` key holds a record with the edit `{property, before, after}`. Reload the page → the key persists. Reset styles → the edit clears.

- [ ] **Step 7: Commit**

```bash
git add src/sidebar/App.jsx
git commit -m "feat(notes): panel change tracking + persistence"
```

---

### Task 7: Home UI — remove tabs, minimized hero, Notes list

**Files:**
- Modify: `src/sidebar/components/redesign/InspectEmptyState.jsx` (add `minimized` variant)
- Create: `src/sidebar/notes/NotesRow.jsx`
- Create: `src/sidebar/notes/NotesList.jsx`
- Modify: `src/sidebar/App.jsx` (remove `TabBar`; render home = hero + NotesList)

**Interfaces:**
- Consumes: `notes`, `selectBySelector`, `sortRecords`, `formatRecord`/`formatAll`, `copyText`.
- Produces: `NotesList({records, onSelect, notFound})`, `NotesRow({record, onSelect, notFound})`.

- [ ] **Step 1: Add a `minimized` variant to `InspectEmptyState`**

In `src/sidebar/components/redesign/InspectEmptyState.jsx`, change the signature to accept `minimized` and, when true, return a compact strip. Add at the very start of the function body (after the existing signature line `function InspectEmptyState({ mod = MOD, manualArmed = false, onPickManually }) {` — add `minimized = false` to the destructure):

```jsx
  if (minimized) {
    return (
      <div className="awd-empty" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px', width: '100%', boxSizing: 'border-box', borderBottom: `1px solid ${COLOR.border}` }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: MARK_GRADIENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCurrentLocation size={16} stroke={1.75} />
        </div>
        <span style={{ fontFamily: FONT.display, fontWeight: 400, fontSize: 13, color: COLOR.foreground }}>Read any element</span>
        <button type="button" onClick={onPickManually} disabled={manualArmed} className="awd-btn" style={{ marginLeft: 'auto', height: 30, padding: '0 12px', borderRadius: 8, background: COLOR.surface, border: `1px solid ${COLOR.borderStrong}`, color: COLOR.foreground, fontFamily: FONT.display, fontSize: 12, cursor: manualArmed ? 'default' : 'pointer', flexShrink: 0 }}>
          {manualArmed ? 'Waiting…' : 'Pick element'}
        </button>
      </div>
    );
  }
```

- [ ] **Step 2: Create `src/sidebar/notes/NotesRow.jsx`**

```jsx
import { FONT, COLOR } from '../components/redesign/tokens.js';
import CopyValue from '../components/Inspector/CopyValue.jsx';
import { formatRecord } from './exportNotes.js';

// One note: selector + note snippet + edit-count, click to re-select the element.
function NotesRow({ record, onSelect, notFound }) {
  const editCount = record.edits.length;
  return (
    <div
      className="awd-row"
      role="button"
      tabIndex={0}
      onClick={() => onSelect(record)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(record); } }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '8px 14px', cursor: 'pointer', borderBottom: `1px solid ${COLOR.borderWeak}` }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 13, color: COLOR.foreground, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.selector}</span>
        {record.comment
          ? <span style={{ fontFamily: FONT.sans, fontSize: 12, color: COLOR.foregroundLabel, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.comment}</span>
          : editCount > 0 && <span style={{ fontFamily: FONT.sans, fontSize: 12, color: COLOR.foregroundWeak }}>{editCount} edit{editCount === 1 ? '' : 's'}</span>}
        {notFound === record.selector && <span style={{ fontFamily: FONT.sans, fontSize: 11, color: COLOR.warning }}>not found on this page</span>}
      </div>
      {record.comment && editCount > 0 && (
        <span style={{ fontFamily: FONT.mono, fontSize: 11, color: COLOR.foregroundWeak, flexShrink: 0 }}>{editCount}</span>
      )}
      <span onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
        <CopyValue value="copy" copyText={formatRecord(record)} style={{ fontFamily: FONT.sans, fontSize: 12, color: COLOR.foregroundLabel }} />
      </span>
    </div>
  );
}

export default NotesRow;
```

- [ ] **Step 3: Create `src/sidebar/notes/NotesList.jsx`**

```jsx
import { FONT, COLOR } from '../components/redesign/tokens.js';
import { copyText } from '../components/redesign/clipboard.js';
import { formatAll } from './exportNotes.js';
import { sortRecords } from './recordOps.js';
import NotesRow from './NotesRow.jsx';

// Downloads the notes as a .txt via a detached anchor (same trick as image
// download — never attached to the page).
function downloadText(text) {
  try {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'awwdits-notes.txt';
    a.click();
    URL.revokeObjectURL(url);
  } catch { /* no-op */ }
}

function NotesList({ records, onSelect, notFound }) {
  if (!records.length) return null;
  const sorted = sortRecords(records);
  const HEADER_BTN = { fontFamily: FONT.display, fontSize: 12, color: COLOR.foreground, background: COLOR.surface, border: `1px solid ${COLOR.borderStrong}`, borderRadius: 8, height: 30, padding: '0 12px', cursor: 'pointer' };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 14px 10px' }}>
        <span style={{ fontFamily: FONT.display, fontSize: 11, color: COLOR.foreground }}>Notes</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 11, color: COLOR.foregroundWeak }}>{records.length}</span>
        <button type="button" className="awd-btn" style={{ ...HEADER_BTN, marginLeft: 'auto' }} onClick={() => copyText(formatAll(sorted))}>Copy all</button>
        <button type="button" className="awd-btn" style={HEADER_BTN} onClick={() => downloadText(formatAll(sorted))}>Export</button>
      </div>
      {sorted.map(r => <NotesRow key={r.selector} record={r} onSelect={onSelect} notFound={notFound} />)}
    </div>
  );
}

export default NotesList;
```

- [ ] **Step 4: Wire home layout in `App.jsx` and remove the tab bar**

Add the import: `import NotesList from './notes/NotesList.jsx';` and remove the `TabBar` import.

Replace the tab-content + tab-bar region of the render. The current body renders `activeTab === 'inspect' ? <InspectZone…/> : <ReportSection…/>` and then `{!selectedElement && <TabBar…/>}`. Replace with a home composition when no element is selected:

```jsx
      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {selectedElement ? (
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
        ) : (
          <>
            <InspectEmptyState
              minimized={notes.length > 0}
              manualArmed={manualArmed}
              onPickManually={handleManualPick}
            />
            <NotesList records={notes} onSelect={selectBySelector} notFound={notFound} />
          </>
        )}
      </div>
```

Delete the `<TabBar … />` line and the now-unused `activeTab`/`setActiveTab` state and the `case ... setActiveTab('inspect')` line in the ELEMENT_SELECTED handler, and the `ReportSection`/`InspectZone`-vs branch that used `activeTab`. (InspectZone already renders its own empty state when `selected` is null, but here we only mount it when `selectedElement` is truthy.) Import `InspectEmptyState` at the top: `import InspectEmptyState from './components/redesign/InspectEmptyState.jsx';`

- [ ] **Step 5: Verify build + manual**

Run: `npm run build`. Load `dist/`: home shows the full hero with no tabs; after one edit, the hero minimizes and a Notes list appears; clicking a row re-selects + highlights the element; Copy all / Export produce the text; a removed element shows "not found on this page".

- [ ] **Step 6: Commit**

```bash
git add src/sidebar/App.jsx src/sidebar/components/redesign/InspectEmptyState.jsx src/sidebar/notes/NotesRow.jsx src/sidebar/notes/NotesList.jsx
git commit -m "feat(notes): home notes list, minimized hero, no tabs"
```

---

### Task 8: Comment composer + header button

**Files:**
- Modify: `src/sidebar/components/redesign/icons.jsx` (add message bubble icons)
- Create: `src/sidebar/notes/CommentComposer.jsx`
- Modify: `src/sidebar/App.jsx` (header comment button + composer render)

**Interfaces:**
- Consumes: `saveComment` (Task 6), `findRecord`, current selection.
- Produces: `CommentComposer({value, onSave, onClose})`.

- [ ] **Step 1: Add bubble icons**

In `src/sidebar/components/redesign/icons.jsx`, add to the export list: `IconMessage,` and `IconMessageFilled as IconMessageActive,`.

- [ ] **Step 2: Create `src/sidebar/notes/CommentComposer.jsx`**

```jsx
import { useState } from 'react';
import { FONT, COLOR } from '../components/redesign/tokens.js';

// A small composer for the selected element's note. Saves on Save; Clear empties.
function CommentComposer({ value, onSave, onClose }) {
  const [text, setText] = useState(value || '');
  const BTN = { fontFamily: FONT.display, fontSize: 12, height: 30, padding: '0 12px', borderRadius: 8, cursor: 'pointer' };
  return (
    <div style={{ padding: '10px 14px', borderBottom: `1px solid ${COLOR.border}`, background: COLOR.background }}>
      <textarea
        value={text}
        autoFocus
        onChange={e => setText(e.target.value)}
        placeholder="Comment on this element…"
        rows={3}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: FONT.sans, fontSize: 13, lineHeight: '18px', color: COLOR.foreground, background: COLOR.surfaceRecess, border: `1px solid ${COLOR.border}`, borderRadius: 8, padding: '8px 10px' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="awd-btn" style={{ ...BTN, marginLeft: 'auto', background: COLOR.surface, border: `1px solid ${COLOR.borderStrong}`, color: COLOR.foregroundMuted }} onClick={() => { setText(''); onSave(''); onClose(); }}>Clear</button>
        <button type="button" style={{ ...BTN, background: COLOR.foreground, border: 'none', color: COLOR.background }} onClick={() => { onSave(text.trim()); onClose(); }}>Save</button>
      </div>
    </div>
  );
}

export default CommentComposer;
```

- [ ] **Step 3: Add the header comment button + composer in `App.jsx`**

Add imports: `import CommentComposer from './notes/CommentComposer.jsx';` and add `IconMessage, IconMessageActive` to the icons import.

Add state: `const [commentOpen, setCommentOpen] = useState(false);` and derive the current note:

```js
  const currentComment = (() => {
    const t = currentTarget();
    const rec = t && findRecord(notes, t.selector);
    return rec?.comment || '';
  })();
```

In the header's right button group, before the edit pencil button, add the comment toggle (shown only when an element is selected):

```jsx
          {selectedElement && (
            <button
              onClick={() => setCommentOpen(v => !v)}
              title={currentComment ? 'Edit comment' : 'Add comment'}
              className="awd-iconbtn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, color: currentComment ? COLOR.foreground : COLOR.foregroundMuted }}
            >
              {currentComment ? <IconMessageActive size={20} /> : <IconMessage size={20} stroke={1.75} />}
            </button>
          )}
```

Render the composer directly under the header (before the body `div`), when open and an element is selected:

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

Reset `commentOpen` to false in the `CLEAR_SELECTION` handler (add `setCommentOpen(false);`).

- [ ] **Step 4: Verify build + manual**

Run: `npm run build`. Load `dist/`: with an element selected, the header bubble opens the composer; saving a note fills the bubble; the note appears in the home Notes list; Copy on a row includes the comment + CSS changes; clearing empties it.

- [ ] **Step 5: Commit**

```bash
git add src/sidebar/App.jsx src/sidebar/notes/CommentComposer.jsx src/sidebar/components/redesign/icons.jsx
git commit -m "feat(notes): comment composer + header button"
```

---

### Task 9: Integration pass

**Files:** none (verification only)

- [ ] **Step 1: Run the unit tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 2: Full manual matrix (load `dist/` unpacked, dark + light)**

Verify each: comment create/edit/clear; edit tracking with repeated edits on one property (first before kept); revert an edit back to original (drops from list); Reset styles clears edits but keeps the comment; reload the page → notes restored; Notes row click re-selects + highlights; removed element → "not found"; Copy one row; Copy all; Export downloads `awwdits-notes.txt`; hero full with zero records, minimized after the first record; no tab bar anywhere.

- [ ] **Step 3: Commit any fixes, then finalize**

```bash
git add -A && git commit -m "test(notes): integration pass fixes"
```

---

## Self-Review Notes

- **Spec coverage:** data model → Task 1; change tracking → Tasks 5–6; persistence → Tasks 4, 6; commenting → Task 8; notes list + re-find → Tasks 3, 5, 7; export → Tasks 2, 7; remove tabs / hero minimize → Task 7. All covered.
- **Type consistency:** record shape `{selector, path, label, comment, edits:[{property, before, after}], updatedAt}` is identical across `recordOps`, `exportNotes`, storage, and UI. `CHANGE_APPLIED` payload keys (`selector, path, label, property, before, after`) match `upsertEdit`'s argument object.
- **Known MVP limits (documented in spec):** non-unique selector collisions fall back to `path` then first match; shorthand props (e.g. `padding`) may yield an empty computed `before` (rendered as `—`); SPA hash routes share one pathname key.
