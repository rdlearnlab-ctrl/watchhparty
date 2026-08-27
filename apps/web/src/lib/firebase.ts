import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your exact Firebase configuration
const firebaseConfig = {
 apiKey: "AIzaSyCEgLxDfbAj5sCoiqNavD0GOb1PElVjufU",
 authDomain: "party-6e70c.firebaseapp.com",
 projectId: "party-6e70c",
 storageBucket: "party-6e70c.firebasestorage.app",
 messagingSenderId: "21104677518",
 appId: "1:21104677518:web:7021d37f6d814d5cd12fdf",
 measurementId: "G-VTTQ7SB6R5"
};

// Initialize Firebase safely for Next.js (prevents duplicate instances)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };