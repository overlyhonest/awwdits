// Remembers the toolbar's last position across pages/reloads.
const KEY = 'awwdits-toolbar-pos';

export async function loadToolbarPos() {
  try { const g = await chrome.storage.local.get(KEY); const v = g[KEY]; return (v && typeof v.x === 'number') ? v : null; }
  catch { return null; }
}

export async function saveToolbarPos(pos) {
  try { await chrome.storage.local.set({ [KEY]: pos }); } catch { /* storage blocked */ }
}
