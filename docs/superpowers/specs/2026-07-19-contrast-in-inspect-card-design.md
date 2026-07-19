# Contrast in the inspect card — design

**Date:** 2026-07-19
**Status:** Design approved; ready for implementation plan.

## Summary

When you inspect a text element, the on-page card ([`contextMenu.js`](../../../src/content/contextMenu.js))
already shows Font, Line height, text Color, and BG. It stops one step short of the thing a designer
actually needs to judge: **does this text pass contrast?** This spec adds a single **Contrast** row —
the WCAG ratio plus a color-coded grade pill — computed from colors the card is already reading.

No new contrast math is written: the analyzer already exists.

## What already exists

- **`checkContrast(element)`** ([`src/utils/analyzers/contrastChecker.js`](../../../src/utils/analyzers/contrastChecker.js))
  walks up the DOM to the effective background, blends alpha, applies the large-text WCAG thresholds,
  and returns:
  - `ratioLabel` — e.g. `"4.62:1"`
  - `grade` — `"AAA"` | `"AA"` | `"Fail"` (already accounts for the element's own size/weight)
  - `status` — `"good"` | `"warning"` | `"error"`
  - (plus `ratio`, `textColor`, `bgColor`, `AA`, `AAA`, `isLargeText` — unused here)
- **The card's row-builder pattern** — `dimRow`, `labelRow`, `colorRow` in `contextMenu.js`, each
  returning an HTML string; `populate()` concatenates them into `menuEl.innerHTML` on every hover.
- **Overlay accent tokens** ([`src/content/overlayTokens.js`](../../../src/content/overlayTokens.js)) —
  `ACCENT.success` / `successMuted`, `ACCENT.warning` / `warningMuted`, `COLORS.danger` / `dangerMuted`.

The feature is therefore: **one row builder + a status→color mapping + a guarded call site.**

## Design

### 1. The Contrast row

A new row builder, in the same style as `colorRow`/`labelRow`:

```
Contrast     4.62:1  ‹AA›
```

- Label column: `Contrast`, using the existing `COLORS.label` / sans / `width:68px` treatment.
- Value: `ratioLabel` in mono at `COLORS.fg` — same weight and color as every other data value, so
  the row reads as data, not an alarm.
- Pill: the `grade` text (`AAA`/`AA`/`Fail`) in a small tinted chip. The **verdict color lives only in
  the pill**, keeping the row quiet.

### 2. Pill treatment — tinted, not filled

A rounded chip: `border-radius` ~5px, padding ~`1px 5px`, mono `SIZE.sm` (11px) `WEIGHT.medium` —
the same material language as the keycap chips, reinforcing "the grade is data." Tinted (muted fill +
accent text) rather than a filled white-text badge, to sit calmly on the dark card.

Color comes from `status`, via a **pure helper** `contrastPillStyle(status)`:

| `status`  | meaning                        | pill background        | pill text        |
|-----------|--------------------------------|------------------------|------------------|
| `good`    | passes AA (grade AA or AAA)    | `ACCENT.successMuted`  | `ACCENT.success` |
| `warning` | fails AA but ≥ 3:1 (marginal)  | `ACCENT.warningMuted`  | `ACCENT.warning` |
| `error`   | below 3:1                      | `COLORS.dangerMuted`   | `COLORS.danger`  |

Note `grade` and `status` can diverge on the marginal band: a 3.5:1 normal-size result is
`grade:"Fail"`, `status:"warning"` → a **yellow "Fail" pill**. That is intended — it distinguishes
"close" from "clearly failing" without adding a fourth state. The pill text always mirrors `grade`;
the tint always mirrors `status`.

All three accent colors clear ~4.5:1 against the card surface `#2d2d30` (green ≈ 4.5, yellow ≈ 6.8,
`danger` #f28b82 ≈ 6), so the pill text stays legible over its own tint (which is ~10–16% opacity
over that same surface).

### 3. Call site & guard

In `populate()`, after the Color and BG rows and before Radius:

```js
if (hasText) {
  const c = checkContrast(el);
  if (c) detail.push(contrastRow(c.ratioLabel, c.grade, c.status));
}
```

- Gated on `hasText` (the same flag that already gates Font and text Color) — contrast is a
  text-only property.
- If `checkContrast` returns `null` (unparseable text color or background), the row is **silently
  omitted** — no "N/A", no empty row.
- `checkContrast` re-reads `getComputedStyle(el)` and walks ancestors. This runs on hover, once per
  card population, same as the existing single `getComputedStyle(el)` call — the extra ancestor walk
  is shallow and acceptable. Not worth threading the already-computed `cs` in.

### 4. Import

Add to `contextMenu.js`:

```js
import { checkContrast } from '../utils/analyzers/contrastChecker.js';
```

Vite bundles the content script, so the ESM import across `src/content/` → `src/utils/analyzers/`
resolves normally (the analyzer's own imports of `colorHelpers`/`constants` already do).

## Known limitation (ship anyway; note in code)

`getBackgroundColor` in the analyzer reads only `background-color`, never `background-image`. Text over
a photo or gradient is measured against the nearest **solid** ancestor, defaulting to white. The
reported ratio can therefore be wrong for image/gradient backgrounds. This matches Chrome DevTools'
own contrast behavior; we do **not** sample rendered pixels. A one-line comment at the call site
records this so a future reader doesn't mistake it for a bug.

## Testing

`contextMenu.js` has no tests today; the DOM-dependent parts (`getComputedStyle`, positioning) are why.
This change adds a small **DOM-free** seam that is worth covering:

- **`contrastPillStyle(status)`** — pure `status → {bg, fg}` map. Unit-test all three statuses plus an
  unexpected/`undefined` status (should fall back to a safe default, e.g. the `error` styling, never
  throw). This is the new logic most likely to drift.
- **`contrastRow(ratioLabel, grade, status)`** — assert the returned HTML string contains the ratio,
  the grade text, and the status-mapped colors. Cheap regression guard on the template.

The `hasText`/`null` guards live in `populate()` (DOM-bound) and are verified manually on the built
extension rather than unit-tested.

## Manual verification

On the built extension, hover text elements and confirm:

1. Passing dark-on-light text → ratio + **green** AA/AAA pill.
2. Light-gray placeholder text → ratio + **yellow** or **red** pill per band.
3. A non-text element (e.g. a bare `<div>` spacer) → **no** Contrast row.
4. Text with a transparent background chain → row still appears, measured against the resolved
   ancestor/white.

## Out of scope (YAGNI)

- Any AA/AAA target toggle — the grade already reflects the text's real size threshold.
- "Suggested passing color" or auto-fix.
- A separate contrast panel or sidebar surface.
- Pixel-sampling for image/gradient backgrounds (see Known limitation).
