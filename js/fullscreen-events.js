// =============================================================================
// FULLSCREEN AND EVENTS MODULE
// Fullscreen management and robust event handling
// =============================================================================

import { AppState, DOM, StateManager } from './state.js';
import { VideoMode, UI, MediaControls, DebugFeedback } from './ui-controls.js';

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
    let touchStarted = false;

    const safeHandler = (event) => {
      if (isProcessing) return;
      isProcessing = true;
      
      try {
        handler();
      } catch (error) {
        console.error('Event handler error:', error);
      } finally {
        setTimeout(() => { isProcessing = false; }, 150);
      }
    };

    // Mobile-first approach with better touch handling
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      // Mobile: Use touch events with proper handling
      const handleTouchStart = (event) => {
        touchStarted = true;
        event.stopPropagation();
      };

      const handleTouchEnd = (event) => {
        if (touchStarted) {
          touchStarted = false;
          event.preventDefault();
          event.stopPropagation();
          safeHandler(event);
        }
      };

      const handleClick = (event) => {
        // Prevent click if touch was handled
        if (touchStarted) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        safeHandler(event);
      };

      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchend', handleTouchEnd, { passive: false });
      element.addEventListener('click', handleClick, { passive: false });

      // Store all handlers for cleanup
      AppState.touchHandlers.set(handlerId, { 
        element, 
        handlers: { handleTouchStart, handleTouchEnd, handleClick }
      });
    } else {
      // Desktop: Use pointer events or click
      if ('PointerEvent' in window) {
        const handlePointer = (event) => {
          if (event.pointerType === 'touch') return; // Let touch events handle this
          event.preventDefault();
          event.stopPropagation();
          safeHandler(event);
        };
        element.addEventListener('pointerup', handlePointer, { passive: false });
        AppState.touchHandlers.set(handlerId, { element, handlers: { handlePointer } });
      } else {
        const handleClick = (event) => {
          event.preventDefault();
          event.stopPropagation();
          safeHandler(event);
        };
        element.addEventListener('click', handleClick, { passive: false });
        AppState.touchHandlers.set(handlerId, { element, handlers: { handleClick } });
      }
    }

    return handlerId;
  },

  removeEventListener(handlerId) {
    const handlerInfo = AppState.touchHandlers.get(handlerId);
    if (handlerInfo) {
      const { element, handlers } = handlerInfo;
      
      // Remove all stored handlers
      Object.entries(handlers).forEach(([eventType, handler]) => {
        if (eventType === 'handleTouchStart') {
          element.removeEventListener('touchstart', handler);
        } else if (eventType === 'handleTouchEnd') {
          element.removeEventListener('touchend', handler);
        } else if (eventType === 'handlePointer') {
          element.removeEventListener('pointerup', handler);
        } else if (eventType === 'handleClick') {
          element.removeEventListener('click', handler);
        }
      });
      
      AppState.touchHandlers.delete(handlerId);
    }
  },

  attachAllEventListeners() {
    if (AppState.eventHandlersAttached) return;

    // Add CSS to prevent button interference on mobile
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      const style = document.createElement('style');
      style.textContent = `
        .control-btn {
          -webkit-tap-highlight-color: transparent !important;
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          touch-action: manipulation !important;
          pointer-events: auto !important;
        }
        .control-btn * {
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(style);
      DebugFeedback.showDebug('Mobile touch optimization applied');
    }

    // Control buttons with specific mobile handling
    this.attachEventListener(DOM.toggleMicBtn, () => {
      DebugFeedback.showDebug('🎤 Mic button triggered');
      MediaControls.toggleMicrophone();
    });
    
    this.attachEventListener(DOM.toggleCamBtn, () => {
      DebugFeedback.showDebug('📹 Camera button triggered');
      MediaControls.toggleCamera();
    });
    
    this.attachEventListener(DOM.switchCameraBtn, () => {
      DebugFeedback.showDebug('🔄 Switch camera triggered');
      MediaControls.switchCamera();
    });
    
    this.attachEventListener(DOM.toggleViewModeBtn, () => {
      DebugFeedback.showDebug('📺 View mode toggle triggered');
      VideoMode.toggle();
    });
    
    this.attachEventListener(DOM.fullscreenBtn, () => {
      DebugFeedback.showDebug('🖥️ Fullscreen toggle triggered');
      FullscreenManager.toggleClutterFree();
    });
    
    this.attachEventListener(DOM.endCallBtn, () => {
      UI.showSnackbar('📞 Ending call...');
      window.endCall?.();
    });
    
    // Video elements
    this.attachEventListener(DOM.localVideoHalf, () => {
      DebugFeedback.showDebug('📱 Local video fullscreen toggled');
      FullscreenManager.toggleLocalFullscreen();
    });
    
    this.attachEventListener(DOM.remoteVideoHalf, () => {
      DebugFeedback.showDebug('📱 Remote video fullscreen toggled');
      FullscreenManager.toggleRemoteFullscreen();
    });
    
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
        DebugFeedback.showDebug('⏪ Revert button triggered');
        FullscreenManager.toggleClutterFree();
      }
    });

    // Prevent touch zoom on buttons only
    document.addEventListener('touchstart', (event) => {
      if (event.target.closest('.control-btn')) {
        if (event.touches.length > 1) {
          event.preventDefault();
        }
      }
    }, { passive: false });

    AppState.eventHandlersAttached = true;
    DebugFeedback.showSuccess('Event listeners attached successfully');
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