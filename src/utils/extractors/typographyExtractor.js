import { rgbToHex } from '../helpers/colorHelpers.js';

export function extractTypography() {
  const families = new Map();
  const styles = new Map();

  const textElements = Array.from(document.querySelectorAll('*'))
    .filter(el => {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'].includes(el.tagName)) return false;
      const text = el.textContent?.trim();
      return text && text.length > 0 && el.children.length === 0;
    })
    .slice(0, 1000); // Limit for performance

  textElements.forEach(element => {
    try {
      const computed = getComputedStyle(element);
      const fontFamily = computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      const fontWeight = computed.fontWeight;

      // Track families
      if (!families.has(fontFamily)) {
        families.set(fontFamily, {
          name: fontFamily,
          weights: new Set(),
          usage: 0,
          role: detectFontRole(fontFamily),
        });
      }
      const family = families.get(fontFamily);
      family.weights.add(parseInt(fontWeight) || 400);
      family.usage++;

      // Track unique text styles
      const fontSize = computed.fontSize;
      const lineHeight = computed.lineHeight;
      const letterSpacing = computed.letterSpacing;
      const styleKey = `${fontSize}|${fontWeight}|${lineHeight}|${letterSpacing}|${fontFamily}`;

      if (!styles.has(styleKey)) {
        styles.set(styleKey, {
          tag: element.tagName.toLowerCase(),
          fontSize,
          fontWeight,
          lineHeight,
          letterSpacing,
          color: rgbToHex(computed.color) || computed.color,
          fontFamily,
          usage: 0,
          token: null,
        });
      }
      styles.get(styleKey).usage++;
    } catch {
      // Skip
    }
  });

  const fontFamilies = Array.from(families.values())
    .map(f => ({
      ...f,
      weights: Array.from(f.weights).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.usage - a.usage);

  const textStyles = Array.from(styles.values())
    .sort((a, b) => b.usage - a.usage);

  return {
    fontFamilies,
    textStyles,
    totalStyles: styles.size,
    tokensDetected: false,
  };
}

function detectFontRole(name) {
  const mono = ['monospace', 'courier', 'consolas', 'monaco', 'fira code', 'source code'];
  const lowered = name.toLowerCase();
  if (mono.some(m => lowered.includes(m))) return 'monospace';
  return 'primary';
}
