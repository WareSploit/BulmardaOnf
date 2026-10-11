// Firebase v10 модульный SDK через CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 🔧 ЗАМЕНИ НА СВОЙ КОНФИГ ИЗ FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "clipsync-xxxxx.firebaseapp.com",
  databaseURL: "https://clipsync-xxxxx-default-rtdb.firebaseio.com",
  projectId: "clipsync-xxxxx",
  storageBucket: "clipsync-xxxxx.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxx",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export { ref, set, get, onValue, serverTimestamp };