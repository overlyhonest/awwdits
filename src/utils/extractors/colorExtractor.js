import { rgbToHex, isTransparent, rgbToHsl, parseColor } from '../helpers/colorHelpers.js';
import { matchColorToToken, detectPageTokens } from '../analyzers/tokenDetector.js';

function getSelector(element) {
  if (element.id) return `#${element.id}`;
  const tag = element.tagName.toLowerCase();
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(c => c && !c.includes(':'));
    if (classes.length) return `${tag}.${classes[0]}`;
  }
  return tag;
}

export function extractColors() {
  const colors = new Map();
  const tokenMap = detectPageTokens();

  const colorProps = [
    { prop: 'color', type: 'text' },
    { prop: 'backgroundColor', type: 'background' },
    { prop: 'borderTopColor', type: 'border' },
    { prop: 'borderRightColor', type: 'border' },
    { prop: 'borderBottomColor', type: 'border' },
    { prop: 'borderLeftColor', type: 'border' },
    { prop: 'fill', type: 'fill' },
    { prop: 'stroke', type: 'stroke' },
  ];

  // Limit elements for performance
  const allElements = Array.from(document.querySelectorAll('*')).slice(0, 3000);

  allElements.forEach(element => {
    try {
      const styles = getComputedStyle(element);

      colorProps.forEach(({ prop, type }) => {
        const value = styles[prop];
        if (!value || isTransparent(value)) return;

        // Skip near-black and near-white defaults unless they're actually styled
        const hex = rgbToHex(value);
        if (!hex) return;

        if (!colors.has(hex)) {
          const parsed = parseColor(value);
          const hsl = parsed ? rgbToHsl(parsed.r, parsed.g, parsed.b) : '';
          colors.set(hex, {
            value: hex,
            rgb: value,
            hsl,
            frequency: 0,
            usedAs: new Set(),
            elements: new Set(),
            token: matchColorToToken(hex.toLowerCase(), tokenMap),
          });
        }

        const color = colors.get(hex);
        color.frequency++;
        color.usedAs.add(type);
        if (color.elements.size < 5) {
          color.elements.add(getSelector(element));
        }
      });
    } catch {
      // Skip problematic elements
    }
  });

  const totalUsage = Array.from(colors.values()).reduce((sum, c) => sum + c.frequency, 0);
  const tokensDetected = Array.from(colors.values()).filter(c => c.token).length;

  const result = Array.from(colors.values())
    .map(color => ({
      value: color.value,
      rgb: color.rgb,
      hsl: color.hsl,
      frequency: color.frequency,
      percentage: totalUsage > 0 ? parseFloat(((color.frequency / totalUsage) * 100).toFixed(1)) : 0,
      usedAs: Array.from(color.usedAs),
      elements: Array.from(color.elements),
      token: color.token,
    }))
    .sort((a, b) => b.frequency - a.frequency);

  return {
    colors: result,
    totalUnique: result.length,
    tokensDetected,
  };
}
