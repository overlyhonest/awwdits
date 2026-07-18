import { MESSAGES } from '../utils/constants.js';
import { initElementSelector, deactivateElementSelector, clearSelection, getSelectedElement, selectElement, armOneShotPick, setArmed, setRequireModifier } from './element-selector.js';
import { initMeasurement, clearMeasurement } from './measurement-overlay.js';
import { extractColors } from '../utils/extractors/colorExtractor.js';
import { extractTypography } from '../utils/extractors/typographyExtractor.js';
import { extractSpacing } from '../utils/extractors/spacingExtractor.js';
import { extractElementStyles } from '../utils/extractors/styleExtractor.js';
import { calculateHealthScore } from '../utils/analyzers/healthScorer.js';
import { checkContrast } from '../utils/analyzers/contrastChecker.js';
import { buildSelector } from '../utils/extractors/styleExtractor.js';
import { buildPath, findByPath, locateElement } from '../utils/helpers/domPath.js';
import { initCommentOverlay, setComments, openComposerFor, pulsePin, closeEditors } from './comment-overlay.js';
import { initToolbar } from './toolbar.js';
import { computeHeldTool, resolveEffective, commitOnUse } from './toolMode.js';
import { initChangesPopover } from './changesPopover.js';
import { formatAll } from '../sidebar/notes/exportNotes.js';
import { COLORS } from './overlayTokens.js';
import { captureForEdit } from '../utils/resolve/elementContext.js';
import { currentPageState } from '../utils/resolve/pageState.js';

// --- Google Font injector ---
// Names of fonts the INSPECTED PAGE might use — detection data for the editor's
// font-family picker, never awwdits' own type.
const SYSTEM_FONTS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'arial', 'helvetica', 'times new roman', 'times', 'courier new', 'courier',
  'verdana', 'georgia', 'palatino', 'garamond', 'trebuchet ms', 'comic sans ms',
  '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'inter', 'roboto', // design-token-exempt
  'ui-sans-serif', 'ui-serif', 'ui-monospace',
]);

function injectGoogleFont(fontFamily) {
  const primary = fontFamily.split(',')[0].trim().replace(/['"]/g, '');
  if (!primary || SYSTEM_FONTS.has(primary.toLowerCase())) return;
  const id = `awwdits-gf-${primary.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${primary.replace(/\s+/g, '+')}:wght@400;500;700&display=swap`;
  document.head.appendChild(link);
}

// --- State ---
let sidebarFrame = null;
let isOpen = false;
let activeMode = 'none';
let pendingPinFocus = null; // {selector, path, comment} queued until the panel signals SIDEBAR_READY

let toolbar = null;         // { setActiveTool, setChangesCount, setChipOpen, chipEl, ... }
let changesPopover = null;  // { open, close, toggle, isOpen }
let changeRecords = [];     // latest records from the panel's CHANGES_SUMMARY
let pendingCommentPick = false; // Comment tool armed: the next plain click comments
let committedTool = 'none';     // the mode the toolbar pill shows (= realized effective tool)

// Two-layer tool activation:
//   stickyTool — set by a toolbar-button click; persists until re-click, another tool,
//     or Escape (→ idle).
//   heldTool   — momentary, from held keys (⌘ inspect · ⌘⇧ comment · X measure); active
//     only while the key is down.
// Effective tool = heldTool (when a key is held) else stickyTool else idle. On key
// release the tool reverts to the sticky tool (or idle). No preview flicker, no toggle
// on auto-repeat. Clicking while a tool is held commits it to stickyTool — for any of
// the three (inspect/comment/measure) — so whatever you just did outlives the key
// release instead of snapping back to the previous sticky tool (see the commit-on-use
// listener below).
let stickyTool = 'none';
let heldTool = 'none';
let realizedTool = 'none';  // the effective tool currently realized on the page
let realizedSticky = true;  // is the realized inspect sticky (plain-click) vs held (⌘)?
let curMod = false, curShift = false, xHeld = false; // live keyboard state

// --- Sidebar injection: toolbar (always mounted) + panel (hidden until select) ---
function injectSidebar() {
  if (sidebarFrame) return;

  const PANEL_WIDTH = 300;
  const PANEL_HEIGHT = Math.min(Math.round(window.innerHeight * 0.85), 700);
  const initY = Math.round((window.innerHeight - PANEL_HEIGHT) / 2);

  // Panel container — right-docked, hidden until an element is selected.
  const container = document.createElement('div');
  container.id = 'awwdits-sidebar-container';
  container.style.cssText = `position:fixed;top:${initY}px;right:24px;width:${PANEL_WIDTH}px;height:${PANEL_HEIGHT}px;` +
    'z-index:2147483647;display:none;pointer-events:auto';

  const iframe = document.createElement('iframe');
  iframe.id = 'awwdits-sidebar-frame';
  iframe.src = chrome.runtime.getURL('sidebar.html');
  iframe.allow = 'clipboard-write'; // let the panel copy inspected values to the clipboard
  // panelBg (not COLORS.bg): this is the panel's canvas showing through, not chrome.
  iframe.style.cssText = `width:100%;height:${PANEL_HEIGHT}px;border:none;background:${COLORS.panelBg};border-radius:16px;display:block;` +
    'box-shadow:0 8px 32px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.10)';
  container.appendChild(iframe);
  document.body.appendChild(container);
  sidebarFrame = iframe;

  // Toolbar — the always-visible hub.
  toolbar = initToolbar({
    // Each tool button toggles a *sticky* mode: click to turn it on (stays on until
    // you click it again, pick another tool, or press Escape → idle). Sticky inspect
    // highlights on hover and selects on a plain click — no ⌘ needed. This is the
    // click path; the hold path (⌘ / ⌘⇧ / X) is momentary and handled in the key layer.
    onInspect: () => setStickyTool(stickyTool === 'inspect' ? 'none' : 'inspect'),
    onComment: () => setStickyTool(stickyTool === 'comment' ? 'none' : 'comment'),
    onMeasure: () => setStickyTool(stickyTool === 'measure' ? 'none' : 'measure'),
    onToggleChanges: () => { changesPopover.toggle(changeRecords); toolbar.setChipOpen(changesPopover.isOpen()); },
    onCopy: copyChanges,
    onClose: () => { removeSidebar(); isOpen = false; },
  });

  changesPopover = initChangesPopover({
    getAnchor: () => toolbar.chipEl,
    onSelectRecord: (rec) => selectRecord(rec),
    onCopy: copyChanges,
    onClearAll: () => postToSidebar(MESSAGES.CLEAR_ALL_CHANGES, {}),
    onDeleteRecord: (rec) => postToSidebar(MESSAGES.DELETE_RECORD, { selector: rec.selector, path: rec.path }),
    onDeleteEdit: (rec, property) => postToSidebar(MESSAGES.DELETE_EDIT, { selector: rec.selector, path: rec.path, property }),
    onDeleteComment: (rec) => postToSidebar(MESSAGES.DELETE_COMMENT, { selector: rec.selector, path: rec.path }),
  });

  window.addEventListener('message', handleSidebarMessage);
}

function showPanel() { const c = document.getElementById('awwdits-sidebar-container'); if (c) c.style.display = 'block'; }
function hidePanel() { const c = document.getElementById('awwdits-sidebar-container'); if (c) c.style.display = 'none'; }

// Realization primitives — each puts the page into one concrete mode and lights the
// matching toolbar pill (committedTool = the realized effective tool). These are driven
// by applyEffectiveTool below, never called straight from a key/click handler, so the
// held/sticky layers stay the single source of truth.
function setTool(name) { committedTool = name; if (toolbar) toolbar.setActiveTool(name); }
function enterInspect() { pendingCommentPick = false; setArmed(false); if (activeMode !== 'inspector') activateInspector(); setTool('inspect'); }
// clearSelection() must come before the pendingCommentPick/setArmed lines: since
// clearSelection() synchronously fires onClearCallback (which sets pendingCommentPick =
// false and setArmed(false) — see the onClear passed to initElementSelector), calling
// it after would immediately disarm the comment tool this function is trying to arm.
function enterComment() { if (activeMode !== 'inspector') activateInspector(); clearSelection(); pendingCommentPick = true; setArmed(true); setTool('comment'); }
function enterMeasure() { pendingCommentPick = false; setArmed(false); activateMeasure(); setTool('measure'); }
// Idle: keep the inspector running as a silent sensing layer (so ⌘ still highlights),
// but require ⌘ (no highlight at rest) and clear the toolbar pill. Any live selection
// (e.g. a just-inspected element with its panel open) is left alone.
function enterIdle() { pendingCommentPick = false; setArmed(false); if (activeMode !== 'inspector') activateInspector(); setRequireModifier(true); setTool('none'); }

// Realize the effective tool (resolved by the pure resolveEffective). Switches machinery
// only when the tool (or its sticky-ness, which decides plain-click-to-inspect) actually
// changes, so repeated key events don't tear down overlays or drop the current selection.
function applyEffectiveTool() {
  const { tool, sticky } = resolveEffective(heldTool, stickyTool);
  const toolChanged = tool !== realizedTool;
  // Sticky-ness only changes behaviour for inspect, where it gates plain-click select.
  // For the other tools it's inert, and re-entering would tear their overlay down — which
  // would wipe an in-progress measurement the instant a click commits measure to sticky.
  const stickyChanged = tool === 'inspect' && sticky !== realizedSticky;
  realizedTool = tool;
  realizedSticky = sticky;
  if (!toolChanged && !stickyChanged) return;
  switch (tool) {
    case 'inspect': enterInspect(); setRequireModifier(!sticky); break; // sticky → plain click selects
    case 'comment': enterComment(); break;
    case 'measure': enterMeasure(); break;
    default:        enterIdle();    break;
  }
}

// Toolbar-button click: toggle the sticky tool (click again / Esc → idle).
function setStickyTool(tool) { stickyTool = tool; applyEffectiveTool(); }

// Recompute the held tool from the live key state (curMod/curShift/xHeld), then realize.
function syncHeldTool() {
  heldTool = computeHeldTool({ mod: curMod, shift: curShift, x: xHeld });
  applyEffectiveTool();
}

// Drag the panel by its in-iframe grip. The grip posts PANEL_DRAG_START with the
// mouse's SCREEN coords (frame-independent); a transparent overlay captures the page's
// mouse so the panel keeps following even as the cursor sits over the iframe.
function startPanelDrag(startScreenX, startScreenY) {
  const container = document.getElementById('awwdits-sidebar-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const startLeft = rect.left, startTop = rect.top;
  container.style.left = startLeft + 'px';
  container.style.right = 'auto';
  container.style.top = startTop + 'px';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:grabbing';
  document.body.appendChild(overlay);

  const onUp = () => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    window.removeEventListener('blur', onUp);
    overlay.remove();
  };
  const onMove = (e) => {
    // If the button was released off-window (no mouseup reached us), stop.
    if (!(e.buttons & 1)) { onUp(); return; }
    let nl = startLeft + (e.screenX - startScreenX);
    let nt = startTop + (e.screenY - startScreenY);
    nl = Math.max(0, Math.min(window.innerWidth - container.offsetWidth, nl));
    nt = Math.max(0, Math.min(window.innerHeight - 48, nt));
    container.style.left = nl + 'px';
    container.style.top = nt + 'px';
  };
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', onUp, true);
  window.addEventListener('blur', onUp);
}

// Re-select an element from a changes-popover row (local — same context).
function selectRecord(rec) {
  const el = locateElement(rec.selector, rec.path);
  if (!el) { postToSidebar(MESSAGES.SELECT_NOT_FOUND, { selector: rec.selector }); return; }
  selectElement(el);
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  pulsePin(rec.selector, rec.path);
}

// Copy the tracked changes (LLM-friendly text, full CSS paths) to the clipboard,
// without opening the panel. changeRecords is the latest CHANGES_SUMMARY payload.
function copyChanges() {
  if (!changeRecords.length) return;
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const pageState = currentPageState(date);
  const text = formatAll(changeRecords, pageState);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  } catch { fallbackCopy(text); }
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch { /* no-op */ }
  ta.remove();
}

function removeSidebar() {
  if (sidebarFrame) {
    const container = document.getElementById('awwdits-sidebar-container');
    if (container) container.remove();
    sidebarFrame = null;
  }
  if (changesPopover) { changesPopover.close(); changesPopover = null; }
  if (toolbar) { toolbar.destroy(); toolbar = null; }
  changeRecords = [];
  pendingCommentPick = false;
  committedTool = 'none';
  stickyTool = 'none';
  heldTool = 'none';
  realizedTool = 'none';
  realizedSticky = true;
  curMod = curShift = xHeld = false;
  setArmed(false);
  deactivateAll();
  closeEditors(); // close the composer but KEEP pins on the page — they persist until reload
  pendingPinFocus = null; // drop any queued pin-focus so it can't misfire on the next open
  window.removeEventListener('message', handleSidebarMessage);
}

// A pin click re-enters editing for its element: (re)open the panel, select the
// element (inspect screen), and open the composer prefilled with the comment.
// Pins persist on the page after the panel is dismissed, so this is the way back
// in. When the panel has to be opened first, the focus is deferred to
// SIDEBAR_READY (the panel isn't listening for ELEMENT_SELECTED until then).
function focusCommentedElement(entry) {
  const el = locateElement(entry.selector, entry.path);
  if (!el) return;
  // Re-opening a comment (pin click) shows the composer only — not the inspect panel.
  openComposerFor(el, entry.comment || '');
}

function handlePinClick(entry) {
  if (!isOpen) {
    pendingPinFocus = entry; // run once the freshly-injected panel is ready
    injectSidebar();
    isOpen = true;
  } else {
    focusCommentedElement(entry);
  }
}

// --- Toggle ---
function toggleSidebar() {
  if (isOpen) {
    removeSidebar();
    isOpen = false;
  } else {
    injectSidebar();
    isOpen = true;
  }
}

// --- Ancestor chain helper ---
function buildAncestors(element) {
  const chain = [];
  let el = element.parentElement;
  while (el && el.tagName !== 'HTML') {
    if (!el.closest('#awwdits-sidebar-container') && !el.closest('#awwdits-hl')) {
      const tag  = el.tagName.toLowerCase();
      const id   = el.id;
      const cls  = Array.from(el.classList)
        .filter(c => !c.includes(':') && !c.includes('[') && c.length < 30)
        .slice(0, 2);
      const label = id ? `#${id}` : cls.length ? `${tag}.${cls[0]}` : tag;
      chain.push({ label, steps: chain.length + 1 });
      if (chain.length >= 6) break;
    }
    el = el.parentElement;
  }
  return chain;
}

// --- Modes ---
function deactivateAll() {
  activeMode = 'none';
  deactivateElementSelector();
  clearMeasurement();
  clearSelection();
}

function activateInspector() {
  deactivateAll();
  activeMode = 'inspector';
  // Always armed: a plain click passes through to the page; only ⌘/Ctrl-click
  // (or a one-shot manual pick) selects an element.
  initElementSelector((element) => {
    const styles    = extractElementStyles(element);
    const contrast  = element.textContent?.trim() ? checkContrast(element) : null;
    const ancestors = buildAncestors(element);
    postToSidebar(MESSAGES.ELEMENT_SELECTED, { styles, contrast, ancestors });
    showPanel();
    // A committed selection is an inspect commit — leave any armed comment/hover mode
    // so the next click inspects (not comments) and the pill matches the behaviour.
    pendingCommentPick = false;
    setArmed(false);
    setTool('inspect');
  }, {
    requireModifier: true,
    onClear: () => { pendingCommentPick = false; setArmed(false); postToSidebar(MESSAGES.CLEAR_SELECTION, {}); hidePanel(); },
  });
}

function activateMeasure() {
  deactivateAll();
  activeMode = 'measure';
  initMeasurement((measurement) => {
    postToSidebar(MESSAGES.MEASUREMENT_COMPLETE, measurement);
  });
}

// --- Page scan ---
async function scanPage() {
  postToSidebar('AWWDITS_SCANNING', { scanning: true });

  try {
    const colorData = extractColors();
    const typographyData = extractTypography();
    const spacingData = extractSpacing();
    const healthScore = calculateHealthScore(colorData, typographyData, spacingData);

    postToSidebar(MESSAGES.PAGE_DATA, {
      colors: colorData,
      typography: typographyData,
      spacing: spacingData,
      health: healthScore,
      url: window.location.href,
      title: document.title,
    });
  } catch (err) {
    console.error('[Awwdits] Scan error:', err);
    postToSidebar('AWWDITS_SCAN_ERROR', { error: err.message, url: window.location.href });
  }
}

// --- Message passing ---
function postToSidebar(type, data) {
  if (sidebarFrame) {
    sidebarFrame.contentWindow?.postMessage({ type, data }, '*');
  }
}

function handleSidebarMessage(e) {
  if (!e.data || !e.data.type) return;

  switch (e.data.type) {
    case MESSAGES.SIDEBAR_READY:
      initCommentOverlay({
        onSave: payload => postToSidebar(MESSAGES.COMMENT_SAVED, payload),
        onPinClick: handlePinClick,
      });
      scanPage();
      // Arm the inspector immediately — no "Start Inspecting" step. No tool is
      // highlighted at rest; a tool lights up only when its mode is engaged.
      activateInspector();
      // If the panel was opened by a pin click, re-enter editing that comment.
      if (pendingPinFocus) { const p = pendingPinFocus; pendingPinFocus = null; focusCommentedElement(p); }
      break;
    case MESSAGES.ARM_MANUAL_PICK:
      armOneShotPick();
      break;
    case MESSAGES.CLEAR_SELECTION:
      clearSelection();
      hidePanel();
      setArmed(false);
      // Deselecting keeps the committed tool (still in inspect/whichever mode).
      break;
    case MESSAGES.SCAN_PAGE:
      scanPage();
      break;
    case MESSAGES.ACTIVATE_INSPECTOR:
      activateInspector();
      break;
    case MESSAGES.ACTIVATE_MEASURE:
      activateMeasure();
      break;
    case MESSAGES.FREEZE_INSPECTOR:
      // Stop hover/click events but keep selectedElement + its highlight visible
      deactivateElementSelector(true);
      clearMeasurement();
      activeMode = 'none';
      break;
    case MESSAGES.SELECT_ANCESTOR: {
      const current = getSelectedElement();
      if (!current) break;
      let target = current;
      const steps = e.data.steps || 1;
      for (let i = 0; i < steps; i++) {
        const parent = target.parentElement;
        if (!parent || parent.tagName === 'HTML') break;
        if (!parent.closest('#awwdits-sidebar-container') && !parent.closest('#awwdits-hl') && !parent.closest('#awwdits-comments')) {
          target = parent;
        }
      }
      if (target !== current) selectElement(target);
      break;
    }
    case MESSAGES.SELECT_BY_SELECTOR: {
      let target = null;
      try { target = document.querySelector(e.data.selector); } catch { target = null; }
      if (!target) target = findByPath(e.data.path);
      if (target) {
        selectElement(target);
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        pulsePin(e.data.selector);
      } else {
        postToSidebar(MESSAGES.SELECT_NOT_FOUND, { selector: e.data.selector });
      }
      break;
    }
    case MESSAGES.PANEL_DRAG_START:
      startPanelDrag(e.data.screenX, e.data.screenY);
      break;
    case MESSAGES.DEACTIVATE_ALL:
      deactivateAll();
      break;
    case MESSAGES.RENDER_COMMENTS:
      setComments(e.data.comments || []);
      break;
    case MESSAGES.CHANGES_SUMMARY:
      changeRecords = e.data.records || [];
      if (toolbar) toolbar.setChangesCount(e.data.count || 0);
      if (changesPopover && changesPopover.isOpen()) { changesPopover.close(); changesPopover.open(changeRecords); }
      break;
    case MESSAGES.OPEN_COMMENT_COMPOSER: {
      const el = getSelectedElement();
      if (el) openComposerFor(el);
      break;
    }
    case MESSAGES.APPLY_STYLE: {
      const el = getSelectedElement();
      if (el && e.data.property) {
        // Convert camelCase → kebab-case so setProperty works correctly
        const kebab = e.data.property.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
        const before = getComputedStyle(el).getPropertyValue(kebab).trim();
        let context; try { context = captureForEdit(el, kebab); } catch { context = undefined; }   // capture from author rules, pre-override
        el.style.setProperty(kebab, e.data.value, 'important');
        if (e.data.property === 'fontFamily') injectGoogleFont(e.data.value);
        postToSidebar(MESSAGES.CHANGE_APPLIED, {
          selector: buildSelector(el), path: buildPath(el), label: buildSelector(el),
          property: kebab, before, after: e.data.value, context,
        });
      }
      break;
    }
    case MESSAGES.APPLY_TEXT: {
      const el = getSelectedElement();
      // Only leaf elements expose the text field, so this won't drop children.
      if (el && typeof e.data.value === 'string' && el.children.length === 0) {
        const before = el.textContent;
        el.textContent = e.data.value;
        postToSidebar(MESSAGES.CHANGE_APPLIED, {
          selector: buildSelector(el), path: buildPath(el), label: buildSelector(el),
          property: 'text', before, after: e.data.value,
        });
      }
      break;
    }
    case MESSAGES.RESET_STYLES: {
      const el = getSelectedElement();
      if (el) {
        el.removeAttribute('style');
        postToSidebar(MESSAGES.CHANGES_CLEARED, { selector: buildSelector(el), path: buildPath(el) });
      }
      break;
    }
    case MESSAGES.DOWNLOAD_IMAGE: {
      const el = getSelectedElement();
      if (el) downloadImage(el, e.data.imageType);
      break;
    }
    case 'AWWDITS_CLOSE':
      removeSidebar();
      isOpen = false;
      break;
  }
}


// --- Image download ---
async function downloadImage(element, imageType) {
  try {
    let blob, filename;

    if (imageType === 'img') {
      const src = element.src || element.getAttribute('src');
      if (!src) return;
      const res = await fetch(src);
      blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'png';
      filename = `awwdits-image.${ext}`;
    } else if (imageType === 'background-image') {
      const bgImage = getComputedStyle(element).backgroundImage;
      const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
      if (!match) return;
      const res = await fetch(match[1]);
      blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'png';
      filename = `awwdits-bg.${ext}`;
    } else if (imageType === 'svg') {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(element);
      blob = new Blob([svgString], { type: 'image/svg+xml' });
      filename = 'awwdits-icon.svg';
    } else {
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    // Do NOT attach to document.body: a click on an in-tree anchor bubbles to the
    // element-selector's document listener and clears/re-arms the selection. A
    // detached anchor still downloads in Chrome, and its click can't reach the page.
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[Awwdits] Download failed:', err);
  }
}

// --- Bootstrap ---
// Toggle comes from the service worker (toolbar click OR the Alt+Shift+A command,
// configurable at chrome://extensions/shortcuts).
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'AWWDITS_TOGGLE') {
    toggleSidebar();
  }
});

// Commit-on-use: a held tool that does something becomes the sticky tool, so releasing the
// key leaves you in the tool you just used instead of snapping back to the previous one —
// which would re-light its pill and clear the selection you just made. Registered above the
// comment listener, which claims its own clicks via stopImmediatePropagation; both are
// module-load listeners, so they run before the element-selector's (later-bound) onClick.
document.addEventListener('click', (e) => {
  if (!isOpen || heldTool === 'none') return;
  const t = e.target;
  if (!t || (t.closest && (t.closest('#awwdits-sidebar-container') || t.closest('#awwdits-toolbar') || t.closest('#awwdits-changes-pop') || t.closest('#awwdits-comments') || t.closest('#awwdits-mark-menu')))) return;
  const next = commitOnUse(heldTool, stickyTool);
  if (next === stickyTool) return;
  stickyTool = next;
  applyEffectiveTool();
}, true);

// Comment gestures: ⌘/Ctrl+Shift+click any element to comment it directly
// (parallels ⌘-click to inspect), or arm the Comment tool (pendingCommentPick) and
// plain-click. The click claims itself via stopImmediatePropagation so the
// element-selector doesn't also select it. A ⌘/Ctrl-click without Shift is left
// for the inspector even while the Comment tool is armed.
document.addEventListener('click', (e) => {
  if (!isOpen) return;
  const gesture = (e.metaKey || e.ctrlKey) && e.shiftKey;
  const plainPick = pendingCommentPick && !e.metaKey && !e.ctrlKey && !e.altKey;
  if (!gesture && !plainPick) return;
  const t = e.target;
  if (!t || (t.closest && (t.closest('#awwdits-sidebar-container') || t.closest('#awwdits-comments') || t.closest('#awwdits-toolbar') || t.closest('#awwdits-changes-pop') || t.closest('#awwdits-mark-menu')))) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  // Comment mode is sticky (pendingCommentPick stays); commenting does NOT select
  // the element or open the inspect panel — it just opens the composer on it.
  openComposerFor(t);
}, true);

// --- Momentary tool activation (the hold path) ---
// ⌘/Ctrl → inspect · ⌘/Ctrl+Shift → comment · X → measure. The tool is active only
// while the key is held; on release the effective tool reverts to the sticky tool (set
// by a toolbar click) or idle. Recomputed on every relevant key change from the live
// modifier flags + an xHeld flag tracked across keydown/keyup. Escape clears the sticky
// tool. Repeat-guarded so held X doesn't toggle, and unbound on blur so ⌘-Tab can't
// leave a tool stuck on.
function isTypingTarget() {
  const a = document.activeElement;
  return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable));
}

function onToolKey(e) {
  if (!isOpen) return;
  // Never resolve tools from keys typed into a field (the comment composer, etc.): drop
  // any held state so a ⌘/Ctrl chord (⌘A, ⌘C…) or Escape can't flip the tool mid-edit.
  // Escape in a field just cancels the composer (handled by the overlay), leaving the
  // sticky tool intact.
  if (isTypingTarget()) {
    if (heldTool !== 'none' || curMod || curShift || xHeld) { curMod = curShift = xHeld = false; heldTool = 'none'; applyEffectiveTool(); }
    return;
  }
  curMod = e.metaKey || e.ctrlKey;
  curShift = e.shiftKey;
  if (e.type === 'keydown' && e.key === 'Escape') stickyTool = 'none'; // sticky tool → idle
  // X = momentary measure. Modifier-guarded so ⌘X (cut) etc. don't arm it; repeat-
  // guarded so held X doesn't retrigger.
  if ((e.key === 'x' || e.key === 'X') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    if (e.type === 'keydown') { if (e.repeat) return; xHeld = true; e.preventDefault(); }
    else xHeld = false;
  }
  syncHeldTool();
}
document.addEventListener('keydown', onToolKey, true);
document.addEventListener('keyup', onToolKey, true);
// A held key whose keyup never arrives (window lost focus, e.g. ⌘-Tab) would otherwise
// stick — drop all held state and re-resolve when the page is blurred.
window.addEventListener('blur', () => { curMod = curShift = xHeld = false; heldTool = 'none'; applyEffectiveTool(); });
