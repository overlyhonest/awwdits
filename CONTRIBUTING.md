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

- Sidebar components avoid raw hex. Colors and fonts come from the `COLOR` / `FONT` shim
  in `src/sidebar/components/redesign/tokens.js`. The documented exceptions are the brand
  mark gradient, data-viz accents, and native color-input defaults.
- Content-script overlays have their own shim. They render into the host page, which has
  no awwdits stylesheet, so they import `src/content/overlayTokens.js` rather than reading
  `tokens.css`. The two mirror each other: change one, change the other.
  `overlayTokens.test.js` fails `npm test` if any page-side `.js` file hand-writes a hex
  or a font family. Note the limits: it does not run on `npm run build`, and it scans
  `src/content/*.js` only, so `content-styles.css` mirrors the font stack by hand and is
  unguarded. Genuine non-styling uses (say, comparing a page's own computed color) opt out
  with a `design-token-exempt` comment on the line.

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
