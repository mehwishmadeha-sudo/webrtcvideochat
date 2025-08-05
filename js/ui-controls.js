// =============================================================================
// UI CONTROLS MODULE - CLEAN AND SIMPLE
// =============================================================================

import { AppState, DOM, StateManager } from './state.js';

// =============================================================================
// VIDEO MODE MANAGEMENT
// =============================================================================
export const VideoMode = {
  apply(videoElement, mode = StateManager.getVideoMode()) {
    if (!videoElement) return;
    
    videoElement.classList.remove('fit-mode', 'fill-mode');
    
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
    if (!DOM.viewModeIcon) return;
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
    if (!DOM.connectionDot) return;

    if (StateManager.isConnected()) {
      DOM.connectionDot.classList.add('connected');
      DOM.connectionDot.classList.remove('disconnected');
    } else {
      DOM.connectionDot.classList.add('disconnected');
      DOM.connectionDot.classList.remove('connected');
    }
  },

  showSnackbar(message, actionText = null, actionCallback = null) {
    if (!DOM.snackbarText || !DOM.snackbar) return;

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
    setTimeout(() => this.hideSnackbar(), 3000);
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
// MEDIA CONTROLS - INDEPENDENT AND SIMPLE
// =============================================================================
export const MediaControls = {
  // Simple microphone toggle - works independently
  toggleMicrophone() {
    const localStream = StateManager.getLocalStream();
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;

    const newState = !StateManager.isMicEnabled();
    StateManager.setMicEnabled(newState);
    audioTrack.enabled = newState;
    
    if (DOM.toggleMicBtn) {
      DOM.toggleMicBtn.classList.toggle('disabled', !newState);
    }
    if (DOM.micIcon) {
      DOM.micIcon.textContent = newState ? 'mic' : 'mic_off';
    }
  },

  // Simple camera toggle - works independently  
  toggleCamera() {
    const localStream = StateManager.getLocalStream();
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const newState = !StateManager.isCamEnabled();
    StateManager.setCamEnabled(newState);
    videoTrack.enabled = newState;
    
    if (DOM.toggleCamBtn) {
      DOM.toggleCamBtn.classList.toggle('disabled', !newState);
    }
    if (DOM.camIcon) {
      DOM.camIcon.textContent = newState ? 'videocam' : 'videocam_off';
    }
  },

  // Simple end call - works independently
  endCall() {
    if (window.endCall) {
      window.endCall();
    }
  },

  async switchCamera() {
    const localStream = StateManager.getLocalStream();
    if (!localStream) return;
    
    try {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) videoTrack.stop();
      
      AppState.currentCamera = AppState.currentCamera === 'user' ? 'environment' : 'user';
      
      const constraints = {
        video: { 
          facingMode: AppState.currentCamera, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        },
        audio: false
      };

      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          ...constraints,
          video: { ...constraints.video, facingMode: { exact: AppState.currentCamera } }
        });
      } catch (exactError) {
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      const { peerConnection } = await import('./webrtc.js');
      const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
      
      if (sender && newVideoTrack) {
        await sender.replaceTrack(newVideoTrack);
      }
      
      if (videoTrack) {
        localStream.removeTrack(videoTrack);
      }
      localStream.addTrack(newVideoTrack);
      DOM.localVideo.srcObject = localStream;
      
      VideoMode.apply(DOM.localVideo);
      
    } catch (error) {
      UI.showSnackbar('Camera switch failed');
    }
  }
}; 