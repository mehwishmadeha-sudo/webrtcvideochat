// =============================================================================
// WEBRTC MODULE
// WebRTC connection and signaling management
// =============================================================================

import { db, ref, onValue, set, remove } from '../firebase-config.js';
import { DOM, StateManager } from './state.js';
import { VideoMode, UI, DebugFeedback } from './ui-controls.js';

// =============================================================================
// FIREBASE REFERENCES
// =============================================================================
export const FirebaseRefs = {
  offer: ref(db, "offer"),
  answer: ref(db, "answer")
};

// =============================================================================
// WEBRTC SETUP
// =============================================================================
export const peerConnection = new RTCPeerConnection({ 
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }] 
});

// =============================================================================
// WEBRTC AND SIGNALING
// =============================================================================
export const WebRTC = {
  async initializeMedia() {
    try {
      UI.showSnackbar('🎥 Requesting camera and microphone access...');
      
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
      
      // Initialize video mode
      VideoMode.apply(DOM.localVideo);
      
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      DebugFeedback.showSuccess('Media access granted, starting call setup...');
      this.startSignaling();
      
    } catch (error) {
      DebugFeedback.showError(`Media access failed: ${error.message}`);
      
      if (error.name === 'NotAllowedError') {
        UI.showSnackbar('❌ Camera/microphone permission denied', 'Retry', () => this.initializeMedia());
      } else if (error.name === 'NotFoundError') {
        UI.showSnackbar('❌ No camera/microphone found', 'Retry', () => this.initializeMedia());
      } else {
        UI.showSnackbar('❌ Media access failed', 'Retry', () => this.initializeMedia());
      }
    }
  },

  async startSignaling() {
    UI.showSnackbar('�� Starting signaling process...');
    
    const offerSnapshot = await new Promise(resolve => {
      onValue(FirebaseRefs.offer, resolve, { onlyOnce: true });
    });
    const answerSnapshot = await new Promise(resolve => {
      onValue(FirebaseRefs.answer, resolve, { onlyOnce: true });
    });
    
    const offer = offerSnapshot.val();
    const answer = answerSnapshot.val();
    
    if (offer == null && answer == null) {
      DebugFeedback.showDebug('📡 Scenario 1: Creating new call (first peer)');
      const myOffer = await this.createOffer();
      await set(FirebaseRefs.offer, { sdp: myOffer.sdp, type: myOffer.type });
      UI.showSnackbar('📞 Waiting for someone to join...');
      
      onValue(FirebaseRefs.answer, async (snapshot) => {
        const answerData = snapshot.val();
        if (answerData) {
          UI.showSnackbar('🎉 Someone joined! Connecting...');
          await this.connectToPeer(answerData);
        }
      });
    } else if (offer != null && answer == null) {
      DebugFeedback.showDebug('📡 Scenario 2: Joining existing call (second peer)');
      UI.showSnackbar('📞 Joining call...');
      const myAnswer = await this.createAnswer(offer);
      await set(FirebaseRefs.answer, { sdp: myAnswer.sdp, type: myAnswer.type });
      UI.showSnackbar('✅ Successfully joined call');
    } else if (offer != null && answer != null) {
      DebugFeedback.showDebug('📡 Scenario 3: Cleaning up stale session');
      UI.showSnackbar('🔄 Cleaning up previous session...');
      
      await remove(FirebaseRefs.offer);
      await remove(FirebaseRefs.answer);
      
      const myOffer = await this.createOffer();
      await set(FirebaseRefs.offer, { sdp: myOffer.sdp, type: myOffer.type });
      UI.showSnackbar('📞 Waiting for someone to join...');
      
      onValue(FirebaseRefs.answer, async (snapshot) => {
        const answerData = snapshot.val();
        if (answerData) {
          UI.showSnackbar('🎉 Someone joined! Connecting...');
          await this.connectToPeer(answerData);
        }
      });
    }
  },

  async createOffer() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
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

  async connectToPeer(answer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  },

  async updateVideoTrack(newVideoTrack) {
    const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) {
      await sender.replaceTrack(newVideoTrack);
    }
  },

  endCall() {
    peerConnection.close();
    const localStream = StateManager.getLocalStream();
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    remove(FirebaseRefs.offer);
    remove(FirebaseRefs.answer);
    location.reload();
  }
};

// =============================================================================
// WEBRTC EVENT HANDLERS
// =============================================================================
peerConnection.ontrack = (event) => {
  DOM.remoteVideo.srcObject = event.streams[0];
  VideoMode.apply(DOM.remoteVideo);
  DebugFeedback.showSuccess('📺 Remote video stream received');
};

peerConnection.onconnectionstatechange = () => {
  const state = peerConnection.connectionState;
  StateManager.setConnected(state === 'connected');
  UI.updateConnectionDot();
  
  if (StateManager.isConnected()) {
    DebugFeedback.showSuccess('🎉 Video call connected successfully!');
  } else if (state === 'disconnected') {
    UI.showSnackbar('⚠️ Connection lost - attempting to reconnect...');
  } else if (state === 'failed') {
    UI.showSnackbar('❌ Connection failed - please refresh and try again');
  }
};

peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    DebugFeedback.showDebug(`🔗 ICE candidate: ${event.candidate.type}`);
  } else {
    DebugFeedback.showDebug('🔗 ICE gathering completed');
  }
};

peerConnection.onicegatheringstatechange = () => {
  const state = peerConnection.iceGatheringState;
  if (state === 'gathering') {
    UI.showSnackbar('🔗 Establishing connection...');
  } else if (state === 'complete') {
    DebugFeedback.showDebug('🔗 Connection setup complete');
  }
};

// Make functions available globally for module communication
window.updateVideoTrack = WebRTC.updateVideoTrack.bind(WebRTC);
window.endCall = WebRTC.endCall.bind(WebRTC); 