// src/services/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// YOUR Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDnfSNZQ8AB8hE1KWBKBIfPNWxw2FMdJ80",
  authDomain: "splitsync-dev.firebaseapp.com",
  projectId: "splitsync-dev",
  storageBucket: "splitsync-dev.firebasestorage.app",
  messagingSenderId: "581596264864",
  appId: "1:581596264864:web:a6d937458258abec604cc5",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;