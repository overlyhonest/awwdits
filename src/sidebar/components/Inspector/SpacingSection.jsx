import { LABEL, VALUE } from './inspectorStyles.js';
import { FONT, COLOR } from '../redesign/tokens.js';
import { isStray } from '../../../utils/analyzers/strayDetector.js';
import CopyValue from './CopyValue.jsx';

function parseVal(v) {
  if (!v) return '0';
  const n = parseFloat(v);
  return Number.isNaN(n) ? '0' : Math.round(n) + '';
}

// Coral is the margin's own colour in the box model (devtools convention); padding
// and content stay neutral. Fixed hex — a data-viz accent, not a theme role.
const MARGIN_COLOR = '#f0917d';

// A per-side spacing number. 13px/medium per the Figma; zero recedes. Margin coral.
function EdgeNum({ value, margin }) {
  if (value == null) return null;
  const n = parseVal(value);
  const color = n === '0' ? COLOR.foregroundSubtle : (margin ? MARGIN_COLOR : COLOR.foreground);
  return <span style={{ fontFamily: FONT.mono, fontSize: 13, fontWeight: 500, lineHeight: 1, color }}>{n}</span>;
}

// Box-label ("margin" / "padding"), 11px, top-left of each box.
const TAG_BASE = {
  position: 'absolute', top: 6, fontFamily: FONT.mono, fontSize: 11,
  color: COLOR.foregroundLabel, lineHeight: 1, letterSpacing: '0.01em',
};

// Corner radius numbers, 12px muted, at the outer box's corners.
function parseRadius(v) {
  if (!v) return null;
  const parts = v.trim().split(/\s+/).map(p => Math.round(parseFloat(p)) || 0);
  if (parts.every(n => n === 0)) return null;
  let tl, tr, br, bl;
  switch (parts.length) {
    case 1: tl = tr = br = bl = parts[0]; break;
    case 2: tl = br = parts[0]; tr = bl = parts[1]; break;
    case 3: tl = parts[0]; tr = bl = parts[1]; br = parts[2]; break;
    default: [tl, tr, br, bl] = parts;
  }
  return { tl, tr, br, bl };
}
const R_BASE = { position: 'absolute', fontFamily: FONT.mono, fontSize: 12, color: COLOR.foregroundLabel, lineHeight: 1 };
const R_TL = { ...R_BASE, top: 11, left: 11 };
const R_TR = { ...R_BASE, top: 11, right: 11 };
const R_BR = { ...R_BASE, bottom: 11, right: 11 };
const R_BL = { ...R_BASE, bottom: 11, left: 11 };

const COL = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const ROW = { display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center' };

function BoxModel({ spacing, dimensions, border }) {
  const pad = spacing?.padding ?? {};
  const mar = spacing?.margin ?? {};
  const width  = dimensions ? Math.round(parseFloat(dimensions.width))  : null;
  const height = dimensions ? Math.round(parseFloat(dimensions.height)) : null;
  const hasDims = Number.isFinite(width) && Number.isFinite(height);
  const radius = parseRadius(border?.radius);

  return (
    // Outer (margin) box — dashed, rounded-16, coral margin numbers, radius at corners.
    <div style={{ ...COL, position: 'relative', gap: 10, padding: '16px 41px', border: `1px dashed ${COLOR.foregroundSubtle}`, borderRadius: 16 }}>
      <span style={{ ...TAG_BASE, left: 32, color: MARGIN_COLOR }}>margin</span>
      {radius && (
        <>
          {radius.tl > 0 && <span style={R_TL}>{radius.tl}</span>}
          {radius.tr > 0 && <span style={R_TR}>{radius.tr}</span>}
          {radius.br > 0 && <span style={R_BR}>{radius.br}</span>}
          {radius.bl > 0 && <span style={R_BL}>{radius.bl}</span>}
        </>
      )}

      <EdgeNum value={mar.top} margin />
      <div style={ROW}>
        <EdgeNum value={mar.left} margin />

        {/* Padding box — theme wash, dashed, rounded-8. */}
        <div style={{ ...COL, position: 'relative', gap: 16, padding: '7px 16px', background: COLOR.boxFill, border: `1px dashed ${COLOR.foregroundSubtle}`, borderRadius: 8 }}>
          <span style={{ ...TAG_BASE, top: 5, left: 5 }}>padding</span>
          <EdgeNum value={pad.top} />
          <div style={ROW}>
            <EdgeNum value={pad.left} />
            {/* Content box — 104×44, dimensions in semibold mono. */}
            <div style={{ width: 104, height: 44, background: COLOR.surfaceHigh, border: `1px solid ${COLOR.borderStrong}`, borderRadius: 2, display: 'grid', placeItems: 'center' }}>
              {hasDims
                ? <CopyValue value={`${width}×${height}`} copyText={`${width}px × ${height}px`} style={{ fontFamily: FONT.mono, fontSize: 13, fontWeight: 600, color: COLOR.foreground, lineHeight: 1 }} />
                : <span style={{ fontFamily: FONT.mono, fontSize: 13, color: COLOR.foregroundLabel }}>—</span>}
            </div>
            <EdgeNum value={pad.right} />
          </div>
          <EdgeNum value={pad.bottom} />
        </div>

        <EdgeNum value={mar.right} margin />
      </div>
      <EdgeNum value={mar.bottom} margin />
    </div>
  );
}

// One cell of the Display / Radius / Align row — label 12px, value 13px/medium mono.
function LayoutCell({ label, value }) {
  const stray = isStray(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 72px', minWidth: 0 }}>
      <span style={LABEL}>{label}</span>
      {stray ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONT.mono, fontSize: 13, lineHeight: '16px', color: COLOR.warning }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: COLOR.warning, flexShrink: 0 }} />
          {value}
        </span>
      ) : (
        <CopyValue value={value} style={{ ...VALUE, fontWeight: 500 }} />
      )}
    </div>
  );
}

function SpacingSection({ styles }) {
  if (!styles) return null;

  const { spacing, dimensions, layout, border } = styles;
  const gap = layout?.gap;
  const radius = border?.radius;
  const hasRadius = radius && radius.split(/\s+/).some(p => parseFloat(p) > 0 || p.includes('%'));

  return (
    <div>
      {/* Box model — 16px gutter (px-16), a touch of top space. */}
      <div style={{ padding: '4px 16px 0' }}>
        <BoxModel spacing={spacing} dimensions={dimensions} border={border} />
      </div>

      {/* Layout properties — p-16, wrap gracefully as cells are added. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 16px', padding: 16 }}>
        {layout?.display && <LayoutCell label="Display" value={layout.display} />}
        {layout?.flexDirection && <LayoutCell label="Direction" value={layout.flexDirection} />}
        {gap && <LayoutCell label="Gap" value={gap} />}
        {hasRadius && <LayoutCell label="Radius" value={radius} />}
        {layout?.alignItems && <LayoutCell label="Align" value={layout.alignItems} />}
      </div>
    </div>
  );
}

export default SpacingSection;
