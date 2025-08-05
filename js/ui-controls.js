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
    // Show debug messages as snackbars for mobile users
    if (isError) {
      UI.showSnackbar(`❌ ${message}`);
    } else {
      UI.showSnackbar(`ℹ️ ${message}`);
    }
    // Still log to console for desktop development
    console.log(message);
  },

  showSuccess(message) {
    UI.showSnackbar(`✅ ${message}`);
    console.log(message);
  },

  showError(message) {
    UI.showSnackbar(`❌ ${message}`);
    console.error(message);
  },

  showWarning(message) {
    UI.showSnackbar(`⚠️ ${message}`);
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
    StateManager.setVideoMode('fit');
    this.applyToAll();
    DOM.viewModeIcon.textContent = 'fit_screen';
    UI.showSnackbar('✅ Video mode system initialized');
  }
};

// =============================================================================
// UI MANAGEMENT
// =============================================================================
export const UI = {
  updateConnectionDot() {
    if (StateManager.isConnected()) {
      DOM.connectionDot.classList.add('connected');
      DOM.connectionDot.classList.remove('disconnected');
      this.showSnackbar('🔗 Connection established');
    } else {
      DOM.connectionDot.classList.add('disconnected');
      DOM.connectionDot.classList.remove('connected');
      this.showSnackbar('⚠️ Connection lost');
    }
  },

  showSnackbar(message, actionText = null, actionCallback = null) {
    DOM.snackbarText.textContent = message;
    
    if (actionText && actionCallback) {
      DOM.snackbarAction.textContent = actionText;
      DOM.snackbarAction.style.display = 'block';
      DOM.snackbarAction.onclick = () => {
        this.hideSnackbar();
        actionCallback();
      };
    } else {
      DOM.snackbarAction.style.display = 'none';
    }
    
    DOM.snackbar.classList.add('show');
    setTimeout(() => this.hideSnackbar(), 4000); // Increased time for mobile reading
  },

  hideSnackbar() {
    DOM.snackbar.classList.remove('show');
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
    
    // Force update button state
    DOM.toggleMicBtn.classList.toggle('disabled', !newState);
    DOM.micIcon.textContent = newState ? 'mic' : 'mic_off';
    
    // Force redraw on mobile
    if ('ontouchstart' in window) {
      DOM.toggleMicBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        DOM.toggleMicBtn.style.transform = '';
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
    
    // Force update button state
    DOM.toggleCamBtn.classList.toggle('disabled', !newState);
    DOM.camIcon.textContent = newState ? 'videocam' : 'videocam_off';
    
    // Force redraw on mobile
    if ('ontouchstart' in window) {
      DOM.toggleCamBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        DOM.toggleCamBtn.style.transform = '';
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

// Export DebugFeedback for use in other modules
export { DebugFeedback }; 