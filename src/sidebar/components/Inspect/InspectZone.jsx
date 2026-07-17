import { useRef, useLayoutEffect } from 'react';
import { FONT, COLOR } from '../redesign/tokens.js';
import InspectorPanel from '../Inspector/InspectorPanel.jsx';
import EditorPanel from '../Editor/EditorPanel.jsx';
import InspectEmptyState from '../redesign/InspectEmptyState.jsx';

// ── DOM path bar (breadcrumb + clear + switch hint) ──────────────────────────────
function PathBar({ element, ancestors, onSelectAncestor }) {
  const scrollRef = useRef(null);

  // Keep the selected (right-most) item in view by default.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [element, ancestors]);

  return (
    <div style={{ borderBottom: `1px solid ${COLOR.border}`, flexShrink: 0 }}>
      {/* Path row — h-40, px-8 (Figma) */}
      <div style={{ display: 'flex', alignItems: 'stretch', height: 40, padding: '0 8px' }}>
        <div ref={scrollRef} className="breadcrumb-scroll" style={{
          flex: 1,
          overflowX: 'auto',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            {ancestors.map((anc, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => onSelectAncestor(anc.steps)}
                  className="awd-crumb awd-nav"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    lineHeight: '16px',
                    color: COLOR.foregroundLabel,
                    padding: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {anc.label}
                </button>
                <span style={{ color: COLOR.foregroundSubtle, fontSize: 11 }}>/</span>
              </span>
            ))}
            <span style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              lineHeight: '16px',
              color: COLOR.foreground,
              whiteSpace: 'nowrap',
            }}>
              {element.selector || element.tag || 'element'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── InspectZone ──────────────────────────────────────────────────────────────────
function InspectZone({
  selected,
  selectionId,
  editMode,
  manualArmed,
  onManualPick,
  onSelectAncestor,
  onApplyStyle,
  onApplyText,
}) {
  if (!selected) {
    return <InspectEmptyState manualArmed={manualArmed} onPickManually={onManualPick} />;
  }

  const element = selected?.styles?.element;
  const ancestors = selected?.ancestors ?? [];

  return (
    <div>
      {element && (
        <PathBar
          element={element}
          ancestors={ancestors}
          onSelectAncestor={onSelectAncestor}
        />
      )}
      {editMode ? (
        <EditorPanel
          key={selectionId}
          data={selected}
          onApplyStyle={onApplyStyle}
          onApplyText={onApplyText}
        />
      ) : (
        <InspectorPanel data={selected} />
      )}
    </div>
  );
}

export default InspectZone;
