import React, { useEffect, useState } from 'react';
import { db } from '../../db/indexedDB';
import { Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  CheckCircle2,
  X,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
  Cloud,
} from 'lucide-react';

export const SyncQueueModal: React.FC = () => {
  const {
    isSyncModalOpen,
    setSyncModalOpen,
    isOnline,
    pendingSyncCount,
    isSyncing,
    syncNow,
    isSimulatedOffline,
    toggleSimulateOffline,
    googleConnectionStatus,
    googleUserEmail,
    googleUserName,
    loginGoogle,
  } = useApp();

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [pendingSales, setPendingSales] = useState<Sale[]>([]);
  const [syncedSalesCount, setSyncedSalesCount] = useState(0);

  useEffect(() => {
    if (isSyncModalOpen) {
      loadQueueData();
    }
  }, [isSyncModalOpen, isSyncing, pendingSyncCount]);

  const loadQueueData = async () => {
    const [pendingList, syncedCount] = await Promise.all([
      db.sales.where('syncStatus').equals('PENDING').toArray(),
      db.sales.where('syncStatus').equals('SYNCED').count(),
    ]);
    setPendingSales(pendingList);
    setSyncedSalesCount(syncedCount);
  };

  if (!isSyncModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2.5 rounded-2xl ${
                isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Status Koneksi & Database Cloud
              </h3>
              <p className="text-xs text-slate-500">
                Penyimpanan lokal IndexedDB & Sinkronisasi Firebase Firestore
              </p>
            </div>
          </div>
          <button
            onClick={() => setSyncModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Status Box */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              isOnline
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-rose-50/70 border-rose-200 text-rose-950'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="font-bold text-sm">
                  {isOnline ? 'Perangkat Terhubung (Online)' : 'Perangkat Terputus (Offline)'}
                </span>
              </div>
              <p className="text-[11px] mt-1 text-slate-600">
                {isOnline
                  ? 'Koneksi aktif. Transaksi otomatis dicadangkan ke Cloud Firestore.'
                  : 'Aplikasi beroperasi penuh secara offline menggunakan IndexedDB lokal.'}
              </p>
            </div>

            {/* Offline Simulator Switch */}
            <button
              onClick={toggleSimulateOffline}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                isSimulatedOffline
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Gunakan untuk menguji transaksi kasir tanpa internet"
            >
              {isSimulatedOffline ? 'Simulasi Offline: AKTIF' : 'Uji Mode Offline'}
            </button>
          </div>

          {/* Cloud Firestore & Google Account Status */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-blue-600" />
                <span>Cloud Firestore & Autentikasi Google</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-blue-600" />
                <span>Cloud Database Aktif</span>
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-700 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">Akun Google:</span>
                {googleConnectionStatus === 'CONNECTED' ? (
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{googleUserName || googleUserEmail || 'Terautentikasi'}</span>
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      setIsLoggingIn(true);
                      try {
                        await loginGoogle();
                      } finally {
                        setIsLoggingIn(false);
                      }
                    }}
                    disabled={isLoggingIn}
                    className="text-blue-600 hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    {isLoggingIn ? 'Menghubungkan...' : '+ Masuk Akun Google'}
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">Database Cloud:</span>
                <span className="font-mono text-[10px] text-slate-600">ai-studio-newintegratedpos</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">Status Google Sheets:</span>
                <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-semibold">
                  Discontinue (Digantikan Cloud Firestore)
                </span>
              </div>
            </div>
          </div>

          {/* Pending Sync Queue List */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800">
                Transaksi di Antrean Lokal ({pendingSales.length}):
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                {syncedSalesCount} transaksi sudah tersinkron
              </span>
            </div>

            {pendingSales.length === 0 ? (
              <div className="p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1 opacity-70" />
                <p className="font-medium text-slate-700">Semua data lokal telah tersinkronisasi!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tidak ada transaksi tertahan di memori browser.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {pendingSales.map((s) => (
                  <div key={s.id} className="p-3 flex items-center justify-between bg-white">
                    <div>
                      <div className="font-mono font-bold text-slate-900">{s.receiptNo}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(s.timestamp).toLocaleTimeString('id-ID')} &bull; Kasir:{' '}
                        {s.cashierName} ({s.items.length} item)
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">
                        Rp {s.grandTotal.toLocaleString('id-ID')}
                      </span>
                      <span className="block text-[10px] text-amber-600 font-semibold">
                        Menunggu Sync
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => setSyncModalOpen(false)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 cursor-pointer"
          >
            Tutup
          </button>

          <button
            onClick={syncNow}
            disabled={isSyncing || !isOnline}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {isSyncing
                ? 'Sedang Menyinkronkan...'
                : !isOnline
                ? 'Tidak Dapat Sync (Offline)'
                : 'Sinkronkan ke Cloud Firestore Sekarang'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
