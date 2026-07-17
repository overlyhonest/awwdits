# Toolbar-first widget model — design

**Date:** 2026-07-17
**Branch:** `feat/toolbar-widget-model`
**Status:** Design approved (direction + form decisions locked); ready for implementation plan.
**Prototype:** interactive artifact (horizontal-pill direction) — the reference for interaction + visuals.

## Summary

Today awwdits is a single **332px panel** that is always on screen and does two jobs at once:
the persistent controls (inspect / comment / edit modes, theme, the notes list) **and** the
properties of whatever element is selected. This proposal splits those jobs:

- A small **floating toolbar** is the resting state — always present, low footprint. It carries the
  primary modes (Inspect, Comment, Measure) and a **Changes** control.
- The **properties panel** (today's inspector) appears docked on the right **only when an element is
  selected**, exactly as it renders now.
- **Tracked changes** (style edits + comments) get their own home: a **Changes** counter on the
  toolbar that opens a popover listing every edit and comment, with **Export** and **Clear all**.

Nothing about *what* awwdits does changes. This is a redistribution of the existing surfaces so the
resting state is light and detail is summoned on demand — the mental model designers already have from
Figma / Framer.

## Locked decisions

| Decision | Choice |
|---|---|
| **Toolbar orientation** | Horizontal pill, floats near the bottom. (Vertical rail rejected for now — bigger footprint, less familiar.) |
| **Toolbar placement** | Free-drag via a dedicated handle; **remembers its last position** across pages/reloads. |
| **Edit button** | Lives in the **properties-panel header** (contextual to the selection), not on the toolbar. |
| **The mark** | The gradient disc is a **menu button** (theme toggle, close, help) — it does *not* double as the drag handle. |
| **Drag handle** | A **separate handle that visibly reads as draggable** (dotted grip), distinct from the mark. |
| **Changes** | A counter chip on the toolbar → popover with the change/comment list, **Export** and **Clear all**. |

## The three surfaces

### 1. Toolbar (new) — vanilla DOM, page context

The always-on hub. A horizontal pill, ~48px tall, dark surface matching the panel chrome.

Left-to-right:

1. **Drag handle** — dotted grip, `grab`/`grabbing` cursor. Dragging moves the whole toolbar; the
   position is persisted (see Persistence). This is the *only* drag affordance.
2. **Mark** — the 28–32px gradient disc with the crosshair glyph. Click opens the **mark menu**
   (Theme, Help/shortcuts, Close awwdits). Signature element; anchors identity.
3. **Inspect** — ⌘/Ctrl-click any element inspects it directly. Clicking the Inspect **button** arms a one-shot plain pick, so the next plain click inspects (and it stays sticky after the first pick). Plain clicks otherwise pass through to the page.
4. **Comment** — **⌘/Ctrl+Shift+click** any element comments it directly (parallels Inspect's ⌘-click; no prior selection needed). Clicking the Comment **button** arms a comment pick, so the next plain click comments. A ⌘-click *without* Shift stays Inspect even while the Comment tool is armed (only plain clicks / ⌘+Shift are claimed for comment). *(Earlier ⌘+C+click was dropped — it collided with the browser Copy shortcut.)*
5. **Measure** — measurement mode. Keyboard `M`.
6. Divider.
7. **Changes** — chip showing the count; click toggles the Changes popover. Neutral at rest; the
   count badge picks up the gradient only when > 0 (count is *data*, so accent is allowed here — the
   tool buttons themselves stay strictly monochrome per the design system).
8. **Close** — dismisses the widget; a small reopen affordance remains (or re-open via the existing
   Alt+Shift+A shortcut).

**Active-tool state stays monochrome:** the armed tool gets a raised-surface pill + foreground glyph
(+ the existing small dot), never an accent color — consistent with the "active tab = neutral pill"
rule in the design system.

### 2. Properties panel (existing) — React iframe, summoned

The current inspector (`App.jsx` → `InspectZone`), unchanged in content. Changes:

- **Shown only when an element is selected.** When nothing is selected the panel is hidden and the
  toolbar is the entire UI. On select it slides in docked to the right (its current position).
- **Header keeps** back, comment, **edit (pencil/check)**, close — Edit lives here.
- The **home / empty state** (`InspectEmptyState`) and the in-panel **notes list** (`NotesList`) are
  **removed from the panel** — the toolbar replaces the empty state, and the Changes popover replaces
  the notes list.

### 3. Changes popover (new) — vanilla DOM, anchored to the Changes chip

Opens above the Changes chip. Lists, newest first:

- **Edits** — `selector` · `property: before → after` (mono).
- **Comments** — `selector` · the comment text, with the comment glyph.

Header actions:

- **Export .txt** — the existing `exportNotes` output (comments + CSS changes).
- **Clear all** — clears every tracked edit and comment for the page (with a confirm step, since it is
  destructive and not per-item). Per-element clears still happen via the panel / reset.

Clicking a row selects that element (reuses `SELECT_BY_SELECTOR`, scroll-into-view + pin pulse).

## Architecture — where state and rendering live

**Recommended approach (least churn to the just-merged notes/persistence work):**

- **Toolbar + Changes popover = vanilla DOM in the content script.** This is where mode activation
  already lives (`activateInspector`, `activateMeasure`, `deactivateAll`, the comment overlay, drag
  logic for the old grip). The toolbar buttons call those directly — no new round-trip for modes. It
  also matches the existing pattern (grip, comment overlay, measurement overlay are all vanilla DOM).
- **Notes/changes state stays in the panel React app (`App.jsx`).** `recordOps`, `notesStorage`,
  hydration guards, and the persist effect are untouched. The panel already runs an effect on every
  notes change to post `RENDER_COMMENTS`; extend that to also post a **`CHANGES_SUMMARY`**
  `{ count, items }`. The vanilla toolbar renders the count badge and the popover list from that.
- **The panel iframe stays mounted** (so notes state + persistence keep running) but is **only visible
  when an element is selected**. Hidden ≠ unmounted.
- **Toolbar → panel actions** are messages: `CLEAR_ALL_CHANGES`, `EXPORT_NOTES` (panel owns storage +
  `exportNotes`). Mode buttons need no messages — they call content-script functions directly.

**Alternatives considered:**

- *Move notes ownership into the content script* (vanilla) — lets the toolbar own everything, but
  re-implements the hydration/persist/guard logic that was just hardened, risking regressions.
  Rejected for now.
- *Everything as iframes (toolbar iframe + panel iframe)* — better style isolation, but a full-viewport
  transparent iframe can't do click-through-with-interactive-regions (iframe pointer-events is
  all-or-nothing from the parent), so it means multiple small iframes and cross-frame state plumbing.
  Heavier than the vanilla toolbar. Rejected for now.

## Interaction flows

- **Inspect (default):** toolbar visible, Inspect armed. ⌘/Ctrl-click an element → panel slides in with
  its properties. Plain clicks pass through to the page. Back / close hides the panel; the toolbar stays.
- **Comment:** **⌘/Ctrl+Shift+click** an element (or arm the Comment tool, then plain-click) → the
  element is selected and the composer opens on it (no prior selection needed). Save → gradient pin
  drops, and the comment appears in Changes. Pins persist for the page load (unchanged).
- **awwdits' own UI is excluded** from inspect/comment/measure: `#awwdits-toolbar`,
  `#awwdits-changes-pop`, and `#awwdits-mark-menu` are ignored by `element-selector`,
  `measurement-overlay`, and the comment click handler, so the toolbar can't be inspected and its
  buttons stay clickable.
- **Edit:** in the panel header, toggle Edit → property rows become editable → change a value → the
  page element updates and the edit is recorded → the toolbar **Changes** count increments and its
  badge goes hot.
- **Changes:** click the chip → popover of all edits + comments. Row click selects the element.
  **Export** downloads the `.txt`; **Clear all** (confirm) wipes tracked changes for the page.
- **Move:** drag the handle → toolbar follows → position persisted.
- **Menu:** click the mark → Theme / Help / Close.

## Visual spec

Reuse the existing monochrome + Special Gothic system (`tokens.css` is the source of truth). Toolbar:

- Surface `--surface` (#2D2D30 dark), border `--border-strong` (#3E3E40), radius 12–14, soft shadow.
- Tool buttons ~38×38 hit, 20px Tabler **filled** glyphs, resting `--foreground-weak`, hover →
  `--foreground` on `--surface-hover`, active → `--surface-raised` pill + `--foreground`.
- Mark = gradient disc `linear-gradient(135deg,#F7CFEC,#FF3E97 42%,#FF6E77 68%,#FF9A5A)` + white crosshair.
- Changes badge uses the gradient only when count > 0.
- Drag handle: 6-dot grip in `--foreground-weak`.
- Motion: origin-aware popover (scale from the chip), 150–200ms, `cubic-bezier(.23,1,.32,1)`; respect
  `prefers-reduced-motion`.

## Persistence

- **Toolbar position:** store `{x, y}` in `localStorage` (or `chrome.storage.local`); restore on inject,
  clamp into the viewport. (Old grip drag logic clamps already — reuse.)
- **Changes/notes:** unchanged — per-URL `chrome.storage.local` via `notesStorage`.
- **Clear all** writes an empty notes set for the URL through the existing persist path.

## What's removed / changed

- `InspectEmptyState` (home hero) — no longer rendered; the toolbar is the resting UI. Keep the file
  for now (it has a Storybook story); remove from the panel's render path.
- `NotesList` in the panel body — replaced by the Changes popover. The component may be reused as the
  popover's list rendering if the popover is later moved into an iframe; for the vanilla popover it is
  reimplemented minimally. Decide during planning.
- The old blue drag **grip** (`content-script.js`, legacy #3b82f6) — folded into the toolbar's drag
  handle and neutralized.
- The always-docked iframe positioning — replaced by summon-on-select show/hide.

## Out of scope (future)

- Vertical-rail orientation (revisit if the pill feels cramped).
- Labeled (vs icon-only) toolbar variant.
- Audit/scan tool on the bar (page scan currently runs automatically on `SIDEBAR_READY`).
- Multi-select / grouped changes.

## Open questions for planning

1. Does the **Measure** result still need the panel, or does it annotate on-page only? (Today it posts
   `MEASUREMENT_COMPLETE` to the panel.)
2. Reopen-after-close affordance: a floating dot (prototype) vs. rely solely on Alt+Shift+A?
3. Exact **`CHANGES_SUMMARY`** payload shape and whether the popover renders in vanilla DOM or a small iframe.

## Revision — 2026-07-17 (toolbar visual, from Figma node 2114:2257)

The toolbar was reworked to a supplied Figma layout, **dark-only for now** (a light palette
slots into the `COLORS` object in `toolbar.js` later — user deferred light mode).

- **Gradient mark + mark menu removed** → the toolbar is fully monochrome. **Close** is now a
  standalone button on the bar. Theme toggle + help are dropped (theme stays dark).
- **Layout:** `grip-vertical │ inspect · comment · measure │ versions "Changes" count │ x`,
  hairline dividers between groups.
- **Icons:** Tabler *filled* — current-location (inspect), message (comment), arrow-autofit-content
  (measure), versions (Changes), x (close); grip-vertical outline (no filled variant).
- **Colors** from `tokens.css [data-theme="dark"]`: `--surface` pill, `--border-strong`, resting
  icons `--foreground-weak`, active-tool `--foreground` on a `--surface-raised` pill, neutral count badge.
