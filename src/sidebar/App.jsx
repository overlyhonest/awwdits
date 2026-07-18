import { useState, useEffect, useCallback, useRef } from 'react';
import { MESSAGES } from '../utils/constants.js';
import InspectZone from './components/Inspect/InspectZone.jsx';
import { FONT, COLOR } from './components/redesign/tokens.js';
import { IconGripVertical, IconPencil, IconCheck, IconMessage, IconCaretRight, XIcon } from './components/redesign/icons.jsx';
import { upsertEdit, setComment as setCommentOp, clearEdits, removeEmpty, findRecord, removeEdit, removeRecord, recordKey, setScope } from './notes/recordOps.js';
import { loadNotes, saveNotes } from './notes/notesStorage.js';

function App() {
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectionId, setSelectionId] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [manualArmed, setManualArmed] = useState(false);
  const [notes, setNotes] = useState([]);
  const [pageUrl, setPageUrl] = useState('');
  const pageUrlRef = useRef('');
  const hydratedUrlRef = useRef(null);

  const postToContent = useCallback((type, data = {}) => {
    window.parent.postMessage({ type, ...data }, '*');
  }, []);

  useEffect(() => {
    // Load notes for a URL exactly once per URL. Guarded via a ref, not the
    // `pageUrl` state, because handleMessage is created once (effect deps are
    // [postToContent], a stable callback) — a captured `pageUrl` would be
    // permanently stale. Shared by PAGE_DATA (scan ok) and SCAN_ERROR (scan
    // failed) so notes still load/persist when the page scan throws.
    function loadNotesForUrl(url) {
      if (url && url !== pageUrlRef.current) {
        pageUrlRef.current = url;
        setPageUrl(url);
        loadNotes(url).then(records => {
          if (url !== pageUrlRef.current) return; // superseded by a newer navigation
          hydratedUrlRef.current = url; // notes for this URL are now loaded
          setNotes(records);
        });
      }
    }
    function handleMessage(e) {
      if (!e.data || !e.data.type) return;
      switch (e.data.type) {
        case MESSAGES.PAGE_DATA:
          loadNotesForUrl(e.data.data?.url);
          break;
        case 'AWWDITS_SCAN_ERROR':
          loadNotesForUrl(e.data.data?.url);
          break;
        case MESSAGES.ELEMENT_SELECTED:
          setSelectedElement(e.data.data);
          setSelectionId(c => c + 1);
          setManualArmed(false);
          // Edit mode persists as you move between elements.
          break;
        case MESSAGES.CLEAR_SELECTION:
          setSelectedElement(null);
          setEditMode(false);
          setManualArmed(false);
          break;
        case MESSAGES.CHANGE_APPLIED:
          setNotes(prev => removeEmpty(upsertEdit(prev, e.data.data)));
          break;
        case MESSAGES.CHANGES_CLEARED:
          setNotes(prev => removeEmpty(clearEdits(prev, recordKey(e.data.data))));
          break;
        case MESSAGES.COMMENT_SAVED: {
          const { selector, path, label, text, context } = e.data.data;
          setNotes(prev => removeEmpty(setCommentOp(prev, { selector, path, label, context }, text)));
          break;
        }
        case MESSAGES.CLEAR_ALL_CHANGES:
          setNotes([]);
          break;
        case MESSAGES.DELETE_RECORD:
          setNotes(prev => removeEmpty(removeRecord(prev, recordKey(e.data.data))));
          break;
        case MESSAGES.DELETE_EDIT:
          setNotes(prev => removeEmpty(removeEdit(prev, recordKey(e.data.data), e.data.data.property)));
          break;
        case MESSAGES.DELETE_COMMENT:
          setNotes(prev => removeEmpty(setCommentOp(prev, { selector: e.data.data.selector, path: e.data.data.path, label: e.data.data.selector }, '')));
          break;
        case MESSAGES.SET_SCOPE:
          setNotes(prev => setScope(prev, recordKey(e.data.data), e.data.data.scope));
          break;
      }
    }
    window.addEventListener('message', handleMessage);
    postToContent(MESSAGES.SIDEBAR_READY);
    return () => window.removeEventListener('message', handleMessage);
  }, [postToContent]);

  // Persist notes (empties pruned) whenever they change — but only once notes
  // for the current URL have loaded (hydratedUrlRef === pageUrl), so we never
  // overwrite stored notes with a pre-hydration snapshot (mount) or the prior
  // URL's notes (SPA nav) before loadNotes resolves.
  useEffect(() => {
    if (!pageUrl || hydratedUrlRef.current !== pageUrl) return;
    saveNotes(pageUrl, removeEmpty(notes));
  }, [notes, pageUrl]);

  // Mirror commented elements to the on-page pins AND push a changes summary to
  // the toolbar (count + full records) whenever notes change. Gated on hydration so
  // the mount-time empty snapshot doesn't post a 0→N flicker before notes load.
  useEffect(() => {
    if (!pageUrl || hydratedUrlRef.current !== pageUrl) return;
    // Creation order (records are appended on first touch, never reordered) so the export
    // numbers them stably: the first annotation is always [1]. NOT recency-sorted, which
    // made the newest jump to [1].
    const shown = removeEmpty(notes);
    postToContent(MESSAGES.RENDER_COMMENTS, {
      comments: shown
        .filter(n => n.comment && n.comment.trim())
        .map(n => ({ selector: n.selector, path: n.path, comment: n.comment })),
    });
    postToContent(MESSAGES.CHANGES_SUMMARY, { count: shown.length, records: shown });
  }, [notes, postToContent]);

  const currentTarget = useCallback(() => {
    const el = selectedElement?.styles?.element;
    if (!el) return null;
    return { selector: el.selector, path: el.path || [], label: el.selector };
  }, [selectedElement]);

  const currentComment = (() => {
    const t = currentTarget();
    const rec = t && findRecord(notes, recordKey(t));
    return rec?.comment || '';
  })();

  const handleClearSelection = useCallback(() => {
    setSelectedElement(null);
    setEditMode(false);
    setManualArmed(false);
    postToContent(MESSAGES.CLEAR_SELECTION);
  }, [postToContent]);

  const handleManualPick = useCallback(() => {
    setManualArmed(true);
    postToContent(MESSAGES.ARM_MANUAL_PICK);
  }, [postToContent]);

  const toggleEdit = useCallback(() => {
    if (!selectedElement) return;
    setEditMode(v => !v);
  }, [selectedElement]);

  const selectAncestor = useCallback((steps) => {
    postToContent(MESSAGES.SELECT_ANCESTOR, { steps });
  }, [postToContent]);

  const applyStyle = useCallback((property, value) => {
    postToContent(MESSAGES.APPLY_STYLE, { property, value });
  }, [postToContent]);

  const applyText = useCallback((value) => {
    postToContent(MESSAGES.APPLY_TEXT, { value });
  }, [postToContent]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      borderRadius: 16,
      background: COLOR.background,
      fontFamily: FONT.mono,
      fontSize: 12,
      lineHeight: '16px',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      fontSynthesis: 'none',
    }}>

      {/* Header — back, wordmark, comment, edit (pencil). Whole-widget close lives
          in the toolbar now; the back chevron already deselects. Drag handle
          lives outside the iframe. */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        height: 56,
        padding: '0 8px',
        borderBottom: `1px solid ${COLOR.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            onMouseDown={(e) => { e.preventDefault(); postToContent(MESSAGES.PANEL_DRAG_START, { screenX: e.screenX, screenY: e.screenY }); }}
            title="Drag to move"
            style={{ display: 'flex', alignItems: 'center', color: COLOR.foregroundWeak, flexShrink: 0, cursor: 'grab' }}
          >
            <IconGripVertical size={18} stroke={1.75} />
          </span>
          {/* Wordmark, then a breadcrumb crumb for the screen you're on. Edit is a mode
              layered over the selection, so it earns a crumb; inspect is the resting
              state and doesn't. The caret is muted — it's punctuation, not a step. */}
          <span style={{
            fontFamily: FONT.display,
            fontWeight: 400,
            fontSize: 13,
            color: COLOR.foreground,
          }}>
            {selectedElement ? 'awwditing' : 'awwdits'}
          </span>
          {editMode && (
            <>
              <IconCaretRight size={12} style={{ color: COLOR.foregroundMuted, flexShrink: 0 }} />
              <span style={{
                fontFamily: FONT.display,
                fontWeight: 400,
                fontSize: 13,
                color: COLOR.foreground,
              }}>
                Edit
              </span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {/* Commenting is an inspect-screen action — the edit screen keeps only the
              check that leaves it. */}
          {selectedElement && !editMode && (
            <button
              onClick={() => postToContent(MESSAGES.OPEN_COMMENT_COMPOSER)}
              title={currentComment ? 'Edit comment' : 'Add comment'}
              className="awd-iconbtn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, color: currentComment ? COLOR.foreground : COLOR.foregroundMuted }}
            >
              {/* Always the filled glyph (the design system's variant); the
                  has-comment state reads from colour above, not the icon. */}
              <IconMessage size={20} />
            </button>
          )}
          {selectedElement && (
            <button
              onClick={toggleEdit}
              title={editMode ? 'Done editing' : 'Edit styles'}
              className="awd-iconbtn"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                color: editMode ? COLOR.foreground : COLOR.foregroundMuted,
              }}
            >
              {editMode
                ? <IconCheck size={20} stroke={1.75} />
                : <IconPencil size={20} stroke={1.75} />}
            </button>
          )}
          {selectedElement && (
            <button
              onClick={handleClearSelection}
              title="Close"
              className="awd-iconbtn"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, color: COLOR.foregroundMuted }}
            >
              <XIcon size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Body — the panel only shows content while an element is selected; the
          toolbar is the resting UI, and tracked changes live in its popover. */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {selectedElement && (
          <InspectZone
            selected={selectedElement}
            selectionId={selectionId}
            editMode={editMode}
            manualArmed={manualArmed}
            onManualPick={handleManualPick}
            onSelectAncestor={selectAncestor}
            onApplyStyle={applyStyle}
            onApplyText={applyText}
          />
        )}
      </div>
    </div>
  );
}

export default App;
