
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

// === INITIAL LOAD ===
// read offer and answer from Firebase root
async function startSignaling() {
  console.log('=== INITIAL LOAD ===');
  console.log('read offer and answer from Firebase root');
  
  // Read both offer and answer
  const offerSnapshot = await new Promise(resolve => {
    onValue(offerRef, resolve, { onlyOnce: true });
  });
  const answerSnapshot = await new Promise(resolve => {
    onValue(answerRef, resolve, { onlyOnce: true });
  });
  
  const offer = offerSnapshot.val();
  const answer = answerSnapshot.val();
  
  // === SCENARIO 1: Nothing in Firebase ===
  if (offer == null && answer == null) {
    console.log('=== SCENARIO 1: Nothing in Firebase ===');
    console.log('No offer or answer. I am the first peer.');
    
    const myOffer = await createOffer();
    await set(offerRef, { sdp: myOffer.sdp, type: myOffer.type });
    console.log('set /offer = myOffer.sdp');
    
    console.log('listen for /answer:');
    onValue(answerRef, async (snapshot) => {
      const answerData = snapshot.val();
      if (answerData) {
        console.log('when answer arrives:');
        await connectToPeer(answerData);
        console.log('connectToPeer(answer.sdp)');
      }
    });
  }
  // === SCENARIO 2: Offer exists, Answer missing ===
  else if (offer != null && answer == null) {
    console.log('=== SCENARIO 2: Offer exists, Answer missing ===');
    console.log('Offer exists but no answer. I am the second peer.');
    
    const myAnswer = await createAnswer(offer);
    await set(answerRef, { sdp: myAnswer.sdp, type: myAnswer.type });
    console.log('set /answer = myAnswer.sdp');
    console.log('Done. Do NOT listen to Firebase anymore.');
  }
  // === SCENARIO 3: Offer and Answer both exist ===
  else if (offer != null && answer != null) {
    console.log('=== SCENARIO 3: Offer and Answer both exist ===');
    console.log('Both offer and answer exist. Assuming stale session.');
    
    await remove(offerRef);
    await remove(answerRef);
    console.log('delete /offer');
    console.log('delete /answer');
    
    console.log('Restart fresh (go back to Scenario 1)');
    const myOffer = await createOffer();
    await set(offerRef, { sdp: myOffer.sdp, type: myOffer.type });
    console.log('set /offer = myOffer.sdp');
    
    console.log('listen for /answer:');
    onValue(answerRef, async (snapshot) => {
      const answerData = snapshot.val();
      if (answerData) {
        console.log('when answer arrives:');
        await connectToPeer(answerData);
        console.log('connectToPeer(answer.sdp)');
      }
    });
  }
}

// Create offer
async function createOffer() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  
  // Wait for ICE gathering
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
}

// Create answer
async function createAnswer(offer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  
  // Wait for ICE gathering
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
}

// Connect to peer
async function connectToPeer(answer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
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

function toggleRemoteVideoFullscreen() {
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
  if (isLocalFullscreen) {
    localVideoHalf.classList.remove('video-half--fullscreen');
    isLocalFullscreen = false;
  }
  if (isRemoteFullscreen) {
    remoteVideoHalf.classList.remove('video-half--fullscreen');
    isRemoteFullscreen = false;
  }
});

// Prevent zoom on double tap
document.addEventListener('touchend', (event) => {
  event.preventDefault();
}, false);

// Initialize
initializeMedia();
