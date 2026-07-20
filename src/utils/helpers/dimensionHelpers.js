/**
 * Format a computed dimension (width/height) for display as a bare rounded number.
 *
 * Guards on the *parsed* value, not the raw string's truthiness: a computed width
 * can legitimately be a truthy non-numeric keyword ('auto', 'min-content'), which
 * parseFloat turns into NaN — and `Math.round(NaN) + ''` renders the literal
 * "NaN". Anything that doesn't parse to a finite number gets the em-dash instead.
 */
export function formatDimension(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.round(n) + '' : '—';
}

/**
 * Give a typed length a unit so it is valid CSS.
 *
 * Fields display bare numbers ("12"), which is what a user types back. Handed
 * straight to `setProperty('border-top-left-radius', '12')` that is invalid and
 * gets dropped silently — the edit appears to do nothing. Only a lone number is
 * touched; units, percentages, keywords, shorthands and calc() pass through.
 *
 * `unit` of null/'' means bare numbers are already valid here (line-height, where
 * a unitless number is a ratio and appending px would change its meaning).
 */
export function withUnit(value, unit = 'px') {
  const v = String(value ?? '').trim();
  if (!v || !unit) return v;
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(v) ? v + unit : v;
}
