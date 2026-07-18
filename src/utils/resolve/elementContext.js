// Content-script orchestrator: assembles the `context` fragment captured at edit/comment
// time. The child-summary logic is pure (tested); the rest is thin DOM glue over the
// resolver modules. Every DOM read is best-effort — a failure yields a smaller fragment,
// never an exception into the capture path.
import { resolveChain } from './varChain.js';
import { matchedDeclaration, buildLookup, rootFontSizeSource } from './cssSource.js';
import { detectTheme } from './pageState.js';

export function childSignature(kid) {
  const cls = (kid.classes || []).filter(c => !c.includes(':')).slice(0, 3);
  return cls.length ? `${kid.tag}.${cls.join('.')}` : kid.tag;
}

export function summarizeChildren(kids) {
  if (!kids.length) return { count: 0, signature: null };
  const sigs = kids.map(childSignature);
  if (sigs.every(s => s === sigs[0])) return { count: kids.length, signature: sigs[0] };
  if (kids.every(k => k.tag === kids[0].tag)) return { count: kids.length, signature: kids[0].tag };
  return { count: kids.length, signature: null };
}

// Resolve one property on an element to a ChainResult, or null when it isn't var-backed.
export function resolveProp(el, kebabProp, { sheets = document.styleSheets } = {}) {
  try {
    const md = matchedDeclaration(el, kebabProp, { sheets });
    if (!md) return null;
    const lookup = buildLookup(el, { sheets });
    const root = rootFontSizeSource({ sheets });
    const chain = resolveChain(md.declared, lookup, { root });
    return {
      declared: md.declared, via: md.via,
      computed: getComputedStyle(el).getPropertyValue(kebabProp).trim(),
      hops: chain.hops, root: chain.root, truncated: chain.truncated, cyclic: chain.cyclic,
    };
  } catch { return null; }
}

export function captureForEdit(el, kebabProp, { sheets = document.styleSheets } = {}) {
  const chains = {}; chains[kebabProp] = resolveProp(el, kebabProp, { sheets });
  return { chains, theme: safeTheme(el, sheets), locator: buildLocator(el) };
}

export function captureForComment(el, { sheets = document.styleSheets } = {}) {
  const theme = safeTheme(el, sheets);
  const locator = buildLocator(el);
  try {
    const cs = getComputedStyle(el);
    const isGrid = cs.display.includes('grid');
    const layout = {
      display: cs.display,
      flexDirection: (!isGrid && cs.display.includes('flex')) ? cs.flexDirection : null,
      gridTemplateColumns: isGrid && cs.gridTemplateColumns !== 'none' ? cs.gridTemplateColumns : null,
      gridTemplateRows: isGrid && cs.gridTemplateRows !== 'none' ? cs.gridTemplateRows : null,
    };
    return { layout, theme, locator };
  } catch {
    return { theme, locator };
  }
}

function safeTheme(el, sheets) {
  try { return detectTheme(el, { sheets }) || undefined; } catch { return undefined; }
}

// Whitespace-collapsed, length-capped text snippet for a human/LLM to recognize the
// element by. Pure — no DOM. Returns null when there's nothing meaningful to show.
export function snippetText(raw) {
  if (!raw) return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > 80 ? t.slice(0, 79) + '…' : t;   // … is U+2026
}

// Standards-first source hook: the most stable, greppable handle for locating this element
// in source. DOM attributes only (framework-agnostic). data-testid/id/aria-label/data-slot,
// in descending order of how deliberately-placed-and-greppable they are.
export function buildHook(el) {
  try {
    const testidEl = el.closest && el.closest('[data-testid]');
    if (testidEl) return { kind: 'data-testid', value: testidEl.getAttribute('data-testid') };
    const id = el.id;
    if (id && !/[:]|^[0-9]|[0-9a-f]{8}/i.test(id) && id.length <= 40) return { kind: 'id', value: id };
    const aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria) return { kind: 'aria-label', value: aria };
    const slotEl = el.closest && el.closest('[data-slot]');
    if (slotEl) return { kind: 'data-slot', value: slotEl.getAttribute('data-slot') };
  } catch { /* ignore — no hook */ }
  return null;
}

// A component name off a React fiber's `type`, handling function/class components plus the
// forwardRef and memo wrappers shadcn/Radix use heavily (a bare `typeof === 'function'`
// check misses those). Host tags (string types like 'button') yield null.
function componentName(type) {
  if (!type) return null;
  if (typeof type === 'function') return type.displayName || type.name || null;
  if (typeof type === 'object') {
    if (type.displayName) return type.displayName;            // memo/forwardRef displayName
    if (type.render) return type.render.displayName || type.render.name || null;  // forwardRef
    if (type.type) return componentName(type.type);           // memo(Component)
  }
  return null;
}

// The React adapter of the locator cascade: the nearest component name + its dev-build
// source (`_debugSource`, absent in prod and in React 19). Framework-specific and fully
// guarded — returns null on non-React pages, minified prod names, or any internals change.
export function readReactComponent(el) {
  try {
    const key = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (!key) return null;
    const hostFiber = el[key];
    // Source comes from the ELEMENT's own (host) fiber: its _debugSource is where this
    // element's JSX is written — i.e. inside the owning component's file, stable across every
    // instance. The nearest *component* fiber's _debugSource would instead be this instance's
    // call site (App.tsx:42 for one usage, elsewhere for another) — not what we want.
    const ds = hostFiber && hostFiber._debugSource;
    const source = (ds && ds.fileName)
      ? { file: ds.fileName.split(/[\\/]/).pop(), line: ds.lineNumber ?? null }
      : null;
    // Name comes from walking up to the nearest component fiber (host tags yield null).
    for (let f = hostFiber, hops = 0; f && hops < 80; f = f.return, hops++) {
      const name = componentName(f.type);
      if (name && name.length > 2) return { name, source };   // skip minified ≤2-char names
    }
    return null;
  } catch { return null; }
}

export function buildLocator(el) {
  let text = null;
  try { text = snippetText(el.textContent); } catch { /* ignore */ }
  return { component: readReactComponent(el), text, hook: buildHook(el) };
}
