# On-Page Comments — Design Spec

**Status:** Approved design, ready for implementation planning.
**Date:** 2026-07-16
**Builds on:** the shipped Notes feature (`docs/superpowers/specs/2026-07-16-notes-feature-design.md`). This spec **reverses that plan's explicit "Deferred: on-page pins"** decision — deliberately, per user request.

## Goal

Move commenting from the sidebar panel onto the webpage, Figma-style: a comment bubble (pin) is anchored to the commented element on the page. With an element selected, the user opens a composer attached to it (via the plugin's comment button or the `c` key), types, and saves. Pins for all commented elements stay visible on the page while the panel is open; clicking a pin opens the comment in an on-page popover to read/edit/delete. Comments are no longer shown inside the inspect view.

The storage foundation does not change — this changes **where comments render**, not how they are stored.

## Confirmed decisions

- **Panel UI:** remove the in-inspect `CommentComposer`. Keep the home Notes list as the index + Copy-all/Export hub; a row re-selects its element and focuses its on-page pin.
- **Visibility:** all commented-element pins are always visible while the sidebar panel is open (no separate "comment mode").
- **Save/dismiss:** in the on-page composer, **Enter or click-away saves**, **Esc cancels**, **Shift+Enter = newline**. Saving an empty comment deletes it (and its pin).
- **Pin semantics:** pins represent **comments only**. An element with only tracked style edits gets **no pin** (its edits still appear in the Notes list + export).
- **One comment per element** (no threads/replies — remains deferred).
- **Pin anchor:** the element's **top-right corner**, just outside the box.
- **Overlay approach:** **Approach A now** (vanilla-DOM overlay in the content script), built behind a clean module boundary so a future **Approach B** (React/shadow-DOM) is a drop-in replacement of the overlay's internals. See Future Work.

## Scope changes to the shipped notes feature

- **Remove:** the in-inspect `CommentComposer` panel and the header comment button's current panel-toggle behavior. The header comment button stays but now triggers the **on-page** composer for the selected element.
- **Keep, unchanged:** the record model `{selector, path, label, comment, edits:[{property,before,after}], updatedAt}`, per-URL `chrome.storage.local` persistence, `recordOps`, `exportNotes`, tracked style edits, the DOM path helpers (`buildSelector`/`buildPath`/`findByPath`), and the message-shape conventions.
- **Keep, adjusted:** the home Notes list — a row now also focuses (scroll-into-view + brief highlight) the element's on-page pin after re-selecting it.

## Architecture & module boundary

- **New isolated module `src/content/comment-overlay.js`** with a rendering-agnostic interface:
  - `initCommentOverlay({ onSave })` — create the DOM layer + listeners; `onSave({selector, path, label, text})` reports create/edit/delete back to the caller.
  - `setComments(list)` — render/refresh pins for `[{selector, path, comment}]`.
  - `openComposerFor(element)` — open the composer anchored to a selected element.
  - `reposition()` — recompute all pin positions.
  - `destroy()` — tear down layer + listeners.
- Owns a single fixed-position container `#awwdits-comments` (container `pointer-events:none`; pins/composer/popover `pointer-events:auto`, so the page stays interactive).
- **Panel (React) is the single source of truth** for comment state + storage. The content script only renders pins and reports edits.
- **Pure positioning helper** split out for unit testing in `src/content/commentOverlayGeometry.js`: `positionPin(rect, viewport) → {left, top, visible}` (top-right anchor, viewport clamping, off-screen hide). No DOM access — takes plain rect/viewport objects so it is unit-testable in the Vitest `node` environment.

## Data flow & message contract

All new message type strings live in `src/utils/constants.js#MESSAGES`. Direction conventions match the existing code: content→panel via `postToSidebar(type, data)` (`{type, data}`, read as `e.data.data`); panel→content via `postToContent(type, data)` (`{type, ...data}`, read flat).

- **Panel → content** `RENDER_COMMENTS { comments: [{selector, path, comment}] }` — the current set of commented elements (comment non-empty). Sent on notes-load and whenever `notes` changes. Content script re-finds each element (`querySelector` → `findByPath` fallback) and renders/positions its pin.
- **Panel → content** `OPEN_COMMENT_COMPOSER { selector, path }` — fired by the panel's header comment button for the currently selected element; content calls `openComposerFor(the selected element)`.
- **Content → panel** `COMMENT_SAVED { selector, path, label, text }` — user created/edited/cleared a comment on the page. Panel folds it via the existing `setComment`/`removeEmpty` path, persists, then sends refreshed `RENDER_COMMENTS`. Empty `text` deletes the comment (dropping the record if it has no edits) and removes the pin.
- Reading a pin needs **no round-trip** — the content script already holds each comment's text from `RENDER_COMMENTS`.

## On-page interactions

- **Compose:** select an element (existing ⌘+click / manual pick), then press **`c`** or the plugin's header comment button → composer opens anchored to the element → type → **Enter / click-away saves**, **Esc cancels**, **Shift+Enter = newline**.
- **Read:** click a pin → popover shows the comment with **Edit** and **Delete**. Edit reuses the composer; Delete clears the comment (empty save).
- **`c` shortcut:** content-script `keydown`; active only when an element is selected and focus is not in an `input`/`textarea`/`contentEditable` (or the sidebar iframe). Prevents default so the page doesn't receive the `c`.
- **Pin click** uses `stopPropagation` so it never triggers element selection; ⌘+click selection elsewhere on the page is unaffected.

## Positioning & edge cases

- Pin anchored to the element's top-right corner from `getBoundingClientRect`, inside a fixed-position layer. Repositioned on **scroll + resize + a throttled `ResizeObserver(document.body)`** (rAF-batched). A tight rAF loop runs only while the composer/popover is open.
- **Element not found** (removed / dynamic / selector no longer matches and `path` fallback fails): **no pin**; the Notes list still shows it as "not found on this page."
- **Off-screen:** pin hidden when its element is fully outside the viewport; reappears on scroll. Partially-visible → clamped to stay reachable.
- **Composer/popover placement:** anchored near the pin, flipped/clamped to stay within the viewport.

## Testing

- **Unit (Vitest):** the pure `positionPin` geometry helper (anchor math, clamping, off-screen hide), plus the existing `recordOps`/`exportNotes` suites.
- **Build-verified + manual matrix (Chrome, dark + light)** for the DOM overlay wiring — consistent with how the panel/content-script work was verified for the notes feature. Manual matrix additions: pin appears on comment save and is anchored correctly; pin tracks the element on scroll/resize; click pin → read/edit/delete; `c` and the header button both open the composer; Enter/click-away save, Esc cancel; removed element → no pin but present in Notes list; Notes row click re-selects + focuses the pin.

## What stays unchanged

Record model, per-URL storage, `recordOps`, `exportNotes`, `buildSelector`/`buildPath`/`findByPath`, tracked style edits, the Notes list (adjusted only to focus pins), and the existing message conventions.

## Future / Deferred work

Captured here so nothing is lost:

1. **Approach B — React/shadow-DOM overlay.** Later, replace `comment-overlay.js`'s internal vanilla-DOM rendering with a React root mounted into the page (shadow DOM) so pins/composer/popover reuse the `COLOR`/`FONT` tokens and JSX. The module interface, message contract, `positionPin`, panel logic, and storage stay put — only the overlay's rendering internals change.
2. **Run the in-Chrome manual matrix** for both the notes feature and this on-page feature (dark + light). The notes feature was merged on build+review confidence; runtime UI behaviors remain unverified in a real browser.
3. **Health-report subsystem deletion (product decision, not cleanup).** The notes feature unmounted the Design-Health report from nav, orphaning `components/redesign/TabBar.jsx` (still referenced by `InspectEmptyState.stories.jsx`), `components/Report/ReportSection.jsx`, and `components/Overview/{HealthScore,ColorSection,TypographySection,SpacingSection,AuditRow}.jsx`. The original plan lists the Health tab as "Deferred (do NOT build)" = keep-for-later, so this was left in place. Decide explicitly whether to delete the cascade. (`gridHelpers`/`calculateHealthScore` stay regardless — used elsewhere.)
4. **Text-edit export formatting.** Text edits export literally as `text: <old> → <new>`; long/multiline `textContent` can garble the plain-text output. Needs a formatting decision (truncate / special-case).
5. **Comment threads / replies** — still deferred (this spec keeps one comment per element).
6. **Cross-page view** of notes — still deferred.
