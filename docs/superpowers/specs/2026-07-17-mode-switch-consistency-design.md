# Mode-switch consistency — design

**Date:** 2026-07-17
**Status:** Design approved; ready for implementation plan.

## Summary

Switching between the three tools (Inspect, Comment, Measure) leaves stale state behind: the
previous tool's pill stays lit, its selection survives, and the properties panel can remain open
with nothing selected. Three reported symptoms, one root cause.

**There is no single rule for what a mode change does to selection and panel.** Each `enter*`
primitive in `content-script.js` hand-assembles its own cleanup, and they disagree — `enterComment`
and `enterMeasure` remember to call `hidePanel()`, `enterInspect` does not; `enterComment` clears the
selection, `enterInspect` skips its reset when the inspector is already running. Every new tool
interaction has to re-derive the cleanup from scratch, and each one gets it slightly wrong.

The fix is to state the rules once and enforce them centrally, not to patch three symptoms.

## Reported symptoms

1. **Switching modes leaves the old mode selected.** The previous tool's button stays lit and its
   on-page selection persists.
2. **Clearing the selection leaves the panel open.** With Inspect active and an element selected,
   turning Inspect off drops the selection but the properties panel remains, showing stale contents.
3. **A shortcut-driven inspect doesn't stick.** In Comment (or Measure) mode, ⌘/Ctrl+click inspects
   the clicked element and the panel fills in — but the mode stays on Comment. Reported for all modes.

## Root causes

### Symptom 2 — `clearSelection()` is a silent clear

`element-selector.js:73-78`:

```js
export function clearSelection() {
  selectedElement = null;
  hide(selectedBox); hide(selectedBadge);
  hide(hoverBox);    hide(hoverBadge);
  destroyCanvas();
}
```

It never calls `onClearCallback`. That callback (`content-script.js:338`) is the *only* thing that
hides the panel, and its only caller is the Escape handler (`element-selector.js:220`). So every
other path that clears a selection leaves the panel open with stale contents. `enterComment` and
`enterMeasure` avoid the bug only because they each call `hidePanel()` by hand; `enterInspect`
doesn't, so it is broken.

### Symptom 3 — commit-on-use exists for Measure only

`content-script.js:590-591` documents the assumption:

> whereas ⌘-click inspect and ⌘⇧-click comment are single actions whose result already outlives the
> key release.

This is false. The *result* outlives the key release (the panel fills with inspect details); the
**mode** does not. On keyup `heldTool` reverts to `'none'`, `resolveEffective` falls back to the
sticky tool (Comment), and `enterComment()` runs — re-lighting the Comment pill and calling
`clearSelection()`, wiping the selection just made. Measure was given an exemption at
`content-script.js:594-600`; Inspect and Comment never were.

### Symptom 1 — `enterInspect` skips its reset

`content-script.js:129`:

```js
function enterInspect() { ...; if (activeMode !== 'inspector') activateInspector(); setTool('inspect'); }
```

Comment and Inspect share `activeMode === 'inspector'`, so entering Inspect *from Comment* skips
`activateInspector()` → `deactivateAll()` → `clearSelection()`, and the old selection carries over.
Measure→Inspect clears correctly because `activeMode` was `'measure'`.

## The three invariants

### A. The panel is visible if and only if something is selected

Enforced by making `clearSelection()` fire `onClearCallback` — one notification path, so the panel
cannot drift out of sync with the selection. The manual `hidePanel()` calls in `enterComment` and
`enterMeasure` are then redundant and are deleted.

This restores what the toolbar-widget-model spec already promised: the panel is "shown only when an
element is selected."

**Accepted consequence (confirmed with user):** Escape, and any mode switch that clears the
selection, now also closes the properties panel. This is a deliberate behavior change.

Care is needed to keep `clearSelection()` re-entrant: `onClearCallback` must not call back into
`clearSelection()`, and the callback fires only when a selection actually existed, so idle clears
don't post spurious `CLEAR_SELECTION` messages to the panel.

### B. Changing tool releases the previous tool's state

`enterInspect` performs the same reset the other primitives do, so Comment→Inspect no longer carries
a selection across. The realization primitives should converge on one shared reset rather than each
composing their own.

### C. Commit-on-use — using a held tool promotes it to sticky

Generalized from Measure to all three tools. When a held tool actually *does* something — a click
that inspects, comments, or measures — that tool becomes the sticky tool, so releasing the key leaves
you in the tool you just used, with the previous tool's pill and selection released.

The Measure special case at `content-script.js:594-600` is **deleted**, not extended: one rule for
all three tools rather than three exemptions.

Commit points:

- **Inspect** — the `onSelect` callback (`content-script.js:325-335`). It already sets
  `setTool('inspect')` but leaves `stickyTool` untouched; it must set `stickyTool` too.
- **Comment** — when a comment pick is committed.
- **Measure** — the existing click commit, relocated into the shared path.

## Scope

Two files:

- `src/content/element-selector.js` — invariant A.
- `src/content/content-script.js` — invariants B and C.

`src/content/toolMode.js` does **not** change. Its `heldTool` / `stickyTool` / `resolveEffective`
model is correct; C only means the commit path writes `stickyTool` for every tool instead of one.
Its existing tests (`toolMode.test.js`) must stay green.

## Testing

- **Unit** — `toolMode.test.js` continues to cover resolution. Commit-on-use is expressible there if
  the commit rule is extracted as a pure function.
- **Manual matrix** — every ordered pair of tools (6 transitions), by both click and hold, asserting:
  exactly one pill lit, no stale selection, panel visible ⟺ selection exists. Plus Escape from each
  tool, and ⌘-click from within Comment and Measure.

## Open question for planning

Symptom 2's exact repro is unconfirmed. Reading `enterIdle` (`content-script.js:135`), turning Inspect
off should leave the selection highlight *up* — the code deliberately leaves a live selection alone.
The user observed the selection vanishing while the panel stayed. The silent-`clearSelection()` bug
explains "panel stays" on several paths, but the specific line that drops the highlight on the
toggle-off path has not been identified. **Reproduce this first during implementation** and confirm
invariant A actually covers it; if it doesn't, there is a second defect on the idle path.
