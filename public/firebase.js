// firebase.js
import {
  initializeApp,
  getApps
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

import { getStorage } from
"https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

import {
  doc,
  getDoc,
  getDocFromServer   // ⬅️ HARUS ADA
} from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";


/* ======================
   FIREBASE INIT
====================== */
const firebaseConfig = {
  apiKey: "AIzaSyDbz0MMLlBebwzYBjRDRvxg6otT-sT6ddw",
  authDomain: "r-studio-166bf.firebaseapp.com",
  projectId: "r-studio-166bf",
  storageBucket: "r-studio-166bf.appspot.com",
  messagingSenderId: "119395759354",
  appId: "1:119395759354:web:1e4911c7b1ef9012ab8543",
  measurementId: "G-MM8SE65H4H"
};

// ✅ CEGAH DUPLICATE APP
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

/* ======================
   MAINTENANCE CHECK
====================== */

export async function checkMaintenance(){
  // ⛔ Jangan cek di halaman maintenance
  if (location.pathname.includes("maintenance.html")) return;

  const snap = await getDocFromServer(
    doc(db,"settings","maintenance")
  );

  if (snap.exists() && snap.data().enabled === true) {
    location.replace("maintenance.html");
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

console.log("🔥 Firebase initialized");
