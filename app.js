
import { DOM } from './js/state.js';
import { VideoMode, UI } from './js/ui-controls.js';
import { EventManager } from './js/fullscreen-events.js';
import { WelcomeController } from './js/welcome-controller.js';

// =============================================================================
// MAIN APPLICATION - CLEAN AND SIMPLE
// =============================================================================



// =============================================================================
// MAIN APPLICATION CONTROLLER
// =============================================================================
const App = {
  async initialize() {
    try {
      const domReady = DOM.init();
      if (!domReady) {
        setTimeout(() => this.initialize(), 100);
        return;
      }

      VideoMode.initialize();
      EventManager.attachAllEventListeners();
      
      // Initialize welcome controller instead of WebRTC directly
      WelcomeController.init();
      
    } catch (error) {
      if (DOM.isReady()) {
        UI.showSnackbar('App initialization failed', 'Retry', () => this.initialize());
      } else {
        setTimeout(() => this.initialize(), 500);
      }
    }
  }
};

// =============================================================================
// APPLICATION STARTUP
// =============================================================================
function startApp() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.initialize);
  } else {
    App.initialize();
  }
}

startApp();
