import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, initializeDatabase } from '../db/indexedDB';
import { syncManager } from '../services/syncManager';
import { BusinessSettings, CashierShift, UserAccount } from '../types';
import { INITIAL_USERS } from '../db/seedData';
import {
  getGoogleConnectionStatus,
  getStoredGoogleUser,
  GoogleConnectionStatus,
  googleSignIn,
  logoutGoogle,
  initAuth,
} from '../services/auth';
import {
  syncAllToFirestore,
  restoreFromFirestore,
  testFirestoreConnection,
  CloudSyncResult,
  CloudRestoreResult,
} from '../services/firestoreSyncService';

interface AppContextType {
  activeUser: UserAccount;
  setActiveUser: (user: UserAccount) => void;
  activeShift: CashierShift | null;
  refreshShift: () => Promise<void>;
  settings: BusinessSettings | null;
  refreshSettings: () => Promise<void>;
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  isSimulatedOffline: boolean;
  toggleSimulateOffline: () => void;
  isShiftModalOpen: boolean;
  setShiftModalOpen: (open: boolean) => void;
  isSwitchUserModalOpen: boolean;
  setSwitchUserModalOpen: (open: boolean) => void;
  isSyncModalOpen: boolean;
  setSyncModalOpen: (open: boolean) => void;
  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;

  // Cloud / Google Auth & Firestore
  googleConnectionStatus: GoogleConnectionStatus;
  googleUserEmail: string | null;
  googleUserName: string | null;
  googleUserPhoto: string | null;
  loginGoogle: () => Promise<boolean>;
  logoutGoogleUser: () => Promise<void>;
  testFirestore: () => Promise<{ success: boolean; message: string; databaseId?: string }>;
  restoreFromCloud: () => Promise<CloudRestoreResult>;
  reconnectGoogle: () => Promise<boolean>;
  testSheetsConnection: () => Promise<{ success: boolean; message: string; title?: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUser, setActiveUser] = useState<UserAccount>(INITIAL_USERS[0]);
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [isOnline, setIsOnline] = useState(syncManager.getIsOnline());
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(syncManager.getIsSimulatedOffline());
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isShiftModalOpen, setShiftModalOpen] = useState(false);
  const [isSwitchUserModalOpen, setSwitchUserModalOpen] = useState(false);
  const [isSyncModalOpen, setSyncModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );

  const [googleConnectionStatus, setGoogleConnectionStatus] = useState<GoogleConnectionStatus>(
    getGoogleConnectionStatus()
  );
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(getStoredGoogleUser().email);
  const [googleUserName, setGoogleUserName] = useState<string | null>(getStoredGoogleUser().name);
  const [googleUserPhoto, setGoogleUserPhoto] = useState<string | null>(getStoredGoogleUser().photoUrl);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((cur) => (cur?.text === text ? null : cur));
    }, 4500);
  };

  const refreshSettings = async () => {
    const s = await db.settings.get('current_config');
    if (s) setSettings(s);
  };

  const refreshShift = async () => {
    const open = await db.shifts.where('status').equals('OPEN').first();
    setActiveShift(open || null);
  };

  const syncNow = async () => {
    if (!isOnline) {
      showToast('Perangkat sedang offline. Periksa koneksi internet Anda.', 'info');
      return;
    }
    try {
      setIsSyncing(true);
      const res = await syncAllToFirestore();
      showToast(res.message, 'success');
      setPendingSyncCount(await syncManager.getPendingCount());
    } catch (err: any) {
      showToast(err?.message || 'Gagal sinkronisasi ke Cloud Firestore', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleSimulateOffline = () => {
    const nextVal = !isSimulatedOffline;
    setIsSimulatedOffline(nextVal);
    syncManager.setSimulateOffline(nextVal);
    showToast(
      nextVal
        ? 'Mode simulasi offline diaktifkan. Transaksi tersimpan aman di IndexedDB.'
        : 'Kembali online! Mencoba sinkronisasi otomatis ke Cloud Firestore...',
      nextVal ? 'info' : 'success'
    );
  };

  const loginGoogle = async (): Promise<boolean> => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setGoogleConnectionStatus('CONNECTED');
        setGoogleUserEmail(res.user.email);
        setGoogleUserName(res.user.displayName);
        setGoogleUserPhoto(res.user.photoURL);
        showToast(`Login Google berhasil! Masuk sebagai ${res.user.displayName || res.user.email}`, 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(err?.message || 'Gagal masuk dengan akun Google', 'error');
      return false;
    }
  };

  const logoutGoogleUser = async () => {
    await logoutGoogle();
    setGoogleConnectionStatus('DISCONNECTED');
    setGoogleUserEmail(null);
    setGoogleUserName(null);
    setGoogleUserPhoto(null);
    showToast('Telah keluar dari akun Google.', 'info');
  };

  const testFirestore = async () => {
    const res = await testFirestoreConnection();
    if (res.success) {
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
    return res;
  };

  const restoreFromCloud = async (): Promise<CloudRestoreResult> => {
    try {
      const res = await restoreFromFirestore();
      await refreshSettings();
      showToast(res.message, 'success');
      return res;
    } catch (err: any) {
      showToast(err?.message || 'Gagal memulihkan data dari cloud', 'error');
      throw err;
    }
  };

  // Backward compatibility methods for previous calls
  const reconnectGoogle = async (): Promise<boolean> => {
    return loginGoogle();
  };

  const testSheetsConnection = async () => {
    const res = await testFirestoreConnection();
    return { success: res.success, message: res.message, title: 'Cloud Firestore Database' };
  };

  useEffect(() => {
    // Init DB
    initializeDatabase().then(async () => {
      await refreshSettings();
      await refreshShift();

      // Check stored users
      const users = await db.users.toArray();
      if (users.length > 0) {
        const owner = users.find((u) => u.role === 'OWNER') || users[0];
        setActiveUser(owner);
      }

      // Check Google connection status
      const status = getGoogleConnectionStatus();
      setGoogleConnectionStatus(status);
      const stored = getStoredGoogleUser();
      setGoogleUserEmail(stored.email);
      setGoogleUserName(stored.name);
      setGoogleUserPhoto(stored.photoUrl);
    });

    // Subscribe to Firebase Auth listener
    const unsubscribeAuth = initAuth((user) => {
      setGoogleConnectionStatus('CONNECTED');
      setGoogleUserEmail(user.email);
      setGoogleUserName(user.displayName);
      setGoogleUserPhoto(user.photoURL);
    });

    let prevPending = 0;
    const unsubscribeSync = syncManager.subscribe((online, pending, syncing, msg) => {
      setIsOnline(online);
      setPendingSyncCount(pending);
      setIsSyncing(syncing);

      if (prevPending > 0 && pending === 0 && online) {
        showToast('Sinkronisasi otomatis ke Cloud Firestore berhasil!', 'success');
      }
      prevPending = pending;
    });

    // Listen for custom auth events
    const handleAuthChanged = (e: any) => {
      const status = getGoogleConnectionStatus();
      setGoogleConnectionStatus(status);
      const stored = getStoredGoogleUser();
      setGoogleUserEmail(stored.email);
      setGoogleUserName(stored.name);
      setGoogleUserPhoto(stored.photoUrl);
    };

    window.addEventListener('google-auth-changed', handleAuthChanged);

    return () => {
      unsubscribeAuth();
      unsubscribeSync();
      window.removeEventListener('google-auth-changed', handleAuthChanged);
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeUser,
        setActiveUser,
        activeShift,
        refreshShift,
        settings,
        refreshSettings,
        isOnline,
        pendingSyncCount,
        isSyncing,
        syncNow,
        isSimulatedOffline,
        toggleSimulateOffline,
        isShiftModalOpen,
        setShiftModalOpen,
        isSwitchUserModalOpen,
        setSwitchUserModalOpen,
        isSyncModalOpen,
        setSyncModalOpen,
        toastMessage,
        showToast,
        googleConnectionStatus,
        googleUserEmail,
        googleUserName,
        googleUserPhoto,
        loginGoogle,
        logoutGoogleUser,
        testFirestore,
        restoreFromCloud,
        reconnectGoogle,
        testSheetsConnection,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
