import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Clean Google Auth Provider (Standard Google Profile & Email, NO deprecated Sheets/Drive scopes)
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Storage keys for persistent state cache
const STORAGE_KEYS = {
  USER_EMAIL: 'pos_cloud_user_email',
  USER_NAME: 'pos_cloud_user_name',
  USER_PHOTO: 'pos_cloud_user_photo',
  USER_UID: 'pos_cloud_user_uid',
  AUTH_METHOD: 'pos_cloud_auth_method',
  LAST_CONNECTED: 'pos_cloud_last_connected',
};

export type GoogleConnectionStatus = 'CONNECTED' | 'EXPIRED' | 'DISCONNECTED';

let currentUserCache: User | null = null;

// Synchronous check for UI
export const getGoogleConnectionStatus = (): GoogleConnectionStatus => {
  if (typeof window === 'undefined') return 'DISCONNECTED';
  if (auth.currentUser || currentUserCache) return 'CONNECTED';
  const savedEmail = localStorage.getItem(STORAGE_KEYS.USER_EMAIL);
  return savedEmail ? 'CONNECTED' : 'DISCONNECTED';
};

export const getStoredGoogleUser = (): {
  email: string | null;
  name: string | null;
  photoUrl: string | null;
  uid: string | null;
  lastConnected: string | null;
  authMethod: string | null;
} => {
  if (typeof window === 'undefined') {
    return { email: null, name: null, photoUrl: null, uid: null, lastConnected: null, authMethod: null };
  }
  const u = auth.currentUser || currentUserCache;
  return {
    email: u?.email || localStorage.getItem(STORAGE_KEYS.USER_EMAIL) || null,
    name: u?.displayName || localStorage.getItem(STORAGE_KEYS.USER_NAME) || null,
    photoUrl: u?.photoURL || localStorage.getItem(STORAGE_KEYS.USER_PHOTO) || null,
    uid: u?.uid || localStorage.getItem(STORAGE_KEYS.USER_UID) || null,
    lastConnected: localStorage.getItem(STORAGE_KEYS.LAST_CONNECTED) || null,
    authMethod: localStorage.getItem(STORAGE_KEYS.AUTH_METHOD) || 'google',
  };
};

const persistUserToStorage = (user: User | null, method: string = 'google') => {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      currentUserCache = user;
      if (user.email) localStorage.setItem(STORAGE_KEYS.USER_EMAIL, user.email);
      if (user.displayName) localStorage.setItem(STORAGE_KEYS.USER_NAME, user.displayName);
      if (user.photoURL) localStorage.setItem(STORAGE_KEYS.USER_PHOTO, user.photoURL);
      if (user.uid) localStorage.setItem(STORAGE_KEYS.USER_UID, user.uid);
      localStorage.setItem(STORAGE_KEYS.AUTH_METHOD, method);
      localStorage.setItem(STORAGE_KEYS.LAST_CONNECTED, new Date().toISOString());
      window.dispatchEvent(
        new CustomEvent('google-auth-changed', {
          detail: { status: 'CONNECTED', email: user.email, user },
        })
      );
    } else {
      currentUserCache = null;
      localStorage.removeItem(STORAGE_KEYS.USER_EMAIL);
      localStorage.removeItem(STORAGE_KEYS.USER_NAME);
      localStorage.removeItem(STORAGE_KEYS.USER_PHOTO);
      localStorage.removeItem(STORAGE_KEYS.USER_UID);
      localStorage.removeItem(STORAGE_KEYS.AUTH_METHOD);
      window.dispatchEvent(
        new CustomEvent('google-auth-changed', {
          detail: { status: 'DISCONNECTED' },
        })
      );
    }
  } catch (err) {
    console.warn('Storage persistence error:', err);
  }
};

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      currentUserCache = user;
      persistUserToStorage(user);
      if (onAuthSuccess) onAuthSuccess(user);
    } else {
      currentUserCache = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Modern Google Sign-In with Firebase Authentication
 * Does not require Google Sheets scopes; no 1-hour token expiration.
 */
export const googleSignIn = async (): Promise<{ user: User } | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    persistUserToStorage(result.user, 'google');
    return { user: result.user };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      return null;
    }
    if (error?.code === 'auth/popup-blocked') {
      throw new Error('Jendela popup login Google diblokir peramban. Silakan izinkan popup untuk domain ini.');
    }
    console.error('Google Sign in error:', error);
    throw error;
  }
};

/**
 * Email & Password Sign In
 */
export const signInWithEmail = async (email: string, pass: string): Promise<User> => {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  persistUserToStorage(cred.user, 'password');
  return cred.user;
};

/**
 * Email & Password Sign Up
 */
export const signUpWithEmail = async (email: string, pass: string): Promise<User> => {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  persistUserToStorage(cred.user, 'password');
  return cred.user;
};

/**
 * Sign out from Google & Firebase Auth
 */
export const logoutGoogle = async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Sign out error:', err);
  }
  persistUserToStorage(null);
};

// Backward-compatibility wrappers for legacy sheets calls
export const getAccessToken = async (): Promise<string | null> => {
  const user = auth.currentUser || currentUserCache;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
};

export const clearAuthSession = () => {
  persistUserToStorage(null);
};
