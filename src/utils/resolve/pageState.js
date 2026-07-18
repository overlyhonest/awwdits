// src/utils/resolve/pageState.js
// Theme detection + export header. The pure core (detectThemeFromChain, pageHeader) is
// tested without a DOM; the DOM readers (readAncestorChain, detectTheme, currentPageState)
// are thin wrappers used by the content script.

// chain: [{ selector, classList:[...], attrs:{...} }] from the element upward.
export function detectThemeFromChain(chain, { prefersDark, hasMediaRule }) {
  for (const n of chain) {
    if (n.classList.includes('dark')) return carrier('dark', '.dark', n.selector);
    if (n.classList.includes('light')) return carrier('light', '.light', n.selector);
    for (const key of ['data-theme', 'data-mode']) {
      const v = n.attrs && n.attrs[key];
      if (v === 'dark' || v === 'light') return carrier(v, `[${key}=${v}]`, n.selector);
    }
  }
  if (hasMediaRule) {
    return { mode: prefersDark ? 'dark' : 'light', method: 'prefers-color-scheme', carrier: null, carrierSelector: null };
  }
  return null; // omit rather than guess
}
function carrier(mode, sel, carrierSelector) {
  return { mode, method: `carrier:${sel}`, carrier: sel, carrierSelector };
}

export function pageHeader({ url, viewport: { w, h }, date, theme }) {
  const parts = ['# awwdits', url];
  if (theme) parts.push(`${theme.mode} mode (${theme.method})`);
  parts.push(`${w}×${h}`, date);
  return parts.join(' · ');
}

export function sheetsHavePrefersColorScheme(sheets) {
  for (const sheet of sheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    for (const r of rules) {
      try { if (r.media && /prefers-color-scheme/.test(r.conditionText || r.media.mediaText || '')) return true; }
      catch { /* ignore */ }
    }
  }
  return false;
}

// ----- DOM readers (thin; not unit-tested) -----
export function readAncestorChain(el) {
  const chain = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    chain.push({
      selector: descriptor(n),
      classList: Array.from(n.classList || []),
      attrs: { 'data-theme': n.getAttribute?.('data-theme'), 'data-mode': n.getAttribute?.('data-mode') },
    });
  }
  return chain;
}
function descriptor(n) {
  const tag = n.tagName.toLowerCase();
  const cls = Array.from(n.classList || []).filter(c => !c.includes(':')).slice(0, 2);
  return cls.length ? `${tag}.${cls.join('.')}` : tag;
}

export function detectTheme(el, { sheets = document.styleSheets } = {}) {
  const prefersDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  const hasMediaRule = sheetsHavePrefersColorScheme(sheets);
  return detectThemeFromChain(readAncestorChain(el), { prefersDark, hasMediaRule });
}

// Page mode: the theme at the document root, else the outermost explicit carrier in the doc
// (carriers commonly sit on a body wrapper, not <html>). DOM glue — not unit-tested.
export function detectPageTheme({ sheets = document.styleSheets } = {}) {
  const root = detectTheme(document.documentElement, { sheets });
  if (root) return root;
  const carrier = document.querySelector('[data-theme],[data-mode],.dark,.light');
  return carrier ? detectTheme(carrier, { sheets }) : null;
}

// Page-level state for the header. `date` is 'YYYY-MM-DD' from the caller.
export function currentPageState(date, { sheets = document.styleSheets } = {}) {
  const rootTheme = detectPageTheme({ sheets });
  const header = pageHeader({
    url: location.href,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    date,
    theme: rootTheme,
  });
  return { header, mode: rootTheme ? rootTheme.mode : null };
}
