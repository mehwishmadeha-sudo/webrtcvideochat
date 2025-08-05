
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
      console.log('🚀 Starting Video Call App initialization...');
      
      // Initialize DOM cache first and check if successful
      const domReady = DOM.init();
      if (!domReady) {
        console.error('DOM initialization failed - retrying in 100ms');
        setTimeout(() => this.initialize(), 100);
        return;
      }

      // Now we can safely use UI functions
      UI.showSnackbar('🚀 Initializing Video Call App...');
      
      // Initialize video mode system
      VideoMode.initialize();
      
      // Attach all event listeners
      EventManager.attachAllEventListeners();
      
      // Initialize media and WebRTC
      await WebRTC.initializeMedia();
      
      DebugFeedback.showSuccess('App initialized successfully - ready for video call!');
    } catch (error) {
      console.error('App initialization failed:', error);
      
      // Try to show error via snackbar if possible, otherwise use console
      if (DOM.isReady()) {
        DebugFeedback.showError(`App initialization failed: ${error.message}`);
        UI.showSnackbar('❌ App initialization failed', 'Retry', () => this.initialize());
      } else {
        console.error('Cannot show UI error - DOM not ready. Error:', error.message);
        // Retry initialization after a delay
        setTimeout(() => this.initialize(), 500);
      }
    }
  }
};

// =============================================================================
// APPLICATION STARTUP WITH PROPER DOM READY HANDLING
// =============================================================================
function startApp() {
  if (document.readyState === 'loading') {
    // DOM not ready yet, wait for it
    document.addEventListener('DOMContentLoaded', App.initialize);
  } else {
    // DOM is ready, start immediately
    App.initialize();
  }
}

// Start the application
startApp();
