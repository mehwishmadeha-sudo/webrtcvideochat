// =============================================================================
// WELCOME CONTROLLER
// Handles welcome screen logic, URL parameters, and room management
// =============================================================================

import { generateRoomKey, generateShareableLink, WebRTC } from './webrtc.js';
import { UI } from './ui-controls.js';

// =============================================================================
// WELCOME SCREEN CONTROLLER
// =============================================================================
export const WelcomeController = {
  init() {
    // Check for URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    
    if (roomParam) {
      // Skip welcome screen and go directly to video call
      this.skipToVideoCall(decodeURIComponent(roomParam));
      return;
    }
    
    // Show welcome screen and set up event listeners
    this.showWelcomeScreen();
    this.setupEventListeners();
  },

  showWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const videoApp = document.getElementById('videoApp');
    
    if (welcomeScreen && videoApp) {
      welcomeScreen.style.display = 'flex';
      videoApp.style.display = 'none';
    }
  },

  hideWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const videoApp = document.getElementById('videoApp');
    
    if (welcomeScreen && videoApp) {
      welcomeScreen.style.display = 'none';
      videoApp.style.display = 'block';
      videoApp.style.marginTop = '0';
      videoApp.style.height = '100vh';
    }
  },

  setupEventListeners() {
    const welcomeForm = document.getElementById('welcomeForm');
    const sharedSecretInput = document.getElementById('sharedSecret');
    const sharedMemoryInput = document.getElementById('sharedMemory');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    
    if (welcomeForm) {
      welcomeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }
    
    // Real-time link generation
    if (sharedSecretInput && sharedMemoryInput) {
      const updateLink = () => {
        const secret = sharedSecretInput.value.trim();
        const memory = sharedMemoryInput.value.trim();
        
        if (secret && memory) {
          const roomKey = generateRoomKey(secret, memory);
          const shareableLink = generateShareableLink(roomKey);
          this.showShareableLink(shareableLink);
        } else {
          this.hideShareableLink();
        }
      };
      
      sharedSecretInput.addEventListener('input', updateLink);
      sharedMemoryInput.addEventListener('input', updateLink);
    }
    
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        this.copyLinkToClipboard();
      });
    }
  },

  async handleFormSubmit() {
    const sharedSecret = document.getElementById('sharedSecret').value.trim();
    const sharedMemory = document.getElementById('sharedMemory').value.trim();
    const enterRoomBtn = document.getElementById('enterRoomBtn');
    
    if (!sharedSecret || !sharedMemory) {
      UI.showSnackbar('Please fill in both fields');
      return;
    }
    
    // Validate inputs (only allow alphanumeric and common punctuation)
    const validPattern = /^[a-zA-Z0-9\s\-_\.]+$/;
    if (!validPattern.test(sharedSecret) || !validPattern.test(sharedMemory)) {
      UI.showSnackbar('Only letters, numbers, spaces, hyphens, underscores, and dots are allowed');
      return;
    }
    
    try {
      // Disable button and show loading state
      if (enterRoomBtn) {
        enterRoomBtn.disabled = true;
        enterRoomBtn.classList.add('loading');
      }
      
      const roomKey = generateRoomKey(sharedSecret, sharedMemory);
      
      // Initialize media first
      await WebRTC.initializeMedia();
      
      // Hide welcome screen and show video app
      this.hideWelcomeScreen();
      
      // Start WebRTC connection
      await WebRTC.startConnection(roomKey);
      
    } catch (error) {
      // Re-enable button and remove loading state
      if (enterRoomBtn) {
        enterRoomBtn.disabled = false;
        enterRoomBtn.classList.remove('loading');
      }
      
      UI.showSnackbar('Failed to start video call', 'Retry', () => this.handleFormSubmit());
    }
  },

  async skipToVideoCall(roomKey) {
    try {
      // Hide welcome screen immediately
      this.hideWelcomeScreen();
      
      // Initialize media and start connection
      await WebRTC.initializeMedia();
      await WebRTC.startConnection(roomKey);
      
    } catch (error) {
      // If direct connection fails, show welcome screen
      this.showWelcomeScreen();
      UI.showSnackbar('Failed to join room. Please try entering credentials manually.');
    }
  },

  showShareableLink(link) {
    const linkSection = document.getElementById('linkSection');
    const shareableLink = document.getElementById('shareableLink');
    
    if (linkSection && shareableLink) {
      shareableLink.textContent = link;
      linkSection.style.display = 'block';
    }
  },

  hideShareableLink() {
    const linkSection = document.getElementById('linkSection');
    
    if (linkSection) {
      linkSection.style.display = 'none';
    }
  },

  async copyLinkToClipboard() {
    const shareableLink = document.getElementById('shareableLink');
    const copyBtn = document.getElementById('copyLinkBtn');
    
    if (!shareableLink || !copyBtn) return;
    
    try {
      await navigator.clipboard.writeText(shareableLink.textContent);
      
      // Visual feedback
      const originalIcon = copyBtn.querySelector('.material-symbols-outlined');
      if (originalIcon) {
        originalIcon.textContent = 'check';
        copyBtn.style.background = 'var(--md-success)';
        
        setTimeout(() => {
          originalIcon.textContent = 'content_copy';
          copyBtn.style.background = 'var(--md-primary)';
        }, 2000);
      }
      
      UI.showSnackbar('Link copied to clipboard!');
      
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareableLink.textContent;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      UI.showSnackbar('Link copied to clipboard!');
    }
  }
}; 