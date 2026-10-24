import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
  getFirestore
} from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';

// Retrieve config from env or localStorage
export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

const DEFAULT_CONFIG: FirebaseConfigOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBl3VdOGAEXwHJCuru-BcmYHSOhpeiUawg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'finance-39d8a.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'finance-39d8a',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'finance-39d8a.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '802578316971',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:802578316971:web:2a9607f292f05c94a681ee',
  measurementId: 'G-X70SJ16W2C'
};

export function getStoredFirebaseConfig(): FirebaseConfigOptions {
  try {
    const saved = localStorage.getItem('user_firebase_config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to parse stored firebase config, using default', e);
  }
  return DEFAULT_CONFIG;
}

export function saveStoredFirebaseConfig(config: FirebaseConfigOptions): void {
  localStorage.setItem('user_firebase_config', JSON.stringify(config));
}

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;
let isDemoMode = false;

export function initializeFirebaseServices(customConfig?: FirebaseConfigOptions) {
  const config = customConfig || getStoredFirebaseConfig();

  isDemoMode = false;

  if (!getApps().length) {
    try {
      app = initializeApp(config);
      auth = getAuth(app);

      // Configure Firestore with modern offline persistence
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        });
      } catch (cacheErr) {
        console.warn('Persistent cache initialization fell back to default:', cacheErr);
        db = getFirestore(app);
      }

      functions = getFunctions(app, 'asia-south1'); // Default to Mumbai / Asia-South1 for low latency in India
    } catch (e) {
      console.warn('Firebase initialization running in local demo mode:', e);
      isDemoMode = true;
    }
  } else {
    app = getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app, 'asia-south1');
  }

  return { app, auth, db, functions, isDemoMode };
}

// Initial default export
const initialized = initializeFirebaseServices();
export const firebaseApp = initialized.app;
export const firebaseAuth = initialized.auth;
export const firestoreDb = initialized.db;
export const firebaseFunctions = initialized.functions;
export const getIsDemoMode = () => isDemoMode;
