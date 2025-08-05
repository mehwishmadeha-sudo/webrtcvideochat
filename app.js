
import { DOM } from './js/state.js';
import { VideoMode, UI, DebugFeedback } from './js/ui-controls.js';
import { EventManager } from './js/fullscreen-events.js';
import { WebRTC } from './js/webrtc.js';

// =============================================================================
// MAIN APPLICATION
// Clean entry point that orchestrates all modules
// =============================================================================

// =============================================================================
// MAIN APPLICATION CONTROLLER
// =============================================================================
const App = {
  async initialize() {
    try {
      UI.showSnackbar('🚀 Initializing Video Call App...');
      
      // Initialize DOM cache
      DOM.init();
      DebugFeedback.showDebug('DOM elements cached');
      
      // Initialize video mode system
      VideoMode.initialize();
      
      // Attach all event listeners
      EventManager.attachAllEventListeners();
      
      // Initialize media and WebRTC
      await WebRTC.initializeMedia();
      
      DebugFeedback.showSuccess('App initialized successfully - ready for video call!');
    } catch (error) {
      DebugFeedback.showError(`App initialization failed: ${error.message}`);
      UI.showSnackbar('❌ App initialization failed', 'Retry', () => this.initialize());
    }
  }
};

// =============================================================================
// APPLICATION STARTUP
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  App.initialize();
});

// For immediate execution if DOM is already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.initialize);
} else {
  App.initialize();
}
