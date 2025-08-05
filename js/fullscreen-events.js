// =============================================================================
// FULLSCREEN AND EVENTS MODULE
// Fullscreen management and robust event handling
// =============================================================================

import { AppState, DOM, StateManager } from './state.js';
import { VideoMode, UI, MediaControls } from './ui-controls.js';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
export const Utils = {
  isLargeScreen() {
    return window.innerWidth >= 1024;
  },

  isCurrentlyFullscreen() {
    return !!(document.fullscreenElement || document.mozFullScreenElement || 
              document.webkitFullscreenElement || document.msFullscreenElement);
  },

  async requestFullscreen() {
    const element = document.documentElement;
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      return true;
    } catch (error) {
      console.error('Fullscreen request failed:', error);
      return false;
    }
  },

  async exitFullscreen() {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
      return true;
    } catch (error) {
      console.error('Exit fullscreen failed:', error);
      return false;
    }
  }
};

// =============================================================================
// FULLSCREEN MANAGEMENT
// =============================================================================
export const FullscreenManager = {
  toggleLocalFullscreen() {
    const newState = !StateManager.isLocalFullscreen();
    StateManager.setLocalFullscreen(newState);
    
    if (newState) {
      DOM.localVideoHalf.classList.add('video-half--fullscreen');
      VideoMode.apply(DOM.localVideo); // Ensure mode is applied
      if (StateManager.isRemoteFullscreen()) {
        DOM.remoteVideoHalf.classList.remove('video-half--fullscreen');
        StateManager.setRemoteFullscreen(false);
      }
    } else {
      DOM.localVideoHalf.classList.remove('video-half--fullscreen');
    }
  },

  toggleRemoteFullscreen() {
    const newState = !StateManager.isRemoteFullscreen();
    StateManager.setRemoteFullscreen(newState);
    
    if (newState) {
      DOM.remoteVideoHalf.classList.add('video-half--fullscreen');
      VideoMode.apply(DOM.remoteVideo); // Ensure mode is applied
      if (StateManager.isLocalFullscreen()) {
        DOM.localVideoHalf.classList.remove('video-half--fullscreen');
        StateManager.setLocalFullscreen(false);
      }
    } else {
      DOM.remoteVideoHalf.classList.remove('video-half--fullscreen');
    }
  },

  async toggleClutterFree() {
    const newState = !StateManager.isClutterFree();
    StateManager.setClutterFree(newState);
    
    const controlBar = document.querySelector('.control-bar');
    let revertBtn = document.getElementById('revertBtn');
    const videoApp = document.querySelector('.video-app');
    const fullscreenIcon = DOM.fullscreenBtn.querySelector('.material-symbols-outlined');
    
    if (newState) {
      // Enter clutter-free mode
      if (!Utils.isCurrentlyFullscreen()) {
        const success = await Utils.requestFullscreen();
        if (success) {
          AppState.isBrowserFullscreen = true;
        } else {
          UI.showSnackbar('Fullscreen not supported on this browser');
        }
      }
      
      controlBar.style.transform = 'translateY(100%)';
      controlBar.style.opacity = '0';
      
      if (!revertBtn) {
        revertBtn = UI.createRevertButton();
      }
      revertBtn.style.display = 'flex';
      
      videoApp.classList.add('clutter-free');
      fullscreenIcon.textContent = 'fullscreen_exit';
    } else {
      // Exit clutter-free mode
      if (AppState.isBrowserFullscreen && Utils.isCurrentlyFullscreen()) {
        const success = await Utils.exitFullscreen();
        if (success) {
          AppState.isBrowserFullscreen = false;
        }
      }
      
      controlBar.style.transform = 'translateY(0)';
      controlBar.style.opacity = '1';
      
      if (revertBtn) {
        revertBtn.style.display = 'none';
      }
      
      videoApp.classList.remove('clutter-free');
      
      // Reset video fullscreens
      if (StateManager.isLocalFullscreen()) {
        DOM.localVideoHalf.classList.remove('video-half--fullscreen');
        StateManager.setLocalFullscreen(false);
      }
      if (StateManager.isRemoteFullscreen()) {
        DOM.remoteVideoHalf.classList.remove('video-half--fullscreen');
        StateManager.setRemoteFullscreen(false);
      }
      
      fullscreenIcon.textContent = 'fullscreen';
    }
  }
};

// =============================================================================
// EVENT MANAGEMENT
// =============================================================================
export const EventManager = {
  attachEventListener(element, handler, options = {}) {
    if (!element || typeof handler !== 'function') return;

    const handlerId = Math.random().toString(36).substr(2, 9);
    let isProcessing = false;

    const safeHandler = (event) => {
      if (isProcessing) return;
      isProcessing = true;
      
      try {
        event.preventDefault();
        event.stopPropagation();
        handler();
      } catch (error) {
        console.error('Event handler error:', error);
      } finally {
        setTimeout(() => { isProcessing = false; }, 100);
      }
    };

    // Use modern pointer events for better reliability
    if ('PointerEvent' in window) {
      element.addEventListener('pointerup', safeHandler, { passive: false, ...options });
    } else {
      // Fallback for older browsers
      element.addEventListener('click', safeHandler, { passive: false, ...options });
      element.addEventListener('touchend', safeHandler, { passive: false, ...options });
    }

    // Store handler for cleanup
    AppState.touchHandlers.set(handlerId, { element, handler: safeHandler });
    return handlerId;
  },

  removeEventListener(handlerId) {
    const handlerInfo = AppState.touchHandlers.get(handlerId);
    if (handlerInfo) {
      const { element, handler } = handlerInfo;
      element.removeEventListener('pointerup', handler);
      element.removeEventListener('click', handler);
      element.removeEventListener('touchend', handler);
      AppState.touchHandlers.delete(handlerId);
    }
  },

  attachAllEventListeners() {
    if (AppState.eventHandlersAttached) return;

    // Control buttons
    this.attachEventListener(DOM.toggleMicBtn, () => MediaControls.toggleMicrophone());
    this.attachEventListener(DOM.toggleCamBtn, () => MediaControls.toggleCamera());
    this.attachEventListener(DOM.switchCameraBtn, () => MediaControls.switchCamera());
    this.attachEventListener(DOM.toggleViewModeBtn, () => VideoMode.toggle());
    this.attachEventListener(DOM.fullscreenBtn, () => FullscreenManager.toggleClutterFree());
    this.attachEventListener(DOM.endCallBtn, () => window.endCall?.());
    
    // Video elements
    this.attachEventListener(DOM.localVideoHalf, () => FullscreenManager.toggleLocalFullscreen());
    this.attachEventListener(DOM.remoteVideoHalf, () => FullscreenManager.toggleRemoteFullscreen());
    
    // Snackbar
    this.attachEventListener(DOM.snackbarAction, () => UI.hideSnackbar());
    
    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyboardShortcuts);
    
    // Fullscreen change events
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', this.handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', this.handleFullscreenChange);
    
    // Orientation change
    window.addEventListener('orientationchange', this.handleOrientationChange);
    
    // Revert button (created dynamically)
    document.addEventListener('click', (event) => {
      if (event.target.closest('#revertBtn')) {
        FullscreenManager.toggleClutterFree();
      }
    });

    AppState.eventHandlersAttached = true;
  },

  handleKeyboardShortcuts(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    
    switch (event.key.toLowerCase()) {
      case 'm': event.preventDefault(); MediaControls.toggleMicrophone(); break;
      case 'v': event.preventDefault(); MediaControls.toggleCamera(); break;
      case 'f': event.preventDefault(); FullscreenManager.toggleClutterFree(); break;
      case 'c': event.preventDefault(); MediaControls.switchCamera(); break;
      case 'z': event.preventDefault(); VideoMode.toggle(); break;
      case '1': event.preventDefault(); FullscreenManager.toggleLocalFullscreen(); break;
      case '2': event.preventDefault(); FullscreenManager.toggleRemoteFullscreen(); break;
      case 'escape':
        if (StateManager.isLocalFullscreen() || StateManager.isRemoteFullscreen()) {
          if (StateManager.isLocalFullscreen()) FullscreenManager.toggleLocalFullscreen();
          if (StateManager.isRemoteFullscreen()) FullscreenManager.toggleRemoteFullscreen();
        } else if (StateManager.isClutterFree()) {
          FullscreenManager.toggleClutterFree();
        }
        break;
    }
  },

  handleFullscreenChange() {
    const isInFullscreen = Utils.isCurrentlyFullscreen();
    
    if (!isInFullscreen && AppState.isBrowserFullscreen) {
      AppState.isBrowserFullscreen = false;
      if (StateManager.isClutterFree()) {
        FullscreenManager.toggleClutterFree();
      }
    }
  },

  handleOrientationChange() {
    if (StateManager.isLocalFullscreen()) {
      DOM.localVideoHalf.classList.remove('video-half--fullscreen');
      StateManager.setLocalFullscreen(false);
    }
    if (StateManager.isRemoteFullscreen()) {
      DOM.remoteVideoHalf.classList.remove('video-half--fullscreen');
      StateManager.setRemoteFullscreen(false);
    }
  }
}; 