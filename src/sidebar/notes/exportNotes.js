// src/sidebar/notes/exportNotes.js
// Render notes records to LLM-friendly plain text. Additive to the class-based selector
// line: when a record carries captured `context`, we also emit the resolved var() chain
// (token → leaf, with sources), page/element theme, and layout context for comments.
// Everything degrades — a record with no context renders as heading + comment + plain edits.
// Pure: no DOM. The page context (url/theme/date) is passed in by the (DOM-having) caller.
const CORNERS = ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'];

export function formatAll(records, pageState = null) {
  const body = records.map((r, i) => formatRecord(r, i + 1, pageState ? pageState.mode : null)).join('\n\n');
  if (!pageState) return body;
  return `${preamble(records.length, pageState)}\n\n${body}`;
}

// A short human/LLM-readable intro: what this is, the page it came from, and how to read
// each block — so the reader understands the payload with no external context. Replaces a
// bare metadata header (which read as noise and didn't say what was being shared).
function preamble(n, { url, mode, date }) {
  const bits = [];
  if (mode) bits.push(`${mode} theme`);
  if (date) bits.push(date);
  const ctx = bits.length ? ` (${bits.join(', ')})` : '';
  const where = url ? ` on ${url}${ctx}` : '';
  const s = n === 1 ? '' : 's';
  return `Design-review feedback from the awwdits browser extension — ${n} note${s}${where}.\n\n`
    + 'Each block below is one element on the page. The heading, `text:`, and `hook:` lines only '
    + 'locate it — context, not requirements. The `Comment:` or the `prop: before → after` edit is the change to make.';
}

export function formatRecord(record, index, pageMode = null) {
  const ctx = record.context || {};
  const lines = [`## [${index}] ${record.selector}`];

  if (ctx.locator) lines.push(...formatLocator(ctx.locator));

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
  return [`      layout:    ${formatLayout(ctx.layout)}`];
}

// Locator lines sit right under the heading (before the theme line). Labels are padded to
// 8 so values align at column 12 (same as the existing `theme:` line).
function formatLocator(loc) {
  const out = [];
  if (loc.component) out.push(`    ${'comp:'.padEnd(8)}${formatComponent(loc.component)}`);
  if (loc.text) out.push(`    ${'text:'.padEnd(8)}"${loc.text}"`);
  if (loc.hook) out.push(`    ${'hook:'.padEnd(8)}${formatHook(loc.hook)}`);
  return out;
}
function formatComponent(c) {
  if (!c.source) return c.name;
  const line = c.source.line != null ? `:${c.source.line}` : '';
  return `${c.name} → ${c.source.file}${line}`;
}
function formatHook(h) {
  if (h.kind === 'id') return `#${h.value}`;
  if (h.kind === 'aria-label') return `aria-label="${h.value}"`;
  return `${h.kind}="${h.value}"`;   // data-testid / data-slot
}

export function formatLayout(l) {
  const parts = [`display:${l.display}`];
  if (l.flexDirection) parts.push(`flex-direction:${l.flexDirection}`);
  if (l.gridTemplateColumns) parts.push(`grid-template-columns:${l.gridTemplateColumns}`);
  if (l.gridTemplateRows) parts.push(`grid-template-rows:${l.gridTemplateRows}`);
  return parts.join('; ');   // gap intentionally omitted — a sub-pixel number reads as a fake target
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
