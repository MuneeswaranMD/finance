import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User
} from 'firebase/auth';
import { firebaseAuth, getIsDemoMode } from './firebaseConfig';
import { UserProfile } from '../types/finance';
import { getUserProfile, saveUserProfile } from './firestoreService';

export const DEMO_USER: UserProfile = {
  id: 'demo_user',
  email: 'muneeswaran@example.com',
  displayName: 'Muneeswaran (Demo Mode)',
  currency: 'INR',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-10-24T00:00:00.000Z'
};

export async function loginWithGoogle(): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(firebaseAuth, provider);
  const user = credential.user;

  const existing = await getUserProfile(user.uid);
  if (existing) {
    if (user.photoURL && existing.photoURL !== user.photoURL) {
      existing.photoURL = user.photoURL;
      await saveUserProfile(existing);
    }
    return existing;
  }

  const newProfile: UserProfile = {
    id: user.uid,
    email: user.email || 'user@gmail.com',
    displayName: user.displayName || user.email?.split('@')[0] || 'User',
    photoURL: user.photoURL || undefined,
    currency: 'INR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await saveUserProfile(newProfile);
  return newProfile;
}

export async function registerWithEmail(
  email: string,
  pass: string,
  displayName: string
): Promise<UserProfile> {
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email, pass);
  const uid = credential.user.uid;
  const userProfile: UserProfile = {
    id: uid,
    email: credential.user.email || email,
    displayName: displayName || email.split('@')[0],
    currency: 'INR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await saveUserProfile(userProfile);
  return userProfile;
}

export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, pass);
  const existing = await getUserProfile(credential.user.uid);
  if (existing) {
    return existing;
  }

  const newProfile: UserProfile = {
    id: credential.user.uid,
    email: credential.user.email || email,
    displayName: credential.user.displayName || email.split('@')[0],
    currency: 'INR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await saveUserProfile(newProfile);
  return newProfile;
}

export async function sendResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(firebaseAuth, email);
}

export async function logoutUser(): Promise<void> {
  await signOut(firebaseAuth);
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(firebaseAuth, callback);
}
