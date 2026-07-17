// Render notes records to LLM-friendly plain text: a markdown-ish block per element
// headed by its class-based selector, the comment, and a list of CSS before→after
// edits. The positional nth-child path is intentionally omitted — it's unstable
// (shifts when siblings are added/removed) and less useful than the class; the path
// is still kept on the record for re-locating pins, just not exported.
export function formatRecord(record) {
  const lines = [`## ${record.selector}`];
  const c = record.comment && record.comment.trim();
  if (c) lines.push(`Comment: "${c}"`);
  if (record.edits && record.edits.length) {
    lines.push('Changes:');
    for (const e of record.edits) lines.push(`  - ${e.property}: ${e.before || '(none)'} → ${e.after}`);
  }
  return lines.join('\n');
}

export function formatAll(records) {
  return records.map(formatRecord).join('\n\n');
}
