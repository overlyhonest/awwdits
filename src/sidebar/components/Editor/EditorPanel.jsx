import { useState } from 'react';
import { IconChevronUp, IconChevronDown } from '../redesign/icons.jsx';
import { COLOR, FONT } from '../redesign/tokens.js';
import { SectionHeader } from '../Inspector/InspectorPanel.jsx';
import { ContrastGlyph, Pill } from '../Inspector/AuditRow.jsx';
import { contrastVerdict } from '../Inspector/inspectorStyles.js';
import { formatDimension } from '../../../utils/helpers/dimensionHelpers.js';

// System-native <select> styling (used for font family + weight dropdowns).
const SELECT_STYLE = {
  flex: 1, minWidth: 0, boxSizing: 'border-box',
  height: 32, background: COLOR.surface, borderRadius: 8, border: 'none', outline: 'none',
  fontFamily: FONT.mono, fontSize: 16, color: COLOR.foreground, paddingLeft: 10, paddingRight: 26,
  appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a3a3a3' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
};

// ── Google Fonts list ──────────────────────────────────────────────────────────
const GOOGLE_FONTS = [
  // Sans-serif
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Source Sans 3', 'Raleway', 'Nunito', 'Oswald', 'Ubuntu', 'Noto Sans',
  'PT Sans', 'Mulish', 'Quicksand', 'DM Sans', 'Plus Jakarta Sans',
  'Outfit', 'Figtree', 'Lexend', 'Barlow', 'Work Sans',
  'Rubik', 'Karla', 'Manrope', 'IBM Plex Sans', 'Cabin',
  // Serif
  'Playfair Display', 'Merriweather', 'PT Serif', 'Lora',
  'Libre Baskerville', 'EB Garamond', 'Cormorant', 'Crimson Text',
  'Source Serif 4', 'Fraunces',
  // Monospace
  'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'Roboto Mono',
  'IBM Plex Mono', 'Inconsolata', 'Space Mono',
  // Display
  'Bebas Neue', 'Abril Fatface', 'Pacifico', 'Dancing Script',
  'Lobster', 'Righteous', 'Permanent Marker', 'Satisfy',
];

// System-native font-family dropdown (matches the weight dropdown).
function FontFamilySelect({ value, onApply }) {
  const current = (value || '').split(',')[0].replace(/['"]/g, '').trim();
  const known = GOOGLE_FONTS.includes(current);
  return (
    <select value={known ? current : ''} onChange={e => { if (e.target.value) onApply(e.target.value); }} style={SELECT_STYLE}>
      {!known && <option value="">{current || 'Select font'}</option>}
      {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
    </select>
  );
}

// ── Dashed connector lines ─────────────────────────────────────────────────────
function DashH() {
  return (
    <div
      style={{
        flex: 1,
        height: 1,
        background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 4px, transparent 4px, transparent 8px)',
      }}
    />
  );
}

function DashVRow() {
  return (
    <div style={{ display: 'flex', width: '100%', height: 10 }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 16, paddingRight: 16, height: '100%' }}>
        <div style={{ width: 1, height: '100%', background: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 4px, transparent 4px, transparent 8px)', margin: '0 auto' }} />
      </div>
      <div style={{ width: 80 }} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 16, paddingRight: 16, height: '100%' }}>
        <div style={{ width: 1, height: '100%', background: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 4px, transparent 4px, transparent 8px)', margin: '0 auto' }} />
      </div>
    </div>
  );
}

// ── NumericInput: input + up/down stepper ──────────────────────────────────────
/**
 * @param value       - current value string (e.g. "16px", "1.5", "8")
 * @param onChange    - called on every keystroke
 * @param onApply     - called with new value on blur or stepper click
 * @param label       - optional inline label (e.g. "T", "W")
 * @param placeholder - fallback display text
 * @param step        - fixed step override (e.g. 100 for font-weight)
 * @param narrow      - if true, use fixed 80px width; otherwise flex:1
 */
function NumericInput({ value, onChange, onApply, label, placeholder, step: stepProp, narrow = false }) {
  const adjust = (delta) => {
    const raw = String(value || '');
    const num = parseFloat(raw);
    const safeNum = isNaN(num) ? 0 : num;
    // Detect unit: everything after the first numeric run
    const unitMatch = raw.match(/[a-z%]+$/i);
    const unit = unitMatch ? unitMatch[0] : 'px';
    const isDecimal = ['em', 'rem', 'lh', 'vw', 'vh'].includes(unit.toLowerCase());
    const step = stepProp ?? (isDecimal ? 0.1 : 1);
    const newNum = safeNum + delta * step;
    const formatted = step < 1
      ? parseFloat(newNum.toFixed(3)).toString() + unit
      : Math.round(newNum) + unit;
    onChange(formatted);
    onApply(formatted);
  };

  const btnStyle = {
    width: 16,
    height: 13,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: COLOR.foregroundWeak,
    flexShrink: 0,
  };

  return (
    <div
      style={{
        width: narrow ? 80 : undefined,
        flex: narrow ? undefined : 1,
        minWidth: 0,
        height: 32,
        background: COLOR.surface,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 8,
        paddingRight: 4,
        boxSizing: 'border-box',
        flexShrink: narrow ? 0 : undefined,
        gap: label ? 6 : 0,
      }}
    >
      {label && (
        <span style={{ fontSize: 13, color: COLOR.foregroundLabel, flexShrink: 0 }}>{label}</span>
      )}
      <input
        style={{
          flex: 1,
          fontSize: 16,
          color: COLOR.foreground,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          textAlign: 'left',
          minWidth: 0,
          width: '100%',
        }}
        value={value}
        placeholder={placeholder || '0'}
        onChange={e => onChange(e.target.value)}
        onBlur={() => onApply(value)}
      />
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <button
          style={btnStyle}
          onMouseEnter={e => e.currentTarget.style.color = COLOR.foreground}
          onMouseLeave={e => e.currentTarget.style.color = COLOR.foregroundWeak}
          onMouseDown={e => e.preventDefault()}
          onClick={() => adjust(+1)}
        >
          <IconChevronUp size={10} stroke={2.5} />
        </button>
        <button
          style={btnStyle}
          onMouseEnter={e => e.currentTarget.style.color = COLOR.foreground}
          onMouseLeave={e => e.currentTarget.style.color = COLOR.foregroundWeak}
          onMouseDown={e => e.preventDefault()}
          onClick={() => adjust(-1)}
        >
          <IconChevronDown size={10} stroke={2.5} />
        </button>
      </div>
    </div>
  );
}

// ── Editable W/H cell for the center box ──────────────────────────────────────
// A bare number gets `px` appended; anything else (auto, 50%, 12rem) applies as-is.
function DimCell({ label, value, onApply }) {
  const [val, setVal] = useState(value || '');
  const apply = () => {
    const v = val.trim();
    if (!v || v === value) return;
    onApply(/^[0-9.]+$/.test(v) ? `${v}px` : v);
  };
  return (
    <div style={{ height: 32, background: COLOR.surfaceHigh, paddingLeft: 8, paddingRight: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, color: COLOR.foreground, flexShrink: 0 }}>{label}</span>
      <input
        value={val}
        placeholder="—"
        onChange={e => setVal(e.target.value)}
        onBlur={apply}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        style={{
          fontSize: 16, color: COLOR.foreground, textAlign: 'center', flex: 1, minWidth: 0,
          background: 'transparent', border: 'none', outline: 'none',
        }}
      />
    </div>
  );
}

// ── Center W/H dark box for padding cross ─────────────────────────────────────
function CenterBox({ width, height, onApplyStyle }) {
  return (
    <div style={{ width: 80, background: COLOR.surface, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      <DimCell label="W" value={width} onApply={v => onApplyStyle('width', v)} />
      <div style={{ height: 1, background: COLOR.surface }} />
      <DimCell label="H" value={height} onApply={v => onApplyStyle('height', v)} />
    </div>
  );
}

// Split a border-radius shorthand into its four corners (tl tr br bl).
function parseCorners(radius) {
  const p = (radius || '0px').trim().split(/\s+/);
  const tl = p[0] || '0px';
  const tr = p[1] || tl;
  const br = p[2] || tl;
  const bl = p[3] || tr;
  return { tl, tr, br, bl };
}

// ── PaddingCross ───────────────────────────────────────────────────────────────
function PaddingCross({ styles, onApplyStyle, radius }) {
  const pad = styles?.spacing?.padding ?? {};
  const dims = styles?.dimensions;
  const displayWidth  = formatDimension(dims?.width);
  const displayHeight = formatDimension(dims?.height);
  const rc = parseCorners(radius);

  const [pTop,    setPTop]    = useState(pad.top    || '0');
  const [pBottom, setPBottom] = useState(pad.bottom || '0');
  const [pLeft,   setPLeft]   = useState(pad.left   || '0');
  const [pRight,  setPRight]  = useState(pad.right  || '0');
  // Each corner is independent — its own state + its own border-*-radius property.
  const [rTL, setRTL] = useState(rc.tl);
  const [rTR, setRTR] = useState(rc.tr);
  const [rBR, setRBR] = useState(rc.br);
  const [rBL, setRBL] = useState(rc.bl);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Row 1: TL  pTop  TR */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <NumericInput narrow value={rTL} onChange={setRTL} onApply={v => v && onApplyStyle('borderTopLeftRadius', v)} />
        <DashH />
        <NumericInput narrow value={pTop} onChange={setPTop} onApply={v => onApplyStyle('paddingTop', v)} />
        <DashH />
        <NumericInput narrow value={rTR} onChange={setRTR} onApply={v => v && onApplyStyle('borderTopRightRadius', v)} />
      </div>

      <DashVRow />

      {/* Row 3: pLeft  CenterBox  pRight */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <NumericInput narrow value={pLeft}  onChange={setPLeft}  onApply={v => onApplyStyle('paddingLeft', v)} />
        <CenterBox width={displayWidth} height={displayHeight} onApplyStyle={onApplyStyle} />
        <NumericInput narrow value={pRight} onChange={setPRight} onApply={v => onApplyStyle('paddingRight', v)} />
      </div>

      <DashVRow />

      {/* Row 5: BL  pBottom  BR */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <NumericInput narrow value={rBL} onChange={setRBL} onApply={v => v && onApplyStyle('borderBottomLeftRadius', v)} />
        <DashH />
        <NumericInput narrow value={pBottom} onChange={setPBottom} onApply={v => onApplyStyle('paddingBottom', v)} />
        <DashH />
        <NumericInput narrow value={rBR} onChange={setRBR} onApply={v => v && onApplyStyle('borderBottomRightRadius', v)} />
      </div>
    </div>
  );
}

// ── GapRow ─────────────────────────────────────────────────────────────────────
function GapRow({ value, onApplyStyle }) {
  const [val, setVal] = useState(value || '0px');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <span style={{ width: 88, fontSize: 13, color: COLOR.foregroundLabel, flexShrink: 0 }}>Gap</span>
      <NumericInput value={val} onChange={setVal} onApply={v => onApplyStyle('gap', v)} />
    </div>
  );
}

// ── MarginSection (2×2 grid) ───────────────────────────────────────────────────
function MarginSection({ margin, onApplyStyle }) {
  const { top, right, bottom, left } = margin ?? {};
  const [mTop,    setMTop]    = useState(top    || '0');
  const [mBottom, setMBottom] = useState(bottom || '0');
  const [mLeft,   setMLeft]   = useState(left   || '0');
  const [mRight,  setMRight]  = useState(right  || '0');

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
      <span style={{ width: 80, flexShrink: 0, fontSize: 13, color: COLOR.foregroundLabel, marginTop: 8 }}>Margin</span>
      <div style={{ flex: 1 }} />
      <div style={{ width: 172, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <NumericInput narrow label="T" value={mTop}    onChange={setMTop}    onApply={v => onApplyStyle('marginTop',    v)} />
          <NumericInput narrow label="B" value={mBottom} onChange={setMBottom} onApply={v => onApplyStyle('marginBottom', v)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <NumericInput narrow label="L" value={mLeft}   onChange={setMLeft}   onApply={v => onApplyStyle('marginLeft',  v)} />
          <NumericInput narrow label="R" value={mRight}  onChange={setMRight}  onApply={v => onApplyStyle('marginRight', v)} />
        </div>
      </div>
    </div>
  );
}

// ── ColorEditRow ───────────────────────────────────────────────────────────────
function ColorEditRow({ label, hex, onApply }) {
  const [val, setVal] = useState(hex || '');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <span style={{ width: 88, flexShrink: 0, fontSize: 13, color: COLOR.foregroundLabel }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0, height: 32, background: COLOR.surface, borderRadius: 8, paddingLeft: 8, paddingRight: 10, display: 'flex', alignItems: 'center', gap: 8, boxSizing: 'border-box' }}>
        {/* Rounded swatch — the hidden native color input opens the OS picker on click. */}
        <span style={{ position: 'relative', width: 20, height: 20, flexShrink: 0, display: 'block' }}>
          <span style={{ display: 'block', width: 20, height: 20, borderRadius: 6, background: val || '#000000', border: '1px solid rgba(255,255,255,0.14)', boxSizing: 'border-box' }} />
          <input
            type="color"
            value={val || '#000000'}
            onChange={e => { setVal(e.target.value); onApply(e.target.value); }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, border: 'none', padding: 0, cursor: 'pointer' }}
          />
        </span>
        <input
          style={{ flex: 1, fontSize: 16, color: COLOR.foreground, background: 'transparent', border: 'none', outline: 'none', minWidth: 0 }}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => { if (/^#[0-9a-f]{3,8}$/i.test(val)) onApply(val); }}
        />
        <IconChevronDown size={14} stroke={2} style={{ color: COLOR.foregroundMuted, flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ── Plain text edit row (for font-family input fallback / non-numeric props) ───
function TextEditRow({ label, value, onApply }) {
  const [val, setVal] = useState(value || '');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <span style={{ width: 88, flexShrink: 0, fontSize: 13, color: COLOR.foregroundLabel, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, minWidth: 0, height: 32, background: COLOR.surface, borderRadius: 8, paddingLeft: 12, paddingRight: 8, display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
        <input
          style={{ flex: 1, fontSize: 16, color: COLOR.foreground, background: 'transparent', border: 'none', outline: 'none', minWidth: 0 }}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => val && onApply(val)}
        />
      </div>
    </div>
  );
}

// ── TextContentRow (edits the element's actual text, not a style) ──────────────
function TextContentRow({ value, onApply }) {
  const [val, setVal] = useState(value ?? '');
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
      <span style={{ width: 88, flexShrink: 0, fontSize: 13, color: COLOR.foregroundLabel, marginTop: 8 }}>Text</span>
      <textarea
        rows={2}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => { if (val !== value) onApply(val); }}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 32,
          resize: 'vertical',
          background: COLOR.surface,
          borderRadius: 8,
          border: 'none',
          outline: 'none',
          fontSize: 16,
          lineHeight: '20px',
          color: COLOR.foreground,
          padding: '6px 12px',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

// ── FontWeightSelect ───────────────────────────────────────────────────────────
const FONT_WEIGHTS = [
  { value: '100', label: '100 — Thin' },
  { value: '200', label: '200 — Extra Light' },
  { value: '300', label: '300 — Light' },
  { value: '400', label: '400 — Regular' },
  { value: '500', label: '500 — Medium' },
  { value: '600', label: '600 — Semi Bold' },
  { value: '700', label: '700 — Bold' },
  { value: '800', label: '800 — Extra Bold' },
  { value: '900', label: '900 — Black' },
];

function FontWeightSelect({ value, onApply }) {
  // Normalize value: "bold"→"700", "normal"→"400", etc.
  const normalize = v => {
    if (!v) return '400';
    if (v === 'bold') return '700';
    if (v === 'normal') return '400';
    return String(Math.round(parseFloat(v) / 100) * 100) || '400';
  };
  const [val, setVal] = useState(normalize(value));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <span style={{ width: 88, flexShrink: 0, fontSize: 13, color: COLOR.foregroundLabel }}>Font weight</span>
      <select
        value={val}
        onChange={e => { setVal(e.target.value); onApply(e.target.value); }}
        style={{
          flex: 1,
          minWidth: 0,
          boxSizing: 'border-box',
          height: 32,
          background: COLOR.surface,
          borderRadius: 8,
          border: 'none',
          outline: 'none',
          fontSize: 16,
          color: COLOR.foreground,
          paddingLeft: 10,
          paddingRight: 8,
          appearance: 'none',
          WebkitAppearance: 'none',
          cursor: 'pointer',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a3a3a3' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
        }}
      >
        {FONT_WEIGHTS.map(w => (
          <option key={w.value} value={w.value}>{w.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── NumericEditRow (label + NumericInput) ──────────────────────────────────────
function NumericEditRow({ label, value, onApply, step }) {
  const [val, setVal] = useState(value || '');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <span style={{ width: 88, flexShrink: 0, fontSize: 13, color: COLOR.foregroundLabel, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <NumericInput value={val} onChange={setVal} onApply={onApply} step={step} />
    </div>
  );
}

// ── EditorPanel ────────────────────────────────────────────────────────────────
function EditorPanel({ data, onApplyStyle, onApplyText, onReset }) {
  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, padding: '0 24px' }}>
        <p style={{ fontSize: 13, color: COLOR.foregroundLabel, textAlign: 'center' }}>
          Inspect an element first, then switch to Edit
        </p>
      </div>
    );
  }

  const { styles, contrast } = data;
  const radius = styles?.border?.radius || '0px';
  // An image is a leaf visual — background color and typography don't apply, so hide them.
  const isImage = !!styles?.image;

  return (
    <div style={{ overflowX: 'hidden' }}>
      {/* ── Layout ── */}
      <div style={{ borderBottom: `1px solid ${COLOR.border}` }}>
        <SectionHeader>Layout</SectionHeader>
        <div style={{ paddingBottom: 24, paddingLeft: 16, paddingRight: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PaddingCross styles={styles} onApplyStyle={onApplyStyle} radius={radius} />

          {styles?.layout?.gap != null && (
            <GapRow value={styles.layout.gap} onApplyStyle={onApplyStyle} />
          )}

          <MarginSection margin={styles?.spacing?.margin} onApplyStyle={onApplyStyle} />

          {!isImage && <ColorEditRow label="Background" hex={styles?.colors?.backgroundColorHex} onApply={v => onApplyStyle('backgroundColor', v)} />}
          <ColorEditRow label="Border"     hex={styles?.border?.colorHex}            onApply={v => onApplyStyle('borderColor', v)} />
        </div>
      </div>

      {/* ── Typography ── */}
      {!isImage && styles?.typography && (
        <div style={{ borderBottom: `1px solid ${COLOR.border}`, display: 'flex', flexDirection: 'column' }}>
          <SectionHeader>Typography</SectionHeader>
          <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Text content — only editable for leaf text elements */}
            {styles.typography.text != null && (
              <TextContentRow
                value={styles.typography.text}
                onApply={v => onApplyText?.(v)}
              />
            )}

            {/* Font family — system dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <span style={{ width: 88, flexShrink: 0, fontSize: 13, color: COLOR.foregroundLabel }}>Font family</span>
              <FontFamilySelect
                value={styles.typography.fontFamily}
                onApply={v => onApplyStyle('fontFamily', v)}
              />
            </div>

            <NumericEditRow
              label="Font size"
              value={styles.typography.fontSize}
              onApply={v => onApplyStyle('fontSize', v)}
            />
            <FontWeightSelect
              value={styles.typography.fontWeight}
              onApply={v => onApplyStyle('fontWeight', v)}
            />
            <NumericEditRow
              label="Line height"
              value={styles.typography.lineHeight}
              onApply={v => onApplyStyle('lineHeight', v)}
            />
            <TextEditRow
              label="Letter spacing"
              value={styles.typography.letterSpacing}
              onApply={v => onApplyStyle('letterSpacing', v)}
            />
            <ColorEditRow
              label="Text color"
              hex={styles.typography.colorHex}
              onApply={v => onApplyStyle('color', v)}
            />
          </div>
        </div>
      )}

      {/* ── Contrast ── */}
      {!isImage && contrast && (
        <div>
          <SectionHeader>Contrast</SectionHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 16px 16px' }}>
            <ContrastGlyph text={contrast.textColor} bg={contrast.bgColor} />
            <span style={{ fontFamily: FONT.mono, fontSize: 16, fontWeight: 500, color: COLOR.foreground, lineHeight: '20px' }}>{contrast.ratioLabel}</span>
            <span style={{ fontFamily: FONT.mono, fontSize: 13, color: COLOR.foregroundLabel, lineHeight: '17px' }}>Contrast</span>
            {(() => { const v = contrastVerdict(contrast.ratio); return <span style={{ marginLeft: 'auto', flexShrink: 0 }}><Pill label={v.label} fg={v.fg} bg={v.bg} /></span>; })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default EditorPanel;
