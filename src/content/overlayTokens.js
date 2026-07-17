// Page-context design tokens — the single source of truth for every awwdits overlay
// that renders into the host page (toolbar, popovers, tooltip, context menu, pins,
// highlights, measurement canvas).
//
// Why this file exists: the panel is an iframe and reads tokens.css through the
// var()-shim in components/redesign/tokens.js. Page-context overlays have no
// stylesheet of their own, so they used to restate hex by hand — which drifted into
// 43 distinct colors, four near-identical blacks, and three typefaces that were never
// part of the brand. Everything page-side now imports from here instead.
//
// The TOOLBAR IS CANONICAL. Its resting surface defines the chrome; every other
// floating surface matches it exactly. Values mirror src/sidebar/tokens.css — when
// that file changes, change this one.

// ── Chrome ────────────────────────────────────────────────────────────────────
// One surface, one border. Every floating overlay uses these — no exceptions.
export const COLORS = {
  bg: '#2d2d30',      // --background        all floating chrome AND the panel canvas
  border: '#3e3e40',  // --border            the only chrome border
  divider: '#3a3a3d', // --surface           hairline between groups; lighter than bg so it reads

  // The panel iframe's backdrop. Same value as `bg` now that the canvas was lifted to
  // meet the toolbar, but kept separate because it tracks the panel's `--background`.
  panelBg: '#2d2d30',

  // Text. Contrast is measured against `bg` (#2d2d30) — respect the split below.
  fg: '#f1f1f3',      // --foreground        primary text                 12.17:1
  label: '#a4a8b2',   // --foreground-label  ANY text under ~14px          5.77:1 (AA)
  muted: '#747984',   // --foreground-muted  icons/glyphs ONLY             3.15:1 (AA-large)
  weak: '#777c87',    // --foreground-weak   resting icons ONLY            3.28:1 (AA-large)

  hover: '#37373c',   // --border-weak       button/row hover
  active: '#3a3a3d',  // --surface           selected tool, keycap, INPUTS

  // The count badge sits *inside* the Changes chip, so it must stay legible against
  // three different backdrops: the bar at rest, `hover`, and `active` when the popover
  // is open. An opaque value can't — #3a3a3d on `hover` (#37373c) is a 3/255 delta, and
  // on `active` it vanishes outright. Alpha-white composites over whatever is behind it
  // and keeps its contrast in every state.
  badge: 'rgba(255,255,255,.10)',

  danger: '#f28b82',        // --destructive-foreground
  dangerMuted: 'rgba(232,69,58,0.16)', // --destructive-muted
};

// `muted`/`weak` fail WCAG AA for normal-size text on `bg` (3.15:1 / 3.28:1). They are
// for icons and large glyphs only. Any text under ~14px uses `label` or `fg`.

// ── Accents (data findings: hover / selected / measure) ───────────────────────
// Hues come from tokens.css (--info-solid, --warning-solid, --success-solid,
// --destructive-solid). The `*Badge` shades are darker variants of the SAME hue,
// added because the solids cannot carry white text — --warning-solid is 2.08:1 and
// --success-solid 3.06:1 against white. Each badge shade clears 4.5:1.
export const ACCENT = {
  info: '#1a73e8',            // --info-solid          selected element
  infoMuted: 'rgba(26,115,232,0.10)',
  infoBadge: '#1557b0',       // --info-badge          white text 6.95:1

  warning: '#e8a838',         // --warning-solid       hovered element
  warningMuted: 'rgba(232,168,56,0.10)',
  warningBadge: '#8a5a00',    // --warning-badge       white text 5.93:1

  success: '#34a853',         // --success-solid       measure target
  successMuted: 'rgba(52,168,83,0.10)',
  successBadge: '#1e7e34',    // --success-badge       white text 5.14:1

  destructive: '#e8453a',     // --destructive-solid   measurement rules

  onAccent: '#ffffff',        // text on any *Badge fill — not a theme role
};

// ── Comment identity ─────────────────────────────────────────────────────────
// Pins and their element highlight. Magenta is deliberate (Figma comment convention,
// design node 2125:2452) and is NOT the brand gradient — the brand gradient marks the
// product, this marks a comment. Kept as its own identity, now tokenized.
export const COMMENT = {
  solid: '#e6208c',
  tint: '#ff8fb1',
  muted: 'rgba(230,32,140,0.08)',
  gradient: 'linear-gradient(135deg,#ff8fb1 0%,#e6208c 100%)',
  onPin: '#ffffff', // the pin's index numeral, on the gradient
};

// ── Type ─────────────────────────────────────────────────────────────────────
// Three faces, matching DESIGN_SYSTEM.md: display for labels, sans for prose,
// mono for data (hex, px, selectors, dimensions). Nothing else.
export const FONT = {
  display: '"Special Gothic Expanded One","Arial",sans-serif', // labels, titles
  sans: '"Special Gothic",system-ui,sans-serif',               // prose, body
  mono: '"JetBrains Mono",ui-monospace,monospace',             // all data
};

// Only these sizes. 11 = dense data, 12 = secondary, 13 = body/label.
export const SIZE = { sm: '11px', md: '12px', base: '13px' };

// Loaded weights, page-context. Special Gothic faces ship a single Regular, so ANY
// weight other than 400 on them renders synthetic-bold. JetBrains Mono has 400/500/600.
export const WEIGHT = { regular: 400, medium: 500, semibold: 600 };

// ── Font loading ─────────────────────────────────────────────────────────────
// The overlays live in the host page, which has no awwdits stylesheet. Idempotent —
// every overlay may call it. Weights match src/sidebar/index.html so a glyph renders
// identically in the panel and on the page.
const FONT_LINK_ID = 'awwdits-overlay-fonts';
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Special+Gothic+Expanded+One&family=Special+Gothic&family=JetBrains+Mono:wght@400;500;600&display=swap';

export function ensureOverlayFonts() {
  if (document.getElementById(FONT_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = FONT_LINK_ID;
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  (document.head || document.documentElement).appendChild(link);
}
