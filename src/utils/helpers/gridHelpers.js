/**
 * Spacing-grid helpers. A spacing value is "on-grid" when it's a whole
 * multiple of the detected base step (8px for an 8pt scale, 4px for a 4pt
 * scale, 4px as a lenient default when no consistent scale was detected).
 */
export function gridBase(scaleDetected) {
  if (scaleDetected === '8pt') return 8;
  if (scaleDetected === '4pt') return 4;
  return 4;
}

export function isOnGrid(value, base) {
  const num = parseFloat(value);
  if (isNaN(num)) return true; // non-numeric (e.g. %) — don't flag
  return num % base === 0;
}
