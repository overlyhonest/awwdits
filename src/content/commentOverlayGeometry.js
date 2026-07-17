// Pure geometry for a comment pin: given an element's viewport rect and the
// viewport size, return where the pin should sit and whether it should show.
// No DOM access, so it is unit-testable in the Vitest `node` environment.
export const PIN_SIZE = 40;

export function positionPin(rect, viewport, pinSize = PIN_SIZE) {
  const fullyOffscreen =
    rect.bottom < 0 || rect.top > viewport.height ||
    rect.right < 0 || rect.left > viewport.width;

  // Anchor centered on the element's top-left corner…
  let left = rect.left - pinSize / 2;
  let top = rect.top - pinSize / 2;

  // …then clamp so a partially-visible element's pin stays on screen.
  left = Math.max(0, Math.min(left, viewport.width - pinSize));
  top = Math.max(0, Math.min(top, viewport.height - pinSize));

  return { left, top, visible: !fullyOffscreen };
}
