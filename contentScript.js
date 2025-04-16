const defaultModelStyles = {
  "4":            { color: "#343a40", icon: "👴", showEmoji: true, showBorder: true },
  "4o":           { color: "#007bff", icon: "😊", showEmoji: true, showBorder: true },
  "4o mini":      { color: "#fd7e14", icon: "⚡", showEmoji: true, showBorder: true },
  "Tareas":       { color: "#17a2b8", icon: "📋", showEmoji: true, showBorder: true },
  "Tasks":        { color: "#17a2b8", icon: "📋", showEmoji: true, showBorder: true },
  "4.5":          { color: "#dc3545", icon: "🧪", showEmoji: true, showBorder: true },
  "o3":           { color: "#20c997", icon: "💎", showEmoji: true, showBorder: true },
  "o4-mini":      { color: "#28a745", icon: "🌀", showEmoji: true, showBorder: true },
  "o4-mini-high": { color: "#6f42c1", icon: "🧠", showEmoji: true, showBorder: true }
};

let modelStyles = {};
let interval;

// Crear patrón regex para reconocer el nombre de modelo
const keys = Object.keys(defaultModelStyles).sort((a,b)=>b.length-a.length);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = new RegExp(`^(${keys.map(esc).join('|')})$`, 'i');

function applyModelStyle() {
  const btn = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
  if (!btn) return;

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

function startWhenReady() {
  const btn = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
  if (!btn) return;
  clearInterval(interval);
  applyModelStyle();
  new MutationObserver(applyModelStyle)
    .observe(btn, { childList: true, subtree: true, characterData: true });
}

chrome.storage.sync.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.modelStyles) {
    modelStyles = changes.modelStyles.newValue;
    applyModelStyle();
  }
});

chrome.storage.sync.get({ modelStyles: defaultModelStyles }, res => {
  modelStyles = res.modelStyles;
  applyModelStyle();
  interval = setInterval(startWhenReady, 500);
});
