let customThemes = {};
let editingThemeId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const themeSelect = document.getElementById('themeSelect');
  const volumeStepInput = document.getElementById('volumeStep');
  const scrollEnabledCheckbox = document.getElementById('scrollEnabled');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');
  
  const createThemeBtn = document.getElementById('createThemeBtn');
  const editThemeBtn = document.getElementById('editThemeBtn');
  const deleteThemeBtn = document.getElementById('deleteThemeBtn');
  const themeBuilder = document.getElementById('themeBuilder');
  const closeBuilderBtn = document.getElementById('closeBuilderBtn');
  const saveCustomThemeBtn = document.getElementById('saveCustomThemeBtn');
  const importThemeBtn = document.getElementById('importThemeBtn');
  const exportThemeBtn = document.getElementById('exportThemeBtn');
  const importFileInput = document.getElementById('importFileInput');
  const customThemeNameInput = document.getElementById('customThemeName');
  const builderTitle = document.getElementById('builderTitle');

  const colorInputs = {
    bg0: document.getElementById('color-bg0'),
    bg1: document.getElementById('color-bg1'),
    bg2: document.getElementById('color-bg2'),
    bg3: document.getElementById('color-bg3'),
    fg0: document.getElementById('color-fg0'),
    fg1: document.getElementById('color-fg1'),
    fg2: document.getElementById('color-fg2'),
    accent: document.getElementById('color-accent'),
    accent2: document.getElementById('color-accent2'),
    accent3: document.getElementById('color-accent3'),
    success: document.getElementById('color-success'),
    error: document.getElementById('color-error')
  };

  function applyTheme(themeName) {
    let theme = THEMES[themeName] || customThemes[themeName];
    if (!theme) return;

    document.documentElement.style.setProperty('--bg0', theme.bg0);
    document.documentElement.style.setProperty('--bg1', theme.bg1);
    document.documentElement.style.setProperty('--bg2', theme.bg2);
    document.documentElement.style.setProperty('--bg3', theme.bg3);
    document.documentElement.style.setProperty('--fg0', theme.fg0);
    document.documentElement.style.setProperty('--fg1', theme.fg1);
    document.documentElement.style.setProperty('--fg2', theme.fg2);
    document.documentElement.style.setProperty('--accent', theme.accent);
    document.documentElement.style.setProperty('--accent2', theme.accent2);
    document.documentElement.style.setProperty('--accent3', theme.accent3);
    document.documentElement.style.setProperty('--success', theme.success);
    document.documentElement.style.setProperty('--error', theme.error);
  }

  function updateColorInputs(theme) {
    Object.keys(colorInputs).forEach(key => {
      colorInputs[key].value = theme[key];
    });
  }

  function getThemeFromInputs() {
    const theme = {};
    Object.keys(colorInputs).forEach(key => {
      theme[key] = colorInputs[key].value;
    });
    return theme;
  }

  function applyLivePreview() {
    const theme = getThemeFromInputs();
    Object.keys(theme).forEach(key => {
      document.documentElement.style.setProperty(`--${key}`, theme[key]);
    });
  }

  Object.values(colorInputs).forEach(input => {
    input.addEventListener('input', applyLivePreview);
  });

  async function loadCustomThemes() {
    try {
      const result = await chrome.storage.sync.get(['customThemes']);
      const loadedThemes = result.customThemes || {};
      
      const hexPattern = /^#[0-9A-Fa-f]{6}$/;
      const requiredColors = ['bg0', 'bg1', 'bg2', 'bg3', 'fg0', 'fg1', 'fg2', 'accent', 'accent2', 'accent3', 'success', 'error'];
      
      customThemes = Object.fromEntries(
        Object.entries(loadedThemes).filter(([key, theme]) => {
          if (!theme || typeof theme !== 'object' || !theme.name) return false;
          return requiredColors.every(color => theme[color] && hexPattern.test(theme[color]));
        })
      );
      
      updateThemeDropdown();
    } catch (error) {
      console.error('Failed to load custom themes:', error);
    }
  }

  function updateThemeDropdown() {
    const customGroup = document.getElementById('customThemesGroup');
    customGroup.innerHTML = '';
    
    const customThemeKeys = Object.keys(customThemes);
    if (customThemeKeys.length > 0) {
      customGroup.style.display = 'block';
      customThemeKeys.forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = customThemes[key].name;
        customGroup.appendChild(option);
      });
    } else {
      customGroup.style.display = 'none';
    }
  }

  function updateThemeActions() {
    const selectedTheme = themeSelect.value;
    const isCustomTheme = customThemes.hasOwnProperty(selectedTheme);
    
    editThemeBtn.style.display = isCustomTheme ? 'block' : 'none';
    deleteThemeBtn.style.display = isCustomTheme ? 'block' : 'none';
  }

  function openThemeBuilder(mode, themeId = null) {
    editingThemeId = themeId;
    
    if (mode === 'create') {
      builderTitle.textContent = 'Create Custom Theme';
      customThemeNameInput.value = '';
      updateColorInputs(THEMES.nord);
      applyLivePreview();
    } else if (mode === 'edit' && themeId && customThemes[themeId]) {
      builderTitle.textContent = 'Edit Custom Theme';
      customThemeNameInput.value = customThemes[themeId].name;
      updateColorInputs(customThemes[themeId]);
      applyLivePreview();
    }
    
    document.querySelector('.container > h1').style.display = 'none';
    document.querySelectorAll('.container > .setting-group').forEach(el => el.style.display = 'none');
    document.querySelector('.container > button').style.display = 'none';
    themeBuilder.style.display = 'block';
  }

  function closeThemeBuilder() {
    themeBuilder.style.display = 'none';
    document.querySelector('.container > h1').style.display = 'block';
    document.querySelectorAll('.container > .setting-group').forEach(el => el.style.display = 'block');
    document.querySelector('.container > button').style.display = 'block';
    editingThemeId = null;
    applyTheme(themeSelect.value);
  }

  async function saveCustomTheme() {
    const themeName = customThemeNameInput.value.trim().replace(/[^a-zA-Z0-9 -]/g, '');
    
    if (!themeName || themeName.length > 30) {
      showStatus('Invalid theme name (max 30 chars)', 'error');
      return;
    }

    const theme = getThemeFromInputs();
    theme.name = themeName;

    const themeId = editingThemeId || `custom_${crypto.randomUUID()}`;
    
    customThemes[themeId] = theme;
    
    const customThemesSize = JSON.stringify(customThemes).length;
    if (customThemesSize > 90000) {
      showStatus('Storage almost full. Delete unused themes.', 'error');
      delete customThemes[themeId];
      return;
    }
    
    if (Object.keys(customThemes).length > 50) {
      showStatus('Maximum 50 custom themes allowed', 'error');
      delete customThemes[themeId];
      return;
    }
    
    try {
      await chrome.storage.sync.set({ customThemes });
      updateThemeDropdown();
      themeSelect.value = themeId;
      updateThemeActions();
      closeThemeBuilder();
      showStatus(`Theme "${themeName}" saved!`, 'success');
    } catch (error) {
      console.error('Failed to save theme:', error);
      showStatus('Failed to save theme', 'error');
    }
  }

  async function deleteCustomTheme() {
    const selectedTheme = themeSelect.value;
    
    if (!customThemes[selectedTheme]) return;
    
    const themeName = customThemes[selectedTheme].name;
    
    if (!confirm(`Delete theme "${themeName}"?`)) return;
    
    delete customThemes[selectedTheme];
    
    try {
      await chrome.storage.sync.set({ customThemes });
      updateThemeDropdown();
      themeSelect.value = 'nord';
      applyTheme('nord');
      updateThemeActions();
      showStatus(`Theme "${themeName}" deleted`, 'success');
    } catch (error) {
      console.error('Failed to delete theme:', error);
      showStatus('Failed to delete theme', 'error');
    }
  }

  function exportTheme() {
    const theme = getThemeFromInputs();
    theme.name = customThemeNameInput.value.trim() || 'Unnamed Theme';
    
    const json = JSON.stringify(theme, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showStatus('Theme exported!', 'success');
  }

  function importTheme() {
    importFileInput.click();
  }

  importFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 10240) {
      showStatus('File too large (max 10KB)', 'error');
      importFileInput.value = '';
      return;
    }
    
    try {
      const text = await file.text();
      const theme = JSON.parse(text);
      
      if (theme.__proto__ || theme.constructor || theme.prototype) {
        showStatus('Invalid theme file', 'error');
        return;
      }
      
      const requiredColors = ['bg0', 'bg1', 'bg2', 'bg3', 'fg0', 'fg1', 'fg2', 'accent', 'accent2', 'accent3', 'success', 'error'];
      const hexPattern = /^#[0-9A-Fa-f]{6}$/;
      
      if (!theme.name || typeof theme.name !== 'string' || theme.name.length > 30) {
        showStatus('Invalid theme name', 'error');
        return;
      }
      
      for (const color of requiredColors) {
        if (!theme[color] || !hexPattern.test(theme[color])) {
          showStatus(`Invalid color: ${color}`, 'error');
          return;
        }
      }
      
      theme.name = theme.name.replace(/[^a-zA-Z0-9 -]/g, '');
      
      customThemeNameInput.value = theme.name;
      updateColorInputs(theme);
      applyLivePreview();
      
      showStatus('Theme imported! Click Save to keep it', 'success');
    } catch (error) {
      console.error('Failed to import theme:', error);
      showStatus('Failed to import theme', 'error');
    }
    
    importFileInput.value = '';
  });

  createThemeBtn.addEventListener('click', () => openThemeBuilder('create'));
  editThemeBtn.addEventListener('click', () => openThemeBuilder('edit', themeSelect.value));
  deleteThemeBtn.addEventListener('click', deleteCustomTheme);
  closeBuilderBtn.addEventListener('click', closeThemeBuilder);
  saveCustomThemeBtn.addEventListener('click', saveCustomTheme);
  importThemeBtn.addEventListener('click', importTheme);
  exportThemeBtn.addEventListener('click', exportTheme);

  await loadCustomThemes();

  try {
    const result = await chrome.storage.sync.get(['theme', 'volumeStep', 'scrollEnabled']);
    const currentTheme = result.theme || 'nord';
    themeSelect.value = currentTheme;
    applyTheme(currentTheme);
    updateThemeActions();
    volumeStepInput.value = result.volumeStep || 5;
    scrollEnabledCheckbox.checked = result.scrollEnabled || false;
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('Failed to load settings', 'error');
  }

  themeSelect.addEventListener('change', () => {
    applyTheme(themeSelect.value);
    updateThemeActions();
  });
  
  async function saveSettings() {
    const volumeStep = parseInt(volumeStepInput.value);
    
    if (isNaN(volumeStep) || volumeStep < 1 || volumeStep > 50) {
      showStatus('Enter a value between 1 and 50', 'error');
      return;
    }
    
    const scrollEnabled = scrollEnabledCheckbox.checked;
    const theme = themeSelect.value;
    const settings = { theme, volumeStep, scrollEnabled, customThemes };
    
    try {
      await chrome.storage.sync.set(settings);
      
      const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
      
      const messagePromises = tabs.map(tab => 
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateSettings',
          settings: settings
        }).catch(() => null)
      );
      
      await Promise.all(messagePromises);
      
      showStatus('Settings saved!', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showStatus('Failed to save settings', 'error');
    }
  }
  
  saveBtn.addEventListener('click', saveSettings);
  
  volumeStepInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveSettings();
    }
  });
  
  customThemeNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveCustomTheme();
    }
  });
  
  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 1200);
  }
});