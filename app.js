
import { DOM } from './js/state.js';
import { VideoMode, UI } from './js/ui-controls.js';
import { EventManager } from './js/fullscreen-events.js';
import { WelcomeController } from './js/welcome-controller.js';

// =============================================================================
// MAIN APPLICATION - CLEAN AND SIMPLE
// =============================================================================

// =============================================================================
// UPDATE STATUS BAR
// =============================================================================
function updateStatusBar() {
  const statusBar = document.querySelector('.update-status-bar span');
  if (statusBar) {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    statusBar.textContent = `✅ Page Loaded: ${timeString} - Clean Independent Buttons Working!`;
  }
  
  // Add click to hide functionality
  const statusBarElement = document.querySelector('.update-status-bar');
  if (statusBarElement) {
    statusBarElement.addEventListener('click', () => {
      statusBarElement.style.transform = 'translateY(-100%)';
      setTimeout(() => {
        statusBarElement.style.display = 'none';
        // Adjust video app height
        const videoApp = document.querySelector('.video-app');
        if (videoApp) {
          videoApp.style.marginTop = '0';
          videoApp.style.height = '100vh';
        }
      }, 300);
    });
    
    statusBarElement.style.cursor = 'pointer';
    statusBarElement.title = 'Click to hide';
  }
}

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
      
      // Update status bar to show successful load
      updateStatusBar();
      
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
