/**
 * Detect an edit that landed in the DOM but never took effect on the page.
 *
 * `element.style.setProperty(prop, v, 'important')` always wins the cascade, so
 * the declaration is visibly there in DevTools. Winning the cascade is not the
 * same as taking effect: min-height/max-height (and the width pair) clamp the
 * *used* value afterwards, so the element stays exactly where it was. Without
 * this check the panel reports a successful edit and the page doesn't move,
 * which reads as a broken editor.
 *
 * Only a constraint we can actually name is reported. An element can fail to
 * resize for reasons we can't see from here (flex-basis on a column child, table
 * layout), and blaming a constraint that isn't responsible is worse than saying
 * nothing.
 */

// The properties whose used value a companion min-*/max-* pair can override.
const CLAMPED_BY = {
  height: ['min-height', 'max-height'],
  width:  ['min-width',  'max-width'],
};

// Layout is sub-pixel; anything under half a pixel is noise, not a move.
const EPSILON = 0.5;

export function detectClamp({ property, requested, sizeBefore, sizeAfter, minValue, maxValue }) {
  const limits = CLAMPED_BY[property];
  if (!limits) return null;

  // It moved — whatever else is true, the edit took effect.
  if (Math.abs(sizeAfter - sizeBefore) > EPSILON) return null;

  const want = parseFloat(requested);
  if (!Number.isFinite(want)) return null;              // 'auto', '50%' — nothing to compare
  if (Math.abs(want - sizeAfter) <= EPSILON) return null; // already the requested size

  const [minProp, maxProp] = limits;
  const min = parseFloat(minValue);
  const max = parseFloat(maxValue);
  const effective = `${Math.round(sizeAfter)}px`;

  // Blame the side the request was pushing against.
  if (want > sizeAfter && Number.isFinite(max) && Math.abs(max - sizeAfter) <= EPSILON) {
    return { by: maxProp, byValue: String(maxValue).trim(), effective };
  }
  if (want < sizeAfter && Number.isFinite(min) && Math.abs(min - sizeAfter) <= EPSILON) {
    return { by: minProp, byValue: String(minValue).trim(), effective };
  }
  return null;
}

/** The property that would need overriding to unblock a clamped edit. */
export function clampOverrideProperty(by) {
  return by ? by.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : null;
}
