let defaultModelStyles = {};
let modelStyles = {};
let aliasEnabled = false;

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

  // i18n labels
  tabs.editor.textContent = i18n("tabEditorLabel");
  tabs.json.textContent = i18n("tabJSONLabel");
  aliasL.textContent = i18n("aliasToggle") || "Usar alias";
  $("addModelHeading").textContent = i18n("addModelHeading") || "Nuevo modelo";
  $("modelNameInput").placeholder = i18n("modelNamePlaceholder") || "Nombre";
  $("modelIconInput").placeholder = i18n("emojiLabel") || "Emoji";
  $("addButton").textContent = i18n("addButton") || "Añadir";
  $("saveButton").textContent = i18n("saveButton") || "Guardar";
  $("copyJSON").textContent = i18n("copyJSON") || "Copiar";
  $("importJSON").textContent = i18n("importJSON") || "Importar";

  // Tab switching
  function switchTab(to) {
    document.querySelectorAll(".tabs button")
      .forEach(b => b.classList.toggle("active", b.dataset.tab === to));
    document.querySelectorAll(".tab-content")
      .forEach(d => d.classList.toggle("active", d.id === to));
    if (to === "json") jsonArea.value = JSON.stringify(modelStyles, null, 2);
  }
  tabs.editor.onclick = () => switchTab("editor");
  tabs.json.onclick = () => switchTab("json");

  // Figure out which keys are “main” (i.e. not aliases)
  function getMainKeys() {
    const all = Object.keys(modelStyles);
    const aliasSet = new Set();
    all.forEach(k => {
      const cfg = modelStyles[k];
      if (Array.isArray(cfg.names)) {
        cfg.names.forEach(n => aliasSet.add(n));
      }
    });
    const mains = all.filter(k => !aliasSet.has(k));
    return mains;
  }

  // Draw the editor rows
  function renderEditor() {
    container.innerHTML = "";
    getMainKeys().forEach(key => {
      const cfg = modelStyles[key];
      const row = document.createElement("div");
      row.className = "model-row";
      row.innerHTML = `
        <div>
          <strong>${key}</strong>
          <button class="remove" data-model="${key}">✖</button>
        </div>
        <label>Color:
          <input type="color" class="color" data-model="${key}" value="${cfg.color}">
        </label>
        <label>Emoji:
          <input type="text" class="icon" data-model="${key}"
                 value="${cfg.icon}" maxlength="2" style="width:2em;">
        </label>
        <label><input type="checkbox" class="showEmoji" data-model="${key}"
                      ${cfg.showEmoji ? "checked" : ""}/> Emoji</label>
        <label><input type="checkbox" class="showBorder" data-model="${key}"
                      ${cfg.showBorder ? "checked" : ""}/> Borde</label>
        ${aliasEnabled ? `
        <label>Alias:
          <input type="text" class="aliases" data-model="${key}"
                 placeholder="coma separada"
                 value="${(cfg.names || []).join(", ")}"
                 style="width:120px;">
        </label>` : ""}
      `;
      container.appendChild(row);
    });
  }

  // Load from storage (with defaults)
  chrome.storage.sync.get(
    { modelStyles: defaultModelStyles, aliasEnabled: false },
    ({ modelStyles: ms, aliasEnabled: ae }) => {
      modelStyles = ms;
      aliasEnabled = ae;
      aliasCB.checked = aliasEnabled;
      renderEditor();
    }
  );

  // Toggle alias input
  aliasCB.onchange = () => {
    aliasEnabled = aliasCB.checked;
    renderEditor();
  };

  // Save edits
  $("saveButton").onclick = () => {
    getMainKeys().forEach(key => {
      const cfg = modelStyles[key];
      const row = container.querySelector(`[data-model="${key}"]`).closest(".model-row");
      cfg.color = row.querySelector(".color").value;
      cfg.icon = row.querySelector(".icon").value;
      cfg.showEmoji = row.querySelector(".showEmoji").checked;
      cfg.showBorder = row.querySelector(".showBorder").checked;
      if (aliasEnabled) {
        const aliases = row.querySelector(".aliases").value
          .split(",").map(s => s.trim()).filter(Boolean);
        if (aliases.length) cfg.names = aliases;
        else delete cfg.names;
      } else {
        delete cfg.names;
      }
    });

    // remove any keys that are pure aliases
    const toDelete = Object.keys(modelStyles).filter(k => {
      const allAliases = getMainKeys().flatMap(m => modelStyles[m].names || []);
      return allAliases.includes(k);
    });
    toDelete.forEach(k => delete modelStyles[k]);

    chrome.storage.sync.set({ modelStyles, aliasEnabled }, () => {
      window.close();
    });
  };

  // Remove a model
  container.onclick = e => {
    if (e.target.matches(".remove")) {
      delete modelStyles[e.target.dataset.model];
      renderEditor();
    }
  };

  // Add a new one
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
  };

  // Copy JSON
  $("copyJSON").onclick = () => {
    jsonArea.select();
    document.execCommand("copy");
  };

  // Import JSON manually
  $("importJSON").onclick = () => {
    try {
      const obj = JSON.parse(jsonArea.value);
      modelStyles = obj;
      aliasEnabled = Object.values(obj).some(c => Array.isArray(c.names));
      aliasCB.checked = aliasEnabled;

      // strip out any leftover alias keys
      const defaultAliases = Object.keys(defaultModelStyles)
        .filter(k => Array.isArray(defaultModelStyles[k].names))
        .flatMap(k => defaultModelStyles[k].names);
      defaultAliases.forEach(a => {
        if (modelStyles[a]) {
          delete modelStyles[a];
        }
      });

      chrome.storage.sync.set({ modelStyles, aliasEnabled }, () => {
        renderEditor();
        switchTab("editor");
      });
    } catch (err) {
      console.error('popup.js: invalid JSON', err);
      alert("JSON inválido");
    }
  };

  switchTab("editor");
}

// Wait for DOM, then fetch defaults, then init
document.addEventListener("DOMContentLoaded", () => {
  fetch(chrome.runtime.getURL('defaultModels.json'))
    .then(res => res.json())
    .then(json => {
      defaultModelStyles = json;
      initializePopup();
    })
    .catch(err => console.error('popup.js: error fetching defaults', err));
});
