// Pure geometry for the floating toolbar — position clamping + default placement.
// No DOM, so it is unit-tested (the DOM module toolbar.js consumes it).
export const TOOLBAR_MARGIN = 16;

export function clampToolbarPos({ x, y }, { vw, vh }, { w, h }) {
  const maxX = Math.max(TOOLBAR_MARGIN, vw - w - TOOLBAR_MARGIN);
  const maxY = Math.max(TOOLBAR_MARGIN, vh - h - TOOLBAR_MARGIN);
  return {
    x: Math.min(Math.max(TOOLBAR_MARGIN, x), maxX),
    y: Math.min(Math.max(TOOLBAR_MARGIN, y), maxY),
  };
}

export function defaultToolbarPos({ vw, vh }, { w, h }) {
  return { x: Math.round((vw - w) / 2), y: vh - h - 24 };
}
