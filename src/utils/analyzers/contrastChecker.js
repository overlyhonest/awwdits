import { parseColor, getLuminance, getContrastRatio, colorObjToHex } from '../helpers/colorHelpers.js';
import { WCAG } from '../constants.js';

/**
 * Get effective background color by walking up DOM tree
 */
function getBackgroundColor(element) {
  let current = element;

  while (current && current !== document.documentElement) {
    const bg = getComputedStyle(current).backgroundColor;
    if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
      current = current.parentElement;
      continue;
    }
    const parsed = parseColor(bg);
    if (!parsed || parsed.a === 0) {
      current = current.parentElement;
      continue;
    }
    if (parsed.a < 1 && current.parentElement) {
      const parentBg = getBackgroundColor(current.parentElement);
      return blendColors(parsed, parentBg);
    }
    return parsed;
  }

  return { r: 255, g: 255, b: 255, a: 1 };
}

function blendColors(fg, bg) {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  };
}

/**
 * Check contrast for an element
 */
export function checkContrast(element) {
  if (!element) return null;
  const computed = getComputedStyle(element);
  const textColorParsed = parseColor(computed.color);
  const bgColor = getBackgroundColor(element);

  if (!textColorParsed || !bgColor) return null;

  const ratio = getContrastRatio(textColorParsed, bgColor);
  const fontSize = parseFloat(computed.fontSize);
  const fontWeight = parseInt(computed.fontWeight);
  const isLargeText =
    fontSize >= WCAG.LARGE_TEXT_SIZE ||
    (fontSize >= WCAG.LARGE_TEXT_BOLD_SIZE && fontWeight >= WCAG.LARGE_TEXT_BOLD_WEIGHT);

  const aaRequired = isLargeText ? WCAG.AA_LARGE : WCAG.AA_NORMAL;
  const aaaRequired = isLargeText ? WCAG.AAA_LARGE : WCAG.AAA_NORMAL;

  return {
    ratio: parseFloat(ratio.toFixed(2)),
    ratioLabel: `${ratio.toFixed(2)}:1`,
    textColor: colorObjToHex(textColorParsed),
    bgColor: colorObjToHex(bgColor),
    fontSize,
    fontWeight,
    isLargeText,
    AA: {
      required: aaRequired,
      passes: ratio >= aaRequired,
    },
    AAA: {
      required: aaaRequired,
      passes: ratio >= aaaRequired,
    },
    grade: ratio >= aaaRequired ? 'AAA' : ratio >= aaRequired ? 'AA' : 'Fail',
    status: ratio >= aaRequired ? 'good' : ratio >= 3.0 ? 'warning' : 'error',
  };
}

/**
 * Check contrast directly from two hex colors
 */
export function checkContrastFromHex(hex1, hex2) {
  const c1 = hexToRgbObj(hex1);
  const c2 = hexToRgbObj(hex2);
  if (!c1 || !c2) return null;
  const ratio = getContrastRatio(c1, c2);
  return {
    ratio: parseFloat(ratio.toFixed(2)),
    ratioLabel: `${ratio.toFixed(2)}:1`,
    AA: { passes: ratio >= WCAG.AA_NORMAL, required: WCAG.AA_NORMAL },
    AAA: { passes: ratio >= WCAG.AAA_NORMAL, required: WCAG.AAA_NORMAL },
    grade: ratio >= WCAG.AAA_NORMAL ? 'AAA' : ratio >= WCAG.AA_NORMAL ? 'AA' : 'Fail',
  };
}

function hexToRgbObj(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}
