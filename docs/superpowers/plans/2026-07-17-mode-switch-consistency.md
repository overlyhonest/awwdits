# Mode-switch consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switching tools no longer strands the previous tool's pill, selection, or panel.

**Architecture:** Two changes. (1) `clearSelection()` becomes the single notification point for
"nothing is selected any more", so the panel can't outlive its selection. (2) Commit-on-use is
generalized from Measure to all three tools via a pure `commitOnUse` rule, so a held-key gesture that
does something leaves you in that tool instead of snapping back.

**Tech Stack:** Vanilla JS content script (Chrome MV3), Vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-07-17-mode-switch-consistency-design.md`

## Global Constraints

- Content-script overlays use explicit hex from `overlayTokens.js` — never CSS vars, never Tailwind.
- `toolMode.js` stays pure: no DOM, no imports from `content-script.js`.
- awwdits' own UI is excluded from every page gesture. The canonical exclusion list is
  `#awwdits-sidebar-container`, `#awwdits-toolbar`, `#awwdits-changes-pop`, `#awwdits-comments`,
  `#awwdits-mark-menu`.
- Existing tests in `src/content/toolMode.test.js` must stay green.
- Run tests with `npm test`.

## Deviation from the spec: invariant B is dropped

The spec's invariant B said `enterInspect` should "get the same reset the others have." **Planning
showed this is wrong, and it must not be implemented.**

- **It fixes nothing.** B was meant to stop Comment→Inspect carrying a selection across. But
  `enterComment` (`content-script.js:130`) already calls `clearSelection()`, so comment mode never
  *has* a selection to carry. The symptom B was aimed at is really symptom 3, fixed by invariant C.
- **It would cause a regression.** Inspect is the tool whose *product* is a selection. `enterIdle`
  deliberately leaves a live selection alone (`content-script.js:132-135`), so with a selection on
  screen and the tool idle, holding ⌘ would run `enterInspect` → reset → and wipe the selection and
  panel out from under the user.

The correct general rule — a tool change releases the **previous** tool's artifacts, not the incoming
tool's — is what the code already does: `enterComment` and `enterMeasure` clear inspect's selection;
`enterInspect` correctly does not clear its own. Only A and C are implemented below.

---

### Task 1: Make `clearSelection()` the single "selection is gone" notification

Today `clearSelection()` silently drops the selection, and the only thing that hides the panel is
`onClearCallback`, whose only caller is the Escape handler. So every other clear path leaves the panel
open with stale contents. Making `clearSelection()` itself fire the callback gives one notification
path, and the manual `hidePanel()` calls become redundant.

`had` guards the fire so idle/no-op clears don't post spurious `CLEAR_SELECTION` messages to the
panel. `onClearCallback` must never call back into `clearSelection()` — it doesn't today
(`content-script.js:338`), and must not start.

**Files:**
- Modify: `src/content/element-selector.js:73-78` (fire the callback), `:217-222` (drop the now-double call)
- Modify: `src/content/content-script.js:130-131` (drop redundant `hidePanel()`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `clearSelection()` invokes `onClearCallback()` exactly once, and only when a selection
  existed. Signature unchanged: `clearSelection(): void`.

- [ ] **Step 1: Make `clearSelection` notify**

In `src/content/element-selector.js`, replace the body at `:73-78`:

```js
// Clearing the selection is the single signal that nothing is selected any more — it
// fires onClearCallback so the panel can't outlive its selection (the panel is visible
// iff something is selected). Guarded on `had` so no-op clears (mode switches with
// nothing selected) don't post spurious CLEAR_SELECTION messages. onClearCallback must
// not call back into clearSelection.
export function clearSelection() {
  const had = selectedElement !== null;
  selectedElement = null;
  hide(selectedBox); hide(selectedBadge);
  hide(hoverBox);    hide(hoverBadge);
  destroyCanvas();
  if (had && onClearCallback) onClearCallback();
}
```

- [ ] **Step 2: Drop the now-doubled call on the Escape path**

`clearSelection()` fires the callback itself now, so `onKey` at `:217-222` would fire it twice.
Replace with:

```js
function onKey(e) {
  if (e.key === 'Escape') clearSelection();
}
```

- [ ] **Step 3: Drop the redundant `hidePanel()` calls**

In `src/content/content-script.js`, `enterComment` (`:130`) and `enterMeasure` (`:131`) each call
`hidePanel()` by hand. Both now clear the selection (directly, and via `activateMeasure()` →
`deactivateAll()`), which hides the panel through the callback. If there was no selection the panel
was already hidden. Replace both lines:

```js
function enterComment() { if (activeMode !== 'inspector') activateInspector(); clearSelection(); pendingCommentPick = true; setArmed(true); setTool('comment'); }
function enterMeasure() { pendingCommentPick = false; setArmed(false); activateMeasure(); setTool('measure'); }
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `npm test`
Expected: PASS — all of `toolMode.test.js`. (These files have no unit tests of their own; they are
DOM-bound. Behavior is verified by the manual matrix in Task 4.)

- [ ] **Step 5: Commit**

```bash
git add src/content/element-selector.js src/content/content-script.js
git commit -m "fix: hide the panel whenever the selection clears

clearSelection() dropped the selection silently — onClearCallback, the
only thing that hides the panel, was fired only by the Escape handler.
Every other clear path left the panel open with stale contents. Fire the
callback from clearSelection() itself so the panel is visible iff
something is selected, and drop the hand-rolled hidePanel() calls."
```

---

### Task 2: Add the pure `commitOnUse` rule

Measure has a commit-on-use exemption (`content-script.js:594-600`) justified by a comment claiming
⌘-click inspect and ⌘⇧-click comment "are single actions whose result already outlives the key
release." The *result* does; the **mode** does not. On keyup `heldTool` reverts to `'none'`,
`resolveEffective` falls back to the sticky tool, and that tool's `enter*` runs — re-lighting its pill
and clearing the selection just made.

The rule belongs in `toolMode.js` next to the other resolution logic, where it is testable without a
DOM.

**Files:**
- Modify: `src/content/toolMode.js`
- Test: `src/content/toolMode.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `commitOnUse(heldTool: string, stickyTool: string) => string` — the new sticky tool after
  a held tool is used. Returns `heldTool` when one is held, else `stickyTool` unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `src/content/toolMode.test.js`:

```js
describe('commitOnUse', () => {
  it('promotes the held tool to sticky', () => {
    expect(commitOnUse('inspect', 'comment')).toBe('inspect');
    expect(commitOnUse('comment', 'inspect')).toBe('comment');
    expect(commitOnUse('measure', 'none')).toBe('measure');
  });

  it('leaves the sticky tool alone when nothing is held', () => {
    expect(commitOnUse('none', 'comment')).toBe('comment');
    expect(commitOnUse('none', 'none')).toBe('none');
  });

  it('is a no-op when the held and sticky tools already agree', () => {
    expect(commitOnUse('measure', 'measure')).toBe('measure');
  });

  // The bug this fixes: ⌘-click while comment is sticky used to inspect the element, then
  // snap back to comment on keyup — re-lighting the comment pill and clearing the selection.
  it('inspect survives the ⌘ release once a click has committed it', () => {
    let held = 'inspect', sticky = 'comment';
    expect(resolveEffective(held, sticky)).toEqual({ tool: 'inspect', sticky: false });
    sticky = commitOnUse(held, sticky);   // the click commits
    held = 'none';                        // ⌘ released
    expect(resolveEffective(held, sticky)).toEqual({ tool: 'inspect', sticky: true });
  });
});
```

Update the import on line 2 to:

```js
import { computeHeldTool, resolveEffective, commitOnUse } from './toolMode.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `commitOnUse is not a function`.

- [ ] **Step 3: Implement `commitOnUse`**

Append to `src/content/toolMode.js`:

```js
// Commit-on-use: a held tool that actually does something (a click that inspects, comments,
// or measures) becomes the sticky tool. Without this, releasing the key reverts to the
// previous sticky tool, which re-lights its pill and clears the selection just made. Applies
// to all three tools — measure used to be the sole exception.
export function commitOnUse(heldTool, stickyTool) {
  return heldTool === 'none' ? stickyTool : heldTool;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — including the pre-existing "measure survives the X release once a click has
committed it" test, which describes the same rule this generalizes.

- [ ] **Step 5: Commit**

```bash
git add src/content/toolMode.js src/content/toolMode.test.js
git commit -m "feat: add the pure commitOnUse rule

Using a held tool promotes it to sticky. Measure had this behavior as a
special case; this is the general rule, tested without a DOM."
```

---

### Task 3: Wire commit-on-use for all three tools

Replace Measure's bespoke listener with one generic listener.

**Listener order matters and is the crux of this task.** The comment handler (`:574-586`) claims its
clicks with `stopImmediatePropagation()`. A capture listener registered *after* it would never run for
⌘⇧-clicks. So the commit listener must be registered **above** the comment listener in the file.
Both are module-load listeners, so they run before the element-selector's `onClick` (bound later, by
`initElementSelector`) — meaning the commit lands before the selection does.

Why this is safe for each tool, given the change-guard at `:140-149`:

- **⌘-click (inspect):** `resolveEffective('inspect','inspect')` → `sticky: true` while
  `realizedSticky` was `false`, so `stickyChanged` fires `enterInspect()`. Nothing is selected yet, so
  nothing is lost; the element-selector then selects.
- **⌘⇧-click (comment):** `realizedTool` is already `'comment'` and `stickyChanged` is inspect-only →
  the guard returns early. `enterComment` already ran on keydown.
- **X-click (measure):** same early return — which is exactly why `:143-146` treats sticky-ness as
  inert for non-inspect tools. An in-progress measurement is not torn down.

**Files:**
- Modify: `src/content/content-script.js` — import (`:1-10` block), add listener above `:574`, delete `:588-600`

**Interfaces:**
- Consumes: `commitOnUse(heldTool, stickyTool)` from Task 2.
- Produces: no new exports.

- [ ] **Step 1: Import `commitOnUse`**

In `src/content/content-script.js`, find the existing `toolMode.js` import and add `commitOnUse`:

```js
import { computeHeldTool, resolveEffective, commitOnUse } from './toolMode.js';
```

- [ ] **Step 2: Add the generic commit listener above the comment listener**

Insert immediately **before** the `// Comment gestures:` comment block at `:569`:

```js
// Commit-on-use: a held tool that does something becomes the sticky tool, so releasing the
// key leaves you in the tool you just used instead of snapping back to the previous one —
// which would re-light its pill and clear the selection you just made. Registered above the
// comment listener, which claims its own clicks via stopImmediatePropagation; both are
// module-load listeners, so they run before the element-selector's (later-bound) onClick.
document.addEventListener('click', (e) => {
  if (!isOpen || heldTool === 'none') return;
  const t = e.target;
  if (!t || (t.closest && (t.closest('#awwdits-sidebar-container') || t.closest('#awwdits-toolbar') || t.closest('#awwdits-changes-pop') || t.closest('#awwdits-comments') || t.closest('#awwdits-mark-menu')))) return;
  const next = commitOnUse(heldTool, stickyTool);
  if (next === stickyTool) return;
  stickyTool = next;
  applyEffectiveTool();
}, true);
```

- [ ] **Step 3: Delete Measure's special case**

Delete the whole block at `:588-600` — the `// Commit-on-use: clicking while X is held...` comment
and its `document.addEventListener('click', ...)`. The generic listener above now covers measure.
Deleting it also removes the false claim in its comment.

- [ ] **Step 4: Verify tests still pass and the extension builds**

Run: `npm test && npm run build`
Expected: PASS, then a clean build into `dist/`.

- [ ] **Step 5: Commit**

```bash
git add src/content/content-script.js
git commit -m "fix: commit a held tool to sticky for all three tools

⌘-click while comment was sticky inspected the element, then snapped back
to comment on keyup — re-lighting the comment pill and clearing the
selection just made. Measure had a commit-on-use exemption; make it the
general rule and delete the special case."
```

---

### Task 4: Verify against the real extension

No unit test covers the DOM-bound behavior, and symptom 2's repro is unconfirmed (see below). This
task is the actual verification and must not be skipped.

**Files:** none — this is a manual pass.

- [ ] **Step 1: Load the built extension**

Run `npm run build`, then load `dist/` unpacked at `chrome://extensions`, and open any content-rich
page. Alt+Shift+A toggles awwdits.

- [ ] **Step 2: Resolve the spec's open question first**

The spec flags this: reading `enterIdle` (`:135`), turning Inspect off should leave the selection
highlight **up** — it deliberately leaves a live selection alone — yet the user observed the selection
vanishing while the panel stayed. Task 1 explains the panel staying. It does **not** explain the
highlight going.

With Inspect on, select an element, then click the Inspect button to turn it off. Record what actually
happens to (a) the highlight and (b) the panel. If the highlight disappears, there is a second defect
on the idle path — stop and report it rather than assuming Task 1 covered it.

- [ ] **Step 3: Walk the transition matrix**

For all 6 ordered pairs of {inspect, comment, measure}, by both click and hold, assert:

1. Exactly one pill is lit.
2. No stale selection or highlight from the previous tool.
3. The panel is visible if and only if something is selected.

- [ ] **Step 4: Check the specific reported symptoms**

- With **Comment** sticky, ⌘-click an element → inspect details show; **release ⌘** → you stay in
  Inspect, the Inspect pill is lit, the Comment pill is not, and the selection survives.
- Same from **Measure** sticky.
- **Measure is not regressed:** hold X, click two elements → the gap renders; release X mid-measure →
  the measurement survives and Measure stays lit.
- **Escape** from each tool → selection cleared and panel hidden.

- [ ] **Step 5: Report findings**

Report the Step 2 result explicitly, plus any matrix cell that failed. Do not claim the fix works
without having run this pass.
