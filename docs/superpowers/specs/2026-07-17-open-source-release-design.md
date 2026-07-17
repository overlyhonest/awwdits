# Open-source release: reposition, license, publish (design)

**Status:** approved for planning · **Date:** 2026-07-17 · **Branch:** to be created off `main`

## Summary

Publish awwdits to GitHub as a public, GPL-v3 project under the `overlyhonest` account,
positioned as a tool to **share design review with devs and LLMs**. This retires the old
"every shipped design is a crime scene" premise, adds the licensing and contributor docs
the repo currently lacks, fixes commit attribution before anything is pushed, and cuts a
`v1.0.0` release with an installable build attached.

Goal per the user: a **real project seeking users**, not a portfolio drop. That sets the bar
for the README and contributor surface.

## Current state (verified 2026-07-17)

- **69 commits** on `main`, clean tree, all feature branches merged (0 ahead). (An earlier
  draft said 61; that was the pre-merge count on `feat/toolbar-widget-model` and was stale.
  69 = 67 of the user's work + 2 spec commits from this brainstorm.)
- **No remote configured.** Nothing has ever been pushed.
- 95 tracked files. `dist/`, `storybook-static/`, `node_modules/` correctly gitignored.
- **No secrets.** Tracked-file scan and full-history filename scan both clean. Every
  `token` hit is a design token.
- **Tests pass:** 36 tests, 5 files. **Build succeeds:** `content-script.js` 63.66 kB,
  `sidebar.js` 197.51 kB.
- `gh` authenticated as `overlyhonest` (user id `100082640`).
- **No `user.email` set** locally or globally, which is the root cause of the bad authorship.

## Scope

**In:**
- Reposition user-facing copy away from the crime premise.
- Rewrite all commits to attributable authorship.
- GPL v3 licensing (`COPYING` + `package.json` field).
- `README.md` and `CONTRIBUTING.md`.
- Correction of the false light-theme and theme-toggle claims in `DESIGN_SYSTEM.md`
  (~10 sites; see section 5).
- Trim the stale Figma entry from `.claude/settings.json`.
- Create the public repo, push, tag `v1.0.0`, attach a build to a Release.

**Out (deferred, YAGNI):**
- Chrome Web Store submission (needs a developer account, $5 fee, review, store assets).
  Separate effort once the repo is up.
- Per-file GPL headers. `COPYING` plus a README notice is what GPL'd JS projects do in
  practice; 95 files of boilerplate is not worth it for a solo project.
- Issue/PR templates, CI, code of conduct. Add if and when contributors actually show up.
- Restyling or restructuring `DESIGN_SYSTEM.md` beyond the incorrect claims. Sections that
  are accurate are left exactly as they are, em dashes and all.
- Screenshots and GIFs. **Blocked on the user**; see Open Questions.

## Constraints

- **No em dashes** in any new public-facing prose: README, CONTRIBUTING, and the
  `package.json` / `manifest.json` descriptions. Use periods, commas, parentheses, or
  colons instead. This constraint does not extend to existing files left untouched.
- Chrome caps `manifest.json` `description` at 132 characters.

## 1. Reposition the copy

The crime premise is load-bearing in exactly two places, and appears zero times across
`docs/superpowers/`. This is a cheap change.

| File | Line | From | To |
|---|---|---|---|
| `package.json` | 4 | `Every shipped design is a crime scene` | `Share design review with devs and LLMs` |
| `manifest.json` | 5 | `Every shipped design is a crime scene. Inspect, measure, and audit web designs without code.` | `Review any live page: comment on elements, tweak the CSS, and hand it off to a developer or an LLM as structured text.` (118 chars) |
| `manifest.json` | 13 | `Awwdits - Design Inspector` | `Awwdits - Design Review` |

Rationale for line 13: "Inspector" is the mechanics-first framing being retired. These
strings surface in the Chrome toolbar tooltip and the extensions list.

## 2. Rewrite history

**Problem:** all commits are authored `Jaseem <jaseem@Jaseems-MacBook-Pro.local>`, a
hostname fallback, not a real address. GitHub cannot link any of them to the account.

**Fix:** rewrite author and committer on all 69 commits to
`Jaseem <100082640+overlyhonest@users.noreply.github.com>`. The noreply address gives full
profile attribution while keeping the real address private and unscrapeable.

Because every commit shares one bogus identity, this is an unconditional rewrite with no
per-commit matching. **`git-filter-repo` is not installed** (verified 2026-07-17), so either
`brew install git-filter-repo` first, or use `git filter-branch --env-filter`. filter-branch
is deprecated and slow, but at 69 commits with a single unconditional substitution it is
adequate and adds no dependency. Decide at plan time; the outcome is identical.

**Safety:**
- Tag the pre-rewrite state (`backup/pre-rewrite`) first so it is recoverable.
- Do this **before** the first push. After publishing, a rewrite breaks every clone and fork.
- Afterwards, `git config user.email` locally so new commits do not regress.

**Verify:** `git log --format='%an <%ae>' | sort -u` returns exactly one line, the noreply
address, and `git rev-list --count HEAD` still returns the pre-rewrite count (69 as of
2026-07-17; re-measure rather than trusting this number).

## 3. Licensing

- `COPYING`: full, unmodified GPL v3 text. FSF's conventional filename; GitHub's license
  detection treats it identically to `LICENSE`.
- `package.json`: add `"license": "GPL-3.0-or-later"`. The field is currently absent.
- README: a short License section naming GPL v3 and pointing at `COPYING`.

Chosen over MIT/Apache deliberately: copyleft prevents a closed-source awwdits clone
shipping on the Web Store.

## 4. README

The spine follows the positioning, not the feature list:

1. **What it is.** Review any live page: comment on elements, tweak the CSS, and hand the
   whole thing to a developer or an LLM as structured text.
2. **The workflow**, which is the actual pitch: comment on a live page, tweak CSS, export
   the block, paste to a dev or an LLM.
3. **The export format, shown verbatim** as a fenced code sample. `exportNotes.js` already
   produces a per-element block (selector heading, comment, CSS `before → after` list). It
   is the most convincing artifact in the repo and costs nothing to show.
4. **Install:** clone, `npm install`, `npm run build`, load unpacked from `dist/`.
   Note the Release zip as the no-toolchain path.
5. **Shortcuts:** `Alt+Shift+A` to toggle, the toolbar tools, `cmd+shift+click` to comment.
6. **Supporting features:** inspect, measure, audit. Framed as how you build a note, not as
   the point.
7. **Development:** `npm test` (36 tests), `npm run storybook`, pointers to
   `DESIGN_SYSTEM.md` and `docs/superpowers/`.
8. **License.**

Image slots marked with HTML comments for the user to fill.

## 5. Contributor docs

**`CONTRIBUTING.md`:** build and test commands; the `feat(scope):` commit convention the log
already follows; the spec → plan → implement cycle with `docs/superpowers/` as the worked
example; a pointer to `DESIGN_SYSTEM.md` for the token rules (no raw hex in sidebar
components, the `COLOR`/`FONT` shim, and the deliberate exception that content-script
overlays run in page context with explicit hex).

**`DESIGN_SYSTEM.md` correction:** the doc actively contradicts the code and is the first
thing a contributor reads. Commit `0364618` deleted the light palette and theme plumbing
(`tokens.css:3` now states "dark-only, there is no light palette and no theme toggle"), and
`65351d8` removed the panel close button.

**Scope correction (2026-07-17):** an earlier draft of this spec called this "a few false
claims" and scoped it as a footnote. On reading all 134 lines, it is stale in ~10 sites:

| Lines | Stale claim |
|---|---|
| 3-6 | Old "inspecting, measuring, auditing" positioning; "ships dark by default with a full light theme" |
| 8-13 | "light values on `:root`, dark under `[data-theme="dark"]`"; "theme for free" |
| 16 | Figma light node `2093:1200`, which has no implementation |
| 20-23 | The entire **Theming** section: no-flash script, `localStorage['awwdits-theme']`, sun/moon toggle |
| 28, 36, 44 | A `Light` column in three separate color tables |
| 102 | Header spec citing sun/moon and close buttons |

Still deletion rather than rewriting, and it is the contributor entry point, so the wider
scope is justified. Sized as its own task in the plan rather than absorbed silently.

## 6. Publish

1. `gh repo create awwdits --public --source=. --push` under `overlyhonest`.
2. Confirm GitHub detects GPL v3 and that commits attribute to the profile.
3. Tag `v1.0.0`, push the tag.
4. `npm run build`, zip `dist/`, attach to a GitHub Release so users can install without a
   toolchain.
5. Set the repo description and topics (`chrome-extension`, `design-review`, `devtools`).

## 7. Housekeeping

`.claude/settings.json` is tracked and contains a hardcoded `curl` permission for a single
stale Figma asset URL. Harmless but it is local tooling cruft with no value to contributors.
Remove that one entry; keep the rest of the allowlist.

## Risks

| Risk | Mitigation |
|---|---|
| History rewrite corrupts the repo | Backup tag first; verify commit count and authorship after; nothing pushed yet so worst case is a reset |
| Rewrite happens after publish | Sequence it first, before `gh repo create` |
| README overpromises | Every claim traces to verified behavior: tests pass, build succeeds, export format read from source |
| Real email leaks into history | Use the noreply address, never the real one |

## Open questions

1. ~~**Screenshots/GIF.**~~ Resolved 2026-07-17: draft the README first with marked slots
   under `docs/images/`, user supplies assets against the shot list below, then publish.
   **Screenshots are a publish blocker**, not a follow-up: the hero shot is load-bearing for
   a project seeking users. Sequence: README draft → user captures → drop in → push.

   **Shot list** (filename → what it shows → why the README needs it):

   | Slot | Shows | Purpose |
   |---|---|---|
   | `hero.png` | Toolbar open on a real page, one element selected, panel showing its properties | Top-of-README. The one image that says what this is. Use a well-known, good-looking site so it reads instantly. |
   | `comment.png` | The comment composer open on a selected element, with the pin visible | Proves the review layer, which is the whole premise. |
   | `changes.png` | The changes popover listing several tracked records, copy/export controls visible | The bridge into the export section. |

   Constraints: dark-only UI (`0364618`), so shots are dark by default. No personal data,
   internal tooling, or identifiable browser chrome (bookmarks, tabs, profile) in frame.
2. ~~**Repo name.**~~ Resolved: `overlyhonest/awwdits` is free (verified 2026-07-17).
