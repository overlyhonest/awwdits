// Pure resolution for the two-layer tool-activation model — no DOM, so the (bug-prone)
// interaction rules are unit-tested in isolation.
//
//   held keys  → a momentary tool, active only while the key is down
//   sticky     → the tool set by a toolbar click, persistent until cleared
//   effective  → the held tool when a key is down, else the sticky tool, else idle

// Which tool a set of held keys requests: ⌘/Ctrl → inspect, +Shift → comment, X →
// measure. A held modifier wins over X (the ⌘ family is the primary gesture).
export function computeHeldTool({ mod = false, shift = false, x = false } = {}) {
  if (mod) return shift ? 'comment' : 'inspect';
  if (x) return 'measure';
  return 'none';
}

// The effective tool: a held tool overrides the sticky tool; else the sticky tool; else
// idle. `sticky` reports whether that tool is the persistent one (→ plain-click inspect)
// rather than a momentary hold. A held tool equal to the sticky tool counts as sticky, so
// e.g. holding ⌘ while sticky-inspect is on doesn't downgrade it to modifier-required.
export function resolveEffective(heldTool, stickyTool) {
  const tool = heldTool !== 'none' ? heldTool : stickyTool;
  const sticky = heldTool === 'none' || heldTool === stickyTool;
  return { tool, sticky };
}

// Commit-on-use: a held tool that actually does something (a click that inspects, comments,
// or measures) becomes the sticky tool. Without this, releasing the key reverts to the
// previous sticky tool, which re-lights its pill and clears the selection just made. Applies
// to all three tools — measure used to be the sole exception.
// The tool to commit to is by definition the effective tool, so this is expressed in terms
// of resolveEffective rather than re-deriving the same precedence — the two can't drift.
export function commitOnUse(heldTool, stickyTool) {
  return resolveEffective(heldTool, stickyTool).tool;
}
