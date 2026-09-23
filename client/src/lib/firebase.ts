import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRDS9xGUcpoCUCMm7ZDIR4vF-03J62KLA",
  authDomain: "ai-canva-22-nbn-fee4b.firebaseapp.com",
  projectId: "ai-canva-22-nbn-fee4b",
  messagingSenderId: "573828725436",
  appId: "1:573828725436:web:15cb37bdc4b06897e9eeb9",
};

const app = initializeApp(firebaseConfig);

// Use localStorage for Auth persistence instead of the default IndexedDB.
// This avoids conflicts with Auth's IndexedDB cache and Firestore's IndexedDB cache.
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

export { auth };
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
