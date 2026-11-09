import React from 'react';
import { useApp } from '../../context/AppContext';
import { PWAInstallButton } from '../common/PWAInstallButton';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  UserCheck,
  FileSpreadsheet,
  ExternalLink,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onNavigate: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu, onNavigate }) => {
  const {
    activeUser,
    activeShift,
    setShiftModalOpen,
    setSwitchUserModalOpen,
    setSyncModalOpen,
    isOnline,
    pendingSyncCount,
    isSyncing,
    syncNow,
    isSimulatedOffline,
    settings,
    googleConnectionStatus,
  } = useApp();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between z-30 shrink-0">
      {/* Mobile Hamburger & Store Info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
          title="Buka Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <div className="min-w-0">
          <div className="font-black text-xs sm:text-sm text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
            <span className="truncate">{settings?.storeName || 'Toko Berkah'}</span>
            <span className="text-[9px] sm:text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              {settings?.costingMethod || 'FIFO'}
            </span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 truncate max-w-[160px] sm:max-w-[240px] hidden xs:block">
            {settings?.storeTagline || 'Integrated Retail POS & BI'}
          </div>
        </div>
      </div>

      {/* Middle & Right Status Badges */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* PWA In-App Install Button */}
        <PWAInstallButton />

        {/* Online / Offline Status Badge (Clickable to open Sync Modal) */}
        <button
          onClick={() => setSyncModalOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
            isOnline
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
          }`}
          title={
            isOnline
              ? 'Online — Klik untuk melihat status sinkronisasi'
              : 'Offline — Transaksi tersimpan di IndexedDB'
          }
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="hidden md:inline">
            {isSimulatedOffline ? 'Simulasi Offline' : isOnline ? 'Online' : 'Offline'}
          </span>
        </button>

        {/* Cloud Firestore Sync Pill */}
        <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
          <button
            onClick={() => setSyncModalOpen(true)}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              pendingSyncCount > 0
                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                : 'text-slate-700 hover:bg-white'
            }`}
            title="Lihat status antrean atau sinkronisasi ke Cloud Firestore"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-emerald-700 ${isSyncing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">
              {isSyncing
                ? 'Menyinkronkan...'
                : pendingSyncCount > 0
                ? `Cloud Sync (${pendingSyncCount})`
                : 'Cloud Terhubung'}
            </span>
          </button>
        </div>

        {/* Shift Button */}
        <button
          onClick={() => setShiftModalOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeShift
              ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200/80 border border-emerald-300'
              : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
          }`}
          title="Manajemen Shift Kasir"
        >
          <Clock className="w-3.5 h-3.5 text-slate-700" />
          <span className="hidden sm:inline">
            {activeShift ? 'Shift Aktif' : 'Buka Shift'}
          </span>
        </button>

        {/* Active User Switcher */}
        <button
          onClick={() => setSwitchUserModalOpen(true)}
          className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-left transition-colors cursor-pointer"
          title="Ganti Pengguna / Kasir"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-700 text-white font-bold text-[10px] flex items-center justify-center">
            {activeUser.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-bold text-slate-800 leading-none truncate max-w-[120px]">
              {activeUser.name}
            </div>
            <div className="text-[10px] font-semibold text-slate-500 leading-none mt-0.5">
              {activeUser.role}
            </div>
          </div>
          <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
        </button>
      </div>
    </header>
  );
};
