// src/utils/resolve/varChain.js
// PURE transitive var() resolver. Given a declared CSS value and a lookup that returns the
// declared text of any custom property, reconstruct the chain of hops from token to leaf.
// Knows nothing about the DOM — the caller binds `lookup` to an element. calc() and other
// non-var text pass through verbatim; nested var() inside them is still followed.
const NO_SOURCE = Object.freeze({ file: null, line: null });

// The first var(...) reference in `text`, split into name + optional fallback.
// "calc(var(--radius) - 2px)" -> { name: '--radius', fallback: null }
// "var(--gone, 4px)"          -> { name: '--gone', fallback: '4px' }
export function parseVar(text) {
  const i = text.indexOf('var(');
  if (i === -1) return null;
  // Walk to the matching close paren of this var( to capture a possibly-nested fallback.
  let depth = 0, end = -1;
  for (let j = i + 3; j < text.length; j++) {
    if (text[j] === '(') depth++;
    else if (text[j] === ')') { depth--; if (depth === 0) { end = j; break; } }
  }
  if (end === -1) return null;
  const inner = text.slice(i + 4, end); // between 'var(' and its ')'
  const comma = splitTopComma(inner);
  return { name: comma.head.trim(), fallback: comma.tail === null ? null : comma.tail.trim() };
}

// Split on the first top-level comma (ignoring commas inside nested parens).
function splitTopComma(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) return { head: s.slice(0, i), tail: s.slice(i + 1) };
  }
  return { head: s, tail: null };
}

export function firstVarName(text) {
  const p = parseVar(text);
  return p ? p.name : null;
}

export function resolveChain(declaredText, lookup, { root = null, maxDepth = 16 } = {}) {
  const hops = [];
  const seen = new Set();
  let cyclic = false, truncated = false;
  let text = declaredText;

  while (true) {
    const parsed = parseVar(text);
    if (!parsed) break;                       // no more var() references to follow
    if (hops.length >= maxDepth) { truncated = true; break; }
    if (seen.has(parsed.name)) { cyclic = true; break; }
    seen.add(parsed.name);

    const found = lookup(parsed.name);
    if (found) {
      hops.push({ name: parsed.name, value: found.text, source: found.source || NO_SOURCE });
      text = found.text;                      // follow into the resolved value (may hold var())
    } else if (parsed.fallback !== null) {
      hops.push({ name: `${parsed.name} (fallback)`, value: parsed.fallback, source: NO_SOURCE });
      text = parsed.fallback;                 // the fallback may itself hold a var() to follow
    } else {
      break;                                   // unresolvable and no fallback — chain ends here
    }
  }

  const hasRem = /[\d.]rem\b/.test(declaredText) || hops.some(h => /[\d.]rem\b/.test(h.value));
  return { hops, root: hasRem ? root : null, truncated, cyclic };
}
