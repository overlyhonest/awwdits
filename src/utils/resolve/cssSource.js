// CSSOM adapter: turns document.styleSheets into a per-element custom-property lookup and
// resolves each rule to a { file, line } source. All DOM/CSSOM access is here so varChain
// stays pure. Everything is defensive — a cross-origin sheet, a missing ownerNode, or an
// unparseable rule degrades to less detail, never throws.

// Rough (a,b,c) specificity: ids, then classes/attrs/pseudo-classes, then type selectors.
export function specificity(sel) {
  const a = (sel.match(/#[\w-]+/g) || []).length;
  const b = (sel.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) || []).length;
  const c = (sel.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length;
  return [a, b, c];
}
function cmpSpec(x, y) { return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; }

// Flatten every CSSStyleRule in document order, descending into media/supports/layer blocks.
export function collectStyleRules(sheets) {
  const out = [];
  for (const sheet of sheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin — skip this sheet
    if (!rules) continue;
    walk(rules, out, sheet);
  }
  return out;
}
function walk(rules, out, sheet) {
  for (const r of rules) {
    if (r.selectorText && r.style) {
      if (sheet && r.ownerNodeText === undefined) attachOwner(r, sheet);
      out.push(r);
    } else if (r.cssRules) {
      walk(r.cssRules, out, sheet);           // @media / @supports / @layer block
    }
  }
}
// In the real DOM, rules don't carry their sheet's ownerNode text/href; attach it so
// sourceForRule can read it. In tests, rules already carry ownerNodeText/href/ownerViteId.
function attachOwner(r, sheet) {
  try {
    const node = sheet.ownerNode;
    if (node && node.tagName === 'STYLE') {
      r.ownerNodeText = node.textContent || '';
      r.ownerViteId = node.getAttribute('data-vite-dev-id') || null;
    } else if (sheet.href) {
      r.href = sheet.href;
    }
    if (r.ruleText === undefined) r.ruleText = r.cssText;
  } catch { /* leave undefined — sourceForRule degrades */ }
}

const basename = (p) => (p ? p.split(/[\\/]/).pop().split('?')[0] : null);

export function sourceForRule(rule) {
  try {
    if (rule.ownerNodeText != null) {
      const file = basename(rule.ownerViteId) || null;
      const idx = rule.ruleText ? rule.ownerNodeText.indexOf(rule.ruleText) : -1;
      const line = idx >= 0 ? rule.ownerNodeText.slice(0, idx).split('\n').length : null;
      return { file, line };
    }
    if (rule.href) return { file: basename(rule.href), line: null };
  } catch { /* fall through */ }
  return { file: null, line: null };
}

// Ancestor chain [el, parent, ..., root]; index 0 = the element itself (closest wins).
function chainOf(el) {
  const chain = [];
  for (let n = el; n; n = n.parentElement) chain.push(n);
  return chain;
}

// A candidate is a rule declaring `name` that matches some element in the chain.
// Winner: closest chain element (smallest index), then highest specificity, then source order.
function winner(rules, chain, name) {
  let best = null;
  rules.forEach((r, order) => {
    const val = r.style.getPropertyValue(name);
    if (!val) return;
    let idx = -1;
    for (let i = 0; i < chain.length; i++) {
      try { if (chain[i].matches(r.selectorText)) { idx = i; break; } } catch { /* bad selector */ }
    }
    if (idx === -1) return;
    const cand = { idx, spec: specificity(r.selectorText), order, rule: r, val: val.trim() };
    if (!best || cand.idx < best.idx ||
        (cand.idx === best.idx && (cmpSpec(cand.spec, best.spec) > 0 ||
          (cmpSpec(cand.spec, best.spec) === 0 && cand.order > best.order)))) best = cand;
  });
  return best;
}

export function buildLookup(el, { sheets = document.styleSheets } = {}) {
  const rules = collectStyleRules(sheets);
  const chain = chainOf(el);
  return (name) => {
    const w = winner(rules, chain, name);
    return w ? { text: w.val, source: sourceForRule(w.rule) } : null;
  };
}

// The winning author declaration of a normal (non-custom) property ON the element itself,
// but only when its value is var-backed (otherwise there is no chain to reconstruct).
export function matchedDeclaration(el, kebabProp, { sheets = document.styleSheets } = {}) {
  const rules = collectStyleRules(sheets);
  const w = winner(rules, [el], kebabProp);
  if (!w || !w.val.includes('var(')) return null;
  return { declared: w.val, via: w.rule.selectorText, source: sourceForRule(w.rule) };
}

export function rootFontSizeSource({ sheets = document.styleSheets } = {}) {
  const value = (typeof document !== 'undefined')
    ? getComputedStyle(document.documentElement).fontSize : null;
  const rules = collectStyleRules(sheets);
  let hit = null;
  for (const r of rules) {
    let sel; try { sel = r.selectorText; } catch { continue; }
    if (/(^|[\s,])(:root|html)(\s|,|$)/.test(sel) && r.style.getPropertyValue('font-size')) hit = r;
  }
  return { value, source: hit ? sourceForRule(hit) : { file: null, line: null } };
}
