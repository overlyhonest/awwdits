// Per-URL persistence for notes records via chrome.storage.local. Keyed by
// origin+pathname so notes survive query/hash changes. Degrades to empty/no-op
// if storage is unavailable — never throws into the UI.
const PREFIX = 'awwdits-notes:';

export function storageKey(url) {
  try { const u = new URL(url); return PREFIX + u.origin + u.pathname; }
  catch { return PREFIX + (url || 'unknown'); }
}

export async function loadNotes(url) {
  try {
    const key = storageKey(url);
    const got = await chrome.storage.local.get(key);
    return Array.isArray(got[key]) ? got[key] : [];
  } catch { return []; }
}

export async function saveNotes(url, records) {
  try { await chrome.storage.local.set({ [storageKey(url)]: records }); }
  catch { /* storage blocked / quota — degrade to in-memory */ }
}
