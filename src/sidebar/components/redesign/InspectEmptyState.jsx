import { FONT, COLOR, MOD } from './tokens.js';
import { IconCurrentLocation, IconClick } from './icons.jsx';

// Brand gradient for the disc mark (light-pink → hot-magenta → coral-orange,
// reproduced from the Figma image fill). Theme-independent; white glyph on top.
const MARK_GRADIENT = 'linear-gradient(135deg, #F7CFEC 0%, #FF3E97 42%, #FF6E77 68%, #FF9A5A 100%)';

// Inspect tab — empty state (the panel's landing screen before any selection).
// Built to the Figma design (nodes 2093:1241 dark / 2093:1200 light): an inverted
// disc + locate mark, a Special Gothic Expanded One headline, a Special Gothic
// supporting line, and a "Pick element manually" secondary button.
//
// `manualArmed` reflects the manual-pick flow once triggered: the button becomes
// a passive "Waiting for click…" state until an element is picked.
function InspectEmptyState({ mod = MOD, manualArmed = false, onPickManually, minimized = false }) {
  if (minimized) {
    return (
      <div className="awd-empty" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px', width: '100%', boxSizing: 'border-box', borderBottom: `1px solid ${COLOR.border}` }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: MARK_GRADIENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconCurrentLocation size={16} stroke={1.75} />
        </div>
        <span style={{ fontFamily: FONT.display, fontWeight: 400, fontSize: 13, color: COLOR.foreground }}>Read any element</span>
        <button type="button" onClick={onPickManually} disabled={manualArmed} className="awd-btn" style={{ marginLeft: 'auto', height: 30, padding: '0 12px', borderRadius: 8, background: COLOR.surface, border: `1px solid ${COLOR.borderStrong}`, color: COLOR.foreground, fontFamily: FONT.display, fontSize: 12, cursor: manualArmed ? 'default' : 'pointer', flexShrink: 0 }}>
          {manualArmed ? 'Waiting…' : 'Pick element'}
        </button>
      </div>
    );
  }
  return (
    <div
      className="awd-empty"
      style={{
        display: 'flex',
        flex: '1 0 0',
        minHeight: 0,
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
        padding: '80px 40px 13px',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, width: '100%' }}>
        {/* Inverted disc + locate mark (foreground disc, background glyph) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: MARK_GRADIENT,
            color: '#ffffff',
          }}
        >
          <IconCurrentLocation size={24} stroke={1.75} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, width: '100%' }}>
          {/* Headline + supporting copy */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', textAlign: 'center' }}>
            <p
              style={{
                margin: 0,
                width: '100%',
                fontFamily: FONT.display,
                fontWeight: 400,
                fontSize: 20,
                lineHeight: 1.3,
                color: COLOR.foreground,
              }}
            >
              Read any element,
              <br />
              down to the pixel.
            </p>
            <p
              style={{
                margin: 0,
                width: '100%',
                fontFamily: FONT.mono,
                fontWeight: 500,
                fontSize: 13,
                lineHeight: 1.6,
                color: COLOR.foregroundLabel,
              }}
            >
              {mod}+click to inspect. Hover a neighbor to measure the space between.
            </p>
          </div>

          {/* Full-width divider */}
          <div style={{ width: '100%', height: 0, borderTop: `1px solid ${COLOR.border}` }} />

          {/* Fallback: secondary button + hint */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
            <button
              type="button"
              onClick={onPickManually}
              disabled={manualArmed}
              className="awd-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 40,
                padding: '0 16px 0 14px',
                borderRadius: 8,
                background: COLOR.surface,
                border: `1px solid ${COLOR.borderStrong}`,
                color: COLOR.foreground,
                cursor: manualArmed ? 'default' : 'pointer',
                opacity: manualArmed ? 0.7 : 1,
              }}
            >
              <IconClick size={20} stroke={1.75} />
              <span
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 400,
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                }}
              >
                {manualArmed ? 'Waiting for click…' : 'Pick element manually'}
              </span>
            </button>
            <p
              style={{
                margin: 0,
                fontFamily: FONT.mono,
                fontWeight: 500,
                fontSize: 11,
                textAlign: 'center',
                color: COLOR.foregroundLabel,
              }}
            >
              For pages that block {mod}+click
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InspectEmptyState;
