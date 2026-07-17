# Awwdits Design System

Awwdits is a Chrome-extension side panel (~300px content) for reviewing web designs:
comment on elements, tweak the CSS, and export the result. The current direction is
**monochrome, wide-grotesque** — neutral grey surfaces, no chrome accent color, a bold
Special Gothic Expanded One display face, and Tabler icons. It is **dark-only**.

**Source of truth:** [`src/sidebar/tokens.css`](src/sidebar/tokens.css) — role-based
CSS custom properties (shadcn/Radix taxonomy). awwdits is dark-only, so the values live
**unconditionally on `:root`**; any context that loads the file (panel, Storybook, tests)
is dark by construction. Components read them through a thin `var()`-shim,
[`components/redesign/tokens.js`](src/sidebar/components/redesign/tokens.js)
(`COLOR.foreground` → `var(--foreground)`), so inline styles stay semantic — no raw hex
in component code, save a few documented exceptions: the brand mark gradient in
`InspectEmptyState`, the margin accent in `SpacingSection`, and the native color-input
default in `EditorPanel`.

> Scope note: the **empty-state panel + header + tab bar** are fully on this system
> (designed in Figma node `2093:1241`). The **data views**
> (Health dashboard, inspector, editor) still use the earlier semantic-color system
> (see "Semantic" below) and haven't been redesigned to new frames yet.

## Theming
There is none. awwdits is dark-only: no light palette, no toggle, no persistence, no
`data-theme` attribute. Token values sit unconditionally on `:root`. The panel iframe
and App root are `border-radius: 16px`.

## Color (current tokens — values in `tokens.css`)

### Surfaces
**One material.** The panel canvas, the toolbar and the Changes popover are all
`#2D2D30` — awwdits is a single surface with things raised off it, not a dark panel
next to a lighter toolbar.

| Token (JS `COLOR.*` → CSS var) | Dark | Use |
|---|---|---|
| `background` → `--background` | `#2D2D30` | canvas: panel base **and all page-context chrome** |
| `surface` → `--surface` | `#3A3A3D` | raised: pills, active tab, secondary button, count badge, keycap, **and every input** |
| `surfaceHigh` → `--surface-raised` | `#45454A` | higher / innermost (box-model content) |

**Inputs are raised, not recessed.** An edit-screen field, a dropdown and the comment
composer's textarea all sit at `--surface` — the same value as a *selected* toolbar tool,
because an input is an actionable, engaged surface, not a hole. The old
`--surface-recess` (`#181819`) is gone: once the canvas was lifted it read as a punched
hole, and keeping it at `--surface`'s value would have meant two token names for one
colour, which is the drift this system exists to prevent.

The elevation ladder is the toolbar's own, reused everywhere:
`canvas #2D2D30 → hover #37373C → raised #3A3A3D`.

> **Lifting the canvas costs contrast.** Every value above sits on `#2D2D30` now, which
> is lighter than the old `#1D1D20` canvas — so text on it lost ~0.7 of a ratio point.
> That is why `foregroundMuted`/`foregroundWeak` are **icons-only** (see *Text*), and why
> `--border` is `#3E3E40` rather than the old `#2A2A2D`, which would now be *darker* than
> the surface it divides and would have made every section rule vanish.

### Text — two readable levels, and that's the ceiling
| Token | Dark | Contrast on the canvas (`#2D2D30`) | Use |
|---|---|---|---|
| `foreground` | `#F1F1F3` | 12.17:1 | primary text — the values you came to read |
| `foregroundLabel` | `#A4A8B2` | 5.77:1 | **all other text**: labels, breadcrumbs, hints, captions, inactive tabs |
| `foregroundMuted` | `#747984` | 3.15:1 | icons / large glyphs only |
| `foregroundWeak` | `#777C87` | 3.28:1 | resting icons only |
| `foregroundSubtle` | `#4A4A4E` | 1.6:1 | decoration, and deliberately-ghosted *absence* (`0`, `none`, `/`) |

**There is no third text level, by arithmetic.** Below `foregroundLabel` (5.77:1) the
4.5:1 AA floor arrives almost immediately — an "annotation" grey would land near
`#949AA4` (4.85:1), a step too small to see. So secondary meaning is carried by **size,
mono-vs-sans, and strike-through**, never by a dimmer grey. An `ANNOTATION` tier used to
exist in `inspectorStyles.js`; it was dead code and is gone.

> `foregroundMuted` and `foregroundWeak` **fail WCAG AA for normal-size text** (3.15:1 /
> 3.28:1 against 4.5:1). They are icon colors — the toolbar's resting glyphs sit at
> `foregroundWeak`, which is right for a 20px icon and wrong for a 13px label. This is
> enforced, not aspirational: **every** remaining use of either token in the panel is an
> icon (the grip, the breadcrumb caret, the three header buttons, the steppers).
>
> **Known gap:** `foregroundSubtle` (1.6:1) still carries two *ghosted-absence* values —
> a `0` in the box model (`SpacingSection`) and a `none` in a muted `PropRow`. Those are
> text, so they are below AA. It is a deliberate device (a zero should recede so real
> values pop) and it predates the canvas lift, but it is a real gap, not a clean
> exemption. Decoration proper (the dashed box-model rules, the audit dot, the `/`
> breadcrumb separator) is legitimately non-text.

### Borders & interactive-state tokens
| Token | Dark | Note |
|---|---|---|
| `border` | `#3E3E40` | the toolbar's border; must stay *lighter* than the canvas |
| `borderWeak` | `#37373C` | quiet hover surface (tabs, rows), despite the name |
| `borderStrong` | `#4A4A50` | |
| `--surface-hover` | `#43434A` | for elements resting at `--surface` — above it |
| `--surface-active` | `#4B4B52` | |
| `--ring` (focus) | `rgba(255,255,255,.45)` |

### Semantic (data views + on-page findings — never chrome decoration)
`info` (blue `#1A73E8`), `warning` (`#E8A838`), `danger`/destructive (`#E8453A`),
`success`/positive (`#34A853`), each split into `-solid` (fills), `-foreground`
(on-surface text), `-muted` (tinted pill bg). Used by the Health/inspect views:
audit "violation loud / compliant quiet", contrast verdicts, and `gradeColor(score)`
(≥80 positive · 55–79 warning · <55 danger). **Not used in the empty-state chrome.**

On-page element highlights also use these: hovered = `warning`, selected = `info`,
measure target = `success`, measurement rules = `destructive`.

**Badge shades** (`--info-badge #1557B0`, `--warning-badge #8A5A00`,
`--success-badge #1E7E34`) are darker variants of those hues, for the one case where an
accent must carry white text. The `-solid` values cannot: white on `--warning-solid` is
2.08:1 and on `--success-solid` 3.06:1. Each badge shade clears AA (5.14–6.95:1).

### Brand gradient
The empty-state disc mark uses a fixed gradient (theme-independent), reproduced in
CSS from the Figma image fill:
`linear-gradient(135deg, #F7CFEC 0%, #FF3E97 42%, #FF6E77 68%, #FF9A5A 100%)`, with a
white crosshair on top.

### Comment identity (page annotations, not chrome)
Comment pins and their element highlight are magenta — `COMMENT.solid #E6208C`, tint
`#FF8FB1`, gradient `linear-gradient(135deg,#FF8FB1,#E6208C)` (Figma node 2125:2452).
This is **not** the brand gradient: the brand gradient marks the product, this marks a
comment. It lives only on the page (pins, highlight), never in chrome — the Changes
popover's rows are monochrome, since the pencil vs speech-bubble glyph already
distinguishes an edit from a comment.

## Typography
- **Special Gothic Expanded One** (`FONT.display` = `FONT.wordmark`) — wordmark,
  headings, tab labels, button labels. Wide grotesque, single Regular weight.
- **Special Gothic** (`FONT.sans`) — body / supporting UI text ("Medium" ≈ 500).
- **JetBrains Mono** (`FONT.mono`) — all data: hex, px, tokens, code, grades.
- All three loaded via Google Fonts in `index.html`. No serif — `FONT.serif` is a
  back-compat alias of `FONT.display`.
- **Tracking = −1.5%** (`* { letter-spacing: -0.015em }` in `styles.css`; scales per
  element). Uppercase overlines set their own positive tracking inline.

## Icons
**Tabler** (`@tabler/icons-react`), **filled variant** (`Icon…Filled`), re-exported
through [`components/redesign/icons.jsx`](src/sidebar/components/redesign/icons.jsx)
under plain aliases. Pass `size`; icons inherit `currentColor` (filled = `fill`, so
`stroke` is ignored). Figma sizes: mark `current-location` 24 · button `click` 20 ·
header `x` 20 · `pencil`/`check` edit. Chevrons (`chevron-left` back,
`chevron-up`/`down` steppers) and `refresh` (spinner) have no usable filled variant,
so they stay **outline**.

## Interaction states (interface-craft)
The panel is inline-styled, so `styles.css` state rules use `!important` scoped
**only** to `:hover` / `:active` / `:focus-visible` — never the resting state.
- **Focus:** neutral 2px `--ring` on `:focus-visible` (keyboard only), 2px offset.
- **Press:** `scale(0.98)` on `:active` for discrete buttons; navigation (`.awd-nav`)
  and header icon buttons opt out (no shift).
- **Secondary button** `.awd-btn` (e.g. "Pick element manually"): surface lifts to
  `--surface-hover` on hover, `--surface-active` on press; disabled stays at rest.
- **Header icon buttons** `.awd-iconbtn`: glyph brightens to `--foreground` on hover —
  **no background, no press-scale** (keeps header alignment stable).
- **Tabs** `.awd-tab`: subtle `--border-weak` hover; active tab is a neutral
  `--surface` pill with `foreground` label (no accent).
- **Rows** `.awd-row`, **breadcrumb** `.awd-crumb`: quiet hover.

## The empty-state panel (canonical spec)
- **Panel:** 16px radius, `background` canvas, 1px `border`.
- **Header:** fixed **56px**, `padding 0 8px 0 16px`, 1px bottom `border`. Wordmark
  "awwdits" in Special Gothic Expanded One 13px; no right-side controls in this state.
- **Body:** `padding 80px 40px 13px`, centered, entrance fade+rise (`.awd-empty`,
  reduced-motion-guarded). Gaps: 28 (mark → text group), 32 (headline / divider /
  fallback), 12 (within groups).
  - **Mark:** 48px circle, brand gradient bg, white `current-location` 24px.
  - **Headline:** Special Gothic Expanded One 20px / line-height 1.3 / −1.5%.
  - **Subtext:** Special Gothic 13px / 1.6, `foregroundLabel`.
  - **Divider:** full-width 1px `border`.
  - **Pick element manually:** h40 button, `surface` bg + `borderStrong`, radius 8,
    `pl14 pr16`, `click` 20px icon + Special Gothic Expanded One 13px label.
  - **Hint:** Special Gothic 11px, `foregroundLabel`.
- **Bottom tab bar:** 8px padding, 1px top `border`, two equal **text-only** tabs
  (no icons), h40, radius 8, gap 12. Active = `surface` pill + `foreground` label;
  inactive = `foregroundLabel`. Special Gothic Expanded One 12px.

## Page-context overlays (content script)

**Source of truth:** [`src/content/overlayTokens.js`](src/content/overlayTokens.js).
The panel is an iframe that reads `tokens.css`; the overlays render into the *host page*,
which has no awwdits stylesheet, so they import this module instead. It mirrors
`tokens.css` — when that changes, change this too. Nothing page-side may hand-write a
hex or a font stack: [`overlayTokens.test.js`](src/content/overlayTokens.test.js) fails
the build if it does. Genuine non-styling uses (e.g. comparing a page's own computed
color to `#000000`) opt out with a `design-token-exempt` line comment.

**The toolbar is canonical.** Its resting surface defines the chrome — and, since the
canvas was lifted to meet it, the panel too. One surface, one border, no exceptions:

| | Value | Token |
|---|---|---|
| Chrome surface — toolbar, Changes popover, comment card, tooltip, context menu | `#2D2D30` | `--background` |
| Chrome border (the only one) | `#3E3E40` | `--border` |
| Group divider | `#3A3A3D` | `--surface` |
| Row / button hover | `#37373C` | `--border-weak` |
| Active pill, count badge, keycap | `#3A3A3D` | `--surface` |
| Input (comment composer textarea) | `#3A3A3D` | `--surface` |
| Panel iframe backdrop | `#2D2D30` | `--background` |

A popover is the toolbar unfolding, not a hole in the page — and the panel behind it is
the same material again. There is no darker canvas to fall back to any more.

**Type:** the three faces from *Typography* above, via `FONT.display` / `FONT.sans` /
`FONT.mono`. Sizes are `SIZE.sm 11` · `md 12` · `base 13` — nothing else, no fractional
steps. Fonts load through `ensureOverlayFonts()` (idempotent; any overlay may call it),
which requests the same weights as the panel's `index.html` so a glyph renders identically
in both contexts. **Special Gothic ships a single Regular** — any weight but 400 on it
renders synthetic-bold. Only `FONT.mono` has real 500/600.

The 32×32 drag handle lives in the left column outside the iframe, dropped
`margin-top: 28px` and rounded `8px 0 0 8px` so it clears the rounded corners.

## Spacing & radius
`SPACE = { xs:4, sm:8, md:12, lg:16, xl:24 }` (4px grid). `RADIUS = { xs:2, sm:4,
md:8, lg:12 }`; swatches/bars 2, controls 4, cards/tabs/buttons 8, panel 16.

## Data views (earlier system, pending redesign)
Health dashboard, inspector, and editor still use the earlier work: mono data values,
`gradeColor` health, the shared **audit row** (`Overview/AuditRow.jsx` — violations
loud / compliance quiet), **property row** (`Inspector/PropRow.jsx`), monochrome
**box model** (`Inspector/SpacingSection.jsx`), and the single-source **contrast
verdict** (`inspectorStyles.js#contrastVerdict`). These will move to the new visual
system when frames exist.
