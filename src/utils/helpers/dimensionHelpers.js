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
