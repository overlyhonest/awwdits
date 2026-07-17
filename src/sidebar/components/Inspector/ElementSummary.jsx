import { FONT, COLOR } from '../redesign/tokens.js';
import CopyValue from './CopyValue.jsx';

// The panel's title row. The element's name leads (the thing you came to look at);
// an amber stray count sits to the side, present only when the element strays off
// the grid. Dimensions live in the box model below, so they don't repeat here.
function ElementSummary({ styles }) {
  const el = styles?.element;
  if (!el) return null;
  const selector = el.selector || el.tag || 'element';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      height: 40,
      padding: '0 16px',
      borderBottom: `1px solid ${COLOR.border}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <CopyValue
          value={selector}
          style={{
            display: 'block',
            fontFamily: FONT.mono,
            fontSize: 16,
            fontWeight: 500,
            color: COLOR.foreground,
            lineHeight: '20px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        />
      </div>

    </div>
  );
}

export default ElementSummary;
