// Awwdits Service Worker (Manifest V3)

async function toggleAwwdits(tab) {
  if (!tab || !tab.id) return;

  // Can't inject into chrome:// or other restricted pages
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    console.warn('[Awwdits] Cannot run on this page:', tab.url);
    return;
  }

  try {
    // Try messaging an already-running content script first
    await chrome.tabs.sendMessage(tab.id, { type: 'AWWDITS_TOGGLE' });
  } catch {
    // Content script not yet active — inject it, then toggle
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js'],
      });
      // Small delay to let the script initialise
      await new Promise(r => setTimeout(r, 100));
      await chrome.tabs.sendMessage(tab.id, { type: 'AWWDITS_TOGGLE' });
    } catch (err) {
      console.error('[Awwdits SW] Could not inject content script:', err.message);
    }
  }
}

// Toolbar icon click.
chrome.action.onClicked.addListener(toggleAwwdits);

// Keyboard shortcut (manifest `commands`, default Alt+Shift+A — configurable at
// chrome://extensions/shortcuts). Works globally, even before the content script loads.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-awwdits') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  toggleAwwdits(tab);
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Awwdits] Extension installed');
});
