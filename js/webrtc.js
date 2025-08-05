// =============================================================================
// WEBRTC MODULE - NEW CONNECTION LOGIC
// WebRTC connection management with room-based signaling
// =============================================================================

import { db, ref, onValue, set, remove, onDisconnect } from '../firebase-config.js';
import { DOM, StateManager } from './state.js';
import { VideoMode, UI } from './ui-controls.js';

// =============================================================================
// GLOBAL STATE
// =============================================================================
let currentRoomKey = null;
let offerListener = null;
let answerListener = null;
let disconnectCleanup = null;

// =============================================================================
// FIREBASE REFERENCES
// =============================================================================
function getRoomRefs(roomKey) {
  return {
    offer: ref(db, `rooms/${roomKey}/offer`),
    answer: ref(db, `rooms/${roomKey}/answer`)
  };
}

// =============================================================================
// WEBRTC SETUP
// =============================================================================
export const peerConnection = new RTCPeerConnection({ 
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }] 
});

// =============================================================================
// ROOM KEY GENERATION
// =============================================================================
export function generateRoomKey(sharedSecret, sharedMemory) {
  // Create room key as: sharedSecret-sharedMemory
  return `${sharedSecret.trim()}-${sharedMemory.trim()}`;
}

export function generateShareableLink(roomKey) {
  const baseUrl = window.location.origin + window.location.pathname;
  const encodedRoomKey = encodeURIComponent(roomKey);
  return `${baseUrl}?room=${encodedRoomKey}`;
}

// =============================================================================
// WEBRTC CORE FUNCTIONS
// =============================================================================
export const WebRTC = {
  async initializeMedia() {
    try {
      const constraints = {
        video: { 
          facingMode: 'user', 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        },
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        }
      };

      const localStream = await navigator.mediaDevices.getUserMedia(constraints);
      StateManager.setLocalStream(localStream);
      DOM.localVideo.srcObject = localStream;
      
      VideoMode.apply(DOM.localVideo);
      
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
      
    } catch (error) {
      UI.showSnackbar('Camera/microphone access failed', 'Retry', () => this.initializeMedia());
      throw error;
    }
  },

  async startConnection(roomKey) {
    currentRoomKey = roomKey;
    const roomRefs = getRoomRefs(roomKey);
    
    // Clean up any existing listeners
    this.cleanup();
    
    // Read current state
    const [offerSnapshot, answerSnapshot] = await Promise.all([
      new Promise(resolve => onValue(roomRefs.offer, resolve, { onlyOnce: true })),
      new Promise(resolve => onValue(roomRefs.answer, resolve, { onlyOnce: true }))
    ]);
    
    const offer = offerSnapshot.val();
    const answer = answerSnapshot.val();
    
    if (offer == null && answer == null) {
      // SCENARIO 1: Fresh start
      await this.scenario1_FreshStart(roomRefs);
    } else if (offer != null && answer == null) {
      // SCENARIO 2: Second peer joins
      await this.scenario2_SecondPeerJoins(roomRefs, offer);
    } else if (offer != null && answer != null) {
      // SCENARIO 3: Invalid/stale state
      await this.scenario3_CleanupAndRestart(roomRefs);
    }
  },

  async scenario1_FreshStart(roomRefs) {
    // Create offer
    const offer = await this.createOffer();
    await set(roomRefs.offer, { sdp: offer.sdp, type: offer.type });
    
    // Set up disconnect cleanup
    disconnectCleanup = onDisconnect(roomRefs.offer);
    await disconnectCleanup.remove();
    
    // Listen for answer
    answerListener = onValue(roomRefs.answer, async (snapshot) => {
      const answerData = snapshot.val();
      if (answerData) {
        try {
          await this.connectToPeer(answerData);
          // On success: remove offer and answer, then listen for reconnects
          await Promise.all([
            remove(roomRefs.offer),
            remove(roomRefs.answer)
          ]);
          this.handleReconnect(roomRefs);
        } catch (error) {
          UI.showSnackbar('Connection failed', 'Retry', () => this.startConnection(currentRoomKey));
        }
      }
    });
  },

  async scenario2_SecondPeerJoins(roomRefs, offer) {
    // Create answer
    const answer = await this.createAnswer(offer);
    await set(roomRefs.answer, { sdp: answer.sdp, type: answer.type });
    
    try {
      await this.connectToPeer(offer);
      // On success: listen for reconnects
      this.handleReconnect(roomRefs);
    } catch (error) {
      UI.showSnackbar('Connection failed', 'Retry', () => this.startConnection(currentRoomKey));
    }
  },

  async scenario3_CleanupAndRestart(roomRefs) {
    // Remove stale data
    await Promise.all([
      remove(roomRefs.offer),
      remove(roomRefs.answer)
    ]);
    
    // Restart from scenario 1
    await this.scenario1_FreshStart(roomRefs);
  },

  handleReconnect(roomRefs) {
    // Clean up existing listeners
    if (offerListener) offerListener();
    if (answerListener) answerListener();
    
    // Listen for new offers (reconnection attempts)
    offerListener = onValue(roomRefs.offer, async (snapshot) => {
      const offerData = snapshot.val();
      if (offerData) {
        try {
          // Create answer for the new offer
          const answer = await this.createAnswer(offerData);
          await set(roomRefs.answer, { sdp: answer.sdp, type: answer.type });
          
          await this.connectToPeer(offerData);
          
          // On success: remove offer and answer, then listen again
          await Promise.all([
            remove(roomRefs.offer),
            remove(roomRefs.answer)
          ]);
          
          // Recursive reconnect handling
          this.handleReconnect(roomRefs);
        } catch (error) {
          UI.showSnackbar('Reconnection failed', 'Retry', () => this.startConnection(currentRoomKey));
        }
      }
    });
  },

  async createOffer() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // Wait for ICE gathering to complete
    if (peerConnection.iceGatheringState !== 'complete') {
      await new Promise(resolve => {
        peerConnection.addEventListener('icegatheringstatechange', () => {
          if (peerConnection.iceGatheringState === 'complete') {
            resolve();
          }
        });
      });
    }
    
    return peerConnection.localDescription;
  },

  async createAnswer(offer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    // Wait for ICE gathering to complete
    if (peerConnection.iceGatheringState !== 'complete') {
      await new Promise(resolve => {
        peerConnection.addEventListener('icegatheringstatechange', () => {
          if (peerConnection.iceGatheringState === 'complete') {
            resolve();
          }
        });
      });
    }
    
    return peerConnection.localDescription;
  },

  async connectToPeer(sessionDescription) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sessionDescription));
    
    // Wait for connection to be established
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);
      
      const checkConnection = () => {
        if (peerConnection.connectionState === 'connected') {
          clearTimeout(timeout);
          resolve();
        } else if (peerConnection.connectionState === 'failed') {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        }
      };
      
      peerConnection.addEventListener('connectionstatechange', checkConnection);
      checkConnection(); // Check immediately in case already connected
    });
  },

  async updateVideoTrack(newVideoTrack) {
    const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) {
      await sender.replaceTrack(newVideoTrack);
    }
  },

  cleanup() {
    // Clean up listeners
    if (offerListener) {
      offerListener();
      offerListener = null;
    }
    if (answerListener) {
      answerListener();
      answerListener = null;
    }
    if (disconnectCleanup) {
      disconnectCleanup.cancel();
      disconnectCleanup = null;
    }
  },

  endCall() {
    this.cleanup();
    
    if (currentRoomKey) {
      const roomRefs = getRoomRefs(currentRoomKey);
      remove(roomRefs.offer);
      remove(roomRefs.answer);
    }
    
    peerConnection.close();
    const localStream = StateManager.getLocalStream();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Clear the room key from URL and return to welcome screen
    window.history.pushState({}, '', window.location.pathname);
    this.returnToWelcomeScreen();
  },

  returnToWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcomeScreen');
    const videoApp = document.getElementById('videoApp');
    
    if (welcomeScreen && videoApp) {
      videoApp.style.display = 'none';
      welcomeScreen.style.display = 'flex';
      
      // Clear form inputs
      const sharedSecretInput = document.getElementById('sharedSecret');
      const sharedMemoryInput = document.getElementById('sharedMemory');
      
      if (sharedSecretInput) sharedSecretInput.value = '';
      if (sharedMemoryInput) sharedMemoryInput.value = '';
      
      // Hide link section
      const linkSection = document.getElementById('linkSection');
      if (linkSection) linkSection.style.display = 'none';
      
      // Trigger input events to update UI state
      if (sharedSecretInput) sharedSecretInput.dispatchEvent(new Event('input'));
      if (sharedMemoryInput) sharedMemoryInput.dispatchEvent(new Event('input'));
    }
    
    // Reset global state
    currentRoomKey = null;
  }
};

// =============================================================================
// WEBRTC EVENT HANDLERS
// =============================================================================
peerConnection.ontrack = (event) => {
  DOM.remoteVideo.srcObject = event.streams[0];
  VideoMode.apply(DOM.remoteVideo);
};

peerConnection.onconnectionstatechange = () => {
  const state = peerConnection.connectionState;
  StateManager.setConnected(state === 'connected');
  UI.updateConnectionDot();
};

peerConnection.onicecandidate = (event) => {
  // ICE candidates are automatically included in the SDP after gathering completes
};

peerConnection.onicegatheringstatechange = () => {
  // Handle ICE gathering state changes if needed
};

// Make functions available globally for module communication
window.updateVideoTrack = WebRTC.updateVideoTrack.bind(WebRTC);
window.endCall = WebRTC.endCall.bind(WebRTC); 