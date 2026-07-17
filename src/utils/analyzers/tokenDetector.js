/**
 * Detect if a computed style value originates from a CSS custom property (token)
 */
export function detectToken(element, property) {
  try {
    const inlineStyle = element.getAttribute('style') || '';
    const styleSheets = Array.from(document.styleSheets);

    for (const sheet of styleSheets) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        for (const rule of rules) {
          if (rule.style) {
            const value = rule.style.getPropertyValue(property);
            if (value && value.includes('var(--')) {
              const match = value.match(/var\((--[\w-]+)\)/);
              if (match) return match[1];
            }
          }
        }
      } catch {
        // Cross-origin stylesheet, skip
      }
    }
  } catch {
    // Silently fail
  }
  return null;
}

/**
 * Check if a page uses CSS custom properties (design tokens)
 */
export function detectPageTokens() {
  const tokens = new Map();

  try {
    const styleSheets = Array.from(document.styleSheets);
    for (const sheet of styleSheets) {
      try {
        const rules = Array.from(sheet.cssRules || []);
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule) {
            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
              const prop = style[i];
              if (prop.startsWith('--')) {
                const value = style.getPropertyValue(prop).trim();
                tokens.set(prop, value);
              }
            }
          }
          // :root variables
          if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
              const prop = style[i];
              if (prop.startsWith('--')) {
                const value = style.getPropertyValue(prop).trim();
                tokens.set(prop, value);
              }
            }
          }
        }
      } catch {
        // Cross-origin stylesheet, skip
      }
    }
  } catch {
    // Silently fail
  }

  return tokens;
}

/**
 * Match a color value to a token from the page's token map
 */
export function matchColorToToken(hexColor, tokenMap) {
  if (!tokenMap || !hexColor) return null;
  const normalizedHex = hexColor.toLowerCase();

  for (const [token, value] of tokenMap) {
    const normalizedValue = value.toLowerCase().replace(/\s/g, '');
    if (normalizedValue === normalizedHex) return token;

    // Also try rgb() format
    if (value.startsWith('rgb')) {
      const match = value.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        const hex = '#' + [match[1], match[2], match[3]]
          .map(n => parseInt(n).toString(16).padStart(2, '0'))
          .join('');
        if (hex === normalizedHex) return token;
      }
    }
  }

  return null;
}
