// =============================================================================
// UI CONTROLS MODULE
// User interface updates, video modes, and media controls
// =============================================================================

import { AppState, DOM, StateManager } from './state.js';

// =============================================================================
// DEBUG AND FEEDBACK SYSTEM
// =============================================================================
const DebugFeedback = {
  showDebug(message, isError = false) {
    // Check if DOM is ready before showing snackbar
    if (DOM.isReady()) {
      if (isError) {
        UI.showSnackbar(`❌ ${message}`);
      } else {
        UI.showSnackbar(`ℹ️ ${message}`);
      }
    }
    // Always log to console
    console.log(message);
  },

  showSuccess(message) {
    if (DOM.isReady()) {
      UI.showSnackbar(`✅ ${message}`);
    }
    console.log(message);
  },

  showError(message) {
    if (DOM.isReady()) {
      UI.showSnackbar(`❌ ${message}`);
    }
    console.error(message);
  },

  showWarning(message) {
    if (DOM.isReady()) {
      UI.showSnackbar(`⚠️ ${message}`);
    }
    console.warn(message);
  }
};

// =============================================================================
// VIDEO MODE MANAGEMENT
// =============================================================================
export const VideoMode = {
  apply(videoElement, mode = StateManager.getVideoMode()) {
    if (!videoElement) return;
    
    // Remove all mode classes first
    videoElement.classList.remove('fit-mode', 'fill-mode');
    
    // Apply the correct mode
    if (mode === 'fit') {
      videoElement.classList.add('fit-mode');
    } else {
      videoElement.classList.add('fill-mode');
    }
  },

  applyToAll(mode = StateManager.getVideoMode()) {
    this.apply(DOM.localVideo, mode);
    this.apply(DOM.remoteVideo, mode);
  },

  toggle() {
    const newMode = StateManager.toggleVideoMode();
    this.applyToAll();
    this.updateUI();
    return newMode;
  },

  updateUI() {
    const mode = StateManager.getVideoMode();
    if (mode === 'fit') {
      DOM.viewModeIcon.textContent = 'fit_screen';
      UI.showSnackbar('📺 Fit mode: Full video with letterboxing');
    } else {
      DOM.viewModeIcon.textContent = 'crop_free';
      UI.showSnackbar('📺 Fill mode: Video cropped to fill screen');
    }
  },

  initialize() {
    if (!DOM.viewModeIcon) {
      console.warn('VideoMode initialize: viewModeIcon not available yet');
      return;
    }
    
    StateManager.setVideoMode('fit');
    this.applyToAll();
    DOM.viewModeIcon.textContent = 'fit_screen';
    
    if (DOM.isReady()) {
      UI.showSnackbar('✅ Video mode system initialized');
    } else {
      console.log('Video mode system initialized');
    }
  }
};

// =============================================================================
// UI MANAGEMENT
// =============================================================================
export const UI = {
  updateConnectionDot() {
    if (!DOM.connectionDot) {
      console.warn('Connection dot element not available');
      return;
    }

    if (StateManager.isConnected()) {
      DOM.connectionDot.classList.add('connected');
      DOM.connectionDot.classList.remove('disconnected');
      if (DOM.isReady()) {
        this.showSnackbar('🔗 Connection established');
      }
    } else {
      DOM.connectionDot.classList.add('disconnected');
      DOM.connectionDot.classList.remove('connected');
      if (DOM.isReady()) {
        this.showSnackbar('⚠️ Connection lost');
      }
    }
  },

  showSnackbar(message, actionText = null, actionCallback = null) {
    // Safety check for DOM elements
    if (!DOM.snackbarText || !DOM.snackbar) {
      console.warn('Snackbar elements not available:', message);
      return;
    }

    DOM.snackbarText.textContent = message;
    
    if (actionText && actionCallback && DOM.snackbarAction) {
      DOM.snackbarAction.textContent = actionText;
      DOM.snackbarAction.style.display = 'block';
      DOM.snackbarAction.onclick = () => {
        this.hideSnackbar();
        actionCallback();
      };
    } else if (DOM.snackbarAction) {
      DOM.snackbarAction.style.display = 'none';
    }
    
    DOM.snackbar.classList.add('show');
    setTimeout(() => this.hideSnackbar(), 4000);
  },

  hideSnackbar() {
    if (DOM.snackbar) {
      DOM.snackbar.classList.remove('show');
    }
  },

  createRevertButton() {
    let revertBtn = document.getElementById('revertBtn');
    if (revertBtn) return revertBtn;

    revertBtn = document.createElement('button');
    revertBtn.id = 'revertBtn';
    revertBtn.className = 'revert-button';
    revertBtn.innerHTML = '<span class="material-symbols-outlined">fullscreen_exit</span>';
    revertBtn.style.display = 'none';
    
    document.body.appendChild(revertBtn);
    return revertBtn;
  }
};

// =============================================================================
// MEDIA CONTROLS
// =============================================================================
export const MediaControls = {
  toggleMicrophone() {
    DebugFeedback.showDebug('🎤 Microphone toggle requested');
    const localStream = StateManager.getLocalStream();
    if (!localStream) {
      DebugFeedback.showError('No local stream available for microphone');
      return;
    }
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) {
      DebugFeedback.showError('No audio track found');
      return;
    }

    const oldState = StateManager.isMicEnabled();
    const newState = !oldState;
    
    StateManager.setMicEnabled(newState);
    audioTrack.enabled = newState;
    
    // Force update button state with safety checks
    if (DOM.toggleMicBtn) {
      DOM.toggleMicBtn.classList.toggle('disabled', !newState);
    }
    if (DOM.micIcon) {
      DOM.micIcon.textContent = newState ? 'mic' : 'mic_off';
    }
    
    // Force redraw on mobile
    if ('ontouchstart' in window && DOM.toggleMicBtn) {
      DOM.toggleMicBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        if (DOM.toggleMicBtn) {
          DOM.toggleMicBtn.style.transform = '';
        }
      }, 100);
    }

    DebugFeedback.showSuccess(`Microphone ${newState ? 'enabled' : 'disabled'}`);
  },

  toggleCamera() {
    DebugFeedback.showDebug('📹 Camera toggle requested');
    const localStream = StateManager.getLocalStream();
    if (!localStream) {
      DebugFeedback.showError('No local stream available for camera');
      return;
    }
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) {
      DebugFeedback.showError('No video track found');
      return;
    }

    const oldState = StateManager.isCamEnabled();
    const newState = !oldState;
    
    StateManager.setCamEnabled(newState);
    videoTrack.enabled = newState;
    
    // Force update button state with safety checks
    if (DOM.toggleCamBtn) {
      DOM.toggleCamBtn.classList.toggle('disabled', !newState);
    }
    if (DOM.camIcon) {
      DOM.camIcon.textContent = newState ? 'videocam' : 'videocam_off';
    }
    
    // Force redraw on mobile
    if ('ontouchstart' in window && DOM.toggleCamBtn) {
      DOM.toggleCamBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        if (DOM.toggleCamBtn) {
          DOM.toggleCamBtn.style.transform = '';
        }
      }, 100);
    }

    DebugFeedback.showSuccess(`Camera ${newState ? 'enabled' : 'disabled'}`);
  },

  async switchCamera() {
    UI.showSnackbar('📱 Switching camera...');
    const localStream = StateManager.getLocalStream();
    if (!localStream) {
      DebugFeedback.showError('No local stream available for camera switch');
      return;
    }
    
    try {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        DebugFeedback.showDebug('Current video track stopped');
      }
      
      const oldCamera = AppState.currentCamera;
      AppState.currentCamera = AppState.currentCamera === 'user' ? 'environment' : 'user';
      
      const constraints = {
        video: { 
          facingMode: AppState.currentCamera, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        },
        audio: false
      };

      // Try exact facingMode first, then fall back to ideal
      let newStream;
      try {
        UI.showSnackbar(`🔄 Requesting ${AppState.currentCamera} camera...`);
        newStream = await navigator.mediaDevices.getUserMedia({
          ...constraints,
          video: { ...constraints.video, facingMode: { exact: AppState.currentCamera } }
        });
      } catch (exactError) {
        UI.showSnackbar('⚠️ Exact camera failed, trying fallback...');
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      // Import and use WebRTC module directly
      const { peerConnection } = await import('./webrtc.js');
      const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
      
      if (sender && newVideoTrack) {
        await sender.replaceTrack(newVideoTrack);
        DebugFeedback.showDebug('WebRTC video track updated');
      }
      
      if (videoTrack) {
        localStream.removeTrack(videoTrack);
      }
      localStream.addTrack(newVideoTrack);
      DOM.localVideo.srcObject = localStream;
      
      // Maintain video mode after camera switch
      VideoMode.apply(DOM.localVideo);
      
      const cameraName = AppState.currentCamera === 'user' ? 'front' : 'rear';
      DebugFeedback.showSuccess(`Switched to ${cameraName} camera`);
      
    } catch (error) {
      DebugFeedback.showError(`Camera switch failed: ${error.message}`);
      // Revert camera setting on failure
      AppState.currentCamera = AppState.currentCamera === 'user' ? 'environment' : 'user';
      
      // Provide more specific error messages
      if (error.name === 'NotFoundError' || error.name === 'DeviceNotFoundError') {
        UI.showSnackbar('❌ Camera not available on this device');
      } else if (error.name === 'NotAllowedError') {
        UI.showSnackbar('❌ Camera permission denied');
      } else if (error.name === 'NotReadableError') {
        UI.showSnackbar('❌ Camera is being used by another application');
      } else {
        UI.showSnackbar('❌ Camera switch failed - device may not support multiple cameras');
      }
    }
  }
}; 

// Add mobile testing function
export const MobileTesting = {
  testButtons() {
    if (!('ontouchstart' in window)) {
      console.log('Not a mobile device');
      return;
    }

    const buttons = [
      { element: DOM.toggleMicBtn, name: 'Microphone' },
      { element: DOM.toggleCamBtn, name: 'Camera' },
      { element: DOM.switchCameraBtn, name: 'Switch Camera' }
    ];

    buttons.forEach(({ element, name }) => {
      if (element) {
        // Force a visible test on the button
        element.style.border = '2px solid lime';
        element.addEventListener('touchend', () => {
          element.style.background = 'lime';
          UI.showSnackbar(`✅ ${name} button is responsive!`);
          setTimeout(() => {
            element.style.background = '';
            element.style.border = '';
          }, 1000);
        }, { passive: false });
        console.log(`${name} button test handler added`);
      } else {
        console.error(`${name} button not found`);
      }
    });

    UI.showSnackbar('🧪 Mobile button test mode enabled - tap buttons to test');
  }
};

// Auto-run test on mobile
if ('ontouchstart' in window && DOM.isReady()) {
  setTimeout(() => {
    MobileTesting.testButtons();
  }, 2000);
}

// Export DebugFeedback for use in other modules
export { DebugFeedback }; 