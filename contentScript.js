let defaultModelStyles = {};

fetch(chrome.runtime.getURL('./defaultModels.json'))
  .then((response) => response.json())
  .then((json) => {
    defaultModelStyles = json;
  });

let modelStyles = {};
let keys = [];
let pattern = null;
let interval = null;

// Rebuild the keys+pattern whenever modelStyles changes
function updatePattern() {
  keys = Object.keys(modelStyles)
               .sort((a, b) => b.length - a.length);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  pattern = new RegExp(`^(${keys.map(esc).join('|')})$`, 'i');
}

// Apply styles to the model‑button if it matches one of our keys
function applyModelStyle() {
  const btn = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
  if (!btn || !pattern) return;

  const text = btn.innerText.trim().split(" ").slice(1).join(" ").trim();
  if (!pattern.test(text)) return;

  const modelKey = keys.find(k => k.toLowerCase() === text.toLowerCase());
  const cfg = modelStyles[modelKey];
  if (!cfg) return;

  document.getElementById("cm-style")?.remove();
  const style = document.createElement("style");
  style.id = "cm-style";

  let css = `
    [data-testid="model-switcher-dropdown-button"] span {
      color: ${cfg.color} !important;
      font-weight: bold !important;
      ${cfg.showBorder ? `border: 1px dashed ${cfg.color};` : `border: none;`}
      padding: 2px;
      position: relative;
    }
  `;
  if (cfg.showEmoji) {
    css += `
      [data-testid="model-switcher-dropdown-button"] > div::before {
        content: "${cfg.icon}";
        margin-right: 6px;
        font-size: 1.2em;
        position: relative;
        top: 1px;
      }
    `;
  }

  style.textContent = css;
  document.head.appendChild(style);
}

// Wait for the button to exist, then observe it
function startWhenReady() {
  const btn = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
  if (!btn) return;
  clearInterval(interval);
  applyModelStyle();
  new MutationObserver(applyModelStyle)
    .observe(btn, { childList: true, subtree: true, characterData: true });
}

//  -- initialize from storage --
chrome.storage.sync.get({ modelStyles: defaultModelStyles }, res => {
  modelStyles = res.modelStyles;
  updatePattern();
  applyModelStyle();
  // keep polling until the button shows up
  interval = setInterval(startWhenReady, 500);
});

//  -- re‑initialize whenever someone saves new settings in the popup --
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.modelStyles) {
    modelStyles = changes.modelStyles.newValue;
    updatePattern();
    applyModelStyle();
  }
});