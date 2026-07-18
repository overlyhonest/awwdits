# Resolvable export — resolve to source, not just to pixels (design)

**Status:** approved for planning · **Date:** 2026-07-17 · **Branch:** `resolvable-export`

## Revisions after live testing (2026-07-18)

Running Phase 1 against a real Vite + Tailwind + tokens app surfaced three changes:

1. **Comments are located, not resolved (reverses the Q4 decision).** awwdits' job on a
   commented element is to make it unambiguously *locatable* by the LLM (selector, layout,
   children, bbox, theme) — resolving the CSS is the LLM's job. The var-backed paint chains
   we added to comments (`background-color`/`color`/`border-color`) are **removed**. Comments
   emit location context only; no `declared:`/`chain:` blocks. **Edits still resolve** — an
   edit is a concrete value the LLM must apply at the source, which is the original problem.
2. **Var-based shorthand fallback for edits.** The CSSOM does not expand a `var()`-containing
   shorthand (`border-radius: var(--radius-md)`) into its longhands, so resolving an edit
   recorded as corner longhands (`border-top-left-radius`, …) found nothing. `matchedDeclaration`
   now falls back to the shorthand (`border-radius`, `margin`, `padding`, `border-width`,
   `inset`) when the longhand isn't var-backed. Without this the flagship radius case is empty.
3. **Page mode from the outermost carrier.** Theme carriers commonly sit on a wrapper `div`
   (`[data-mode=light]` on `div.chrome`), not `<html>`. Page-level detection now finds the
   outermost carrier in the document, so the header shows the mode and per-record `theme:`
   lines appear only when an element is under a *different* carrier (the nested-preview case).

## Summary

Today the export emits leaf values: `border-top-right-radius: 7.375px → 20px`. On a
tokenized codebase (React + Tailwind + CSS custom properties) that number appears
**nowhere in the source** — the repo holds the recipe (`rounded-md` → `var(--radius-md)`
→ `calc(var(--radius) - 2px)` → `--radius: 0.625rem` at a 15px root), and a coding agent
handed the pixel has to reverse the arithmetic by hand to find the edit site.

This feature makes the export **resolvable back to the declaration a developer would
actually edit**. Per changed property (and per var-backed paint property on a commented
element) we reconstruct the `var()` chain from the CSS the page already ships, emit each
hop with its source (sheet + line where reachable), attach the root font-size whenever a
`rem` is in the chain, and add page-state (URL, theme mode, viewport, timestamp) plus, for
commented elements, layout / children / bbox context.

**Everything is additive and degrades to today's output.** The class-based selector line
stays. A page with no tokens and no framework exports exactly as it does now, plus a
header line. Every failure to resolve drops one detail and keeps the rest, bottoming out
at today's plain computed value — the current format is the floor.

This spec covers **Phase 1** in full (build, then stop and show). **Phase 2** (blast-radius
UI + component identity) is documented as a proposal at the end, to be approved separately
before any of it is built.

## The mechanism (what is taken vs. reconstructed)

Three different things, three different sources:

- **Leaf values and layout facts are *taken*.** `getComputedStyle(el).borderTopLeftRadius`
  already returns `7.375px`; `display`, `flex-direction`, `gap`, child count, and the
  bounding box are read straight off the DOM. This is the same reading the current
  extractor does — we just also emit it for comment-only elements, which get nothing today.
- **The `var()` chain is *reconstructed*.** Once CSS resolves `var(--radius-md)` →
  `calc(var(--radius) - 2px)` → `0.625rem` → `7.375px`, the intermediate hops are gone from
  computed style, collapsed into the final pixel. The raw material still exists — it is the
  CSS rule *text* in `document.styleSheets` (`.rounded-md { border-radius: var(--radius-md) }`,
  `:root { --radius-md: calc(var(--radius) - 2px) }`, …) — but scattered across rules and
  never linked. The resolver does the linking: read the matched rule's declared text, look
  up where that var is defined, read *its* text, follow the next var, stop at a non-var
  leaf. This walk over data that already exists is the real work — exactly what the agent
  burned its time on. `calc(...)` is passed through as literal text, never evaluated: the
  point is to show the recipe the developer wrote, not redo the browser's arithmetic.
- **`sheet:line` is *partly taken, partly derived*.** CSSOM has no line numbers. For inline
  `<style>` tags the full text is present, so we count newlines to derive the line and take
  the filename from Vite's `data-vite-dev-id` attribute. Where text isn't readable
  (cross-origin, or a bundled linked asset) we take the filename only, or nothing.

## Scope

**In (Phase 1):**
- Pure transitive `var()` resolver: declared text → hops, with cycle detection, depth cap,
  `calc()` passthrough, and `var(--x, fallback)` fallback handling.
- CSSOM adapter that builds the per-element variable lookup by scanning `document.styleSheets`
  — owning cross-origin `try/catch`, specificity + `@layer` / source-order winner selection,
  and `sheet:line` via `<style>` text + `data-vite-dev-id`.
- Root font-size hop appended whenever any hop's value contains `rem`.
- Page-state header: URL, theme mode (with detection method), viewport, date.
- Per-record `theme:` line when an element's nearest theme carrier disagrees with the page.
- Layout / children / bbox context for **commented** elements.
- Var-backed chains for `background-color` / `color` / `border-color` on **commented** elements.
- 4-corner `border-radius` collapse in the formatter.
- Capture at edit/comment time; store `context` on the record; `exportNotes` stays a pure
  function of records.

**Out (Phase 2 — proposed below, not built in this spec):**
- Blast-radius counting + live highlight + in-panel `Apply to` scope chooser.
- Resolved `intent:` / `scope:` lines in the export.
- Component identity (React fiber name + breadcrumb + `_debugSource` line).

**Out (YAGNI, not planned):**
- Fetching same-origin linked sheets to compute their line numbers (points into bundled
  assets that map to no editable file; not worth the async complexity).
- Evaluating `calc()`.
- Non-CSS-custom-property theming systems (SASS vars compile away; nothing to resolve).

## Architecture

The hard constraint: **[vitest.config.js](../../../vitest.config.js) runs `environment: 'node'`
with no jsdom / happy-dom installed, and the spec forbids new deps without asking.** So the
resolver *algorithm* must be pure and DOM-free; all DOM access lives behind a thin,
injectable adapter. This is what makes the priority resolver tests cheap.

```
src/utils/resolve/
  varChain.js        PURE. resolveChain(declaredText, lookup, { rootFontSize, maxDepth })
                     → { hops:[{ name, value, source }], root, truncated, cyclic }.
                     Follows var() references through text. Knows nothing about the DOM;
                     tests pass a plain object/Map as `lookup`.
  cssSource.js       CSSOM adapter (injectable `sheets`, defaults to document.styleSheets).
                     buildLookup(el) → (varName) => { text, source } | null.
                     Owns cross-origin try/catch, specificity + @layer ordering,
                     and source resolution (sheet:line).
  pageState.js       PURE core + thin DOM reader: URL, viewport, timestamp, theme detection.
  elementContext.js  Orchestrator (content-script side): given an element + the changed
                     properties, assembles the `context` fragment (chains, layout,
                     children, bbox, theme) using the modules above.
```

### Data flow

Capture rides the existing message plumbing; nothing new crosses the iframe boundary except
a larger payload.

1. **Edit** — [content-script.js:474-488](../../../src/content/content-script.js) reads
   `before`, then (new) calls `elementContext.captureForEdit(el, kebabProp)` to build a
   `context` fragment `{ chains: { [kebabProp]: chainResult }, theme }`, and includes it on
   the existing `CHANGE_APPLIED` message.
2. **Comment** — [comment-overlay.js:196](../../../src/content/comment-overlay.js) `onSave`
   payload gains a `context` fragment `{ layout, children, bbox, theme, chains: { <paint
   props that are var-backed> } }` from `elementContext.captureForComment(element)`.
3. **Merge** — [App.jsx:60-70](../../../src/sidebar/App.jsx) already routes both to
   `recordOps`. `upsertEdit` / `setComment` gain a `mergeContext(record, fragment)` step:
   `chains` is a shallow-merged dict keyed by property; `layout` / `children` / `bbox` /
   `theme` are last-write-wins scalars. Context lives at `record.context`.
4. **Persist** — unchanged; `context` is plain JSON, rides `chrome.storage.local` with the
   record.
5. **Export** — [content-script.js:223](../../../src/content/content-script.js) still calls
   `formatAll(changeRecords)`. `exportNotes.js` reads `record.context` and renders. **It
   never touches the DOM** — the header's page-state is passed in by the caller (which has
   the DOM) as a second argument, so the formatter stays pure and testable.

### Why capture-time, why CSSOM text, why export-time page-state

- **Capture time, not export time.** Resolving when the edit/comment happens keeps
  `exportNotes` a pure function of records (cheap tests, matches the existing model where
  `before` is already an edit-time snapshot), and gives Phase 2's user-chosen `intent:` a
  natural home. Trade-off accepted: context reflects the moment of critique; if the page
  mutates before export, it is not re-resolved. Records that resolve to nothing at export
  time (element gone) still carry their capture-time context.
- **Chains read from rule text, not computed style.** For custom properties
  `getComputedStyle` returns the *substituted* value (`--radius-md` already reads as
  `calc(0.625rem - 2px)`, with `--radius` eaten). The hop chain only exists in declared
  text, so the walker reads rules. Computed style is the cross-check and the fallback leaf,
  not the source.
- **Page-state at export time.** The header's timestamp and viewport describe the export,
  and the content script always has them. Only the per-record `theme:` line is capture-time,
  because it is a fact about that element at the moment of critique.

## Module contracts

### `varChain.js` (pure)

```js
// A `lookup` maps a custom-property name to its winning declared text + source, already
// bound to a specific element by the caller. Pure: no DOM, no globals.
//   lookup(name) -> { text: string, source: SourceRef } | null
// SourceRef: { file: string|null, line: number|null }  (either may be null → degrade)

resolveChain(declaredText, lookup, { rootFontSize = null, maxDepth = 16 } = {})
// -> {
//   declared: string,              // the original declared text, e.g. "var(--radius-md)"
//   hops: [{ name, value, source }],   // e.g. { name:'--radius-md', value:'calc(var(--radius) - 2px)', source }
//   root: { value, source } | null,    // present iff any hop value contains 'rem'; value = rootFontSize
//   truncated: boolean,            // hit maxDepth
//   cyclic: boolean,               // a var referenced itself (directly or transitively)
// }
```

Rules:
- Follow `var(--x)` references found in `declaredText`, then in each resolved hop's text,
  depth-first in declaration order. Dedupe by var name (a name already emitted is not
  re-walked) — this also breaks cycles; set `cyclic: true` when a repeat is seen.
- `var(--x, fallback)`: if `lookup('--x')` is null, resolve to the trimmed `fallback` text
  and stop that branch; the hop's value is the fallback and its `name` records it came from
  a fallback (e.g. `--x (fallback)`).
- `calc(...)` and any other non-`var` text passes through verbatim as a hop value; if it
  contains nested `var()`, those are still followed.
- Stop at `maxDepth`; set `truncated: true` and emit the hops walked so far.
- A `declaredText` with no `var()` at all → `hops: []` (nothing to reconstruct; caller emits
  the plain computed leaf).

### `cssSource.js` (CSSOM adapter)

```js
buildLookup(el, { sheets = document.styleSheets } = {}) -> (name) => { text, source } | null
// Scans every rule in `sheets`. For a given custom-property `name`, returns the winning
// declaration among rules that (a) declare `name` and (b) match `el` (or are :root / html /
// universal, since custom props inherit). Winner = highest specificity, later @layer /
// source order breaking ties. Cross-origin sheets whose .cssRules getter throws are skipped.

matchedDeclaration(el, kebabProp, { sheets }) -> { declared, via, source } | null
// The winning *author* rule declaring `kebabProp` on `el` whose value contains 'var(' —
// { declared: 'var(--radius-md)', via: '.rounded-md', source }. null if none is var-backed.

sourceForRule(rule) -> { file, line }
// For a rule in an inline <style>: file = data-vite-dev-id (basename) or null; line =
// 1-based line of the rule within the style text (newline count) or null. For a linked
// sheet: file = href basename, line = null. On any failure: { file:null, line:null }.

rootFontSizeSource({ sheets }) -> { value, source }
// value = getComputedStyle(document.documentElement).fontSize; source = the winning rule
// declaring font-size on html / :root, via sourceForRule, or { file:null, line:null }.
```

### `pageState.js`

```js
// Pure formatter core + thin readers.
detectTheme(el, { sheets, prefersDark }) -> { mode, method } | null
//   mode: 'light' | 'dark'; method: 'carrier:.dark' | 'prefers-color-scheme' | ...
//   Returns null (omit — never guess) when there is no explicit carrier AND the page's own
//   stylesheets contain no prefers-color-scheme @media rule.
pageHeader({ url, viewport:{w,h}, date, theme }) -> string  // the '# awwdits · …' line

// Theme precedence: nearest explicit ancestor carrier (.dark/.light, [data-theme],
// [data-mode]) wins over a prefers-color-scheme media query. Page mode = theme detected at
// document root. Per-record theme = theme detected at the element; emitted only when it
// differs from the page mode.
```

### `exportNotes.js` (pure, extended)

```js
formatAll(records, pageState = null) -> string
formatRecord(record, index, pageMode = null) -> string
// pageState: { header:string, mode:'light'|'dark'|null } | null. Records ALWAYS render in
// the new layout (`## [n] selector`, 4-space-indented lines, no `Changes:` header). When
// pageState is null, the header line is simply omitted — the record bodies are unchanged.
// `index` is the 1-based position formatAll passes in; it produces the `[n]` in the heading.
```

**Format change is unconditional and intentional.** The layout moves from today's
`## selector` / `Changes:` / `  - prop: before → after` to `## [n] selector` with
4-space-indented lines and no `Changes:` header (the approved target output). This restyles
every export — including untokenized pages — but adds no information to the untokenized case.
The single caller, [content-script.js:223](../../../src/content/content-script.js), is
updated to pass `pageState`. The existing `exportNotes.test.js` cases are rewritten to the
new layout as part of this work.

## Output format (Phase 1)

```
# awwdits · http://localhost:5173/ · light mode (prefers-color-scheme) · 1440×900 · 2026-07-17

## [1] button.inline-flex.items-center.justify-center
    border-radius: 7.375px → 20px  (4 corners)
      declared:  var(--radius-md)                          via .rounded-md
      chain:     --radius-md = calc(var(--radius) - 2px)   theme.css:109
                 --radius    = 0.625rem                    theme.css:33
                 root        = 15px                        theme.css:337

## [2] div.bg-card.text-card-foreground.flex
    Comment: "bg can be more darker"
      layout:    display:flex; flex-direction:column; gap:24px
      children:  3 × div
      bbox:      384×212 @ (64,140)
      background-color: oklch(0.21 0 0)
        declared:  var(--card)                             via .bg-card
        chain:     --card = oklch(0.21 0 0)                theme.css:71

## [3] div
    Comment: "try out verical column arrangement for the colors,"
      layout:    display:flex; flex-direction:row; gap:8px
      children:  11 × div.h-8.w-8.rounded-full
      bbox:      320×32 @ (612,480)
```

Formatting rules:
- **Header** — `# awwdits · <url> · <mode> mode (<method>) · <w>×<h> · <YYYY-MM-DD>`. The
  `(<method>)` segment names how the mode was detected. The whole ` <mode> mode (<method>)`
  segment is **omitted** (not guessed) when `detectTheme` returns null.
- **Record heading** — `## [<n>] <selector>` where `<n>` is 1-based in the exported (sorted)
  order. A bare-`div` record with no classes renders `## [<n>] div`.
- **Per-record theme line** — `    theme:  <mode>  (via <carrier> on <selector>)`, emitted
  under the heading only when the element's mode differs from the page mode.
- **Edit line** — `    <prop>: <before> → <after>`. Four corner longhands
  (`border-top-left-radius`, `-top-right-`, `-bottom-right-`, `-bottom-left-`) collapse to a
  single `    border-radius: <before> → <after>  (4 corners)` line **iff** all four are
  present with the same `before` and the same `after`; otherwise each prints on its own line.
- **Chain block** (under an edit, or under a paint property on a comment) — only when the
  declaration is var-backed:
  ```
        declared:  <declaredText>            via <selector>
        chain:     <name> = <value>          <file:line | file | (blank)>
                   <name> = <value>          …
                   root        = <px>        <file:line | file | (blank)>   (iff a rem hop)
  ```
  When `truncated`, append a final `                 … (chain depth capped)` line. When
  `cyclic`, append `                 … (cycle)`.
- **Layout / children / bbox** (commented elements only) —
  `    layout:    display:<d>; flex-direction:<fd>; gap:<g>` (include `grid-template-columns` /
  `grid-template-rows` in place of flex-direction when `display` is grid); `    children:
  <count> × <repeated tag.class signature, or just tag if classes vary>`; `    bbox:
  <w>×<h> @ (<x>,<y>)` from `getBoundingClientRect`, rounded to integers.
- **Paint chains on comments** — for `background-color`, `color`, `border-color` in that
  order, emit the `<prop>: <computed>` line followed by its chain block, but **only** when
  that property's declaration is var-backed. Untokenized page → none emitted.

## Degradation (the floor)

Every failure drops one detail and keeps the rest:
- Cross-origin sheet — skipped during scan; its vars/lines simply don't contribute. If the
  needed hop is only in a cross-origin sheet, that hop is absent and the chain ends early.
- Unreachable line — emit `file` alone; if even the file is unknown, emit the hop with no
  source column.
- Cycle / depth cap — emit the hops walked, mark the reason, stop.
- Missing var, no fallback — the chain ends at the last resolvable hop; the edit's plain
  `before → after` leaf line is always present regardless.
- No `context` on a record (old stored record, or `environment: 'node'` export) — renders
  exactly as today.
- `detectTheme` null — no mode segment in the header, no per-record theme line.

## Testing (TDD)

`environment: 'node'`, no new deps. The split puts every priority test on a pure module.

**`src/utils/resolve/varChain.test.js`** (pure, fake `lookup`):
- multi-hop: `var(--radius-md)` with lookup `{--radius-md:'calc(var(--radius) - 2px)',
  --radius:'0.625rem'}` → two hops in order, values exact.
- `calc()` passthrough: hop value stays `calc(var(--radius) - 2px)`; never becomes `7.375px`.
- rem at 15px root: `rootFontSize:'15px'`, a hop value containing `rem` → `root` present with
  value `15px`; a chain with no `rem` → `root: null`.
- cycle: `{--a:'var(--b)', --b:'var(--a)'}` → terminates, `cyclic: true`, hops `[--a, --b]`.
- missing var with fallback: `var(--gone, 4px)`, lookup returns null → single hop value `4px`,
  name marks fallback.
- depth cap: `maxDepth:3` on a 6-deep chain → `truncated: true`, 3 hops.

**`src/utils/resolve/cssSource.test.js`** (fake `sheets`, no DOM):
- cross-origin: a fake sheet whose `cssRules` getter throws is skipped; a later readable sheet
  still contributes — scan does not abort.
- specificity: `.a.b { --x: 1 }` beats `.a { --x: 2 }` for an element matching both → text `1`.
- source order: two equal-specificity rules → the later one wins.
- `<style>` line: a rule on line 3 of a style element's text → `line: 3`; `data-vite-dev-id`
  present → `file` = its basename.
- linked sheet: `href` set, no `ownerNode` text → `{ file: basename, line: null }`.

**`src/sidebar/notes/exportNotes.test.js`** (extends existing pure tests):
- all three fixtures above render exactly as shown (header + records).
- 4-corner collapse: a record with the four corner longhands (same before/after) → one
  `border-radius … (4 corners)` line + one chain; differing afters → four lines, no collapse.
- floor: an untokenized record (no `context`) renders as `## [n] selector` + optional
  `    Comment: "…"` + plain 4-space-indented `    prop: before → after` lines, with **no**
  declared/chain/layout/theme blocks (locks the floor — new layout, zero resolution noise).
- per-record theme line appears only when element mode ≠ page mode.

**`src/utils/resolve/pageState.test.js`** (pure core + fake carriers):
- explicit `.dark` carrier → `{ mode:'dark', method:'carrier:.dark' }`.
- no carrier, `prefers-color-scheme` media rule present → mode from `prefersDark`, method
  `prefers-color-scheme`.
- no carrier, no media rule → null (omit).
- carrier beats media query when both present.

## Constraints (verbatim from the task)

- Class-based selector line stays; all of this is additive to it.
- Plain text, copy-pasteable, diff-friendly.
- Don't bloat the common case: no tokens and no framework looks ~like today.
- Degrade, never fail — a chain that won't resolve emits today's plain computed value.
- TDD; the three items are fixtures; resolver tests matter most.
- No new runtime deps without asking.

---

## Phase 2 — proposal (not built; approve separately)

Documented here so it isn't lost; **no task in the Phase 1 plan touches it.** Both features
change what the user *does*, not just what we emit, so each needs its own sign-off.

### Blast radius, decided in-browser

**Why.** The agent stopped and asked "just this button, or the token?" because it could not
*show* anyone the consequence of a token-wide change. We can — live, in the panel.

**Detection.** Per candidate token in a resolved chain (each hop has its own radius — `--radius-md`
is narrower than `--radius`): build the reverse-dependency closure over all var definitions
(`--radius` → every var whose text references it), collect the selectors of author rules
referencing anything in that set, `querySelectorAll` them → both a count and the live element
list to highlight. Blind spots (inline `style="--x: var(--y)"`, shadow DOM, cross-origin
rules) are real, so if any sheet threw during the scan the count is reported as `47+`, never
a bare `47`.

**UX.** Only when the edited property's declaration is var-backed; otherwise the panel is
unchanged. A scope strip under the edited control:
```
Apply to
● this element only
○ --radius-md    12 elements
○ --radius       47 elements
```
Hovering a row highlights those elements (reusing `content-highlight.js`); choosing a token
row applies the edit *as a token override* so all N change live. Default stays `this element
only` — today's behavior is what you get by not choosing. Export then carries a resolved
`scope:` count and an `intent:` line the user actually saw the consequences of. Cost:
token-level apply is a new edit mode with its own before/after + revert path, not just an
annotation.

### Component identity

**Detection.** React fiber via the DOM node's `__reactFiber$*` (React 17+) /
`__reactInternalInstance$*` (16) key; walk `fiber.return` to the nearest function/class
component for the name and keep walking for the `(Canvas ▸ CardsScreen ▸ Button)` breadcrumb.
Source location from `fiber._debugSource` — **dev-build only, and removed in React 19; verify
on the actual app before building.** Suppression: a production build yields minified names, so
drop names ≤2 chars rather than export `## [1] Xe`; plain HTML gets nothing. The selector line
stays regardless — purely additive. Non-React frameworks are out of scope, but the adapter
boundary leaves room for one. All reads are private-API, wrapped so a React-internals change
degrades to today's output rather than breaking export.
