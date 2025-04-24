let defaultModelStyles = {};
let modelStyles = {};
let aliasMap = {};
let keys = [];
let pattern = null;

/** 1) Load defaults, then init */
async function loadDefaults() {
  try {
    const resp = await fetch(chrome.runtime.getURL('defaultModels.json'));
    defaultModelStyles = await resp.json();
    init();
  } catch (err) {
    console.error('ContentScript: error loading defaultModels.json', err);
  }
}

/** 2) Read stored styles, build regex, then start infinite polling */
function init() {
  chrome.storage.sync.get({ modelStyles: defaultModelStyles }, res => {
    modelStyles = res.modelStyles;
    updatePattern();
    // initial style
    applyModelStyle();
    // poll forever
    setInterval(applyModelStyle, 500);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.modelStyles) {
      modelStyles = changes.modelStyles.newValue;
      updatePattern();
    }
  });
}

/** 3) Build alias map + regex */
function getMainEntries() {
  const aliasSet = new Set();
  Object.values(modelStyles).forEach(cfg => {
    if (Array.isArray(cfg.names)) {
      cfg.names.forEach(n => aliasSet.add(n.toLowerCase()));
    }
  });
  return Object.entries(modelStyles)
    .filter(([k]) => !aliasSet.has(k.toLowerCase()));
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

/** 4) Scan for both default & custom GPT buttons, build one <style> block */
function applyModelStyle() {
  if (!pattern) return;

  // remove old
  document.getElementById('cm-style')?.remove();
  let css = '';

  // — Default dropdown —
  const btnDefault = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
  if (btnDefault) {
    const text = btnDefault.innerText.trim().split(' ').slice(1).join(' ').trim();
    if (pattern.test(text)) {
      const key = aliasMap[text.toLowerCase()] || text;
      const cfg = modelStyles[key];
      if (cfg) {
        css += `
[data-testid="model-switcher-dropdown-button"] span {
  color: ${cfg.color} !important;
  font-weight: bold !important;
  ${cfg.showBorder ? `border:1px dashed ${cfg.color}; padding:2px;` : 'border:none;'}
}`;
        if (cfg.showEmoji) {
          css += `
[data-testid="model-switcher-dropdown-button"] > div::before {
  content: "${cfg.icon}";
  margin-right: 6px;
  font-size: 1.2em;
  position: relative;
  top: 1px;
}`;
        }
      }
    }
  }

  // — Custom GPT buttons —
  const custom = document.querySelectorAll('div.group.flex.cursor-pointer.items-center.gap-1[type="button"]');
  custom.forEach(el => {
    const text = el.textContent.trim();
    if (pattern.test(text)) {
      const key = aliasMap[text.toLowerCase()] || text;
      const cfg = modelStyles[key];
      if (cfg) {
        css += `
div#${el.id} {
  color: ${cfg.color} !important;
  font-weight: bold !important;
  ${cfg.showBorder ? `border:1px dashed ${cfg.color}; padding:2px;` : 'border:none;'}
}`;
        if (cfg.showEmoji) {
          css += `
div#${el.id}::before {
  content: "${cfg.icon}";
  margin-right: 6px;
  font-size: 1.2em;
  vertical-align: middle;
}`;
        }
      }
    }
  });

  if (css) {
    const style = document.createElement('style');
    style.id = 'cm-style';
    style.textContent = css;
    document.head.appendChild(style);
  }
}

// 5) Kick things off
loadDefaults();
