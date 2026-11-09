import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline',
});

// Storage keys for persistent reconnect handling
const STORAGE_KEYS = {
  TOKEN: 'pos_google_sheets_token',
  EXPIRES_AT: 'pos_google_sheets_token_expires',
  USER_EMAIL: 'pos_google_sheets_user_email',
  USER_NAME: 'pos_google_sheets_user_name',
  LAST_CONNECTED: 'pos_google_sheets_last_connected',
};

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedExpiresAt: number = 0;

// Load persisted token on module load
try {
  if (typeof window !== 'undefined') {
    const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const storedExpires = Number(localStorage.getItem(STORAGE_KEYS.EXPIRES_AT) || 0);
    if (storedToken && storedExpires > Date.now()) {
      cachedAccessToken = storedToken;
      cachedExpiresAt = storedExpires;
    }
  }
} catch {
  // Ignore localStorage read errors in restricted contexts
}

export type GoogleConnectionStatus = 'CONNECTED' | 'EXPIRED' | 'DISCONNECTED';

export const getGoogleConnectionStatus = (): GoogleConnectionStatus => {
  if (typeof window === 'undefined') return 'DISCONNECTED';
  const token = cachedAccessToken || localStorage.getItem(STORAGE_KEYS.TOKEN);
  const expiresAt = cachedExpiresAt || Number(localStorage.getItem(STORAGE_KEYS.EXPIRES_AT) || 0);

  if (!token) return 'DISCONNECTED';
  if (Date.now() >= expiresAt) return 'EXPIRED';
  return 'CONNECTED';
};

export const getStoredGoogleUser = (): { email: string | null; name: string | null; lastConnected: string | null } => {
  if (typeof window === 'undefined') return { email: null, name: null, lastConnected: null };
  return {
    email: localStorage.getItem(STORAGE_KEYS.USER_EMAIL) || auth.currentUser?.email || null,
    name: localStorage.getItem(STORAGE_KEYS.USER_NAME) || auth.currentUser?.displayName || null,
    lastConnected: localStorage.getItem(STORAGE_KEYS.LAST_CONNECTED) || null,
  };
};

export const clearAuthSession = () => {
  cachedAccessToken = null;
  cachedExpiresAt = 0;
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
      window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: { status: 'DISCONNECTED' } }));
    }
  } catch {
    // Ignore
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const token = await getAccessToken();
      if (token) {
        if (onAuthSuccess) onAuthSuccess(user, token);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      clearAuthSession();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan access token dari Google OAuth. Pastikan izin akses Google Sheets diberikan.');
    }

    const token = credential.accessToken;
    // Google access tokens are valid for 1 hour (3600 seconds). We set 55 minutes to be safe.
    const expiresAt = Date.now() + 55 * 60 * 1000;

    cachedAccessToken = token;
    cachedExpiresAt = expiresAt;

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, String(expiresAt));
        if (result.user.email) {
          localStorage.setItem(STORAGE_KEYS.USER_EMAIL, result.user.email);
        }
        if (result.user.displayName) {
          localStorage.setItem(STORAGE_KEYS.USER_NAME, result.user.displayName);
        }
        localStorage.setItem(STORAGE_KEYS.LAST_CONNECTED, new Date().toISOString());

        window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: { status: 'CONNECTED', email: result.user.email } }));
      }
    } catch (e) {
      console.warn('Failed to persist token to localStorage:', e);
    }

    return { user: result.user, accessToken: token };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      return null;
    }
    if (error?.code === 'auth/popup-blocked') {
      throw new Error(
        'Jendela popup diblokir oleh browser. Mohon izinkan popup di peramban Anda untuk login Google.'
      );
    }
    console.warn('Google Sign in error:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  // Check in-memory cache
  if (cachedAccessToken && cachedExpiresAt > Date.now()) {
    return cachedAccessToken;
  }

  // Check persistent storage
  try {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
      const storedExpires = Number(localStorage.getItem(STORAGE_KEYS.EXPIRES_AT) || 0);

      if (storedToken && storedExpires > Date.now()) {
        cachedAccessToken = storedToken;
        cachedExpiresAt = storedExpires;
        return storedToken;
      }

      // If token expired
      if (storedToken && storedExpires <= Date.now()) {
        clearAuthSession();
        window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: { status: 'EXPIRED' } }));
      }
    }
  } catch {
    // Ignore storage issues
  }

  return null;
};

export const setManualAccessToken = (token: string, expiresInSeconds: number = 3600) => {
  cachedAccessToken = token;
  cachedExpiresAt = Date.now() + (expiresInSeconds - 60) * 1000;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, String(cachedExpiresAt));
      window.dispatchEvent(new CustomEvent('google-auth-changed', { detail: { status: 'CONNECTED' } }));
    }
  } catch {
    // Ignore
  }
};

export const logoutGoogle = async () => {
  try {
    await signOut(auth);
  } catch {
    // Ignore signOut errors
  }
  clearAuthSession();
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.USER_EMAIL);
      localStorage.removeItem(STORAGE_KEYS.USER_NAME);
      localStorage.removeItem(STORAGE_KEYS.LAST_CONNECTED);
    }
  } catch {
    // Ignore
  }
};
