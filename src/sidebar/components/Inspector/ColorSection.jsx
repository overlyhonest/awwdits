import { swatchBorder } from '../../../utils/helpers/colorHelpers.js';
import { FONT, COLOR } from '../redesign/tokens.js';
import { contrastVerdict } from './inspectorStyles.js';
import { ContrastGlyph, Pill } from './AuditRow.jsx';
import CopyValue from './CopyValue.jsx';

function isRelevant(hex) {
  return hex && hex !== 'transparent' && !hex.includes('rgba(0, 0, 0, 0)');
}

// A large swatch over its hex + role. Color is visual, so the swatch leads.
function SwatchCard({ hex, role }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ height: 46, borderRadius: 6, backgroundColor: hex, border: `1px solid ${swatchBorder(hex)}`, boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 7 }}>
        <CopyValue value={hex} style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 500, color: COLOR.foreground, lineHeight: '20px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} />
        <span style={{ fontFamily: FONT.mono, fontSize: 13, color: COLOR.foregroundLabel, lineHeight: '17px' }}>{role}</span>
      </div>
    </div>
  );
}

function ColorSection({ colors, contrast }) {
  const showBg = colors && isRelevant(colors.backgroundColorHex) && colors.backgroundColorHex !== '#000000';
  const showText = colors && isRelevant(colors.colorHex);

  const textColor = contrast?.textColor || (showText ? colors.colorHex : null);
  const bgColor = contrast?.bgColor || (showBg ? colors.backgroundColorHex : null);

  const textRole = contrast?.textToken || (colors?.colorToken ? colors.colorToken.replace('--', '') : 'text');
  const bgRole = contrast?.bgToken || (colors?.backgroundToken ? colors.backgroundToken.replace('--', '') : 'background');

  const verdict = contrast ? contrastVerdict(contrast.ratio) : null;

  return (
    <div style={{ padding: '4px 16px 16px' }}>
      {(textColor || bgColor) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {textColor && <SwatchCard hex={textColor} role={textRole} />}
          {bgColor && <SwatchCard hex={bgColor} role={bgRole} />}
        </div>
      )}

      {contrast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 14 }}>
          <ContrastGlyph text={contrast.textColor} bg={contrast.bgColor} />
          <CopyValue value={contrast.ratioLabel} style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 500, color: COLOR.foreground, lineHeight: '20px' }} />
          <span style={{ fontFamily: FONT.mono, fontSize: 13, color: COLOR.foregroundLabel, lineHeight: '17px' }}>contrast</span>
          <span style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <Pill label={verdict.label} fg={verdict.fg} bg={verdict.bg} />
          </span>
        </div>
      )}
    </div>
  );
}

export default ColorSection;
