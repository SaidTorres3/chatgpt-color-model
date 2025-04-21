let defaultModelStyles = {};
let modelStyles = {};
let aliasMap = {};
let keys = [];
let pattern = null;
let interval = null;

// 1) Load defaults, then call init()
async function loadDefaults() {
  try {
    const response = await fetch(chrome.runtime.getURL('defaultModels.json'));
    defaultModelStyles = await response.json();
    init();
  } catch (err) {
    console.error('ContentScript: error loading defaultModels.json', err);
  }
}

// 2) Once defaults are loaded, initialize storage and listeners
function init() {
  chrome.storage.sync.get({ modelStyles: defaultModelStyles }, res => {
    modelStyles = res.modelStyles;
    updatePattern();
    applyModelStyle();
    interval = setInterval(startWhenReady, 500);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.modelStyles) {
      modelStyles = changes.modelStyles.newValue;
      updatePattern();
      applyModelStyle();
    }
  });
}

// 3) Helpers for aliasing & regex
function getMainEntries() {
  const aliasSet = new Set();
  Object.values(modelStyles).forEach(cfg => {
    if (Array.isArray(cfg.names)) {
      cfg.names.forEach(n => aliasSet.add(n.toLowerCase()));
    }
  });
  const mains = Object.entries(modelStyles).filter(([k]) => !aliasSet.has(k.toLowerCase()));
  return mains;
}

function updatePattern() {
  aliasMap = {};
  keys = [];
  getMainEntries().forEach(([mainKey, cfg]) => {
    keys.push(mainKey);
    if (Array.isArray(cfg.names)) {
      cfg.names.forEach(alias => {
        aliasMap[alias.toLowerCase()] = mainKey;
        keys.push(alias);
      });
    }
  });
  keys.sort((a, b) => b.length - a.length);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  pattern = new RegExp(`^(${keys.map(esc).join('|')})$`, 'i');
}

// 4) Apply CSS based on detected model name
function applyModelStyle() {
  const btn = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
  if (!btn) {
    return;
  }
  if (!pattern) {
    return;
  }

  // e.g. innerText = "Model: 4o"
  const text = btn.innerText.trim().split(' ').slice(1).join(' ').trim();

  if (!pattern.test(text)) {
    return;
  }

  const mainKey = aliasMap[text.toLowerCase()] || text;
  const cfg = modelStyles[mainKey];
  if (!cfg) {
    return;
  }

  document.getElementById('cm-style')?.remove();
  const style = document.createElement('style');
  style.id = 'cm-style';

  let css = `
    [data-testid="model-switcher-dropdown-button"] span {
      color: ${cfg.color} !important;
      font-weight: bold !important;
      ${cfg.showBorder ? `border:1px dashed ${cfg.color};` : 'border:none;'}
      padding:2px; position:relative;
    }`;
  if (cfg.showEmoji) {
    css += `
    [data-testid="model-switcher-dropdown-button"]>div::before {
      content:"${cfg.icon}";
      margin-right:6px; font-size:1.2em; position:relative; top:1px;
    }`;
  }

  style.textContent = css;
  document.head.appendChild(style);
}

// 5) Poll until the button appears, then observe it
function startWhenReady() {
  const btn = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
  if (btn) {
    clearInterval(interval);
    applyModelStyle();
    new MutationObserver(applyModelStyle)
      .observe(btn, { childList: true, subtree: true, characterData: true });
  }
}

// Kick it off
loadDefaults();
