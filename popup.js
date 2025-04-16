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
  const btnEditor = document.querySelector('button[data-tab="editor"]');
  const btnJSON   = document.querySelector('button[data-tab="json"]');
  const tabEditor = document.getElementById('editor');
  const tabJSON   = document.getElementById('json');

  const container = document.getElementById('container');
  const saveBtn   = document.getElementById('save');
  const addForm   = document.getElementById('addForm');
  const jsonArea  = document.getElementById('jsonArea');
  const copyBtn   = document.getElementById('copyJSON');
  const importBtn = document.getElementById('importJSON');

  // Tab switching
  function switchTab(to) {
    if (to === 'editor') {
      btnEditor.classList.add('active');
      btnJSON.classList.remove('active');
      tabEditor.classList.add('active');
      tabJSON.classList.remove('active');
    } else {
      btnEditor.classList.remove('active');
      btnJSON.classList.add('active');
      tabEditor.classList.remove('active');
      tabJSON.classList.add('active');
      jsonArea.value = JSON.stringify(modelStyles, null, 2);
    }
  }
  btnEditor.onclick = ()=> switchTab('editor');
  btnJSON.onclick   = ()=> switchTab('json');

  // Render the editor UI
  function renderEditor() {
    container.innerHTML = '';
    for (const key of Object.keys(modelStyles)) {
      const cfg = modelStyles[key];
      const row = document.createElement('div');
      row.className = 'model-row';
      row.innerHTML = `
        <div>
          <strong>${key}</strong>
          <button class="remove" data-model="${key}" title="Eliminar">✖</button>
        </div>
        <label>Color: <input type="color" class="color" data-model="${key}" value="${cfg.color}"></label>
        <label>Emoji: <input type="text" class="icon" data-model="${key}" value="${cfg.icon}" maxlength="2" style="width:2em;"></label>
        <label><input type="checkbox" class="showEmoji" data-model="${key}" ${cfg.showEmoji?'checked':''}/> Emoji</label>
        <label><input type="checkbox" class="showBorder" data-model="${key}" ${cfg.showBorder?'checked':''}/> Borde</label>
      `;
      container.appendChild(row);
    }
  }

  // 2) Load from storage, with DEFAULT fallback, and initialize if empty
  chrome.storage.sync.get(['modelStyles'], ({ modelStyles: ms }) => {
    if (!ms) {
      modelStyles = defaultModelStyles;
      chrome.storage.sync.set({ modelStyles }, () => {
        renderEditor();
      });
    } else {
      modelStyles = ms;
      renderEditor();
    }
  });

  // Save button
  saveBtn.addEventListener('click', () => {
    document.querySelectorAll('.model-row').forEach(row => {
      const key = row.querySelector('.color').dataset.model;
      modelStyles[key].color       = row.querySelector('.color').value;
      modelStyles[key].icon        = row.querySelector('.icon').value;
      modelStyles[key].showEmoji   = row.querySelector('.showEmoji').checked;
      modelStyles[key].showBorder  = row.querySelector('.showBorder').checked;
    });
    chrome.storage.sync.set({ modelStyles }, () => window.close());
  });

  // Remove a model
  container.addEventListener('click', e => {
    if (e.target.classList.contains('remove')) {
      delete modelStyles[e.target.dataset.model];
      renderEditor();
    }
  });

  // Add new model
  addForm.addEventListener('submit', e => {
    e.preventDefault();
    const name  = addForm.elements['modelName'].value.trim();
    const color = addForm.elements['modelColor'].value;
    const icon  = addForm.elements['modelIcon'].value;
    if (!name || modelStyles[name]) return;
    modelStyles[name] = { color, icon, showEmoji: true, showBorder: true };
    renderEditor();
    addForm.reset();
  });

  // Copy JSON to clipboard
  copyBtn.addEventListener('click', () => {
    jsonArea.select();
    document.execCommand('copy');
  });

  // Import JSON
  importBtn.addEventListener('click', () => {
    try {
      const obj = JSON.parse(jsonArea.value);
      if (typeof obj !== 'object' || obj === null) throw '';
      modelStyles = obj;
      chrome.storage.sync.set({ modelStyles }, () => {
        renderEditor();
        alert('✅ Configuración importada.');
        switchTab('editor');
      });
    } catch {
      alert('❌ JSON inválido');
    }
  });

  // Start on the editor tab
  switchTab('editor');
});