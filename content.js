(function() {
  'use strict';
  
  const settings = {
    theme: 'nord',
    volumeStep: 5,
    scrollEnabled: false,
    customThemes: {}
  };
  
  let isInitialized = false;
  let keydownListener = null;
  let wheelListener = null;
  let videoObserver = null;
  let currentVideo = null;

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['theme', 'volumeStep', 'scrollEnabled', 'customThemes'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Storage error:', chrome.runtime.lastError);
          resolve({ theme: 'nord', volumeStep: 5, scrollEnabled: false, customThemes: {} });
          return;
        }
        resolve({
          theme: result.theme || 'nord',
          volumeStep: result.volumeStep || 5,
          scrollEnabled: result.scrollEnabled || false,
          customThemes: result.customThemes || {}
        });
      });
    });
  }

  function getVideo() {
    return document.querySelector('video');
  }

  function waitForVideo() {
    return new Promise((resolve) => {
      const video = getVideo();
      if (video) {
        resolve(video);
        return;
      }

      const observer = new MutationObserver(() => {
        const video = getVideo();
        if (video) {
          observer.disconnect();
          resolve(video);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, 10000);
    });
  }

  function isInputField(element) {
    if (!element) return false;
    const tagName = element.tagName;
    return tagName === 'INPUT' || 
           tagName === 'TEXTAREA' || 
           element.isContentEditable;
  }

  function adjustVolume(delta) {
    const video = getVideo();
    if (!video) return;

    const newVolume = Math.max(0, Math.min(1, video.volume + delta));
    video.volume = newVolume;
    showVolumeIndicator(Math.round(newVolume * 100));
  }

  function createKeydownListener() {
    return function(e) {
      if (isInputField(document.activeElement)) {
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const video = getVideo();
        if (!video) return;

        e.preventDefault();
        e.stopPropagation();

        const delta = e.key === 'ArrowUp' ? 
          (settings.volumeStep / 100) : 
          -(settings.volumeStep / 100);
        
        adjustVolume(delta);
      }
    };
  }

  function createWheelListener() {
    return function(e) {
      if (!settings.scrollEnabled) return;

      const target = e.target;
      const isVideoTarget = target.closest('video') || 
                           target.closest('.html5-video-player') || 
                           target.closest('#player');

      if (!isVideoTarget) return;

      const video = getVideo();
      if (!video) return;

      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaY < 0 ? 
        (settings.volumeStep / 100) : 
        -(settings.volumeStep / 100);
      
      adjustVolume(delta);
    };
  }

  function attachEventListeners() {
    if (keydownListener) {
      document.removeEventListener('keydown', keydownListener, true);
    }
    if (wheelListener) {
      document.removeEventListener('wheel', wheelListener, { capture: true });
    }

    keydownListener = createKeydownListener();
    wheelListener = createWheelListener();

    document.addEventListener('keydown', keydownListener, true);
    document.addEventListener('wheel', wheelListener, { passive: false, capture: true });
  }

  function observeVideoChanges() {
    if (videoObserver) {
      videoObserver.disconnect();
    }

    let lastCheck = 0;
    videoObserver = new MutationObserver(() => {
      const now = Date.now();
      if (now - lastCheck < 100) return;
      lastCheck = now;
      
      const video = getVideo();
      if (video !== currentVideo) {
        currentVideo = video;
      }
    });

    const playerContainer = document.querySelector('#movie_player') || 
                           document.querySelector('.html5-video-player') ||
                           document.body;

    videoObserver.observe(playerContainer, {
      childList: true,
      subtree: true
    });
  }

  function showVolumeIndicator(volume) {
    let indicator = document.getElementById('yt-volume-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'yt-volume-indicator';
      document.body.appendChild(indicator);
    }
    
    const theme = THEMES[settings.theme] || THEMES.nord;
    
    indicator.style.cssText = `
      position: fixed;
      top: 80px;
      right: 30px;
      background: rgba(0, 0, 0, 0.7);
      color: rgba(255, 255, 255, 0.9);
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      z-index: 9999;
      pointer-events: none;
      transition: opacity 0.3s ease;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
      letter-spacing: 0.3px;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    `;
    
    indicator.textContent = `${volume}%`;
    indicator.style.opacity = '1';
    
    if (indicator.hideTimeout) {
      clearTimeout(indicator.hideTimeout);
    }
    
    indicator.hideTimeout = setTimeout(() => {
      indicator.style.opacity = '0';
    }, 800);
  }

  async function initialize() {
    if (isInitialized) return;

    const loadedSettings = await loadSettings();
    settings.theme = loadedSettings.theme;
    settings.volumeStep = loadedSettings.volumeStep;
    settings.scrollEnabled = loadedSettings.scrollEnabled;
    settings.customThemes = loadedSettings.customThemes;

    await waitForVideo();
    
    attachEventListeners();
    observeVideoChanges();
    
    isInitialized = true;
  }

  function updateSettings(newSettings) {
    if (newSettings.theme !== undefined) {
      settings.theme = newSettings.theme;
    }
    if (newSettings.volumeStep !== undefined) {
      settings.volumeStep = newSettings.volumeStep;
    }
    if (newSettings.scrollEnabled !== undefined) {
      settings.scrollEnabled = newSettings.scrollEnabled;
    }
    if (newSettings.customThemes !== undefined) {
      settings.customThemes = newSettings.customThemes;
    }
    
    attachEventListeners();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      const newSettings = {};
      if (changes.theme) {
        newSettings.theme = changes.theme.newValue;
      }
      if (changes.volumeStep) {
        newSettings.volumeStep = changes.volumeStep.newValue;
      }
      if (changes.scrollEnabled) {
        newSettings.scrollEnabled = changes.scrollEnabled.newValue;
      }
      if (changes.customThemes) {
        newSettings.customThemes = changes.customThemes.newValue;
      }
      updateSettings(newSettings);
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!sender.id || sender.id !== chrome.runtime.id) {
      return;
    }
    
    if (request.action === 'updateSettings') {
      updateSettings(request.settings);
      sendResponse({ success: true });
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();