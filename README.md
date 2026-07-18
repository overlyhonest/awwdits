![Awwdits](docs/images/banner.png)

Review any live page: comment on elements, tweak the CSS, and hand the whole thing to a
developer or an LLM as structured text.

![Awwdits inspecting a live page](docs/images/hero.png)

"The padding is off here" is not actionable. Awwdits turns review into what a developer or
a coding agent can use directly: which element (down to its component and source file), what
is wrong, and, for edits, the change resolved to the token and line you'd edit.

## Install

Not on the Chrome Web Store yet. Download
[the latest release](https://github.com/overlyhonest/awwdits/releases/latest) and unzip it,
or build from source:

```bash
git clone https://github.com/overlyhonest/awwdits.git
cd awwdits
npm install
npm run build
```

Then open `chrome://extensions`, turn on Developer mode, choose "Load unpacked", and select
the unzipped folder (or `dist/` if you built it yourself).

## How it works

Open with `Alt+Shift+A`. Hold `Cmd` (or `Ctrl`) and click an element to inspect it, or add
`Shift` to comment on it.

![Commenting on an element](docs/images/comment.png)

Tweak the CSS and every change is tracked as a before and after pair. Comments and changes
persist per page URL.

![Editing an element's CSS](docs/images/edit.png)

Hold `X` and click two elements to measure the gap between them. Awwdits draws both
elements' dimensions and the distance between them, the way Chrome's inspector does. A
third click starts over.

Select any visual: an `<img>`, a CSS background, an inline `<svg>`, a `<canvas>`, or a
`<video>`. The panel shows a preview plus its dimensions, and (for hosted assets) its file
size and a one-click Download Asset.

## What you hand off

Copy from the changes popover. Every note leads with what you need to *find* the element,
and every edit resolves back to what you'd *change* in source:

```
Design-review feedback from the awwdits browser extension. 2 notes on http://localhost:5173/ (light theme, 2026-07-18).

Each block below is one element on the page. The heading, `text:`, and `hook:` lines only locate it (context, not requirements). The `Comment:` or the `prop: before → after` edit is the change to make. Apply each to that one element unless a `scope:` line says all similar elements.

## [1] button.inline-flex.items-center.justify-center
    comp:   Button → button.tsx:8
    text:   "View report"
    border-radius: 7.375px → 20px  (4 corners)
      declared:  var(--radius-md)  via .rounded-md
      chain:     --radius-md = calc(var(--radius) - 2px)  theme.css:109
                 --radius = 0.625rem  theme.css:33

## [2] div.bg-card.text-card-foreground.flex
    comp:   Card → card.tsx:12
    text:   "Starter $9/mo …"
    scope:  all similar elements
    Comment: "increase the radius on these cards"
      layout:    display:flex; flex-direction:column
```

Paste that into a ticket, a PR, or an LLM. Each block **locates** the element: its React
component and source file (`Button → button.tsx:8`), a text snippet, and a stable hook
(`data-testid` / `id` / `aria-label` / `data-slot`), so a person or an agent jumps straight to
it. Each **edit resolves to source**: a token-backed value follows its `var()` chain down to
the file and line you'd actually edit, instead of a leaf pixel that appears nowhere in the
code (`theme.css:109` on a Vite dev server; the filename alone on a production build).
**Comments locate but don't resolve**: they carry layout context and leave interpreting the
CSS to the reader. A **`scope:`** line marks whether a note applies to one element or all like
it. Everything degrades: no design tokens, no framework, or plain HTML falls back to the class
selector and the plain before to after.

![The changes popover](docs/images/changes.png)

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
