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
  const syncBtn = $("syncButton");
  const saveBtn = $("saveButton");

  // i18n labels (o texto por defecto)
  tabs.editor.textContent = i18n("tabEditorLabel") || "Editor";
  tabs.json.textContent = i18n("tabJSONLabel") || "JSON";
  aliasL.textContent = i18n("aliasToggle") || "Usar alias";
  $("addModelHeading").textContent = i18n("addModelHeading") || "Nuevo modelo";
  $("modelNameInput").placeholder = i18n("modelNamePlaceholder") || "Nombre";
  $("modelIconInput").placeholder = i18n("emojiLabel") || "Emoji";
  $("addButton").textContent = i18n("addButton") || "Añadir";
  syncBtn.textContent = i18n("syncButton") || "Sincronizar";
  saveBtn.textContent = i18n("saveButton") || "Guardar";
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

  // Obtiene sólo las claves “principales” (no alias)
  function getMainKeys() {
    const all = Object.keys(modelStyles);
    const aliasSet = new Set();
    all.forEach(k => {
      const cfg = modelStyles[k];
      if (Array.isArray(cfg.names)) {
        cfg.names.forEach(n => aliasSet.add(n));
      }
    });
    return all.filter(k => !aliasSet.has(k));
  }

  // Dibuja filas en el editor
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

  // Carga inicial desde storage
  chrome.storage.sync.get(
    { modelStyles: defaultModelStyles, aliasEnabled: false },
    ({ modelStyles: ms, aliasEnabled: ae }) => {
      modelStyles = ms;
      aliasEnabled = ae;
      aliasCB.checked = aliasEnabled;
      renderEditor();
    }
  );

  // Toggle alias inputs
  aliasCB.onchange = () => {
    aliasEnabled = aliasCB.checked;
    renderEditor();
  };

  syncBtn.onclick = () => {
    // Añade todos los defaults que falten
    Object.keys(defaultModelStyles).forEach(key => {
      if (!(key in modelStyles)) {
        modelStyles[key] = defaultModelStyles[key];
      }
    });
    // Guarda y refresca
    chrome.storage.sync.set({ modelStyles, aliasEnabled }, () => {
      renderEditor();
      alert(i18n("syncCompleted") || "Sync completed.");
    });
  };

  // Guardar cambios manuales
  saveBtn.onclick = () => {
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

    // Elimina claves que sean alias puros
    const toDelete = Object.keys(modelStyles).filter(k => {
      const allAliases = getMainKeys().flatMap(m => modelStyles[m].names || []);
      return allAliases.includes(k);
    });
    toDelete.forEach(k => delete modelStyles[k]);

    chrome.storage.sync.set({ modelStyles, aliasEnabled }, () => window.close());
  };

  // Quitar un modelo
  container.onclick = e => {
    if (e.target.matches(".remove")) {
      delete modelStyles[e.target.dataset.model];
      renderEditor();
    }
  };

  // Añadir nuevo modelo
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

  // Copiar JSON
  $("copyJSON").onclick = () => {
    jsonArea.select();
    document.execCommand("copy");
  };

  // Importar JSON manualmente
  $("importJSON").onclick = () => {
    try {
      const obj = JSON.parse(jsonArea.value);
      modelStyles = obj;
      aliasEnabled = Object.values(obj).some(c => Array.isArray(c.names));
      aliasCB.checked = aliasEnabled;
      // Limpiar viejos alias de default
      Object.keys(defaultModelStyles)
        .filter(k => Array.isArray(defaultModelStyles[k].names))
        .flatMap(k => defaultModelStyles[k].names)
        .forEach(a => { if (modelStyles[a]) delete modelStyles[a]; });

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

// Arranca al cargar el DOM y tras obtener defaults
document.addEventListener("DOMContentLoaded", () => {
  fetch(chrome.runtime.getURL('defaultModels.json'))
    .then(res => res.json())
    .then(json => {
      defaultModelStyles = json;
      initializePopup();
    })
    .catch(err => console.error('popup.js: error fetching defaults', err));
});