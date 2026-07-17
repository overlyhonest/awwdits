# Bundled fonts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship awwdits' three brand faces inside the extension so they survive a strict host-page CSP, and stop requesting Google Fonts from every reviewed page.

**Architecture:** Three latin-subset woff2 files go in `public/fonts/` (Vite copies `public/` verbatim, as it already does for `icons/`). The page overlay declares `@font-face` with `chrome.runtime.getURL()` URLs; the sidebar iframe — being extension-origin — uses plain relative URLs in its CSS. No build-step changes.

**Tech Stack:** Chrome MV3, vanilla JS content script, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-17-bundled-fonts-design.md`

## Global Constraints

- Content-script overlays use explicit hex/font values from `src/content/overlayTokens.js` — never CSS vars, never Tailwind. `overlayTokens.test.js` fails the build on any hex or literal font family declared in another `src/content/*.js` file. `overlayTokens.js` itself is exempt; the sidebar is not scanned.
- Font family names must stay byte-identical to today's stacks, or the drift guard and the rendering both break. The exact current values:
  - display: `"Special Gothic Expanded One"`, sans: `"Special Gothic"`, mono: `"JetBrains Mono"`
- `ensureOverlayFonts()` must stay idempotent — every overlay calls it.
- Tests run with `npm test`; build with `npm run build`.
- Do NOT touch `injectGoogleFont` (`src/content/content-script.js:30-40`) — out of scope per the spec.

## Font files (already downloaded, verified real woff2)

Staged at `/private/tmp/claude-501/-Users-jaseem-awwdits/a627b69e-8033-4097-8d4a-049230ef5e92/scratchpad/fonts/`:

| File | Family | Weights | Size |
|---|---|---|---|
| `special-gothic-expanded-one-latin.woff2` | Special Gothic Expanded One | 400 | 18,008 B |
| `special-gothic-latin.woff2` | Special Gothic | 400 | 18,228 B |
| `jetbrains-mono-latin.woff2` | JetBrains Mono | 400–700 (variable) | 31,340 B |

JetBrains Mono is a **variable** font: Google serves one woff2 for 400/500/600/700. Its `@font-face`
therefore uses a `font-weight: 400 700` range, NOT four separate faces.

---

### Task 1: Add the font assets, licence, and manifest entry

**Files:**
- Create: `public/fonts/{special-gothic-expanded-one-latin,special-gothic-latin,jetbrains-mono-latin}.woff2`
- Create: `public/fonts/OFL.txt`, `public/fonts/README.md`
- Modify: `manifest.json` (`web_accessible_resources`)

**Interfaces:**
- Produces: the three fonts resolvable at runtime as `chrome.runtime.getURL('fonts/<name>.woff2')`, and relative `./fonts/<name>.woff2` from the sidebar iframe.

- [ ] **Step 1: Copy the fonts in**

```bash
mkdir -p public/fonts
cp /private/tmp/claude-501/-Users-jaseem-awwdits/a627b69e-8033-4097-8d4a-049230ef5e92/scratchpad/fonts/*.woff2 public/fonts/
ls -l public/fonts/
```
Expected: three `.woff2` files, sizes matching the table above.

- [ ] **Step 2: Add the OFL licence text**

Both families are OFL-1.1; redistribution requires the licence travel with them.

```bash
curl -sL -o public/fonts/OFL.txt https://openfontlicense.org/documents/OFL.txt
head -3 public/fonts/OFL.txt
wc -l public/fonts/OFL.txt
```
Expected: a real licence file (~90+ lines) beginning with the SIL Open Font License header. If that
URL 404s, take the canonical text from the JetBrains Mono repo
(`https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/OFL.txt`) instead. Verify it is
the licence and not an error page before committing.

- [ ] **Step 3: Record provenance**

Create `public/fonts/README.md` verbatim:

```markdown
# Bundled fonts

Latin subsets, fetched from Google Fonts and vendored so they load from the extension
rather than the network. Loading them from `fonts.googleapis.com` meant the host page's
CSP governed the request — strict-CSP sites (GitHub and friends) blocked it and the UI
silently fell back to Arial — and it sent a request to Google from every page reviewed.

| File | Family | Weights |
|---|---|---|
| `special-gothic-expanded-one-latin.woff2` | Special Gothic Expanded One | 400 |
| `special-gothic-latin.woff2` | Special Gothic | 400 |
| `jetbrains-mono-latin.woff2` | JetBrains Mono | 400–700 (variable) |

Latin subset only: awwdits' own chrome is English. Page-derived text renders in the
panel and falls back through the stack normally.

Both families are licensed under the SIL Open Font License 1.1 — see `OFL.txt`.
```

- [ ] **Step 4: Expose the fonts to the page context**

In `manifest.json`, the existing `web_accessible_resources[0].resources` array is
`["sidebar.html", "sidebar.js", "sidebar.css", "*.js", "*.css"]`. Add the fonts — `*.css` does NOT
cover `.woff2`, and the page context can't reference them without this:

```json
"resources": ["sidebar.html", "sidebar.js", "sidebar.css", "*.js", "*.css", "fonts/*.woff2"],
```

- [ ] **Step 5: Verify the build ships them**

```bash
npm run build && ls -l dist/fonts/
```
Expected: the three woff2 files present in `dist/fonts/`, same sizes. (Vite copies `public/`
verbatim; no config change needed — `dist/icons/` already proves the mechanism.)

- [ ] **Step 6: Commit**

```bash
git add public/fonts manifest.json
git commit -m "assets: vendor the three brand fonts

Latin-subset woff2 for Special Gothic Expanded One, Special Gothic, and
JetBrains Mono (variable, 400-700). Loading these from Google meant the
host page's CSP governed the request, so strict-CSP sites blocked them
and the UI fell back to Arial -- and every reviewed page pinged Google.

OFL-1.1, licence included per its redistribution terms."
```

---

### Task 2: Load the overlay fonts from the extension

`ensureOverlayFonts()` currently injects a `<link>` to Google into the host page, where the page's CSP
kills it. Replace with a `<style>` carrying `@font-face` rules that point at extension URLs.

**Files:**
- Modify: `src/content/overlayTokens.js:104-115`

**Interfaces:**
- Consumes: `fonts/*.woff2` from Task 1.
- Produces: `ensureOverlayFonts()` — unchanged name, signature (none), and idempotency. Call sites
  (`toolbar.js`, and any other overlay) are untouched.

- [ ] **Step 1: Replace the loader**

Replace `src/content/overlayTokens.js:104-115` (the `FONT_LINK_ID`/`FONT_HREF` consts and
`ensureOverlayFonts`) with:

```js
const FONT_STYLE_ID = 'awwdits-overlay-fonts';

// The families are vendored (see public/fonts/README.md) and loaded from the extension,
// NOT from Google. The overlays live in the host page, so a <link> to fonts.googleapis.com
// was governed by the PAGE's CSP: strict-CSP sites (GitHub: font-src github.githubassets.com)
// blocked it and every face silently fell back to Arial. Extension URLs sidestep the page's
// policy, and nothing is requested from a third party.
//
// JetBrains Mono is a variable font — one file serves 400-700, hence the weight range rather
// than four faces. The Special Gothic families ship Regular only.
const FACES = [
  { family: 'Special Gothic Expanded One', file: 'special-gothic-expanded-one-latin.woff2', weight: '400' },
  { family: 'Special Gothic',              file: 'special-gothic-latin.woff2',              weight: '400' },
  { family: 'JetBrains Mono',              file: 'jetbrains-mono-latin.woff2',              weight: '400 700' },
];

export function ensureOverlayFonts() {
  if (document.getElementById(FONT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = FONT_STYLE_ID;
  style.textContent = FACES.map(f => `@font-face{font-family:'${f.family}';` +
    `src:url('${chrome.runtime.getURL('fonts/' + f.file)}') format('woff2');` +
    `font-weight:${f.weight};font-style:normal;font-display:swap;}`).join('');
  (document.head || document.documentElement).appendChild(style);
}
```

- [ ] **Step 2: Verify the drift guard and suite still pass**

```bash
npm test
```
Expected: PASS. The literal family names live in `overlayTokens.js`, which `overlayTokens.test.js`
exempts (`f !== TOKENS_FILE`) — but run it, don't assume. If it fails, read the failure: the guard
also forbids hex, and this change introduces none.

- [ ] **Step 3: Verify the built output references extension URLs, not Google**

```bash
npm run build
grep -c "fonts.googleapis" dist/content-script.js || echo "0 — no Google reference in the content script"
grep -o "fonts/[a-z-]*\.woff2" dist/content-script.js | sort -u
```
Expected: `injectGoogleFont`'s dynamic URL is the ONLY `fonts.googleapis` reference that may remain
in `dist/content-script.js` (it is out of scope and must stay). The three `fonts/*.woff2` names must
appear.

- [ ] **Step 4: Commit**

```bash
git add src/content/overlayTokens.js
git commit -m "fix: load overlay fonts from the extension, not Google

ensureOverlayFonts injected a <link> to fonts.googleapis.com into the
HOST page, so the page's CSP governed it. GitHub's style-src and font-src
both reject it, so every overlay face fell back to Arial -- and every
reviewed page sent a request to Google.

Declare @font-face against chrome.runtime.getURL() instead."
```

---

### Task 3: Load the sidebar fonts from the extension

The iframe is extension-origin, so its `<link>` to Google works today — but it still pings Google and
means two different font mechanisms. Relative URLs resolve against the extension here, so no
`chrome.runtime.getURL` is needed.

**Files:**
- Modify: `src/sidebar/index.html` (remove three `<link>`s)
- Modify: `src/sidebar/styles.css` (add `@font-face`)

**Interfaces:**
- Consumes: `fonts/*.woff2` from Task 1.
- The stacks in `src/sidebar/components/redesign/tokens.js` are NOT changed — the family names
  already match.

- [ ] **Step 1: Drop the Google links**

In `src/sidebar/index.html`, delete these three lines from `<head>`:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Special+Gothic+Expanded+One&family=Special+Gothic&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Declare the faces in CSS**

`src/sidebar/styles.css` begins with the three `@tailwind` directives. Insert **after** them and
before the `/* Design tokens … */` comment:

```css
/* Fonts are vendored and served from the extension (see public/fonts/README.md) — the
   panel and the page-side overlays must render a glyph identically, and neither should
   depend on a third-party request. This iframe is extension-origin, so relative URLs
   resolve without chrome.runtime.getURL. JetBrains Mono is variable: one file, 400-700. */
@font-face {
  font-family: 'Special Gothic Expanded One';
  src: url('/fonts/special-gothic-expanded-one-latin.woff2') format('woff2');
  font-weight: 400; font-style: normal; font-display: swap;
}
@font-face {
  font-family: 'Special Gothic';
  src: url('/fonts/special-gothic-latin.woff2') format('woff2');
  font-weight: 400; font-style: normal; font-display: swap;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('/fonts/jetbrains-mono-latin.woff2') format('woff2');
  font-weight: 400 700; font-style: normal; font-display: swap;
}
```

- [ ] **Step 3: Verify the URL actually resolves in the built panel**

This is the step most likely to be wrong — Vite may rewrite or hash the URL, and the sidebar is
loaded as `chrome-extension://<id>/sidebar.html`, so a root-relative `/fonts/…` must resolve to the
extension root.

```bash
npm run build
grep -o "fonts/[a-z-]*\.woff2" dist/sidebar.css | sort -u
grep -c "fonts.googleapis" dist/sidebar.html || echo "0 — sidebar.html is clean"
ls dist/fonts/
```
Expected: the three font names appear in `dist/sidebar.css`; `dist/sidebar.html` has no Google
reference; `dist/fonts/` holds the files. **If Vite rewrote the paths to something like
`/assets/…`, stop and report** — the fix is then to reference them relative to the CSS file
(`../fonts/…`) or to let Vite fingerprint them via an import. Do not guess; check the emitted CSS.

- [ ] **Step 4: Commit**

```bash
git add src/sidebar/index.html src/sidebar/styles.css
git commit -m "fix: load sidebar fonts from the extension, not Google

The panel is extension-origin so its <link> to Google worked, but it
still sent a request to a third party on every open and left awwdits
with two different font mechanisms. Declare the vendored faces in CSS;
relative URLs resolve against the extension here."
```

---

### Task 4: Verify against a real strict-CSP page

**This is the task the whole design rests on** and it cannot be skipped or simulated. The spec's
central assumption — that a `chrome-extension://` font clears a strict `font-src` — is UNVERIFIED. A
headless probe was attempted and failed; the answer is unknown until this runs.

**Files:** none — manual.

- [ ] **Step 1: Load the built extension**

```bash
npm run build
```
Then `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

- [ ] **Step 2: The decisive check**

Open **github.com** (CSP: `font-src github.githubassets.com` — no third-party fonts permitted) and
press `Alt+Shift+A`.

Look at the toolbar's **"Changes"** label:
- **Wide, squared-off display face** → the assumption holds. Bundling works. Done.
- **Plain Arial** → the assumption is WRONG. Page CSP blocks extension fonts too. **Stop and report**
  — the fix becomes moving the toolbar into an extension-origin iframe, which is a new design, not a
  patch. The sidebar and privacy wins still stand.

Open DevTools → Network, filter `font`, and confirm the woff2 loads from `chrome-extension://…`.
Check the Console for CSP violations naming the font.

- [ ] **Step 3: Confirm nothing regressed on a permissive page**

Open a site with no strict CSP (e.g. `example.com`) and confirm the toolbar and panel render in the
brand faces exactly as before — this change must be invisible where things already worked.

- [ ] **Step 4: Confirm the Google request is gone**

With awwdits open on any page, DevTools → Network, filter `googleapis`. Expected: **no request**,
unless you have edited a `font-family` to a Google family (that is `injectGoogleFont`, deliberately
out of scope).

- [ ] **Step 5: Report honestly**

State which of Step 2's two outcomes actually occurred. Do not claim the fix works without having
looked at the label.
