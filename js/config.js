// ============================================================
//  Firebase Configuration
//  請將以下佔位符替換為您的 Firebase 專案設定
//  Please replace the placeholders with your Firebase project config
//  Instructions: See README.md for step-by-step setup guide
// ============================================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAW3XoP9WjmvzHp7pC__kbPljVQs-nEXlE",
    authDomain: "interactive-poll-53052.firebaseapp.com",
    projectId: "interactive-poll-53052",
    storageBucket: "interactive-poll-53052.firebasestorage.app",
    messagingSenderId: "636782447827",
    appId: "1:636782447827:web:451094a238b2eabc015826"
};

// ============================================================
//  App Configuration
//  Set your GitHub Pages base URL after deployment
// ============================================================
const APP_CONFIG = {
  // This is auto-detected from the current URL.
  // You can override it manually if needed:
  // baseUrl: "https://YOUR_USERNAME.github.io/YOUR_REPO_NAME"
  baseUrl: (() => {
    const origin = window.location.origin;
    const path = window.location.pathname;
    // Get the base path (e.g., /repo-name/ for GitHub Pages)
    const basePath = path.substring(0, path.lastIndexOf('/') + 1);
    return origin + basePath;
  })()
};

// Initialize Firebase
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const auth = firebase.auth();
