// ============================================================
// Flyggo Bus Travel — Firebase Configuration
// Project: flyggo-bus-travel
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBozKmwpeABj5Nci3UZtHa5YoUcdtiE7Kk",
  authDomain: "flyggo-bus-travel.firebaseapp.com",
  projectId: "flyggo-bus-travel",
  storageBucket: "flyggo-bus-travel.firebasestorage.app",
  messagingSenderId: "79097776141",
  appId: "1:79097776141:web:e8ad33b64fce3c8bdf6d44",
  measurementId: "G-BTVSFVNCSX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ============================================================
// CLOUDINARY CONFIG — Update with your credentials
// ============================================================
export const CLOUDINARY_CONFIG = {
  cloudName: "dxyz123abc",   // ← paste yours here
  uploadPreset: "flyggo_gallery",
  folder: "flyggo/gallery"
};

export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
