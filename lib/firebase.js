// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCVLT98qadp30EzZE9Lu5LjDCNL4AgAoMI",
  authDomain: "expense-ai-app-d706e.firebaseapp.com",
  projectId: "expense-ai-app-d706e",
  storageBucket: "expense-ai-app-d706e.appspot.com", // ✅ แก้ตรงนี้
  messagingSenderId: "945357724315",
  appId: "1:945357724315:web:112d8d7b6eea546b67443e",
  measurementId: "G-3LM5RVE5T5",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const analytics =
  typeof window !== "undefined" ? getAnalytics(app) : null;

export default app;
