// =============================================================================
// WELCOME CONTROLLER
// Handles welcome screen logic, URL parameters, and room management
// =============================================================================

import { generateRoomKey, generateShareableLink, WebRTC } from './webrtc.js';
import { UI } from './ui-controls.js';

// =============================================================================
// LOCALSTORAGE MANAGER
// =============================================================================
const SavedRoomsManager = {
  STORAGE_KEY: 'videoCall_savedRooms',
  
  getSavedRooms() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      return [];
    }
  },
  
  saveRoom(sharedSecret, sharedMemory) {
    const roomKey = generateRoomKey(sharedSecret, sharedMemory);
    const rooms = this.getSavedRooms();
    
    // Check if room already exists
    const existingIndex = rooms.findIndex(room => room.roomKey === roomKey);
    if (existingIndex !== -1) {
      // Update existing room's timestamp
      rooms[existingIndex].lastUsed = Date.now();
    } else {
      // Add new room
      rooms.push({
        id: Date.now().toString(),
        name: `${sharedSecret} - ${sharedMemory}`,
        sharedSecret,
        sharedMemory,
        roomKey,
        lastUsed: Date.now()
      });
    }
    
    // Sort by last used (most recent first)
    rooms.sort((a, b) => b.lastUsed - a.lastUsed);
    
    // Keep only last 10 rooms
    const trimmedRooms = rooms.slice(0, 10);
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedRooms));
      return true;
    } catch (error) {
      return false;
    }
  },
  
  deleteRoom(roomId) {
    const rooms = this.getSavedRooms();
    const filteredRooms = rooms.filter(room => room.id !== roomId);
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredRooms));
      return true;
    } catch (error) {
      return false;
    }
  }
};

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
    this.loadSavedRooms();
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
    const saveRoomBtn = document.getElementById('saveRoomBtn');
    
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
          
          // Enable save button
          if (saveRoomBtn) {
            saveRoomBtn.disabled = false;
          }
        } else {
          this.hideShareableLink();
          
          // Disable save button
          if (saveRoomBtn) {
            saveRoomBtn.disabled = true;
          }
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
    
    if (saveRoomBtn) {
      saveRoomBtn.disabled = true;
      saveRoomBtn.addEventListener('click', () => {
        this.saveCurrentRoom();
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
      
      // Update URL with room key
      const newUrl = generateShareableLink(roomKey);
      window.history.pushState({ roomKey }, '', newUrl);
      
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
      // Update URL to ensure it contains the room key
      const newUrl = generateShareableLink(roomKey);
      window.history.replaceState({ roomKey }, '', newUrl);
      
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
  },

  saveCurrentRoom() {
    const sharedSecret = document.getElementById('sharedSecret').value.trim();
    const sharedMemory = document.getElementById('sharedMemory').value.trim();
    
    if (!sharedSecret || !sharedMemory) {
      UI.showSnackbar('Please fill in both fields to save');
      return;
    }
    
    const success = SavedRoomsManager.saveRoom(sharedSecret, sharedMemory);
    if (success) {
      UI.showSnackbar('Room saved successfully!');
      this.loadSavedRooms();
    } else {
      UI.showSnackbar('Failed to save room');
    }
  },

  loadSavedRooms() {
    const savedRooms = SavedRoomsManager.getSavedRooms();
    const savedRoomsSection = document.getElementById('savedRoomsSection');
    const savedRoomsList = document.getElementById('savedRoomsList');
    
    if (!savedRoomsSection || !savedRoomsList) return;
    
    if (savedRooms.length === 0) {
      savedRoomsSection.style.display = 'none';
      return;
    }
    
    savedRoomsSection.style.display = 'block';
    savedRoomsList.innerHTML = '';
    
    savedRooms.forEach(room => {
      const roomItem = this.createSavedRoomItem(room);
      savedRoomsList.appendChild(roomItem);
    });
  },

  createSavedRoomItem(room) {
    const item = document.createElement('div');
    item.className = 'saved-room-item';
    
    item.innerHTML = `
      <div class="saved-room-info">
        <div class="saved-room-name">${room.name}</div>
        <div class="saved-room-key">${room.roomKey}</div>
      </div>
      <div class="saved-room-actions">
        <button class="saved-room-btn saved-room-btn--delete" data-room-id="${room.id}" title="Delete room">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    `;
    
    // Add click handler to join room
    const roomInfo = item.querySelector('.saved-room-info');
    roomInfo.addEventListener('click', () => {
      this.joinSavedRoom(room);
    });
    
    // Add delete handler
    const deleteBtn = item.querySelector('.saved-room-btn--delete');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteSavedRoom(room.id);
    });
    
    return item;
  },

  async joinSavedRoom(room) {
    try {
      // Fill in the form fields
      const sharedSecretInput = document.getElementById('sharedSecret');
      const sharedMemoryInput = document.getElementById('sharedMemory');
      
      if (sharedSecretInput && sharedMemoryInput) {
        sharedSecretInput.value = room.sharedSecret;
        sharedMemoryInput.value = room.sharedMemory;
        
        // Trigger input events to update link
        sharedSecretInput.dispatchEvent(new Event('input'));
        sharedMemoryInput.dispatchEvent(new Event('input'));
      }
      
      // Update the room's last used timestamp
      SavedRoomsManager.saveRoom(room.sharedSecret, room.sharedMemory);
      
      // Join the room
      await this.handleFormSubmit();
      
    } catch (error) {
      UI.showSnackbar('Failed to join saved room');
    }
  },

  deleteSavedRoom(roomId) {
    const success = SavedRoomsManager.deleteRoom(roomId);
    if (success) {
      UI.showSnackbar('Room deleted');
      this.loadSavedRooms();
    } else {
      UI.showSnackbar('Failed to delete room');
    }
  }
}; 