
import { DOM } from './js/state.js';
import { VideoMode } from './js/ui-controls.js';
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
      console.log('Initializing Video Call App...');
      
      // Initialize DOM cache
      DOM.init();
      
      // Initialize video mode system
      VideoMode.initialize();
      
      // Attach all event listeners
      EventManager.attachAllEventListeners();
      
      // Initialize media and WebRTC
      await WebRTC.initializeMedia();
      
      console.log('App initialized successfully');
    } catch (error) {
      console.error('App initialization failed:', error);
      // Use basic alert if UI module not available yet
      alert('App initialization failed. Please refresh the page.');
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
