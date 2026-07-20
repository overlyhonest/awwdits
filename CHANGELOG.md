# Changelog

All notable changes to Awwdits are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] — 2026-07-20

### Fixed
- **Typed values in the editor now apply.** Typing a number into a corner radius, padding, margin, or gap field sent the bare number to the page — `border-top-left-radius: 12` is invalid CSS and was dropped silently, so the edit looked like it did nothing. Only the steppers worked, because they re-appended the unit. Typed values are now given a unit, and **Enter** commits an edit (previously only clicking away did).
- **Stepping line height no longer appends `px`.** A unitless line height is a ratio, so `1.5` stepped to `1.6px` and changed meaning. The stepper now keeps the field's own unit convention.
- **Gap is offered on every flex and grid container.** The control was keyed off the current gap value, so a container with no gap yet — exactly when you want to add one — showed nothing. Now keyed off `display`, in both the inspect and edit panels.

### Added
- **Blocked-edit detection for width and height.** An inline `!important` edit always wins the cascade, so it shows up in DevTools — but `min-height`/`max-height` clamp the used value afterwards and the element never moves. A height edit on a constrained element therefore looked broken with no explanation anywhere. The editor now detects that the element did not actually resize, names the constraint responsible (`min-height: 56px holds it at 56px`), and offers to override it. It reports only a constraint it can identify, so an element stalled by something else is never blamed on the wrong property.
- **Linked corner radii.** A link toggle on the corner row ties all four corners together: typing in one mirrors to the rest and commits as a single `border-radius`, so the change log gets one entry instead of four. An element that already has mismatched corners opens unlinked, so entering edit mode can't flatten a deliberate asymmetry.

## [1.2.0] — 2026-07-19

### Added
- **Contrast in the inspect card.** Hovering or inspecting a text element now shows its WCAG contrast ratio and grade as a color-coded pill — green for pass (AA/AAA), amber for marginal, red for fail. Computed against the effective background, using the element's real large-text threshold.

### Fixed
- **Text properties no longer appear on containers.** Font, line height, color, and contrast (overlay card), plus the Typography and Contrast sections (side panel), are shown only for elements that render their own text — not for containers that merely wrap text-bearing children. Mixed content like `<p>Hello <a>link</a> world</p>` still counts as text.

## [1.1.2] — 2026-07-18

### Changed
- Comment pin tail moved to the bottom-right corner (was bottom-left).

## [1.1.1] — 2026-07-18

### Fixed
- **Stable annotation numbering.** Notes are numbered in creation order, so the first note added is always `[1]`. Previously the list was recency-sorted, so a newly added comment jumped to `[1]` and renumbered the rest.

### Changed
- Em-dash-free export preamble, matching the repo's doc style.
- README updated to the current export format (locators, resolved chains, scope, previews).

## [1.1.0] — 2026-07-18

Theme: make a design-review handoff something a developer or a coding agent can act on directly — locate the exact element and, for edits, resolve the change back to the token and file you'd edit.

### Added
- **Edits resolve to source.** A token-backed change (e.g. `border-radius`) exports its `var()` chain down to the file and line — `var(--radius-md) → theme.css:109` on a Vite dev server — including the shorthand→longhand case the CSSOM can't expand.
- **Component locators.** Every note leads with the strongest available handle for finding the element: the React component name + source (`Button → button.tsx:8`), a text snippet, and a stable DOM hook (`data-testid` / `id` / `aria-label` / `data-slot`). Framework-agnostic, degrades gracefully.
- **Scope toggle.** Mark any note **this element** or **all similar** so whoever applies it knows the intended reach.
- **Explanatory export preamble.** The export opens with what it is, the page/theme it came from, and how to read each block.
- **Page-aware theme** in the export header, detected from the real theme carrier.
- **Image-focused inspector view.** Inspecting an image hides the box model and shows the visual + effects.
- **Previews for every visual** — `<img>`, CSS backgrounds, inline `<svg>` (currentColor resolved), `<canvas>`, and `<video>` posters, rendered on a checkerboard so transparency reads.

### Changed
- Comments locate but don't resolve — they carry layout + locators; interpreting the CSS is left to the reader.

## [1.0.1] — 2026-07-17

### Fixed
- **Brand fonts silently fell back to Arial on strict-CSP sites** (GitHub, GitLab, Linear, most admin/banking apps). The three faces are now vendored into the extension (latin subsets, ~66 KB) and loaded from `chrome-extension://` URLs, which also removes a third-party request to `fonts.googleapis.com` from every reviewed page. Both families ship under SIL OFL 1.1 (`fonts/OFL.txt`).
- Non-numeric dimensions (e.g. `width: auto`) rendered the literal string "NaN" in the panel instead of an em-dash.

## [1.0.0] — 2026-07-17

First release. Review any live page:
- **Inspect** — ⌘/Ctrl-click any element for its computed styles, contrast, and box model.
- **Comment** — ⌘/Ctrl+Shift+click to pin a comment to an element.
- **Measure** — hold **X** and click two elements for the gap between them.
- **Edit** — change CSS live; every change is tracked.
- **Changes** — export the whole review as structured text a developer or an LLM can act on.

[1.2.0]: https://github.com/overlyhonest/awwdits/releases/tag/v1.2.0
[1.1.2]: https://github.com/overlyhonest/awwdits/releases/tag/v1.1.2
[1.1.1]: https://github.com/overlyhonest/awwdits/releases/tag/v1.1.1
[1.1.0]: https://github.com/overlyhonest/awwdits/releases/tag/v1.1.0
[1.0.1]: https://github.com/overlyhonest/awwdits/releases/tag/v1.0.1
[1.0.0]: https://github.com/overlyhonest/awwdits/releases/tag/v1.0.0
