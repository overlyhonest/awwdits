// src/sidebar/notes/exportNotes.js
// Render notes records to LLM-friendly plain text. Additive to the class-based selector
// line: when a record carries captured `context`, we also emit the resolved var() chain
// (token → leaf, with sources), page/element theme, and layout context for comments.
// Everything degrades — a record with no context renders as heading + comment + plain edits.
// Pure: no DOM. The page-state header is passed in by the (DOM-having) caller.
const CORNERS = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'];
const PAINT_PROPS = ['background-color', 'color', 'border-color'];

export function formatAll(records, pageState = null) {
  const body = records.map((r, i) => formatRecord(r, i + 1, pageState ? pageState.mode : null)).join('\n\n');
  return pageState && pageState.header ? `${pageState.header}\n\n${body}` : body;
}

export function formatRecord(record, index, pageMode = null) {
  const ctx = record.context || {};
  const lines = [`## [${index}] ${record.selector}`];

  if (ctx.theme && ctx.theme.mode !== pageMode) {
    lines.push(`    theme:  ${ctx.theme.mode}  (via ${ctx.theme.carrier} on ${ctx.theme.carrierSelector})`);
  }

  const comment = record.comment && record.comment.trim();
  if (comment) lines.push(`    Comment: "${comment}"`);

  // Comment context block (only meaningful for commented elements).
  if (comment && ctx.layout) lines.push(...formatCommentContext(ctx));

  // Edits, with 4-corner collapse and per-edit chain blocks.
  lines.push(...formatEdits(record.edits || [], ctx.chains || {}));

  return lines.join('\n');
}

function formatCommentContext(ctx) {
  const out = [];
  out.push(`      layout:    ${formatLayout(ctx.layout)}`);
  if (ctx.children && ctx.children.count > 0) {
    out.push(`      children:  ${ctx.children.signature ? `${ctx.children.count} × ${ctx.children.signature}` : ctx.children.count}`);
  }
  if (ctx.bbox) out.push(`      bbox:      ${ctx.bbox.w}×${ctx.bbox.h} @ (${ctx.bbox.x},${ctx.bbox.y})`);
  for (const p of PAINT_PROPS) {
    const chain = ctx.chains && ctx.chains[p];
    if (!chain) continue;
    out.push(`      ${p}: ${chain.computed}`);
    out.push(...renderChainBlock(chain, 8));
  }
  return out;
}

export function formatLayout(l) {
  const parts = [`display:${l.display}`];
  if (l.flexDirection) parts.push(`flex-direction:${l.flexDirection}`);
  if (l.gridTemplateColumns) parts.push(`grid-template-columns:${l.gridTemplateColumns}`);
  if (l.gridTemplateRows) parts.push(`grid-template-rows:${l.gridTemplateRows}`);
  if (l.gap) parts.push(`gap:${l.gap}`);
  return parts.join('; ');
}

function formatEdits(edits, chains) {
  const out = [];
  const byProp = Object.fromEntries(edits.map(e => [e.property, e]));
  const canCollapse = CORNERS.every(c => byProp[c])
    && CORNERS.every(c => byProp[c].before === byProp[CORNERS[0]].before && byProp[c].after === byProp[CORNERS[0]].after);
  const skip = new Set(canCollapse ? CORNERS : []);
  let collapsed = false;
  for (const e of edits) {
    if (skip.has(e.property)) {
      if (!collapsed) {
        collapsed = true;
        out.push(`    border-radius: ${e.before || '(none)'} → ${e.after}  (4 corners)`);
        const chain = CORNERS.map(c => chains[c]).find(Boolean);
        if (chain) out.push(...renderChainBlock(chain, 6));
      }
      continue;
    }
    out.push(`    ${e.property}: ${e.before || '(none)'} → ${e.after}`);
    if (chains[e.property]) out.push(...renderChainBlock(chains[e.property], 6));
  }
  return out;
}

// Render `declared:` + `chain:` at a given base indent. Deliberately NOT column-aligned:
// each row is `<name> = <value>  <src>` with single spaces, so editing one hop never
// reflows the spacing of its siblings. Names line up because the continuation prefix width
// equals `chain:     ` (11 chars). This favors the hard diff-friendly constraint over the
// target's cosmetic column alignment (flagged to the user at handoff).
function renderChainBlock(chain, indent) {
  if (!chain || !chain.hops || !chain.hops.length) return [];
  const pad = ' '.repeat(indent);
  const out = [`${pad}declared:  ${chain.declared}  via ${chain.via}`];

  const rows = chain.hops.map(h => ({ name: h.name, value: h.value, src: srcStr(h.source) }));
  if (chain.root) rows.push({ name: 'root', value: chain.root.value, src: srcStr(chain.root.source) });

  rows.forEach((r, i) => {
    const prefix = i === 0 ? `${pad}chain:     ` : `${pad}           `;  // both 11 chars past pad
    const left = `${r.name} = ${r.value}`;
    out.push(r.src ? `${prefix}${left}  ${r.src}` : `${prefix}${left}`);
  });
  if (chain.cyclic) out.push(`${pad}           … (cycle)`);
  else if (chain.truncated) out.push(`${pad}           … (chain depth capped)`);
  return out;
}

function srcStr(s) {
  if (!s || !s.file) return '';
  return s.line != null ? `${s.file}:${s.line}` : s.file;
}
