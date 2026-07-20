/**
 * Does `gap` mean anything for this element?
 *
 * Only flex and grid containers space their children with `gap`. Keying the gap
 * control off the *current* gap value instead hid it on every container that
 * didn't already have one — exactly the case where you want to add a gap.
 */
export function isGapContainer(display) {
  return /(^|\s|-)(flex|grid)$/.test(String(display || '').trim());
}
