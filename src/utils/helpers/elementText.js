// Does this element render text of its OWN — a direct child text node with non-whitespace
// content — rather than merely wrapping descendants that do?
//
// `element.textContent` is the wrong test for "is this a text element": it aggregates all
// descendant text, so any container (a card, a flex row) that wraps text reads as text and
// gets typography/contrast it doesn't own. A direct-text-node check excludes pure containers
// while still catching mixed content like `<p>Hello <a>x</a> world</p>` — which the stricter
// leaf check (children.length === 0) would wrongly drop.
export function hasOwnText(el) {
  if (!el || !el.childNodes) return false;
  for (const node of el.childNodes) {
    if (node.nodeType === 3 /* Node.TEXT_NODE */ && node.textContent.trim()) return true;
  }
  return false;
}
