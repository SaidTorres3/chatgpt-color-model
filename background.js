/**
 * Background script to handle automatic model synchronization on extension update.
 */

async function syncModels() {
  try {
    const url = chrome.runtime.getURL('defaultModels.json');
    const resp = await fetch(url);
    const defaultModels = await resp.json();

    chrome.storage.sync.get(['modelStyles'], (result) => {
      let currentStyles = result.modelStyles;
      
      if (!currentStyles) {
        // First time install: storage is empty, initialize with all defaults
        chrome.storage.sync.set({ modelStyles: defaultModels }, () => {
          console.log('CM: Initialized storage with default models.');
        });
        return;
      }

      let updated = false;
      // Merge only missing models to avoid overwriting user customizations
      for (const key in defaultModels) {
        if (!(key in currentStyles)) {
          currentStyles[key] = defaultModels[key];
          updated = true;
        }
      }

      if (updated) {
        chrome.storage.sync.set({ modelStyles: currentStyles }, () => {
          console.log('CM: Automatically synced new models from defaultModels.json');
        });
      }
    });
  } catch (err) {
    console.error('CM background.js error:', err);
  }
}

/**
 * Triggered when the extension is installed or updated.
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    syncModels();
  }
});
