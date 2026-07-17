# Bundled fonts — design

**Date:** 2026-07-17
**Status:** Design approved; ready for implementation plan.

## Summary

awwdits loads its brand faces from Google Fonts at runtime. On the page side that request is
governed by **the host page's CSP**, not the extension's — so on any strict-CSP site the fonts never
arrive and the toolbar silently falls back to Arial. Bundling the fonts inside the extension fixes
that and removes a third-party request from every page a user reviews.

## The bug

Reported as "why is the Changes font broken?" on GitHub. Nothing regressed — it has never worked
there.

`ensureOverlayFonts()` (`src/content/overlayTokens.js:108-115`) injects

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Special+Gothic…">
```

into **the host page's DOM**. GitHub's live CSP:

```
default-src 'none'
style-src   'unsafe-inline' github.githubassets.com
font-src    github.githubassets.com
```

Two independent blocks, either one fatal: `style-src` rejects the Google Fonts stylesheet, and
`font-src` would reject the `fonts.gstatic.com` woff2 even if the stylesheet loaded. With
`'Special Gothic Expanded One'` unavailable, the browser walks the stack at
`overlayTokens.js:88` and lands on **Arial**.

This affects every strict-CSP site (GitHub, GitLab, Linear, most admin/banking apps) and all three
faces, not just the one label.

## Second motivation: privacy

Because the `<link>` goes into the host page, **every page a user opens awwdits on makes a request to
`fonts.googleapis.com`**, handing Google the origin of the site being reviewed. For a GPL extension
run against internal tools, that is an undocumented and unintended property. Bundling removes the
request entirely.

## The three font-loading sites

| Site | Purpose | In scope |
|---|---|---|
| `src/content/overlayTokens.js:106` | awwdits' own chrome, injected into the page | **Yes** — the bug |
| `src/sidebar/index.html:7-9` | awwdits' own chrome, inside the iframe | **Yes** — works today (extension origin) but still pings Google |
| `src/content/content-script.js:30-40` | `injectGoogleFont` — loads a **user-chosen** family when editing `font-family` | **No** — see below |

`injectGoogleFont` fetches whatever family the user types into the editor. The set is unbounded, so
there is nothing to pre-bundle; it needs the network by nature and stays CSP-blocked on strict sites.
That is inherent, not a defect this spec addresses. **Out of scope.**

## What gets bundled

Latin subsets only. JetBrains Mono ships as a **variable** font — Google serves the same woff2 for
weights 400/500/600/700 — so one file covers every weight awwdits uses.

| File | Covers | Size |
|---|---|---|
| `special-gothic-expanded-one-latin.woff2` | display 400 | 18,008 B |
| `special-gothic-latin.woff2` | sans 400 | 18,228 B |
| `jetbrains-mono-latin.woff2` | mono 400–700 (variable) | 31,340 B |
| **Total** | | **~66 KB** |

For reference the whole v1.0.0 zip is 89 KB, so this roughly doubles it — acceptable for removing a
network dependency and a privacy leak.

**Latin-only is a deliberate limitation.** Google offers cyrillic/greek/vietnamese/latin-ext subsets;
shipping them all would multiply the size. awwdits' own chrome is English-only (`Inspect`,
`Comment`, `Measure`, `Changes`), and the only non-Latin text it renders is *page-derived* content in
the panel — which lives in the iframe and falls back through the stack normally. If a future UI is
localised, revisit.

## Design

### 1. Font assets

Add to `public/fonts/` (Vite copies `public/` to `dist/` verbatim, as it already does for `icons/`).

### 2. Manifest

Add the fonts to `web_accessible_resources` so the page context can reference them by
`chrome-extension://` URL. The existing entry already matches `<all_urls>`; add `fonts/*.woff2`.

### 3. Page overlay — `ensureOverlayFonts()`

Replace the `<link>` to Google with an injected `<style>` carrying `@font-face` rules whose `src` is
`chrome.runtime.getURL('fonts/…')`. Keep the existing id-guard so it injects once. The function's
signature and call sites do not change.

### 4. Sidebar iframe

Delete the three `<link>`s from `src/sidebar/index.html`. Declare the same `@font-face` rules in
CSS; the iframe is extension-origin, so **relative** URLs resolve without `chrome.runtime.getURL`.

### 5. Licensing

Both families are **OFL-1.1**, which permits redistribution but requires the licence travel with the
fonts. Add `public/fonts/OFL.txt` and a line in `CONTRIBUTING.md` or the fonts directory recording
where the files came from and under what terms. The project is GPL-3.0-or-later; OFL fonts are
compatible as bundled assets.

## Known risk — the unverified assumption

This design assumes **a `chrome-extension://` font clears a strict `font-src`**, i.e. that
`web_accessible_resources` are exempt from the host page's CSP. That is the widely-used pattern and
is very likely correct, but **it was NOT verified** — an attempt to probe it headlessly failed
(Chrome-with-extensions would not run reliably headless), and the user declined to run the probe
manually.

**If the assumption is wrong:** the sidebar fix and the privacy win still land, but the toolbar stays
Arial on strict-CSP sites and the real fix becomes moving the toolbar into a small extension-origin
iframe (rejected in the toolbar-widget-model spec for full-viewport overlays, but viable for a
discrete toolbar rect — with popover clipping as the trade-off).

**This is falsifiable in seconds:** load the built extension on github.com and look at the toolbar.
The implementation plan MUST make that its final step, and the result must be reported honestly
rather than assumed.

## Out of scope

- `injectGoogleFont` (user-chosen families) — inherent, see above.
- Non-Latin subsets.
- Moving the toolbar into an iframe (only if the assumption above fails).
