import { FONT, COLOR } from '../redesign/tokens.js';
import CopyValue from './CopyValue.jsx';

// Typography's own layout: a specimen (an "Aa" in the element's real face + the
// family name) over a two-column metric grid. The grid gives each value its own
// cell, so nothing truncates — the readability problem the audit row had here.
function TypographyProperties({ typography }) {
  if (!typography) return null;

  const fontFamily = (typography.fontFamily || '').split(',')[0].replace(/['"]/g, '').trim();
  const faceStack = `"${fontFamily}", system-ui, sans-serif`;
  const fontWeight = typography.fontWeight || '400';
  const fontWeightLabel =
    fontWeight === '100' ? 'Thin' :
    fontWeight === '200' ? 'Extra Light' :
    fontWeight === '300' ? 'Light' :
    fontWeight === '400' || fontWeight === 'normal' ? 'Regular' :
    fontWeight === '500' ? 'Medium' :
    fontWeight === '600' ? 'Semi Bold' :
    fontWeight === '700' || fontWeight === 'bold' ? 'Bold' :
    fontWeight === '800' ? 'Extra Bold' :
    fontWeight === '900' ? 'Black' : fontWeight;
  const numericWeight = fontWeight === 'bold' ? '700' : fontWeight === 'normal' ? '400' : fontWeight;

  const letterSpacing =
    !typography.letterSpacing || typography.letterSpacing === '0px' || typography.letterSpacing === 'normal'
      ? '0em' : typography.letterSpacing;
  const textAlign = typography.textAlign || 'left';

  const fontSizePx = parseFloat(typography.fontSize) || 16;
  const lh = typography.lineHeight || '';
  let lineHeightPx = lh;
  let lineMult = '';
  if (lh && !lh.includes('px')) {
    const n = parseFloat(lh);
    if (!isNaN(n)) { lineHeightPx = Math.round(n * fontSizePx) + 'px'; lineMult = n.toFixed(1) + '×'; }
  } else if (lh.includes('px')) {
    const n = parseFloat(lh);
    if (!isNaN(n) && fontSizePx > 0) lineMult = (n / fontSizePx).toFixed(1) + '×';
  }

  const metrics = [
    { label: 'Size', value: typography.fontSize },
    { label: 'Line height', value: lineHeightPx, suffix: lineMult },
    { label: 'Weight', value: numericWeight, suffix: fontWeightLabel },
    { label: 'Tracking', value: letterSpacing },
    { label: 'Align', value: textAlign, copy: false },
  ];

  return (
    <div style={{ padding: '4px 16px 16px' }}>
      {/* Specimen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 16, minWidth: 0 }}>
        <span style={{ fontFamily: faceStack, fontSize: 30, fontWeight: 500, color: COLOR.foreground, lineHeight: 1, flexShrink: 0 }}>Aa</span>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <CopyValue
            value={fontFamily}
            style={{ fontFamily: faceStack, fontSize: 17, fontWeight: 500, color: COLOR.foreground, lineHeight: '21px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          />
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: COLOR.foregroundLabel, lineHeight: '14px' }}>
            {fontWeightLabel} · {numericWeight}
          </span>
        </div>
      </div>

      {/* Metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 13, color: COLOR.foregroundLabel, lineHeight: '17px' }}>
              {m.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
              {m.copy === false
                ? <span style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 500, color: COLOR.foreground, lineHeight: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.value}</span>
                : <CopyValue value={m.value} style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 500, color: COLOR.foreground, lineHeight: '20px', display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }} />}
              {m.suffix && <span style={{ fontFamily: FONT.mono, fontSize: 13, color: COLOR.foregroundLabel, lineHeight: '17px', flexShrink: 0 }}>{m.suffix}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TypographyProperties;
