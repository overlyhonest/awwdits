# Open-Source Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish awwdits as a public, GPL-v3 GitHub project positioned as a tool to share design review with devs and LLMs, with attributable commit history and a `v1.0.0` release carrying an installable build.

**Architecture:** Six content tasks (authorship, license, copy, contributor docs, README, housekeeping) followed by a publish task. Authorship is rewritten **first** so that every commit made during this plan is born correct, and so the rewrite can never land after a push. Screenshots are a publish blocker supplied by the user between Task 6 and Task 7.

**Tech Stack:** git (`filter-branch` or `filter-repo`), `gh` CLI, npm, Vite. No new runtime dependencies.

**Spec:** [`docs/superpowers/specs/2026-07-17-open-source-release-design.md`](../specs/2026-07-17-open-source-release-design.md)

## Global Constraints

- **No em dashes** in new public-facing prose. This binds **exactly four files and nothing else**: `README.md`, `CONTRIBUTING.md`, and the `description` fields of `package.json` and `manifest.json`. Use periods, commas, parentheses, or colons instead. Do not substitute en dashes, which are the same problem wearing a hat.
  - **`DESIGN_SYSTEM.md` is deliberately exempt**, even though Task 4 edits it. Task 4 makes targeted corrections to an existing doc and matches its surrounding prose style, em dashes included. Em dashes in Task 4's replacement text are **correct and intentional, not a constraint violation.**
- **Minimal and direct.** No filler, no throat-clearing, no "thanks for your interest", no restating a heading in the sentence beneath it. Every line earns its place or it goes. The docs in this plan are already trimmed to their intended length: **write them as given, do not expand them, do not add sections that are not in the plan.**
- `manifest.json` `description` must be **132 characters or fewer** (Chrome limit).
- Commit author and committer must be `Jaseem <100082640+overlyhonest@users.noreply.github.com>`. Never the real email, never the `.local` hostname.
- The UI is **dark-only** as of commit `0364618`. No documentation may claim a light theme or a theme toggle exists.
- Repo is `overlyhonest/awwdits`, **public**, license GPL v3.
- Nothing is pushed until Task 7. The history rewrite (Task 1) must precede any push.

---

### Task 1: Fix commit authorship

All 69 commits on `main` are authored `Jaseem <jaseem@Jaseems-MacBook-Pro.local>`, a hostname fallback caused by `user.email` being unset both locally and globally. GitHub cannot attribute them. This runs first so every later commit in this plan is correct at creation, and so the rewrite provably precedes the first push.

**Note on the count:** earlier notes in the spec say "61 commits". That figure was measured on the `feat/toolbar-widget-model` branch before it was merged into `main`, and it is stale. The verified count on `main` as of 2026-07-17 is **69** (67 of the user's work, plus the 2 spec commits from brainstorming). Use 69.

**Files:**
- Modify: `.git/config` (via `git config`, not by hand)
- No source files

**Interfaces:**
- Consumes: nothing
- Produces: a clean, attributable history that Tasks 2 to 7 commit on top of

- [ ] **Step 1: Verify the problem and record the baseline**

```bash
git log --format='%an <%ae>' | sort -u
git rev-list --count HEAD
```

Expected: exactly one author line, `Jaseem <jaseem@Jaseems-MacBook-Pro.local>`, and a count of `69`. **Record whatever number it actually prints** and use that, not this plan's number: further commits may have landed since it was written. The count after the rewrite must match it exactly.

- [ ] **Step 2: Create the backup tag**

Nothing is pushed, so this tag is the only rollback path if the rewrite goes wrong.

```bash
git tag backup/pre-rewrite
git rev-parse backup/pre-rewrite
```

Expected: a SHA. Confirm `git tag -l` lists `backup/pre-rewrite`. **Record that SHA.**

**HAZARD (found during execution, 2026-07-17):** Step 4's `--tag-name-filter cat -- --branches --tags` rewrites **every tag, including this backup tag**, silently moving it onto the rewritten history and destroying the rollback path. Step 6 then deletes `refs/original/`, making the loss permanent and unrecoverable. After Step 4, re-point the tag at the SHA recorded here and verify it still carries the **old** `.local` author:

```bash
git tag -f backup/pre-rewrite <SHA_FROM_THIS_STEP>
git log -1 --format='%H %an <%ae>' backup/pre-rewrite
```

Expected: the old `jaseem@Jaseems-MacBook-Pro.local` author. If it shows the noreply address, the tag is pointing at rewritten history and is **not** a valid backup.

- [ ] **Step 3: Set the identity for all future commits**

Local, not global: do not assume the user wants this identity on their other repos.

```bash
git config user.name "Jaseem"
git config user.email "100082640+overlyhonest@users.noreply.github.com"
git config user.email
```

Expected: prints `100082640+overlyhonest@users.noreply.github.com`.

- [ ] **Step 4: Rewrite every commit**

`git-filter-repo` is **not installed** (verified 2026-07-17). Use `filter-branch`. It is deprecated and slow, but this is 69 commits with one unconditional substitution, and it adds no dependency. `FILTER_BRANCH_SQUELCH_WARNING` suppresses the deprecation notice.

Because every commit shares one bad identity (verified: `git log --format='%ae' | sort -u` returns exactly one address), this is unconditional: no per-commit matching, no author map.

```bash
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --env-filter '
export GIT_AUTHOR_NAME="Jaseem"
export GIT_AUTHOR_EMAIL="100082640+overlyhonest@users.noreply.github.com"
export GIT_COMMITTER_NAME="Jaseem"
export GIT_COMMITTER_EMAIL="100082640+overlyhonest@users.noreply.github.com"
' --tag-name-filter cat -- --branches --tags
```

Expected: `Rewrite <sha> (69/69)` then `Ref 'refs/heads/main' was rewritten`.

- [ ] **Step 5: Verify the rewrite**

```bash
git log --format='%an <%ae>' | sort -u
git rev-list --count HEAD
git log --oneline -3 | cat
```

Expected, and **all three must hold**:
1. Exactly one line: `Jaseem <100082640+overlyhonest@users.noreply.github.com>`
2. Count matches the number recorded in Step 1 exactly. A different number means commits were dropped: run `git reset --hard backup/pre-rewrite` and stop.
3. The three commit subjects are unchanged from before the rewrite (SHAs will differ; subjects must not).

- [ ] **Step 6: Clean the filter-branch backup refs**

`filter-branch` leaves the pre-rewrite history in `refs/original/`, which would otherwise be pushed.

```bash
git for-each-ref --format='%(refname)' refs/original/ | xargs -n 1 git update-ref -d
git for-each-ref refs/original/
```

Expected: the second command prints nothing.

`backup/pre-rewrite` is intentionally kept until Task 7 confirms a good push. It is a local tag and will not be pushed unless `--tags` is passed, which Task 7 does not do for it.

---

### Task 2: Add the GPL v3 license

The repo has no license, so the current default is exclusive copyright: nobody may legally use the code even once it is public. GPL v3 was chosen deliberately over MIT/Apache so a closed-source awwdits clone cannot ship on the Web Store.

**Files:**
- Create: `COPYING`
- Modify: `package.json:2-5`

**Interfaces:**
- Consumes: Task 1's identity config
- Produces: `COPYING` at repo root, which `README.md` (Task 6) links from its License section

- [ ] **Step 1: Fetch the GPL v3 text**

`COPYING` is the FSF's conventional filename. GitHub's license detection treats it identically to `LICENSE`. The text must be unmodified: do not edit it, do not fill in a copyright line inside it.

```bash
curl -fsSL https://www.gnu.org/licenses/gpl-3.0.txt -o COPYING
```

- [ ] **Step 2: Verify it landed intact**

```bash
head -3 COPYING
wc -l < COPYING
grep -c "GNU GENERAL PUBLIC LICENSE" COPYING
```

Expected: the header reads `GNU GENERAL PUBLIC LICENSE / Version 3, 29 June 2007`, roughly `674` lines, and at least one match. A short file or an HTML doctype means the fetch failed: do not commit it.

- [ ] **Step 3: Add the license field to package.json**

The field is currently absent entirely. Insert it after `description`. Use `GPL-3.0-or-later`, the current SPDX identifier (`GPL-3.0` is deprecated and will warn).

Note: `description` on line 4 is replaced in Task 3. Only the `license` line is added here.

```json
{
  "name": "awwdits",
  "version": "1.0.0",
  "description": "Every shipped design is a crime scene",
  "license": "GPL-3.0-or-later",
  "scripts": {
```

- [ ] **Step 4: Verify package.json still parses**

A hand-edited JSON file with a trailing comma will break the build, not just npm.

```bash
node -e "console.log(require('./package.json').license)"
```

Expected: `GPL-3.0-or-later`

- [ ] **Step 5: Commit**

```bash
git add COPYING package.json
git commit -m "chore: license under GPL v3"
```

---

### Task 3: Reposition the user-facing copy

Retire the "every shipped design is a crime scene" premise for "share design review with devs and LLMs". The premise is load-bearing in exactly two files and appears zero times in `docs/superpowers/`, so this is cheap. These strings surface in the Chrome toolbar tooltip and the extensions list.

**Files:**
- Modify: `package.json:4`
- Modify: `manifest.json:5`, `manifest.json:13`

**Interfaces:**
- Consumes: Task 2's `package.json` edit (same file, applied on top)
- Produces: the canonical one-line description reused verbatim as the README's opening line in Task 6

- [ ] **Step 1: Rewrite the package.json description**

From `"description": "Every shipped design is a crime scene",` to:

```json
  "description": "Share design review with devs and LLMs",
```

- [ ] **Step 2: Rewrite the manifest.json description**

From `"description": "Every shipped design is a crime scene. Inspect, measure, and audit web designs without code.",` to:

```json
  "description": "Review any live page: comment on elements, tweak the CSS, and hand it off to a developer or an LLM as structured text.",
```

- [ ] **Step 3: Rewrite the manifest.json action title**

"Design Inspector" is the mechanics-first framing being retired. From `"default_title": "Awwdits - Design Inspector"` to:

```json
    "default_title": "Awwdits - Design Review"
```

The hyphen here is a hyphen, not an em dash, and is fine.

- [ ] **Step 4: Verify the length limit and that the premise is gone**

```bash
node -e "
const m = require('./manifest.json');
const n = m.description.length;
console.log(n, n <= 132 ? 'OK' : 'TOO LONG (Chrome caps at 132)');
"
grep -riE 'crime|scene' package.json manifest.json
```

Expected: `118 OK`, and the grep prints nothing.

- [ ] **Step 5: Verify no em dashes entered the copy**

```bash
grep -n '—' package.json manifest.json
```

Expected: prints nothing.

- [ ] **Step 6: Verify the build still consumes the manifest**

```bash
npm run build 2>&1 | tail -3
```

Expected: `✓ built in ...`, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json manifest.json
git commit -m "feat: reposition as design review for devs and LLMs"
```

---

### Task 4: Correct DESIGN_SYSTEM.md

This is the first file a contributor reads and it currently contradicts the code. Commit `0364618` deleted the light palette and theme plumbing; `tokens.css:3` now states "dark-only, there is no light palette and no theme toggle". The doc still documents both. Commit `65351d8` also removed the panel close button that line 102 describes.

Correct the false claims. Do **not** restyle prose, reflow paragraphs, or restructure sections that are accurate. The existing file uses em dashes; leave them, since the global no-em-dash constraint covers new public-facing prose, not targeted corrections to an existing doc.

**Files:**
- Modify: `DESIGN_SYSTEM.md` (lines 3-6, 8-13, 15-18, 20-23, 28-34, 36-42, 44-50, 102)

**Interfaces:**
- Consumes: Task 3's positioning language
- Produces: an accurate contributor doc that `CONTRIBUTING.md` (Task 5) points at for token rules

- [ ] **Step 1: Confirm the ground truth before editing**

Do not trust this plan's line numbers blindly. Re-read the source of truth first.

```bash
head -8 src/sidebar/tokens.css
grep -rn 'data-theme' src/sidebar/tokens.css | head
```

Expected: the comment confirms dark-only, values live unconditionally on `:root`, and there is no `[data-theme="light"]` block. If `data-theme` still appears with light values, **stop**: the premise of this task is wrong and the doc may be correct.

- [ ] **Step 2: Fix the intro (lines 3-6)**

Replace:

```
Awwdits is a Chrome-extension side panel (~300px content) for inspecting, measuring,
and auditing web designs. The current direction is **monochrome, wide-grotesque** —
neutral grey surfaces, no chrome accent color, a bold Special Gothic Expanded One
display face, and Tabler icons. It ships **dark by default** with a full light theme.
```

With:

```
Awwdits is a Chrome-extension side panel (~300px content) for reviewing web designs:
comment on elements, tweak the CSS, and export the result. The current direction is
**monochrome, wide-grotesque** — neutral grey surfaces, no chrome accent color, a bold
Special Gothic Expanded One display face, and Tabler icons. It is **dark-only**.
```

- [ ] **Step 3: Fix the source-of-truth paragraph (lines 8-13)**

Replace:

```
**Source of truth:** [`src/sidebar/tokens.css`](src/sidebar/tokens.css) — role-based
CSS custom properties (shadcn/Radix taxonomy) with **light values on `:root`, dark
under `[data-theme="dark"]`**. Components read them through a thin `var()`-shim,
[`components/redesign/tokens.js`](src/sidebar/components/redesign/tokens.js)
(`COLOR.foreground` → `var(--foreground)`), so inline styles stay semantic and theme
for free — no raw hex in component code.
```

With:

```
**Source of truth:** [`src/sidebar/tokens.css`](src/sidebar/tokens.css) — role-based
CSS custom properties (shadcn/Radix taxonomy). awwdits is dark-only, so the values live
**unconditionally on `:root`**; any context that loads the file (panel, Storybook, tests)
is dark by construction. Components read them through a thin `var()`-shim,
[`components/redesign/tokens.js`](src/sidebar/components/redesign/tokens.js)
(`COLOR.foreground` → `var(--foreground)`), so inline styles stay semantic — no raw hex
in component code.
```

- [ ] **Step 4: Fix the scope note's Figma reference (line 16)**

The light frame `2093:1200` no longer has a corresponding implementation. Replace `(designed in Figma nodes `2093:1241` dark / `2093:1200` light)` with:

```
> (designed in Figma node `2093:1241`). The **data views**
```

Leave the rest of the scope note intact.

- [ ] **Step 5: Replace the Theming section (lines 20-23)**

The no-flash script, the `localStorage['awwdits-theme']` read, and the sun/moon toggle were all deleted by `0364618`. Replace the whole section body:

```
## Theming
Pinned **dark** via a no-flash script in `index.html` (`localStorage['awwdits-theme']
|| 'dark'`), with a sun/moon toggle in the header that flips `data-theme` and
persists. The panel iframe and App root are `border-radius: 16px`.
```

With:

```
## Theming
There is none. awwdits is dark-only: no light palette, no toggle, no persistence, no
`data-theme` attribute. Token values sit unconditionally on `:root`. The panel iframe
and App root are `border-radius: 16px`.
```

- [ ] **Step 6: Drop the Light column from all three color tables**

Tables at lines 28, 36, and 44 each carry a `Light` column holding values that no longer exist. Remove that column from the header, the separator row, and every body row of all three tables. Keep the `Dark` column and its values exactly as they are: those are live.

Example, from:

```
| Token (JS `COLOR.*` → CSS var) | Dark | Light | Use |
|---|---|---|---|
| `background` → `--background` | `#1D1D20` | `#FFFFFF` | canvas / panel base |
```

To:

```
| Token (JS `COLOR.*` → CSS var) | Dark | Use |
|---|---|---|
| `background` → `--background` | `#1D1D20` | canvas / panel base |
```

Apply the same shape to the two `| Token | Dark | Light |` tables at lines 36 and 44.

- [ ] **Step 7: Fix the header spec (line 102)**

Line 102 describes `right side = sun/moon + close, 20px`. The theme toggle went in `0364618` and the panel close button in `65351d8`. Re-read the current header component before writing a replacement:

```bash
grep -rn 'header' src/sidebar/components/redesign/*.jsx | head
```

Rewrite line 102 to describe only the controls that exist. If the header now has no right-side controls at all, say so plainly rather than inventing one.

- [ ] **Step 8: Verify every stale claim is gone**

```bash
grep -niE 'light|sun/moon|data-theme|awwdits-theme|toggle' DESIGN_SYSTEM.md
```

Expected: **zero hits describing a light theme or a toggle.** Hits are acceptable only where the word is used unrelatedly (for example "highlight", or a font weight named "Light"). Read each remaining hit and confirm it is not a false claim.

```bash
grep -c 'Light' DESIGN_SYSTEM.md
```

Expected: `0`.

- [ ] **Step 9: Commit**

```bash
git add DESIGN_SYSTEM.md
git commit -m "docs: correct DESIGN_SYSTEM for dark-only reality"
```

---

### Task 5: Add CONTRIBUTING.md

The user's goal is a real project seeking users and contributors. This documents the conventions the repo already follows rather than inventing new process.

**Files:**
- Create: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: Task 4's corrected `DESIGN_SYSTEM.md`
- Produces: a doc `README.md` (Task 6) links from its Development section

- [ ] **Step 1: Write CONTRIBUTING.md**

No em dashes (Global Constraints).

Keep it tight. Every line earns its place or it goes.

```markdown
# Contributing

## Setup

```bash
npm install
npm run build
```

Load `dist/` via `chrome://extensions`, Developer mode, Load unpacked. Rebuild and reload
after changes. `npm run dev` rebuilds on save.

## Tests

```bash
npm test
```

Pure logic is split out of DOM code so it can be tested without a browser. Fixing an
interaction bug? Look for a pure function to test first.

## Design system

Read [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) before touching UI.

- Sidebar components use no raw hex. Colors and fonts come from the `COLOR` / `FONT` shim
  in `src/sidebar/components/redesign/tokens.js`.
- Content-script overlays are the exception: they run in page context with no shim, so
  they use explicit hex. See `src/content/comment-overlay.js`.

Awwdits is dark-only.

## Commits

`type(scope): summary`, for example `fix(toolbar): hide panel on escape-deselect`.

## Pull requests

Say what changed and why. UI changes need a before and after. `npm test` and
`npm run build` must pass.

Larger changes go through a spec, then a plan, both in
[`docs/superpowers/`](docs/superpowers/).

## License

Contributions are licensed under GPL v3. See [`COPYING`](COPYING).
```

- [ ] **Step 2: Verify the constraint and the links**

```bash
grep -n '—' CONTRIBUTING.md
```

Expected: prints nothing.

```bash
ls DESIGN_SYSTEM.md COPYING docs/superpowers/ src/sidebar/components/redesign/tokens.js src/content/comment-overlay.js src/content/toolMode.test.js
```

Expected: every path resolves. A CONTRIBUTING that links to a file that does not exist is worse than no CONTRIBUTING.

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING"
```

---

### Task 6: Write the README

The main deliverable. The spine follows the positioning, not the feature list: the handoff is the point, and inspect/measure are how you build a note. The export format is shown verbatim because it is the most convincing artifact in the repo and costs nothing to show.

**Files:**
- Create: `README.md`
- Create: `docs/images/.gitkeep`

**Interfaces:**
- Consumes: Task 3's description line, Task 2's `COPYING`, Task 5's `CONTRIBUTING.md`
- Produces: image slots at `docs/images/{hero,comment,changes}.png` that the user fills before Task 7

- [ ] **Step 1: Confirm the documented behavior against the source**

Every claim in the README must be true. Verify the shortcuts rather than trusting this plan:

```bash
cat src/content/toolMode.js
grep -n 'suggested_key' -A 4 manifest.json
```

Expected: `computeHeldTool` maps `mod` to inspect, `mod + shift` to comment, `x` to measure, with a held modifier beating `x`. The manifest's `toggle-awwdits` command is `Alt+Shift+A`. If any of this disagrees with the README text below, **the source wins**: fix the README, not the code.

- [ ] **Step 2: Create the images directory**

```bash
mkdir -p docs/images
touch docs/images/.gitkeep
```

- [ ] **Step 3: Write README.md**

No em dashes (Global Constraints). The export sample below is the real output shape of `formatRecord` in `src/sidebar/notes/exportNotes.js`: a `##` selector heading, a quoted comment, and a `Changes:` list of `property: before → after`. The `→` is an arrow, not an em dash, and is correct.

````markdown
# Awwdits

Review any live page: comment on elements, tweak the CSS, and hand the whole thing to a
developer or an LLM as structured text.

<!-- SCREENSHOT SLOT: docs/images/hero.png
     Toolbar open on a real page, one element selected, panel showing its properties. -->
![Awwdits inspecting a live page](docs/images/hero.png)

"The padding is off here" is not actionable. Awwdits turns review into what a developer or
a coding agent can use directly: which element, what is wrong, and the exact CSS change.

## How it works

Open with `Alt+Shift+A`. Hold `Cmd` and click an element to inspect it, or add `Shift` to
comment on it. Tweak the CSS and every change is tracked as a before and after pair.
Comments and changes persist per page URL.

<!-- SCREENSHOT SLOT: docs/images/comment.png
     Comment composer open on a selected element, pin visible. -->
![Commenting on an element](docs/images/comment.png)

## What you hand off

Copy from the changes popover:

```
## .pricing-card__title
Comment: "This is competing with the price for attention"
Changes:
  - font-size: 24px → 18px
  - font-weight: 700 → 500
  - color: #FFFFFF → #A1A1AA

## .pricing-card__cta
Comment: "Needs more room to breathe"
Changes:
  - padding: 8px 16px → 12px 24px
```

Paste that into a ticket, a PR, or an LLM. Selectors are class-based on purpose: awwdits
knows each element's positional path but leaves it out, since positional paths break the
moment a sibling moves.

<!-- SCREENSHOT SLOT: docs/images/changes.png
     Changes popover listing several tracked records, copy/export controls visible. -->
![The changes popover](docs/images/changes.png)

## Install

Not on the Chrome Web Store yet. Download the zip from the
[latest release](https://github.com/overlyhonest/awwdits/releases/latest), or build it:

```bash
git clone https://github.com/overlyhonest/awwdits.git
cd awwdits
npm install
npm run build
```

Then open `chrome://extensions`, turn on Developer mode, choose "Load unpacked", and
select `dist/`.

## Shortcuts

| Shortcut | Does |
|---|---|
| `Alt+Shift+A` | Toggle Awwdits |
| `Cmd` / `Ctrl` + click | Inspect |
| `Cmd` / `Ctrl` + `Shift` + click | Comment |
| Hold `X` | Measure |
| `Escape` | Deselect |

Modifiers are momentary: the tool is live only while the key is down. Clicking a toolbar
tool makes it sticky instead.

## Development

```bash
npm run dev        # rebuild on save
npm test           # run the test suite
npm run storybook  # component workbench
```

Reload the extension after a rebuild to pick up content script or service worker changes.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) to get started and [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)
for the token rules. Specs and implementation plans live in
[`docs/superpowers/`](docs/superpowers/) and explain the reasoning behind the toolbar model.

## License

GPL v3. See [`COPYING`](COPYING).

This is copyleft on purpose: use it, fork it, sell it, but if you distribute a modified
version it has to stay open too.
````

- [ ] **Step 4: Verify the constraint**

```bash
grep -n '—' README.md
```

Expected: prints nothing. If this fails, fix the prose rather than swapping in an en dash, which is the same problem wearing a hat.

- [ ] **Step 5: Verify every internal link and image path resolves**

```bash
ls COPYING CONTRIBUTING.md DESIGN_SYSTEM.md docs/superpowers/
grep -oE '\]\(docs/images/[^)]+\)' README.md
```

Expected: the docs all resolve. The image paths will list `hero.png`, `comment.png`, and `changes.png`, which **do not exist yet**. That is expected: the user supplies them before Task 7, and Task 7 Step 1 blocks on it.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/images/.gitkeep
git commit -m "docs: add README"
```

---

### Task 7: Housekeeping, then publish

The last content change, then the irreversible step. Publishing is a one-way door: once the repo is public and cloned, the Task 1 rewrite can no longer be redone cleanly.

**Files:**
- Modify: `.claude/settings.json`
- Create: git tag `v1.0.0`

**Interfaces:**
- Consumes: every prior task
- Produces: the public repo and the `v1.0.0` release

- [ ] **Step 1: Confirm the screenshots exist (BLOCKER)**

The hero shot is load-bearing for a project seeking users. A README whose first image is a broken-image icon is worse than one with no images.

```bash
ls -la docs/images/
```

Expected: `hero.png`, `comment.png`, and `changes.png` all present and non-empty.

If they are missing, **stop and ask the user**. Do not publish and do not silently strip the image tags to work around it.

- [ ] **Step 2: Trim the stale Figma entry from .claude/settings.json**

The allowlist contains a hardcoded `curl` permission for one dead Figma asset URL. Harmless, but it is local tooling cruft with no value to a contributor. Remove that single entry and keep the rest.

```json
{
  "permissions": {
    "allow": [
      "mcp__figma__get_screenshot",
      "Read(//tmp/**)",
      "Read(//private/tmp/**)",
      "mcp__figma__get_design_context",
      "mcp__figma__get_variable_defs",
      "mcp__figma__get_metadata",
      "mcp__figma__download_assets"
    ]
  }
}
```

```bash
node -e "require('./.claude/settings.json'); console.log('parses')"
grep -c 'figma_node.png' .claude/settings.json || echo "entry gone"
```

Expected: `parses`, then `entry gone`.

- [ ] **Step 3: Full verification before the one-way door**

```bash
npm test 2>&1 | tail -5
npm run build 2>&1 | tail -3
git status --short
git log --format='%an <%ae>' | sort -u
```

Expected, and **all four must hold**:
1. `Test Files 5 passed`, `Tests 36 passed`
2. `✓ built in ...`
3. Only `.claude/settings.json` modified, nothing unexpected staged
4. **Exactly one author line**, the noreply address. If the `.local` address appears, Task 1 did not hold: stop and redo it before pushing.

- [ ] **Step 4: Final secret sweep**

Cheap, and the last moment it is free.

```bash
git ls-files -z | xargs -0 grep -nEI '(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY)' 2>/dev/null | grep -v package-lock
echo "sweep done"
```

Expected: no hits before `sweep done`. Design tokens are not secrets; a real key is.

- [ ] **Step 5: Commit the housekeeping**

```bash
git add .claude/settings.json
git commit -m "chore: drop stale figma asset permission"
```

- [ ] **Step 6: Create the public repo and push**

This is the irreversible step.

```bash
gh repo create awwdits --public --source=. --push \
  --description "Share design review with devs and LLMs"
```

Expected: the repo URL prints and `main` is pushed. `overlyhonest/awwdits` was confirmed free on 2026-07-17; if it now exists, stop and ask.

- [ ] **Step 7: Verify what actually landed**

Do not assume the push was correct. Look at it.

```bash
gh repo view overlyhonest/awwdits --json name,visibility,licenseInfo,description
gh api repos/overlyhonest/awwdits/commits --jq '.[0].author.login' 
```

Expected: visibility `PUBLIC`, `licenseInfo` detected as GPL v3, and the commit author resolving to `overlyhonest`. **If the author field is `null`, attribution failed**: the noreply address is wrong or unverified. The history is already public at this point, so report it to the user rather than rewriting.

- [ ] **Step 8: Set the topics**

```bash
gh repo edit overlyhonest/awwdits \
  --add-topic chrome-extension \
  --add-topic design-review \
  --add-topic devtools \
  --add-topic design-tools
```

- [ ] **Step 9: Cut the v1.0.0 release with an installable build**

Users should not need a toolchain to try it.

```bash
npm run build
cd dist && zip -r ../awwdits-v1.0.0.zip . && cd ..
git tag -a v1.0.0 -m "Awwdits v1.0.0"
git push origin v1.0.0
gh release create v1.0.0 awwdits-v1.0.0.zip \
  --title "Awwdits v1.0.0" \
  --notes "Review any live page: comment on elements, tweak the CSS, and hand it off to a developer or an LLM as structured text.

Unzip, open chrome://extensions, turn on Developer mode, choose Load unpacked, and select the unzipped folder."
```

- [ ] **Step 10: Verify the release artifact is real**

A zip that does not load is worse than no zip.

```bash
unzip -l awwdits-v1.0.0.zip | grep -E 'manifest.json|content-script.js|sidebar.js'
gh release view v1.0.0 --json assets --jq '.assets[].name'
rm awwdits-v1.0.0.zip
```

Expected: the zip contains `manifest.json`, `content-script.js`, and `sidebar.js` at minimum, and the release lists the asset. The local zip is a build artifact: delete it, do not commit it.

- [ ] **Step 11: Clean up the backup tag**

Only after the push is confirmed good.

```bash
git tag -d backup/pre-rewrite
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| 1. Reposition the copy | Task 3 |
| 2. Rewrite history | Task 1 |
| 3. Licensing | Task 2 |
| 4. README | Task 6 |
| 5. Contributor docs (CONTRIBUTING) | Task 5 |
| 5. Contributor docs (DESIGN_SYSTEM correction) | Task 4 |
| 6. Publish | Task 7, Steps 6-10 |
| 7. Housekeeping (`.claude/settings.json`) | Task 7, Step 2 |
| Constraint: no em dashes | Global Constraints; verified in Tasks 3, 5, 6 |
| Constraint: 132-char manifest limit | Task 3, Step 4 |
| Open question: screenshots | Task 6 slots; Task 7 Step 1 blocks |
| Out of scope: Web Store, per-file GPL headers, CI, templates | Correctly absent |

No gaps.

**Scope deviation from the spec, flagged:** the spec called the `DESIGN_SYSTEM.md` fix a targeted correction of "the false claims only". On reading the full file it is stale in about ten places across 134 lines, including an entire Theming section and a `Light` column in three tables. Task 4 covers all of it. It is still deletion rather than rewriting, and the doc is the contributor entry point, so the wider scope is justified. Called out here rather than absorbed silently.

**Placeholder scan:** none. Every step has exact commands and expected output. Task 4 Step 7 is the one step that cannot be fully pre-written, since the correct text depends on the header component's current state; it carries an explicit instruction to read the source and a guard against inventing a control that does not exist.

**Type consistency:** no new code, so no signatures to drift. The names that must match across tasks are checked: `COPYING` (Tasks 2, 5, 6), `CONTRIBUTING.md` (Tasks 5, 6), `docs/images/{hero,comment,changes}.png` (Tasks 6, 7), and the noreply address `100082640+overlyhonest@users.noreply.github.com` (Tasks 1, 7), which is identical at every use.

**Ordering:** Task 1 runs first so the rewrite cannot land after a push and so later commits are born attributable. Task 7 gates on screenshots before the one-way door. `backup/pre-rewrite` survives until the push is verified.
