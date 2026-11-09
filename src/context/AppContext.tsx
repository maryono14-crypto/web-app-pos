import React, { createContext, useContext, useEffect, useState } from 'react';
import { db, initializeDatabase } from '../db/indexedDB';
import { syncManager } from '../services/syncManager';
import { BusinessSettings, CashierShift, UserAccount } from '../types';
import { INITIAL_USERS } from '../db/seedData';
import {
  getGoogleConnectionStatus,
  getStoredGoogleUser,
  GoogleConnectionStatus,
} from '../services/auth';
import { reconnectGoogleSheets, testGoogleSheetsConnection } from '../services/sheetsService';

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
  googleConnectionStatus: GoogleConnectionStatus;
  googleUserEmail: string | null;
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
    const res = await syncManager.triggerAutoSync();
    if (res.success) {
      showToast(res.message || 'Sinkronisasi berhasil!', 'success');
      await refreshSettings();
    } else {
      showToast(res.message || 'Gagal sinkronisasi', 'error');
    }
  };

  const toggleSimulateOffline = () => {
    const nextVal = !isSimulatedOffline;
    setIsSimulatedOffline(nextVal);
    syncManager.setSimulateOffline(nextVal);
    showToast(
      nextVal
        ? 'Mode simulasi offline diaktifkan. Transaksi akan disimpan di IndexedDB.'
        : 'Kembali online! Mencoba sinkronisasi otomatis ke Google Sheets...',
      nextVal ? 'info' : 'success'
    );
  };

  const reconnectGoogle = async (): Promise<boolean> => {
    const res = await reconnectGoogleSheets();
    if (res.success) {
      setGoogleConnectionStatus('CONNECTED');
      const u = getStoredGoogleUser();
      setGoogleUserEmail(u.email);
      showToast(res.message, 'success');
      await refreshSettings();
      await syncManager.triggerAutoSync();
      return true;
    } else {
      showToast(res.message, 'error');
      return false;
    }
  };

  const testSheetsConnection = async () => {
    const res = await testGoogleSheetsConnection();
    if (res.success) {
      setGoogleConnectionStatus('CONNECTED');
      showToast(res.message, 'success');
    } else {
      if (res.isAuthExpired) {
        setGoogleConnectionStatus('EXPIRED');
      }
      showToast(res.message, 'error');
    }
    return { success: res.success, message: res.message, title: res.spreadsheetTitle };
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
      setGoogleUserEmail(getStoredGoogleUser().email);
    });

    let prevPending = 0;
    const unsubscribe = syncManager.subscribe((online, pending, syncing, msg) => {
      setIsOnline(online);
      setPendingSyncCount(pending);
      setIsSyncing(syncing);

      if (prevPending > 0 && pending === 0 && online) {
        showToast('Sinkronisasi otomatis ke Google Sheets berhasil!', 'success');
      }
      prevPending = pending;
    });

    // Listen for auth & connection changes
    const handleAuthChanged = () => {
      const status = getGoogleConnectionStatus();
      setGoogleConnectionStatus(status);
      setGoogleUserEmail(getStoredGoogleUser().email);
    };

    const handleConnLost = (e: any) => {
      setGoogleConnectionStatus('EXPIRED');
      showToast('Koneksi Google Sheets terputus. Klik "Hubungkan Ulang" untuk melanjutkan sinkronisasi.', 'info');
    };

    window.addEventListener('google-auth-changed', handleAuthChanged);
    window.addEventListener('google-sheets-connection-lost', handleConnLost);
    window.addEventListener('google-sheets-reconnected', handleAuthChanged);

    return () => {
      unsubscribe();
      window.removeEventListener('google-auth-changed', handleAuthChanged);
      window.removeEventListener('google-sheets-connection-lost', handleConnLost);
      window.removeEventListener('google-sheets-reconnected', handleAuthChanged);
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
