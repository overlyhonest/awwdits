// Border / Background / Effects / Image rows. Label on the left (starting at the
// row edge — no lead column), value on the right. For colors, the swatch is
// grouped with the hex on the right, not floated off to the left.

import { FONT, COLOR } from '../redesign/tokens.js';
import { ROW, Swatch } from './AuditRow.jsx';
import CopyValue from './CopyValue.jsx';

const LABEL_LEFT = { fontFamily: FONT.mono, fontSize: 13, color: COLOR.foregroundLabel, lineHeight: '20px', flexShrink: 0 };
const VALUE_RIGHT = {
  fontFamily: FONT.mono, fontSize: 16, fontWeight: 500, color: COLOR.foreground, lineHeight: '20px',
  marginLeft: 'auto', textAlign: 'right', flexShrink: 1, minWidth: 0,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

export function PropRow({ label, value, muted }) {
  if (value === undefined || value === null) return null;
  return (
    <div style={ROW}>
      <span style={LABEL_LEFT}>{label}</span>
      {muted
        ? <span style={{ ...VALUE_RIGHT, color: COLOR.foregroundSubtle }}>{value}</span>
        : <CopyValue value={value} style={VALUE_RIGHT} />}
    </div>
  );
}

export function ColorRow({ label, hex }) {
  if (!hex || hex === 'transparent') return null;
  return (
    <div style={ROW}>
      <span style={LABEL_LEFT}>{label}</span>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Swatch hex={hex} size={14} />
        <CopyValue value={hex} style={{ ...VALUE_RIGHT, marginLeft: 0 }} />
      </span>
    </div>
  );
}
