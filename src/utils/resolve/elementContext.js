// Content-script orchestrator: assembles the `context` fragment captured at edit/comment
// time. The child-summary logic is pure (tested); the rest is thin DOM glue over the
// resolver modules. Every DOM read is best-effort — a failure yields a smaller fragment,
// never an exception into the capture path.
import { resolveChain } from './varChain.js';
import { matchedDeclaration, buildLookup, rootFontSizeSource } from './cssSource.js';
import { detectTheme } from './pageState.js';

const PAINT_PROPS = ['background-color', 'color', 'border-color'];

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
  return { chains, theme: safeTheme(el, sheets) };
}

export function captureForComment(el, { sheets = document.styleSheets } = {}) {
  const cs = getComputedStyle(el);
  const isGrid = cs.display.includes('grid');
  const layout = {
    display: cs.display,
    flexDirection: (!isGrid && cs.display.includes('flex')) ? cs.flexDirection : null,
    gridTemplateColumns: isGrid && cs.gridTemplateColumns !== 'none' ? cs.gridTemplateColumns : null,
    gridTemplateRows: isGrid && cs.gridTemplateRows !== 'none' ? cs.gridTemplateRows : null,
    gap: (cs.gap && cs.gap !== 'normal' && cs.gap !== '0px') ? cs.gap : null,
  };
  const kids = Array.from(el.children).map(c => ({ tag: c.tagName.toLowerCase(), classes: Array.from(c.classList) }));
  const r = el.getBoundingClientRect();
  const bbox = { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
  const chains = {};
  for (const p of PAINT_PROPS) { const c = resolveProp(el, p, { sheets }); if (c) chains[p] = c; }
  return { chains, layout, children: summarizeChildren(kids), bbox, theme: safeTheme(el, sheets) };
}

function safeTheme(el, sheets) {
  try { return detectTheme(el, { sheets }) || undefined; } catch { return undefined; }
}
