import { FONT, COLOR } from '../redesign/tokens.js';
import CopyValue from './CopyValue.jsx';

// Two data values per row (name + resolved), so this keeps its own shape rather
// than the value/role audit row — but matches the audit rhythm (height, padding).
function CssVariablesSection({ variables }) {
  if (!variables || variables.length === 0) return null;

  return (
    <div style={{ paddingBottom: 6 }}>
      {variables.map((v, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            minHeight: 38,
            padding: '5px 14px',
            gap: 10,
            boxSizing: 'border-box',
          }}
        >
          {/* Variable name — muted mono (was an accent blue that meant nothing).
              Each side copies independently, so the hover now delivers on itself. */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <CopyValue
              value={v.variable}
              style={{
                display: 'inline-block',
                maxWidth: '100%',
                fontFamily: FONT.mono,
                fontSize: 11,
                color: COLOR.foregroundLabel,
                lineHeight: '14px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                verticalAlign: 'bottom',
              }}
            />
          </div>
          <CopyValue
            value={v.resolvedValue}
            style={{
              fontFamily: FONT.mono,
              fontSize: 13,
              color: COLOR.foreground,
              lineHeight: '16px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default CssVariablesSection;
