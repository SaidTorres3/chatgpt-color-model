// your default styles (same as before)
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

document.addEventListener('DOMContentLoaded', () => {
  // grab all the elements
  const tabEditor   = document.getElementById('tabEditor');
  const tabJSON     = document.getElementById('tabJSON');
  const container   = document.getElementById('container');
  const addForm     = document.getElementById('addForm');
  const saveButton  = document.getElementById('saveButton');
  const copyJSON    = document.getElementById('copyJSON');
  const importJSON  = document.getElementById('importJSON');
  const jsonArea    = document.getElementById('jsonArea');
  const modelNameIn = document.getElementById('modelNameInput');
  const modelColorIn= document.getElementById('modelColorInput');
  const modelIconIn = document.getElementById('modelIconInput');
  const addButton   = document.getElementById('addButton');
  const addModelHd  = document.getElementById('addModelHeading');

  // fill all static labels from i18n
  tabEditor.textContent      = chrome.i18n.getMessage('tabEditorLabel');
  tabJSON.textContent        = chrome.i18n.getMessage('tabJSONLabel');
  addModelHd.textContent     = chrome.i18n.getMessage('addModelHeading');
  modelNameIn.placeholder    = chrome.i18n.getMessage('modelNamePlaceholder');
  modelIconIn.placeholder    = chrome.i18n.getMessage('emojiLabel');
  addButton.textContent      = chrome.i18n.getMessage('addButton');
  saveButton.textContent     = chrome.i18n.getMessage('saveButton');
  copyJSON.textContent       = chrome.i18n.getMessage('copyJSON');
  importJSON.textContent     = chrome.i18n.getMessage('importJSON');

  // tab switching
  function switchTab(to) {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === to));
    document.querySelectorAll('.tab-content').forEach(div => div.classList.toggle('active', div.id === to));
    if (to === 'json') {
      jsonArea.value = JSON.stringify(modelStyles, null, 2);
    }
  }
  tabEditor.addEventListener('click', ()=> switchTab('editor'));
  tabJSON.addEventListener('click',   ()=> switchTab('json'));

  // render the model‑editor rows
  function renderEditor() {
    container.innerHTML = '';
    for (const key of Object.keys(modelStyles)) {
      const cfg = modelStyles[key];
      const row = document.createElement('div');
      row.className = 'model-row';
      row.innerHTML = `
        <div>
          <strong>${key}</strong>
          <button class="remove" data-model="${key}" title="${chrome.i18n.getMessage('removeTooltip')}">✖</button>
        </div>
        <label>${chrome.i18n.getMessage('colorLabel')}: 
          <input type="color" class="color" data-model="${key}" value="${cfg.color}">
        </label>
        <label>${chrome.i18n.getMessage('emojiLabel')}: 
          <input type="text" class="icon" data-model="${key}" value="${cfg.icon}" maxlength="2" style="width:2em;">
        </label>
        <label>
          <input type="checkbox" class="showEmoji" data-model="${key}" ${cfg.showEmoji?'checked':''}/>
          ${chrome.i18n.getMessage('emojiCheckboxLabel')}
        </label>
        <label>
          <input type="checkbox" class="showBorder" data-model="${key}" ${cfg.showBorder?'checked':''}/>
          ${chrome.i18n.getMessage('borderCheckboxLabel')}
        </label>
      `;
      container.appendChild(row);
    }
  }

  // load (or init) storage
  chrome.storage.sync.get('modelStyles', ({ modelStyles: ms }) => {
    if (!ms) {
      modelStyles = defaultModelStyles;
      chrome.storage.sync.set({ modelStyles }, renderEditor);
    } else {
      modelStyles = ms;
      renderEditor();
    }
  });

  // save changes
  saveButton.addEventListener('click', () => {
    container.querySelectorAll('.model-row').forEach(row => {
      const key = row.querySelector('.color').dataset.model;
      modelStyles[key].color      = row.querySelector('.color').value;
      modelStyles[key].icon       = row.querySelector('.icon').value;
      modelStyles[key].showEmoji  = row.querySelector('.showEmoji').checked;
      modelStyles[key].showBorder = row.querySelector('.showBorder').checked;
    });
    chrome.storage.sync.set({ modelStyles }, () => window.close());
  });

  // remove a model
  container.addEventListener('click', e => {
    if (e.target.matches('.remove')) {
      delete modelStyles[e.target.dataset.model];
      renderEditor();
    }
  });

  // add a model
  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const name  = modelNameIn.value.trim();
    const color = modelColorIn.value;
    const icon  = modelIconIn.value;
    if (!name || modelStyles[name]) return;
    modelStyles[name] = { color, icon, showEmoji: true, showBorder: true };
    renderEditor();
    addForm.reset();
  });

  // copy JSON
  copyJSON.addEventListener('click', () => {
    jsonArea.select();
    document.execCommand('copy');
  });

  // import JSON
  importJSON.addEventListener('click', () => {
    try {
      const obj = JSON.parse(jsonArea.value);
      if (typeof obj !== 'object' || obj === null) throw '';
      modelStyles = obj;
      chrome.storage.sync.set({ modelStyles }, () => {
        renderEditor();
        alert(chrome.i18n.getMessage('configImported'));
        switchTab('editor');
      });
    } catch {
      alert(chrome.i18n.getMessage('invalidJSON'));
    }
  });

  // start
  switchTab('editor');
});
