/**
 * Convert rgb/rgba string to HEX
 */
export function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent') return null;
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const [, r, g, b] = match.map(Number);
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Parse a color string into {r, g, b, a}
 */
export function parseColor(colorString) {
  if (!colorString) return null;
  const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  return {
    r: parseInt(match[1]),
    g: parseInt(match[2]),
    b: parseInt(match[3]),
    a: match[4] !== undefined ? parseFloat(match[4]) : 1,
  };
}

/**
 * Convert {r, g, b} to HEX string
 */
export function colorObjToHex({ r, g, b }) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Convert HEX to rgb object
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

/**
 * Convert rgb to HSL string
 */
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

/**
 * Blend foreground color (with alpha) over background color
 */
export function blendColors(fg, bg) {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

/**
 * Check if color is transparent/invisible
 */
export function isTransparent(colorString) {
  if (!colorString) return true;
  if (colorString === 'transparent') return true;
  const parsed = parseColor(colorString);
  if (!parsed) return true;
  if (parsed.a === 0) return true;
  return false;
}

/**
 * Get relative luminance per WCAG
 */
export function getLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Get contrast ratio between two colors
 */
export function getContrastRatio(color1, color2) {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * A subtle border for a colour swatch, derived from the swatch colour itself:
 * dark colours get a slightly lighter edge, light colours a slightly darker
 * one — so the swatch stays visible against any background.
 */
export function swatchBorder(value, amount = 42) {
  const rgb = value && value.startsWith('#') ? hexToRgb(value) : parseColor(value);
  if (!rgb) return 'rgba(255,255,255,0.15)';
  const lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b; // 0–255 perceived
  const shift = lum < 128 ? amount : -amount;
  const clamp = v => Math.max(0, Math.min(255, v + shift));
  return `rgb(${clamp(rgb.r)}, ${clamp(rgb.g)}, ${clamp(rgb.b)})`;
}

/**
 * Format hex for display (uppercase, with #)
 */
export function formatHex(hex) {
  if (!hex) return '';
  return hex.startsWith('#') ? hex.toUpperCase() : '#' + hex.toUpperCase();
}
