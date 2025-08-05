// =============================================================================
// UI CONTROLS MODULE
// User interface updates, video modes, and media controls
// =============================================================================

import { AppState, DOM, StateManager } from './state.js';

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
      UI.showSnackbar('Fit mode: Full video with letterboxing');
    } else {
      DOM.viewModeIcon.textContent = 'crop_free';
      UI.showSnackbar('Fill mode: Video cropped to fill screen');
    }
  },

  initialize() {
    StateManager.setVideoMode('fit');
    this.applyToAll();
    DOM.viewModeIcon.textContent = 'fit_screen';
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
    } else {
      DOM.connectionDot.classList.add('disconnected');
      DOM.connectionDot.classList.remove('connected');
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
    setTimeout(() => this.hideSnackbar(), 3000);
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
    const localStream = StateManager.getLocalStream();
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    const newState = !StateManager.isMicEnabled();
    StateManager.setMicEnabled(newState);
    audioTrack.enabled = newState;
    
    DOM.toggleMicBtn.classList.toggle('disabled', !newState);
    DOM.micIcon.textContent = newState ? 'mic' : 'mic_off';
  },

  toggleCamera() {
    const localStream = StateManager.getLocalStream();
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const newState = !StateManager.isCamEnabled();
    StateManager.setCamEnabled(newState);
    videoTrack.enabled = newState;
    
    DOM.toggleCamBtn.classList.toggle('disabled', !newState);
    DOM.camIcon.textContent = newState ? 'videocam' : 'videocam_off';
  },

  async switchCamera() {
    const localStream = StateManager.getLocalStream();
    if (!localStream) return;
    
    try {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) videoTrack.stop();
      
      AppState.currentCamera = AppState.currentCamera === 'user' ? 'environment' : 'user';
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: AppState.currentCamera, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        },
        audio: false
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      // Update WebRTC connection (this will be handled by the main app)
      window.updateVideoTrack?.(newVideoTrack);
      
      localStream.removeTrack(videoTrack);
      localStream.addTrack(newVideoTrack);
      DOM.localVideo.srcObject = localStream;
      
      // Maintain video mode after camera switch
      VideoMode.apply(DOM.localVideo);
      
    } catch (error) {
      console.error('Camera switch failed:', error);
      UI.showSnackbar('Camera switch failed');
    }
  }
}; 