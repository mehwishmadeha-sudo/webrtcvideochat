
import { db, ref, onValue, set, remove } from './firebase-config.js';

// Direct Firebase references - no rooms, no IDs
const offerRef = ref(db, "offer");
const answerRef = ref(db, "answer");

// DOM Elements
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const localVideoHalf = document.getElementById("localVideoHalf");
const remoteVideoHalf = document.getElementById("remoteVideoHalf");

// Control Elements
const toggleMicBtn = document.getElementById("toggleMic");
const toggleCamBtn = document.getElementById("toggleCam");
const endCallBtn = document.getElementById("endCallBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const switchCameraBtn = document.getElementById("switchCamera");

// Status Elements
const snackbar = document.getElementById("snackbar");
const snackbarText = document.getElementById("snackbarText");
const snackbarAction = document.getElementById("snackbarAction");

// Icons
const micIcon = document.getElementById("micIcon");
const camIcon = document.getElementById("camIcon");

// WebRTC Configuration
const peerConnection = new RTCPeerConnection({ 
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }] 
});

// State Management
let localStream;
let isMicEnabled = true;
let isCamEnabled = true;
let isLocalFullscreen = false;
let isRemoteFullscreen = false;
let currentCamera = 'user';
let isConnected = false;
let hasProcessedOffer = false;
let userRole = null; // 'caller' or 'answerer'
let isClutterFree = false; // New state for clutter-free mode
let isBrowserFullscreen = false; // Track browser fullscreen state

// Check if device is large screen (laptop/desktop)
function isLargeScreen() {
  return window.innerWidth >= 1024;
}

// Initialize Media
async function initializeMedia() {
  try {
    const constraints = {
      video: { facingMode: currentCamera, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    };

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = localStream;
    
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Small delay to ensure everything is ready
    setTimeout(startSignaling, 500);
    
  } catch (error) {
    console.error('Media error:', error);
    showSnackbar('Camera/microphone access failed', 'Retry', () => initializeMedia());
  }
}

// Start signaling process
async function startSignaling() {
  console.log('Starting signaling...');
  
  // First check what's in Firebase
  onValue(offerRef, async (snapshot) => {
    const offer = snapshot.val();
    console.log('Offer check result:', offer ? 'OFFER EXISTS' : 'NO OFFER');
    
    if (offer && !hasProcessedOffer) {
      // Offer exists, become answerer
      console.log('Found offer, becoming answerer');
      userRole = 'answerer';
      hasProcessedOffer = true;
      await handleOffer(offer);
    } else if (!offer && !hasProcessedOffer) {
      // No offer, become caller
      console.log('No offer found, becoming caller');
      userRole = 'caller';
      hasProcessedOffer = true;
      await createOffer();
    }
  }, { onlyOnce: true });

  // Listen for answer (only if we're the caller)
  onValue(answerRef, async (snapshot) => {
    const answer = snapshot.val();
    if (answer && userRole === 'caller') {
      console.log('Answer received by caller, processing...');
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Answer processed successfully by caller');
        
        // Clean up after connection
        setTimeout(async () => {
          console.log('Cleaning up Firebase data...');
          await remove(offerRef);
          await remove(answerRef);
          console.log('Firebase data cleaned');
        }, 2000);
      } catch (error) {
        console.error('Error processing answer:', error);
      }
    } else if (answer && userRole === 'answerer') {
      console.log('Answer detected by answerer (ignoring own answer)');
    }
  });
}

// Create and upload offer
async function createOffer() {
  try {
    console.log('Creating offer...');
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('Local description set:', offer.type);
    
    // Wait for ICE gathering to complete
    if (peerConnection.iceGatheringState === 'complete') {
      console.log('ICE already complete, uploading now');
      await uploadOffer();
    } else {
      console.log('Waiting for ICE gathering...');
      peerConnection.addEventListener('icegatheringstatechange', async () => {
        console.log('ICE state changed to:', peerConnection.iceGatheringState);
        if (peerConnection.iceGatheringState === 'complete') {
          await uploadOffer();
        }
      });
    }
  } catch (error) {
    console.error('Create offer error:', error);
  }
}

// Upload offer to Firebase
async function uploadOffer() {
  try {
    const offerToUpload = {
      type: peerConnection.localDescription.type,
      sdp: peerConnection.localDescription.sdp
    };
    
    console.log('Uploading offer...');
    
    await set(offerRef, offerToUpload);
    console.log('Offer uploaded successfully');
    
  } catch (error) {
    console.error('Upload offer error:', error);
  }
}

// Handle offer and create answer
async function handleOffer(offer) {
  try {
    console.log('Processing incoming offer...');
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    console.log('Remote description set');
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    console.log('Answer created:', answer.type);
    
    // Wait for ICE gathering to complete
    if (peerConnection.iceGatheringState === 'complete') {
      console.log('ICE already complete, uploading answer now');
      await uploadAnswer();
    } else {
      console.log('Waiting for ICE gathering for answer...');
      peerConnection.addEventListener('icegatheringstatechange', async () => {
        console.log('ICE state changed to:', peerConnection.iceGatheringState);
        if (peerConnection.iceGatheringState === 'complete') {
          await uploadAnswer();
        }
      });
    }
  } catch (error) {
    console.error('Handle offer error:', error);
  }
}

// Upload answer to Firebase
async function uploadAnswer() {
  try {
    const answerToUpload = {
      type: peerConnection.localDescription.type,
      sdp: peerConnection.localDescription.sdp
    };
    
    console.log('Uploading answer...');
    
    await set(answerRef, answerToUpload);
    console.log('Answer uploaded successfully');
    
  } catch (error) {
    console.error('Upload answer error:', error);
  }
}

// WebRTC Events
peerConnection.ontrack = (event) => {
  remoteVideo.srcObject = event.streams[0];
  console.log('Remote stream received');
};

peerConnection.onconnectionstatechange = () => {
  const state = peerConnection.connectionState;
  console.log('Connection state:', state);
  isConnected = state === 'connected';
  updateConnectionDot();
  if (isConnected) {
    console.log('WebRTC connection established!');
  }
};

peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    console.log('ICE candidate:', event.candidate.type);
  } else {
    console.log('ICE gathering finished');
  }
};

// Update connection dot
function updateConnectionDot() {
  const dot = document.getElementById('connectionDot');
  if (isConnected) {
    dot.classList.add('connected');
    dot.classList.remove('disconnected');
  } else {
    dot.classList.add('disconnected');
    dot.classList.remove('connected');
  }
}

// Toggle clutter-free mode
async function toggleClutterFree() {
  isClutterFree = !isClutterFree;
  
  const controlBar = document.querySelector('.control-bar');
  let revertBtn = document.getElementById('revertBtn');
  const videoApp = document.querySelector('.video-app');
  const fullscreenIcon = fullscreenBtn.querySelector('.material-symbols-outlined');
  
  if (isClutterFree) {
    // On large screens, also enter browser fullscreen
    if (isLargeScreen() && !document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        isBrowserFullscreen = true;
        console.log('Entered browser fullscreen');
      } catch (error) {
        console.log('Browser fullscreen not supported or denied');
      }
    }
    
    // Hide control bar
    controlBar.style.transform = 'translateY(100%)';
    controlBar.style.opacity = '0';
    
    // Create and show revert button
    if (!revertBtn) {
      createRevertButton();
      revertBtn = document.getElementById('revertBtn');
    }
    revertBtn.style.display = 'flex';
    
    // Expand video halves to full screen
    videoApp.classList.add('clutter-free');
    
    // Update fullscreen icon to collapse icon
    fullscreenIcon.textContent = 'fullscreen_exit';
    
    console.log('Clutter-free mode enabled');
  } else {
    // Exit browser fullscreen if we entered it
    if (isBrowserFullscreen && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
        isBrowserFullscreen = false;
        console.log('Exited browser fullscreen');
      } catch (error) {
        console.log('Error exiting browser fullscreen');
      }
    }
    
    // Show control bar
    controlBar.style.transform = 'translateY(0)';
    controlBar.style.opacity = '1';
    
    // Hide revert button
    if (revertBtn) {
      revertBtn.style.display = 'none';
    }
    
    // Restore normal layout
    videoApp.classList.remove('clutter-free');
    
    // Reset any individual video fullscreens
    if (isLocalFullscreen) {
      localVideoHalf.classList.remove('video-half--fullscreen');
      isLocalFullscreen = false;
    }
    if (isRemoteFullscreen) {
      remoteVideoHalf.classList.remove('video-half--fullscreen');
      isRemoteFullscreen = false;
    }
    
    // Update fullscreen icon back to expand icon
    fullscreenIcon.textContent = 'fullscreen';
    
    console.log('Normal mode restored');
  }
}

// Create revert button with theme colors
function createRevertButton() {
  const revertBtn = document.createElement('button');
  revertBtn.id = 'revertBtn';
  revertBtn.className = 'revert-button';
  revertBtn.innerHTML = '<span class="material-symbols-outlined">fullscreen_exit</span>';
  revertBtn.setAttribute('aria-label', 'Exit fullscreen');
  revertBtn.onclick = toggleClutterFree;
  
  document.body.appendChild(revertBtn);
}

// Control Functions
function toggleMicrophone() {
  if (!localStream) return;
  
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    isMicEnabled = !isMicEnabled;
    audioTrack.enabled = isMicEnabled;
    
    toggleMicBtn.classList.toggle('disabled', !isMicEnabled);
    micIcon.textContent = isMicEnabled ? 'mic' : 'mic_off';
  }
}

function toggleCamera() {
  if (!localStream) return;
  
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    isCamEnabled = !isCamEnabled;
    videoTrack.enabled = isCamEnabled;
    
    toggleCamBtn.classList.toggle('disabled', !isCamEnabled);
    camIcon.textContent = isCamEnabled ? 'videocam' : 'videocam_off';
  }
}

async function switchCamera() {
  if (!localStream) return;
  
  try {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) videoTrack.stop();
    
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentCamera, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    
    const newVideoTrack = newStream.getVideoTracks()[0];
    const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    
    if (sender) await sender.replaceTrack(newVideoTrack);
    
    localStream.removeTrack(videoTrack);
    localStream.addTrack(newVideoTrack);
    localVideo.srcObject = localStream;
    
  } catch (error) {
    console.error('Camera switch failed:', error);
  }
}

function toggleLocalVideoFullscreen() {
  console.log('toggleLocalVideoFullscreen called - isClutterFree:', isClutterFree, 'isLocalFullscreen:', isLocalFullscreen);
  
  // In clutter-free mode, clicking should make video fullscreen
  if (isClutterFree) {
    isLocalFullscreen = !isLocalFullscreen;
    
    if (isLocalFullscreen) {
      localVideoHalf.classList.add('video-half--fullscreen');
      console.log('Added fullscreen class to local video');
      // Hide remote video when local is fullscreen
      if (isRemoteFullscreen) {
        remoteVideoHalf.classList.remove('video-half--fullscreen');
        isRemoteFullscreen = false;
        console.log('Removed fullscreen from remote video');
      }
    } else {
      localVideoHalf.classList.remove('video-half--fullscreen');
      console.log('Removed fullscreen class from local video');
    }
  } else {
    // Normal mode behavior (existing functionality)
    isLocalFullscreen = !isLocalFullscreen;
    
    if (isLocalFullscreen) {
      localVideoHalf.classList.add('video-half--fullscreen');
      console.log('Added fullscreen class to local video (normal mode)');
      if (isRemoteFullscreen) {
        remoteVideoHalf.classList.remove('video-half--fullscreen');
        isRemoteFullscreen = false;
        console.log('Removed fullscreen from remote video (normal mode)');
      }
    } else {
      localVideoHalf.classList.remove('video-half--fullscreen');
      console.log('Removed fullscreen class from local video (normal mode)');
    }
  }
}

function toggleRemoteVideoFullscreen() {
  console.log('toggleRemoteVideoFullscreen called - isClutterFree:', isClutterFree, 'isRemoteFullscreen:', isRemoteFullscreen);
  
  // In clutter-free mode, clicking should make video fullscreen
  if (isClutterFree) {
    isRemoteFullscreen = !isRemoteFullscreen;
    
    if (isRemoteFullscreen) {
      remoteVideoHalf.classList.add('video-half--fullscreen');
      console.log('Added fullscreen class to remote video');
      // Hide local video when remote is fullscreen
      if (isLocalFullscreen) {
        localVideoHalf.classList.remove('video-half--fullscreen');
        isLocalFullscreen = false;
        console.log('Removed fullscreen from local video');
      }
    } else {
      remoteVideoHalf.classList.remove('video-half--fullscreen');
      console.log('Removed fullscreen class from remote video');
    }
  } else {
    // Normal mode behavior (existing functionality)
    isRemoteFullscreen = !isRemoteFullscreen;
    
    if (isRemoteFullscreen) {
      remoteVideoHalf.classList.add('video-half--fullscreen');
      console.log('Added fullscreen class to remote video (normal mode)');
      if (isLocalFullscreen) {
        localVideoHalf.classList.remove('video-half--fullscreen');
        isLocalFullscreen = false;
        console.log('Removed fullscreen from local video (normal mode)');
      }
    } else {
      remoteVideoHalf.classList.remove('video-half--fullscreen');
      console.log('Removed fullscreen class from remote video (normal mode)');
    }
  }
}

function endCall() {
  peerConnection.close();
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  remove(offerRef);
  remove(answerRef);
  location.reload();
}

function showSnackbar(message, actionText = null, actionCallback = null) {
  snackbarText.textContent = message;
  
  if (actionText && actionCallback) {
    snackbarAction.textContent = actionText;
    snackbarAction.style.display = 'block';
    snackbarAction.onclick = () => {
      hideSnackbar();
      actionCallback();
    };
  } else {
    snackbarAction.style.display = 'none';
  }
  
  snackbar.classList.add('show');
  setTimeout(hideSnackbar, 3000);
}

function hideSnackbar() {
  snackbar.classList.remove('show');
}

// Handle browser fullscreen changes
document.addEventListener('fullscreenchange', () => {
  // If browser fullscreen was exited externally (ESC key), sync our state
  if (!document.fullscreenElement && isBrowserFullscreen) {
    isBrowserFullscreen = false;
    // If we're in clutter-free mode, exit it too
    if (isClutterFree) {
      toggleClutterFree();
    }
  }
});

// Event Listeners
toggleMicBtn.addEventListener('click', toggleMicrophone);
toggleCamBtn.addEventListener('click', toggleCamera);
endCallBtn.addEventListener('click', endCall);
fullscreenBtn.addEventListener('click', toggleClutterFree); // Changed behavior
switchCameraBtn.addEventListener('click', switchCamera);

// Add debugging for video click events
localVideoHalf.addEventListener('click', (e) => {
  console.log('Local video clicked - Event:', e);
  toggleLocalVideoFullscreen();
});

remoteVideoHalf.addEventListener('click', (e) => {
  console.log('Remote video clicked - Event:', e);
  toggleRemoteVideoFullscreen();
});

snackbarAction.addEventListener('click', hideSnackbar);

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
  
  switch (event.key.toLowerCase()) {
    case 'm': event.preventDefault(); toggleMicrophone(); break;
    case 'v': event.preventDefault(); toggleCamera(); break;
    case 'f': event.preventDefault(); toggleClutterFree(); break; // Changed behavior
    case 'c': event.preventDefault(); switchCamera(); break;
    case '1': event.preventDefault(); toggleLocalVideoFullscreen(); break;
    case '2': event.preventDefault(); toggleRemoteVideoFullscreen(); break;
    case 'escape':
      if (isLocalFullscreen || isRemoteFullscreen) {
        // Exit individual video fullscreen first
        if (isLocalFullscreen) toggleLocalVideoFullscreen();
        if (isRemoteFullscreen) toggleRemoteVideoFullscreen();
      } else if (isClutterFree) {
        // Then exit clutter-free mode
        toggleClutterFree();
      }
      break;
  }
});

// Handle orientation changes
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    if (isLocalFullscreen) {
      localVideoHalf.classList.remove('video-half--fullscreen');
      isLocalFullscreen = false;
    }
    if (isRemoteFullscreen) {
      remoteVideoHalf.classList.remove('video-half--fullscreen');
      isRemoteFullscreen = false;
    }
  }, 100);
});

// Prevent zoom on double tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
  const now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// Initialize
initializeMedia();
