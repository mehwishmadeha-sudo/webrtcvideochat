
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD6xXyoSKQ5GmgfaSOepBRkXPTKgytxlcc",
  authDomain: "videowebrtc-76f27.firebaseapp.com",
  databaseURL: "https://videowebrtc-76f27-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "videowebrtc-76f27",
  storageBucket: "videowebrtc-76f27.firebasestorage.app",
  messagingSenderId: "629250873389",
  appId: "1:629250873389:web:a86d968cfd2ab044c000a4",
  measurementId: "G-Z69C0228F8"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, onValue, set, remove };
