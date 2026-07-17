# Notes — comments, tracked changes, and export (design)

**Status:** approved for planning · **Date:** 2026-07-16 · **Branch:** to be created off `main`

## Summary

Add a lightweight review layer to the awwdits panel: as you edit an element's styles, the
panel **tracks what changed** (before → after); you can **comment** on an element; and you can
**copy/export** those comments with their change details as text. Comments and changes **persist
per page URL**. The bottom `Inspect · Health` tabs are removed; the home screen becomes a single
scroll — the empty-state hero on top, the **Notes list** beneath it once there's anything to show.

This is the **Panel-first MVP** (no on-page Figma pins yet). The data model is shaped so on-page
pins can be layered on later without rework.

## Scope

**In:**
- Track style/text edits per element as `{ property, before, after }`.
- Comment on the selected element (header speech-bubble button → composer).
- Persist comments + edits in `chrome.storage.local`, keyed by page URL.
- Home-screen Notes list (under the empty state); click a row to re-select + highlight the element.
- Copy one note, Copy all, Export `.txt` — format: comment + CSS before→after.
- Remove the `Inspect · Health` tab bar; simplify nav to home ⇄ awwditing.

**Out (deferred, YAGNI):**
- On-page Figma-style comment pins / overlay.
- The Health dashboard in nav (`ReportSection` stays in the repo, unwired).
- Threads/replies, multi-user, cross-page/global notes view, full edit history beyond before→after.

## User flows

1. **Comment:** select an element → click the header speech-bubble → type a note → save. The
   bubble icon fills when a note exists.
2. **Edit + track:** in edit mode, change styles/text → each change is recorded on that element's
   record (first `before` preserved; latest `after`; a change reverted to its original drops out).
3. **Review on home:** back on home, once ≥1 record exists, the hero minimizes and the Notes list
   shows every touched element (selector · note snippet · edit count). Click a row → re-selects +
   highlights it on the page and opens the awwditing screen.
4. **Export:** Copy all / Export `.txt` from the Notes list header; per-row copy for one element.

## Architecture

### Data model & store

One record per touched element (has a comment, edits, or both):

```js
{
  selector,        // buildSelector() output — display + primary re-find key
  path,            // positional fallback: array of {tag, index} from a stable ancestor
  label,           // short display label (selector or tag)
  comment,         // string, '' if none
  edits: [ { property, before, after } ],  // deduped by property; first `before` kept
  updatedAt,       // Date.now() at last mutation (used to order the Notes list)
}
```

- **Store module** `sidebar/notes/notesStore.js`: `load(url)`, `save(url, records)`, and pure
  helpers `upsertEdit(records, sel, path, change)`, `setComment(records, sel, path, text)`,
  `removeEmpty(records)` (drop records with no comment and no edits). Reads/writes
  `chrome.storage.local` under key `awwdits-notes:<url>`.
- **URL key:** `location.origin + location.pathname` (ignore query/hash so notes survive param
  changes). Provided by the content script (panel's own origin is the extension).

### Change tracking

- Content script's `APPLY_STYLE` / `APPLY_TEXT` handlers, after applying, **report** the change to
  the panel: `CHANGE_APPLIED { selector, path, property, before, after }`.
- `before` = the element's computed value for that property **before this apply**. The panel keeps
  the **first** `before` per (selector, property) and updates `after`; if `after` equals the stored
  `before`, the edit is removed (revert). Text edits use property `text`.
- `RESET_STYLES` → content reports `CHANGES_CLEARED { selector }`; panel drops that element's edits
  (keeps its comment).

### Persistence

- Panel owns storage (extension context has `chrome.storage.local`).
- On `PAGE_DATA` (which now carries `url`), panel `load(url)` → hydrates in-memory records.
- Every mutation (edit reported, comment saved, reset) → update records → `save(url, records)`
  (debounced). `removeEmpty` runs before save.

### Element re-finding (Notes row → element)

- Panel posts `SELECT_BY_SELECTOR { selector, path }`.
- Content tries `document.querySelector(selector)` (first match); if none, walks `path`
  (ancestor chain + child index) from `body`. On success → `selectElement(el)` (existing highlight
  + `ELEMENT_SELECTED` flow). On failure → post `SELECT_NOT_FOUND`; panel shows a quiet "element not
  found on this page" on the row.

## UI

### Home screen (`App` when no selection)

- **Full hero:** existing `InspectEmptyState` — shown when `records.length === 0`.
- **Minimized hero:** a compact strip (48→28px mark, one-line headline, "Pick element manually")
  shown when `records.length > 0`. New `minimized` prop on `InspectEmptyState`.
- **Notes list** below (`sidebar/notes/NotesList.jsx`): a header row (count + Copy all + Export)
  and one `NotesRow` per record. Row: selector (mono), note snippet (sans, muted), edit-count chip,
  copy button. Scrolls with the panel body. No tab bar.

### Awwditing screen (element selected)

- Header gains a **speech-bubble button** beside the edit pencil: filled when a note exists, outline
  otherwise. Opens `CommentComposer` (a small textarea + Save/Clear) for the selected element,
  anchored under the header. Unchanged inspector below.

### Export format (`sidebar/notes/exportNotes.js`, pure)

```
button.cta — "tighten padding"
  padding:        12px → 8px
  border-radius:  4px  → 8px

.hero h1 — "too tight"
  line-height:    1.1  → 1.3
```

- Elements with only a comment show the comment line and no CSS block; only edits show the block.
- Per-row copy = one element's block; Copy all = all blocks joined; Export = same text as a
  `.txt` download via the existing detached-anchor download path.

## Message protocol (additions)

Content → panel: `CHANGE_APPLIED`, `CHANGES_CLEARED`, `SELECT_NOT_FOUND`; `PAGE_DATA` gains `url`.
Panel → content: `SELECT_BY_SELECTOR`. All added to `utils/constants.js#MESSAGES`.

## Components / files

- New: `sidebar/notes/notesStore.js`, `sidebar/notes/exportNotes.js`, `sidebar/notes/NotesList.jsx`,
  `sidebar/notes/NotesRow.jsx`, `sidebar/notes/CommentComposer.jsx`.
- Changed: `App.jsx` (remove tabs; notes state + storage; home layout; header comment button;
  select-by-selector), `content/content-script.js` (report changes, URL, select-by-selector, path
  builder), `utils/constants.js` (messages), `components/redesign/TabBar.jsx` (removed from render;
  file may stay), `components/redesign/InspectEmptyState.jsx` (`minimized` variant),
  `components/redesign/icons.jsx` (message/message-filled bubble icons).

## Error handling / edge cases

- Non-unique selector: `path` fallback; if still ambiguous, first match wins (documented limit).
- `chrome.storage` unavailable/quota: wrap in try/catch; degrade to in-memory (no persistence),
  never throw into the UI.
- Element removed from DOM on revisit: `SELECT_NOT_FOUND` → row shows a quiet unavailable state; the
  note/edits are retained (not deleted).
- Reverted edit (after == original before): removed from `edits`; if that empties a comment-less
  record, `removeEmpty` drops it.
- URL with hash routing (SPAs): pathname-only key groups a route's notes; acceptable for MVP.

## Testing

- No JS test runner in the repo (verification gap, per project memory). The pure modules
  (`exportNotes`, `notesStore` helpers) are written to be unit-testable if a runner is added.
- Manual test matrix (load `dist/` unpacked): comment create/edit/clear; edit tracking with
  repeated edits + revert; reset clears edits keeps comment; persistence across reload; Notes row
  re-select + highlight; not-found handling; Copy one / Copy all / Export `.txt`; hero full ↔
  minimized at the first edit; dark + light.

## Deferred

On-page pins, Health in nav, threads, global/cross-page view, richer history. The record shape
(`selector` + `path` + `edits`) already supports attaching pin coordinates later.
