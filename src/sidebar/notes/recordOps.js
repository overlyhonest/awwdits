// Pure operations on the notes record list. All return new arrays (immutable);
// `now` is injectable so callers/tests control timestamps.
//
// Identity is the element's *unique* positional path (via recordKey), NOT the
// selector — a selector like `strong.Yjhzub` can repeat across a page, so keying by
// it would collapse comments/edits on different instances of a reused component into
// one record. recordKey falls back to the selector only when no path is available.
import { pathToSelector } from '../../utils/helpers/domPath.js';

export function recordKey(target) {
  if (!target) return '';
  const p = target.path;
  return (Array.isArray(p) && p.length ? pathToSelector(p) : '') || target.selector || '';
}

function cloneRecords(records) {
  return records.map(r => ({ ...r, edits: (r.edits || []).map(e => ({ ...e })) }));
}

function ensureRecord(next, { selector, path, label }, now) {
  const key = recordKey({ selector, path });
  let rec = next.find(r => recordKey(r) === key);
  if (!rec) {
    rec = { selector, path: path || [], label: label || selector, comment: '', edits: [], updatedAt: now };
    next.push(rec);
  }
  return rec;
}

export function findRecord(records, key) {
  return records.find(r => recordKey(r) === key) || null;
}

// Merge a captured context fragment onto a record's context. Returns a NEW context object
// (chains shallow-merged, scalar fields overwritten) so cloned records never share state
// with their inputs.
export function mergeContext(existing, fragment) {
  if (!fragment) return existing;
  const next = { ...(existing || {}), chains: { ...((existing && existing.chains) || {}), ...(fragment.chains || {}) } };
  for (const k of ['layout', 'children', 'bbox', 'theme', 'locator']) {
    if (fragment[k] !== undefined) next[k] = fragment[k];
  }
  return next;
}

export function upsertEdit(records, { selector, path, label, property, before, after, context }, now = Date.now()) {
  const next = cloneRecords(records);
  const rec = ensureRecord(next, { selector, path, label }, now);
  const existing = rec.edits.find(e => e.property === property);
  if (existing) existing.after = after;                 // keep the original `before`
  else rec.edits.push({ property, before, after });
  rec.edits = rec.edits.filter(e => e.after !== e.before); // revert removes the edit
  if (!rec.path || !rec.path.length) rec.path = path || [];
  if (context) rec.context = mergeContext(rec.context, context);
  rec.updatedAt = now;
  return next;
}

export function setComment(records, { selector, path, label, context }, text, now = Date.now()) {
  const next = cloneRecords(records);
  const rec = ensureRecord(next, { selector, path, label }, now);
  rec.comment = text;
  if (context) rec.context = mergeContext(rec.context, context);
  rec.updatedAt = now;
  return next;
}

export function clearEdits(records, key, now = Date.now()) {
  return records.map(r => (recordKey(r) === key ? { ...r, edits: [], updatedAt: now } : r));
}

// Scope of an annotation: 'element' (default, this one only) or 'similar' (all like it).
// Stored only when the user marks it; absent means 'element'.
export function setScope(records, key, scope, now = Date.now()) {
  return records.map(r => (recordKey(r) === key ? { ...r, scope, updatedAt: now } : r));
}

// Delete a single edit (one property) from a record.
export function removeEdit(records, key, property, now = Date.now()) {
  return records.map(r =>
    recordKey(r) === key ? { ...r, edits: r.edits.filter(e => e.property !== property), updatedAt: now } : r);
}

// Delete an entire record (all edits + comment for one element).
export function removeRecord(records, key) {
  return records.filter(r => recordKey(r) !== key);
}

export function removeEmpty(records) {
  return records.filter(r => (r.comment && r.comment.trim()) || (r.edits || []).length > 0);
}

export function sortRecords(records) {
  return [...records].sort((a, b) => b.updatedAt - a.updatedAt);
}
