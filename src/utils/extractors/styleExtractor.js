import { rgbToHex } from '../helpers/colorHelpers.js';
import { buildPath } from '../helpers/domPath.js';

/**
 * Extract full computed styles for a single element
 */
export function extractElementStyles(element) {
  if (!element) return null;
  const computed = getComputedStyle(element);
  const tag = element.tagName.toLowerCase();

  return {
    element: {
      tag,
      classes: Array.from(element.classList),
      id: element.id || null,
      selector: buildSelector(element),
      path: buildPath(element),
    },
    layout: {
      display: computed.display,
      position: computed.position,
      flexDirection: computed.flexDirection !== 'row' ? computed.flexDirection : null,
      justifyContent: computed.justifyContent !== 'normal' ? computed.justifyContent : null,
      alignItems: computed.alignItems !== 'normal' ? computed.alignItems : null,
      gap: computed.gap !== 'normal' && computed.gap !== '0px' ? computed.gap : null,
      flexWrap: computed.flexWrap !== 'nowrap' ? computed.flexWrap : null,
    },
    dimensions: {
      width: computed.width,
      height: computed.height,
      minWidth: computed.minWidth !== '0px' ? computed.minWidth : null,
      minHeight: computed.minHeight !== '0px' ? computed.minHeight : null,
      maxWidth: computed.maxWidth !== 'none' ? computed.maxWidth : null,
      maxHeight: computed.maxHeight !== 'none' ? computed.maxHeight : null,
    },
    spacing: {
      padding: {
        top: computed.paddingTop,
        right: computed.paddingRight,
        bottom: computed.paddingBottom,
        left: computed.paddingLeft,
      },
      margin: {
        top: computed.marginTop,
        right: computed.marginRight,
        bottom: computed.marginBottom,
        left: computed.marginLeft,
      },
    },
    typography: element.textContent?.trim() ? {
      // Editable text content — only for leaf text elements, so setting it back
      // can't clobber child elements. null means "not safely editable".
      text: element.children.length === 0 ? element.textContent : null,
      fontFamily: computed.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
      fontFamilyFull: computed.fontFamily,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
      color: computed.color,
      colorHex: rgbToHex(computed.color),
      textAlign: computed.textAlign,
      textDecoration: computed.textDecoration,
      textTransform: computed.textTransform !== 'none' ? computed.textTransform : null,
    } : null,
    colors: {
      backgroundColor: computed.backgroundColor,
      backgroundColorHex: rgbToHex(computed.backgroundColor),
      color: computed.color,
      colorHex: rgbToHex(computed.color),
      borderColor: computed.borderTopColor,
      borderColorHex: rgbToHex(computed.borderTopColor),
    },
    border: {
      width: computed.borderTopWidth,
      style: computed.borderTopStyle,
      color: computed.borderTopColor,
      colorHex: rgbToHex(computed.borderTopColor),
      radius: resolveBorderRadius(computed),
      topWidth: computed.borderTopWidth,
      rightWidth: computed.borderRightWidth,
      bottomWidth: computed.borderBottomWidth,
      leftWidth: computed.borderLeftWidth,
      topStyle: computed.borderTopStyle,
      rightStyle: computed.borderRightStyle,
      bottomStyle: computed.borderBottomStyle,
      leftStyle: computed.borderLeftStyle,
    },
    effects: {
      boxShadow: computed.boxShadow !== 'none' ? computed.boxShadow : null,
      opacity: computed.opacity !== '1' ? computed.opacity : null,
      transform: computed.transform !== 'none' ? computed.transform : null,
      overflow: computed.overflow !== 'visible' ? computed.overflow : null,
    },
    image: extractImageData(element, tag, computed),
    background: {
      backgroundColor: computed.backgroundColor,
      backgroundColorHex: rgbToHex(computed.backgroundColor),
      backgroundImage: computed.backgroundImage !== 'none' ? computed.backgroundImage : null,
      backgroundSize: computed.backgroundImage !== 'none' ? computed.backgroundSize : null,
      backgroundPosition: computed.backgroundImage !== 'none' ? computed.backgroundPosition : null,
    },
    cssVariables: extractCssVariables(element),
  };
}

function extractImageData(element, tag, computed) {
  if (tag === 'img') {
    return {
      type: 'img',
      src: element.src || element.getAttribute('src') || '',
      alt: element.alt ?? '',
      naturalWidth: element.naturalWidth || 0,
      naturalHeight: element.naturalHeight || 0,
      renderedWidth: computed.width,
      renderedHeight: computed.height,
    };
  }

  if (tag === 'svg') {
    // Serialize the live SVG so the (sandboxed) sidebar can preview it via a data URI.
    // Resolve currentColor to the element's computed color so monochrome icons don't render
    // as default black, and ensure an xmlns so the markup stands alone in an <img>.
    let markup = null;
    try {
      let s = element.outerHTML;
      if (computed.color && s.includes('currentColor')) s = s.split('currentColor').join(computed.color);
      if (!/\bxmlns=/.test(s)) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
      markup = s;
    } catch { /* serialization blocked — no preview */ }
    return {
      type: 'svg',
      viewBox: element.getAttribute('viewBox') || '',
      renderedWidth: computed.width,
      renderedHeight: computed.height,
      markup,
    };
  }

  if (tag === 'canvas') {
    // Snapshot the current frame; a cross-origin-tainted canvas throws — degrade to no preview.
    let dataUrl = null;
    try { dataUrl = element.toDataURL(); } catch { /* tainted — no preview */ }
    return { type: 'canvas', renderedWidth: computed.width, renderedHeight: computed.height, dataUrl };
  }

  if (tag === 'video') {
    // Preview the poster frame (the current video frame isn't reliably capturable without
    // taint). `videoSrc` is info only — NOT `src`, which the preview would treat as an image.
    return {
      type: 'video',
      poster: element.getAttribute('poster') || '',
      videoSrc: element.currentSrc || element.src || '',
      renderedWidth: computed.width,
      renderedHeight: computed.height,
    };
  }

  const bgImage = computed.backgroundImage;
  if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
    const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
    return {
      type: 'background-image',
      url: urlMatch ? urlMatch[1] : '',
      backgroundSize: computed.backgroundSize,
      backgroundPosition: computed.backgroundPosition,
    };
  }

  return null;
}

function extractCssVariables(element) {
  const variables = [];
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;
          try {
            if (!element.matches(rule.selectorText)) continue;
          } catch { continue; }

          for (let i = 0; i < rule.style.length; i++) {
            const prop = rule.style[i];
            const raw = rule.style.getPropertyValue(prop);
            if (!raw.includes('var(--')) continue;

            const match = raw.match(/var\((--[\w-]+)/);
            if (!match) continue;

            const varName = match[1];
            const resolved = getComputedStyle(element).getPropertyValue(prop).trim();
            if (!variables.some(v => v.variable === varName)) {
              variables.push({ property: prop, variable: varName, resolvedValue: resolved });
            }
            if (variables.length >= 20) break;
          }
          if (variables.length >= 20) break;
        }
      } catch { /* cross-origin */ }
      if (variables.length >= 20) break;
    }
  } catch { /* silently fail */ }
  return variables.length > 0 ? variables : null;
}

/**
 * `getComputedStyle().borderRadius` is unreliable — it returns '' in Chrome
 * whenever corners differ, and can return '' even for uniform radii in some
 * Tailwind / CSS-variable setups. Always read individual corners.
 */
function resolveBorderRadius(computed) {
  const tl = computed.borderTopLeftRadius     || '0px';
  const tr = computed.borderTopRightRadius    || '0px';
  const br = computed.borderBottomRightRadius || '0px';
  const bl = computed.borderBottomLeftRadius  || '0px';
  if (tl === tr && tr === br && br === bl) return tl;
  return `${tl} ${tr} ${br} ${bl}`;
}

export function buildSelector(element) {
  if (element.id) return `#${element.id}`;
  const tag = element.tagName.toLowerCase();
  const classes = Array.from(element.classList)
    .filter(c => !c.includes(':'))
    .slice(0, 3);
  if (classes.length) return `${tag}.${classes.join('.')}`;
  return tag;
}
