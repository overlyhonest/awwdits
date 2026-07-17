// The one property row every inspect section shares — the Health tab's audit-row
// language brought to inspect: a leading glyph, the value first (bright mono, the
// primary read), the role quiet beside it, and a flag/verdict pinned right. So the
// question "is this value part of the system, or a stray?" is answered in place.

import { FONT, COLOR } from '../redesign/tokens.js';
import { swatchBorder } from '../../../utils/helpers/colorHelpers.js';
import CopyValue from './CopyValue.jsx';

export const ROW = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 38,
  padding: '5px 14px',
  boxSizing: 'border-box',
};
export const LEAD = { width: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
export const VAL = { fontFamily: FONT.mono, fontSize: 13, color: COLOR.foreground, lineHeight: '16px', whiteSpace: 'nowrap' };
export const ROLE = { fontFamily: FONT.mono, fontSize: 12, color: COLOR.foregroundLabel, lineHeight: '16px', flexShrink: 0, whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' };

// ── Lead glyphs ──────────────────────────────────────────────────────────────
export function Swatch({ hex, size = 16 }) {
  return <span style={{ width: size, height: size, borderRadius: 3, backgroundColor: hex, border: `1px solid ${swatchBorder(hex)}`, boxSizing: 'border-box', flexShrink: 0 }} />;
}
export function Dot() {
  return <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: COLOR.foregroundSubtle }} />;
}
// A split disc showing the text/background pair — the contrast lead.
export function ContrastGlyph({ text, bg }) {
  return <span style={{ width: 16, height: 16, borderRadius: '50%', border: `1px solid ${swatchBorder(bg)}`, background: `linear-gradient(135deg, ${text} 0 50%, ${bg} 50% 100%)`, boxSizing: 'border-box', flexShrink: 0 }} />;
}

// ── Right-side markers ───────────────────────────────────────────────────────
export function StrayFlag({ label = 'stray' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, color: COLOR.warning, lineHeight: '14px' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: COLOR.warningSolid, flexShrink: 0 }} />
      {label}
    </span>
  );
}
export function Pill({ label, fg, bg }) {
  return (
    <span style={{ padding: '2px 6px', borderRadius: 4, fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, lineHeight: '14px', color: fg, background: bg, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export function AuditRow({ lead, value, role, flag, copy = true }) {
  if (value === undefined || value === null) return null;
  // Standard flex-ellipsis: value is a direct flex child that shrinks (flex-shrink)
  // only when the row actually overflows — never collapsing a short value.
  const valStyle = { ...VAL, flexShrink: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' };
  return (
    <div style={ROW}>
      <span style={LEAD}>{lead ?? <Dot />}</span>
      {copy
        ? <CopyValue value={value} style={valStyle} />
        : <span style={valStyle}>{value}</span>}
      {role != null && role !== '' && <span style={ROLE}>{role}</span>}
      {flag && <span style={{ marginLeft: 'auto', flexShrink: 0, paddingLeft: 8 }}>{flag}</span>}
    </div>
  );
}

export default AuditRow;
