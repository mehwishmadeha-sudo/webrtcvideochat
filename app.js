
import { db, ref, onValue, set, remove } from './firebase-config.js';

// Firebase references
const offerRef = ref(db, "offer");
const answerRef = ref(db, "answer");

// DOM Elements
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const localVideoHalf = document.getElementById("localVideoHalf");
const remoteVideoHalf = document.getElementById("remoteVideoHalf");
const toggleMicBtn = document.getElementById("toggleMic");
const toggleCamBtn = document.getElementById("toggleCam");
const endCallBtn = document.getElementById("endCallBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const switchCameraBtn = document.getElementById("switchCamera");
const snackbar = document.getElementById("snackbar");
const snackbarText = document.getElementById("snackbarText");
const snackbarAction = document.getElementById("snackbarAction");
const micIcon = document.getElementById("micIcon");
const camIcon = document.getElementById("camIcon");

// WebRTC
const peerConnection = new RTCPeerConnection({ 
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }] 
});

// State
let localStream;
let isMicEnabled = true;
let isCamEnabled = true;
let isLocalFullscreen = false;
let isRemoteFullscreen = false;
let currentCamera = 'user';
let isConnected = false;
let isClutterFree = false;
let isBrowserFullscreen = false;
let userRole = null; // 'caller' or 'answerer'

// Check if large screen
function isLargeScreen() {
  return window.innerWidth >= 1024;
}

// Initialize media
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

    startSignaling();
    
  } catch (error) {
    console.error('Media error:', error);
    showSnackbar('Camera/microphone access failed', 'Retry', () => initializeMedia());
  }
}

// 3-STATE SIGNALING LOGIC
async function startSignaling() {
  console.log('Starting 3-state signaling...');
  
  // Check offer first
  onValue(offerRef, async (snapshot) => {
    const offer = snapshot.val();
    
    if (offer) {
      console.log('STATE 1: Found offer - deleting and creating answer');
      await remove(offerRef);
      userRole = 'answerer';
      await handleOffer(offer);
    }
  }, { onlyOnce: true });
  
  // Check answer
  onValue(answerRef, async (snapshot) => {
    const answer = snapshot.val();
    
    if (answer) {
      console.log('STATE 2: Found answer - fetching and deleting');
      await remove(answerRef);
      if (userRole === 'caller') {
        await handleAnswer(answer);
      }
    }
  }, { onlyOnce: true });
  
  // If nothing found, create offer
  if (!userRole) {
    console.log('STATE 3: Nothing found - creating offer');
    userRole = 'caller';
    await createOffer();
  }
}

// Create offer
async function createOffer() {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    if (peerConnection.iceGatheringState === 'complete') {
      await uploadOffer();
    } else {
      peerConnection.addEventListener('icegatheringstatechange', async () => {
        if (peerConnection.iceGatheringState === 'complete') {
          await uploadOffer();
        }
      });
    }
  } catch (error) {
    console.error('Create offer error:', error);
  }
}

// Upload offer
async function uploadOffer() {
  try {
    const offerData = {
      type: peerConnection.localDescription.type,
      sdp: peerConnection.localDescription.sdp
    };
    
    await set(offerRef, offerData);
    console.log('Offer uploaded');
  } catch (error) {
    console.error('Upload offer error:', error);
  }
}

// Handle offer and create answer
async function handleOffer(offer) {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    if (peerConnection.iceGatheringState === 'complete') {
      await uploadAnswer();
    } else {
      peerConnection.addEventListener('icegatheringstatechange', async () => {
        if (peerConnection.iceGatheringState === 'complete') {
          await uploadAnswer();
        }
      });
    }
  } catch (error) {
    console.error('Handle offer error:', error);
  }
}

// Upload answer
async function uploadAnswer() {
  try {
    const answerData = {
      type: peerConnection.localDescription.type,
      sdp: peerConnection.localDescription.sdp
    };
    
    await set(answerRef, answerData);
    console.log('Answer uploaded');
  } catch (error) {
    console.error('Upload answer error:', error);
  }
}

// Handle answer
async function handleAnswer(answer) {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('Answer processed');
  } catch (error) {
    console.error('Handle answer error:', error);
  }
}

// WebRTC events
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
    console.log('Connected!');
  }
};

peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    console.log('ICE candidate:', event.candidate.type);
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
    // On large screens, enter browser fullscreen
    if (isLargeScreen() && !document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
        isBrowserFullscreen = true;
      } catch (error) {
        console.log('Browser fullscreen not supported');
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
    
    // Expand video halves
    videoApp.classList.add('clutter-free');
    fullscreenIcon.textContent = 'fullscreen_exit';
  } else {
    // Exit browser fullscreen
    if (isBrowserFullscreen && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
        isBrowserFullscreen = false;
      } catch (error) {
        console.log('Error exiting fullscreen');
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
    
    // Reset video fullscreens
    if (isLocalFullscreen) {
      localVideoHalf.classList.remove('video-half--fullscreen');
      isLocalFullscreen = false;
    }
    if (isRemoteFullscreen) {
      remoteVideoHalf.classList.remove('video-half--fullscreen');
      isRemoteFullscreen = false;
    }
    
    fullscreenIcon.textContent = 'fullscreen';
  }
}

// Create revert button
function createRevertButton() {
  const revertBtn = document.createElement('button');
  revertBtn.id = 'revertBtn';
  revertBtn.className = 'revert-button';
  revertBtn.innerHTML = '<span class="material-symbols-outlined">fullscreen_exit</span>';
  revertBtn.onclick = toggleClutterFree;
  document.body.appendChild(revertBtn);
}

// Control functions
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
  if (isClutterFree) {
    isLocalFullscreen = !isLocalFullscreen;
    
    if (isLocalFullscreen) {
      localVideoHalf.classList.add('video-half--fullscreen');
      if (isRemoteFullscreen) {
        remoteVideoHalf.classList.remove('video-half--fullscreen');
        isRemoteFullscreen = false;
      }
    } else {
      localVideoHalf.classList.remove('video-half--fullscreen');
    }
  }
}

function toggleRemoteVideoFullscreen() {
  if (isClutterFree) {
    isRemoteFullscreen = !isRemoteFullscreen;
    
    if (isRemoteFullscreen) {
      remoteVideoHalf.classList.add('video-half--fullscreen');
      if (isLocalFullscreen) {
        localVideoHalf.classList.remove('video-half--fullscreen');
        isLocalFullscreen = false;
      }
    } else {
      remoteVideoHalf.classList.remove('video-half--fullscreen');
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

// Browser fullscreen change handler
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && isBrowserFullscreen) {
    isBrowserFullscreen = false;
    if (isClutterFree) {
      toggleClutterFree();
    }
  }
});

// Event listeners
toggleMicBtn.addEventListener('click', toggleMicrophone);
toggleCamBtn.addEventListener('click', toggleCamera);
endCallBtn.addEventListener('click', endCall);
fullscreenBtn.addEventListener('click', toggleClutterFree);
switchCameraBtn.addEventListener('click', switchCamera);
localVideoHalf.addEventListener('click', toggleLocalVideoFullscreen);
remoteVideoHalf.addEventListener('click', toggleRemoteVideoFullscreen);
snackbarAction.addEventListener('click', hideSnackbar);

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
  
  switch (event.key.toLowerCase()) {
    case 'm': event.preventDefault(); toggleMicrophone(); break;
    case 'v': event.preventDefault(); toggleCamera(); break;
    case 'f': event.preventDefault(); toggleClutterFree(); break;
    case 'c': event.preventDefault(); switchCamera(); break;
    case '1': event.preventDefault(); toggleLocalVideoFullscreen(); break;
    case '2': event.preventDefault(); toggleRemoteVideoFullscreen(); break;
    case 'escape':
      if (isLocalFullscreen || isRemoteFullscreen) {
        if (isLocalFullscreen) toggleLocalVideoFullscreen();
        if (isRemoteFullscreen) toggleRemoteVideoFullscreen();
      } else if (isClutterFree) {
        toggleClutterFree();
      }
      break;
  }
});

// Orientation change handler
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
document.addEventListener('touchend', (event) => {
  event.preventDefault();
}, false);

// Initialize
initializeMedia();
