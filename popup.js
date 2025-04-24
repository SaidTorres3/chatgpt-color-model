let defaultModelStyles = {};
let modelStyles = {};
let aliasEnabled = false;

/**
 * Broadcast the new styles to the active tab immediately,
 * bypassing storage.sync rate limits.
 */
function notifyContentScripts() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'UPDATE_MODEL_STYLES',
        modelStyles,
        aliasEnabled
      });
    }
  });
}

function initializePopup() {
  const $ = id => document.getElementById(id);
  const i18n = k => chrome.i18n?.getMessage(k) || k;

  // Cache DOM
  const tabs = { editor: $("tabEditor"), json: $("tabJSON") };
  const aliasCB = $("aliasToggle");
  const aliasL = $("aliasToggleText");
  const container = $("container");
  const jsonArea = $("jsonArea");
  const addForm = $("addForm");
  const syncBtn = $("syncButton");
  const copyBtn = $("copyJSON");
  const importBtn = $("importJSON");
  const resetBtn = $("resetJSON");
  const reportBtn = $("reportButton");

  // i18n labels
  tabs.editor.textContent = i18n("tabEditorLabel") || "Editor";
  tabs.json.textContent = i18n("tabJSONLabel") || "JSON";
  aliasL.textContent = i18n("aliasToggle") || "Usar alias";
  $("addModelHeading").textContent = i18n("addModelHeading") || "Nuevo modelo";
  $("modelNameInput").placeholder = i18n("modelNamePlaceholder") || "Nombre";
  $("modelIconInput").placeholder = i18n("emojiLabel") || "Emoji";
  $("addButton").textContent = i18n("addButton") || "Añadir";
  syncBtn.textContent = i18n("syncButton") || "Sincronizar";
  copyBtn.textContent = i18n("copyJSON") || "Copiar";
  importBtn.textContent = i18n("importJSON") || "Importar";
  resetBtn.textContent = i18n("resetJSON") || "Reset JSON";
  reportBtn.textContent = i18n("reportIssue") || "Report Issue";

  // Report Issue button
  reportBtn.onclick = () => {
    chrome.tabs.create({
      url: "https://github.com/SaidTorres3/chatgpt-color-model/issues"
    });
  };

  // Tab switching
  function switchTab(to) {
    document.querySelectorAll(".tabs button")
      .forEach(b => b.classList.toggle("active", b.dataset.tab === to));
    document.querySelectorAll(".tab-content")
      .forEach(d => d.classList.toggle("active", d.id === to));
    if (to === "json") {
      jsonArea.value = JSON.stringify(modelStyles, null, 2);
    }
  }
  tabs.editor.onclick = () => switchTab("editor");
  tabs.json.onclick = () => switchTab("json");

  // Helpers
  function getMainKeys() {
    const all = Object.keys(modelStyles);
    const aliasSet = new Set();
    all.forEach(k => {
      const cfg = modelStyles[k];
      if (Array.isArray(cfg.names)) cfg.names.forEach(n => aliasSet.add(n));
    });
    return all.filter(k => !aliasSet.has(k));
  }

  function renderEditor() {
    container.innerHTML = "";
    getMainKeys().forEach(key => {
      const cfg = modelStyles[key];
      const row = document.createElement("div");
      row.className = "model-row";
      row.innerHTML = `
        <div>
          <strong>${i18n(key)}</strong>
          <button class="remove" data-model="${key}">✖</button>
        </div>
        <label>${i18n("colorLabel")}:
          <input type="color" class="color" data-model="${key}" value="${cfg.color}">
        </label>
        <label>${i18n("emojiLabel")}:
          <input type="text" class="icon" data-model="${key}"
                 value="${cfg.icon}" maxlength="2" style="width:2em;">
        </label>
        <label><input type="checkbox" class="showEmoji" data-model="${key}"
                      ${cfg.showEmoji ? "checked" : ""}/> ${i18n("emojiLabel")}</label>
        <label><input type="checkbox" class="showBorder" data-model="${key}"
                      ${cfg.showBorder ? "checked" : ""}/> ${i18n("borderCheckboxLabel")}</label>
        ${aliasEnabled ? `
        <label>${i18n("aliasToggle")}:
          <input type="text" class="aliases" data-model="${key}"
                placeholder="${chrome.i18n.getMessage("aliasInstruction")}"
                value="${(cfg.names || []).join(", ")}"
                style="width:300px;">
        </label>` : ""}
      `;
      container.appendChild(row);
    });
  }

  // Load from storage
  chrome.storage.sync.get(['modelStyles', 'aliasEnabled'], res => {
    modelStyles = res.modelStyles ?? JSON.parse(JSON.stringify(defaultModelStyles));
    aliasEnabled = res.aliasEnabled ?? false;
    aliasCB.checked = aliasEnabled;
    renderEditor();
  });

  // Auto-save + live-update
  function updateAndSave() {
    getMainKeys().forEach(key => {
      const cfg = modelStyles[key];
      const row = container.querySelector(`[data-model="${key}"]`).closest(".model-row");
      cfg.color = row.querySelector(".color").value;
      cfg.icon = row.querySelector(".icon").value;
      cfg.showEmoji = row.querySelector(".showEmoji").checked;
      cfg.showBorder = row.querySelector(".showBorder").checked;
      if (aliasEnabled) {
        const aliases = row.querySelector(".aliases").value
          .split(",").map(s => s.trim())
          .filter(a => a && a.toLowerCase() !== key.toLowerCase());
        const unique = [...new Set(aliases)];
        if (unique.length) cfg.names = unique;
        else delete cfg.names;
      } else {
        delete cfg.names;
      }
    });
    // Remove orphan aliases
    const toDelete = Object.keys(modelStyles).filter(k => {
      const allAliases = getMainKeys().flatMap(m => modelStyles[m].names || []);
      return allAliases.includes(k);
    });
    toDelete.forEach(k => delete modelStyles[k]);

    chrome.storage.sync.set({ modelStyles, aliasEnabled }, notifyContentScripts);
  }
  container.addEventListener("input", updateAndSave);
  container.addEventListener("change", updateAndSave);

  // Alias toggle (manual only)
  aliasCB.onchange = () => {
    aliasEnabled = aliasCB.checked;
    renderEditor();
    chrome.storage.sync.set({ modelStyles, aliasEnabled }, notifyContentScripts);
  };

  // Delete model
  container.onclick = e => {
    if (e.target.matches(".remove")) {
      delete modelStyles[e.target.dataset.model];
      renderEditor();
      chrome.storage.sync.set({ modelStyles, aliasEnabled }, notifyContentScripts);
    }
  };

  // Add model
  addForm.onsubmit = e => {
    e.preventDefault();
    const name = $("modelNameInput").value.trim();
    if (!name || modelStyles[name]) return;
    modelStyles[name] = {
      color: $("modelColorInput").value,
      icon: $("modelIconInput").value,
      showEmoji: true,
      showBorder: true
    };
    renderEditor();
    addForm.reset();
    chrome.storage.sync.set({ modelStyles, aliasEnabled }, notifyContentScripts);
  };

  // Sync with defaults
  syncBtn.onclick = () => {
    Object.keys(defaultModelStyles).forEach(key => {
      if (!(key in modelStyles)) {
        modelStyles[key] = defaultModelStyles[key];
      }
    });
    chrome.storage.sync.set({ modelStyles, aliasEnabled }, () => {
      renderEditor();
      alert(i18n("syncCompleted") || "Models updated successfully.");
      notifyContentScripts();
    });
  };

  // Copy JSON
  copyBtn.onclick = () => {
    jsonArea.select();
    document.execCommand("copy");
  };

  // Import JSON
  importBtn.onclick = () => {
    try {
      const obj = JSON.parse(jsonArea.value);
      modelStyles = obj;
      chrome.storage.sync.set({ modelStyles, aliasEnabled }, () => {
        renderEditor();
        switchTab("editor");
        alert(i18n("importCompleted") || "Import completed.");
        notifyContentScripts();
      });
    } catch {
      alert(i18n("invalidJSON") || "JSON inválido");
    }
  };

  // Reset JSON
  resetBtn.onclick = () => {
    modelStyles = JSON.parse(JSON.stringify(defaultModelStyles));
    chrome.storage.sync.set({ modelStyles, aliasEnabled }, () => {
      jsonArea.value = JSON.stringify(modelStyles, null, 2);
      renderEditor();
      switchTab("json");
      alert(i18n("resetCompleted") || "Reset to default values.");
      notifyContentScripts();
    });
  };

  switchTab("editor");
}

// Bootstrap
document.addEventListener("DOMContentLoaded", () => {
  fetch(chrome.runtime.getURL('defaultModels.json'))
    .then(res => res.json())
    .then(json => {
      defaultModelStyles = json;
      initializePopup();
    })
    .catch(err => console.error('popup.js: error fetching defaults', err));
});
