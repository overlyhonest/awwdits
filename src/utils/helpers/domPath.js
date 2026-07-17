// A positional fallback path from <body> to an element: [{tag, index}], where
// index is the element's position among its parent's children. Re-finds an
// element when its CSS selector isn't unique.
export function buildPath(el) {
  const path = [];
  let node = el;
  while (node && node.nodeType === 1 && node.tagName !== 'BODY' && node.tagName !== 'HTML') {
    const parent = node.parentElement;
    if (!parent) break;
    const index = Array.prototype.indexOf.call(parent.children, node);
    path.unshift({ tag: node.tagName.toLowerCase(), index });
    node = parent;
  }
  return path;
}

export function findByPath(path) {
  if (!Array.isArray(path) || !path.length) return null;
  let node = document.body;
  for (const step of path) {
    const child = node && node.children[step.index];
    if (!child || child.tagName.toLowerCase() !== step.tag) return null;
    node = child;
  }
  return node && node !== document.body ? node : null;
}

// Re-find an element from a serialized reference. Order matters for reliability:
// 1. a *uniquely*-matching CSS selector (exactly one hit) — trust it;
// 2. otherwise the positional path (unique by construction, survives class/id churn);
// 3. last resort, the first selector match.
// This is the single anchoring primitive used by pins, comment focus, and row-select,
// so a repeated class (e.g. `strong.Yjhzub` appearing many times) never lands on the
// wrong element.
// A full, unique CSS path from <body>, built from a positional path. LLM-friendly:
// an assistant reading the exported changes can locate the exact element.
// e.g. "body > div:nth-child(1) > section:nth-child(2) > strong:nth-child(3)".
export function pathToSelector(path) {
  if (!Array.isArray(path) || !path.length) return '';
  return 'body > ' + path.map(s => `${s.tag}:nth-child(${s.index + 1})`).join(' > ');
}

export function locateElement(selector, path) {
  if (selector) {
    try {
      const matches = document.querySelectorAll(selector);
      if (matches.length === 1) return matches[0];
    } catch { /* invalid selector — fall through */ }
  }
  const byPath = findByPath(path);
  if (byPath) return byPath;
  if (selector) {
    try { return document.querySelector(selector); } catch { /* invalid selector */ }
  }
  return null;
}
