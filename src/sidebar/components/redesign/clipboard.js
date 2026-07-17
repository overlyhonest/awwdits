// Copy a string to the clipboard from inside the panel iframe.
//
// The panel is a cross-origin extension iframe, so the async Clipboard API can be
// blocked by Permissions Policy on some pages. We try it first (it works when the
// host iframe carries allow="clipboard-write"), then fall back to a hidden
// textarea + execCommand, which works from the iframe's own document on a gesture.
export function copyText(text) {
  const value = String(text ?? '');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).catch(() => fallbackCopy(value));
      return;
    }
  } catch {
    // permissions policy threw — fall through
  }
  fallbackCopy(value);
}

function fallbackCopy(value) {
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch {
    // clipboard unavailable — nothing more we can do
  }
}
