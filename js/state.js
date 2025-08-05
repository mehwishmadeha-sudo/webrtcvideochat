// =============================================================================
// STATE MANAGEMENT MODULE
// Centralized application state with clean getters and setters
// =============================================================================

export const AppState = {
  // Media state
  localStream: null,
  isMicEnabled: true,
  isCamEnabled: true,
  currentCamera: 'user',
  
  // UI state
  isLocalFullscreen: false,
  isRemoteFullscreen: false,
  isClutterFree: false,
  isBrowserFullscreen: false,
  isConnected: false,
  
  // Video mode state
  videoMode: 'fit', // 'fit' or 'fill'
  
  // Event handling state
  eventHandlersAttached: false,
  touchHandlers: new Map()
};

// DOM Elements Cache for Performance
export const DOM = {
  localVideo: null,
  remoteVideo: null,
  localVideoHalf: null,
  remoteVideoHalf: null,
  toggleMicBtn: null,
  toggleCamBtn: null,
  endCallBtn: null,
  fullscreenBtn: null,
  switchCameraBtn: null,
  toggleViewModeBtn: null,
  snackbar: null,
  snackbarText: null,
  snackbarAction: null,
  micIcon: null,
  camIcon: null,
  viewModeIcon: null,
  connectionDot: null,
  initialized: false,

  // Initialize DOM cache with error checking
  init() {
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        console.log('DOM not ready yet, waiting...');
        return false;
      }

      this.localVideo = document.getElementById("localVideo");
      this.remoteVideo = document.getElementById("remoteVideo");
      this.localVideoHalf = document.getElementById("localVideoHalf");
      this.remoteVideoHalf = document.getElementById("remoteVideoHalf");
      this.toggleMicBtn = document.getElementById("toggleMic");
      this.toggleCamBtn = document.getElementById("toggleCam");
      this.endCallBtn = document.getElementById("endCallBtn");
      this.fullscreenBtn = document.getElementById("fullscreenBtn");
      this.switchCameraBtn = document.getElementById("switchCamera");
      this.toggleViewModeBtn = document.getElementById("toggleViewMode");
      this.snackbar = document.getElementById("snackbar");
      this.snackbarText = document.getElementById("snackbarText");
      this.snackbarAction = document.getElementById("snackbarAction");
      this.micIcon = document.getElementById("micIcon");
      this.camIcon = document.getElementById("camIcon");
      this.viewModeIcon = document.getElementById("viewModeIcon");
      this.connectionDot = document.getElementById('connectionDot');

      // Check if critical elements exist
      const criticalElements = [
        'localVideo', 'remoteVideo', 'snackbar', 'snackbarText', 
        'toggleMicBtn', 'toggleCamBtn'
      ];
      
      const missingElements = criticalElements.filter(elementName => !this[elementName]);
      
      if (missingElements.length > 0) {
        console.error('Missing critical DOM elements:', missingElements);
        return false;
      }

      this.initialized = true;
      console.log('DOM elements successfully initialized');
      return true;
    } catch (error) {
      console.error('DOM initialization failed:', error);
      return false;
    }
  },

  // Check if DOM is ready
  isReady() {
    return this.initialized && this.snackbarText !== null;
  }
};

// State management utilities
export const StateManager = {
  // Media state
  setLocalStream(stream) {
    AppState.localStream = stream;
  },

  getLocalStream() {
    return AppState.localStream;
  },

  setMicEnabled(enabled) {
    AppState.isMicEnabled = enabled;
  },

  isMicEnabled() {
    return AppState.isMicEnabled;
  },

  setCamEnabled(enabled) {
    AppState.isCamEnabled = enabled;
  },

  isCamEnabled() {
    return AppState.isCamEnabled;
  },

  // Video mode state
  setVideoMode(mode) {
    AppState.videoMode = mode;
  },

  getVideoMode() {
    return AppState.videoMode;
  },

  toggleVideoMode() {
    AppState.videoMode = AppState.videoMode === 'fit' ? 'fill' : 'fit';
    return AppState.videoMode;
  },

  // Connection state
  setConnected(connected) {
    AppState.isConnected = connected;
  },

  isConnected() {
    return AppState.isConnected;
  },

  // Fullscreen states
  setLocalFullscreen(fullscreen) {
    AppState.isLocalFullscreen = fullscreen;
  },

  isLocalFullscreen() {
    return AppState.isLocalFullscreen;
  },

  setRemoteFullscreen(fullscreen) {
    AppState.isRemoteFullscreen = fullscreen;
  },

  isRemoteFullscreen() {
    return AppState.isRemoteFullscreen;
  },

  setClutterFree(clutterFree) {
    AppState.isClutterFree = clutterFree;
  },

  isClutterFree() {
    return AppState.isClutterFree;
  }
}; 