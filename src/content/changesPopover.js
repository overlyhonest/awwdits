// Changes popover (vanilla DOM, PAGE context, dark chrome) — anchored to the
// toolbar's Changes chip. Lists tracked edits + comments grouped per element, with
// Copy (LLM-friendly text) and Clear (all), plus per-item and per-group delete.
// Rendering only; the content script owns the data + actions via callbacks.
//
// Surface matches the toolbar exactly (COLORS.bg): the popover is the toolbar
// unfolding, not a hole in the page. See overlayTokens.js.
import { COLORS, FONT, SIZE, ensureOverlayFonts } from './overlayTokens.js';

const POP_ID = 'awwdits-changes-pop';
const STYLE_ID = 'awwdits-changes-pop-style';
const Z = 2147483646;

let pop = null, opts = {};

const SVG_PENCIL = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M4 20.5V16.6L15 5.6l3.9 3.9L7.9 20.5H4zM16.4 4.2 18 2.6a1.4 1.4 0 0 1 2 0l1.9 1.9a1.4 1.4 0 0 1 0 2l-1.6 1.6z"/></svg>';
const SVG_MSG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4 3.5A.6.6 0 0 1 4 21z"/></svg>';
const SVG_TRASH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M20 6a1 1 0 0 1 .117 1.993l-.117 .007h-.081l-.919 11a3 3 0 0 1 -2.824 2.995l-.176 .005h-8c-1.598 0 -2.904 -1.249 -2.992 -2.75l-.005 -.167l-.923 -11.083h-.08a1 1 0 0 1 -.117 -1.993l.117 -.007zm-6 -4a2 2 0 0 1 2 2a1 1 0 0 1 -1.993 .117l-.007 -.117h-4l-.007 .117a1 1 0 0 1 -1.993 -.117a2 2 0 0 1 1.85 -1.995l.15 -.005z"/></svg>';
const SVG_X = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
// Tabler `file-sad`, filled variant — verbatim paths, as in toolbar.js.
const SVG_FILE_SAD = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2l.117 .007a1 1 0 0 1 .876 .876l.007 .117v4l.005 .15a2 2 0 0 0 1.838 1.844l.157 .006h4l.117 .007a1 1 0 0 1 .876 .876l.007 .117v9a3 3 0 0 1 -2.824 2.995l-.176 .005h-10a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005zm2.571 15.18a4.5 4.5 0 0 0 -5.142 0a1 1 0 1 0 1.142 1.64a2.5 2.5 0 0 1 2.858 0a1 1 0 0 0 1.142 -1.64m-4.565 -5.18h-.011a1 1 0 0 0 0 2h.01a1 1 0 0 0 0 -2m4 0h-.011a1 1 0 0 0 0 2h.01a1 1 0 0 0 0 -2" /><path d="M19 7h-4l-.001 -4.001z" /></svg>';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent =
    `#${POP_ID} .awd-rec{border-radius:9px;padding:9px 10px;display:flex;gap:10px;position:relative}` +
    `#${POP_ID} .awd-rec:hover{background:${COLORS.hover}}` +
    `#${POP_ID} .awd-del{opacity:0;transition:opacity .1s;color:${COLORS.weak};background:none;border:none;cursor:pointer;` +
      `display:grid;place-items:center;flex:none;border-radius:5px;padding:0}` +
    `#${POP_ID} .awd-rec:hover .awd-del{opacity:1}` +
    `#${POP_ID} .awd-del:hover{color:${COLORS.danger};background:${COLORS.dangerMuted}}` +
    `#${POP_ID} .awd-line{display:flex;align-items:flex-start;gap:6px}` +
    `#${POP_ID} .awd-line .awd-del{width:16px;height:16px;margin-top:1px}` +
    `#${POP_ID} .awd-grp{width:20px;height:20px}`;
  document.head.appendChild(s);
}

export function initChangesPopover(o = {}) {
  opts = o;
  return { open, close, toggle, isOpen: () => !!pop };
}

function esc(v) { return String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function open(records) {
  close();
  ensureStyle();
  ensureOverlayFonts();
  pop = document.createElement('div');
  pop.id = POP_ID;
  pop.style.cssText = `position:fixed;z-index:${Z + 1};width:340px;max-height:min(360px,80vh);background:${COLORS.bg};` +
    `border:1px solid ${COLORS.border};border-radius:14px;box-shadow:0 26px 64px -18px rgba(0,0,0,.85);display:flex;` +
    `flex-direction:column;overflow:hidden;font:${SIZE.base} ${FONT.sans};color:${COLORS.fg}`;

  // header — title, Copy (text), Clear (trash icon)
  const head = document.createElement('div');
  head.style.cssText = `display:flex;align-items:center;gap:8px;padding:11px 10px 11px 14px;border-bottom:1px solid ${COLORS.divider}`;
  const title = document.createElement('span'); title.textContent = 'Changes';
  title.style.cssText = `font:${SIZE.base} ${FONT.display};flex:1`;
  head.appendChild(title);

  // Hover matches the toolbar's buttons: the surface lifts, the border holds.
  const copyBtn = document.createElement('button'); copyBtn.type = 'button'; copyBtn.textContent = 'Copy';
  copyBtn.style.cssText = `font:${SIZE.sm} ${FONT.mono};color:${COLORS.label};border:1px solid ${COLORS.border};` +
    'border-radius:7px;padding:5px 11px;background:transparent;cursor:pointer;transition:background .12s,color .12s';
  copyBtn.addEventListener('mouseenter', () => { copyBtn.style.color = COLORS.fg; copyBtn.style.background = COLORS.hover; });
  copyBtn.addEventListener('mouseleave', () => { copyBtn.style.color = COLORS.label; copyBtn.style.background = 'transparent'; });
  copyBtn.addEventListener('click', () => {
    if (opts.onCopy) opts.onCopy();
    copyBtn.textContent = 'Copied';
    setTimeout(() => { if (copyBtn.isConnected) copyBtn.textContent = 'Copy'; }, 1200);
  });
  head.appendChild(copyBtn);

  if (records.length) {
    const clearBtn = document.createElement('button'); clearBtn.type = 'button'; clearBtn.title = 'Clear all';
    clearBtn.innerHTML = SVG_TRASH;
    clearBtn.style.cssText = `width:28px;height:28px;display:grid;place-items:center;color:${COLORS.weak};border:1px solid ${COLORS.border};` +
      'border-radius:7px;background:transparent;cursor:pointer;transition:background .12s,color .12s';
    clearBtn.addEventListener('mouseenter', () => { clearBtn.style.color = COLORS.danger; clearBtn.style.background = COLORS.dangerMuted; });
    clearBtn.addEventListener('mouseleave', () => { clearBtn.style.color = COLORS.weak; clearBtn.style.background = 'transparent'; });
    clearBtn.addEventListener('click', () => {
      if (window.confirm('Clear all tracked changes and comments for this page?')) { opts.onClearAll && opts.onClearAll(); close(); }
    });
    head.appendChild(clearBtn);
  }
  pop.appendChild(head);

  // list
  const list = document.createElement('div');
  list.style.cssText = 'overflow:auto;padding:6px';
  if (!records.length) {
    // Icon sits at COLORS.muted: a 24px glyph is exactly what that token is for, while
    // the sentence needs COLORS.label to clear AA at 12px.
    const empty = document.createElement('div');
    empty.style.cssText =
      'padding:26px 14px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center';
    const mark = document.createElement('span');
    mark.style.cssText = `width:24px;height:24px;display:block;flex:none;color:${COLORS.muted}`;
    mark.innerHTML = SVG_FILE_SAD;
    const msg = document.createElement('div');
    msg.style.cssText = `font:${SIZE.md} ${FONT.sans};color:${COLORS.label}`;
    msg.textContent = 'No changes yet. Edit a value or leave a comment.';
    empty.appendChild(mark);
    empty.appendChild(msg);
    list.appendChild(empty);
  } else {
    records.forEach(rec => list.appendChild(row(rec)));
  }
  pop.appendChild(list);

  document.body.appendChild(pop);
  place();
  setTimeout(() => document.addEventListener('mousedown', onDocDown, true), 0);
}

function delBtn(extraClass, svg, title, onClick) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'awd-del' + (extraClass ? ' ' + extraClass : '');
  b.title = title; b.innerHTML = svg;
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}

function row(rec) {
  const r = document.createElement('div'); r.className = 'awd-rec';
  r.addEventListener('click', () => { opts.onSelectRecord && opts.onSelectRecord(rec); close(); });

  // Chrome stays monochrome (DESIGN_SYSTEM: "semantic colors are findings, never chrome
  // decoration") — the pencil vs speech-bubble glyph already tells the two row types apart,
  // so the tint it used to carry was redundant.
  const hasComment = rec.comment && rec.comment.trim();
  const icon = document.createElement('span');
  icon.style.cssText = 'width:22px;height:22px;border-radius:6px;flex:none;display:grid;place-items:center;margin-top:1px;' +
    `background:${COLORS.active};color:${COLORS.label}`;
  icon.innerHTML = hasComment ? SVG_MSG : SVG_PENCIL;

  const body = document.createElement('div'); body.style.cssText = 'min-width:0;flex:1';

  // selector line + group delete
  const selLine = document.createElement('div'); selLine.style.cssText = 'display:flex;align-items:center;gap:6px';
  const sel = document.createElement('div');
  sel.style.cssText = `font:${SIZE.sm} ${FONT.mono};color:${COLORS.label};flex:1;` +
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  sel.textContent = rec.selector;
  sel.title = rec.selector;
  selLine.appendChild(sel);
  selLine.appendChild(delBtn('awd-grp', SVG_TRASH, 'Delete all for this element', () => opts.onDeleteRecord && opts.onDeleteRecord(rec)));
  body.appendChild(selLine);

  if (hasComment) {
    const line = document.createElement('div'); line.className = 'awd-line'; line.style.marginTop = '3px';
    // A comment is prose, not data — sans, not mono. Curly quotes: this is display text.
    const c = document.createElement('div');
    c.style.cssText = `font:${SIZE.md} ${FONT.sans};color:${COLORS.fg};flex:1;word-break:break-word`;
    c.textContent = '“' + rec.comment.trim() + '”';
    line.appendChild(c);
    line.appendChild(delBtn('', SVG_X, 'Delete comment', () => opts.onDeleteComment && opts.onDeleteComment(rec)));
    body.appendChild(line);
  }
  (rec.edits || []).forEach(e => {
    const line = document.createElement('div'); line.className = 'awd-line'; line.style.marginTop = '3px';
    // The strike-through carries "this was the old value" — the colour doesn't have to,
    // so `before` sits at COLORS.label (5.77:1) rather than a grey that fails AA at 11px.
    const d = document.createElement('div');
    d.style.cssText = `font:${SIZE.sm} ${FONT.mono};color:${COLORS.fg};flex:1;word-break:break-word`;
    d.innerHTML = esc(e.property) + ` <span style="color:${COLORS.label};text-decoration:line-through">` + esc(e.before || '—') +
      `</span><span style="color:${COLORS.muted};margin:0 5px">→</span>` + esc(e.after);
    line.appendChild(d);
    line.appendChild(delBtn('', SVG_X, 'Delete this change', () => opts.onDeleteEdit && opts.onDeleteEdit(rec, e.property)));
    body.appendChild(line);
  });

  r.appendChild(icon); r.appendChild(body);
  return r;
}

// Place above the chip; flip below if there isn't room above (never covers the toolbar).
function place() {
  const anchor = opts.getAnchor && opts.getAnchor();
  if (!anchor || !pop) return;
  const a = anchor.getBoundingClientRect();
  const w = pop.offsetWidth || 340, h = pop.offsetHeight || 240;
  let left = a.left + a.width / 2 - w / 2;
  left = Math.max(12, Math.min(window.innerWidth - w - 12, left));
  let top = a.top - h - 10;                    // above the toolbar
  if (top < 12) top = a.bottom + 10;           // no room → below it
  top = Math.max(12, Math.min(top, window.innerHeight - h - 12));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function onDocDown(e) {
  const anchor = opts.getAnchor && opts.getAnchor();
  if (pop && !pop.contains(e.target) && !(anchor && anchor.contains(e.target))) close();
}
function close() { if (!pop) return; document.removeEventListener('mousedown', onDocDown, true); pop.remove(); pop = null; }
function toggle(records) { if (pop) close(); else open(records); }
