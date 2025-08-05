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
      // In clutter-free mode, don't use the fullscreen class that might interfere
      if (StateManager.isClutterFree()) {
        // Create a custom fullscreen overlay for clutter-free mode
        this.createVideoOverlay(DOM.localVideo, 'local');
      } else {
        DOM.localVideoHalf.classList.add('video-half--fullscreen');
      }
      
      VideoMode.apply(DOM.localVideo); // Ensure mode is applied
      
      if (StateManager.isRemoteFullscreen()) {
        this.exitRemoteFullscreen();
      }
    } else {
      if (StateManager.isClutterFree()) {
        this.removeVideoOverlay('local');
      } else {
        DOM.localVideoHalf.classList.remove('video-half--fullscreen');
      }
    }
  },

  toggleRemoteFullscreen() {
    const newState = !StateManager.isRemoteFullscreen();
    StateManager.setRemoteFullscreen(newState);
    
    if (newState) {
      // In clutter-free mode, don't use the fullscreen class that might interfere
      if (StateManager.isClutterFree()) {
        // Create a custom fullscreen overlay for clutter-free mode
        this.createVideoOverlay(DOM.remoteVideo, 'remote');
      } else {
        DOM.remoteVideoHalf.classList.add('video-half--fullscreen');
      }
      
      VideoMode.apply(DOM.remoteVideo); // Ensure mode is applied
      
      if (StateManager.isLocalFullscreen()) {
        this.exitLocalFullscreen();
      }
    } else {
      if (StateManager.isClutterFree()) {
        this.removeVideoOverlay('remote');
      } else {
        DOM.remoteVideoHalf.classList.remove('video-half--fullscreen');
      }
    }
  },

  createVideoOverlay(videoElement, type) {
    // Remove any existing overlay first
    this.removeVideoOverlay(type);
    
    const overlay = document.createElement('div');
    overlay.id = `${type}-video-overlay`;
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: #000 !important;
      z-index: 1500 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    `;
    
    // Clone the video element
    const videoClone = videoElement.cloneNode(true);
    videoClone.style.cssText = `
      width: 100% !important;
      height: 100% !important;
      object-fit: ${StateManager.getVideoMode() === 'fit' ? 'contain' : 'cover'} !important;
    `;
    
    // Copy the stream from original to clone
    videoClone.srcObject = videoElement.srcObject;
    
    overlay.appendChild(videoClone);
    document.body.appendChild(overlay);
    
    // Add click handler to exit fullscreen
    overlay.addEventListener('click', () => {
      if (type === 'local') {
        this.toggleLocalFullscreen();
      } else {
        this.toggleRemoteFullscreen();
      }
    });
  },

  removeVideoOverlay(type) {
    const overlay = document.getElementById(`${type}-video-overlay`);
    if (overlay) {
      overlay.remove();
    }
  },

  exitLocalFullscreen() {
    StateManager.setLocalFullscreen(false);
    if (StateManager.isClutterFree()) {
      this.removeVideoOverlay('local');
    } else {
      DOM.localVideoHalf.classList.remove('video-half--fullscreen');
    }
  },

  exitRemoteFullscreen() {
    StateManager.setRemoteFullscreen(false);
    if (StateManager.isClutterFree()) {
      this.removeVideoOverlay('remote');
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
      
      // Reset video fullscreens properly in clutter-free mode
      if (StateManager.isLocalFullscreen()) {
        this.exitLocalFullscreen();
      }
      if (StateManager.isRemoteFullscreen()) {
        this.exitRemoteFullscreen();
      }
      
      // Clean up any overlays
      this.removeVideoOverlay('local');
      this.removeVideoOverlay('remote');
      
      fullscreenIcon.textContent = 'fullscreen';
    }
  }
};

// =============================================================================
// EVENT MANAGEMENT
// =============================================================================
export const EventManager = {
  attachAllEventListeners() {
    if (AppState.eventHandlersAttached) return;

    // Simple direct event listeners with proper context binding
    if (DOM.toggleMicBtn) {
      DOM.toggleMicBtn.addEventListener('click', () => MediaControls.toggleMicrophone());
    }
    
    if (DOM.toggleCamBtn) {
      DOM.toggleCamBtn.addEventListener('click', () => MediaControls.toggleCamera());
    }
    
    if (DOM.endCallBtn) {
      DOM.endCallBtn.addEventListener('click', () => MediaControls.endCall());
    }
    
    if (DOM.switchCameraBtn) {
      DOM.switchCameraBtn.addEventListener('click', () => MediaControls.switchCamera());
    }
    
    if (DOM.toggleViewModeBtn) {
      DOM.toggleViewModeBtn.addEventListener('click', () => VideoMode.toggle());
    }
    
    if (DOM.fullscreenBtn) {
      DOM.fullscreenBtn.addEventListener('click', () => FullscreenManager.toggleClutterFree());
    }
    
    if (DOM.localVideoHalf) {
      DOM.localVideoHalf.addEventListener('click', () => FullscreenManager.toggleLocalFullscreen());
    }
    
    if (DOM.remoteVideoHalf) {
      DOM.remoteVideoHalf.addEventListener('click', () => FullscreenManager.toggleRemoteFullscreen());
    }
    
    if (DOM.snackbarAction) {
      DOM.snackbarAction.addEventListener('click', () => UI.hideSnackbar());
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => this.handleKeyboardShortcuts(event));
    
    // Fullscreen change events
    document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());
    
    // Orientation change
    window.addEventListener('orientationchange', () => this.handleOrientationChange());
    
    // Revert button
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