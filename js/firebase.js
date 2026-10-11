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

// 🔧 Реальный конфиг из Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAtcBdqOncoh_rCLsjVvCWcNDYshCZeAAw",
  authDomain: "clipsyns-ae937.firebaseapp.com",
  databaseURL: "https://clipsyns-ae937-default-rtdb.firebaseio.com",
  projectId: "clipsyns-ae937",
  storageBucket: "clipsyns-ae937.firebasestorage.app",
  messagingSenderId: "963165750570",
  appId: "1:963165750570:web:ae1fa6e23bbe667f374a53",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export { ref, set, get, onValue, serverTimestamp };
